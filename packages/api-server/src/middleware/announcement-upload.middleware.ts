import crypto from 'crypto'
import fs from 'fs'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import { decodeMultipartFilename } from '../lib/multipart-filename.js'

const uploadDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../uploads/announcements')

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      fs.mkdirSync(uploadDir, { recursive: true })
    } catch {
      // mkdirSync throws only on serious errors; ignore if exists
    }
    cb(null, uploadDir)
  },
  filename: (_req, file, cb) => {
    const decoded = decodeMultipartFilename(file.originalname)
    const ext = path.extname(decoded).slice(0, 20).toLowerCase()
    const base = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}`
    cb(null, `${base}${ext}`)
  },
})

/** 공지사항 첨부 업로드 (관리자 전용 라우트에서 사용) */
export const announcementFilesUpload = multer({
  storage,
  defParamCharset: 'utf8',
  limits: {
    fileSize: 15 * 1024 * 1024,
    files: 8,
    fieldSize: 2 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const name = decodeMultipartFilename(file.originalname)
    if (!/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|png|jpg|jpeg|gif|webp|txt|zip|csv|hwp)$/i.test(name)) {
      cb(new Error('허용되지 않는 파일 형식입니다.'))
      return
    }
    cb(null, true)
  },
})
