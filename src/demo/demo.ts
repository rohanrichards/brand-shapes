import GUI from 'lil-gui'
import { render, type RenderConfig } from '../renderer/canvas-renderer'
import { shapeNames, getShape } from '../core/shapes'
import { DEFAULT_NOISE_CONFIG, buildLinearGradientStops } from '../core/effects'
import { generateSVG, type SVGExportConfig, type SVGExportStep } from '../core/svg-export'
import { pathCentroid, computeStepTransform } from '../core/transforms'
import { rasterizeConicGradient, rasterizeNoiseTile } from './gradient-rasterizer'
import { getMorphPoints, generateMorphSteps, smoothPath, type Point } from '../core/morph'
import { displacePoints, displacePointsAudio, DEFAULT_VERTEX_ANIM, type VertexAnimConfig, type PulseState } from '../core/animate'
import {
  createBandBinRanges, extractBandLevels, normalizeLevels, smoothLevels,
  interpolateToLayers, createNormalizationHistory,
} from '../core/audio-analyser'
import {
  setupMicInput, setupSystemAudioInput, setupFileInput, setupMeyda,
  type AudioSourceHandle, type MeydaHandle,
} from './audio-source'
import { presets, presetNames } from './presets'
import { allColourHexes, allColourOptions } from '../core/colours'

const config = {
  from: 'organic-1',
  to: 'angular-3',
  steps: 8,
  colourFrom: '#4B01E6',
  colourCatalyst: '#BEF958',
  colourTo: '#FEA6E1',
  background: '#000000',
  variant: 'filled' as 'wireframe' | 'filled' | 'gradient',
  noise: true,
  noiseOpacity: 0.08,
  // Blur controls
  layerBlurEnabled: false,
  layerBlurFrom: 0,
  layerBlurTo: 0,
  maskBlurEnabled: false,
  maskAngle: 0,
  maskPosition: 0.5,
  maskHardness: 0.5,
  maskBlurRadius: 10,
  align: 'right' as 'left' | 'right' | 'top' | 'bottom' | 'center',
  spread: 1.2,
  scaleFrom: 1.15,
  scaleTo: 0.95,
  // Gradient controls
  gradientAngle: 90,
  gradientSpread: 120,
  gradientCenterX: 0,
  gradientCenterY: 0,
  // Animation
  animMode: 'none' as 'none' | 'trail' | 'breathe' | 'audio',
  duration: 2000,
  // Vertex animation
  breathingAmplitude: DEFAULT_VERTEX_ANIM.breathingAmplitude,
  breathingSpeed: DEFAULT_VERTEX_ANIM.breathingSpeed,
  breathingFrequency: DEFAULT_VERTEX_ANIM.breathingFrequency,
  cursorParallaxEnabled: false,
  cursorParallaxIntensity: 0.03,
  pulseAmplitude: DEFAULT_VERTEX_ANIM.pulseAmplitude,
  pulseInterval: DEFAULT_VERTEX_ANIM.pulseInterval,
  pulseSharpness: DEFAULT_VERTEX_ANIM.pulseSharpness,
  pulseCascadeDelay: DEFAULT_VERTEX_ANIM.pulseCascadeDelay,
  // Audio
  audioSource: 'none' as 'none' | 'mic' | 'system' | 'file',
  audioSensitivity: 1.0,
  preset: 'Organic Flow',
}

const locks = {
  from: false,
  to: false,
  steps: false,
  colourFrom: false,
  colourCatalyst: false,
  colourTo: false,
  background: false,
  variant: false,
  align: false,
  spread: false,
  scaleFrom: false,
  scaleTo: false,
  gradientAngle: false,
  gradientSpread: false,
  gradientCenterX: false,
  gradientCenterY: false,
}

const canvas = document.getElementById('canvas') as HTMLCanvasElement

// --- Render helpers ---

