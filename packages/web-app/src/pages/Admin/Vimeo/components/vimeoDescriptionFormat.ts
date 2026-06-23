/**
 * Vimeo description format helpers
 * - 기능: Vimeo 설명값에 저장하는 운동정보 5필드 파싱/조합
 * - 포맷: 운동명$자극부위$특징및효과$필요기구$Y/N
 * - 흐름: 기존 4필드 설명을 읽고, 마지막 토큰으로 양쪽운동 여부를 추가/갱신
 */

export type VimeoWorkoutDescriptionParts = {
    nameKo: string
    targetMuscles: string
    characteristics: string
    equipment: string
    isBilateral: boolean
}

const normalizeToken = (value: unknown): string => String(value ?? '').trim()

export const parseVimeoWorkoutDescription = (description: string | null | undefined): VimeoWorkoutDescriptionParts => {
    const raw = String(description ?? '')
    const separator = raw.includes('$') ? '$' : '/'
    const parts = raw.split(separator)
    const bilateralToken = separator === '$' ? normalizeToken(parts[4]).toUpperCase() : 'N'

    return {
        nameKo: normalizeToken(parts[0]),
        targetMuscles: normalizeToken(parts[1]),
        characteristics: normalizeToken(parts[2]),
        equipment: normalizeToken(parts[3]),
        isBilateral: bilateralToken === 'Y',
    }
}

export const formatVimeoWorkoutDescription = (parts: VimeoWorkoutDescriptionParts): string => {
    return [
        parts.nameKo,
        parts.targetMuscles,
        parts.characteristics,
        parts.equipment,
        parts.isBilateral ? 'Y' : 'N',
    ].map(normalizeToken).join('$')
}

export const setVimeoWorkoutDescriptionBilateral = (
    description: string | null | undefined,
    isBilateral: boolean,
): string => {
    return formatVimeoWorkoutDescription({
        ...parseVimeoWorkoutDescription(description),
        isBilateral,
    })
}
