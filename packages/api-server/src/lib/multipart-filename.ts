import path from 'path'

/**
 * Multer가 multipart 파일명을 ISO-8859-1 바이트 단위 문자열로만 넘기는 경우 UTF-8 파일명으로 복원합니다.
 * 코드포인트가 U+00FF를 넘는 문자가 이미 있으면(브라우저/버전에 따라 올바른 UTF-8으로 온 경우) 그대로 둡니다.
 */
export const decodeMultipartFilename = (name: string): string => {
  if (!name || typeof name !== 'string') return name
  if (/[^\u0000-\u00ff]/.test(name)) return name
  try {
    return Buffer.from(name, 'latin1').toString('utf8')
  } catch {
    return name
  }
}

/** 저장·표시용: 경로 제거, 제어문자 제거, 길이 제한 */
export const safeAttachmentDisplayName = (raw: string, fallback: string): string => {
  const base = path.basename(String(raw ?? '').replace(/\0/g, '')).trim()
  const sliced = base.slice(0, 240)
  return sliced || fallback
}
