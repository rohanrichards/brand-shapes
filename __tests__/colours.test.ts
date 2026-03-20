import { describe, it, expect } from 'vitest'
import { BRAND_PALETTE, getColourHex, brandColourNames, brandColourHexes, allColourHexes } from '../src/core/colours'

describe('BRAND_PALETTE', () => {
  it('contains exactly 16 brand colours', () => {
    expect(BRAND_PALETTE).toHaveLength(16)
  })

  it('every entry has a name and valid hex', () => {
    for (const c of BRAND_PALETTE) {
      expect(c.name).toBeTruthy()
      expect(c.hex).toMatch(/^#[0-9A-F]{6}$/i)
    }
  })

  it('contains all 5 mid-tones', () => {
    const hexes = BRAND_PALETTE.map(c => c.hex)
    expect(hexes).toContain('#BEF958')
    expect(hexes).toContain('#81330C')
    expect(hexes).toContain('#FF38C0')
    expect(hexes).toContain('#EE4811')
    expect(hexes).toContain('#4B01E6')
  })

  it('contains all 5 darks', () => {
    const hexes = BRAND_PALETTE.map(c => c.hex)
    expect(hexes).toContain('#263212')
    expect(hexes).toContain('#341405')
    expect(hexes).toContain('#400E30')
    expect(hexes).toContain('#471605')
    expect(hexes).toContain('#170045')
  })

  it('contains all 5 lights', () => {
    const hexes = BRAND_PALETTE.map(c => c.hex)
    expect(hexes).toContain('#EDFFCC')
    expect(hexes).toContain('#EFD8C2')
    expect(hexes).toContain('#FFC3F6')
    expect(hexes).toContain('#FFC6BF')
    expect(hexes).toContain('#DEDAFF')
  })

  it('contains white', () => {
    const hexes = BRAND_PALETTE.map(c => c.hex)
    expect(hexes).toContain('#FFFFFF')
  })

  it('has no duplicate hex values', () => {
    const hexes = BRAND_PALETTE.map(c => c.hex)
    expect(new Set(hexes).size).toBe(hexes.length)
  })
})

describe('getColourHex', () => {
  it('returns hex for a valid name', () => {
    expect(getColourHex('lime')).toBe('#BEF958')
  })

  it('returns undefined for an invalid name', () => {
    expect(getColourHex('nope')).toBeUndefined()
  })
})

describe('brandColourNames', () => {
  it('returns 16 names', () => {
    expect(brandColourNames).toHaveLength(16)
  })
})

describe('brandColourHexes', () => {
  it('returns 16 hex values', () => {
    expect(brandColourHexes).toHaveLength(16)
  })

  it('all entries are valid hex', () => {
    for (const hex of brandColourHexes) {
      expect(hex).toMatch(/^#[0-9A-F]{6}$/i)
    }
  })
})

describe('allColourHexes', () => {
  it('includes brand palette plus preset extras', () => {
    expect(allColourHexes).toHaveLength(18)
    expect(allColourHexes).toContain('#FEA6E1')
    expect(allColourHexes).toContain('#C2F462')
  })
})
