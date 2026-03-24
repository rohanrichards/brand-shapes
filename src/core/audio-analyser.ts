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
