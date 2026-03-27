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
  align: Alignment
  spread: number
  noiseOpacity: number
  layerBlurEnabled?: boolean
  layerBlurFrom?: number
  layerBlurTo?: number
  maskBlurEnabled?: boolean
  maskAngle?: number
  maskPosition?: number
  maskHardness?: number
  maskBlurRadius?: number
  scaleFrom: number
  scaleTo: number
  background: string
  gradientAngle?: number
  gradientSpread?: number
  gradientCenterX?: number
  gradientCenterY?: number
}

export const presets: Record<string, PresetConfig> = {
  // --- Gradient combos from Figma colour examples ---
  'Blue Lime Rose': {
    from: 'organic-1', to: 'organic-3', steps: 10,
    colourFrom: '#4B01E6', colourCatalyst: '#BEF958', colourTo: '#FEA6E1',
    variant: 'filled',
    noise: true,
    align: 'right', spread: 1.2,
    noiseOpacity: 0.08, scaleFrom: 1.15, scaleTo: 0.95,
    background: '#EDFFCC',
  },
  'Vermillion Ember': {
    from: 'angular-1', to: 'angular-4', steps: 12,
    colourFrom: '#EE4811', colourCatalyst: '#341405', colourTo: '#FF38C0',
    variant: 'filled',
    noise: true,
    align: 'left', spread: 1.5,
    noiseOpacity: 0.12, scaleFrom: 1.15, scaleTo: 0.95,
    background: '#FFC3F6',
  },
  'Lime Rose Earth': {
    from: 'primitive-2', to: 'organic-4', steps: 8,
    colourFrom: '#BEF958', colourCatalyst: '#FEA6E1', colourTo: '#81330C',
    variant: 'filled',
    noise: true,
    layerBlurEnabled: true, layerBlurFrom: 6, layerBlurTo: 0,
    align: 'center', spread: 1.0,
    noiseOpacity: 0.10, scaleFrom: 1.2, scaleTo: 0.85,
    background: '#4B01E6',
  },
  'Lime Pink Blue': {
    from: 'organic-2', to: 'angular-2', steps: 10,
    colourFrom: '#BEF958', colourCatalyst: '#FFC3F6', colourTo: '#4B01E6',
    variant: 'gradient',
    noise: true,
    align: 'bottom', spread: 1.3,
    noiseOpacity: 0.12, scaleFrom: 1.15, scaleTo: 0.95,
    background: '#BEF958',
  },
  'Vermillion Pink Alt-Lime': {
    from: 'primitive-1', to: 'primitive-4', steps: 8,
    colourFrom: '#EE4811', colourCatalyst: '#FFC3F6', colourTo: '#C2F462',
    variant: 'filled',
    noise: true,
    align: 'right', spread: 1.8,
    noiseOpacity: 0.15, scaleFrom: 1.3, scaleTo: 0.8,
    background: '#EE4811',
  },
  'Brown Pink Blue': {
    from: 'organic-1', to: 'angular-3', steps: 10,
    colourFrom: '#81330C', colourCatalyst: '#FFC3F6', colourTo: '#4B01E6',
    variant: 'filled',
    noise: true,
    align: 'right', spread: 1.2,
    noiseOpacity: 0.08, scaleFrom: 1.15, scaleTo: 0.95,
    background: '#FFC6BF',
  },
  // --- Solid fill combos from Figma shape examples ---
  'Soft Layers': {
    from: 'organic-3', to: 'organic-1', steps: 8,
    colourFrom: '#EDFFCC', colourCatalyst: '#EE4811', colourTo: '#FFC3F6',
    variant: 'filled',
    noise: true,
    align: 'center', spread: 1.0,
    noiseOpacity: 0.08, scaleFrom: 1.15, scaleTo: 0.95,
    background: '#EDFFCC',
  },
  // --- Wireframe on dark ---
  'Wireframe Dark': {
    from: 'organic-1', to: 'angular-3', steps: 12,
    colourFrom: '#BEF958', colourCatalyst: '#FFC3F6', colourTo: '#4B01E6',
    variant: 'wireframe',
    noise: true,
    align: 'center', spread: 1.0,
    noiseOpacity: 0.12, scaleFrom: 1.15, scaleTo: 0.95,
    background: '#000000',
  },
}

export const presetNames = Object.keys(presets)
