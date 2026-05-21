import type { DisplayType } from './renderer-display-types.js'
import { isWorkoutGridDisplayType } from './renderer-display-types.js'

/** Web Speech API — 좌·우 운동 화면에서는 재생하지 않음 */
export const speakWorkout = (text: string, currentDisplay: DisplayType): void => {
  if (isWorkoutGridDisplayType(currentDisplay)) {
    return
  }

  try {
    if (!('speechSynthesis' in window)) {
      console.warn('Web Speech API를 지원하지 않는 브라우저입니다.')
      return
    }

    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'ko-KR'
    utterance.rate = 1.0
    utterance.pitch = 1.0
    utterance.volume = 1.0

    window.speechSynthesis.speak(utterance)
  } catch (error) {
    console.error('음성 재생 오류:', error)
  }
}