function buildRenderConfig(customSteps?: string[]): RenderConfig {
  return {
    from: config.from as any,
    to: config.to as any,
    steps: config.steps,
    colours: {
      current: config.colourFrom,
      catalyst: config.colourTo,
      future: config.colourCatalyst,
    },
    background: config.background,
    variant: config.variant,
    noise: {
      enabled: config.noise,
      opacity: config.noiseOpacity,
      size: DEFAULT_NOISE_CONFIG.size,
    },
    blur: {
      layerBlurFrom: config.layerBlurEnabled ? config.layerBlurFrom : 0,
      layerBlurTo: config.layerBlurEnabled ? config.layerBlurTo : 0,
      maskEnabled: config.maskBlurEnabled,
      maskAngle: config.maskAngle,
      maskPosition: config.maskPosition,
      maskHardness: config.maskHardness,
      maskBlurRadius: config.maskBlurRadius,
    },
    align: config.align,
    spread: config.spread,
    scaleFrom: config.scaleFrom,
    scaleTo: config.scaleTo,
    gradientAngle: config.gradientAngle,
    gradientSpread: config.gradientSpread,
    gradientCenterX: config.gradientCenterX,
    gradientCenterY: config.gradientCenterY,
    customSteps: customSteps,
  }
}

// --- Animation state ---

let animId: number | null = null

function stopAnimation() {
  if (animId != null) {
    cancelAnimationFrame(animId)
    animId = null
  }
}

// --- Cursor parallax helpers ---

function getCursorParallaxOffset(): { x: number; y: number } {
  if (!config.cursorParallaxEnabled || !cursorState) return { x: 0, y: 0 }
  const fromShape = getShape(config.from as any)
  const vb = fromShape.viewBox.split(' ').map(Number)
  return {
    x: (cursorState.x - vb[2] / 2) * config.cursorParallaxIntensity,
    y: (cursorState.y - vb[3] / 2) * config.cursorParallaxIntensity,
  }
}

function applyParallaxToLayers(layerPoints: Point[][], indices: number[]): string[] {
  const offset = getCursorParallaxOffset()
  const totalLayers = layerPoints.length
  return layerPoints.map((pts, i) => {
    if (offset.x === 0 && offset.y === 0) return smoothPath(pts)
    const depth = totalLayers === 1 ? 0 : i / (totalLayers - 1)
    const shifted = pts.map(([x, y]) => [
      x - offset.x * depth,
      y - offset.y * depth,
    ] as Point)
    return smoothPath(shifted)
  })
}

function renderLayerPoints(layerPoints: Point[][], indices: number[]) {
  const paths = applyParallaxToLayers(layerPoints, indices)
  const rc = buildRenderConfig(paths)
  rc.stepIndices = indices
  rc.totalStepCount = config.steps
  const dpr = window.devicePixelRatio || 1
  render(canvas, rc, {
    width: canvas.clientWidth,
    height: canvas.clientHeight,
    dpr,
  })
}

// --- Static render ---

function renderStatic() {
  const fromShape = getShape(config.from as any)
  const toShape = getShape(config.to as any)
  const totalSteps = config.steps

  const basePoints: Point[][] = []
  const indices: number[] = []
  for (let i = 0; i < totalSteps; i++) {
    const t = totalSteps === 1 ? 0 : i / (totalSteps - 1)
    basePoints.push(getMorphPoints(fromShape.path, toShape.path, t))
    indices.push(i)
  }

  renderLayerPoints(basePoints, indices)

  if (config.cursorParallaxEnabled) {
    function tick() {
      renderLayerPoints(basePoints, indices)
      animId = requestAnimationFrame(tick)
    }
    animId = requestAnimationFrame(tick)
  }
}

// --- Trail animation ---

