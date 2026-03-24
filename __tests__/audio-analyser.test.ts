// __tests__/audio-analyser.test.ts
import { describe, it, expect } from 'vitest'
import { BANDS, createBandBinRanges, extractBandLevels, normalizeLevels, createNormalizationHistory, smoothLevels, interpolateToLayers, type BandConfig, type BandBinRange, type NormalizationHistory } from '../src/core/audio-analyser'

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
      expect(level).toBeCloseTo(0, 4)
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
