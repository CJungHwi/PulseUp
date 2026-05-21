import { Request, Response, NextFunction } from 'express'

interface RateLimitStore {
  [key: string]: {
    count: number
    resetTime: number
  }
}

let store: RateLimitStore = {}

// Store 초기화 함수 (개발용)
export const clearRateLimitStore = () => {
  store = {}
  //console.log('Rate limit store cleared')
}

export interface RateLimitOptions {
  windowMs: number // 시간 윈도우 (밀리초)
  max: number // 최대 요청 수
  message?: string // 제한 시 메시지
  skipSuccessfulRequests?: boolean // 성공한 요청은 카운트에서 제외
}

export const createRateLimit = (options: RateLimitOptions) => {
  const {
    windowMs,
    max,
    message = '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.',
    skipSuccessfulRequests = false
  } = options

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'unknown'
    const now = Date.now()

    // 기존 기록 확인
    if (!store[key] || now > store[key].resetTime) {
      store[key] = {
        count: 0,
        resetTime: now + windowMs
      }
    }

    const record = store[key]

    // 요청 수 증가
    record.count++

    // 제한 확인
    if (record.count > max) {
      const resetTime = Math.ceil((record.resetTime - now) / 1000)

      res.set({
        'X-RateLimit-Limit': max.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': resetTime.toString()
      })

      return res.status(429).json({
        success: false,
        error: message,
        retryAfter: resetTime
      })
    }

    // 헤더 설정
    res.set({
      'X-RateLimit-Limit': max.toString(),
      'X-RateLimit-Remaining': (max - record.count).toString(),
      'X-RateLimit-Reset': Math.ceil((record.resetTime - now) / 1000).toString()
    })

    // 성공한 요청은 카운트에서 제외하는 옵션
    if (skipSuccessfulRequests) {
      const originalSend = res.json
      res.json = function (body: any) {
        if (res.statusCode < 400) {
          record.count--
        }
        return originalSend.call(this, body)
      }
    }

    next()
  }
}

// 일반적인 API 요청 제한 (개발 환경용 - 매우 관대한 설정)
export const apiRateLimit = createRateLimit({
  windowMs: 1 * 60 * 1000, // 1분
  max: 10000, // 1분당 10000개 요청 (개발용)
  skipSuccessfulRequests: true
})

// 인증 관련 요청 제한 (더 엄격)
export const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 5, // 15분당 5개 요청
  message: '로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.'
})

// 업로드 관련 요청 제한
export const uploadRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1시간
  max: 20, // 1시간당 20개 업로드
  message: '업로드 요청이 너무 많습니다. 1시간 후 다시 시도해주세요.'
})