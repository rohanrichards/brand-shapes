/*
 * BRAND SHAPES — Vertex Animation
 *
 * Displaces path points using noise to create organic, living motion.
 * Two layers of movement:
 *   - Basal: continuous low-frequency wobble (breathing)
 *   - Bolus: periodic higher-frequency pulse that propagates through
 *     the shape like a ripple (reaction/stutter)
 */
import { noise2d } from './noise'

export interface VertexAnimConfig {
  /** Breathing amplitude in shape units */
  breathingAmplitude: number
  /** Breathing speed (lower = slower) */
  breathingSpeed: number
  /** Breathing noise spatial frequency (lower = smoother) */
  breathingFrequency: number
  // Pulse parameters — TODO: redesign
  bolusAmplitude: number
  bolusSpeed: number
  bolusWidth: number
  bolusInterval: number
  bolusPause: number
}

export const DEFAULT_VERTEX_ANIM: VertexAnimConfig = {
  breathingAmplitude: 1.5,
  breathingSpeed: 0.4,
  breathingFrequency: 0.08,
  bolusAmplitude: 3.0,
  bolusSpeed: 1.2,
  bolusWidth: 0.15,
  bolusInterval: 3.0,
  bolusPause: 0.5,
}

type Point = [number, number]

/**
 * Displace a set of points using noise-based vertex animation.
 *
 * @param points - The uniformly-sampled shape points to animate
 * @param time - Current time in seconds
 * @param config - Animation parameters
 * @returns New array of displaced points
 */
export function displacePoints(
  points: Point[],
  time: number,
  config: VertexAnimConfig,
): Point[] {
  const n = points.length

  return points.map((p, i) => {
    const normalizedIndex = i / n // 0-1 position along shape

    // --- Breathing displacement ---
    const noiseX = noise2d(
      normalizedIndex * n * config.breathingFrequency,
      time * config.breathingSpeed,
    )
    const noiseY = noise2d(
      normalizedIndex * n * config.breathingFrequency + 100,
      time * config.breathingSpeed + 50,
    )
    const breatheDx = noiseX * config.breathingAmplitude
    const breatheDy = noiseY * config.breathingAmplitude

    return [
      p[0] + breatheDx,
      p[1] + breatheDy,
    ] as Point
  })
}
