import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as util from 'util'

const LOG_DIR_NAME = 'logs'
const MAX_LOG_AGE_DAYS = 30

type ConsoleMethod = (...args: any[]) => void

export interface ElectronLogFilePayload {
  filename: string
  size: number
  modifiedAt: string
  content: string
}

export interface WorkoutLogSessionOptions {
  masterId: string | number
  userId?: string | number | null
}

interface WorkoutLogSession {
  masterId: string
  userId?: string
  startedAt: string
  filename: string
  filePath: string
}

interface OriginalConsole {
  log: ConsoleMethod
  error: ConsoleMethod
  warn: ConsoleMethod
  info: ConsoleMethod
}

const SYSTEM_DIAG_INTERVAL_MS = 120_000
const formatMB = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(1)}MB`

class FileLogger {
  private logStream: fs.WriteStream | null = null
  private originalConsole: OriginalConsole | null = null
  private logDir = ''
  private diagTimer: ReturnType<typeof setInterval> | null = null
  private activeWorkoutLogSession: WorkoutLogSession | null = null
  private lastWorkoutLogSession: WorkoutLogSession | null = null

  initialize(): void {
    try {
      this.logDir = path.join(app.getPath('userData'), LOG_DIR_NAME)
      fs.mkdirSync(this.logDir, { recursive: true })

      const timestamp = this.formatTimestampForFilename(new Date())
      const logFileName = `log_${timestamp}.txt`
      const logFilePath = path.join(this.logDir, logFileName)

      this.openLogStream(logFilePath)

      this.writeHeader()
      this.interceptConsole()
      this.setupCrashHandlers()
      this.cleanOldLogs(MAX_LOG_AGE_DAYS)
    } catch (err) {
      console.error('FileLogger 초기화 실패:', err)
    }
  }

  startSystemDiagnostics(): void {
    this.logSystemMemory()
    this.logGPUInfo()
    this.diagTimer = setInterval(() => this.logSystemMemory(), SYSTEM_DIAG_INTERVAL_MS)
  }

  collectLogsForDate(date: Date = new Date()): ElectronLogFilePayload[] {
    if (!this.logDir) return []

    const dayPrefix = `log_${this.formatDateForFilenamePrefix(date)}`
    try {
      return fs.readdirSync(this.logDir)
        .filter((file) => file.startsWith(dayPrefix) && file.endsWith('.txt'))
        .sort()
        .map((file) => {
          const filePath = path.join(this.logDir, file)
          const stat = fs.statSync(filePath)
          return {
            filename: file,
            size: stat.size,
            modifiedAt: stat.mtime.toISOString(),
            content: fs.readFileSync(filePath, 'utf-8'),
          }
        })
    } catch (error) {
      console.error('당일 로그 수집 실패:', error)
      return []
    }
  }

  beginWorkoutLogSession(options: WorkoutLogSessionOptions): WorkoutLogSession | null {
    if (!this.logDir) return null

    const masterId = this.toOptionalString(options.masterId)
    if (!masterId) return null

    try {
      this.writeToFile('============================================================')
      this.writeToFile(`=== Workout Log Session Rotating: masterId=${masterId} ===`)
      this.writeToFile('============================================================')
      this.closeLogStream()

      const now = new Date()
      const userId = this.toOptionalString(options.userId)
      const filename = [
        `log_${this.formatTimestampForFilename(now)}`,
        `master-${this.sanitizeFilenamePart(masterId)}`,
        userId ? `user-${this.sanitizeFilenamePart(userId)}` : null,
      ].filter(Boolean).join('__') + '.txt'
      const filePath = path.join(this.logDir, filename)

      const session: WorkoutLogSession = {
        masterId,
        userId: userId || undefined,
        startedAt: now.toISOString(),
        filename,
        filePath,
      }

      this.openLogStream(filePath)
      this.activeWorkoutLogSession = session
      this.lastWorkoutLogSession = session
      this.writeWorkoutSessionHeader(session)
      return session
    } catch (error) {
      console.error('운동 로그 세션 시작 실패:', error)
      return null
    }
  }

  collectCurrentWorkoutSessionLogs(masterId?: string | number | null): ElectronLogFilePayload[] {
    const session = this.activeWorkoutLogSession ?? this.lastWorkoutLogSession
    if (!session) return []

    const expectedMasterId = this.toOptionalString(masterId)
    if (expectedMasterId && session.masterId !== expectedMasterId) return []

    const payload = this.readLogPayload(session.filePath, session.filename)
    return payload ? [payload] : []
  }

  shutdown(): void {
    if (this.diagTimer) {
      clearInterval(this.diagTimer)
      this.diagTimer = null
    }

    this.writeToFile('============================================================')
    this.writeToFile(`=== App Closed: ${this.formatTimestamp(new Date())} ===`)
    this.writeToFile('============================================================')

    if (this.logStream) {
      this.closeLogStream()
    }

    this.restoreConsole()
  }

  private openLogStream(filePath: string): void {
    this.logStream = fs.createWriteStream(filePath, { flags: 'a', encoding: 'utf8' })
  }

  private closeLogStream(): void {
    if (!this.logStream) return
    this.logStream.end()
    this.logStream = null
  }

  private writeHeader(): void {
    const now = new Date()
    const electronVersion = process.versions.electron || 'unknown'
    const nodeVersion = process.versions.node || 'unknown'
    const platform = process.platform

    this.writeToFile('============================================================')
    this.writeToFile(`=== LinkHiit App Started: ${this.formatTimestamp(now)} ===`)
    this.writeToFile(`=== Electron: ${electronVersion} | Node: ${nodeVersion} | Platform: ${platform} ===`)
    this.writeToFile(`=== Log Dir: ${this.logDir} ===`)
    this.writeToFile('============================================================')
  }

  private writeWorkoutSessionHeader(session: WorkoutLogSession): void {
    this.writeToFile('============================================================')
    this.writeToFile(`=== Workout Log Session Started: ${this.formatTimestamp(new Date(session.startedAt))} ===`)
    this.writeToFile(`=== Master ID: ${session.masterId} ===`)
    if (session.userId) this.writeToFile(`=== User ID: ${session.userId} ===`)
    this.writeToFile(`=== Log Dir: ${this.logDir} ===`)
    this.writeToFile('============================================================')
  }

  private interceptConsole(): void {
    this.originalConsole = {
      log: console.log.bind(console),
      error: console.error.bind(console),
      warn: console.warn.bind(console),
      info: console.info.bind(console),
    }

    console.log = (...args: any[]) => {
      this.originalConsole!.log(...args)
      this.appendLog('LOG', args)
    }

    console.error = (...args: any[]) => {
      this.originalConsole!.error(...args)
      this.appendLog('ERROR', args)
    }

    console.warn = (...args: any[]) => {
      this.originalConsole!.warn(...args)
      this.appendLog('WARN', args)
    }

    console.info = (...args: any[]) => {
      this.originalConsole!.info(...args)
      this.appendLog('INFO', args)
    }
  }

  private restoreConsole(): void {
    if (!this.originalConsole) return
    console.log = this.originalConsole.log
    console.error = this.originalConsole.error
    console.warn = this.originalConsole.warn
    console.info = this.originalConsole.info
    this.originalConsole = null
  }

  private setupCrashHandlers(): void {
    process.on('uncaughtException', (error: Error) => {
      this.appendLog('FATAL', [`Uncaught Exception: ${error.stack || error.message}`])
      this.originalConsole?.error('Uncaught Exception:', error)
    })

    process.on('unhandledRejection', (reason: unknown) => {
      const message = reason instanceof Error
        ? reason.stack || reason.message
        : String(reason)
      this.appendLog('FATAL', [`Unhandled Rejection: ${message}`])
      this.originalConsole?.error('Unhandled Rejection:', reason)
    })
  }

  private cleanOldLogs(maxAgeDays: number): void {
    try {
      const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000
      const files = fs.readdirSync(this.logDir)

      for (const file of files) {
        if (!file.startsWith('log_') || !file.endsWith('.txt')) continue
        const filePath = path.join(this.logDir, file)
        const stat = fs.statSync(filePath)
        if (stat.mtimeMs < cutoff) {
          fs.unlinkSync(filePath)
        }
      }
    } catch {
      // 정리 실패는 무시
    }
  }

  private readLogPayload(filePath: string, filename: string): ElectronLogFilePayload | null {
    try {
      const stat = fs.statSync(filePath)
      return {
        filename,
        size: stat.size,
        modifiedAt: stat.mtime.toISOString(),
        content: fs.readFileSync(filePath, 'utf-8'),
      }
    } catch (error) {
      console.error('운동 로그 파일 수집 실패:', error)
      return null
    }
  }

  private logSystemMemory(): void {
    try {
      const mem = process.memoryUsage()
      this.appendLog('DIAG', [
        `[메인 메모리] RSS: ${formatMB(mem.rss)}, Heap: ${formatMB(mem.heapUsed)}/${formatMB(mem.heapTotal)}, External: ${formatMB(mem.external)}`
      ])
    } catch { /* ignore */ }
  }

  private logGPUInfo(): void {
    app.getGPUInfo('basic').then((info: any) => {
      const gpu = info?.gpuDevice?.[0]
      if (gpu) {
        this.appendLog('DIAG', [
          `[GPU] ${gpu.description || 'unknown'} (vendorId=0x${gpu.vendorId?.toString(16)}, deviceId=0x${gpu.deviceId?.toString(16)})`
        ])
      }
      if (info?.auxAttributes?.glRenderer) {
        this.appendLog('DIAG', [`[GPU GL] ${info.auxAttributes.glRenderer}`])
      }
    }).catch(() => { /* ignore */ })
  }

  appendRendererLog(level: number, message: string, line: number, sourceId: string): void {
    const levelMap: Record<number, string> = { 0: 'VERBOSE', 1: 'INFO', 2: 'WARN', 3: 'ERROR' }
    const tag = levelMap[level] ?? 'LOG'
    const source = sourceId ? ` (${sourceId}:${line})` : ''
    const logLine = `[${this.formatTimestamp(new Date())}] [RENDERER:${tag}] ${message}${source}`
    this.writeToFile(logLine)
  }

  private appendLog(level: string, args: any[]): void {
    const formatted = args
      .map(a => (typeof a === 'string' ? a : util.inspect(a, { depth: 4, colors: false })))
      .join(' ')
    const line = `[${this.formatTimestamp(new Date())}] [${level}] ${formatted}`
    this.writeToFile(line)
  }

  private writeToFile(line: string): void {
    if (!this.logStream) return
    try {
      this.logStream.write(line + '\n')
    } catch {
      // 쓰기 실패는 무시 (앱 안정성 우선)
    }
  }

  private formatTimestamp(date: Date): string {
    const y = date.getFullYear()
    const mo = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    const h = String(date.getHours()).padStart(2, '0')
    const mi = String(date.getMinutes()).padStart(2, '0')
    const s = String(date.getSeconds()).padStart(2, '0')
    const ms = String(date.getMilliseconds()).padStart(3, '0')
    return `${y}-${mo}-${d} ${h}:${mi}:${s}.${ms}`
  }

  private formatTimestampForFilename(date: Date): string {
    const y = date.getFullYear()
    const mo = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    const h = String(date.getHours()).padStart(2, '0')
    const mi = String(date.getMinutes()).padStart(2, '0')
    const s = String(date.getSeconds()).padStart(2, '0')
    return `${y}-${mo}-${d}_${h}-${mi}-${s}`
  }

  private formatDateForFilenamePrefix(date: Date): string {
    const y = date.getFullYear()
    const mo = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${mo}-${d}`
  }

  private sanitizeFilenamePart(value: string): string {
    return value
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'unknown'
  }

  private toOptionalString(value: unknown): string | null {
    if (value === null || typeof value === 'undefined') return null
    const text = String(value).trim()
    return text ? text : null
  }
}

export const fileLogger = new FileLogger()
