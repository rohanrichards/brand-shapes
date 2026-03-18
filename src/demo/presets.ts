import type { ShapeName } from '../core/shapes'
import type { ColourFamily } from '../core/colours'
import type { Variant, Alignment } from '../renderer/canvas-renderer'

export interface PresetConfig {
  from: ShapeName
  to: ShapeName
  steps: number
  scheme: ColourFamily
  variant: Variant
  noise: boolean
  blur: boolean
  align: Alignment
  spread: number
  noiseOpacity: number
  blurRadius: number
}

export const presets: Record<string, PresetConfig> = {
  'Organic Flow': {
    from: 'organic-1', to: 'organic-3', steps: 10,
    scheme: 'blue', variant: 'filled',
    noise: true, blur: false,
    align: 'right', spread: 1.2,
    noiseOpacity: 0.08, blurRadius: 2,
  },
  'Angular Edge': {
    from: 'angular-1', to: 'angular-4', steps: 12,
    scheme: 'lime', variant: 'filled',
    noise: false, blur: false,
    align: 'left', spread: 1.5,
    noiseOpacity: 0.12, blurRadius: 2,
  },
  'Chromatic Burst': {
    from: 'primitive-2', to: 'organic-4', steps: 8,
    scheme: 'pink', variant: 'filled',
    noise: true, blur: true,
    align: 'center', spread: 1.0,
    noiseOpacity: 0.10, blurRadius: 3,
  },
  'Vermillion Heat': {
    from: 'organic-2', to: 'angular-2', steps: 10,
    scheme: 'vermillion', variant: 'gradient',
    noise: true, blur: false,
    align: 'bottom', spread: 1.3,
    noiseOpacity: 0.12, blurRadius: 2,
  },
  'Earth Tone': {
    from: 'primitive-1', to: 'primitive-4', steps: 8,
    scheme: 'brown', variant: 'filled',
    noise: true, blur: false,
    align: 'right', spread: 1.8,
    noiseOpacity: 0.15, blurRadius: 2,
  },
  'Wireframe Study': {
    from: 'organic-1', to: 'angular-3', steps: 12,
    scheme: 'lime', variant: 'wireframe',
    noise: false, blur: false,
    align: 'center', spread: 1.0,
    noiseOpacity: 0.12, blurRadius: 2,
  },
}

export const presetNames = Object.keys(presets)