function startTrailAnimation() {
  stopAnimation()
  const ctx = canvas.getContext('2d')
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)

  const fromShape = getShape(config.from as any)
  const toShape = getShape(config.to as any)
  const totalSteps = config.steps
  const duration = config.duration
  const startTime = performance.now()

  const stepTs: number[] = []
  const stepPoints: Point[][] = []
  for (let i = 0; i < totalSteps; i++) {
    const t = totalSteps === 1 ? 0 : i / (totalSteps - 1)
    stepTs.push(t)
    stepPoints.push(getMorphPoints(fromShape.path, toShape.path, t))
  }

  function tick(now: number) {
    const elapsed = Math.max(0, now - startTime)
    const progress = Math.min(elapsed / duration, 1)
    const leadT = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2

    const points: Point[][] = []
    const indices: number[] = []
    for (let i = 0; i < totalSteps; i++) {
      if (leadT >= stepTs[i]) {
        points.push(stepPoints[i])
        indices.push(i)
      }
    }

    const lastDepositedT = points.length > 0 ? stepTs[points.length - 1] : 0
    if (leadT > lastDepositedT && progress < 1) {
      points.push(getMorphPoints(fromShape.path, toShape.path, leadT))
      indices.push(leadT * (totalSteps - 1))
    }

    renderLayerPoints(points, indices)

    if (progress < 1 || config.cursorParallaxEnabled) {
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

// --- Audio state ---
let audioCtx: AudioContext | null = null
let audioSourceHandle: AudioSourceHandle | null = null
let meydaHandle: MeydaHandle | null = null
let prevLayerIntensities: number[] = []
let normHistory = createNormalizationHistory()
let frequencyData: Float32Array<ArrayBuffer> | null = null
let audioSourceController: ReturnType<typeof GUI.prototype.add> | null = null

async function switchAudioSource(source: string) {
  // Clean up previous source
  if (audioSourceHandle) {
    audioSourceHandle.cleanup()
    audioSourceHandle = null
  }
  if (meydaHandle) {
    meydaHandle.cleanup()
    meydaHandle = null
  }

  if (source === 'none') return

  // Create AudioContext lazily
  if (!audioCtx) {
    audioCtx = new AudioContext()
  }
  await audioCtx.resume()

  try {
    switch (source) {
      case 'mic':
        audioSourceHandle = await setupMicInput(audioCtx)
        break
      case 'system':
        audioSourceHandle = await setupSystemAudioInput(audioCtx)
        break
      case 'file':
        // File handled via file picker — do nothing here
        return
    }
    if (audioSourceHandle) {
      meydaHandle = setupMeyda(audioCtx, audioSourceHandle.sourceNode)
    }
  } catch (err) {
    console.warn('Audio source failed:', err)
    config.audioSource = 'none'
    if (audioSourceController) {
      audioSourceController.setValue('none')
      audioSourceController.updateDisplay()
    }
  }
}

function handleFileSelection() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'audio/*'
  input.addEventListener('cancel', () => {
    config.audioSource = 'none'
    if (audioSourceController) {
      audioSourceController.setValue('none')
      audioSourceController.updateDisplay()
    }
  })
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    if (audioSourceHandle) {
      audioSourceHandle.cleanup()
      audioSourceHandle = null
    }
    if (meydaHandle) {
      meydaHandle.cleanup()
      meydaHandle = null
    }
    if (!audioCtx) audioCtx = new AudioContext()
    await audioCtx.resume()
    audioSourceHandle = setupFileInput(audioCtx, file)
    meydaHandle = setupMeyda(audioCtx, audioSourceHandle.sourceNode)
  }
  input.click()
}

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

    const displacedLayers: Point[][] = []
    const indices: number[] = []
    for (let i = 0; i < totalSteps; i++) {
      displacedLayers.push(displacePoints(
        basePointSets[i], time, vertexConfig, i, pulseState,
      ))
      indices.push(i)
    }

    renderLayerPoints(displacedLayers, indices)

    animId = requestAnimationFrame(tick)
  }

  tick(performance.now())
}

// --- Audio animation ---

