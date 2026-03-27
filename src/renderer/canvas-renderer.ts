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
import { pathCentroid, computeStepTransform, type Alignment } from '../core/transforms'
import type { GradientColours } from '../core/colours'
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
export type { Alignment } from '../core/transforms'

export interface RenderConfig {
  from: ShapeName
  to: ShapeName
  steps: number
  colours: GradientColours
  background?: string
  variant: Variant
  noise: NoiseConfig
  blur: BlurConfig
  align: Alignment
  spread: number
  scaleFrom: number
  scaleTo: number
  /** How many steps to render (for animation). Defaults to all steps. */
  visibleSteps?: number
  /** Override the generated morph steps with custom path strings (for animation). */
  customSteps?: string[]
  /**
   * Per-step transform indices for customSteps.
   * Maps each customStep to its position in the final layout (0-based index
   * out of totalStepCount). Without this, transforms are computed from
   * array index / array length, which causes jitter when the array grows.
   */
  stepIndices?: number[]
  /** Total step count for transform calculations (used with stepIndices). */
  totalStepCount?: number
  /** Base gradient rotation in degrees (default 90). Only affects filled/gradient variants. */
  gradientAngle?: number
  /** Per-layer angular spread in degrees (default 120). Only affects filled/gradient variants. */
  gradientSpread?: number
  /** Gradient center X offset from centroid in viewBox units (default 0). */
  gradientCenterX?: number
  /** Gradient center Y offset from centroid in viewBox units (default 0). */
  gradientCenterY?: number
}

