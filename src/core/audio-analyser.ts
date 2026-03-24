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
