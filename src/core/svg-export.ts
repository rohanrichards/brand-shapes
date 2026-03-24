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
  const [, , vw, vh] = config.viewBox

  // The canvas renderer's per-layer transform (inside the base translate+scale):
  //   translate(shapeCenterCanvasX + offsetX, shapeCenterCanvasY + offsetY)
  //   scale(stepScale)
  //   translate(-shapeCenterCanvasX, -shapeCenterCanvasY)
  //
  // But shapeCenterCanvasX = tx + cx * baseScale, which is in screen space.
  // Inside the SVG base-transform group we're already in shape space,
  // so the per-layer transform simplifies to:
  //   translate(cx + offsetX/baseScale, cy + offsetY/baseScale)
  //   scale(stepScale)
  //   translate(-cx, -cy)
  //
  // The offsets must be divided by baseScale because computeStepTransform
  // returns pixel-space offsets, but we're working in shape-space coordinates.

  const baseScale = bt?.scale ?? 1

  const layers = config.steps.map((step, i) => {
    const { scale: stepScale, offsetX, offsetY } = step.transform
    const [cx, cy] = step.centroid

    // Convert pixel-space offsets to shape-space
    const shapeOffsetX = offsetX / baseScale
    const shapeOffsetY = offsetY / baseScale

    const tx = cx + shapeOffsetX
    const ty = cy + shapeOffsetY

    const needsTransform = stepScale !== 1 || shapeOffsetX !== 0 || shapeOffsetY !== 0
    const stepTransform = needsTransform
      ? ` transform="translate(${tx},${ty}) scale(${stepScale}) translate(${-cx},${-cy})"`
      : ''

    const href = step.gradientImage ?? ''

    return `<g clip-path="url(#clip-${i})" opacity="${step.opacity}"${stepTransform}>
        <image href="${href}" x="-50" y="-50" width="${vw + 100}" height="${vh + 100}"/>
      </g>`
  }).join('\n    ')

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
