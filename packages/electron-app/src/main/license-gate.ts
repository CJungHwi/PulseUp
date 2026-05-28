import { request } from 'undici'

interface LicenseGateOptions {
  getWebAppUrl: () => string
  getDeviceToken: () => string | null
}

export class LicenseGate {
  constructor(private readonly options: LicenseGateOptions) {}

  async assertCanPlay(): Promise<void> {
    const deviceToken = this.options.getDeviceToken()
    if (!deviceToken) {
      throw new Error('디바이스 등록 정보가 없어 라이선스를 확인할 수 없습니다')
    }

    const baseUrl = this.options.getWebAppUrl().replace(/\/$/, '')
    const url = `${baseUrl}/api/electron/license/check?deviceToken=${encodeURIComponent(deviceToken)}`
    const response = await request(url, { method: 'GET' })
    const body = await response.body.json() as any

    if (response.statusCode < 200 || response.statusCode >= 300 || !body?.success) {
      throw new Error(body?.error || '라이선스 확인에 실패했습니다')
    }
  }
}
