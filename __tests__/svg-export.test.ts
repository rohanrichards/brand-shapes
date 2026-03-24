// __tests__/svg-export.test.ts
import { describe, it, expect } from 'vitest'
import { generateSVG, type SVGExportConfig, type SVGExportStep } from '../src/core/svg-export'

function makeWireframeConfig(overrides: Partial<SVGExportConfig> = {}): SVGExportConfig {
  return {
    width: 800,
    height: 600,
    viewBox: [0, 0, 164, 104] as [number, number, number, number],
    background: '#000000',
    variant: 'wireframe',
    noise: false,
    noiseOpacity: 0.08,
    colours: { current: '#4B01E6', catalyst: '#BEF958', future: '#FEA6E1' },
    steps: [
      { path: 'M 10 10 L 90 10 L 90 90 Z', centroid: [63.3, 36.7], transform: { scale: 1, offsetX: 0, offsetY: 0 }, opacity: 1.0, strokeWidth: 1.5 },
      { path: 'M 20 20 L 80 20 L 80 80 Z', centroid: [60, 40], transform: { scale: 1, offsetX: 0, offsetY: 0 }, opacity: 0.7, strokeWidth: 1.5 },
    ],
    ...overrides,
  }
}

describe('generateSVG — wireframe', () => {
  it('returns valid SVG with correct root element', () => {
    const svg = generateSVG(makeWireframeConfig())
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"')
    expect(svg).toContain('width="800"')
    expect(svg).toContain('height="600"')
    expect(svg).toContain('</svg>')
  })

  it('includes linearGradient in defs', () => {
    const svg = generateSVG(makeWireframeConfig())
    expect(svg).toContain('<linearGradient')
    expect(svg).toContain('id="wireStroke"')
  })

  it('uses gradient stops from buildLinearGradientStops', () => {
    const svg = generateSVG(makeWireframeConfig())
    expect(svg).toContain('offset="0"')
    expect(svg).toContain('offset="0.45"')
    expect(svg).toContain('offset="0.55"')
    expect(svg).toContain('offset="1"')
  })

  it('includes one path per step with stroke and no fill', () => {
    const svg = generateSVG(makeWireframeConfig())
    expect(svg).toContain('stroke="url(#wireStroke)"')
    expect(svg).toContain('fill="none"')
    const pathMatches = svg.match(/<path[^/]*d="/g)
    expect(pathMatches?.length).toBe(2)
  })

  it('applies opacity to each path', () => {
    const svg = generateSVG(makeWireframeConfig())
    expect(svg).toContain('opacity="1"')
    expect(svg).toContain('opacity="0.7"')
  })

  it('includes background rect', () => {
    const svg = generateSVG(makeWireframeConfig())
    expect(svg).toContain('<rect width="100%" height="100%" fill="#000000"')
  })

  it('omits background rect when transparent', () => {
    const svg = generateSVG(makeWireframeConfig({ background: 'transparent' }))
    expect(svg).not.toContain('<rect')
  })

  it('includes noise filter when enabled', () => {
    const svg = generateSVG(makeWireframeConfig({ noise: true }))
    expect(svg).toContain('<filter id="noise"')
    expect(svg).toContain('feTurbulence')
    expect(svg).toContain('filter="url(#noise)"')
  })

  it('omits noise filter when disabled', () => {
    const svg = generateSVG(makeWireframeConfig({ noise: false }))
    expect(svg).not.toContain('<filter')
    expect(svg).not.toContain('feTurbulence')
  })

  it('includes stroke-width from step', () => {
    const svg = generateSVG(makeWireframeConfig())
    expect(svg).toContain('stroke-width="1.5"')
  })
})

function makeFilledConfig(overrides: Partial<SVGExportConfig> = {}): SVGExportConfig {
  return {
    width: 800,
    height: 600,
    viewBox: [0, 0, 164, 104] as [number, number, number, number],
    background: '#000000',
    variant: 'filled',
    noise: false,
    noiseOpacity: 0.08,
    colours: { current: '#4B01E6', catalyst: '#BEF958', future: '#FEA6E1' },
    steps: [
      { path: 'M 10 10 L 90 10 L 90 90 Z', centroid: [63.3, 36.7], transform: { scale: 1.1, offsetX: 5, offsetY: 0 }, opacity: 1.0, gradientImage: 'data:image/jpeg;base64,/9j/fake1' },
      { path: 'M 20 20 L 80 20 L 80 80 Z', centroid: [60, 40], transform: { scale: 0.95, offsetX: 0, offsetY: 0 }, opacity: 1.0, gradientImage: 'data:image/jpeg;base64,/9j/fake2' },
    ],
    ...overrides,
  }
}

describe('generateSVG — filled', () => {
  it('includes clipPath per step in defs', () => {
    const svg = generateSVG(makeFilledConfig())
    expect(svg).toContain('<clipPath id="clip-0">')
    expect(svg).toContain('<clipPath id="clip-1">')
  })

  it('each layer references its clipPath', () => {
    const svg = generateSVG(makeFilledConfig())
    expect(svg).toContain('clip-path="url(#clip-0)"')
    expect(svg).toContain('clip-path="url(#clip-1)"')
  })

  it('includes image element with gradient data URL', () => {
    const svg = generateSVG(makeFilledConfig())
    expect(svg).toContain('href="data:image/jpeg;base64,/9j/fake1"')
    expect(svg).toContain('href="data:image/jpeg;base64,/9j/fake2"')
  })

  it('applies transform with centroid pivot', () => {
    const svg = generateSVG(makeFilledConfig())
    // First step: centroid [63.3, 36.7], scale 1.1, offset (5, 0)
    expect(svg).toContain('translate(68.3,36.7) scale(1.1) translate(-63.3,-36.7)')
  })

  it('does not include linearGradient (that is wireframe only)', () => {
    const svg = generateSVG(makeFilledConfig())
    expect(svg).not.toContain('<linearGradient')
  })
})

describe('generateSVG — gradient variant', () => {
  it('applies opacity per step', () => {
    const config = makeFilledConfig({
      variant: 'gradient',
      steps: [
        { path: 'M 10 10 L 90 90', centroid: [50, 50], transform: { scale: 1, offsetX: 0, offsetY: 0 }, opacity: 0.05, gradientImage: 'data:image/jpeg;base64,/9j/x' },
        { path: 'M 20 20 L 80 80', centroid: [50, 50], transform: { scale: 1, offsetX: 0, offsetY: 0 }, opacity: 1.0, gradientImage: 'data:image/jpeg;base64,/9j/y' },
      ],
    })
    const svg = generateSVG(config)
    expect(svg).toContain('opacity="0.05"')
    expect(svg).toContain('opacity="1"')
  })
})
