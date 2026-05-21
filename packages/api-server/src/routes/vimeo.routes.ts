import { Router } from 'express'
import { VimeoService, VimeoVideoData } from '../services/vimeo.service.js'
import { authenticateToken } from '../middleware/auth.middleware.js'
import { requireAdmin } from '../middleware/admin.middleware.js'

const router = Router()

/** Vimeo가 라이브러리 루트에 부여하는 parent_folder 값 — 실제 하위 폴더로 보지 않음 */
const isVimeoRootLibraryFolderName = (raw: string): boolean => {
    const t = raw.trim()
    if (t === '내 라이브러리') return true
    if (t.toLowerCase() === 'my library') return true
    return false
}

const isEligibleVimeoSyncParentFolder = (raw: string | undefined | null): boolean => {
    const t = (raw ?? '').trim()
    if (t === '') return false
    if (isVimeoRootLibraryFolderName(t)) return false
    return true
}

/**
 * POST /api/vimeo/sync
 * Vimeo 영상 정보 저장
 */
router.post('/sync', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const videoData: VimeoVideoData = req.body

        // 필수 필드 검증
        if (!videoData.video_id || !videoData.title) {
            return res.status(400).json({
                success: false,
                message: 'video_id와 title은 필수입니다.'
            })
        }

        if (!isEligibleVimeoSyncParentFolder(videoData.parent_folder)) {
            return res.status(400).json({
                success: false,
                message: '실제 하위 폴더(내 라이브러리 루트·미지정 제외)를 지정한 영상만 동기화할 수 있습니다.'
            })
        }

        const result = await VimeoService.saveVimeoVideo(videoData)

        res.json({
            success: true,
            message: 'Vimeo 영상이 저장되었습니다.',
            data: result
        })
    } catch (error) {
        console.error('Vimeo 영상 저장 오류:', error)
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : '영상 저장 중 오류가 발생했습니다.'
        })
    }
})

/**
 * POST /api/vimeo/sync-batch
 * 여러 Vimeo 영상 일괄 저장
 * Query param: isFullSync=true 이면 전체 동기화 (삭제된 영상 비활성화)
 */
router.post('/sync-batch', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const rawVideos: VimeoVideoData[] = req.body.videos
        const isFullSync = req.query.isFullSync === 'true' || req.body.isFullSync === true

        if (!Array.isArray(rawVideos) || rawVideos.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'videos 배열이 필요합니다.'
            })
        }

        const videos = rawVideos.filter((v) => isEligibleVimeoSyncParentFolder(v.parent_folder))
        const skippedNoFolder = rawVideos.length - videos.length

        if (videos.length === 0) {
            return res.json({
                success: true,
                message: `동기화 대상이 아닌 영상(폴더 미지정·라이브러리 루트) ${skippedNoFolder}건은 건너뛰었습니다. 저장할 항목이 없습니다.`,
                data: {
                    success: 0,
                    failed: 0,
                    errors: [] as any[],
                    skippedNoFolder
                }
            })
        }

        const result = await VimeoService.saveVimeoVideos(videos, isFullSync)

        res.json({
            success: true,
            message: `${result.success}개 저장 완료, ${result.failed}개 실패`
                + (skippedNoFolder > 0 ? `, 동기화 제외 ${skippedNoFolder}건(미지정·루트)` : ''),
            data: { ...result, skippedNoFolder }
        })
    } catch (error) {
        console.error('Vimeo 영상 일괄 저장 오류:', error)
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : '영상 일괄 저장 중 오류가 발생했습니다.'
        })
    }
})

/**
 * POST /api/vimeo/match-exercises
 * exercises 테이블과 Vimeo 영상 자동 매칭 (UPDATE + INSERT)
 */
router.post('/match-exercises', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await VimeoService.matchExercisesWithVimeo()

        res.json({
            success: true,
            message: `${result.updated_count}개 업데이트, ${result.inserted_count}개 생성 (총 ${result.matched_count}개)`,
            data: result
        })
    } catch (error) {
        console.error('자동 매칭 오류:', error)
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : '자동 매칭 중 오류가 발생했습니다.'
        })
    }
})

/**
 * POST /api/vimeo/match-exercises-video-url
 * exercises 테이블 업데이트는 video_url(영상 ID)만 수행
 */
router.post('/match-exercises-video-url', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await VimeoService.matchExercisesWithVimeoVideoUrlOnly()

        res.json({
            success: true,
            message: `${result.matched_count}개의 운동 video_url이 업데이트되었습니다.`,
            data: result
        })
    } catch (error) {
        console.error('video_url 전용 자동 매칭 오류:', error)
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'video_url 전용 자동 매칭 중 오류가 발생했습니다.'
        })
    }
})

/**
 * PATCH /api/vimeo/videos/:videoId/description
 * 단건 영상 설명 DB 업데이트
 */
router.patch('/videos/:videoId/description', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { videoId } = req.params
        const { description } = req.body
        if (typeof description !== 'string') {
            return res.status(400).json({ success: false, message: 'description(string)이 필요합니다.' })
        }
        await VimeoService.updateVideoDescription(videoId, description)
        res.json({ success: true, message: 'DB 설명이 업데이트되었습니다.' })
    } catch (error) {
        console.error('영상 설명 업데이트 오류:', error)
        res.status(500).json({ success: false, message: error instanceof Error ? error.message : '업데이트 실패' })
    }
})

/**
 * PATCH /api/vimeo/videos/descriptions/batch
 * 다건 영상 설명 DB 일괄 업데이트
 */
router.patch('/videos/descriptions/batch', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { items } = req.body
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'items 배열이 필요합니다.' })
        }
        const result = await VimeoService.updateVideoDescriptionsBatch(items)
        res.json({ success: true, message: `DB 업데이트: 성공 ${result.success}개, 실패 ${result.failed}개`, data: result })
    } catch (error) {
        console.error('영상 설명 일괄 업데이트 오류:', error)
        res.status(500).json({ success: false, message: error instanceof Error ? error.message : '일괄 업데이트 실패' })
    }
})

/**
 * POST /api/vimeo/videos/purge-inactive
 * is_active = FALSE 인 Vimeo 행 일괄 삭제 + 연결 exercises 정리
 */
router.post('/videos/purge-inactive', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await VimeoService.deleteInactiveVimeoVideos()
        res.json({
            success: true,
            message: `삭제 완료: Vimeo ${result.deletedVimeo}건, 연결 운동 정리 ${result.updatedExercises}건`,
            data: result,
        })
    } catch (error) {
        console.error('비활성 Vimeo 일괄 삭제 오류:', error)
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : '삭제 처리 중 오류가 발생했습니다.',
        })
    }
})

/**
 * GET /api/vimeo/videos
 * 저장된 Vimeo 영상 목록 조회
 */
router.get('/videos', authenticateToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1
        const limit = parseInt(req.query.limit as string) || 20
        const search = req.query.search as string

        const result = await VimeoService.getVimeoVideos({ page, limit, search })

        res.json({
            success: true,
            data: {
                videos: result.videos,
                pagination: {
                    page,
                    limit,
                    total: result.total,
                    totalPages: Math.ceil(result.total / limit)
                }
            }
        })
    } catch (error) {
        console.error('Vimeo 영상 목록 조회 오류:', error)
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : '영상 목록 조회 중 오류가 발생했습니다.'
        })
    }
})

export default router
