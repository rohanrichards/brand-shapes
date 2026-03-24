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
