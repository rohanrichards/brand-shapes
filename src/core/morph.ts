/*
 * BRAND SHAPES — Morph Engine
 *
 * Uses flubber2 for topology-safe interpolation (prevents self-intersection),
 * with very high polygon resolution (maxSegmentLength: 0.5) for smooth edges.
 *
 * flubber's triangulation approach is the only method that reliably prevents
 * self-intersecting intermediate shapes. The tradeoff (polygon output instead
 * of bezier curves) is mitigated by using very fine segment lengths.
 *
 * Steps clamped to 5-15 per brand rules.
 */
import { interpolate } from 'flubber2'

export const MIN_STEPS = 5
export const MAX_STEPS = 15

export interface MorphResult {
  steps: string[]
}

/**
 * Generate N intermediate SVG path strings between two shapes.
 * Uses flubber2 for smooth, topology-safe interpolation.
 * Steps clamped to 5-15 per brand rules.
 */
export function generateMorphSteps(
  fromPath: string,
  toPath: string,
  stepCount: number,
): MorphResult {
  const clamped = Math.min(MAX_STEPS, Math.max(MIN_STEPS, stepCount))

  // Very fine polygon resolution — 0.5 units per segment on a ~160-unit
  // shape gives ~320 segments. At screen resolution this appears smooth.
  // flubber's triangulation prevents the self-intersection artifacts
  // that plague linear bezier interpolation approaches.
  const interpolator = interpolate(fromPath, toPath, {
    maxSegmentLength: 0.5,
  })

  const steps: string[] = []
  for (let i = 0; i < clamped; i++) {
    const t = clamped === 1 ? 0 : i / (clamped - 1)

    // Use original paths at endpoints for full bezier fidelity
    if (t === 0) {
      steps.push(fromPath)
    } else if (t === 1) {
      steps.push(toPath)
    } else {
      steps.push(interpolator(t))
    }
  }

  return { steps }
}
