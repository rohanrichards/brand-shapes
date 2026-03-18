/*
 * BRAND SHAPES — Morph Engine
 *
 * Uses GSAP MorphSVGPlugin to interpolate between two SVG paths.
 * Replaces the dead flubber library from slidev-theme-portable.
 *
 * Steps clamped to 5-15 per brand rules.
 */
import gsap from 'gsap'
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin'

gsap.registerPlugin(MorphSVGPlugin)

export const MIN_STEPS = 5
export const MAX_STEPS = 15

export interface MorphResult {
  steps: string[]
}

/**
 * Generate N intermediate SVG path strings between two shapes.
 * Uses GSAP MorphSVGPlugin for high-quality path interpolation.
 * Steps clamped to 5-15 per brand rules.
 */
export function generateMorphSteps(
  fromPath: string,
  toPath: string,
  stepCount: number,
): MorphResult {
  const clamped = Math.min(MAX_STEPS, Math.max(MIN_STEPS, stepCount))

  const fromRaw = MorphSVGPlugin.stringToRawPath(fromPath)
  const toRaw = MorphSVGPlugin.stringToRawPath(toPath)

  // Ensure compatible segment counts for interpolation
  MorphSVGPlugin.equalizeSegmentQuantity(fromRaw, toRaw)

  const steps: string[] = []
  for (let i = 0; i < clamped; i++) {
    const t = clamped === 1 ? 0 : i / (clamped - 1)

    if (t === 0) {
      steps.push(MorphSVGPlugin.rawPathToString(fromRaw))
    } else if (t === 1) {
      steps.push(MorphSVGPlugin.rawPathToString(toRaw))
    } else {
      // Interpolate each segment's values
      const interpolated = fromRaw.map((segment: number[], segIdx: number) => {
        const toSegment = toRaw[segIdx] || segment
        return segment.map((val: number, valIdx: number) => {
          const toVal = toSegment[valIdx] ?? val
          return val + (toVal - val) * t
        })
      })
      // Smooth the interpolated path to restore bezier curve quality.
      // Without this, linear interpolation of control points produces
      // harsh corners in intermediate morph steps.
      MorphSVGPlugin.smoothRawPath(interpolated, 1)
      steps.push(MorphSVGPlugin.rawPathToString(interpolated))
    }
  }

  return { steps }
}
