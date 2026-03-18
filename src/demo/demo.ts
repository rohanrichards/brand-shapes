import GUI from 'lil-gui'
import { render, type RenderConfig } from '../renderer/canvas-renderer'
import { shapeNames, getShape } from '../core/shapes'
import { DEFAULT_NOISE_CONFIG } from '../core/effects'
import { createMorphInterpolator, getMorphPoints, smoothPath, type Point } from '../core/morph'
import { displacePoints, DEFAULT_VERTEX_ANIM, type VertexAnimConfig, type PulseState } from '../core/animate'
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
  // Animation
  animMode: 'none' as 'none' | 'trail' | 'breathe',
  duration: 2000,
  // Vertex animation
  breathingAmplitude: DEFAULT_VERTEX_ANIM.breathingAmplitude,
  breathingSpeed: DEFAULT_VERTEX_ANIM.breathingSpeed,
  breathingFrequency: DEFAULT_VERTEX_ANIM.breathingFrequency,
  cursorParallax: 0.03,
  pulseAmplitude: DEFAULT_VERTEX_ANIM.pulseAmplitude,
  pulseInterval: DEFAULT_VERTEX_ANIM.pulseInterval,
  pulseSharpness: DEFAULT_VERTEX_ANIM.pulseSharpness,
  pulseCascadeDelay: DEFAULT_VERTEX_ANIM.pulseCascadeDelay,
  preset: 'Organic Flow',
}

const canvas = document.getElementById('canvas') as HTMLCanvasElement

// --- Render helpers ---

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
  const fromShape = getShape(config.from as any)
  const toShape = getShape(config.to as any)
  const interp = createMorphInterpolator(fromShape.path, toShape.path)
  const totalSteps = config.steps

  const paths: string[] = []
  const indices: number[] = []
  for (let i = 0; i < totalSteps; i++) {
    const t = totalSteps === 1 ? 0 : i / (totalSteps - 1)
    paths.push(interp(t))
    indices.push(i)
  }

  const rc = buildRenderConfig(paths)
  rc.stepIndices = indices
  rc.totalStepCount = totalSteps
  render(canvas, rc)
}

// --- Animation state ---

let animId: number | null = null

function stopAnimation() {
  if (animId != null) {
    cancelAnimationFrame(animId)
    animId = null
  }
}

// --- Trail animation ---

function startTrailAnimation() {
  stopAnimation()
  const ctx = canvas.getContext('2d')
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)

  const fromShape = getShape(config.from as any)
  const toShape = getShape(config.to as any)
  const interp = createMorphInterpolator(fromShape.path, toShape.path)
  const totalSteps = config.steps
  const duration = config.duration
  const startTime = performance.now()

  const stepTs: number[] = []
  for (let i = 0; i < totalSteps; i++) {
    stepTs.push(totalSteps === 1 ? 0 : i / (totalSteps - 1))
  }

  function tick(now: number) {
    const elapsed = Math.max(0, now - startTime)
    const progress = Math.min(elapsed / duration, 1)
    const leadT = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2

    const paths: string[] = []
    const indices: number[] = []
    for (let i = 0; i < totalSteps; i++) {
      if (leadT >= stepTs[i]) {
        paths.push(interp(stepTs[i]))
        indices.push(i)
      }
    }

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
    }
  }

  tick(startTime)
}

// --- Cursor & pulse state ---

let cursorState: { x: number; y: number } | null = null
let pulseState: PulseState | null = null
let breatheStartTime = 0

// Track cursor in shape-local coordinates
// The renderer transforms: translate(tx, ty) then scale(scaleFactor)
// So shape-local = (canvasPos - translate) / scaleFactor
// We compute these from the same viewBox logic as the renderer
function canvasToShapeCoords(canvasX: number, canvasY: number): { x: number; y: number } {
  const fromShape = getShape(config.from as any)
  const vb = fromShape.viewBox.split(' ').map(Number)
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  const scaleX = width / vb[2]
  const scaleY = height / vb[3]
  const scaleFactor = Math.min(scaleX, scaleY) * 0.8
  const tx = (width - vb[2] * scaleFactor) / 2
  const ty = (height - vb[3] * scaleFactor) / 2
  return {
    x: (canvasX - tx) / scaleFactor,
    y: (canvasY - ty) / scaleFactor,
  }
}

canvas.addEventListener('mousemove', (e) => {
  cursorState = canvasToShapeCoords(e.offsetX, e.offsetY)
})

canvas.addEventListener('mouseleave', () => {
  cursorState = null
})

canvas.addEventListener('click', () => {
  const time = (performance.now() - breatheStartTime) / 1000
  pulseState = { triggerTime: time }
})

// --- Breathe animation (vertex displacement) ---

