/*
 * BRAND SHAPES — Morph Engine
 *
 * Uses d3-interpolate-path for curve-preserving SVG path interpolation.
 * d3-interpolate-path handles point correspondence, command matching,
 * and bezier curve preservation — producing smooth intermediates
 * without polygon conversion or control-point crossing artifacts.
 *
 * Steps clamped to 5-15 per brand rules.
 */
import { interpolatePath } from 'd3-interpolate-path'

export const MIN_STEPS = 5
export const MAX_STEPS = 15

export interface MorphResult {
  steps: string[]
}

/**
 * Generate N intermediate SVG path strings between two shapes.
 * Uses d3-interpolate-path for smooth, curve-preserving interpolation.
 * Steps clamped to 5-15 per brand rules.
 */
export function generateMorphSteps(
  fromPath: string,
  toPath: string,
  stepCount: number,
): MorphResult {
  const clamped = Math.min(MAX_STEPS, Math.max(MIN_STEPS, stepCount))

  const interpolator = interpolatePath(fromPath, toPath)

  const steps: string[] = []
  for (let i = 0; i < clamped; i++) {
    const t = clamped === 1 ? 0 : i / (clamped - 1)
    steps.push(interpolator(t))
  }

  return { steps }
}
