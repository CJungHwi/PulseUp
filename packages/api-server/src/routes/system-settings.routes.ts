import { Router } from 'express'
import { SystemSettingsService } from '../services/system-settings.service.js'
import { authenticateToken as authMiddleware } from '../middleware/auth.middleware.js'

const router = Router()
const systemSettingsService = new SystemSettingsService()

// 특정 설정값 조회 (인증 불필요 - Electron 앱에서 사용)
router.get('/:settingKey', async (req, res, next) => {
    try {
        const { settingKey } = req.params
        const value = await systemSettingsService.getSetting(settingKey)

        if (value === null) {
            return res.status(404).json({
                success: false,
                error: '설정을 찾을 수 없습니다'
            })
        }

        res.json({
            success: true,
            data: {
                settingKey,
                settingValue: value
            }
        })
    } catch (error) {
        console.error('❌ 설정 조회 실패:', error)
        next(error)
    }
})

// 모든 설정 조회 (인증 필요)
router.get('/', authMiddleware, async (req, res, next) => {
    try {
        const settings = await systemSettingsService.getAllSettings()

        res.json({
            success: true,
            data: settings
        })
    } catch (error) {
        console.error('❌ 설정 목록 조회 실패:', error)
        next(error)
    }
})

// 설정값 업데이트 (관리자만)
router.put('/:settingKey', authMiddleware, async (req, res, next) => {
    try {
        const user = (req as any).user

        // 관리자 권한 확인
        if (user.role !== 'admin' && user.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                error: '권한이 없습니다'
            })
        }

        const { settingKey } = req.params
        const { settingValue } = req.body

        if (settingValue === undefined) {
            return res.status(400).json({
                success: false,
                error: 'settingValue가 필요합니다'
            })
        }

        await systemSettingsService.updateSetting(settingKey, settingValue, user.id)

        res.json({
            success: true,
            message: '설정이 업데이트되었습니다'
        })
    } catch (error) {
        console.error('❌ 설정 업데이트 실패:', error)
        next(error)
    }
})

export default router
