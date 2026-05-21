import { Response } from 'express'

// 간단한 응답 헬퍼 함수들
export const successResponse = (data: any, message: string = 'Success') => ({
  success: true,
  message,
  data
})

export const errorResponse = (message: string = 'Error', code?: string) => ({
  success: false,
  error: message,
  ...(code && { code })
})

export class ResponseUtil {
  // 응답 객체를 사용하는 메서드들
  static success(res: Response, data: any = null, message: string = 'Success') {
    return res.status(200).json({
      success: true,
      message,
      data
    })
  }

  static error(res: Response, message: string = 'Error') {
    return res.status(400).json({
      success: false,
      error: message
    })
  }

  static successWithPagination(res: Response, data: any, pagination: any, message: string = 'Success') {
    return res.status(200).json({
      success: true,
      message,
      data,
      pagination
    })
  }

  static validationError(res: Response, message: string = 'Validation Error') {
    return res.status(400).json({
      success: false,
      error: message
    })
  }

  static successResponse(res: Response, data: any = null, message: string = 'Success') {
    return res.status(200).json({
      success: true,
      message,
      data
    })
  }

  static created(res: Response, data: any = null, message: string = 'Created') {
    return res.status(201).json({
      success: true,
      message,
      data
    })
  }

  static badRequest(res: Response, message: string = 'Bad Request') {
    return res.status(400).json({
      success: false,
      error: message
    })
  }

  static unauthorized(res: Response, message: string = 'Unauthorized') {
    return res.status(401).json({
      success: false,
      error: message
    })
  }

  static forbidden(res: Response, message: string = 'Forbidden') {
    return res.status(403).json({
      success: false,
      error: message
    })
  }

  static notFound(res: Response, message: string = 'Not Found') {
    return res.status(404).json({
      success: false,
      error: message
    })
  }

  static conflict(res: Response, message: string = 'Conflict') {
    return res.status(409).json({
      success: false,
      error: message
    })
  }

  static internalError(res: Response, message: string = 'Internal Server Error') {
    return res.status(500).json({
      success: false,
      error: message
    })
  }
}