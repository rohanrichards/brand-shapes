import type { ShapeName } from '../core/shapes'
import type { Variant, Alignment } from '../renderer/canvas-renderer'

export interface PresetConfig {
  from: ShapeName
  to: ShapeName
  steps: number
  colourFrom: string
  colourCatalyst: string
  colourTo: string
  variant: Variant
  noise: boolean
  blur: boolean
  align: Alignment
  spread: number
  noiseOpacity: number
  blurRadius: number
  scaleFrom: number
  scaleTo: number
  background: string
}

export const presets: Record<string, PresetConfig> = {
  'Organic Flow': {
    from: 'organic-1', to: 'organic-3', steps: 10,
    colourFrom: '#4B01E6', colourCatalyst: '#BEF958', colourTo: '#FEA6E1',
    variant: 'filled',
    noise: true, blur: false,
    align: 'right', spread: 1.2,
    noiseOpacity: 0.08, blurRadius: 2, scaleFrom: 1.15, scaleTo: 0.95,
    background: '#000000',
  },
  'Angular Edge': {
    from: 'angular-1', to: 'angular-4', steps: 12,
    colourFrom: '#EE4811', colourCatalyst: '#341405', colourTo: '#FF38C0',
    variant: 'filled',
    noise: false, blur: false,
    align: 'left', spread: 1.5,
    noiseOpacity: 0.12, blurRadius: 2, scaleFrom: 1.15, scaleTo: 0.95,
    background: '#000000',
  },
  'Chromatic Burst': {
    from: 'primitive-2', to: 'organic-4', steps: 8,
    colourFrom: '#BEF958', colourCatalyst: '#FEA6E1', colourTo: '#81330C',
    variant: 'filled',
    noise: true, blur: true,
    align: 'center', spread: 1.0,
    noiseOpacity: 0.10, blurRadius: 3, scaleFrom: 1.2, scaleTo: 0.85,
    background: '#000000',
  },
  'Vermillion Heat': {
    from: 'organic-2', to: 'angular-2', steps: 10,
    colourFrom: '#BEF958', colourCatalyst: '#FFC3F6', colourTo: '#4B01E6',
    variant: 'gradient',
    noise: true, blur: false,
    align: 'bottom', spread: 1.3,
    noiseOpacity: 0.12, blurRadius: 2, scaleFrom: 1.15, scaleTo: 0.95,
    background: '#000000',
  },
  'Earth Tone': {
    from: 'primitive-1', to: 'primitive-4', steps: 8,
    colourFrom: '#EE4811', colourCatalyst: '#FFC3F6', colourTo: '#C2F462',
    variant: 'filled',
    noise: true, blur: false,
    align: 'right', spread: 1.8,
    noiseOpacity: 0.15, blurRadius: 2, scaleFrom: 1.3, scaleTo: 0.8,
    background: '#000000',
  },
  'Wireframe Study': {
    from: 'organic-1', to: 'angular-3', steps: 12,
    colourFrom: '#81330C', colourCatalyst: '#FFC3F6', colourTo: '#4B01E6',
    variant: 'wireframe',
    noise: false, blur: false,
    align: 'center', spread: 1.0,
    noiseOpacity: 0.12, blurRadius: 2, scaleFrom: 1.15, scaleTo: 0.95,
    background: '#000000',
  },
}

export const presetNames = Object.keys(presets)
