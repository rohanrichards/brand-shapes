/*
 * BRAND SHAPES — Morph Engine
 *
 * Uses flubber2 for topology-safe interpolation, then resamples the
 * polygon output at uniform arc-length intervals to eliminate
 * flubber's uneven point distribution (which causes ripple artifacts).
 *
 * Steps clamped to 5-15 per brand rules.
 */
import { interpolate } from 'flubber2'

export const MIN_STEPS = 5
export const MAX_STEPS = 15

export interface MorphResult {
  steps: string[]
}

type Point = [number, number]

/**
 * Parse an SVG polygon path (M...L...Z) into coordinate pairs.
 */
function parsePoly(pathStr: string): Point[] {
  const points: Point[] = []
  const nums = pathStr.match(/-?[\d.]+(?:e[+-]?\d+)?/gi)
  if (!nums) return points
  for (let i = 0; i < nums.length - 1; i += 2) {
    points.push([parseFloat(nums[i]), parseFloat(nums[i + 1])])
  }
  return points
}

/**
 * Distance between two points.
 */
function dist(a: Point, b: Point): number {
  return Math.sqrt((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2)
}

/**
 * Resample a polygon at uniform arc-length intervals.
 * This eliminates flubber's uneven point spacing that causes ripple artifacts.
 */
function resampleUniform(points: Point[], count: number): Point[] {
  if (points.length < 2) return points

  // Compute cumulative arc lengths
  const lengths: number[] = [0]
  for (let i = 1; i < points.length; i++) {
    lengths.push(lengths[i - 1] + dist(points[i - 1], points[i]))
  }
  const totalLength = lengths[lengths.length - 1]
  if (totalLength === 0) return points

  // Sample at uniform intervals
  const resampled: Point[] = [points[0]]
  let segIdx = 0

  for (let i = 1; i < count; i++) {
    const targetLen = (i / count) * totalLength

    // Advance to the segment containing targetLen
    while (segIdx < lengths.length - 2 && lengths[segIdx + 1] < targetLen) {
      segIdx++
    }

    // Interpolate within the segment
    const segStart = lengths[segIdx]
    const segEnd = lengths[segIdx + 1]
    const segLen = segEnd - segStart
    const t = segLen === 0 ? 0 : (targetLen - segStart) / segLen

    resampled.push([
      points[segIdx][0] + (points[segIdx + 1][0] - points[segIdx][0]) * t,
      points[segIdx][1] + (points[segIdx + 1][1] - points[segIdx][1]) * t,
    ])
  }

  return resampled
}

/**
 * Convert uniformly-sampled points to a smooth SVG path using
 * Catmull-Rom → cubic bezier conversion.
 */
function pointsToSmooth(points: Point[]): string {
  if (points.length < 3) {
    return 'M' + points.map(p => `${p[0]},${p[1]}`).join('L') + 'Z'
  }

  const n = points.length
  let d = `M${points[0][0]},${points[0][1]}`

  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n]
    const p1 = points[i]
    const p2 = points[(i + 1) % n]
    const p3 = points[(i + 2) % n]

    // Catmull-Rom to cubic bezier (tension = 0.5)
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6

    d += `C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`
  }

  return d + 'Z'
}

// Morph cache to avoid recomputing on non-shape parameter changes
let _cache: { key: string; steps: string[] } | null = null

/**
 * Generate N intermediate SVG path strings between two shapes.
 * Results are cached — only recomputes when from/to/stepCount change.
 * Steps clamped to 5-15 per brand rules.
 */
export function generateMorphSteps(
  fromPath: string,
  toPath: string,
  stepCount: number,
): MorphResult {
  const clamped = Math.min(MAX_STEPS, Math.max(MIN_STEPS, stepCount))
  const cacheKey = `${fromPath.length}:${toPath.length}:${clamped}`

  if (_cache && _cache.key === cacheKey) {
    return { steps: _cache.steps }
  }

  const interpolator = interpolate(fromPath, toPath, {
    maxSegmentLength: 1,
  })

  const steps: string[] = []
  for (let i = 0; i < clamped; i++) {
    const t = clamped === 1 ? 0 : i / (clamped - 1)

    if (t === 0) {
      steps.push(fromPath)
    } else if (t === 1) {
      steps.push(toPath)
    } else {
      // Get flubber's polygon, resample uniformly, fit smooth curves
      const rawPoly = interpolator(t)
      const points = parsePoly(rawPoly)
      const uniform = resampleUniform(points, 120)
      steps.push(pointsToSmooth(uniform))
    }
  }

  _cache = { key: cacheKey, steps }
  return { steps }
}
