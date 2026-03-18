import { describe, it, expect } from 'vitest'
import {
  lerpColour,
  generateStepFills,
  buildConicGradientConfig,
  buildLinearGradientStops,
  DEFAULT_NOISE_CONFIG,
  DEFAULT_BLUR_CONFIG,
} from '../src/core/effects'

describe('lerpColour', () => {
  it('returns first colour at t=0', () => {
    expect(lerpColour('#000000', '#ffffff', 0)).toBe('#000000')
  })

  it('returns second colour at t=1', () => {
    expect(lerpColour('#000000', '#ffffff', 1)).toBe('#ffffff')
  })

  it('returns midpoint at t=0.5', () => {
    const result = lerpColour('#000000', '#ffffff', 0.5)
    expect(result).toBe('#808080')
  })

  it('handles branded colours', () => {
    const result = lerpColour('#263212', '#EDFFCC', 0.5)
    expect(result).toMatch(/^#[0-9a-f]{6}$/i)
  })
})

describe('generateStepFills', () => {
  it('returns correct number of fills', () => {
    const fills = generateStepFills('#263212', '#BEF958', '#EDFFCC', 8)
    expect(fills).toHaveLength(8)
  })

  it('first fill is the current colour', () => {
    const fills = generateStepFills('#263212', '#BEF958', '#EDFFCC', 8)
    expect(fills[0]).toBe('#263212')
  })

  it('last fill is the future colour', () => {
    const fills = generateStepFills('#263212', '#BEF958', '#EDFFCC', 8)
    expect(fills[fills.length - 1]).toBe('#edffcc')
  })

  it('catalyst band appears in middle fills', () => {
    const fills = generateStepFills('#000000', '#ff0000', '#ffffff', 11)
    const midFill = fills[5]
    expect(midFill).toBe('#ff0000')
  })

  it('all fills are valid hex colours', () => {
    const fills = generateStepFills('#263212', '#BEF958', '#EDFFCC', 10)
    for (const fill of fills) {
      expect(fill).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})

describe('buildConicGradientConfig', () => {
  it('returns config with all three colours', () => {
    const config = buildConicGradientConfig('#263212', '#BEF958', '#EDFFCC')
    expect(config.current).toBe('#263212')
    expect(config.catalyst).toBe('#BEF958')
    expect(config.future).toBe('#EDFFCC')
  })

  it('defaults to 90 degree start angle', () => {
    const config = buildConicGradientConfig('#263212', '#BEF958', '#EDFFCC')
    expect(config.angleDeg).toBe(90)
  })

  it('accepts custom angle', () => {
    const config = buildConicGradientConfig('#263212', '#BEF958', '#EDFFCC', 180)
    expect(config.angleDeg).toBe(180)
  })

  it('defaults to 50/50 center', () => {
    const config = buildConicGradientConfig('#263212', '#BEF958', '#EDFFCC')
    expect(config.centerX).toBe(0.5)
    expect(config.centerY).toBe(0.5)
  })
})

describe('buildLinearGradientStops', () => {
  it('returns stops with current/catalyst/future at correct offsets', () => {
    const stops = buildLinearGradientStops('#263212', '#BEF958', '#EDFFCC')
    expect(stops).toHaveLength(4)
    expect(stops[0]).toEqual({ offset: 0, color: '#263212' })
    expect(stops[1]).toEqual({ offset: 0.45, color: '#BEF958' })
    expect(stops[2]).toEqual({ offset: 0.55, color: '#BEF958' })
    expect(stops[3]).toEqual({ offset: 1, color: '#EDFFCC' })
  })
})

describe('noise and blur configs', () => {
  it('DEFAULT_NOISE_CONFIG has expected values', () => {
    expect(DEFAULT_NOISE_CONFIG.enabled).toBe(false)
    expect(DEFAULT_NOISE_CONFIG.opacity).toBeCloseTo(0.12)
    expect(DEFAULT_NOISE_CONFIG.size).toBe(256)
  })

  it('DEFAULT_BLUR_CONFIG has expected values', () => {
    expect(DEFAULT_BLUR_CONFIG.enabled).toBe(false)
    expect(DEFAULT_BLUR_CONFIG.radius).toBe(2)
  })
})
