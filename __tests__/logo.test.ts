import { describe, it, expect } from 'vitest'
import {
  computeLogoPlacement,
  LOGO_VARIANTS,
  LOGO_REFERENCE,
} from '../src/core/logo'

describe('logo variants', () => {
  it('symbol variant: 240x213 viewBox, 100x88 base, 48px padding', () => {
    expect(LOGO_VARIANTS.symbol.viewBox).toEqual({ width: 240, height: 213 })
    expect(LOGO_VARIANTS.symbol.base).toEqual({ width: 100, height: 88, padding: 48 })
    expect(LOGO_VARIANTS.symbol.paths.length).toBe(2)
    expect(LOGO_VARIANTS.symbol.paths[0].fillRule).toBe('evenodd')
    expect(LOGO_VARIANTS.symbol.paths[1].fillRule).toBeUndefined()
  })

  it('wordmark variant: 640x114 viewBox, 180x32 base, 48px padding', () => {
    expect(LOGO_VARIANTS.wordmark.viewBox).toEqual({ width: 640, height: 114 })
    expect(LOGO_VARIANTS.wordmark.base).toEqual({ width: 180, height: 32, padding: 48 })
    expect(LOGO_VARIANTS.wordmark.paths.length).toBe(7)
  })

  it('uses 1920x1080 as reference canvas', () => {
    expect(LOGO_REFERENCE).toEqual({ width: 1920, height: 1080 })
  })

  it('all path d strings start with M and are non-trivial', () => {
    for (const style of ['symbol', 'wordmark'] as const) {
      for (const path of LOGO_VARIANTS[style].paths) {
        expect(path.d).toMatch(/^M/)
        expect(path.d.length).toBeGreaterThan(20)
      }
    }
  })
})

describe('computeLogoPlacement — symbol', () => {
  it('at template dims (1920x1080) returns exact spec', () => {
    const p = computeLogoPlacement('symbol', 1920, 1080)
    expect(p.scale).toBe(1)
    expect(p.width).toBe(100)
    expect(p.height).toBe(88)
    expect(p.padding).toBe(48)
    expect(p.x).toBe(48)
    expect(p.y).toBe(1080 - 48 - 88)
  })

  it('at 4K doubles dims and padding', () => {
    const p = computeLogoPlacement('symbol', 3840, 2160)
    expect(p.scale).toBe(2)
    expect(p.width).toBe(200)
    expect(p.height).toBe(176)
    expect(p.padding).toBe(96)
  })

  it('at A0 portrait (9933x14043) is width-bound', () => {
    const p = computeLogoPlacement('symbol', 9933, 14043)
    expect(p.scale).toBeCloseTo(5.1734, 3)
    expect(p.x).toBeCloseTo(p.padding, 3)
    expect(p.y + p.height + p.padding).toBeCloseTo(14043, 1)
  })

  it('at portrait phone (1080x1920) is width-bound and small', () => {
    const p = computeLogoPlacement('symbol', 1080, 1920)
    expect(p.scale).toBeCloseTo(0.5625, 4)
    expect(p.width).toBeCloseTo(56.25, 2)
  })
})

describe('computeLogoPlacement — wordmark', () => {
  it('at template dims (1920x1080) returns 180x32 with 48px padding', () => {
    const p = computeLogoPlacement('wordmark', 1920, 1080)
    expect(p.scale).toBe(1)
    expect(p.width).toBe(180)
    expect(p.height).toBe(32)
    expect(p.padding).toBe(48)
    expect(p.x).toBe(48)
    expect(p.y).toBe(1080 - 48 - 32)
  })

  it('at 4K doubles dims and padding', () => {
    const p = computeLogoPlacement('wordmark', 3840, 2160)
    expect(p.scale).toBe(2)
    expect(p.width).toBe(360)
    expect(p.height).toBe(64)
    expect(p.padding).toBe(96)
  })

  it('at A0 portrait scales proportionally and stays anchored bottom-left', () => {
    const p = computeLogoPlacement('wordmark', 9933, 14043)
    expect(p.scale).toBeCloseTo(5.1734, 3)
    expect(p.width).toBeCloseTo(180 * 5.1734, 1)
    expect(p.height).toBeCloseTo(32 * 5.1734, 1)
    expect(p.x).toBeCloseTo(p.padding, 3)
    expect(p.y + p.height + p.padding).toBeCloseTo(14043, 1)
  })

  it('uses the same scale rule as the symbol variant (same canvas → same scale)', () => {
    const symbol = computeLogoPlacement('symbol', 2400, 1500)
    const wordmark = computeLogoPlacement('wordmark', 2400, 1500)
    expect(wordmark.scale).toBe(symbol.scale)
    expect(wordmark.padding).toBe(symbol.padding)
  })
})
