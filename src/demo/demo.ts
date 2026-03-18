import GUI from 'lil-gui'
import { render, type RenderConfig } from '../renderer/canvas-renderer'
import { shapeNames } from '../core/shapes'
import { DEFAULT_NOISE_CONFIG, DEFAULT_BLUR_CONFIG } from '../core/effects'
import { presets, presetNames } from './presets'

// Config object that lil-gui mutates directly
const config = {
  // Shape
  from: 'organic-1',
  to: 'angular-3',
  steps: 8,
  // Colour
  scheme: 'blue',
  // Effects
  variant: 'filled' as 'wireframe' | 'filled' | 'gradient',
  noise: true,
  blur: false,
  noiseOpacity: 0.08,
  blurRadius: 2,
  // Layout
  align: 'right' as 'left' | 'right' | 'top' | 'bottom' | 'center',
  spread: 1.2,
  // Presets
  preset: 'Organic Flow',
}

// Canvas setup
const canvas = document.getElementById('canvas') as HTMLCanvasElement

function renderFromConfig() {
  const renderConfig: RenderConfig = {
    from: config.from as any,
    to: config.to as any,
    steps: config.steps,
    scheme: config.scheme as any,
    variant: config.variant,
    noise: {
      enabled: config.noise,
      opacity: config.noiseOpacity,
      size: DEFAULT_NOISE_CONFIG.size,
    },
    blur: {
      enabled: config.blur,
      radius: config.blurRadius,
    },
    align: config.align,
    spread: config.spread,
  }
  render(canvas, renderConfig)
}

// Resize handling
function handleResize() {
  canvas.style.width = `${window.innerWidth}px`
  canvas.style.height = `${window.innerHeight}px`
  renderFromConfig()
}

window.addEventListener('resize', handleResize)
handleResize()

// lil-gui setup
const gui = new GUI({ title: 'Brand Shape Controls' })

// Presets
gui.add(config, 'preset', presetNames).name('Preset').onChange((name: string) => {
  const preset = presets[name]
  if (!preset) return
  Object.assign(config, preset)
  gui.controllersRecursive().forEach(c => c.updateDisplay())
  renderFromConfig()
})

// Shape folder
const shapeFolder = gui.addFolder('Shape')
shapeFolder.add(config, 'from', shapeNames).name('From').onChange(renderFromConfig)
shapeFolder.add(config, 'to', shapeNames).name('To').onChange(renderFromConfig)
shapeFolder.add(config, 'steps', 5, 15, 1).name('Steps').onChange(renderFromConfig)

// Colour folder
const colourFolder = gui.addFolder('Colour')
colourFolder.add(config, 'scheme', ['lime', 'pink', 'blue', 'vermillion', 'brown']).name('Scheme').onChange(renderFromConfig)

// Effects folder
const effectsFolder = gui.addFolder('Effects')
effectsFolder.add(config, 'variant', ['wireframe', 'filled', 'gradient']).name('Variant').onChange(renderFromConfig)
effectsFolder.add(config, 'noise').name('Noise').onChange(renderFromConfig)
effectsFolder.add(config, 'blur').name('Blur').onChange(renderFromConfig)
effectsFolder.add(config, 'noiseOpacity', 0, 0.5, 0.01).name('Noise Opacity').onChange(renderFromConfig)
effectsFolder.add(config, 'blurRadius', 0, 10, 0.5).name('Blur Radius').onChange(renderFromConfig)

// Layout folder
const layoutFolder = gui.addFolder('Layout')
layoutFolder.add(config, 'align', ['left', 'right', 'top', 'bottom', 'center']).name('Align').onChange(renderFromConfig)
layoutFolder.add(config, 'spread', 0.5, 3, 0.1).name('Spread').onChange(renderFromConfig)
