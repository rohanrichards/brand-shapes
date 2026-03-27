import { describe, it, expect } from 'vitest'
import { pathCentroid, computeStepTransform } from '../src/core/transforms'

describe('pathCentroid', () => {
  it('returns center of a simple square path', () => {
    const path = 'M 0 0 L 100 0 L 100 100 L 0 100 Z'
    const [cx, cy] = pathCentroid(path)
    expect(cx).toBeCloseTo(50, 0)
    expect(cy).toBeCloseTo(50, 0)
  })

  it('returns [0,0] for empty path', () => {
    const [cx, cy] = pathCentroid('')
    expect(cx).toBe(0)
    expect(cy).toBe(0)
  })

  it('handles negative coordinates', () => {
    const path = 'M -50 -50 L 50 -50 L 50 50 L -50 50 Z'
    const [cx, cy] = pathCentroid(path)
    expect(cx).toBeCloseTo(0, 0)
    expect(cy).toBeCloseTo(0, 0)
  })

  it('handles scientific notation in paths', () => {
    const path = 'M 1e2 2e2 L 3e2 4e2'
    const [cx, cy] = pathCentroid(path)
    expect(cx).toBeCloseTo(200, 0)
    expect(cy).toBeCloseTo(300, 0)
  })
})

describe('computeStepTransform', () => {
  it('first step gets scaleFrom and full offset', () => {
    const result = computeStepTransform(0, 8, 'right', 1.0, 1.15, 0.95)
    expect(result.scale).toBeCloseTo(1.15)
    expect(result.offsetX).toBeGreaterThan(0)
    expect(result.offsetY).toBe(0)
  })

  it('last step gets scaleTo and zero offset', () => {
    const result = computeStepTransform(7, 8, 'right', 1.0, 1.15, 0.95)
    expect(result.scale).toBeCloseTo(0.95)
    expect(result.offsetX).toBeCloseTo(0)
  })

  it('center alignment produces zero offset', () => {
    const result = computeStepTransform(0, 8, 'center', 1.0, 1.15, 0.95)
    expect(result.offsetX).toBe(0)
    expect(result.offsetY).toBe(0)
  })

  it('single step returns t=0 (scaleFrom)', () => {
    const result = computeStepTransform(0, 1, 'right', 1.0, 1.15, 0.95)
    expect(result.scale).toBeCloseTo(1.15)
  })

  it('left alignment produces negative offsetX', () => {
    const result = computeStepTransform(0, 8, 'left', 1.0, 1.15, 0.95)
    expect(result.offsetX).toBeLessThan(0)
  })

  it('top alignment produces negative offsetY', () => {
    const result = computeStepTransform(0, 8, 'top', 1.0, 1.15, 0.95)
    expect(result.offsetY).toBeLessThan(0)
  })

  it('spread multiplier scales offset', () => {
    const spread1 = computeStepTransform(0, 8, 'right', 1.0, 1.15, 0.95)
    const spread2 = computeStepTransform(0, 8, 'right', 2.0, 1.15, 0.95)
    expect(spread2.offsetX).toBeCloseTo(spread1.offsetX * 2)
  })
})
