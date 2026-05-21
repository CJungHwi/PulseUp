export const removeOverlayElementById = (id: string): void => {
  const el = document.getElementById(id)
  if (el) el.remove()
}
