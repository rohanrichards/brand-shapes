import GUI from 'lil-gui'
import { render, type RenderConfig } from '../renderer/canvas-renderer'
import { shapeNames, getShape } from '../core/shapes'
import { DEFAULT_NOISE_CONFIG } from '../core/effects'
import { getMorphPoints, smoothPath, type Point } from '../core/morph'
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
  blur: false,
  noiseOpacity: 0.08,
  blurRadius: 2,
  align: 'right' as 'left' | 'right' | 'top' | 'bottom' | 'center',
  spread: 1.2,
  scaleFrom: 1.15,
  scaleTo: 0.95,
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
  render(canvas, rc)
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
effectsFolder.add(config, 'blur').name('Blur').onChange(onConfigChange)
effectsFolder.add(config, 'noiseOpacity', 0, 0.5, 0.01).name('Noise Opacity').onChange(onConfigChange)
effectsFolder.add(config, 'blurRadius', 0, 10, 0.5).name('Blur Radius').onChange(onConfigChange)

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
  transparentBg: false,
}

function exportPNG() {
  if (exportConfig.transparentBg) {
    const savedBg = config.background
    config.background = 'transparent'
    startCurrentMode()
    requestAnimationFrame(() => {
      canvas.toBlob((blob) => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'brand-shape.png'
        a.click()
        URL.revokeObjectURL(url)
        config.background = savedBg
        startCurrentMode()
      }, 'image/png')
    })
  } else {
    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'brand-shape.png'
      a.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }
}

const exportFolder = gui.addFolder('Export')
exportFolder.add(exportConfig, 'transparentBg').name('Transparent BG')
exportFolder.add({ exportPNG }, 'exportPNG').name('Export PNG')
