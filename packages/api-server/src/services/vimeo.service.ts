import type { ResultSetHeader } from 'mysql2/promise'
import { callProcedure, executeQuery, executeTransaction } from '../lib/database.js'

export interface VimeoVideoData {
    video_id: string
    parent_folder?: string
    title: string
    description?: string
    thumbnail_url?: string
    duration: number
    status: string
    privacy_view: string
}

export class VimeoService {
    /**
     * Vimeo 영상 정보를 DB에 저장
     */
    static async saveVimeoVideo(videoData: VimeoVideoData): Promise<any> {
        try {
            const result = await callProcedure(
                'sp_insert_vimeo_video',
                [
                    videoData.video_id,
                    videoData.parent_folder || null,
                    videoData.title,
                    videoData.description || null,
                    videoData.thumbnail_url || null,
                    videoData.duration,
                    videoData.status,
                    videoData.privacy_view
                ]
            )
            return result
        } catch (error) {
            console.error('Vimeo 영상 저장 실패:', error)
            throw error
        }
    }

    /**
     * 여러 Vimeo 영상을 일괄 저장
     * 전체 동기화 시 먼저 모든 영상을 비활성화하고, 존재하는 영상만 활성화
     */
    static async saveVimeoVideos(videos: VimeoVideoData[], isFullSync: boolean = false): Promise<{ success: number; failed: number; errors: any[] }> {
        let success = 0
        let failed = 0
        const errors: any[] = []

        //console.log(`🔄 Vimeo 일괄 저장 시작: ${videos.length}개 (전체 동기화: ${isFullSync})`)

        // 전체 동기화인 경우: 먼저 모든 영상을 비활성화
        if (isFullSync) {
            try {
                await executeQuery('UPDATE vimeo_videos SET is_active = FALSE')
                //console.log('✅ 전체 동기화: 모든 영상을 비활성화했습니다.')
            } catch (error) {
                console.error('⚠️ 영상 비활성화 실패:', error)
            }
        }

        // 현재 인입된 Vimeo 영상은 title 중복을 허용한다.
        // video_id만 고유하므로 수집 배치에서는 중복 제거를 하지 않는다.
        if (videos.length > 0) {
            try {
                const videoIds = videos.map((v) => v.video_id)
                // mysql2의 execute(Prepared Statement)는 IN (?)에 배열을 직접 넣는 것을 지원하지 않음.
                // 따라서 배열 개수만큼 ?를 생성해줘야 함.
                const placeholders = videoIds.map(() => '?').join(',')
                await executeQuery(`UPDATE vimeo_videos SET is_active = TRUE WHERE video_id IN (${placeholders})`, videoIds)
                //console.log(`✅ ${videos.length}개의 영상을 활성화 상태로 업데이트했습니다.`)
            } catch (error) {
                console.error('⚠️ 영상 일괄 활성화 실패:', error)
                // 실패하더라도 개별 저장 로직에서 다시 시도하므로 계속 진행
            }
        }

        for (const video of videos) {
            try {
                await this.saveVimeoVideo(video)
                success++
            } catch (error) {
                failed++
                errors.push({
                    video_id: video.video_id,
                    title: video.title,
                    error: error instanceof Error ? error.message : 'Unknown error'
                })
            }
        }

        // 전체 동기화 시: 삭제된 Vimeo 영상과 연결된 exercises도 비활성화 / 복구
        if (isFullSync) {
            try {
                await executeQuery(`
                    UPDATE exercises e
                    SET e.is_active = FALSE
                    WHERE e.video_url IS NOT NULL
                      AND e.video_url != ''
                      AND EXISTS (
                        SELECT 1 FROM vimeo_videos v
                        WHERE v.video_id = e.video_url AND v.is_active = FALSE
                      )
                      AND e.is_active = TRUE
                `)
                await executeQuery(`
                    UPDATE exercises e
                    SET e.is_active = TRUE
                    WHERE e.video_url IS NOT NULL
                      AND e.video_url != ''
                      AND EXISTS (
                        SELECT 1 FROM vimeo_videos v
                        WHERE v.video_id = e.video_url AND v.is_active = TRUE
                      )
                      AND e.is_active = FALSE
                `)
                console.log('✅ exercises 활성 상태를 vimeo_videos 기준으로 동기화했습니다.')
            } catch (error) {
                console.error('⚠️ exercises 활성 상태 동기화 실패:', error)
            }
        }

        return { success, failed, errors }
    }

    /**
     * exercises 테이블과 Vimeo 영상 자동 동기화
     * video_url 기반 매칭 (UPDATE + INSERT)
     */
    static async matchExercisesWithVimeo(): Promise<{ updated_count: number; inserted_count: number; matched_count: number }> {
        try {
            const result = await callProcedure(
                'sp_match_exercises_with_vimeo',
                []
            )

            // 프로시저 결과에서 카운트 추출
            const resultData = result[0]?.[0] || { updated_count: 0, inserted_count: 0, total_matched_count: 0 }

            return {
                updated_count: resultData.updated_count || 0,
                inserted_count: resultData.inserted_count || 0,
                matched_count: resultData.total_matched_count || 0
            }
        } catch (error) {
            console.error('자동 매칭 실패:', error)
            throw error
        }
    }

