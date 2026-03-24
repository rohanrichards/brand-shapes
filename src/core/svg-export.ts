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
  /** Original shape viewBox (e.g., [0,0,164,104]) — used for image sizing inside base transform */
  shapeViewBox?: [number, number, number, number]
  /** Base64 PNG of noise grain tile (rasterized to match canvas renderer) */
  noiseImage?: string
  /** Size of the noise tile in pixels */
  noiseTileSize?: number
}

/**
 * Generate noise defs: a repeating pattern tile + a mask combining all shape paths.
 * This matches the canvas renderer's source-atop noise compositing exactly.
 */
function noiseDefs(config: SVGExportConfig): string {
  const tileSize = config.noiseTileSize ?? 256
  const bt = config.baseTransform
  const baseScale = bt?.scale ?? 1
  // Pattern tile size in shape-space units (since it's inside the base transform group)
  const tileSizeShape = tileSize / baseScale

  const patternDef = `<pattern id="noiseTile" x="0" y="0" width="${tileSizeShape}" height="${tileSizeShape}" patternUnits="userSpaceOnUse">
      <image href="${config.noiseImage ?? ''}" width="${tileSizeShape}" height="${tileSizeShape}"/>
    </pattern>`

  return patternDef
}

function wireframeDefs(config: SVGExportConfig): string {
  const stops = buildLinearGradientStops(config.colours.current, config.colours.catalyst, config.colours.future)
  const stopElements = stops.map(s =>
    `<stop offset="${s.offset}" stop-color="${s.color}"/>`
  ).join('\n      ')

  let defs = `<linearGradient id="wireStroke" x1="0" y1="0" x2="1" y2="1">
      ${stopElements}
    </linearGradient>`

  if (config.noise && config.noiseImage) {
    defs += `\n    ${noiseDefs(config)}`
    // Combined clip of all shape paths for the noise overlay
    const allPaths = config.steps.map(s => `<path d="${s.path}"/>`).join('\n        ')
    defs += `\n    <clipPath id="noise-mask">
        ${allPaths}
    </clipPath>`
  }

  return defs
}

function noiseOverlay(config: SVGExportConfig): string {
  if (!config.noise || !config.noiseImage) return ''
  const svb = config.shapeViewBox ?? config.viewBox
  const [, , vw, vh] = svb
  return `\n    <rect x="-50" y="-50" width="${vw + 100}" height="${vh + 100}" fill="url(#noiseTile)" clip-path="url(#noise-mask)"/>`
}

function wireframeBody(config: SVGExportConfig): string {
  const bt = config.baseTransform
  const paths = config.steps.map(step => {
    const sw = step.strokeWidth ?? 1.5
    return `<path d="${step.path}" stroke="url(#wireStroke)" stroke-width="${sw}" fill="none" opacity="${step.opacity}"/>`
  }).join('\n      ')

  const noise = noiseOverlay(config)

  if (bt) {
    return `<g transform="translate(${bt.translateX},${bt.translateY}) scale(${bt.scale})">
      ${paths}${noise}
    </g>`
  }
  return paths + noise
}

function filledGradientDefs(config: SVGExportConfig): string {
  const clipPaths = config.steps.map((step, i) =>
    `<clipPath id="clip-${i}">
      <path d="${step.path}"/>
    </clipPath>`
  ).join('\n    ')

  let defs = clipPaths

  if (config.noise && config.noiseImage) {
    defs += `\n    ${noiseDefs(config)}`
  }

  return defs
}

function filledGradientBody(config: SVGExportConfig): string {
  const bt = config.baseTransform
  // Inside the base transform group, coordinates are in shape space — use shapeViewBox
  const svb = config.shapeViewBox ?? config.viewBox
  const [, , vw, vh] = svb

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
    const hasNoise = config.noise && config.noiseImage
    const noiseRect = hasNoise
      ? `\n        <rect x="-50" y="-50" width="${vw + 100}" height="${vh + 100}" fill="url(#noiseTile)"/>`
      : ''

    return `<g clip-path="url(#clip-${i})" opacity="${step.opacity}"${stepTransform}>
        <image href="${href}" x="-50" y="-50" width="${vw + 100}" height="${vh + 100}"/>${noiseRect}
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

  // Clip shapes to viewport bounds — matches canvas behavior where
  // shapes extending beyond the canvas edge are naturally invisible
  const viewportClip = `<clipPath id="viewport-clip">
      <rect x="${vx}" y="${vy}" width="${vw}" height="${vh}"/>
    </clipPath>`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${vx} ${vy} ${vw} ${vh}">
  <defs>
    ${defs}
    ${viewportClip}
  </defs>${bgRect}
  <g clip-path="url(#viewport-clip)">
    ${body}
  </g>
</svg>`
}
