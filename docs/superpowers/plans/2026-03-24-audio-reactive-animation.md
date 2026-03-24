# Audio-Reactive Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `'audio'` animation mode to Brand Shapes where morph layers deform in real-time based on audio frequency data from mic, system audio, or file input.

**Architecture:** Three-file approach — `src/core/audio-analyser.ts` (pure functions for FFT band splitting, normalization, smoothing, interpolation), `src/demo/audio-source.ts` (browser API wrappers for mic/system/file audio + Meyda integration), and modifications to `src/demo/demo.ts` (new animation mode, GUI controls, audio animation loop with `displacePointsAudio()` in `src/core/animate.ts`).

**Tech Stack:** TypeScript strict, Web Audio API (AnalyserNode), Meyda (devDependency — spectral features), Vitest (TDD), lil-gui, Canvas 2D.

**Spec:** `docs/superpowers/specs/2026-03-24-audio-reactive-animation-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/core/audio-analyser.ts` | Create | Pure functions: band definitions, bin range mapping, level extraction, normalization, smoothing, layer interpolation |
| `__tests__/audio-analyser.test.ts` | Create | Unit tests for all audio-analyser pure functions |
| `src/core/animate.ts` | Modify | Add `displacePointsAudio()` — radial displacement with intensity + centroid-modulated noise |
| `__tests__/animate.test.ts` | Create | Unit tests for `displacePointsAudio()` |
| `src/demo/audio-source.ts` | Create | Browser API wrappers: mic/system/file input, AudioContext lifecycle, Meyda setup, cleanup |
| `src/demo/demo.ts` | Modify | Add `'audio'` mode, audio GUI folder, `startAudioAnimation()` loop, source switching, tab visibility |
| `package.json` | Modify | Add `meyda` as devDependency |

---

## Task 1: Install Meyda + Create Branch

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Create feature branch**

```bash
cd F:/Documents/GitHub/brand-shapes
git checkout main
git pull
git checkout -b feat/audio-reactive-animation
```

- [ ] **Step 2: Install meyda as devDependency**

```bash
npm install --save-dev meyda
```

- [ ] **Step 3: Verify installation**

Run: `cat package.json | grep meyda`
Expected: `"meyda": "^X.Y.Z"` appears in `devDependencies`

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add meyda as devDependency for audio feature extraction"
```

---

## Task 2: Band Definitions + Bin Range Mapping

**Files:**
- Create: `src/core/audio-analyser.ts`
- Create: `__tests__/audio-analyser.test.ts`

- [ ] **Step 1: Write failing tests for band definitions and bin range mapping**

```typescript
// __tests__/audio-analyser.test.ts
import { describe, it, expect } from 'vitest'
import { BANDS, createBandBinRanges, type BandConfig, type BandBinRange } from '../src/core/audio-analyser'

describe('BANDS', () => {
  it('has exactly 7 bands', () => {
    expect(BANDS).toHaveLength(7)
  })

  it('covers 20 Hz to 20000 Hz with no gaps', () => {
    expect(BANDS[0].minHz).toBe(20)
    expect(BANDS[BANDS.length - 1].maxHz).toBe(20000)
    for (let i = 1; i < BANDS.length; i++) {
      expect(BANDS[i].minHz).toBe(BANDS[i - 1].maxHz)
    }
  })

  it('each band has a positive A-weight factor', () => {
    for (const band of BANDS) {
      expect(band.aWeight).toBeGreaterThan(0)
    }
  })
})

