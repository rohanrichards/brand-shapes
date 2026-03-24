# Audio-Reactive Animation — Design Spec

## Overview

A new animation mode (`'audio'`) for Brand Shapes where morph layers deform in real-time based on audio input. Each layer maps to a frequency band — outer layers respond to bass, inner layers to treble. Audio intensity controls deformation amplitude, while Meyda spectral features (centroid, spread, RMS) modulate deformation character behind the scenes. No user-facing behaviour configuration — the music itself drives the visual style.

## Audio Sources

Four source options selectable via GUI dropdown:

| Source | API | Notes |
|--------|-----|-------|
| None | — | Audio animation inactive |
| Microphone | `getUserMedia({ audio: true })` | Disable echo cancellation, noise suppression, auto gain for visualization |
| System Audio | `getDisplayMedia({ audio: true })` | Captures desktop/tab audio; triggers browser share dialog |
| File | `<input type="file">` + `MediaElementAudioSourceNode` | For local audio files; uses `<audio>` element for playback controls |

All sources feed into a shared `AudioContext` → `AnalyserNode` pipeline.

### AnalyserNode Configuration

- `fftSize`: 2048 (1024 frequency bins, ~21.5 Hz per bin)
- `smoothingTimeConstant`: 0 (custom smoothing applied downstream)
- Use `getFloatFrequencyData()` for raw dBFS values enabling custom per-band normalization
- Reuse typed arrays per frame — never allocate in the render loop

### Meyda Configuration

Runs in parallel on the same `AudioContext`. Extracts:

- **RMS** — overall loudness (0–1). Scales global deformation energy.
- **Spectral centroid** — frequency "center of mass" (normalized 0–1). Controls deformation sharpness: low = smooth/rounded, high = jagged/spiky.
- **Spectral spread** — how distributed the energy is across the spectrum. Available for future use.

## Frequency Band System

### 7 Fixed Bands (Log-Spaced, A-Weighted)

| Band | Frequency Range | A-Weight Factor | Character |
|------|----------------|-----------------|-----------|
| Sub-bass | 20–60 Hz | 0.6 | Deep rumble, kick drum body |
| Bass | 60–250 Hz | 0.7 | Bass guitar, kick punch |
| Low-mid | 250–500 Hz | 0.85 | Warmth, body |
| Mid | 500–2,000 Hz | 1.0 | Vocals, melody |
| Upper-mid | 2,000–4,000 Hz | 1.2 | Presence, attack |
| Presence | 4,000–6,000 Hz | 1.5 | Clarity, edge |
| Brilliance | 6,000–20,000 Hz | 2.0 | Air, cymbals, sibilance |

A-weight factors compensate for bass energy dominance so all bands contribute proportionally to perceived loudness.

### Per-Band Normalization

Running min/max per band with slow adaptation:
1. Raw dBFS values from FFT bins
2. Convert to linear amplitude
3. Average bins within band range
4. Apply A-weight factor
5. Normalize against per-band running min/max (slow adaptation prevents sudden jumps)
6. Output: 0–1 intensity per band

### Interpolation to Layer Count

The 7 bands are positioned as anchor points across the layer range (outermost = sub-bass, innermost = brilliance). Layers between anchors get linearly interpolated intensity from their two nearest bands.

Example with 8 layers:
```
Layer 0 (outer): 100% sub-bass
Layer 1:         ~83% sub-bass, ~17% bass
Layer 2:         ~17% sub-bass, ~83% bass
Layer 3:         100% low-mid
Layer 4:         ~50% mid, ~50% upper-mid
Layer 5:         100% presence
Layer 6:         ~50% presence, ~50% brilliance
Layer 7 (inner): 100% brilliance
```

This scales to any layer count (5–15). The mapping direction — bass=outer, treble=inner — means outer layers pulse with kicks/bass, inner layers shimmer with cymbals/treble, and the whole shape becomes a visible frequency spectrum.

## Deformation Model

Each frame, for each layer's vertices:

### Step 1: Displacement Direction

Vertices displace radially outward from the layer's centroid (same direction as existing pulse effect).

### Step 2: Displacement Amount

Three factors multiply together:
- **Layer intensity** (0–1) — from the interpolated frequency band
- **Sensitivity** — user's gain slider (0.1–3.0, default 1.0)
- **RMS energy** (0–1) — global loudness from Meyda. Quiet passages dampen, drops amplify.

### Step 3: Displacement Character

