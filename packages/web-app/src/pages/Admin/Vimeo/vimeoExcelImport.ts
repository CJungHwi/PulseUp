import * as XLSX from 'xlsx'

/**
 * 첫 시트, 2행부터: A열=순번(무시), B열=Vimeo 제목(매칭), C열=설명
 */
export type VimeoExcelDataRow = {
    /** B열 — 현재 Vimeo 제목과 정확히 일치하는 행을 찾습니다 */
    vimeoTitle: string
    /** C열 — 반영할 설명 ($ 구분 원칙) */
    description: string
}

const cellText = (ws: XLSX.WorkSheet, r: number, c: number): string => {
    const addr = XLSX.utils.encode_cell({ r, c })
    const cell = ws[addr]
    if (!cell) return ''
    if (cell.w != null && String(cell.w).trim() !== '') return String(cell.w).trim()
    if (cell.v != null && cell.v !== '') return String(cell.v).trim()
    return ''
}

/** `/videos/123`, 전체 URL 등에서 숫자 video_id 추출 */
export const extractVimeoVideoIdFromUri = (uri: string): string | null => {
    const trimmed = (uri ?? '').trim()
    if (!trimmed) return null
    const m = trimmed.match(/\/videos\/(\d+)/)
    if (m) return m[1]
    const parts = trimmed.split('/').filter(Boolean)
    const last = parts[parts.length - 1]
    if (last && /^\d+$/.test(last)) return last
    return null
}

/**
 * 첫 번째 시트에서 2행(B2)부터 읽습니다. B열=제목, C열=설명 (A열 순번은 사용하지 않음)
 */
export const parseVimeoExcelSheetFromB2 = async (
    file: File
): Promise<{ sheetName: string; rows: VimeoExcelDataRow[] }> => {
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const firstName = wb.SheetNames[0]
    if (!firstName) {
        throw new Error('엑셀에 시트가 없습니다.')
    }
    const ws = wb.Sheets[firstName]
    const ref = ws['!ref']
    if (!ref) {
        return { sheetName: firstName, rows: [] }
    }
    const range = XLSX.utils.decode_range(ref)
    const rows: VimeoExcelDataRow[] = []
    const startR = 1

    for (let R = startR; R <= range.e.r; R++) {
        const vimeoTitle = cellText(ws, R, 1)
        const description = cellText(ws, R, 2)
        if (!vimeoTitle.trim() && !description) continue
        rows.push({ vimeoTitle, description })
    }

    return { sheetName: firstName, rows }
}

export type VimeoVideoLike = { uri: string; name: string; id?: string }

/** trim 기준으로 동일 제목인 행 개수 (엑셀 매칭 충돌 방지) */
export const countVideosWithTrimmedTitle = (title: string, videos: VimeoVideoLike[]): number => {
    const t = title.trim()
    if (!t) return 0
    return videos.filter((v) => (v.name ?? '').trim() === t).length
}

/** B열 제목과 `name`이 같은 영상의 Vimeo video_id (id 필드 우선) */
export const findVideoIdByVimeoTitle = (
    vimeoTitle: string,
    videos: VimeoVideoLike[]
): string | null => {
    const t = vimeoTitle.trim()
    if (!t) return null
    const found = videos.find((v) => (v.name ?? '').trim() === t)
    if (!found) return null
    const rawId = found.id != null && String(found.id).trim() !== '' ? String(found.id).trim() : ''
    if (rawId && /^\d+$/.test(rawId)) return rawId
    return extractVimeoVideoIdFromUri(found.uri ?? '')
}
