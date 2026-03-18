import GUI from 'lil-gui'
import { render, type RenderConfig } from '../renderer/canvas-renderer'
import { shapeNames, getShape } from '../core/shapes'
import { DEFAULT_NOISE_CONFIG } from '../core/effects'
import { createMorphInterpolator } from '../core/morph'
import { presets, presetNames } from './presets'

const config = {
  from: 'organic-1',
  to: 'angular-3',
  steps: 8,
  scheme: 'blue',
  variant: 'filled' as 'wireframe' | 'filled' | 'gradient',
  noise: true,
  blur: false,
  noiseOpacity: 0.08,
  blurRadius: 2,
  align: 'right' as 'left' | 'right' | 'top' | 'bottom' | 'center',
  spread: 1.2,
  scaleFrom: 1.15,
  scaleTo: 0.95,
  animate: false,
  duration: 2000,
  preset: 'Organic Flow',
}

const canvas = document.getElementById('canvas') as HTMLCanvasElement

// --- Static render ---

function buildRenderConfig(customSteps?: string[]): RenderConfig {
  return {
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
    scaleFrom: config.scaleFrom,
    scaleTo: config.scaleTo,
    customSteps: customSteps,
  }
}

function renderStatic() {
  render(canvas, buildRenderConfig())
}

// --- Morph trail animation ---
// A lead shape morphs from A→B continuously.
// At evenly spaced intervals it deposits a frozen snapshot.
// Each frame renders: frozen layers + the moving lead shape.

let animId: number | null = null

function stopAnimation() {
  if (animId != null) {
    cancelAnimationFrame(animId)
    animId = null
  }
}

function startAnimation() {
  stopAnimation()

  // Clear immediately to prevent flash of previous static render
  const ctx = canvas.getContext('2d')
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)

  const fromShape = getShape(config.from as any)
  const toShape = getShape(config.to as any)
  const interp = createMorphInterpolator(fromShape.path, toShape.path)
  const totalSteps = config.steps
  const duration = config.duration
  const startTime = performance.now()

  // Pre-compute the t value for each step
  const stepTs: number[] = []
  for (let i = 0; i < totalSteps; i++) {
    stepTs.push(totalSteps === 1 ? 0 : i / (totalSteps - 1))
  }

  function tick(now: number) {
    const elapsed = now - startTime
    const progress = Math.min(elapsed / duration, 1)

    // Ease: cubic ease-in-out
    const leadT = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2

    // Deposit steps that the lead has passed — a step deposits
    // the instant the lead reaches or passes its t position
    const paths: string[] = []
    const indices: number[] = []
    for (let i = 0; i < totalSteps; i++) {
      if (leadT >= stepTs[i]) {
        paths.push(interp(stepTs[i]))
        indices.push(i)
      }
    }

    // Add the lead shape at its current position (ahead of or at last deposit)
    const lastDepositedT = paths.length > 0 ? stepTs[paths.length - 1] : 0
    if (leadT > lastDepositedT && progress < 1) {
      paths.push(interp(leadT))
      indices.push(leadT * (totalSteps - 1))
    }

    const rc = buildRenderConfig(paths)
    rc.stepIndices = indices
    rc.totalStepCount = totalSteps
    render(canvas, rc)

    if (progress < 1) {
      animId = requestAnimationFrame(tick)
    } else {
      animId = null
      renderStatic()
    }
  }

  // Render first frame synchronously to avoid one-frame pop of static render
  tick(startTime)
}

// --- Resize ---

function handleResize() {
  canvas.style.width = `${window.innerWidth}px`
  canvas.style.height = `${window.innerHeight}px`
  if (!animId) renderStatic()
}

window.addEventListener('resize', handleResize)
handleResize()

// --- lil-gui ---

const gui = new GUI({ title: 'Brand Shape Controls' })

function onConfigChange() {
  if (config.animate) startAnimation()
  else renderStatic()
}

gui.add(config, 'preset', presetNames).name('Preset').onChange((name: string) => {
  const preset = presets[name]
  if (!preset) return
  Object.assign(config, preset)
  gui.controllersRecursive().forEach(c => c.updateDisplay())
  onConfigChange()
})

const shapeFolder = gui.addFolder('Shape')
shapeFolder.add(config, 'from', shapeNames).name('From').onChange(onConfigChange)
shapeFolder.add(config, 'to', shapeNames).name('To').onChange(onConfigChange)
shapeFolder.add(config, 'steps', 5, 15, 1).name('Steps').onChange(onConfigChange)

const colourFolder = gui.addFolder('Colour')
colourFolder.add(config, 'scheme', ['lime', 'pink', 'blue', 'vermillion', 'brown']).name('Scheme').onChange(renderStatic)

const effectsFolder = gui.addFolder('Effects')
effectsFolder.add(config, 'variant', ['wireframe', 'filled', 'gradient']).name('Variant').onChange(renderStatic)
effectsFolder.add(config, 'noise').name('Noise').onChange(renderStatic)
effectsFolder.add(config, 'blur').name('Blur').onChange(renderStatic)
effectsFolder.add(config, 'noiseOpacity', 0, 0.5, 0.01).name('Noise Opacity').onChange(renderStatic)
effectsFolder.add(config, 'blurRadius', 0, 10, 0.5).name('Blur Radius').onChange(renderStatic)

const layoutFolder = gui.addFolder('Layout')
layoutFolder.add(config, 'align', ['left', 'right', 'top', 'bottom', 'center']).name('Align').onChange(renderStatic)
layoutFolder.add(config, 'spread', 0, 10, 0.1).name('Spread').onChange(renderStatic)
layoutFolder.add(config, 'scaleFrom', 0.5, 2.0, 0.05).name('Scale From').onChange(renderStatic)
layoutFolder.add(config, 'scaleTo', 0.5, 2.0, 0.05).name('Scale To').onChange(renderStatic)

const animFolder = gui.addFolder('Animation')
animFolder.add(config, 'animate').name('Animate').onChange((on: boolean) => {
  if (on) startAnimation()
  else { stopAnimation(); renderStatic() }
})
animFolder.add(config, 'duration', 500, 5000, 100).name('Duration (ms)')
animFolder.add({ replay: () => startAnimation() }, 'replay').name('Replay')
