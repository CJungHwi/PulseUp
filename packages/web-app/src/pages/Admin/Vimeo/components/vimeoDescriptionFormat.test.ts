// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
    formatVimeoWorkoutDescription,
    parseVimeoWorkoutDescription,
    setVimeoWorkoutDescriptionBilateral,
} from './vimeoDescriptionFormat'

describe('vimeoDescriptionFormat', () => {
    it('5번째 $ 토큰이 Y이면 양쪽운동으로 파싱한다', () => {
        expect(parseVimeoWorkoutDescription('베어 크롤$전신$코어 활성화$맨몸$Y')).toEqual({
            nameKo: '베어 크롤',
            targetMuscles: '전신',
            characteristics: '코어 활성화',
            equipment: '맨몸',
            isBilateral: true,
        })
    })

    it('기존 4필드 설명은 N으로 처리한다', () => {
        expect(parseVimeoWorkoutDescription('베어 크롤$전신$코어 활성화$맨몸').isBilateral).toBe(false)
    })

    it('양쪽운동 값을 바꾸면 마지막 토큰을 Y/N으로 저장한다', () => {
        expect(setVimeoWorkoutDescriptionBilateral('베어 크롤$전신$코어 활성화$맨몸', true)).toBe(
            '베어 크롤$전신$코어 활성화$맨몸$Y',
        )
        expect(setVimeoWorkoutDescriptionBilateral('베어 크롤$전신$코어 활성화$맨몸$Y', false)).toBe(
            '베어 크롤$전신$코어 활성화$맨몸$N',
        )
    })

    it('포맷 함수는 5필드 문자열을 만든다', () => {
        expect(formatVimeoWorkoutDescription({
            nameKo: 'A',
            targetMuscles: 'B',
            characteristics: 'C',
            equipment: 'D',
            isBilateral: true,
        })).toBe('A$B$C$D$Y')
    })
})
