import { describe, expect, it } from 'vitest'
import { buildExerciseVideoEmbedUrl, parseVimeoVideoId } from './monthProgramVideoUtils'

describe('monthProgramVideoUtils', () => {
  it('parses bare vimeo video id', () => {
    expect(parseVimeoVideoId('123456789')).toBe('123456789')
  })

  it('parses vimeo page url', () => {
    expect(parseVimeoVideoId('https://vimeo.com/987654321')).toBe('987654321')
  })

  it('builds embed url from bare vimeo id', () => {
    expect(buildExerciseVideoEmbedUrl('123456789')).toBe(
      'https://player.vimeo.com/video/123456789?autoplay=1&controls=0&title=0&byline=0&portrait=0&badge=0&dnt=1',
    )
  })

  it('builds embed url with start time', () => {
    expect(buildExerciseVideoEmbedUrl('123456789', 12)).toBe(
      'https://player.vimeo.com/video/123456789?autoplay=1&controls=0&title=0&byline=0&portrait=0&badge=0&dnt=1#t=12s',
    )
  })
})
