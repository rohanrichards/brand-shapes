// src/core/svg-export.ts
import { buildLinearGradientStops } from './effects'

export interface SVGExportColours {
  current: string
  catalyst: string
  future: string
}

export interface SVGExportStep {
  path: string
  centroid: [number, number]
  transform: {
    scale: number
    offsetX: number
    offsetY: number
  }
  opacity: number
  strokeWidth?: number
  gradientImage?: string
}

export interface SVGExportConfig {
  width: number
  height: number
  viewBox: [number, number, number, number]
  background: string
  variant: 'wireframe' | 'filled' | 'gradient'
  noise: boolean
  noiseOpacity: number
  colours: SVGExportColours
  steps: SVGExportStep[]
  /** Base transform matching the canvas renderer's viewBox→screen mapping */
  baseTransform?: { translateX: number; translateY: number; scale: number }
}

function noiseFilterDef(opacity: number): string {
  // Fine film grain, masked to shapes only:
  // - High baseFrequency (1.5) = fine grain like per-pixel noise, not blobby Perlin
  // - numOctaves 4 = extra detail at small scale
  // - Desaturate to grayscale
  // - Reduce opacity via feColorMatrix so it's subtle (matching canvas 8% opacity)
  // - feComposite 'in' clips noise to source alpha (source-atop equivalent)
  // - Soft-light blend is gentler than overlay — no harsh white specks
  return `<filter id="noise" x="0%" y="0%" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="1.5" numOctaves="4" seed="0" result="noise"/>
      <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise"/>
      <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${opacity} 0" in="grayNoise" result="fadedNoise"/>
      <feComposite operator="in" in="fadedNoise" in2="SourceGraphic" result="maskedNoise"/>
      <feBlend in="SourceGraphic" in2="maskedNoise" mode="soft-light"/>
    </filter>`
}

function wireframeDefs(config: SVGExportConfig): string {
  const stops = buildLinearGradientStops(config.colours.current, config.colours.catalyst, config.colours.future)
  const stopElements = stops.map(s =>
    `<stop offset="${s.offset}" stop-color="${s.color}"/>`
  ).join('\n      ')

  let defs = `<linearGradient id="wireStroke" x1="0" y1="0" x2="1" y2="1">
      ${stopElements}
    </linearGradient>`

  if (config.noise) {
    defs += `\n    ${noiseFilterDef(config.noiseOpacity)}`
  }

  return defs
}

function wireframeBody(config: SVGExportConfig): string {
  const bt = config.baseTransform
  const paths = config.steps.map(step => {
    const sw = step.strokeWidth ?? 1.5
    return `<path d="${step.path}" stroke="url(#wireStroke)" stroke-width="${sw}" fill="none" opacity="${step.opacity}"/>`
  }).join('\n      ')

  if (bt) {
    return `<g transform="translate(${bt.translateX},${bt.translateY}) scale(${bt.scale})">
      ${paths}
    </g>`
  }
  return paths
}

function filledGradientDefs(config: SVGExportConfig): string {
  const clipPaths = config.steps.map((step, i) =>
    `<clipPath id="clip-${i}">
      <path d="${step.path}"/>
    </clipPath>`
  ).join('\n    ')

  let defs = clipPaths
  if (config.noise) {
    defs += `\n    ${noiseFilterDef(config.noiseOpacity)}`
  }

  return defs
}

function filledGradientBody(config: SVGExportConfig): string {
  const bt = config.baseTransform
  // Image dimensions should cover the shape viewBox area
  // We need the original shape viewBox width/height for the image sizing
  // The gradient image covers the shape coordinate space
  const imgW = bt ? config.width / bt.scale : config.viewBox[2]
  const imgH = bt ? config.height / bt.scale : config.viewBox[3]

  const layers = config.steps.map((step, i) => {
    const { scale, offsetX, offsetY } = step.transform
    const [cx, cy] = step.centroid
    const tx = cx + offsetX
    const ty = cy + offsetY

    const stepTransform = scale !== 1 || offsetX !== 0 || offsetY !== 0
      ? ` transform="translate(${tx},${ty}) scale(${scale}) translate(${-cx},${-cy})"`
      : ''

    const href = step.gradientImage ?? ''

    return `<g clip-path="url(#clip-${i})" opacity="${step.opacity}"${stepTransform}>
        <image href="${href}" x="-50" y="-50" width="${imgW + 100}" height="${imgH + 100}"/>
      </g>`
  }).join('\n      ')

  if (bt) {
    return `<g transform="translate(${bt.translateX},${bt.translateY}) scale(${bt.scale})">
      ${layers}
    </g>`
  }
  return layers
}

export function generateSVG(config: SVGExportConfig): string {
  const { width, height, viewBox, background } = config
  const [vx, vy, vw, vh] = viewBox

  let defs = ''
  let body = ''

  switch (config.variant) {
    case 'wireframe':
      defs = wireframeDefs(config)
      body = wireframeBody(config)
      break
    case 'filled':
    case 'gradient':
      defs = filledGradientDefs(config)
      body = filledGradientBody(config)
      break
  }

  const bgRect = background && background !== 'transparent'
    ? `\n  <rect width="100%" height="100%" fill="${background}"/>`
    : ''

  const filterAttr = config.noise ? ' filter="url(#noise)"' : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${vx} ${vy} ${vw} ${vh}">
  <defs>
    ${defs}
  </defs>${bgRect}
  <g${filterAttr}>
    ${body}
  </g>
</svg>`
}
