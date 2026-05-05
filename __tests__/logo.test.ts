import { describe, it, expect } from 'vitest'
import {
  computeLogoPlacement,
  LOGO_VIEWBOX,
  LOGO_BASE,
  LOGO_REFERENCE,
  LOGO_PATHS,
  LOGO_FILL,
} from '../src/core/logo'

describe('logo constants', () => {
  it('exposes the source SVG viewBox', () => {
    expect(LOGO_VIEWBOX).toEqual({ width: 240, height: 213 })
  })
  it('exposes the template-spec base size and padding', () => {
    expect(LOGO_BASE).toEqual({ width: 100, height: 88, padding: 48 })
  })
  it('uses 1920x1080 as the reference canvas', () => {
    expect(LOGO_REFERENCE).toEqual({ width: 1920, height: 1080 })
  })
  it('exports two non-empty path strings', () => {
    expect(LOGO_PATHS.body.length).toBeGreaterThan(50)
    expect(LOGO_PATHS.slash.length).toBeGreaterThan(20)
    expect(LOGO_PATHS.body).toMatch(/^M/)
    expect(LOGO_PATHS.slash).toMatch(/^M/)
  })
  it('exports black and white fill colors', () => {
    expect(LOGO_FILL.black).toBe('#181818')
    expect(LOGO_FILL.white).toBe('#FCFCFC')
  })
})

describe('computeLogoPlacement', () => {
  it('at template dims (1920x1080) returns exact spec', () => {
    const p = computeLogoPlacement(1920, 1080)
    expect(p.scale).toBe(1)
    expect(p.width).toBe(100)
    expect(p.height).toBe(88)
    expect(p.padding).toBe(48)
    expect(p.x).toBe(48)
    expect(p.y).toBe(1080 - 48 - 88)
  })

  it('at 4K (3840x2160) doubles everything', () => {
    const p = computeLogoPlacement(3840, 2160)
    expect(p.scale).toBe(2)
    expect(p.width).toBe(200)
    expect(p.height).toBe(176)
    expect(p.padding).toBe(96)
    expect(p.x).toBe(96)
    expect(p.y).toBe(2160 - 96 - 176)
  })

  it('at A0 portrait (9933x14043) is width-bound (min picks W ratio)', () => {
    const p = computeLogoPlacement(9933, 14043)
    expect(p.scale).toBeCloseTo(5.1734, 3)
    expect(p.width).toBeCloseTo(517.34, 1)
    expect(p.height).toBeCloseTo(455.26, 1)
    expect(p.padding).toBeCloseTo(248.32, 1)
    expect(p.x).toBeCloseTo(248.32, 1)
    expect(p.y + p.height + p.padding).toBeCloseTo(14043, 1)
  })

  it('at A0 landscape (14043x9933) is width-bound (the smaller ratio)', () => {
    const p = computeLogoPlacement(14043, 9933)
    expect(p.scale).toBeCloseTo(7.3140, 3)
    expect(p.x).toBeCloseTo(p.padding, 3)
    expect(p.y + p.height + p.padding).toBeCloseTo(9933, 1)
  })

  it('at portrait phone (1080x1920) is width-bound and small', () => {
    const p = computeLogoPlacement(1080, 1920)
    expect(p.scale).toBeCloseTo(0.5625, 4)
    expect(p.width).toBeCloseTo(56.25, 2)
    expect(p.height).toBeCloseTo(49.5, 2)
  })

  it('positions logo at bottom-left: x equals padding', () => {
    const p = computeLogoPlacement(2000, 1500)
    expect(p.x).toBe(p.padding)
  })

  it('positions logo at bottom-left: y + height + padding equals canvas height', () => {
    const p = computeLogoPlacement(2000, 1500)
    expect(p.y + p.height + p.padding).toBeCloseTo(1500, 6)
  })
})
