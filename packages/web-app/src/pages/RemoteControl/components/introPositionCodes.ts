export type IntroZone = 'A' | 'B' | 'C' | 'D'

export type IntroSelection = {
  zone: IntroZone | null
  number: number | null
}

export const buildIntroPositionCode = (zone: IntroZone, number: number): string => `${zone}${number}`

export const isIntroSelectionComplete = (selection: IntroSelection): selection is {
  zone: IntroZone
  number: number
} => !!selection.zone && !!selection.number && selection.number >= 1 && selection.number <= 3

export const INTRO_ZONES: IntroZone[] = ['A', 'B', 'C', 'D']

export const INTRO_NUMBERS = [1, 2, 3] as const

export const getIntroZoneLabel = (zone: IntroZone): string => {
  switch (zone) {
    case 'A':
      return 'A (좌측 1열)'
    case 'B':
      return 'B (좌측 2열)'
    case 'C':
      return 'C (우측 1열)'
    case 'D':
      return 'D (우측 2열)'
    default:
      return zone
  }
}
