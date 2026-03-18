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
  enabled: boolean
  radius: number
}

export const DEFAULT_BLUR_CONFIG: BlurConfig = {
  enabled: false,
  radius: 2,
}