describe('createBandBinRanges', () => {
  // fftSize=2048 → binCount=1024, sampleRate=44100 → ~21.53 Hz/bin
  const binRanges = createBandBinRanges(1024, 44100)

  it('returns 7 bin ranges', () => {
    expect(binRanges).toHaveLength(7)
  })

  it('first range starts at bin 0 or 1', () => {
    expect(binRanges[0].startBin).toBeLessThanOrEqual(1)
  })

  it('last range ends at or near bin 1023', () => {
    expect(binRanges[binRanges.length - 1].endBin).toBeGreaterThanOrEqual(900)
  })

  it('bin ranges do not overlap', () => {
    for (let i = 1; i < binRanges.length; i++) {
      expect(binRanges[i].startBin).toBeGreaterThanOrEqual(binRanges[i - 1].endBin)
    }
  })

  it('each range carries the correct A-weight from its band', () => {
    for (let i = 0; i < binRanges.length; i++) {
      expect(binRanges[i].aWeight).toBe(BANDS[i].aWeight)
    }
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/audio-analyser.test.ts`
Expected: FAIL — module `../src/core/audio-analyser` does not exist

- [ ] **Step 3: Implement BANDS and createBandBinRanges**

```typescript
// src/core/audio-analyser.ts

export interface BandConfig {
  name: string
  minHz: number
  maxHz: number
  aWeight: number
}

export interface BandBinRange {
  bandIndex: number
  startBin: number
  endBin: number
  aWeight: number
}

export const BANDS: readonly BandConfig[] = [
  { name: 'sub-bass',   minHz: 20,   maxHz: 60,    aWeight: 0.6 },
  { name: 'bass',       minHz: 60,   maxHz: 250,   aWeight: 0.7 },
  { name: 'low-mid',    minHz: 250,  maxHz: 500,   aWeight: 0.85 },
  { name: 'mid',        minHz: 500,  maxHz: 2000,  aWeight: 1.0 },
  { name: 'upper-mid',  minHz: 2000, maxHz: 4000,  aWeight: 1.2 },
  { name: 'presence',   minHz: 4000, maxHz: 6000,  aWeight: 1.5 },
  { name: 'brilliance', minHz: 6000, maxHz: 20000, aWeight: 2.0 },
] as const

/**
 * Map the 7 fixed frequency bands to FFT bin index ranges.
 * binCount = fftSize / 2 (e.g., 1024 for fftSize=2048).
 * hzPerBin = sampleRate / fftSize = sampleRate / (binCount * 2).
 */
export function createBandBinRanges(binCount: number, sampleRate: number): BandBinRange[] {
  const hzPerBin = sampleRate / (binCount * 2)
  return BANDS.map((band, i) => ({
    bandIndex: i,
    startBin: Math.round(band.minHz / hzPerBin),
    endBin: Math.min(Math.round(band.maxHz / hzPerBin), binCount - 1),
    aWeight: band.aWeight,
  }))
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/audio-analyser.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/audio-analyser.ts __tests__/audio-analyser.test.ts
git commit -m "feat: add frequency band definitions and bin range mapping"
```

---

## Task 3: Band Level Extraction

**Files:**
- Modify: `src/core/audio-analyser.ts`
- Modify: `__tests__/audio-analyser.test.ts`

- [ ] **Step 1: Write failing tests for extractBandLevels**

Add `extractBandLevels` to the existing import statement in `__tests__/audio-analyser.test.ts`, then append:

```typescript
describe('extractBandLevels', () => {
  const binRanges = createBandBinRanges(1024, 44100)

  it('returns 7 levels', () => {
    const data = new Float32Array(1024).fill(-100) // silence in dBFS
    const levels = extractBandLevels(data, binRanges)
    expect(levels).toHaveLength(7)
  })

  it('returns 0 for silence (-100 dBFS)', () => {
    const data = new Float32Array(1024).fill(-100)
    const levels = extractBandLevels(data, binRanges)
    for (const level of levels) {
      expect(level).toBeCloseTo(0, 5)
    }
  })

  it('returns higher values for louder bins', () => {
    const quiet = new Float32Array(1024).fill(-60)
    const loud = new Float32Array(1024).fill(-10)
    const quietLevels = extractBandLevels(quiet, binRanges)
    const loudLevels = extractBandLevels(loud, binRanges)
    for (let i = 0; i < 7; i++) {
      expect(loudLevels[i]).toBeGreaterThan(quietLevels[i])
    }
  })

  it('applies A-weight factors — brilliance band boosted relative to sub-bass', () => {
    // Same dBFS across all bins, but A-weighting should boost high bands
    const data = new Float32Array(1024).fill(-30)
    const levels = extractBandLevels(data, binRanges)
    // Brilliance (aWeight 2.0) should be higher than sub-bass (aWeight 0.6)
    expect(levels[6]).toBeGreaterThan(levels[0])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/audio-analyser.test.ts`
Expected: FAIL — `extractBandLevels` is not exported

- [ ] **Step 3: Implement extractBandLevels**

Add to `src/core/audio-analyser.ts`:

```typescript
/**
 * Extract per-band intensity levels from FFT frequency data.
 * Input: Float32Array of dBFS values (from getFloatFrequencyData).
 * Output: 7 linear amplitude values, A-weighted.
 */
export function extractBandLevels(frequencyData: Float32Array, binRanges: BandBinRange[]): number[] {
  return binRanges.map(({ startBin, endBin, aWeight }) => {
    let sum = 0
    let count = 0
    for (let bin = startBin; bin <= endBin; bin++) {
      // Convert dBFS to linear amplitude: 10^(dBFS/20)
      // Clamp to minimum -100 dBFS to avoid -Infinity
      const dbfs = Math.max(frequencyData[bin], -100)
      sum += Math.pow(10, dbfs / 20)
      count++
    }
    const avg = count > 0 ? sum / count : 0
    return avg * aWeight
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/audio-analyser.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/audio-analyser.ts __tests__/audio-analyser.test.ts
git commit -m "feat: add FFT band level extraction with A-weighting"
```

---

## Task 4: Normalization with Running Min/Max

**Files:**
- Modify: `src/core/audio-analyser.ts`
- Modify: `__tests__/audio-analyser.test.ts`

- [ ] **Step 1: Write failing tests for normalizeLevels**

Add `normalizeLevels`, `createNormalizationHistory`, and `type NormalizationHistory` to the existing import statement in `__tests__/audio-analyser.test.ts`, then append:

```typescript
describe('createNormalizationHistory', () => {
  it('initializes with 7 Infinity min values', () => {
    const h = createNormalizationHistory()
    expect(h.min).toHaveLength(7)
    for (const v of h.min) expect(v).toBe(Infinity)
  })

  it('initializes with 7 -Infinity max values', () => {
    const h = createNormalizationHistory()
    expect(h.max).toHaveLength(7)
    for (const v of h.max) expect(v).toBe(-Infinity)
  })

  it('accepts custom adaptation rate', () => {
    const h = createNormalizationHistory(0.05)
    expect(h.adaptationRate).toBe(0.05)
  })
})

describe('normalizeLevels', () => {
  it('returns values between 0 and 1', () => {
    const history = createNormalizationHistory()
    const levels = [0.1, 0.5, 0.3, 0.8, 0.2, 0.6, 0.4]
    // Feed several frames to build up history
    for (let i = 0; i < 20; i++) {
      normalizeLevels(levels, history)
    }
    const result = normalizeLevels(levels, history)
    for (const v of result) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })

  it('adapts to louder input over time', () => {
    const history = createNormalizationHistory()
    const quiet = [0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01]
    const loud = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]
    // Build quiet baseline
    for (let i = 0; i < 30; i++) normalizeLevels(quiet, history)
    // Loud input should initially produce high normalized values
    const firstLoud = normalizeLevels(loud, history)
    expect(firstLoud[0]).toBeGreaterThan(0.5)
  })

  it('returns 7 values for 7 inputs', () => {
    const history = createNormalizationHistory()
    const levels = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7]
    const result = normalizeLevels(levels, history)
    expect(result).toHaveLength(7)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/audio-analyser.test.ts`
Expected: FAIL — `normalizeLevels` / `createNormalizationHistory` not exported

- [ ] **Step 3: Implement normalizeLevels and NormalizationHistory**

Add to `src/core/audio-analyser.ts`:

```typescript
export interface NormalizationHistory {
  min: number[]
  max: number[]
  adaptationRate: number
}

export function createNormalizationHistory(adaptationRate = 0.02): NormalizationHistory {
  return {
    min: new Array(7).fill(Infinity),
    max: new Array(7).fill(-Infinity),
    adaptationRate,
  }
}

/**
 * Normalize band levels to 0-1 using running min/max per band.
 * Mutates history in place for efficiency. Slow adaptation prevents sudden jumps.
 */
export function normalizeLevels(levels: number[], history: NormalizationHistory): number[] {
  const rate = history.adaptationRate
  return levels.map((level, i) => {
    // Update running min/max with slow adaptation
    if (history.min[i] === Infinity) {
      history.min[i] = level
      history.max[i] = level
    } else {
      history.min[i] += (Math.min(level, history.min[i]) - history.min[i]) * rate
      history.max[i] += (Math.max(level, history.max[i]) - history.max[i]) * rate
    }
    const range = history.max[i] - history.min[i]
    if (range < 0.0001) return 0
    return Math.max(0, Math.min(1, (level - history.min[i]) / range))
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/audio-analyser.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/audio-analyser.ts __tests__/audio-analyser.test.ts
git commit -m "feat: add per-band normalization with running min/max history"
```

---

## Task 5: Temporal Smoothing (Attack/Decay)

**Files:**
- Modify: `src/core/audio-analyser.ts`
- Modify: `__tests__/audio-analyser.test.ts`

- [ ] **Step 1: Write failing tests for smoothLevels**

Add `smoothLevels` to the existing import statement in `__tests__/audio-analyser.test.ts`, then append:

```typescript
describe('smoothLevels', () => {
  const dt = 1 / 60 // 60fps

  it('fast attack: reaches 90% of target within 3 frames at 5ms attack', () => {
    let prev = [0]
    const target = [1]
    for (let i = 0; i < 3; i++) {
      prev = smoothLevels(target, prev, 5, 150, dt)
    }
    expect(prev[0]).toBeGreaterThan(0.9)
  })

  it('slow decay: retains >50% after 5 frames at 150ms decay', () => {
    let prev = [1]
    const target = [0]
    for (let i = 0; i < 5; i++) {
      prev = smoothLevels(target, prev, 5, 150, dt)
    }
    expect(prev[0]).toBeGreaterThan(0.5)
  })

  it('returns same length as input', () => {
    const result = smoothLevels([1, 2, 3, 4, 5, 6, 7], [0, 0, 0, 0, 0, 0, 0], 5, 150, dt)
    expect(result).toHaveLength(7)
  })

  it('uses attack coefficient when current > previous (rising)', () => {
    const rising = smoothLevels([1], [0], 5, 150, dt)
    const falling = smoothLevels([0], [1], 5, 150, dt)
    // Rising should move faster toward target than falling
    expect(rising[0]).toBeGreaterThan(1 - falling[0])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/audio-analyser.test.ts`
Expected: FAIL — `smoothLevels` not exported

- [ ] **Step 3: Implement smoothLevels**

Add to `src/core/audio-analyser.ts`:

```typescript
/**
 * Asymmetric exponential smoothing. Fast attack for beats, slow decay for smooth falloff.
 * attack/decay in milliseconds. dt in seconds (time since last frame).
 */
export function smoothLevels(
  current: number[],
  previous: number[],
  attack: number,
  decay: number,
  dt: number,
): number[] {
  const frameRate = 1 / dt
  return current.map((val, i) => {
    const prev = previous[i] ?? 0
    const ms = val > prev ? attack : decay
    const coeff = 1 - Math.exp(-1000 / (ms * frameRate))
    return prev + (val - prev) * coeff
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/audio-analyser.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/audio-analyser.ts __tests__/audio-analyser.test.ts
git commit -m "feat: add asymmetric attack/decay temporal smoothing"
```

---

## Task 6: Layer Interpolation

**Files:**
- Modify: `src/core/audio-analyser.ts`
- Modify: `__tests__/audio-analyser.test.ts`

- [ ] **Step 1: Write failing tests for interpolateToLayers**

Add `interpolateToLayers` to the existing import statement in `__tests__/audio-analyser.test.ts`, then append:

```typescript
describe('interpolateToLayers', () => {
  it('returns exactly layerCount values', () => {
    const bands = [1, 0.8, 0.6, 0.4, 0.3, 0.2, 0.1]
    expect(interpolateToLayers(bands, 5)).toHaveLength(5)
    expect(interpolateToLayers(bands, 10)).toHaveLength(10)
    expect(interpolateToLayers(bands, 15)).toHaveLength(15)
  })

  it('with 7 layers, returns the 7 band values directly', () => {
    const bands = [1, 0.8, 0.6, 0.4, 0.3, 0.2, 0.1]
    const result = interpolateToLayers(bands, 7)
    for (let i = 0; i < 7; i++) {
      expect(result[i]).toBeCloseTo(bands[i])
    }
  })

  it('first layer matches first band (sub-bass)', () => {
    const bands = [0.9, 0.5, 0.3, 0.4, 0.2, 0.1, 0.05]
    const result = interpolateToLayers(bands, 12)
    expect(result[0]).toBeCloseTo(0.9)
  })

  it('last layer matches last band (brilliance)', () => {
    const bands = [0.9, 0.5, 0.3, 0.4, 0.2, 0.1, 0.05]
    const result = interpolateToLayers(bands, 12)
    expect(result[11]).toBeCloseTo(0.05)
  })

  it('mid layer interpolates between adjacent bands', () => {
    const bands = [1, 0, 0, 0, 0, 0, 0]
    const result = interpolateToLayers(bands, 13)
    // Layer 1 should be between band 0 (1.0) and band 1 (0.0)
    expect(result[1]).toBeGreaterThan(0)
    expect(result[1]).toBeLessThan(1)
  })

  it('returns single value for 1 layer (average of all bands)', () => {
    const bands = [1, 1, 1, 1, 1, 1, 1]
    const result = interpolateToLayers(bands, 1)
    expect(result).toHaveLength(1)
    expect(result[0]).toBeCloseTo(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/audio-analyser.test.ts`
Expected: FAIL — `interpolateToLayers` not exported

- [ ] **Step 3: Implement interpolateToLayers**

Add to `src/core/audio-analyser.ts`:

```typescript
/**
 * Interpolate 7 band levels to N layer intensities.
 * The 7 bands are anchor points evenly spaced across the layer range.
 * Layers between anchors get linearly interpolated intensity.
 */
export function interpolateToLayers(bandLevels: number[], layerCount: number): number[] {
  if (layerCount === 1) {
    // Single layer: average all bands
    return [bandLevels.reduce((a, b) => a + b, 0) / bandLevels.length]
  }
  const bandCount = bandLevels.length
  const result: number[] = []
  for (let i = 0; i < layerCount; i++) {
    // Map layer index to position in band space (0 to bandCount-1)
    const bandPos = (i / (layerCount - 1)) * (bandCount - 1)
    const lower = Math.floor(bandPos)
    const upper = Math.min(lower + 1, bandCount - 1)
    const frac = bandPos - lower
    result.push(bandLevels[lower] * (1 - frac) + bandLevels[upper] * frac)
  }
  return result
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/audio-analyser.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/audio-analyser.ts __tests__/audio-analyser.test.ts
git commit -m "feat: add 7-band to N-layer interpolation"
```

---

## Task 7: Audio Displacement Function

**Files:**
- Modify: `src/core/animate.ts`
- Create: `__tests__/animate.test.ts`

- [ ] **Step 1: Write failing tests for displacePointsAudio**

```typescript
// __tests__/animate.test.ts
import { describe, it, expect } from 'vitest'
import { displacePointsAudio, type Point } from '../src/core/animate'

describe('displacePointsAudio', () => {
  // Simple square of points centered at (50, 50)
  const points: Point[] = [[25, 25], [75, 25], [75, 75], [25, 75]]

  it('returns same number of points', () => {
    const result = displacePointsAudio(points, 0, 0.5, 0.5, 0)
    expect(result).toHaveLength(4)
  })

  it('zero intensity returns points unchanged', () => {
    const result = displacePointsAudio(points, 0, 0, 0.5, 0)
    for (let i = 0; i < points.length; i++) {
      expect(result[i][0]).toBeCloseTo(points[i][0])
      expect(result[i][1]).toBeCloseTo(points[i][1])
    }
  })

  it('high intensity displaces points outward from centroid', () => {
    const result = displacePointsAudio(points, 0, 1.0, 0.5, 0)
    // Point [25,25] is top-left of centroid [50,50], should move further top-left
    expect(result[0][0]).toBeLessThan(25)
    expect(result[0][1]).toBeLessThan(25)
    // Point [75,75] is bottom-right, should move further bottom-right
    expect(result[2][0]).toBeGreaterThan(75)
    expect(result[2][1]).toBeGreaterThan(75)
  })

  it('higher intensity produces larger displacement', () => {
    const low = displacePointsAudio(points, 0, 0.3, 0.5, 0)
    const high = displacePointsAudio(points, 0, 0.9, 0.5, 0)
    const lowDist = Math.abs(low[0][0] - points[0][0])
    const highDist = Math.abs(high[0][0] - points[0][0])
    expect(highDist).toBeGreaterThan(lowDist)
  })

  it('high centroid produces more varied displacement across vertices', () => {
    // Use 24 points in a circle for statistically meaningful variance comparison
    const cx = 50, cy = 50, r = 30
    const circlePoints: Point[] = Array.from({ length: 24 }, (_, i) => {
      const angle = (i / 24) * Math.PI * 2
      return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as Point
    })
    const smooth = displacePointsAudio(circlePoints, 1.0, 0.8, 0.1, 0)
    const spiky = displacePointsAudio(circlePoints, 1.0, 0.8, 0.9, 0)
    // Measure variance of displacement magnitudes
    function variance(displaced: Point[], base: Point[]): number {
      const mags = displaced.map((p, i) => {
        const dx = p[0] - base[i][0]
        const dy = p[1] - base[i][1]
        return Math.sqrt(dx * dx + dy * dy)
      })
      const mean = mags.reduce((a, b) => a + b) / mags.length
      return mags.reduce((a, m) => a + (m - mean) ** 2, 0) / mags.length
    }
    expect(variance(spiky, circlePoints)).toBeGreaterThan(variance(smooth, circlePoints))
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/animate.test.ts`
Expected: FAIL — `displacePointsAudio` is not exported

- [ ] **Step 3: Implement displacePointsAudio**

Add to `src/core/animate.ts` (after the existing `displacePoints` function):

```typescript
/**
 * Audio-reactive point displacement.
 * - Radial displacement outward from centroid, scaled by intensity.
 * - Spectral centroid modulates noise frequency: high centroid = spikier displacement.
 * - Base noise overlay for organic movement independent of audio.
 */
export function displacePointsAudio(
  points: Point[],
  time: number,
  intensity: number,
  spectralCentroid: number,
  layerIndex: number,
): Point[] {
  if (intensity < 0.001) return points.map(p => [...p] as Point)

  const n = points.length
  const center = centroid(points)

  // Audio amplitude: max displacement in shape units
  const maxDisplacement = 8

  // Centroid modulates noise frequency: 0.04 (smooth) to 0.2 (spiky)
  const noiseFreq = 0.04 + spectralCentroid * 0.16
  // Base noise amplitude (subtle organic motion)
  const noiseAmp = 1.0
  const noiseSpeed = 0.3

  return points.map((p, i) => {
    const normalizedIndex = i / n

    // Radial direction from centroid
    const toCenter = [p[0] - center[0], p[1] - center[1]]
    const dist = Math.sqrt(toCenter[0] ** 2 + toCenter[1] ** 2)
    if (dist < 0.001) return [...p] as Point

    const dirX = toCenter[0] / dist
    const dirY = toCenter[1] / dist

    // Per-vertex noise modulation (centroid controls frequency = spikiness)
    const vertexNoise = noise2d(
      normalizedIndex * n * noiseFreq + layerIndex * 10,
      time * noiseSpeed,
    )

    // Audio displacement: radial, noise-modulated
    const audioDisp = intensity * maxDisplacement * (1 + vertexNoise * spectralCentroid)

    // Base organic noise (always present, independent of audio)
    const baseNoiseX = noise2d(normalizedIndex * n * 0.06 + 200, time * noiseSpeed + layerIndex * 5) * noiseAmp
    const baseNoiseY = noise2d(normalizedIndex * n * 0.06 + 300, time * noiseSpeed + 50 + layerIndex * 5) * noiseAmp

    return [
      p[0] + dirX * audioDisp + baseNoiseX,
      p[1] + dirY * audioDisp + baseNoiseY,
    ] as Point
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/animate.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Run all tests to ensure no regressions**

Run: `npx vitest run`
Expected: All test files PASS

- [ ] **Step 6: Commit**

```bash
git add src/core/animate.ts __tests__/animate.test.ts
git commit -m "feat: add displacePointsAudio for audio-reactive vertex deformation"
```

---

## Task 8: Audio Source Management

**Files:**
- Create: `src/demo/audio-source.ts`

This file contains browser API code (AudioContext, getUserMedia, getDisplayMedia, Meyda) — it cannot be unit tested in the `node` Vitest environment. It will be tested manually via the demo.

- [ ] **Step 1: Create audio-source.ts with types and mic input**

```typescript
// src/demo/audio-source.ts
import Meyda from 'meyda'

export interface AudioSourceHandle {
  analyser: AnalyserNode
  sourceNode: AudioNode
  cleanup: () => void
}

export interface MeydaFeatures {
  rms: number
  centroid: number
  spread: number
}

export interface MeydaHandle {
  getFeatures: () => MeydaFeatures
  cleanup: () => void
}

const ANALYSER_FFT_SIZE = 2048

function configureAnalyser(audioCtx: AudioContext): AnalyserNode {
  const analyser = audioCtx.createAnalyser()
  analyser.fftSize = ANALYSER_FFT_SIZE
  analyser.smoothingTimeConstant = 0
  return analyser
}

export async function setupMicInput(audioCtx: AudioContext): Promise<AudioSourceHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  })
  const source = audioCtx.createMediaStreamSource(stream)
  const analyser = configureAnalyser(audioCtx)
  source.connect(analyser)
  // Do NOT connect to destination (prevents feedback)
  return {
    analyser,
    sourceNode: source,
    cleanup: () => {
      source.disconnect()
      stream.getTracks().forEach(t => t.stop())
    },
  }
}

export async function setupSystemAudioInput(audioCtx: AudioContext): Promise<AudioSourceHandle> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    audio: true,
    video: true, // Required by some browsers; video track can be ignored
  })
  // Stop the video track immediately — we only want audio
  stream.getVideoTracks().forEach(t => t.stop())
  const source = audioCtx.createMediaStreamSource(stream)
  const analyser = configureAnalyser(audioCtx)
  source.connect(analyser)
  return {
    analyser,
    sourceNode: source,
    cleanup: () => {
      source.disconnect()
      stream.getTracks().forEach(t => t.stop())
    },
  }
}

export function setupFileInput(audioCtx: AudioContext, file: File): AudioSourceHandle {
  const audio = document.createElement('audio')
  audio.controls = true
  audio.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:1000'
  document.body.appendChild(audio)
  audio.src = URL.createObjectURL(file)

  const source = audioCtx.createMediaElementSource(audio)
  const analyser = configureAnalyser(audioCtx)
  source.connect(analyser)
  analyser.connect(audioCtx.destination) // File playback needs to be audible

  audio.play().catch(console.warn)

  return {
    analyser,
    sourceNode: source,
    cleanup: () => {
      audio.pause()
      source.disconnect()
      analyser.disconnect()
      URL.revokeObjectURL(audio.src)
      audio.remove()
    },
  }
}

export function setupMeyda(audioCtx: AudioContext, sourceNode: AudioNode): MeydaHandle {
  let latestFeatures: MeydaFeatures = { rms: 0, centroid: 0, spread: 0 }
  const bufferSize = ANALYSER_FFT_SIZE
  const nyquist = bufferSize / 2

  // bufferSize=2048 matches AnalyserNode fftSize. This means Meyda's callback fires
  // every ~46ms at 44.1kHz (2048/44100), which is sufficient for the ~60fps animation loop.
  const analyzer = Meyda.createMeydaAnalyzer({
    audioContext: audioCtx,
    source: sourceNode,
    bufferSize,
    featureExtractors: ['rms', 'spectralCentroid', 'spectralSpread'],
    callback: (features: Record<string, number>) => {
      latestFeatures = {
        rms: features.rms ?? 0,
        centroid: Math.min((features.spectralCentroid ?? 0) / nyquist, 1),
        spread: features.spectralSpread ?? 0,
      }
    },
  })
  analyzer.start()

  return {
    getFeatures: () => latestFeatures,
    cleanup: () => analyzer.stop(),
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors (note: Meyda types may need `@types/meyda` or a `declare module 'meyda'` shim — see step 3)

- [ ] **Step 3: If Meyda types are missing, add type declaration**

Create `src/demo/meyda.d.ts` if needed:

```typescript
declare module 'meyda' {
  interface MeydaAnalyzerOptions {
    audioContext: AudioContext
    source: AudioNode
    bufferSize: number
    featureExtractors: string[]
    callback: (features: Record<string, number>) => void
  }
  interface MeydaAnalyzer {
    start(): void
    stop(): void
  }
  const Meyda: {
    createMeydaAnalyzer(options: MeydaAnalyzerOptions): MeydaAnalyzer
  }
  export default Meyda
}
```

- [ ] **Step 4: Commit**

```bash
git add src/demo/audio-source.ts src/demo/meyda.d.ts
git commit -m "feat: add audio source management (mic, system, file, Meyda)"
```

---

## Task 9: Audio Animation Mode + GUI

**Files:**
- Modify: `src/demo/demo.ts`

- [ ] **Step 1: Add audio config properties and imports**

At the top of `demo.ts`, add to imports:

```typescript
import { displacePointsAudio } from '../core/animate'
import {
  createBandBinRanges, extractBandLevels, normalizeLevels, smoothLevels,
  interpolateToLayers, createNormalizationHistory,
} from '../core/audio-analyser'
import {
  setupMicInput, setupSystemAudioInput, setupFileInput, setupMeyda,
  type AudioSourceHandle, type MeydaHandle,
} from './audio-source'
```

Add to the `config` object:

```typescript
  // Audio
  audioSource: 'none' as 'none' | 'mic' | 'system' | 'file',
  audioSensitivity: 1.0,
```

Add audio state variables after the cursor/pulse state section:

```typescript
// --- Audio state ---
let audioCtx: AudioContext | null = null
let audioSourceHandle: AudioSourceHandle | null = null
let meydaHandle: MeydaHandle | null = null
let prevLayerIntensities: number[] = []
let normHistory = createNormalizationHistory()
let frequencyData: Float32Array | null = null
let audioSourceController: ReturnType<typeof GUI.prototype.add> | null = null
```

- [ ] **Step 2: Add audio source switching function**

Add after the audio state variables:

```typescript
async function switchAudioSource(source: string) {
  // Clean up previous source
  if (audioSourceHandle) {
    audioSourceHandle.cleanup()
    audioSourceHandle = null
  }
  if (meydaHandle) {
    meydaHandle.cleanup()
    meydaHandle = null
  }

  if (source === 'none') return

  // Create AudioContext lazily
  if (!audioCtx) {
    audioCtx = new AudioContext()
  }
  await audioCtx.resume()

  try {
    switch (source) {
      case 'mic':
        audioSourceHandle = await setupMicInput(audioCtx)
        break
      case 'system':
        audioSourceHandle = await setupSystemAudioInput(audioCtx)
        break
      case 'file':
        // File handled via file picker — do nothing here
        return
    }
    if (audioSourceHandle) {
      meydaHandle = setupMeyda(audioCtx, audioSourceHandle.sourceNode)
    }
  } catch (err) {
    console.warn('Audio source failed:', err)
    config.audioSource = 'none'
    if (audioSourceController) {
      audioSourceController.setValue('none')
      audioSourceController.updateDisplay()
    }
  }
}

function handleFileSelection() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'audio/*'
  input.addEventListener('cancel', () => {
    config.audioSource = 'none'
    if (audioSourceController) {
      audioSourceController.setValue('none')
      audioSourceController.updateDisplay()
    }
  })
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    if (audioSourceHandle) {
      audioSourceHandle.cleanup()
      audioSourceHandle = null
    }
    if (meydaHandle) {
      meydaHandle.cleanup()
      meydaHandle = null
    }
    if (!audioCtx) audioCtx = new AudioContext()
    await audioCtx.resume()
    audioSourceHandle = setupFileInput(audioCtx, file)
    meydaHandle = setupMeyda(audioCtx, audioSourceHandle.sourceNode)
  }
  input.click()
}
```

- [ ] **Step 3: Add startAudioAnimation function**

Add after `startBreatheAnimation`:

```typescript
// --- Audio animation ---

function startAudioAnimation() {
  stopAnimation()

  const fromShape = getShape(config.from as any)
  const toShape = getShape(config.to as any)
  const totalSteps = config.steps

  const basePointSets: Point[][] = []
  for (let i = 0; i < totalSteps; i++) {
    const t = totalSteps === 1 ? 0 : i / (totalSteps - 1)
    basePointSets.push(getMorphPoints(fromShape.path, toShape.path, t))
  }

  const binCount = audioSourceHandle?.analyser.frequencyBinCount ?? 1024
  const sampleRate = audioCtx?.sampleRate ?? 44100
  const binRanges = createBandBinRanges(binCount, sampleRate)
  frequencyData = new Float32Array(binCount)
  prevLayerIntensities = new Array(totalSteps).fill(0)
  normHistory = createNormalizationHistory()

  let lastTime = performance.now()

  function tick(now: number) {
    const dt = Math.min((now - lastTime) / 1000, 0.05) // Cap at ~20fps to protect smoothing math
    lastTime = now

    let layerIntensities = new Array(totalSteps).fill(0)
    let centroid = 0.5

    if (audioSourceHandle && audioCtx?.state === 'running' && !document.hidden && frequencyData) {
      audioSourceHandle.analyser.getFloatFrequencyData(frequencyData)
      const bandLevels = extractBandLevels(frequencyData, binRanges)
      const normalized = normalizeLevels(bandLevels, normHistory)
      const interpolated = interpolateToLayers(normalized, totalSteps)
      const smoothed = smoothLevels(interpolated, prevLayerIntensities, 5, 150, dt)
      prevLayerIntensities = smoothed // Store unscaled for next frame's smoothing

      if (meydaHandle) {
        const features = meydaHandle.getFeatures()
        centroid = features.centroid
        // Scale intensities by RMS and sensitivity (only for displacement, not stored)
        const rmsScale = features.rms * config.audioSensitivity
        layerIntensities = smoothed.map(v => v * rmsScale)
      } else {
        layerIntensities = smoothed
      }
    } else {
      prevLayerIntensities = layerIntensities
    }

    const time = now / 1000

    const displacedLayers: Point[][] = []
    const indices: number[] = []
    for (let i = 0; i < totalSteps; i++) {
      displacedLayers.push(displacePointsAudio(
        basePointSets[i], time, layerIntensities[i], centroid, i,
      ))
      indices.push(i)
    }

    renderLayerPoints(displacedLayers, indices)

    animId = requestAnimationFrame(tick)
  }

  tick(performance.now())
}
```

- [ ] **Step 4: Update mode switching and animMode type**

Change the `animMode` type in config:

```typescript
  animMode: 'none' as 'none' | 'trail' | 'breathe' | 'audio',
```

Update `startCurrentMode`:

```typescript
function startCurrentMode() {
  stopAnimation()
  // Clean up audio resources when switching away from audio mode
  if (config.animMode !== 'audio' && audioCtx) {
    if (audioSourceHandle) { audioSourceHandle.cleanup(); audioSourceHandle = null }
    if (meydaHandle) { meydaHandle.cleanup(); meydaHandle = null }
    audioCtx.close()
    audioCtx = null
  }
  switch (config.animMode) {
    case 'trail': startTrailAnimation(); break
    case 'breathe': startBreatheAnimation(); break
    case 'audio': startAudioAnimation(); break
    default: renderStatic(); break
  }
}
```

- [ ] **Step 5: Add GUI controls**

Update the animMode dropdown options:

```typescript
animFolder.add(config, 'animMode', ['none', 'trail', 'breathe', 'audio']).name('Mode').onChange(() => {
  updateAnimFolders()
  onConfigChange()
})
```

Add the audio folder after the cursor parallax folder:

```typescript
const audioFolder = animFolder.addFolder('Audio')
audioSourceController = audioFolder.add(config, 'audioSource', {
  'None': 'none',
  'Microphone': 'mic',
  'System Audio': 'system',
  'File': 'file',
}).name('Source').onChange((source: string) => {
  if (source === 'file') {
    handleFileSelection()
  } else {
    switchAudioSource(source)
  }
})
audioFolder.add(config, 'audioSensitivity', 0.1, 3.0, 0.1).name('Sensitivity')
```

Update `updateAnimFolders`:

```typescript
function updateAnimFolders() {
  const mode = config.animMode
  mode === 'trail' ? trailFolder.show() : trailFolder.hide()
  mode === 'breathe' ? breatheFolder.show() : breatheFolder.hide()
  mode === 'audio' ? audioFolder.show() : audioFolder.hide()
}
```

- [ ] **Step 6: Add tab visibility handling**

Add after the resize handler:

```typescript
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && config.animMode === 'audio') {
    // Reset smoothing state to prevent stale data burst
    prevLayerIntensities = new Array(config.steps).fill(0)
  }
})
```

- [ ] **Step 7: Verify TypeScript compiles and all tests pass**

Run: `npx tsc --noEmit && npx vitest run`
Expected: No type errors, all tests PASS

- [ ] **Step 8: Commit**

```bash
git add src/demo/demo.ts
git commit -m "feat: add audio animation mode with GUI controls and source management"
```

---

## Task 10: Manual Testing + Polish

**Files:**
- Modify: `src/core/audio-analyser.ts` (tune constants if needed)
- Modify: `src/core/animate.ts` (tune displacement constants if needed)

- [ ] **Step 1: Start dev server and test mic input**

```bash
npx vite dev --open
```

1. Select Animation Mode → Audio
2. Select Source → Microphone
3. Grant permission
4. Speak/play music near mic — verify layers deform with audio

- [ ] **Step 2: Test file input**

1. Select Source → File
2. Pick an audio file (MP3/WAV)
3. Verify `<audio>` element appears with play/pause controls
4. Verify shapes deform in sync with playback

- [ ] **Step 3: Test system audio (Windows)**

1. Select Source → System Audio
2. Share a browser tab playing music
3. Verify shapes respond

- [ ] **Step 4: Test source switching**

1. Switch between mic → file → system → none
2. Verify no browser mic indicator when switched away from mic
3. Verify `<audio>` element removed when switched away from file
4. Verify no console errors during switching

- [ ] **Step 5: Test animation mode switching**

1. Switch from audio → breathe → none → audio
2. Verify audio resources clean up and restart correctly
3. Verify other modes still work normally

- [ ] **Step 6: Test step count change during audio playback**

1. With audio mode active and playing, change Steps slider (5→15→8)
2. Verify animation restarts cleanly with new layer count
3. Verify no console errors during layer count transition

- [ ] **Step 7: Test permission denial**

1. Select Microphone, deny permission in browser dialog
2. Verify dropdown reverts to "None" and console shows warning

- [ ] **Step 8: Tune parameters if needed**

Adjust these constants based on feel:
- `maxDisplacement` in `displacePointsAudio()` (currently 8)
- Attack/decay values (currently 5ms/150ms)
- A-weight factors in BANDS
- Noise frequency range for centroid modulation

- [ ] **Step 9: Final commit**

```bash
git add -A
git commit -m "feat: tune audio-reactive animation parameters"
```

---

## Task 11: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS (existing 46 + new audio-analyser + animate tests)

- [ ] **Step 2: TypeScript strict check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Build check**

Run: `npx vite build`
Expected: Successful build (meyda excluded from library output since it's demo-only)
