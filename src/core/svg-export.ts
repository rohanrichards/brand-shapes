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

function filledGradientDefs(config: SVGExportConfig): string {
  const clipPaths = config.steps.map((step, i) =>
    `<clipPath id="clip-${i}">
      <path d="${step.path}"/>
    </clipPath>`
  ).join('\n    ')

  let defs = clipPaths
  if (config.noise) {
    defs += `\n    ${noiseFilterDef()}`
  }

  return defs
}

function filledGradientBody(config: SVGExportConfig): string {
  const [, , vw, vh] = config.viewBox

  return config.steps.map((step, i) => {
    const { scale, offsetX, offsetY } = step.transform
    const [cx, cy] = step.centroid
    const tx = cx + offsetX
    const ty = cy + offsetY

    const transform = scale !== 1 || offsetX !== 0 || offsetY !== 0
      ? ` transform="translate(${tx},${ty}) scale(${scale}) translate(${-cx},${-cy})"`
      : ''

    const href = step.gradientImage ?? ''

    return `<g clip-path="url(#clip-${i})" opacity="${step.opacity}"${transform}>
      <image href="${href}" width="${vw}" height="${vh}"/>
    </g>`
  }).join('\n    ')
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
