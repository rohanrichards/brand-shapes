/*
 * BRAND SHAPES — Canvas-native Effects
 *
 * Adapted from slidev-theme-portable SVG effects for Canvas 2D API.
 * - lerpColour and generateStepFills: unchanged (pure colour math)
 * - Gradient builders: return config objects for Canvas API (not SVG markup)
 * - Noise/blur: config objects for Canvas rendering (not SVG filters)
 */

export function lerpColour(colA: string, colB: string, t: number): string {
  const parse = (hex: string) => {
    const h = hex.replace('#', '')
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
  }
  const [r1, g1, b1] = parse(colA)
  const [r2, g2, b2] = parse(colB)
  const r = Math.round(r1 + (r2 - r1) * t)
  const g = Math.round(g1 + (g2 - g1) * t)
  const b = Math.round(b1 + (b2 - b1) * t)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

export function generateStepFills(
  current: string,
  catalyst: string,
  future: string,
  stepCount: number,
): string[] {
  const fills: string[] = []
  for (let i = 0; i < stepCount; i++) {
    const t = stepCount === 1 ? 0 : i / (stepCount - 1)
    let colour: string
    if (t <= 0.45) {
      colour = lerpColour(current, catalyst, t / 0.45)
    } else if (t <= 0.55) {
      colour = catalyst
    } else {
      colour = lerpColour(catalyst, future, (t - 0.55) / 0.45)
    }
    fills.push(colour)
  }
  return fills
}

export interface ConicGradientConfig {
  current: string
  catalyst: string
  future: string
  angleDeg: number
  centerX: number
  centerY: number
}

export function buildConicGradientConfig(
  current: string,
  catalyst: string,
  future: string,
  angleDeg: number = 90,
  centerX: number = 0.5,
  centerY: number = 0.5,
): ConicGradientConfig {
  return { current, catalyst, future, angleDeg, centerX, centerY }
}

export interface GradientStop {
  offset: number
  color: string
}

export function buildLinearGradientStops(
  current: string,
  catalyst: string,
  future: string,
): GradientStop[] {
  return [
    { offset: 0, color: current },
    { offset: 0.45, color: catalyst },
    { offset: 0.55, color: catalyst },
    { offset: 1, color: future },
  ]
}

export interface NoiseConfig {
  enabled: boolean
  opacity: number
  size: number
}

export const DEFAULT_NOISE_CONFIG: NoiseConfig = {
  enabled: false,
  opacity: 0.12,
  size: 256,
}

export interface BlurConfig {
  // Per-layer blur (Mode 2)
  layerBlurFrom: number   // 0-30, backmost layer blur radius
  layerBlurTo: number     // 0-30, frontmost layer blur radius
  // Masked blur (Mode 1)
  maskEnabled: boolean
  maskAngle: number       // 0-360 degrees
  maskPosition: number    // 0-1
  maskHardness: number    // 0-1
  maskBlurRadius: number  // 0-30px
}

export const DEFAULT_BLUR_CONFIG: BlurConfig = {
  layerBlurFrom: 0,
  layerBlurTo: 0,
  maskEnabled: false,
  maskAngle: 0,
  maskPosition: 0.5,
  maskHardness: 0.5,
  maskBlurRadius: 10,
}

/**
 * Reference dimension (in pixels) at which "pixel" values in config are interpreted.
 * Used by computePixelScale to scale blur radii and noise tile size proportionally
 * with output resolution, so exports look identical to the live preview.
 */
export const REFERENCE_DIM = 1080

/**
 * Returns the scaling factor for pixel-spatial effects given an output canvas size.
 * Anchored to the smaller canvas dimension (matches the shape-fit scaling used
 * elsewhere in the renderer).
 *
 * Example: at a 1080×1080 canvas this returns 1 (config values render literally).
 * At a 4K (3840×2160) canvas this returns 2 (config values render at 2x size).
 */
export function computePixelScale(width: number, height: number): number {
  return Math.min(width, height) / REFERENCE_DIM
}
