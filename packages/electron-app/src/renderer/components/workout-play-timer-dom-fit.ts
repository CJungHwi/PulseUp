/** WorkoutPlayTimerUI DOM 텍스트 자동 맞춤 유틸 */

export const fitCountdownToContainer = (el: HTMLElement): void => {
  const parent = el.parentElement
  if (!parent) return
  const containerWidth = parent.clientWidth
  if (containerWidth <= 0) return

  let currentSize = parseFloat(getComputedStyle(el).fontSize) || 200
  while (el.scrollWidth > containerWidth && currentSize > 60) {
    currentSize -= 10
    el.style.fontSize = `${currentSize}px`
  }
}

export const fitTextToContainer = (el: HTMLElement): void => {
  const parent = el.parentElement
  if (!parent) return

  const maxFontSize = 120
  const minFontSize = 16
  let fontSize = maxFontSize

  el.style.fontSize = `${fontSize}px`

  requestAnimationFrame(() => {
    while (el.scrollWidth > parent.clientWidth && fontSize > minFontSize) {
      fontSize -= 2
      el.style.fontSize = `${fontSize}px`
    }
  })
}

export const fitIntroCells = (): void => {
  requestAnimationFrame(() => {
    const cells = document.querySelectorAll<HTMLElement>('[data-intro-cell]')
    cells.forEach((cell) => {
      const inner = cell.querySelector<HTMLElement>('[data-intro-cell-inner]')
      if (!inner) return

      inner.style.transform = 'none'

      const cellW = cell.clientWidth - 20
      const cellH = cell.clientHeight - 20
      const contentW = inner.scrollWidth
      const contentH = inner.scrollHeight

      if (contentW <= 0 || contentH <= 0) return

      const scale = Math.min(cellW / contentW, cellH / contentH, 1)
      if (scale < 1) {
        inner.style.transform = `scale(${scale})`
        inner.style.transformOrigin = 'center center'
      }
    })
  })
}

export const adjustCategoryFontSize = (element: HTMLElement): void => {
  const parentWidth = element.parentElement?.clientWidth || 0
  const padding = 40
  const maxWidth = parentWidth - padding

  let fontSize = 70
  element.style.fontSize = `${fontSize}px`

  while (element.scrollWidth > maxWidth && fontSize > 30) {
    fontSize -= 2
    element.style.fontSize = `${fontSize}px`
  }
}

export const adjustActivityLabelFontSize = (element: HTMLElement): void => {
  const parent = element.parentElement
  if (!parent) return
  const maxWidth = parent.clientWidth
  if (maxWidth <= 0) return

  let fontSize = Math.min(240, maxWidth * 0.2)
  element.style.fontSize = `${fontSize}px`

  while (element.scrollWidth > maxWidth && fontSize > 40) {
    fontSize -= 4
    element.style.fontSize = `${fontSize}px`
  }
}
