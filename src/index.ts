export { shapes, getShape, shapeNames } from './core/shapes'
export type { ShapeCategory, ShapeName, ShapeDefinition } from './core/shapes'

export { resolveColour, resolveScheme, resolveTextPairing } from './core/colours'
export type { ColourFamily, ColourToken, GradientColours } from './core/colours'

export { generateMorphSteps, MIN_STEPS, MAX_STEPS } from './core/morph'
export type { MorphResult } from './core/morph'

export {
  lerpColour,
  generateStepFills,
  buildConicGradientConfig,
  buildLinearGradientStops,
  DEFAULT_NOISE_CONFIG,
  DEFAULT_BLUR_CONFIG,
} from './core/effects'
export type { ConicGradientConfig, GradientStop, NoiseConfig, BlurConfig } from './core/effects'
