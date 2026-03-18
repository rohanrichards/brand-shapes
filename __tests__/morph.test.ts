import { describe, it, expect } from 'vitest'
import { generateMorphSteps, MIN_STEPS, MAX_STEPS } from '../src/core/morph'
import { shapes } from '../src/core/shapes'

describe('generateMorphSteps', () => {
  const fromPath = shapes['primitive-1'].path
  const toPath = shapes['angular-1'].path

  it('returns the requested number of steps', () => {
    const result = generateMorphSteps(fromPath, toPath, 8)
    expect(result.steps).toHaveLength(8)
  })

  it('clamps steps to minimum of 5', () => {
    const result = generateMorphSteps(fromPath, toPath, 2)
    expect(result.steps).toHaveLength(MIN_STEPS)
  })

  it('clamps steps to maximum of 15', () => {
    const result = generateMorphSteps(fromPath, toPath, 20)
    expect(result.steps).toHaveLength(MAX_STEPS)
  })

  it('first step is a valid SVG path starting with M', () => {
    const result = generateMorphSteps(fromPath, toPath, 8)
    expect(result.steps[0]).toBeTruthy()
    expect(result.steps[0].startsWith('M')).toBe(true)
  })

  it('last step is a valid SVG path starting with M', () => {
    const result = generateMorphSteps(fromPath, toPath, 8)
    const lastStep = result.steps[result.steps.length - 1]
    expect(lastStep).toBeTruthy()
    expect(lastStep.startsWith('M')).toBe(true)
  })

  it('all intermediate steps are valid SVG paths', () => {
    const result = generateMorphSteps(fromPath, toPath, 10)
    for (const step of result.steps) {
      expect(step).toBeTruthy()
      expect(step.startsWith('M')).toBe(true)
    }
  })

  it('exports MIN_STEPS and MAX_STEPS constants', () => {
    expect(MIN_STEPS).toBe(5)
    expect(MAX_STEPS).toBe(15)
  })

  it('works with organic to angular morph', () => {
    const result = generateMorphSteps(shapes['organic-2'].path, shapes['angular-4'].path, 8)
    expect(result.steps).toHaveLength(8)
    for (const step of result.steps) {
      expect(step.startsWith('M')).toBe(true)
    }
  })
})
