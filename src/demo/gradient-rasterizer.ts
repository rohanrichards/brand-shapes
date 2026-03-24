// src/demo/gradient-rasterizer.ts

export interface ConicGradientOptions {
  colours: { current: string; catalyst: string; future: string }
  angleDeg: number
  centerX: number
  centerY: number
  viewBoxWidth: number
  viewBoxHeight: number
}

/**
 * Rasterize a conic gradient to a base64 JPEG data URL.
 * Renders to a square canvas (keeps gradient circular) sized to max(vbW, vbH) * scaleFactor.
 * The gradient is positioned so its center aligns with (centerX, centerY) in viewBox space.
 */
export function rasterizeConicGradient(options: ConicGradientOptions, scaleFactor = 4): string {
  const { colours, angleDeg, centerX, centerY, viewBoxWidth, viewBoxHeight } = options
  const size = Math.ceil(Math.max(viewBoxWidth, viewBoxHeight) * scaleFactor)

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  // Map viewBox coordinates to canvas coordinates
  const scale = size / Math.max(viewBoxWidth, viewBoxHeight)
  const canvasCX = centerX * scale
  const canvasCY = centerY * scale

  const angleRad = (angleDeg * Math.PI) / 180
  const gradient = ctx.createConicGradient(angleRad, canvasCX, canvasCY)
  gradient.addColorStop(0, colours.current)
  gradient.addColorStop(0.293, colours.future)
  gradient.addColorStop(0.459, colours.catalyst)
  gradient.addColorStop(1, colours.current)

  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  return canvas.toDataURL('image/jpeg', 0.9)
}