function startBreatheAnimation() {
  stopAnimation()

  const fromShape = getShape(config.from as any)
  const toShape = getShape(config.to as any)
  const totalSteps = config.steps

  const basePointSets: Point[][] = []
  for (let i = 0; i < totalSteps; i++) {
    const t = totalSteps === 1 ? 0 : i / (totalSteps - 1)
    basePointSets.push(getMorphPoints(fromShape.path, toShape.path, t))
  }

  breatheStartTime = performance.now()
  pulseState = null

  function tick(now: number) {
    const time = (now - breatheStartTime) / 1000

    const vertexConfig: VertexAnimConfig = {
      breathingAmplitude: config.breathingAmplitude,
      breathingSpeed: config.breathingSpeed,
      breathingFrequency: config.breathingFrequency,
      pulseAmplitude: config.pulseAmplitude,
      pulseInterval: config.pulseInterval,
      pulseSharpness: config.pulseSharpness,
      pulseCascadeDelay: config.pulseCascadeDelay,
    }

    // Cursor parallax: each layer shifts away from cursor.
    // Inner layers (higher index) shift more, creating depth.
    let cursorOffsetX = 0
    let cursorOffsetY = 0
    if (cursorState) {
      // Direction from shape center to cursor
      const fromShape = getShape(config.from as any)
      const vb = fromShape.viewBox.split(' ').map(Number)
      const shapeCX = vb[2] / 2
      const shapeCY = vb[3] / 2
      // Vector from center toward cursor (in shape units)
      cursorOffsetX = (cursorState.x - shapeCX) * config.cursorParallax
      cursorOffsetY = (cursorState.y - shapeCY) * config.cursorParallax
    }

    const paths: string[] = []
    const indices: number[] = []
    for (let i = 0; i < totalSteps; i++) {
      const displaced = displacePoints(
        basePointSets[i], time, vertexConfig, i, pulseState,
      )

      // Apply cursor parallax: shift each layer proportionally to its depth
      const layerDepth = totalSteps === 1 ? 0 : i / (totalSteps - 1)
      const shifted = displaced.map(([x, y]) => [
        x - cursorOffsetX * layerDepth,
        y - cursorOffsetY * layerDepth,
      ] as [number, number])

      paths.push(smoothPath(shifted))
      indices.push(i)
    }

    const rc = buildRenderConfig(paths)
    rc.stepIndices = indices
    rc.totalStepCount = totalSteps

    render(canvas, rc)

    animId = requestAnimationFrame(tick)
  }

  tick(performance.now())
}

// --- Mode switching ---

function startCurrentMode() {
  stopAnimation()
  switch (config.animMode) {
    case 'trail': startTrailAnimation(); break
    case 'breathe': startBreatheAnimation(); break
    default: renderStatic(); break
  }
}

// --- Resize ---

function handleResize() {
  canvas.style.width = `${window.innerWidth}px`
  canvas.style.height = `${window.innerHeight}px`
  if (!animId) startCurrentMode()
}

window.addEventListener('resize', handleResize)
handleResize()

// --- lil-gui ---

const gui = new GUI({ title: 'Brand Shape Controls' })

function onConfigChange() {
  startCurrentMode()
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
colourFolder.add(config, 'scheme', ['lime', 'pink', 'blue', 'vermillion', 'brown']).name('Scheme').onChange(onConfigChange)

const effectsFolder = gui.addFolder('Effects')
effectsFolder.add(config, 'variant', ['wireframe', 'filled', 'gradient']).name('Variant').onChange(onConfigChange)
effectsFolder.add(config, 'noise').name('Noise').onChange(onConfigChange)
effectsFolder.add(config, 'blur').name('Blur').onChange(onConfigChange)
effectsFolder.add(config, 'noiseOpacity', 0, 0.5, 0.01).name('Noise Opacity').onChange(onConfigChange)
effectsFolder.add(config, 'blurRadius', 0, 10, 0.5).name('Blur Radius').onChange(onConfigChange)

const layoutFolder = gui.addFolder('Layout')
layoutFolder.add(config, 'align', ['left', 'right', 'top', 'bottom', 'center']).name('Align').onChange(onConfigChange)
layoutFolder.add(config, 'spread', 0, 10, 0.1).name('Spread').onChange(onConfigChange)
layoutFolder.add(config, 'scaleFrom', 0.5, 2.0, 0.05).name('Scale From').onChange(onConfigChange)
layoutFolder.add(config, 'scaleTo', 0.5, 2.0, 0.05).name('Scale To').onChange(onConfigChange)

const animFolder = gui.addFolder('Animation')
animFolder.add(config, 'animMode', ['none', 'trail', 'breathe']).name('Mode').onChange(onConfigChange)
animFolder.add(config, 'duration', 500, 5000, 100).name('Trail Duration')
animFolder.add({ replay: () => { if (config.animMode === 'trail') startTrailAnimation() } }, 'replay').name('Replay Trail')

const breatheFolder = gui.addFolder('Breathe')
breatheFolder.add(config, 'breathingAmplitude', 0, 5, 0.1).name('Breathing Amp')
breatheFolder.add(config, 'breathingSpeed', 0.1, 2, 0.05).name('Breathing Speed')
breatheFolder.add(config, 'breathingFrequency', 0.01, 0.3, 0.01).name('Breathing Freq')
breatheFolder.add(config, 'cursorParallax', 0, 0.15, 0.005).name('Cursor Parallax')
breatheFolder.add(config, 'pulseAmplitude', 0, 15, 0.5).name('Pulse Amp')
breatheFolder.add(config, 'pulseInterval', 1, 10, 0.5).name('Pulse Interval')
breatheFolder.add(config, 'pulseSharpness', 2, 30, 1).name('Pulse Sharpness')
breatheFolder.add(config, 'pulseCascadeDelay', 0, 0.3, 0.01).name('Cascade Delay')