function startAudioAnimation() {
  stopAnimation()

  const fromShape = getShape(config.from as any)
  const toShape = getShape(config.to as any)
  const totalSteps = config.steps

  const basePointSets: Point[][] = []
  for (let i = 0; i < totalSteps; i++) {
    const t = totalSteps === 1 ? 0 : i / (totalSteps - 1)
    basePointSets.push(getMorphPoints(fromShape.path, toShape.path, t))
  }

  const binCount = audioSourceHandle?.analyser.frequencyBinCount ?? 1024
  const sampleRate = audioCtx?.sampleRate ?? 44100
  const binRanges = createBandBinRanges(binCount, sampleRate)
  frequencyData = new Float32Array(binCount)
  prevLayerIntensities = new Array(totalSteps).fill(0)
  normHistory = createNormalizationHistory()

  let lastTime = performance.now()

  function tick(now: number) {
    const dt = Math.min((now - lastTime) / 1000, 0.05) // Cap at ~20fps to protect smoothing math
    lastTime = now

    let layerIntensities = new Array(totalSteps).fill(0)
    let centroid = 0.5

    if (audioSourceHandle && audioCtx?.state === 'running' && !document.hidden && frequencyData) {
      audioSourceHandle.analyser.getFloatFrequencyData(frequencyData)
      const bandLevels = extractBandLevels(frequencyData, binRanges)
      const normalized = normalizeLevels(bandLevels, normHistory)
      const interpolated = interpolateToLayers(normalized, totalSteps)
      const smoothed = smoothLevels(interpolated, prevLayerIntensities, 5, 150, dt)
      prevLayerIntensities = smoothed // Store unscaled for next frame's smoothing

      if (meydaHandle) {
        const features = meydaHandle.getFeatures()
        centroid = features.centroid
        // Scale intensities by RMS and sensitivity (only for displacement, not stored)
        const rmsScale = features.rms * config.audioSensitivity
        layerIntensities = smoothed.map(v => v * rmsScale)
      } else {
        layerIntensities = smoothed
      }
    } else {
      prevLayerIntensities = layerIntensities
    }

    const time = now / 1000

    const displacedLayers: Point[][] = []
    const indices: number[] = []
    for (let i = 0; i < totalSteps; i++) {
      displacedLayers.push(displacePointsAudio(
        basePointSets[i], time, layerIntensities[i], centroid, i,
      ))
      indices.push(i)
    }

    renderLayerPoints(displacedLayers, indices)

    animId = requestAnimationFrame(tick)
  }

  tick(performance.now())
}

// --- Mode switching ---

function startCurrentMode() {
  stopAnimation()
  // Clean up audio resources when switching away from audio mode
  if (config.animMode !== 'audio' && audioCtx) {
    if (audioSourceHandle) { audioSourceHandle.cleanup(); audioSourceHandle = null }
    if (meydaHandle) { meydaHandle.cleanup(); meydaHandle = null }
    audioCtx.close()
    audioCtx = null
  }
  switch (config.animMode) {
    case 'trail': startTrailAnimation(); break
    case 'breathe': startBreatheAnimation(); break
    case 'audio': startAudioAnimation(); break
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

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && config.animMode === 'audio') {
    // Reset smoothing state to prevent stale data burst
    prevLayerIntensities = new Array(config.steps).fill(0)
  }
})

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

const backgroundOptions: Record<string, string> = {
  'transparent': 'transparent',
  'black (#000000)': '#000000',
  'white (#FFFFFF)': '#FFFFFF',
  ...allColourOptions,
}

function randomize() {
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]
  if (!locks.from) config.from = pick(shapeNames) as any
  if (!locks.to) config.to = pick(shapeNames) as any
  if (!locks.steps) config.steps = Math.floor(Math.random() * 11) + 5
  if (!locks.colourFrom) config.colourFrom = pick(allColourHexes) as string
  if (!locks.colourCatalyst) config.colourCatalyst = pick(allColourHexes) as string
  if (!locks.colourTo) config.colourTo = pick(allColourHexes) as string
  if (!locks.variant) config.variant = pick(['wireframe', 'filled', 'gradient'] as const)
  if (!locks.align) config.align = pick(['left', 'right', 'top', 'bottom', 'center'] as const)
  if (!locks.spread) config.spread = Math.round((Math.random() * 9.5 + 0.5) * 10) / 10
  if (!locks.scaleFrom) config.scaleFrom = Math.round((Math.random() * 1.5 + 0.5) * 100) / 100
  if (!locks.scaleTo) config.scaleTo = Math.round((Math.random() * 1.5 + 0.5) * 100) / 100
  if (!locks.background) config.background = pick(Object.values(backgroundOptions))
  if (!locks.gradientAngle) config.gradientAngle = Math.floor(Math.random() * 360)
  if (!locks.gradientSpread) config.gradientSpread = Math.floor(Math.random() * 301) + 30
  if (!locks.gradientCenterX) config.gradientCenterX = Math.round((Math.random() * 200 - 100) * 10) / 10
  if (!locks.gradientCenterY) config.gradientCenterY = Math.round((Math.random() * 200 - 100) * 10) / 10
  gui.controllersRecursive().forEach(c => c.updateDisplay())
  onConfigChange()
}

