/*
 * BRAND SHAPES — Vertex Animation
 *
 * Two layers of movement:
 *   - Breathing: continuous noise-based organic wobble
 *   - Pulse: sharp radial heartbeat impulse that shivers down through layers
 */
import { noise2d } from './noise'

export interface VertexAnimConfig {
  /** Breathing amplitude in shape units */
  breathingAmplitude: number
  /** Breathing speed (lower = slower) */
  breathingSpeed: number
  /** Breathing noise spatial frequency (lower = smoother) */
  breathingFrequency: number
  /** Pulse radial amplitude (how far points push outward) */
  pulseAmplitude: number
  /** Pulse interval in seconds (time between heartbeats) */
  pulseInterval: number
  /** Pulse attack sharpness — higher = snappier impulse */
  pulseSharpness: number
  /** Pulse cascade delay per layer (seconds between each layer's pulse) */
  pulseCascadeDelay: number
}

export const DEFAULT_VERTEX_ANIM: VertexAnimConfig = {
  breathingAmplitude: 1.5,
  breathingSpeed: 0.4,
  breathingFrequency: 0.08,
  pulseAmplitude: 4.0,
  pulseInterval: 3.0,
  pulseSharpness: 12,
  pulseCascadeDelay: 0.08,
}

type Point = [number, number]

/**
 * Compute the centroid of a set of points.
 */
function centroid(points: Point[]): Point {
  let cx = 0, cy = 0
  for (const p of points) {
    cx += p[0]
    cy += p[1]
  }
  return [cx / points.length, cy / points.length]
}

/**
 * Sharp impulse envelope: quick attack, exponential decay.
 * Returns 0-1 where 1 is peak.
 *
 * @param phase - 0 to 1 within the pulse cycle
 * @param sharpness - higher = snappier attack and faster decay
 */
function impulseEnvelope(phase: number, sharpness: number): number {
  if (phase < 0 || phase >= 1) return 0
  // Fast rise, exponential decay: t * e^(-sharpness * t)
  // Normalized so peak ≈ 1
  const t = phase
  const peak = 1 / (sharpness * Math.E) // analytical max of t*e^(-s*t) at t=1/s
  const raw = t * Math.exp(-sharpness * t)
  return Math.min(raw / peak, 1)
}

/**
 * Displace points with breathing (continuous) and pulse (heartbeat).
 *
 * @param points - The uniformly-sampled shape points
 * @param time - Current time in seconds
 * @param config - Animation parameters
 * @param layerIndex - Which layer this is (0 = outermost/first)
 * @returns Displaced points
 */
export function displacePoints(
  points: Point[],
  time: number,
  config: VertexAnimConfig,
  layerIndex: number = 0,
): Point[] {
  const n = points.length
  const center = centroid(points)

  // --- Pulse (heartbeat) ---
  // Each layer pulses with a cascade delay
  const layerTime = time - layerIndex * config.pulseCascadeDelay
  const cycleTime = layerTime % config.pulseInterval
  const pulsePhase = cycleTime / config.pulseInterval
  const pulseStrength = impulseEnvelope(pulsePhase, config.pulseSharpness) * config.pulseAmplitude

  return points.map((p, i) => {
    const normalizedIndex = i / n

    // --- Breathing ---
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

    // --- Pulse: radial outward from centroid ---
    let pulseDx = 0
    let pulseDy = 0
    if (pulseStrength > 0.01) {
      const dx = p[0] - center[0]
      const dy = p[1] - center[1]
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > 0.001) {
        // Normalize direction, scale by pulse strength
        pulseDx = (dx / dist) * pulseStrength
        pulseDy = (dy / dist) * pulseStrength
      }
    }

    return [
      p[0] + breatheDx + pulseDx,
      p[1] + breatheDy + pulseDy,
    ] as Point
  })
}
