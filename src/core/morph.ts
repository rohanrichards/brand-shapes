/*
 * BRAND SHAPES — Morph Engine
 *
 * Uses flubber2 for shape interpolation, then post-processes the
 * polygon output into smooth cubic bezier curves via Catmull-Rom
 * spline fitting. This eliminates flubber's jagged polygon artifacts
 * while keeping its topology-safe interpolation.
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

type Point = [number, number]

/**
 * Parse an SVG path string (M...L...Z polygon) into coordinate pairs.
 */
function parsePolygonPath(pathStr: string): Point[] {
  const points: Point[] = []
  // Match all number pairs in the path
  const nums = pathStr.match(/-?[\d.]+(?:e[+-]?\d+)?/gi)
  if (!nums) return points
  for (let i = 0; i < nums.length - 1; i += 2) {
    points.push([parseFloat(nums[i]), parseFloat(nums[i + 1])])
  }
  return points
}

/**
 * Convert points to a smooth SVG path using Catmull-Rom → cubic bezier.
 * Catmull-Rom splines pass through all control points and produce
 * smooth curves without the bumps of polygon approximation.
 */
function pointsToSmoothPath(points: Point[]): string {
  if (points.length < 3) {
    // Fallback: just connect with lines
    return 'M' + points.map(p => `${p[0]},${p[1]}`).join('L') + 'Z'
  }

  // Remove duplicate close point if present
  const last = points[points.length - 1]
  const first = points[0]
  if (Math.abs(last[0] - first[0]) < 0.01 && Math.abs(last[1] - first[1]) < 0.01) {
    points = points.slice(0, -1)
  }

  const n = points.length
  const tension = 0.5 // Catmull-Rom tension (0.5 = centripetal)

  let d = `M${points[0][0]},${points[0][1]}`

  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n]
    const p1 = points[i]
    const p2 = points[(i + 1) % n]
    const p3 = points[(i + 2) % n]

    // Catmull-Rom to cubic bezier conversion
    const cp1x = p1[0] + (p2[0] - p0[0]) / (6 / tension)
    const cp1y = p1[1] + (p2[1] - p0[1]) / (6 / tension)
    const cp2x = p2[0] - (p3[0] - p1[0]) / (6 / tension)
    const cp2y = p2[1] - (p3[1] - p1[1]) / (6 / tension)

    d += `C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`
  }

  d += 'Z'
  return d
}

/**
 * Reduce point count by taking every Nth point.
 * Flubber with maxSegmentLength=2 produces many points;
 * we thin them before curve fitting to avoid overfitting.
 */
function thinPoints(points: Point[], targetCount: number): Point[] {
  if (points.length <= targetCount) return points
  const step = points.length / targetCount
  const thinned: Point[] = []
  for (let i = 0; i < targetCount; i++) {
    thinned.push(points[Math.floor(i * step)])
  }
  return thinned
}

/**
 * Generate N intermediate SVG path strings between two shapes.
 * Uses flubber2 for interpolation, then smooths the polygon output
 * into cubic bezier curves via Catmull-Rom spline fitting.
 * Steps clamped to 5-15 per brand rules.
 */
export function generateMorphSteps(
  fromPath: string,
  toPath: string,
  stepCount: number,
): MorphResult {
  const clamped = Math.min(MAX_STEPS, Math.max(MIN_STEPS, stepCount))

  const interpolator = interpolate(fromPath, toPath, {
    maxSegmentLength: 2,
  })

  const steps: string[] = []
  for (let i = 0; i < clamped; i++) {
    const t = clamped === 1 ? 0 : i / (clamped - 1)
    const rawPath = interpolator(t)

    // For endpoints (t=0, t=1), use original paths for fidelity
    if (t === 0) {
      steps.push(fromPath)
    } else if (t === 1) {
      steps.push(toPath)
    } else {
      // Parse flubber's polygon, thin to ~60 points, fit smooth curves
      const points = parsePolygonPath(rawPath)
      const thinned = thinPoints(points, 60)
      steps.push(pointsToSmoothPath(thinned))
    }
  }

  return { steps, interpolator }
}