gui.add({ randomize }, 'randomize').name('Randomize')

// --- Inline lock toggles ---

function addLockToggle(controller: ReturnType<GUI['add']>, lockKey: keyof typeof locks) {
  const baseName = controller._name
  const nameEl = (controller as any).$name as HTMLElement
  nameEl.style.cursor = 'pointer'
  nameEl.title = 'Click to toggle lock'
  nameEl.textContent = `🔓 ${baseName}`
  nameEl.addEventListener('click', (e) => {
    e.stopPropagation()
    locks[lockKey] = !locks[lockKey]
    nameEl.textContent = locks[lockKey] ? `🔒 ${baseName}` : `🔓 ${baseName}`
  })
}

const shapeFolder = gui.addFolder('Shape')
addLockToggle(shapeFolder.add(config, 'from', shapeNames).name('From').onChange(onConfigChange), 'from')
addLockToggle(shapeFolder.add(config, 'to', shapeNames).name('To').onChange(onConfigChange), 'to')
addLockToggle(shapeFolder.add(config, 'steps', 5, 15, 1).name('Steps').onChange(onConfigChange), 'steps')

const colourFolder = gui.addFolder('Colour')
addLockToggle(colourFolder.add(config, 'colourFrom', allColourOptions).name('From').onChange(onConfigChange), 'colourFrom')
addLockToggle(colourFolder.add(config, 'colourCatalyst', allColourOptions).name('Catalyst').onChange(onConfigChange), 'colourCatalyst')
addLockToggle(colourFolder.add(config, 'colourTo', allColourOptions).name('To').onChange(onConfigChange), 'colourTo')
addLockToggle(colourFolder.add(config, 'background', backgroundOptions).name('Background').onChange(onConfigChange), 'background')

const effectsFolder = gui.addFolder('Effects')
addLockToggle(effectsFolder.add(config, 'variant', ['wireframe', 'filled', 'gradient']).name('Variant').onChange(onConfigChange), 'variant')
effectsFolder.add(config, 'noise').name('Noise').onChange(onConfigChange)
effectsFolder.add(config, 'noiseOpacity', 0, 0.5, 0.01).name('Noise Opacity').onChange(onConfigChange)

const blurFolder = gui.addFolder('Blur')
blurFolder.add(config, 'layerBlurEnabled').name('Layer Enabled').onChange(onConfigChange)
blurFolder.add(config, 'layerBlurFrom', 0, 30, 0.5).name('Layer From').onChange(onConfigChange)
blurFolder.add(config, 'layerBlurTo', 0, 30, 0.5).name('Layer To').onChange(onConfigChange)
blurFolder.add(config, 'maskBlurEnabled').name('Mask Enabled').onChange(onConfigChange)
const maskAngleCtrl = blurFolder.add(config, 'maskAngle', 0, 360, 1).name('Mask Angle').onChange(onMaskSliderChange)
const maskPosCtrl = blurFolder.add(config, 'maskPosition', 0, 1, 0.01).name('Mask Position').onChange(onMaskSliderChange)
const maskHardCtrl = blurFolder.add(config, 'maskHardness', 0, 1, 0.01).name('Mask Hardness').onChange(onMaskSliderChange)
const maskRadCtrl = blurFolder.add(config, 'maskBlurRadius', 0, 30, 0.5).name('Mask Radius').onChange(onMaskSliderChange)
for (const ctrl of [maskAngleCtrl, maskPosCtrl, maskHardCtrl, maskRadCtrl]) {
  ctrl.domElement.addEventListener('pointerdown', onMaskSliderDown)
}

// Mask overlay — shows the mask gradient region while mask is enabled
const overlayCanvas = document.createElement('canvas')
overlayCanvas.id = 'blur-mask-overlay'
overlayCanvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;opacity:0;transition:opacity 0.15s;z-index:999'
document.body.appendChild(overlayCanvas)

