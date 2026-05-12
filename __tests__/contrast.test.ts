import { describe, it, expect } from 'vitest'
import {
  parseHexColor,
  relativeLuminance,
  contrastRatio,
  wcagTier,
} from '../src/core/contrast'

describe('parseHexColor', () => {
  it('parses 6-digit hex without #', () => {
    expect(parseHexColor('FFFFFF')).toEqual([255, 255, 255])
  })

  it('parses 6-digit hex with #', () => {
    expect(parseHexColor('#000000')).toEqual([0, 0, 0])
  })

  it('parses an arbitrary 6-digit hex', () => {
    expect(parseHexColor('#4B01E6')).toEqual([75, 1, 230])
  })

  it('is case-insensitive', () => {
    expect(parseHexColor('#fcfcfc')).toEqual([252, 252, 252])
    expect(parseHexColor('#FCFCFC')).toEqual([252, 252, 252])
  })

  it('returns [0,0,0] for invalid input', () => {
    expect(parseHexColor('not-a-color')).toEqual([0, 0, 0])
    expect(parseHexColor('')).toEqual([0, 0, 0])
  })
})

describe('relativeLuminance', () => {
  it('returns 0 for pure black', () => {
    expect(relativeLuminance([0, 0, 0])).toBeCloseTo(0, 5)
  })

  it('returns 1 for pure white', () => {
    expect(relativeLuminance([255, 255, 255])).toBeCloseTo(1, 5)
  })

  it('returns ~0.2126 for pure red', () => {
    expect(relativeLuminance([255, 0, 0])).toBeCloseTo(0.2126, 3)
  })

  it('returns ~0.7152 for pure green', () => {
    expect(relativeLuminance([0, 255, 0])).toBeCloseTo(0.7152, 3)
  })

  it('returns ~0.0722 for pure blue', () => {
    expect(relativeLuminance([0, 0, 255])).toBeCloseTo(0.0722, 3)
  })
})

describe('contrastRatio', () => {
  it('returns 21 for black on white', () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 1)
  })

  it('returns 21 regardless of argument order', () => {
    expect(contrastRatio([255, 255, 255], [0, 0, 0])).toBeCloseTo(21, 1)
  })

  it('returns 1 for identical colors', () => {
    expect(contrastRatio([128, 128, 128], [128, 128, 128])).toBeCloseTo(1, 5)
  })

  it('returns ~4.54 for #767676 on white (AA threshold)', () => {
    expect(contrastRatio([0x76, 0x76, 0x76], [255, 255, 255])).toBeCloseTo(4.54, 1)
  })
})

describe('wcagTier', () => {
  it('returns "fail" below 3', () => {
    expect(wcagTier(2.9)).toBe('fail')
    expect(wcagTier(1)).toBe('fail')
  })

  it('returns "AA-large" between 3 and 4.5', () => {
    expect(wcagTier(3)).toBe('AA-large')
    expect(wcagTier(4.49)).toBe('AA-large')
  })

  it('returns "AA" between 4.5 and 7', () => {
    expect(wcagTier(4.5)).toBe('AA')
    expect(wcagTier(6.99)).toBe('AA')
  })

  it('returns "AAA" at 7 or above', () => {
    expect(wcagTier(7)).toBe('AAA')
    expect(wcagTier(21)).toBe('AAA')
  })
})
