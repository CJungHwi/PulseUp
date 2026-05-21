import { Request, Response, NextFunction } from 'express'
import { randomUUID } from 'crypto'

export interface RequestWithId extends Request {
  id: string
}

export const requestId = (req: Request, res: Response, next: NextFunction) => {
  // 클라이언트에서 제공한 요청 ID가 있으면 사용, 없으면 새로 생성
  const id = (req.headers['x-request-id'] as string) || randomUUID()
  
  ;(req as RequestWithId).id = id
  res.setHeader('X-Request-ID', id)
  
  next()
}