function drawMaskOverlay() {
  const w = window.innerWidth
  const h = window.innerHeight
  const dpr = window.devicePixelRatio || 1
  overlayCanvas.width = w * dpr
  overlayCanvas.height = h * dpr
  const octx = overlayCanvas.getContext('2d')!
  octx.scale(dpr, dpr)

  const angleRad = (config.maskAngle * Math.PI) / 180
  const cx = w / 2, cy = h / 2
  const len = Math.max(w, h)
  const dx = Math.cos(angleRad) * len
  const dy = Math.sin(angleRad) * len

  const grad = octx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy)
  const pos = config.maskPosition
  const halfSpread = Math.max(0.001, (1 - config.maskHardness) * 0.5)
  const s0 = Math.max(0, pos - halfSpread)
  const s1 = Math.min(1, pos + halfSpread)
  grad.addColorStop(0, 'rgba(255,0,100,0.3)')
  grad.addColorStop(s0, 'rgba(255,0,100,0.3)')
  grad.addColorStop(s1, 'rgba(255,0,100,0)')
  grad.addColorStop(1, 'rgba(255,0,100,0)')

  octx.clearRect(0, 0, w, h)
  octx.fillStyle = grad
  octx.fillRect(0, 0, w, h)
}

// Show overlay only while interacting with mask sliders
let maskDragging = false
function onMaskSliderDown() {
  maskDragging = true
  overlayCanvas.style.opacity = '1'
  drawMaskOverlay()
}
function onMaskSliderChange() {
  onConfigChange()
  if (maskDragging) drawMaskOverlay()
}
window.addEventListener('pointerup', () => {
  if (maskDragging) {
    maskDragging = false
    overlayCanvas.style.opacity = '0'
  }
})

const gradientFolder = gui.addFolder('Gradient')
addLockToggle(gradientFolder.add(config, 'gradientAngle', 0, 360, 1).name('Angle').onChange(onConfigChange), 'gradientAngle')
addLockToggle(gradientFolder.add(config, 'gradientSpread', 0, 360, 1).name('Layer Spread').onChange(onConfigChange), 'gradientSpread')
addLockToggle(gradientFolder.add(config, 'gradientCenterX', -100, 100, 0.5).name('Center X').onChange(onConfigChange), 'gradientCenterX')
addLockToggle(gradientFolder.add(config, 'gradientCenterY', -100, 100, 0.5).name('Center Y').onChange(onConfigChange), 'gradientCenterY')

const layoutFolder = gui.addFolder('Layout')
addLockToggle(layoutFolder.add(config, 'align', ['left', 'right', 'top', 'bottom', 'center']).name('Align').onChange(onConfigChange), 'align')
addLockToggle(layoutFolder.add(config, 'spread', 0, 10, 0.1).name('Spread').onChange(onConfigChange), 'spread')
addLockToggle(layoutFolder.add(config, 'scaleFrom', 0.5, 2.0, 0.05).name('Scale From').onChange(onConfigChange), 'scaleFrom')
addLockToggle(layoutFolder.add(config, 'scaleTo', 0.5, 2.0, 0.05).name('Scale To').onChange(onConfigChange), 'scaleTo')

const animFolder = gui.addFolder('Animation')
animFolder.add(config, 'animMode', ['none', 'trail', 'breathe', 'audio']).name('Mode').onChange(() => {
  updateAnimFolders()
  onConfigChange()
})

const trailFolder = animFolder.addFolder('Trail')
trailFolder.add(config, 'duration', 500, 5000, 100).name('Duration')
trailFolder.add({ replay: () => { if (config.animMode === 'trail') startTrailAnimation() } }, 'replay').name('Replay')

