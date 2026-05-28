import * as XLSX from 'xlsx'

/** DB 동기화 후 UI에 쓰이는 Vimeo 행 (Excel 내보내기용 최소 필드) */
export type VimeoVideoExcelInput = {
    no?: number
    uri: string
    name: string
    description: string | null
    duration: number
    status: string
    pictures?: {
        sizes?: Array<{
            link: string
        }>
    }
    parent_folder?: {
        name?: string
    }
    privacy?: {
        view?: string
    }
    created_at?: string
    updated_at?: string
    is_active?: boolean | number
    workout_category_id?: string | null
    player_embed_url?: string
}

export type VimeoExcelExportHelpers = {
    extractVideoId: (uri: string) => string
    formatDuration: (seconds: number) => string
    getStatusLabel: (status: string) => string
    getPrivacyLabel: (view: string) => string
    isActiveFalse: (v: VimeoVideoExcelInput) => boolean
    isNewVideo: (createdAt?: string) => boolean
}

const getThumbnailUrl = (video: VimeoVideoExcelInput) => {
    const sizes = video.pictures?.sizes
    if (!sizes?.length) return ''
    return sizes[sizes.length - 1].link
}

export const downloadVimeoVideosAsXlsx = (
    videos: VimeoVideoExcelInput[],
    helpers: VimeoExcelExportHelpers,
    baseFileName = 'vimeo-sync'
) => {
    if (videos.length === 0) return

    const rows = videos.map((video, index) => {
        const vid = helpers.extractVideoId(video.uri ?? '')
        const badge = helpers.isActiveFalse(video)
            ? '삭제'
            : helpers.isNewVideo(video.created_at)
              ? 'NEW'
              : ''
        return {
            No: video.no ?? index + 1,
            구분: badge,
            상위폴더: video.parent_folder?.name || '',
            영상_ID: vid,
            영상_제목: video.name,
            영상_설명: video.description ?? '',
            썸네일_URL: getThumbnailUrl(video),
            길이: helpers.formatDuration(video.duration),
            상태: helpers.getStatusLabel(video.status),
            프라이버시: helpers.getPrivacyLabel(video.privacy?.view ?? ''),
            활성: helpers.isActiveFalse(video) ? '비활성(삭제마킹)' : '활성',
            workout_category_id: video.workout_category_id ?? '',
            생성일시: video.created_at ?? '',
            수정일시: video.updated_at ?? '',
            플레이어_URL: video.player_embed_url ?? '',
        }
    })

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Vimeo')

    const pad = (n: number) => String(n).padStart(2, '0')
    const d = new Date()
    const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
    XLSX.writeFile(workbook, `${baseFileName}-${stamp}.xlsx`)
}
