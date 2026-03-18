/*
 * BRAND SHAPES — Morph Engine
 *
 * Uses flubber2 (maintained ESM fork of flubber) for high-quality
 * SVG path interpolation. flubber uses triangulation-based morphing
 * that avoids the cusps and self-intersections that occur with
 * naive control-point interpolation.
 *
 * GSAP MorphSVGPlugin's raw path approach (equalizeSegmentQuantity +
 * linear interpolation) produces sharp kinks when morphing between
 * topologically different shapes. flubber handles this correctly.
 *
 * Steps clamped to 5-15 per brand rules.
 */
import { interpolate } from 'flubber2'

export const MIN_STEPS = 5
export const MAX_STEPS = 15

export interface MorphResult {
  steps: string[]
  interpolator: (t: number) => string
}

/**
 * Generate N intermediate SVG path strings between two shapes.
 * Uses flubber2 for smooth, artifact-free interpolation.
 * Steps clamped to 5-15 per brand rules.
 */
export function generateMorphSteps(
  fromPath: string,
  toPath: string,
  stepCount: number,
): MorphResult {
  const clamped = Math.min(MAX_STEPS, Math.max(MIN_STEPS, stepCount))

  // maxSegmentLength controls polygon resolution.
  // flubber converts bezier curves to polygons for triangulation.
  // Lower values = more points = smoother edges but more data.
  // At 2, a 160-unit shape gets ~80 segments — smooth at any zoom.
  const interpolator = interpolate(fromPath, toPath, {
    maxSegmentLength: 2,
  })

  const steps: string[] = []
  for (let i = 0; i < clamped; i++) {
    const t = clamped === 1 ? 0 : i / (clamped - 1)
    steps.push(interpolator(t))
  }

  return { steps, interpolator }
}
