import { screen } from 'electron'
import { isLinux } from '../config'

export const ensureWindowPosition = windowState => {
  // "workArea" doesn't work on Linux
  const { bounds, workArea } = screen.getPrimaryDisplay()
  const screenArea = isLinux ? bounds : workArea

  let { x, y, width, height } = windowState
  let center = false
  if (x === undefined || y === undefined) {
    center = true

    // First app start; check whether window size is larger than screen size
    if (screenArea.width < width) width = screenArea.width
    if (screenArea.height < height) height = screenArea.height
  } else {
    center = !screen.getAllDisplays().map(display =>
      x >= display.bounds.x && x <= display.bounds.x + display.bounds.width &&
      y >= display.bounds.y && y <= display.bounds.y + display.bounds.height)
      .some(display => display)
  }
  if (center) {
    // win.center() doesn't work on Linux
    x = Math.max(0, Math.ceil(screenArea.x + (screenArea.width - width) / 2))
    y = Math.max(0, Math.ceil(screenArea.y + (screenArea.height - height) / 2))
  }
  return {
    x,
    y,
    width,
    height
  }
}
