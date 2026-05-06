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
    expect(svg).not.toContain('fill="#000000"')
    expect(svg).not.toContain('width="100%" height="100%" fill=')
  })

  it('includes rasterized noise pattern when enabled with noiseImage', () => {
    const svg = generateSVG(makeWireframeConfig({ noise: true, noiseImage: 'data:image/png;base64,fakeNoise', noiseTileSize: 256 }))
    expect(svg).toContain('<pattern id="noiseTile"')
    expect(svg).toContain('href="data:image/png;base64,fakeNoise"')
    expect(svg).toContain('clip-path="url(#noise-mask)"')
    expect(svg).toContain('fill="url(#noiseTile)"')
  })

  it('omits noise when disabled', () => {
    const svg = generateSVG(makeWireframeConfig({ noise: false }))
    expect(svg).not.toContain('noiseTile')
    expect(svg).not.toContain('noise-mask')
  })

  it('omits noise when enabled but no noiseImage provided', () => {
    const svg = generateSVG(makeWireframeConfig({ noise: true }))
    expect(svg).not.toContain('noiseTile')
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

describe('generateSVG — logo overlay', () => {
  it('omits logo block when config.logo is undefined', () => {
    const svg = generateSVG(makeWireframeConfig())
    expect(svg).not.toContain('M240 4.20461') // slash signature
    expect(svg).not.toContain('#181818')
    expect(svg).not.toContain('#FCFCFC')
  })

  it('includes black logo paths and fill when color=black', () => {
    const svg = generateSVG(makeWireframeConfig({
      width: 1920, height: 1080,
      logo: { color: 'black' },
    }))
    expect(svg).toContain('M240 4.20461')  // slash signature
    expect(svg).toContain('M0 0.996613')    // body signature
    expect(svg).toContain('fill="#181818"')
    expect(svg).toContain('fill-rule="evenodd"')
  })

  it('uses white fill when color=white', () => {
    const svg = generateSVG(makeWireframeConfig({
      width: 1920, height: 1080,
      logo: { color: 'white' },
    }))
    expect(svg).toContain('fill="#FCFCFC"')
    expect(svg).not.toContain('fill="#181818"')
  })

  it('places logo at bottom-left with template-spec transform at 1920x1080', () => {
    const svg = generateSVG(makeWireframeConfig({
      width: 1920, height: 1080,
      logo: { color: 'black' },
    }))
    // scale=1 -> x=48, y=1080-48-88=944. Logo viewBox 240x213 -> sx=100/240≈0.4167, sy=88/213≈0.4131
    expect(svg).toMatch(/translate\(48,\s*944\)/)
    expect(svg).toContain('scale(0.41666')
  })

  it('scales placement proportionally for 4K (3840x2160)', () => {
    const svg = generateSVG(makeWireframeConfig({
      width: 3840, height: 2160,
      logo: { color: 'black' },
    }))
    // scale=2 -> x=96, y=2160-96-176=1888
    expect(svg).toMatch(/translate\(96,\s*1888\)/)
  })

  it('emits logo after the viewport-clipped shape group (so logo is not clipped)', () => {
    const svg = generateSVG(makeWireframeConfig({
      width: 1920, height: 1080,
      logo: { color: 'black' },
    }))
    const clipGroupClose = svg.indexOf('</g>')
    const logoIdx = svg.indexOf('M240 4.20461')
    expect(logoIdx).toBeGreaterThan(clipGroupClose)
  })
})
