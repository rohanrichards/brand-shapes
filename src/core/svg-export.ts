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
  colours: SVGExportColours
  steps: SVGExportStep[]
}

function noiseFilterDef(): string {
  return `<filter id="noise">
      <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" result="noise"/>
      <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise"/>
      <feBlend in="SourceGraphic" in2="grayNoise" mode="overlay"/>
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
    defs += `\n    ${noiseFilterDef()}`
  }

  return defs
}

function wireframeBody(config: SVGExportConfig): string {
  const paths = config.steps.map(step => {
    const sw = step.strokeWidth ?? 1.5
    return `<path d="${step.path}" stroke="url(#wireStroke)" stroke-width="${sw}" fill="none" opacity="${step.opacity}"/>`
  }).join('\n    ')

  return paths
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
      // Implemented in Task 3
      defs = ''
      body = ''
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
