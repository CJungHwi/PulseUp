import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export type ScreenMode = 'three' | 'five'

const DEFAULT_MODE: ScreenMode = 'three'
const FILE_NAME = 'screen-mode.json'

let cachedMode: ScreenMode | null = null

function getStoreDir(): string {
  try {
    const dir = app.getPath('userData')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    return dir
  } catch {
    const fallback = path.join(os.homedir(), '.linkhiit')
    if (!fs.existsSync(fallback)) fs.mkdirSync(fallback, { recursive: true })
    return fallback
  }
}

function getStoreFilePath(): string {
  return path.join(getStoreDir(), FILE_NAME)
}

function isValidMode(value: unknown): value is ScreenMode {
  return value === 'three' || value === 'five'
}

export function getScreenMode(): ScreenMode {
  if (cachedMode) return cachedMode
  try {
    const filePath = getStoreFilePath()
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8')
      const parsed = JSON.parse(raw)
      if (parsed && isValidMode(parsed.mode)) {
        cachedMode = parsed.mode
        return parsed.mode
      }
    }
  } catch (err) {
    console.warn('[screen-mode-store] 읽기 실패, 기본값 사용:', err)
  }
  cachedMode = DEFAULT_MODE
  return DEFAULT_MODE
}

export function setScreenMode(mode: ScreenMode): void {
  if (!isValidMode(mode)) {
    throw new Error(`유효하지 않은 screen mode: ${String(mode)}`)
  }
  cachedMode = mode
  try {
    const filePath = getStoreFilePath()
    fs.writeFileSync(filePath, JSON.stringify({ mode }, null, 2), 'utf-8')
  } catch (err) {
    console.error('[screen-mode-store] 저장 실패:', err)
  }
}
