/*
 * BRAND SHAPES — Canvas 2D Renderer
 *
 * Renders morphing brand shapes to a <canvas> element using native Canvas 2D APIs:
 * - Path2D for SVG path rendering
 * - createConicGradient() for filled/gradient variants
 * - ctx.filter for blur
 * - ImageData for noise texture overlay
 */
import { type ShapeName, getShape } from '../core/shapes'
import { type ColourFamily, resolveScheme, resolveGradientColours } from '../core/colours'
import { generateMorphSteps } from '../core/morph'
import {
  generateStepFills,
  buildLinearGradientStops,
  type NoiseConfig,
  type BlurConfig,
  DEFAULT_NOISE_CONFIG,
  DEFAULT_BLUR_CONFIG,
} from '../core/effects'

export type Variant = 'wireframe' | 'filled' | 'gradient'
export type Alignment = 'left' | 'right' | 'top' | 'bottom' | 'center'

export interface RenderConfig {
  from: ShapeName
  to: ShapeName
  steps: number
  scheme: ColourFamily
  variant: Variant
  noise: NoiseConfig
  blur: BlurConfig
  align: Alignment
  spread: number
  scaleFrom: number
  scaleTo: number
}

export const DEFAULT_CONFIG: RenderConfig = {
  from: 'organic-1',
  to: 'angular-3',
  steps: 8,
  scheme: 'lime',
  variant: 'filled',
  noise: { ...DEFAULT_NOISE_CONFIG },
  blur: { ...DEFAULT_BLUR_CONFIG },
  align: 'center',
  spread: 1,
  scaleFrom: 1.15,
  scaleTo: 0.95,
}

/** Generate a noise ImageData texture for overlay compositing. */
function generateNoiseTexture(size: number, opacity: number): ImageData {
  const data = new Uint8ClampedArray(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    const val = Math.random() * 255
    const idx = i * 4
    data[idx] = val
    data[idx + 1] = val
    data[idx + 2] = val
    data[idx + 3] = opacity * 255
  }
  return new ImageData(data, size, size)
}

/**
 * Per-step transform for filled/gradient variants.
 * Back steps scale larger with offset; front steps scale smaller.
 */
function computeStepTransform(
  stepIndex: number,
  totalSteps: number,
  align: Alignment,
  spread: number,
  scaleFrom: number,
  scaleTo: number,
): { scale: number; offsetX: number; offsetY: number } {
  const t = totalSteps === 1 ? 0 : stepIndex / (totalSteps - 1)
  const scale = scaleFrom + (scaleTo - scaleFrom) * t
  const maxOffset = 15 * spread
  const offset = (1 - t) * maxOffset

  let offsetX = 0
  let offsetY = 0
  switch (align) {
    case 'left': offsetX = -offset; break
    case 'right': offsetX = offset; break
    case 'top': offsetY = -offset; break
    case 'bottom': offsetY = offset; break
    case 'center': break
  }

  return { scale, offsetX, offsetY }
}

/** Main render function. Draws brand shape to the given canvas. */
export function render(canvas: HTMLCanvasElement, config: RenderConfig): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  canvas.width = width * dpr
  canvas.height = height * dpr
  ctx.scale(dpr, dpr)

  ctx.clearRect(0, 0, width, height)

  const fromShape = getShape(config.from)
  const toShape = getShape(config.to)
  const { steps } = generateMorphSteps(fromShape.path, toShape.path, config.steps)
  const colours = resolveScheme(config.scheme)
  const gradientColours = resolveGradientColours(config.scheme)

  // Parse viewBox for coordinate mapping (use from shape's viewBox)
  const vb = fromShape.viewBox.split(' ').map(Number)
  const scaleX = width / vb[2]
  const scaleY = height / vb[3]
  const scaleFactor = Math.min(scaleX, scaleY) * 0.8
  const translateX = (width - vb[2] * scaleFactor) / 2
  const translateY = (height - vb[3] * scaleFactor) / 2

  // Render shapes to an offscreen canvas so blur can be applied
  // to the ENTIRE result including edges (not clipped inside shapes)
  const offscreen = new OffscreenCanvas(width * dpr, height * dpr)
  const offCtx = offscreen.getContext('2d')!
  offCtx.scale(dpr, dpr)

  switch (config.variant) {
    case 'wireframe':
      renderWireframe(offCtx, steps, colours, scaleFactor, translateX, translateY, width, height)
      break
    case 'filled':
      renderFilled(offCtx, steps, gradientColours, config, scaleFactor, translateX, translateY, width, height, vb)
      break
    case 'gradient':
      renderGradient(offCtx, steps, gradientColours, config, scaleFactor, translateX, translateY, width, height, vb)
      break
  }

  // Noise overlay — clipped to shape area (on offscreen canvas)
  if (config.noise.enabled) {
    const noiseTexture = generateNoiseTexture(config.noise.size, config.noise.opacity)
    const noiseCanvas = new OffscreenCanvas(config.noise.size, config.noise.size)
    const noiseCtx = noiseCanvas.getContext('2d')!
    noiseCtx.putImageData(noiseTexture, 0, 0)
    const pattern = offCtx.createPattern(noiseCanvas, 'repeat')
    if (pattern) {
      offCtx.globalCompositeOperation = 'source-atop'
      offCtx.fillStyle = pattern
      offCtx.fillRect(0, 0, width, height)
      offCtx.globalCompositeOperation = 'source-over'
    }
  }

  // Draw offscreen canvas to main canvas, applying blur to the WHOLE image
  // This blurs shape edges (not just fill inside the clip path)
  if (config.blur.enabled) {
    ctx.filter = `blur(${config.blur.radius}px)`
  }
  ctx.drawImage(offscreen, 0, 0, width, height)
  ctx.filter = 'none'
}