const breatheFolder = animFolder.addFolder('Breathe')
breatheFolder.add(config, 'breathingAmplitude', 0, 5, 0.1).name('Breathing Amp')
breatheFolder.add(config, 'breathingSpeed', 0.1, 2, 0.05).name('Breathing Speed')
breatheFolder.add(config, 'breathingFrequency', 0.01, 0.3, 0.01).name('Breathing Freq')
breatheFolder.add(config, 'pulseAmplitude', 0, 15, 0.5).name('Pulse Amp')
breatheFolder.add(config, 'pulseInterval', 1, 10, 0.5).name('Pulse Interval')
breatheFolder.add(config, 'pulseSharpness', 2, 30, 1).name('Pulse Sharpness')
breatheFolder.add(config, 'pulseCascadeDelay', 0, 0.3, 0.01).name('Cascade Delay')

const cursorParallaxFolder = animFolder.addFolder('Cursor Parallax')
cursorParallaxFolder.add(config, 'cursorParallaxEnabled').name('Enabled').onChange(onConfigChange)
cursorParallaxFolder.add(config, 'cursorParallaxIntensity', 0, 0.15, 0.005).name('Intensity')

const audioFolder = animFolder.addFolder('Audio')
audioSourceController = audioFolder.add(config, 'audioSource', {
  'None': 'none',
  'Microphone': 'mic',
  'System Audio': 'system',
  'File': 'file',
}).name('Source').onChange((source: string) => {
  if (source === 'file') {
    handleFileSelection()
  } else {
    switchAudioSource(source)
  }
})
audioFolder.add(config, 'audioSensitivity', 0.1, 5.0, 0.1).name('Sensitivity')

function updateAnimFolders() {
  const mode = config.animMode
  mode === 'trail' ? trailFolder.show() : trailFolder.hide()
  mode === 'breathe' ? breatheFolder.show() : breatheFolder.hide()
  mode === 'audio' ? audioFolder.show() : audioFolder.hide()
}

updateAnimFolders()

const exportConfig = {
  width: 1920,
  height: 1080,
  format: 'png' as 'png' | 'jpg' | 'svg',
  quality: 0.95,
  transparentBg: false,
}