Spectral centroid (0–1) controls how displacement is distributed across vertices:
- **Low centroid** (warm/bassy sound) — displacement is smooth, vertices move uniformly, shape stays rounded. Higher simplex noise smoothing applied.
- **High centroid** (bright/harsh sound) — displacement is jagged, adjacent vertices get different amounts, shape goes spiky. Higher-frequency noise, reduced smoothing.

No user configuration — the music itself decides the visual character.

### Step 4: Temporal Smoothing

Asymmetric attack/decay on per-layer intensities:
- **Attack**: ~5ms (fast response to beats/transients)
- **Decay**: ~150ms (smooth falloff, prevents jitter)
- Coefficient formula: `1 - Math.exp(-1000 / (ms * frameRate))`

Simplex noise (from existing `src/core/noise.ts`) layered on top for organic movement independent of audio.

## Architecture

### New Files

```
src/core/audio-analyser.ts    — pure functions (no DOM), testable
  - createBands(binCount, bandCount) → BandConfig[]
  - extractBandLevels(frequencyData, bands, aWeights) → number[]
  - normalizeLevels(levels, history) → number[]
  - smoothLevels(current, previous, attack, decay, dt) → number[]
  - interpolateToLayers(bandLevels, layerCount) → number[]

src/demo/audio-source.ts      — browser APIs (DOM)
  - setupMicInput(audioCtx) → AudioSourceHandle
  - setupSystemAudioInput(audioCtx) → AudioSourceHandle
  - setupFileInput(audioCtx, file) → AudioSourceHandle
  - setupMeyda(audioCtx, sourceNode) → MeydaHandle
  - type AudioSourceHandle = { analyser: AnalyserNode, cleanup: () => void }
  - type MeydaHandle = { getFeatures: () => { rms: number, centroid: number, spread: number }, cleanup: () => void }
```

### Modified Files

```
src/demo/demo.ts
  - Add 'audio' to animMode union type
  - Add audioFolder to GUI (shown/hidden via updateAnimFolders)
  - Add startAudioAnimation() function
  - Wire audio source dropdown, file picker, sensitivity slider
```

### New Dependency

```
meyda — audio feature extraction (spectral centroid, spread, RMS)
```

### Integration with Existing Systems

- **Animation loop**: `startAudioAnimation()` follows same pattern as `startBreatheAnimation()` — `requestAnimationFrame` loop, computes displaced points per layer, calls `renderLayerPoints()`
- **Cursor parallax**: applies on top via existing shared helpers (mode-independent)
- **Simplex noise**: reuses existing `src/core/noise.ts` for organic displacement layering
- **Render pipeline**: reuses `smoothPath()`, `buildRenderConfig()`, `render()`

### Data Flow

```
Audio Source → AudioContext → AnalyserNode ──→ getFloatFrequencyData()
                           → Meyda ──────→ { rms, centroid, spread }
                                              ↓
                          extractBandLevels() → 7 band intensities
                          normalizeLevels()   → A-weighted, min/max normalized
                          interpolateToLayers() → N layer intensities
                          smoothLevels()      → attack/decay smoothed
                                              ↓
                          Per-layer vertex displacement (radial, centroid-modulated)
                          + simplex noise overlay
                          + cursor parallax (if enabled)
                                              ↓
                          smoothPath() → renderLayerPoints() → canvas
```

## GUI Controls

Under Animation folder, an "Audio" sub-folder (visible only when mode = 'audio'):

| Control | Type | Range | Default |
|---------|------|-------|---------|
| Source | Dropdown | None / Microphone / System Audio / File | None |
| Choose File | Button | — | Hidden unless Source = File |
| Sensitivity | Slider | 0.1–3.0, step 0.1 | 1.0 |

No other user-facing controls. Spectral features and band mapping work automatically.

## Phase Plan

### Phase 1: Audio Analysis Core
- `src/core/audio-analyser.ts` — band splitting, normalization, smoothing, interpolation
- Unit tests (TDD) for all pure functions
- No DOM, no rendering

### Phase 2: Audio Source Management
- `src/demo/audio-source.ts` — mic, system audio, file input, Meyda integration
- AudioContext lifecycle management (create/cleanup)
- Handle permission dialogs gracefully

### Phase 3: Animation Integration
- `startAudioAnimation()` in demo.ts
- GUI controls (source dropdown, file picker, sensitivity)
- `updateAnimFolders()` updated for audio folder visibility
- Wire deformation model: intensity × sensitivity × RMS, centroid-modulated character

### Phase 4: Polish
- Tune attack/decay values for best feel
- Tune A-weight factors for balanced visual response
- Test with different music genres (EDM, classical, voice, etc.)
- Ensure clean audio source switching (cleanup previous source before starting new one)
