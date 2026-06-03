export type IntroZone = 'A' | 'B'

export type IntroSelection = {
  zone: IntroZone | null
  number: number | null
}

export const buildIntroPositionCode = (zone: IntroZone, number: number): string => `${zone}${number}`

export const isIntroSelectionComplete = (selection: IntroSelection): selection is {
  zone: IntroZone
  number: number
} => !!selection.zone && !!selection.number && selection.number >= 1 && selection.number <= 6

export const INTRO_ZONES: IntroZone[] = ['A', 'B']

export const INTRO_NUMBERS = [1, 2, 3, 4, 5, 6] as const

export const getIntroZoneLabel = (zone: IntroZone): string => {
  switch (zone) {
    case 'A':
      return 'A (좌측)'
    case 'B':
      return 'B (우측)'
    default:
      return zone
  }
}
