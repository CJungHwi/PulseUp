// @vitest-environment node
import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import {
    parseVimeoExcelSheetFromB2,
    findVideoIdByVimeoTitle,
    extractVimeoVideoIdFromUri,
    countVideosWithTrimmedTitle,
} from './vimeoExcelImport'

describe('vimeoExcelImport', () => {
    it('2행부터 B=제목·C=설명을 읽고 A열 순번은 무시한다', async () => {
        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.aoa_to_sheet([
            ['No', '제목', '설명'],
            [1, '영상A', '설명1'],
            [2, '영상B', 'a$b$c$d'],
        ])
        XLSX.utils.book_append_sheet(wb, ws, 'Test')
        const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
        const file = new File([buf], 't.xlsx', {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
        const r = await parseVimeoExcelSheetFromB2(file)
        expect(r.sheetName).toBe('Test')
        expect(r.rows).toHaveLength(2)
        expect(r.rows[0]).toEqual({ vimeoTitle: '영상A', description: '설명1' })
        expect(r.rows[1]).toEqual({ vimeoTitle: '영상B', description: 'a$b$c$d' })
    })

    it('findVideoIdByVimeoTitle 는 제목이 같은 항목의 video_id 를 반환한다', () => {
        const id = findVideoIdByVimeoTitle('스쿼트', [{ uri: '/videos/123456789', name: '스쿼트' }])
        expect(id).toBe('123456789')
    })

    it('findVideoIdByVimeoTitle 는 id 필드를 uri 보다 우선한다', () => {
        const id = findVideoIdByVimeoTitle('A', [
            { id: '999888777', uri: '/videos/111', name: 'A' },
        ])
        expect(id).toBe('999888777')
    })

    it('extractVimeoVideoIdFromUri 는 /videos/숫자 패턴을 처리한다', () => {
        expect(extractVimeoVideoIdFromUri('https://api.vimeo.com/videos/1144073665')).toBe('1144073665')
        expect(extractVimeoVideoIdFromUri('/videos/1144073665')).toBe('1144073665')
    })

    it('countVideosWithTrimmedTitle', () => {
        const list = [
            { uri: '/videos/1', name: '같음' },
            { uri: '/videos/2', name: '같음' },
        ]
        expect(countVideosWithTrimmedTitle('같음', list)).toBe(2)
    })
})
