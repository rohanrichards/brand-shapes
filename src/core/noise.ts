/*
 * Simple 2D noise for vertex animation.
 * Uses a hash-based approach — not true Perlin/simplex but sufficient
 * for organic displacement at the point counts we use (~120 points).
 */

// Permutation table (seeded, deterministic)
const P = new Uint8Array(512)
for (let i = 0; i < 256; i++) P[i] = i
for (let i = 255; i > 0; i--) {
  const j = Math.floor((i + 1) * (Math.sin(i * 127.1) * 0.5 + 0.5))
  const tmp = P[i]
  P[i] = P[j]
  P[j] = tmp
}
for (let i = 0; i < 256; i++) P[i + 256] = P[i]

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a)
}

function grad(hash: number, x: number, y: number): number {
  const h = hash & 3
  const u = h < 2 ? x : y
  const v = h < 2 ? y : x
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v)
}

/**
 * 2D Perlin-style noise. Returns values in roughly [-1, 1].
 */
export function noise2d(x: number, y: number): number {
  const xi = Math.floor(x) & 255
  const yi = Math.floor(y) & 255
  const xf = x - Math.floor(x)
  const yf = y - Math.floor(y)

  const u = fade(xf)
  const v = fade(yf)

  const aa = P[P[xi] + yi]
  const ab = P[P[xi] + yi + 1]
  const ba = P[P[xi + 1] + yi]
  const bb = P[P[xi + 1] + yi + 1]

  return lerp(
    lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u),
    lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u),
    v,
  )
}
