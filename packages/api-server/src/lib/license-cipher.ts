import crypto from 'crypto'

export interface EncryptedPayload {
  alg: 'A256GCM'
  iv: string
  tag: string
  ct: string
}

const getLicenseKey = (): Buffer => {
  const raw = process.env.LICENSE_ENC_KEY
  if (!raw) {
    throw new Error('LICENSE_ENC_KEY가 설정되지 않았습니다')
  }

  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) {
    throw new Error('LICENSE_ENC_KEY는 32바이트 base64 값이어야 합니다')
  }

  return key
}

export const encryptLicensePayload = (payload: unknown): EncryptedPayload => {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getLicenseKey(), iv)
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8')
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()

  return {
    alg: 'A256GCM',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ct: ciphertext.toString('base64')
  }
}
