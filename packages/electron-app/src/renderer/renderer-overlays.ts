import { removeOverlayElementById } from './renderer-overlay-utils.js'

export { removeOverlayElementById } from './renderer-overlay-utils.js'

export const showEndCounterImageOverlay = (imageSrc: string): void => {
  removeOverlayElementById('end-counter-image-modal')

  const modal = document.createElement('div')
  modal.id = 'end-counter-image-modal'
  modal.style.cssText = `
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #000;
      z-index: 9999;
      pointer-events: none;
    `

  const image = document.createElement('img')
  image.src = imageSrc
  image.alt = 'Workout complete'
  image.style.cssText = `
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    `

  modal.appendChild(image)
  document.body.appendChild(modal)
}
