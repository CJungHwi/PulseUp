import { Request, Response, NextFunction } from 'express'

export interface AppError extends Error {
  statusCode?: number
  isOperational?: boolean
  code?: string
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let error = { ...err }
  error.message = err.message

  // Prisma 에러 처리
  if (err.name === 'PrismaClientKnownRequestError' || (err as any).code) {
    const prismaError = err as any
    if (prismaError.code === 'P2002') {
      error.message = '이미 존재하는 데이터입니다'
      error.statusCode = 409
    } else if (prismaError.code === 'P2025') {
      error.message = '요청한 데이터를 찾을 수 없습니다'
      error.statusCode = 404
    } else if (prismaError.code === 'P2003') {
      error.message = '참조 무결성 제약 조건 위반입니다'
      error.statusCode = 400
    } else if (prismaError.code === 'P2014') {
      error.message = '관련된 데이터가 존재하여 삭제할 수 없습니다'
      error.statusCode = 409
    }
  }

  // Prisma 유효성 검사 에러
  if (err.name === 'PrismaClientValidationError') {
    error.message = '데이터 유효성 검사에 실패했습니다'
    error.statusCode = 400
  }

  // Prisma 연결 에러
  if (err.name === 'PrismaClientInitializationError') {
    error.message = '데이터베이스 연결에 실패했습니다'
    error.statusCode = 503
  }

  // JWT 에러 처리
  if (err.name === 'JsonWebTokenError') {
    error.message = '유효하지 않은 토큰입니다'
    error.statusCode = 401
  }

  if (err.name === 'TokenExpiredError') {
    error.message = '토큰이 만료되었습니다'
    error.statusCode = 401
  }

  // express/body-parser: JSON 본문 크기 초과
  if ((err as any).type === 'entity.too.large') {
    error.message =
      '요청 본문이 서버 한도를 초과했습니다. 로그 전송은 로그 용량이 클 수 있으니, API 서버 JSON_BODY_LIMIT 또는 앞단 nginx client_max_body_size를 확인하세요.'
    error.statusCode = 413
  }

  // Multer 에러 처리 (파일 업로드)
  if (err.name === 'MulterError') {
    const multerError = err as any
    if (multerError.code === 'LIMIT_FILE_SIZE') {
      error.message = '파일 크기가 너무 큽니다'
      error.statusCode = 413
    } else if (multerError.code === 'LIMIT_FILE_COUNT') {
      error.message = '파일 개수가 제한을 초과했습니다'
      error.statusCode = 413
    }
  }

  const statusCode = error.statusCode || 500
  const message = error.message || '서버 내부 오류가 발생했습니다'

  // 에러 로깅
  const errorLog = {
    requestId: (req as any).id,
    error: {
      name: err.name,
      message: error.message,
      statusCode,
      stack: error.stack
    },
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.method !== 'GET' ? req.body : undefined,
      userId: (req as any).user?.id
    },
    timestamp: new Date().toISOString()
  }

  if (statusCode >= 500) {
    console.error('INTERNAL_SERVER_ERROR:', JSON.stringify(errorLog, null, 2))
  } else if (statusCode >= 400) {
    console.warn('CLIENT_ERROR:', JSON.stringify(errorLog, null, 2))
  }

  // 응답 전송
  res.status(statusCode).json({
    success: false,
    error: message,
    requestId: (req as any).id,
    ...(process.env.NODE_ENV === 'development' && { 
      stack: error.stack,
      details: err 
    }),
  })
}