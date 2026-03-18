import { describe, it, expect } from 'vitest'
import { shapes, getShape, shapeNames, type ShapeName } from '../src/core/shapes'

describe('shapes', () => {
  it('exports exactly 12 shapes', () => {
    expect(Object.keys(shapes)).toHaveLength(12)
  })

  it('has 4 primitive shapes', () => {
    const primitives = Object.values(shapes).filter(s => s.category === 'primitive')
    expect(primitives).toHaveLength(4)
  })

  it('has 4 organic shapes', () => {
    const organics = Object.values(shapes).filter(s => s.category === 'organic')
    expect(organics).toHaveLength(4)
  })

  it('has 4 angular shapes', () => {
    const angulars = Object.values(shapes).filter(s => s.category === 'angular')
    expect(angulars).toHaveLength(4)
  })

  it('each shape has a non-empty SVG path starting with M', () => {
    for (const [name, shape] of Object.entries(shapes)) {
      expect(shape.path, `${name} path`).toBeTruthy()
      expect(shape.path.startsWith('M'), `${name} path starts with M`).toBe(true)
    }
  })

  it('each shape has a valid viewBox (4 numbers)', () => {
    for (const [name, shape] of Object.entries(shapes)) {
      expect(shape.viewBox, `${name} viewBox`).toMatch(/^\d+ \d+ \d+ \d+$/)
    }
  })

  it('getShape returns correct shape by name', () => {
    const shape = getShape('primitive-1')
    expect(shape.category).toBe('primitive')
    expect(shape.path).toBeTruthy()
  })

  it('shapeNames lists all 12 names', () => {
    expect(shapeNames).toHaveLength(12)
    expect(shapeNames).toContain('primitive-1')
    expect(shapeNames).toContain('organic-4')
    expect(shapeNames).toContain('angular-4')
  })

  it('each path contains only valid SVG path commands', () => {
    const validCommands = /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s\-eE]+$/
    for (const [name, shape] of Object.entries(shapes)) {
      expect(shape.path, `${name} has valid SVG path chars`).toMatch(validCommands)
    }
  })
})