function exportRaster(format: 'png' | 'jpg'): void {
  const { width, height, quality, transparentBg } = exportConfig
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    alert('Export width and height must be positive numbers.')
    return
  }

  const off = document.createElement('canvas')
  off.width = width
  off.height = height
  off.style.width = `${width}px`
  off.style.height = `${height}px`

  if (!off.getContext('2d')) {
    alert(`Browser failed to allocate canvas at ${width}x${height}. Try smaller dimensions or a different format.`)
    return
  }

  const savedBg = config.background
  if (transparentBg && format === 'png') {
    config.background = 'transparent'
  }

  try {
    render(off, buildRenderConfig(), { width, height, dpr: 1 })
  } finally {
    config.background = savedBg
  }

  const mime = format === 'png' ? 'image/png' : 'image/jpeg'
  const callback = (blob: Blob | null) => {
    if (!blob) {
      alert(`Export failed: toBlob returned null. Dimensions ${width}x${height} may be too large.`)
      return
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `brand-shape-${width}x${height}.${format}`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (format === 'jpg') {
    off.toBlob(callback, mime, quality)
  } else {
    off.toBlob(callback, mime)
  }
}

function exportSVG() {
  const fromShape = getShape(config.from as any)
  const vb = fromShape.viewBox.split(' ').map(Number) as [number, number, number, number]
  const toShape = getShape(config.to as any)
  const totalSteps = config.steps

  // Use generateMorphSteps — same pipeline as the canvas renderer
  // (flubber interpolate → uniform resample → smooth). NOT getMorphPoints which
  // is for animation vertex displacement and produces different paths.
  const { steps: paths } = generateMorphSteps(fromShape.path, toShape.path, totalSteps)

  const colours = {
    current: config.colourFrom,
    catalyst: config.colourTo,
    future: config.colourCatalyst,
  }

  // Compute base transform first — needed for gradient resolution.
  // Use export dims (not live canvas) so SVG output is anchored to user request.
  const screenW = exportConfig.width
  const screenH = exportConfig.height
  const baseScale = Math.min(screenW / vb[2], screenH / vb[3]) * 0.8
  const tx = (screenW - vb[2] * baseScale) / 2
  const ty = (screenH - vb[3] * baseScale) / 2

  // Gradient scale factor: 1:1 with output pixels (no DPR multiplication —
  // export dims ARE the pixel count).
  const gradientScaleFactor = baseScale

  const steps: SVGExportStep[] = paths.map((path, i) => {
    const { scale, offsetX, offsetY } = computeStepTransform(
      i, totalSteps, config.align as any, config.spread, config.scaleFrom, config.scaleTo,
    )

    let opacity = 1.0
    if (config.variant === 'wireframe') {
      opacity = 1 - (i / paths.length) * 0.6
    } else if (config.variant === 'gradient') {
      const t = paths.length === 1 ? 1 : i / (paths.length - 1)
      opacity = Math.max(0.05, t * t)
    }

    const cent: [number, number] = config.variant === 'filled'
      ? pathCentroid(path)
      : [vb[2] / 2, vb[3] / 2]

    let gradientImage: string | undefined
    if (config.variant === 'filled' || config.variant === 'gradient') {
      const baseAngle = config.gradientAngle ?? 90
      const spreadAngle = config.gradientSpread ?? 120
      const angleDeg = baseAngle - (1 - i / totalSteps) * spreadAngle
      gradientImage = rasterizeConicGradient({
        colours,
        angleDeg,
        centerX: cent[0] + (config.gradientCenterX ?? 0),
        centerY: cent[1] + (config.gradientCenterY ?? 0),
        viewBoxWidth: vb[2],
        viewBoxHeight: vb[3],
      }, gradientScaleFactor)
    }

    const scaleFactor = Math.min(screenW / vb[2], screenH / vb[3]) * 0.8
    const strokeWidth = config.variant === 'wireframe' ? 1.5 / scaleFactor : undefined

    const hasLayerBlur = config.layerBlurEnabled && (config.layerBlurFrom > 0 || config.layerBlurTo > 0)
    const t = paths.length === 1 ? 0 : i / (paths.length - 1)
    const blurRadius = hasLayerBlur
      ? config.layerBlurTo + (config.layerBlurFrom - config.layerBlurTo) * t
      : 0

    return {
      path,
      centroid: cent,
      transform: { scale, offsetX, offsetY },
      opacity,
      strokeWidth,
      gradientImage,
      blurRadius,
    }
  })

  // Rasterize noise tile matching the canvas renderer's exact algorithm
  const noiseTileSize = 256
  const noiseImage = config.noise ? rasterizeNoiseTile(noiseTileSize, config.noiseOpacity) : undefined

  const svgConfig: SVGExportConfig = {
    width: screenW,
    height: screenH,
    viewBox: [0, 0, screenW, screenH],
    background: exportConfig.transparentBg ? 'transparent' : config.background,
    variant: config.variant as any,
    noise: config.noise,
    noiseOpacity: config.noiseOpacity,
    colours,
    steps,
    baseTransform: { translateX: tx, translateY: ty, scale: baseScale },
    noiseImage,
    noiseTileSize,
    shapeViewBox: vb,
  }

  const svgString = generateSVG(svgConfig)
  const blob = new Blob([svgString], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `brand-shape-${exportConfig.width}x${exportConfig.height}.svg`
  a.click()
  URL.revokeObjectURL(url)
}

const exportFolder = gui.addFolder('Export')
exportFolder.add(exportConfig, 'width', 16, 16384, 1).name('Width (px)')
exportFolder.add(exportConfig, 'height', 16, 16384, 1).name('Height (px)')

const formatCtrl = exportFolder.add(exportConfig, 'format', ['png', 'jpg', 'svg']).name('Format')
const qualityCtrl = exportFolder.add(exportConfig, 'quality', 0.5, 1.0, 0.01).name('JPG Quality')
const transparentCtrl = exportFolder.add(exportConfig, 'transparentBg').name('Transparent BG')

function syncFormatVisibility() {
  if (exportConfig.format === 'jpg') {
    qualityCtrl.show()
    transparentCtrl.hide()
  } else {
    qualityCtrl.hide()
    transparentCtrl.show()
  }
}
formatCtrl.onChange(syncFormatVisibility)
syncFormatVisibility()

exportFolder.add({
  export: () => {
    if (exportConfig.format === 'svg') exportSVG()
    else exportRaster(exportConfig.format)
  },
}, 'export').name('Export')
