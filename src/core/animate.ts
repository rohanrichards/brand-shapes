/*
 * BRAND SHAPES — Vertex Animation
 *
 * Three layers of movement:
 *   - Breathing: continuous noise-based organic wobble
 *   - Cursor repulsion: points near cursor push away from it
 *   - Pulse: sharp radial heartbeat impulse triggered on click,
 *     cascading down through layers
 */
import { noise2d } from './noise'

export interface VertexAnimConfig {
  breathingAmplitude: number
  breathingSpeed: number
  breathingFrequency: number
  /** Pulse radial amplitude */
  pulseAmplitude: number
  /** Natural pulse interval in seconds (automatic heartbeat) */
  pulseInterval: number
  /** Pulse attack sharpness — higher = snappier */
  pulseSharpness: number
  /** Pulse cascade delay per layer (seconds) */
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

export type Point = [number, number]

/** Cursor state in shape-local coordinates (null = cursor not over shape) */
export interface CursorState {
  x: number
  y: number
}

/** Pulse state — triggered by click */
export interface PulseState {
  /** Time the pulse was triggered (seconds, same clock as animation time) */
  triggerTime: number
}

function centroid(points: Point[]): Point {
  let cx = 0, cy = 0
  for (const p of points) { cx += p[0]; cy += p[1] }
  return [cx / points.length, cy / points.length]
}

function impulseEnvelope(elapsed: number, sharpness: number): number {
  if (elapsed < 0) return 0
  // Impulse decays over ~1 second regardless of sharpness
  const t = elapsed
  if (t > 2) return 0 // fully decayed
  const peak = 1 / (sharpness * Math.E)
  const raw = t * Math.exp(-sharpness * t)
  return Math.min(raw / peak, 1)
}

/**
 * Displace points with breathing, cursor repulsion, and click-triggered pulse.
 */
export function displacePoints(
  points: Point[],
  time: number,
  config: VertexAnimConfig,
  layerIndex: number = 0,
  pulse: PulseState | null = null,
): Point[] {
  const n = points.length
  const center = centroid(points)

  // --- Pulse strength ---
  // Natural heartbeat (automatic, repeating)
  const layerTime = time - layerIndex * config.pulseCascadeDelay
  const cycleTime = ((layerTime % config.pulseInterval) + config.pulseInterval) % config.pulseInterval
  const naturalPulse = impulseEnvelope(cycleTime / config.pulseInterval, config.pulseSharpness)

  // Click-triggered pulse (additive, on top of natural rhythm)
  let clickPulse = 0
  if (pulse) {
    const elapsed = time - pulse.triggerTime - layerIndex * config.pulseCascadeDelay
    clickPulse = impulseEnvelope(elapsed, config.pulseSharpness)
  }

  const pulseStrength = (naturalPulse + clickPulse) * config.pulseAmplitude

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
    let dx = noiseX * config.breathingAmplitude
    let dy = noiseY * config.breathingAmplitude

    // --- Pulse: radial outward from centroid ---
    if (pulseStrength > 0.01) {
      const toCenter = [p[0] - center[0], p[1] - center[1]]
      const dist = Math.sqrt(toCenter[0] ** 2 + toCenter[1] ** 2)
      if (dist > 0.001) {
        dx += (toCenter[0] / dist) * pulseStrength
        dy += (toCenter[1] / dist) * pulseStrength
      }
    }

    return [p[0] + dx, p[1] + dy] as Point
  })
}