function renderWireframe(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  steps: string[],
  colours: { current: string; catalyst: string; future: string },
  scale: number,
  tx: number,
  ty: number,
  width: number,
  height: number,
): void {
  const gradientStops = buildLinearGradientStops(colours.current, colours.catalyst, colours.future)
  const gradient = ctx.createLinearGradient(0, 0, width, height)
  for (const stop of gradientStops) {
    gradient.addColorStop(stop.offset, stop.color)
  }

  for (let i = 0; i < steps.length; i++) {
    const opacity = 1 - (i / steps.length) * 0.6
    const path = new Path2D(steps[i])
    ctx.save()
    ctx.translate(tx, ty)
    ctx.scale(scale, scale)
    ctx.globalAlpha = opacity
    ctx.strokeStyle = gradient
    ctx.lineWidth = 1.5 / scale
    ctx.stroke(path)
    ctx.restore()
  }
  ctx.globalAlpha = 1
}

function renderFilled(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  steps: string[],
  colours: { current: string; catalyst: string; future: string },
  config: RenderConfig,
  scale: number,
  tx: number,
  ty: number,
  _width: number,
  _height: number,
  vb: number[],
): void {
  // Figma pattern: each step gets its OWN conic gradient, clipped to its shape.
  // The gradient fills the entire shape independently per step.
  const shapeCenterX = vb[2] / 2
  const shapeCenterY = vb[3] / 2

  for (let i = 0; i < steps.length; i++) {
    const { scale: stepScale, offsetX, offsetY } = computeStepTransform(
      i, steps.length, config.align, config.spread, config.scaleFrom, config.scaleTo,
    )
    const totalScale = scale * stepScale

    // Per-step angle rotation (Figma uses a full 2D transform matrix per step;
    // we approximate with angle rotation)
    const angleDeg = 90 + (i / steps.length) * 120
    const angleRad = (angleDeg * Math.PI) / 180

    ctx.save()

    // Scale from shape center, not top-left:
    // 1. Translate so shape center is at canvas-space origin
    // 2. Apply per-step scale
    // 3. Translate back, plus alignment offset
    const shapeCenterCanvasX = tx + shapeCenterX * scale
    const shapeCenterCanvasY = ty + shapeCenterY * scale
    ctx.translate(shapeCenterCanvasX + offsetX, shapeCenterCanvasY + offsetY)
    ctx.scale(totalScale / scale, totalScale / scale) // stepScale only (base scale applied below)
    ctx.translate(-shapeCenterCanvasX, -shapeCenterCanvasY)
    ctx.translate(tx, ty)
    ctx.scale(scale, scale)

    // Clip to THIS step's shape path
    ctx.clip(new Path2D(steps[i]))

    // Create conic gradient in shape-local space, centered on shape
    const conicGradient = ctx.createConicGradient(angleRad, shapeCenterX, shapeCenterY)
    conicGradient.addColorStop(0, colours.current)
    conicGradient.addColorStop(0.293, colours.future)
    conicGradient.addColorStop(0.459, colours.catalyst)
    conicGradient.addColorStop(1, colours.current)

    // Fill entire shape bounds — gradient is clipped to shape by ctx.clip()
    ctx.fillStyle = conicGradient
    ctx.fillRect(-50, -50, vb[2] + 100, vb[3] + 100)

    ctx.restore()
  }
}

function renderGradient(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  steps: string[],
  colours: { current: string; catalyst: string; future: string },
  config: RenderConfig,
  scale: number,
  tx: number,
  ty: number,
  _width: number,
  _height: number,
  vb: number[],
): void {
  const shapeCenterX = vb[2] / 2
  const shapeCenterY = vb[3] / 2

  for (let i = 0; i < steps.length; i++) {
    const { scale: stepScale, offsetX, offsetY } = computeStepTransform(
      i, steps.length, config.align, config.spread, config.scaleFrom, config.scaleTo,
    )
    // More dramatic opacity ramp than filled — back layers nearly transparent,
    // front layers fully opaque, creating a glowing depth-of-field effect
    const t = steps.length === 1 ? 1 : i / (steps.length - 1)
    const opacity = t * t // quadratic: 0, 0.01, 0.04, ... 0.64, 1.0
    const totalScale = scale * stepScale

    const angleDeg = 90 + (i / steps.length) * 120
    const angleRad = (angleDeg * Math.PI) / 180

    ctx.save()

    // Scale from shape center, not top-left
    const shapeCenterCanvasX = tx + shapeCenterX * scale
    const shapeCenterCanvasY = ty + shapeCenterY * scale
    ctx.translate(shapeCenterCanvasX + offsetX, shapeCenterCanvasY + offsetY)
    ctx.scale(totalScale / scale, totalScale / scale)
    ctx.translate(-shapeCenterCanvasX, -shapeCenterCanvasY)
    ctx.translate(tx, ty)
    ctx.scale(scale, scale)
    ctx.globalAlpha = Math.max(0.05, opacity)

    ctx.clip(new Path2D(steps[i]))

    const conicGradient = ctx.createConicGradient(angleRad, shapeCenterX, shapeCenterY)
    conicGradient.addColorStop(0, colours.current)
    conicGradient.addColorStop(0.293, colours.future)
    conicGradient.addColorStop(0.459, colours.catalyst)
    conicGradient.addColorStop(1, colours.current)

    ctx.fillStyle = conicGradient
    ctx.fillRect(-50, -50, vb[2] + 100, vb[3] + 100)
    ctx.restore()
  }
  ctx.globalAlpha = 1
}