export const DEFAULT_CONFIG: RenderConfig = {
  from: 'organic-1',
  to: 'angular-3',
  steps: 8,
  colours: { current: '#4B01E6', catalyst: '#BEF958', future: '#FEA6E1' },
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

  if (config.background && config.background !== 'transparent') {
    ctx.fillStyle = config.background
    ctx.fillRect(0, 0, width, height)
  }

  const fromShape = getShape(config.from)
  const toShape = getShape(config.to)
  let steps: string[]
  if (config.customSteps) {
    steps = config.customSteps
  } else {
    const { steps: allSteps } = generateMorphSteps(fromShape.path, toShape.path, config.steps)
    const visCount = config.visibleSteps != null ? Math.min(config.visibleSteps, allSteps.length) : allSteps.length
    steps = allSteps.slice(0, visCount)
  }
  const colours = config.colours

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

  // --- Per-layer blur path ---
  const hasLayerBlur = config.blur.layerBlurFrom > 0 || config.blur.layerBlurTo > 0

  if (hasLayerBlur && config.variant !== 'wireframe') {
    const tempCanvas = new OffscreenCanvas(width * dpr, height * dpr)
    const tempCtx = tempCanvas.getContext('2d')!
    tempCtx.scale(dpr, dpr)

    for (let i = 0; i < steps.length; i++) {
      tempCtx.clearRect(0, 0, width, height)

      const stepIdx = config.stepIndices ? config.stepIndices[i] : i
      const stepTotal = config.totalStepCount || steps.length

      if (config.variant === 'filled') {
        renderFilledLayer(tempCtx, steps[i], stepIdx, stepTotal, colours, config, scaleFactor, translateX, translateY, vb)
      } else {
        renderGradientLayer(tempCtx, steps[i], stepIdx, stepTotal, i, steps.length, colours, config, scaleFactor, translateX, translateY, vb)
      }

      const t = steps.length === 1 ? 0 : i / (steps.length - 1)
      const blurRadius = config.blur.layerBlurFrom + (config.blur.layerBlurTo - config.blur.layerBlurFrom) * t

      offCtx.filter = blurRadius > 0 ? `blur(${blurRadius}px)` : 'none'
      offCtx.drawImage(tempCanvas, 0, 0, width, height)
      offCtx.filter = 'none'
    }
    if (config.variant === 'gradient') offCtx.globalAlpha = 1
  } else {
    // --- Standard path (no per-layer blur) ---
    switch (config.variant) {
      case 'wireframe':
        renderWireframe(offCtx, steps, colours, scaleFactor, translateX, translateY, width, height)
        break
      case 'filled':
        renderFilled(offCtx, steps, colours, config, scaleFactor, translateX, translateY, width, height, vb)
        break
      case 'gradient':
        renderGradient(offCtx, steps, colours, config, scaleFactor, translateX, translateY, width, height, vb)
        break
    }
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

  // Final compositing: draw offscreen to main canvas
  ctx.drawImage(offscreen, 0, 0, width, height)
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

/** Render a single filled layer to the given context. */
function renderFilledLayer(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  step: string,
  stepIdx: number,
  stepTotal: number,
  colours: { current: string; catalyst: string; future: string },
  config: RenderConfig,
  scale: number,
  tx: number,
  ty: number,
  vb: number[],
): void {
  const [shapeCenterX, shapeCenterY] = pathCentroid(step)

  const { scale: stepScale, offsetX, offsetY } = computeStepTransform(
    stepIdx, stepTotal, config.align, config.spread, config.scaleFrom, config.scaleTo,
  )
  const totalScale = scale * stepScale

  const baseAngle = config.gradientAngle ?? 90
  const spreadAngle = config.gradientSpread ?? 120
  const t = stepIdx / stepTotal
  const angleDeg = baseAngle - (1 - t) * spreadAngle
  const angleRad = (angleDeg * Math.PI) / 180

  const gcx = shapeCenterX + (config.gradientCenterX ?? 0)
  const gcy = shapeCenterY + (config.gradientCenterY ?? 0)

  ctx.save()

  const shapeCenterCanvasX = tx + shapeCenterX * scale
  const shapeCenterCanvasY = ty + shapeCenterY * scale
  ctx.translate(shapeCenterCanvasX + offsetX, shapeCenterCanvasY + offsetY)
  ctx.scale(totalScale / scale, totalScale / scale)
  ctx.translate(-shapeCenterCanvasX, -shapeCenterCanvasY)
  ctx.translate(tx, ty)
  ctx.scale(scale, scale)

  ctx.clip(new Path2D(step))

  const conicGradient = ctx.createConicGradient(angleRad, gcx, gcy)
  conicGradient.addColorStop(0, colours.current)
  conicGradient.addColorStop(0.293, colours.future)
  conicGradient.addColorStop(0.459, colours.catalyst)
  conicGradient.addColorStop(1, colours.current)

  ctx.fillStyle = conicGradient
  ctx.fillRect(-50, -50, vb[2] + 100, vb[3] + 100)

  ctx.restore()
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
  for (let i = 0; i < steps.length; i++) {
    const stepIdx = config.stepIndices ? config.stepIndices[i] : i
    const stepTotal = config.totalStepCount || steps.length
    renderFilledLayer(ctx, steps[i], stepIdx, stepTotal, colours, config, scale, tx, ty, vb)
  }
}

/** Render a single gradient layer to the given context. */
function renderGradientLayer(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  step: string,
  stepIdx: number,
  stepTotal: number,
  layerIndex: number,
  layerCount: number,
  colours: { current: string; catalyst: string; future: string },
  config: RenderConfig,
  scale: number,
  tx: number,
  ty: number,
  vb: number[],
): void {
  const shapeCenterX = vb[2] / 2
  const shapeCenterY = vb[3] / 2

  const baseAngle = config.gradientAngle ?? 90
  const spreadAngle = config.gradientSpread ?? 120
  const gcx = shapeCenterX + (config.gradientCenterX ?? 0)
  const gcy = shapeCenterY + (config.gradientCenterY ?? 0)

  const { scale: stepScale, offsetX, offsetY } = computeStepTransform(
    stepIdx, stepTotal, config.align, config.spread, config.scaleFrom, config.scaleTo,
  )
  const t = layerCount === 1 ? 1 : layerIndex / (layerCount - 1)
  const opacity = t * t
  const totalScale = scale * stepScale

  const angleDeg = baseAngle - (1 - stepIdx / stepTotal) * spreadAngle
  const angleRad = (angleDeg * Math.PI) / 180

  ctx.save()

  const shapeCenterCanvasX = tx + shapeCenterX * scale
  const shapeCenterCanvasY = ty + shapeCenterY * scale
  ctx.translate(shapeCenterCanvasX + offsetX, shapeCenterCanvasY + offsetY)
  ctx.scale(totalScale / scale, totalScale / scale)
  ctx.translate(-shapeCenterCanvasX, -shapeCenterCanvasY)
  ctx.translate(tx, ty)
  ctx.scale(scale, scale)
  ctx.globalAlpha = Math.max(0.05, opacity)

  ctx.clip(new Path2D(step))

  const conicGradient = ctx.createConicGradient(angleRad, gcx, gcy)
  conicGradient.addColorStop(0, colours.current)
  conicGradient.addColorStop(0.293, colours.future)
  conicGradient.addColorStop(0.459, colours.catalyst)
  conicGradient.addColorStop(1, colours.current)

  ctx.fillStyle = conicGradient
  ctx.fillRect(-50, -50, vb[2] + 100, vb[3] + 100)
  ctx.restore()
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
  for (let i = 0; i < steps.length; i++) {
    const stepIdx = config.stepIndices ? config.stepIndices[i] : i
    const stepTotal = config.totalStepCount || steps.length
    renderGradientLayer(ctx, steps[i], stepIdx, stepTotal, i, steps.length, colours, config, scale, tx, ty, vb)
  }
  ctx.globalAlpha = 1
}