    /**
     * exercises 테이블과 Vimeo 영상 자동 매칭 (video_url만 업데이트)
     * - 다른 컬럼(썸네일/길이/제목 등) 변경 금지
     * - title과 name_en 소문자 trim 정확 일치 기준
     * - video_url이 비어있는 운동만 업데이트
     */
    static async matchExercisesWithVimeoVideoUrlOnly(): Promise<{ matched_count: number }> {
        try {
            const results = await callProcedure('sp_match_exercises_with_vimeo_video_url_only', [])
            const matchedCount = results[0]?.[0]?.matched_count || 0
            return { matched_count: matchedCount }
        } catch (error) {
            console.error('video_url 전용 매칭 실패:', error)
            throw error
        }
    }

    /**
     * 단건 description 업데이트 — sp_insert_vimeo_video로 재적용해 exercises 등 동기화
     */
    static async updateVideoDescription(videoId: string, description: string): Promise<void> {
        const rows = await executeQuery(
            `SELECT video_id, parent_folder, title, thumbnail_url, duration, status, privacy_view
             FROM vimeo_videos WHERE video_id = ? LIMIT 1`,
            [videoId]
        ) as Record<string, unknown>[]
        const row = rows[0]
        if (!row) {
            throw new Error('DB에 해당 영상이 없습니다. 먼저 동기화하세요.')
        }
        await this.saveVimeoVideo({
            video_id: String(row.video_id),
            parent_folder: (row.parent_folder as string | null) ?? undefined,
            title: String(row.title ?? ''),
            description,
            thumbnail_url: (row.thumbnail_url as string | null) ?? undefined,
            duration: Number(row.duration) || 0,
            status: String(row.status ?? 'available'),
            privacy_view: String(row.privacy_view ?? 'disable'),
        })
    }

    /**
     * 다건 description 일괄 업데이트
     */
    static async updateVideoDescriptionsBatch(items: { video_id: string; description: string }[]): Promise<{ success: number; failed: number }> {
        let success = 0
        let failed = 0
        for (const item of items) {
            try {
                await this.updateVideoDescription(item.video_id, item.description)
                success++
            } catch {
                failed++
            }
        }
        return { success, failed }
    }

    /**
     * 저장된 Vimeo 영상 목록 조회
     */
    /**
     * is_active = FALSE(Vimeo에서 빠진 영상, UI '삭제' 배지)인 vimeo_videos 행을 삭제하고,
     * 해당 video_id를 참조하던 exercises는 비활성화 및 video_url 해제
     */
    static async deleteInactiveVimeoVideos(): Promise<{ deletedVimeo: number; updatedExercises: number }> {
        const results = await executeTransaction([
            async (connection) => {
                const [r] = await connection.execute<ResultSetHeader>(
                    `UPDATE exercises e
                     INNER JOIN vimeo_videos v ON e.video_url = v.video_id
                     SET e.is_active = FALSE, e.video_url = NULL
                     WHERE v.is_active = FALSE`
                )
                return (r as ResultSetHeader).affectedRows
            },
            async (connection) => {
                const [r] = await connection.execute<ResultSetHeader>(
                    'DELETE FROM vimeo_videos WHERE is_active = FALSE'
                )
                return (r as ResultSetHeader).affectedRows
            },
        ])
        return {
            updatedExercises: Number(results[0]) || 0,
            deletedVimeo: Number(results[1]) || 0,
        }
    }

    static async getVimeoVideos(params: {
        page?: number
        limit?: number
        search?: string
    }): Promise<{ videos: any[]; total: number }> {
        try {
            const page = params.page || 1
            const limit = params.limit || 20
            const offset = (page - 1) * limit

            let query = 'SELECT * FROM vimeo_videos'
            const queryParams: any[] = []

            if (params.search) {
                query += ' WHERE title LIKE ? OR description LIKE ?'
                queryParams.push(`%${params.search}%`, `%${params.search}%`)
            }

            query += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?'
            queryParams.push(limit, offset)

            const videos = await executeQuery(query, queryParams)

            // 전체 개수 조회
            let countQuery = 'SELECT COUNT(*) as total FROM vimeo_videos'
            const countParams: any[] = []

            if (params.search) {
                countQuery += ' WHERE title LIKE ? OR description LIKE ?'
                countParams.push(`%${params.search}%`, `%${params.search}%`)
            }

            const countResult = await executeQuery(countQuery, countParams)
            const total = countResult[0]?.total || 0

            return { videos, total }
        } catch (error) {
            console.error('Vimeo 영상 목록 조회 실패:', error)
            throw error
        }
    }
}
