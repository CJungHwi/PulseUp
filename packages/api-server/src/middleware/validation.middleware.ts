import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'

export const validateBody = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      //console.log('Validating request body:', req.body)
      const validatedData = schema.parse(req.body)
      req.body = validatedData
      next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Validation Error:', {
          requestBody: req.body,
          errors: error.errors
        })

        return res.status(400).json({
          error: '입력 데이터가 유효하지 않습니다',
          issues: error.errors,
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        })
      }
      next(error)
    }
  }
}

export const validateParams = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = schema.parse(req.params)
      req.params = validatedData
      next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: '경로 매개변수가 유효하지 않습니다',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        })
      }
      next(error)
    }
  }
}

export const validateQuery = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = schema.parse(req.query)
      req.query = validatedData
      next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: '쿼리 매개변수가 유효하지 않습니다',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        })
      }
      next(error)
    }
  }
}

// 통합 validation 함수
export const validateRequest = (schemas: {
  body?: z.ZodSchema
  params?: z.ZodSchema
  query?: z.ZodSchema
}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Body 검증
      if (schemas.body) {
        const validatedBody = schemas.body.parse(req.body)
        req.body = validatedBody
      }

      // Params 검증
      if (schemas.params) {
        const validatedParams = schemas.params.parse(req.params)
        req.params = validatedParams
      }

      // Query 검증
      if (schemas.query) {
        const validatedQuery = schemas.query.parse(req.query)
        req.query = validatedQuery
      }

      next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Validation Error (validateRequest):', {
          path: req.path,
          method: req.method,
          errors: error.errors
        })
        return res.status(400).json({
          error: '입력 데이터가 유효하지 않습니다',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        })
      }
      next(error)
    }
  }
}