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
 * Matches the canvas renderer exactly: gradient centered on (centerX, centerY)
 * covering the area (-50, -50) to (vbW+50, vbH+50) in shape space.
 * The resulting image maps 1:1 to <image x="-50" y="-50" width="vbW+100" height="vbH+100"/>.
 */
export function rasterizeConicGradient(options: ConicGradientOptions, scaleFactor = 4): string {
  const { colours, angleDeg, centerX, centerY, viewBoxWidth, viewBoxHeight } = options

  // Canvas covers the same area as the SVG image: (-50,-50) to (vbW+50, vbH+50)
  const coverW = viewBoxWidth + 100
  const coverH = viewBoxHeight + 100
  const canvasW = Math.ceil(coverW * scaleFactor)
  const canvasH = Math.ceil(coverH * scaleFactor)

  const canvas = document.createElement('canvas')
  canvas.width = canvasW
  canvas.height = canvasH
  const ctx = canvas.getContext('2d')!

  // Map shape-space coordinates to canvas pixels
  // The image covers (-50, -50) to (vbW+50, vbH+50), so shape coord X maps to (X + 50) * scaleFactor
  const canvasCX = (centerX + 50) * scaleFactor
  const canvasCY = (centerY + 50) * scaleFactor

  const angleRad = (angleDeg * Math.PI) / 180
  const gradient = ctx.createConicGradient(angleRad, canvasCX, canvasCY)
  gradient.addColorStop(0, colours.current)
  gradient.addColorStop(0.293, colours.future)
  gradient.addColorStop(0.459, colours.catalyst)
  gradient.addColorStop(1, colours.current)

  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvasW, canvasH)

  return canvas.toDataURL('image/jpeg', 0.9)
}

/**
 * Rasterize a noise grain tile matching the canvas renderer's generateNoiseTexture.
 * Random per-pixel grayscale at the given opacity — identical algorithm to canvas.
 * Returns a base64 PNG data URL (PNG needed for alpha transparency).
 */
export function rasterizeNoiseTile(size: number, opacity: number): string {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const imageData = ctx.createImageData(size, size)
  const data = imageData.data
  const alpha = Math.round(opacity * 255)

  for (let i = 0; i < size * size; i++) {
    const val = Math.random() * 255
    const idx = i * 4
    data[idx] = val
    data[idx + 1] = val
    data[idx + 2] = val
    data[idx + 3] = alpha
  }

  ctx.putImageData(imageData, 0, 0)
  return canvas.toDataURL('image/png')
}
