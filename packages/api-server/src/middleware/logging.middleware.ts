import { Request, Response, NextFunction } from 'express'
import { RequestWithId } from './requestId.middleware.js'

interface LogData {
  requestId: string
  method: string
  url: string
  userAgent?: string
  ip: string
  userId?: string
  timestamp: string
  duration?: number
  statusCode?: number
  contentLength?: number
}

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now()

  const logData: LogData = {
    requestId: (req as RequestWithId).id,
    method: req.method,
    url: req.originalUrl || req.url,
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.connection.remoteAddress || 'unknown',
    timestamp: new Date().toISOString(),
  }

  // 인증된 사용자 정보가 있으면 추가 (auth middleware 이후에 설정됨)
  const originalSend = res.json
  res.json = function (body: any) {
    const endTime = Date.now()

    logData.duration = endTime - startTime
    logData.statusCode = res.statusCode
    logData.contentLength = JSON.stringify(body).length

    // 사용자 정보 추가 (있는 경우)
    if ((req as any).user) {
      logData.userId = (req as any).user.id
    }

    // 로그 출력
    const logLevel = res.statusCode >= 400 ? 'ERROR' : 'INFO'
    const logMessage = `[${logLevel}] ${logData.method} ${logData.url} - ${logData.statusCode} - ${logData.duration}ms`

    // if (process.env.NODE_ENV === 'development') {
    //   console.log(logMessage, {
    //     requestId: logData.requestId,
    //     userId: logData.userId,
    //     ip: logData.ip,
    //     userAgent: logData.userAgent,
    //     contentLength: logData.contentLength
    //   })
    // } else {
    //   // 프로덕션에서는 구조화된 로그
    //   console.log(JSON.stringify(logData))
    // }

    return originalSend.call(this, body)
  }

  next()
}