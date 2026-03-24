// src/demo/audio-source.ts
import Meyda from 'meyda'

export interface AudioSourceHandle {
  analyser: AnalyserNode
  sourceNode: AudioNode
  cleanup: () => void
}

export interface MeydaFeatures {
  rms: number
  centroid: number
  spread: number
}

export interface MeydaHandle {
  getFeatures: () => MeydaFeatures
  cleanup: () => void
}

const ANALYSER_FFT_SIZE = 2048

function configureAnalyser(audioCtx: AudioContext): AnalyserNode {
  const analyser = audioCtx.createAnalyser()
  analyser.fftSize = ANALYSER_FFT_SIZE
  analyser.smoothingTimeConstant = 0
  return analyser
}

export async function setupMicInput(audioCtx: AudioContext): Promise<AudioSourceHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  })
  const source = audioCtx.createMediaStreamSource(stream)
  const analyser = configureAnalyser(audioCtx)
  source.connect(analyser)
  // Do NOT connect to destination (prevents feedback)
  return {
    analyser,
    sourceNode: source,
    cleanup: () => {
      source.disconnect()
      stream.getTracks().forEach(t => t.stop())
    },
  }
}

export async function setupSystemAudioInput(audioCtx: AudioContext): Promise<AudioSourceHandle> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    audio: true,
    video: true, // Required by some browsers; video track can be ignored
  })
  // Stop the video track immediately — we only want audio
  stream.getVideoTracks().forEach(t => t.stop())
  const source = audioCtx.createMediaStreamSource(stream)
  const analyser = configureAnalyser(audioCtx)
  source.connect(analyser)
  return {
    analyser,
    sourceNode: source,
    cleanup: () => {
      source.disconnect()
      stream.getTracks().forEach(t => t.stop())
    },
  }
}

export function setupFileInput(audioCtx: AudioContext, file: File): AudioSourceHandle {
  const audio = document.createElement('audio')
  audio.controls = true
  audio.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:1000'
  document.body.appendChild(audio)
  audio.src = URL.createObjectURL(file)

  const source = audioCtx.createMediaElementSource(audio)
  const analyser = configureAnalyser(audioCtx)
  source.connect(analyser)
  analyser.connect(audioCtx.destination) // File playback needs to be audible

  audio.play().catch(console.warn)

  return {
    analyser,
    sourceNode: source,
    cleanup: () => {
      audio.pause()
      source.disconnect()
      analyser.disconnect()
      URL.revokeObjectURL(audio.src)
      audio.remove()
    },
  }
}

export function setupMeyda(audioCtx: AudioContext, sourceNode: AudioNode): MeydaHandle {
  let latestFeatures: MeydaFeatures = { rms: 0, centroid: 0, spread: 0 }
  const bufferSize = ANALYSER_FFT_SIZE
  const nyquist = bufferSize / 2

  // bufferSize=2048 matches AnalyserNode fftSize. This means Meyda's callback fires
  // every ~46ms at 44.1kHz (2048/44100), which is sufficient for the ~60fps animation loop.
  const analyzer = Meyda.createMeydaAnalyzer({
    audioContext: audioCtx,
    source: sourceNode,
    bufferSize,
    featureExtractors: ['rms', 'spectralCentroid', 'spectralSpread'],
    callback: (features: Record<string, number>) => {
      latestFeatures = {
        rms: features.rms ?? 0,
        centroid: Math.min((features.spectralCentroid ?? 0) / nyquist, 1),
        spread: features.spectralSpread ?? 0,
      }
    },
  })
  analyzer.start()

  return {
    getFeatures: () => latestFeatures,
    cleanup: () => analyzer.stop(),
  }
}
