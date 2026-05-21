import { z } from 'zod'

export const createPlaylistSchema = z.object({
    name: z.string().min(1, '플레이리스트 이름은 필수입니다'),
})

export const updatePlaylistSchema = z.object({
    name: z.string().min(1, '플레이리스트 이름은 필수입니다').optional(),
})

export const addVideoToPlaylistSchema = z.object({
    videoId: z.string().min(1, '비디오 ID는 필수입니다'),
    order: z.number().int().min(0, '순서는 0 이상의 정수여야 합니다'),
})

export const reorderPlaylistVideosSchema = z.object({
    videoOrders: z.array(z.object({
        videoId: z.string(),
        order: z.number().int().min(0),
    })),
})

// 플레이리스트 검색 스키마
export const searchPlaylistsSchema = z.object({
    query: z.string().min(1, '검색어를 입력해주세요'),
    page: z.number().min(1).optional(),
    limit: z.number().min(1).max(50).optional(),
    sortBy: z.enum(['createdAt', 'name', 'updatedAt']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
})

// 플레이리스트 내 비디오 검색 스키마
export const searchPlaylistVideosSchema = z.object({
    query: z.string().min(1, '검색어를 입력해주세요')
})

// 일괄 작업 스키마
export const bulkActionSchema = z.object({
    action: z.enum(['delete', 'move', 'copy']),
    videoIds: z.array(z.string()).min(1, '최소 하나의 비디오를 선택해주세요'),
    targetPlaylistId: z.string().optional()
})

// 플레이리스트 가져오기 스키마
export const importPlaylistSchema = z.object({
    sourcePlaylistId: z.string().min(1, '원본 플레이리스트 ID는 필수입니다'),
    name: z.string().min(1, '새 플레이리스트 이름은 필수입니다').optional(),
    includeVideos: z.boolean().optional().default(true)
})

// 플레이리스트 내보내기 스키마
export const exportPlaylistSchema = z.object({
    format: z.enum(['json', 'csv', 'm3u']).default('json'),
    includeMetadata: z.boolean().optional().default(true)
})

// 자동 플레이리스트 생성 스키마
export const autoPlaylistSchema = z.object({
    name: z.string().min(1, '플레이리스트 이름은 필수입니다'),
    criteria: z.object({
        categories: z.array(z.string()).optional(),
        minDuration: z.number().min(0).optional(),
        maxDuration: z.number().min(0).optional(),
        keywords: z.array(z.string()).optional(),
        maxVideos: z.number().min(1).max(100).optional().default(20)
    })
})

export type CreatePlaylistInput = z.infer<typeof createPlaylistSchema>
export type UpdatePlaylistInput = z.infer<typeof updatePlaylistSchema>
export type AddVideoToPlaylistInput = z.infer<typeof addVideoToPlaylistSchema>
export type ReorderPlaylistVideosInput = z.infer<typeof reorderPlaylistVideosSchema>
export type SearchPlaylistsInput = z.infer<typeof searchPlaylistsSchema>
export type SearchPlaylistVideosInput = z.infer<typeof searchPlaylistVideosSchema>
export type BulkActionInput = z.infer<typeof bulkActionSchema>
export type ImportPlaylistInput = z.infer<typeof importPlaylistSchema>
export type ExportPlaylistInput = z.infer<typeof exportPlaylistSchema>
export type AutoPlaylistInput = z.infer<typeof autoPlaylistSchema>