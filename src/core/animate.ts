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
  /** Basal wobble amplitude in shape units */
  basalAmplitude: number
  /** Basal wobble speed (lower = slower) */
  basalSpeed: number
  /** Basal noise spatial frequency (lower = smoother) */
  basalFrequency: number
  /** Bolus pulse amplitude */
  bolusAmplitude: number
  /** Bolus propagation speed */
  bolusSpeed: number
  /** Bolus pulse width (0-1, fraction of shape perimeter) */
  bolusWidth: number
  /** Bolus repeat interval in seconds */
  bolusInterval: number
  /** Fraction of interval that is rest (0-0.9). Pulse plays during the active portion. */
  bolusPause: number
}

export const DEFAULT_VERTEX_ANIM: VertexAnimConfig = {
  basalAmplitude: 1.5,
  basalSpeed: 0.4,
  basalFrequency: 0.08,
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

  // Bolus: a pulse that propagates, then pauses.
  // cyclePhase goes 0→1 over the full interval.
  // Active portion: 0 to (1 - pause). Rest portion: (1 - pause) to 1.
  const cyclePhase = ((time % config.bolusInterval) / config.bolusInterval)
  const activeFraction = 1 - config.bolusPause
  const bolusActive = cyclePhase < activeFraction
  // During active phase, remap to 0→1 for propagation position
  const bolusCenter = bolusActive ? cyclePhase / activeFraction : 0

  return points.map((p, i) => {
    const normalizedIndex = i / n // 0-1 position along shape

    // --- Basal displacement ---
    // Use noise sampled at the point's position + time for organic wobble
    const noiseX = noise2d(
      normalizedIndex * n * config.basalFrequency,
      time * config.basalSpeed,
    )
    const noiseY = noise2d(
      normalizedIndex * n * config.basalFrequency + 100, // offset to decorrelate X/Y
      time * config.basalSpeed + 50,
    )
    const basalDx = noiseX * config.basalAmplitude
    const basalDy = noiseY * config.basalAmplitude

    // --- Bolus displacement ---
    // Distance from bolus center (wrapping around the shape perimeter)
    let dist = Math.abs(normalizedIndex - bolusCenter)
    if (dist > 0.5) dist = 1 - dist // wrap around

    // Gaussian-ish pulse shape — zero during pause
    const bolusStrength = bolusActive
      ? Math.exp(-(dist * dist) / (2 * config.bolusWidth * config.bolusWidth))
      : 0

    // Bolus displaces radially outward from shape center
    // Compute approximate center of all points
    // (cheap: just use noise direction rather than computing centroid)
    const bolusNoiseX = noise2d(
      normalizedIndex * 20 + time * 2,
      time * config.bolusSpeed * 3,
    )
    const bolusNoiseY = noise2d(
      normalizedIndex * 20 + time * 2 + 200,
      time * config.bolusSpeed * 3 + 100,
    )
    const bolusDx = bolusNoiseX * config.bolusAmplitude * bolusStrength
    const bolusDy = bolusNoiseY * config.bolusAmplitude * bolusStrength

    return [
      p[0] + basalDx + bolusDx,
      p[1] + basalDy + bolusDy,
    ] as Point
  })
}
