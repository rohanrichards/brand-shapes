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
import { type ColourFamily, resolveScheme } from '../core/colours'
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
): { scale: number; offsetX: number; offsetY: number } {
  const t = totalSteps === 1 ? 0 : stepIndex / (totalSteps - 1)
  const scale = 1.15 - t * 0.2
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

  // Apply blur if enabled
  if (config.blur.enabled) {
    ctx.filter = `blur(${config.blur.radius}px)`
  } else {
    ctx.filter = 'none'
  }

  // Parse viewBox for coordinate mapping (use from shape's viewBox)
  const vb = fromShape.viewBox.split(' ').map(Number)
  const scaleX = width / vb[2]
  const scaleY = height / vb[3]
  const scaleFactor = Math.min(scaleX, scaleY) * 0.8
  const translateX = (width - vb[2] * scaleFactor) / 2
  const translateY = (height - vb[3] * scaleFactor) / 2

  switch (config.variant) {
    case 'wireframe':
      renderWireframe(ctx, steps, colours, scaleFactor, translateX, translateY, width, height)
      break
    case 'filled':
      renderFilled(ctx, steps, colours, config, scaleFactor, translateX, translateY, width, height)
      break
    case 'gradient':
      renderGradient(ctx, steps, colours, config, scaleFactor, translateX, translateY, width, height)
      break
  }

  // Reset filter before noise overlay
  ctx.filter = 'none'

  // Noise overlay
  if (config.noise.enabled) {
    const noiseTexture = generateNoiseTexture(config.noise.size, config.noise.opacity)
    ctx.globalCompositeOperation = 'overlay'
    const tempCanvas = new OffscreenCanvas(config.noise.size, config.noise.size)
    const tempCtx = tempCanvas.getContext('2d')!
    tempCtx.putImageData(noiseTexture, 0, 0)
    const pattern = ctx.createPattern(tempCanvas, 'repeat')
    if (pattern) {
      ctx.fillStyle = pattern
      ctx.fillRect(0, 0, width, height)
    }
    ctx.globalCompositeOperation = 'source-over'
  }
}

function renderWireframe(
  ctx: CanvasRenderingContext2D,
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
  ctx: CanvasRenderingContext2D,
  steps: string[],
  colours: { current: string; catalyst: string; future: string },
  config: RenderConfig,
  scale: number,
  tx: number,
  ty: number,
  width: number,
  height: number,
): void {
  const centerX = width / 2
  const centerY = height / 2

  for (let i = 0; i < steps.length; i++) {
    const path = new Path2D(steps[i])
    const { scale: stepScale, offsetX, offsetY } = computeStepTransform(
      i, steps.length, config.align, config.spread,
    )

    // Conic gradient with per-step angle rotation
    const angleDeg = 90 + (i / steps.length) * 120
    const angleRad = (angleDeg * Math.PI) / 180
    const conicGradient = ctx.createConicGradient(angleRad, centerX, centerY)
    conicGradient.addColorStop(0, colours.current)
    conicGradient.addColorStop(0.305, colours.future)
    conicGradient.addColorStop(0.472, colours.catalyst)
    conicGradient.addColorStop(1, colours.current)

    ctx.save()
    ctx.translate(tx + offsetX, ty + offsetY)
    ctx.scale(scale * stepScale, scale * stepScale)
    ctx.fillStyle = conicGradient
    ctx.fill(path)
    ctx.restore()
  }
}

function renderGradient(
  ctx: CanvasRenderingContext2D,
  steps: string[],
  colours: { current: string; catalyst: string; future: string },
  config: RenderConfig,
  scale: number,
  tx: number,
  ty: number,
  width: number,
  height: number,
): void {
  const centerX = width / 2
  const centerY = height / 2

  for (let i = 0; i < steps.length; i++) {
    const path = new Path2D(steps[i])
    const { scale: stepScale, offsetX, offsetY } = computeStepTransform(
      i, steps.length, config.align, config.spread,
    )
    const opacity = 0.3 + (i / steps.length) * 0.7

    const angleDeg = 90 + (i / steps.length) * 120
    const angleRad = (angleDeg * Math.PI) / 180
    const conicGradient = ctx.createConicGradient(angleRad, centerX, centerY)
    conicGradient.addColorStop(0, colours.current)
    conicGradient.addColorStop(0.305, colours.future)
    conicGradient.addColorStop(0.472, colours.catalyst)
    conicGradient.addColorStop(1, colours.current)

    ctx.save()
    ctx.translate(tx + offsetX, ty + offsetY)
    ctx.scale(scale * stepScale, scale * stepScale)
    ctx.globalAlpha = opacity
    ctx.fillStyle = conicGradient
    ctx.fill(path)
    ctx.restore()
  }
  ctx.globalAlpha = 1
}
