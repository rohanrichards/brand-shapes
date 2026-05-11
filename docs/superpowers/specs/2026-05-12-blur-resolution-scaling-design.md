# Resolution-Independent Pixel-Spatial Effects

**Date:** 2026-05-12
**Status:** Approved, ready for implementation plan
**Branch:** `fix/blur-resolution-scaling`

## Problem

Exporting at a higher resolution than the live preview produces an image that looks visibly different from what the user tuned. Specifically:

- Per-layer blur (`layerBlurFrom`, `layerBlurTo`) and masked blur (`maskBlurRadius`) are passed straight into `ctx.filter = blur(${r}px)`. Canvas blur radius is in actual output pixels. A 10px blur on an 800px live preview occupies ~1.25% of the image; the same value in an 8000px export occupies 0.125%, looking ~10× less blurry.
- The noise tile is a fixed `256 × 256` pixel pattern repeated across the canvas. At 800px the grain spans 4 tiles across the image (chunky, visible). At 8000px it spans ~31 tiles (fine dust, barely visible).

Result: users who tune effects against the preview, then export at print/4K resolution, get output that looks "broken" — under-blurred and smoother than expected. There is no way for them to compensate predictively, because the math the user would need to do is hidden inside the renderer.

Other effects (gradient center, layer spread, layer scale, logo placement, wireframe stroke) are already expressed in canvas-relative units and render consistently at every resolution. The bug is isolated to blur radii and noise tile size.

## Goal

The exported image is visually identical to the live preview at any output resolution. As a side effect, the live preview itself becomes stable across browser resizes (today, the same preset looks different at different viewport sizes for the same reason).

No user-visible change to config schema, UI controls, slider ranges, or Web Component attributes. Users continue to tune sliders to taste; the renderer absorbs the scaling.

## Design

### Scaling rule

Pixel-spatial config values are interpreted as "pixels at a 1080px reference dimension." The renderer rescales them to actual output pixels using:

```ts
pixelScale = Math.min(canvas.width, canvas.height) / REFERENCE_DIM
```

`REFERENCE_DIM = 1080` is exported as a named constant from `src/core/effects.ts`. The scaling is applied to four values:

1. `layerBlurFrom`
2. `layerBlurTo`
3. `maskBlurRadius`
4. `noise.size` (both the tile pixel-count and the canvas the noise is rendered onto)

### Canvas renderer changes

`src/renderer/canvas-renderer.ts`:

- `render()` computes `pixelScale` once near the top, after `width`/`height`/`dpr` are known.
- The per-layer blur branch (currently `canvas-renderer.ts:304-306`) multiplies its interpolated `blurRadius` by `pixelScale` before writing `ctx.filter`.
- `applyMaskedBlur()` takes `pixelScale` as a new parameter and multiplies `blur.maskBlurRadius` by it when writing `ctx.filter`. The mask gradient stops (`stop0`, `stop1`) are normalized 0–1 and untouched. The mask geometry (`Math.cos(angleRad) * len`) uses `len = max(width, height)` in CSS units and is untouched.
- Noise generation scales `config.noise.size` by `pixelScale` (rounded to nearest int, clamped to a minimum of 1) before allocating both the `Uint8ClampedArray` data and the `OffscreenCanvas` tile.

### SVG export changes

`src/demo/demo.ts → exportSVG()`:

- Compute the same `pixelScale = Math.min(screenW, screenH) / REFERENCE_DIM` against export dimensions.
- Multiply each step's `blurRadius` by `pixelScale` before assembling `SVGExportStep`. The `feGaussianBlur stdDeviation` written by `generateSVG()` is in user-space units (the SVG viewBox is `[0, 0, screenW, screenH]`, so user-space equals output pixels), and scaling at this layer keeps SVG output in sync.
- Scale `noiseTileSize` by `pixelScale` before calling `rasterizeNoiseTile` and before passing into `generateSVG`. The rasterized PNG tile contains more random pixels, but renders at the same proportion of the image.

`src/core/svg-export.ts` requires no changes — it consumes pre-scaled values.

### What does not change

- `BlurConfig`, `NoiseConfig`, `RenderTarget`, `RenderConfig` type shapes.
- `<brand-shape>` Web Component attributes and properties.
- lil-gui controls (slider ranges, labels, default values).
- Gradient, layout, logo, and wireframe-stroke math (already resolution-relative).
- DPR handling on the live canvas — `ctx.scale(dpr, dpr)` continues to compose correctly with the new scaled blur radii, because the new scale operates in CSS-pixel space exactly like the old one.

### Out of scope

- **Preset re-tuning.** Existing values in `src/demo/presets.ts` (e.g. `layerBlurFrom: 6` in `gradient`) were authored against whatever live canvas size happened to be in use. After this change they will render slightly less blurry on the same preview, since typical live canvas dimensions are below 1080px. Accept as a one-time shift; demo presets are not authoritative tunings.
- **Masked blur in SVG export.** Today, `exportSVG` silently drops `maskEnabled`/`maskBlurRadius` — `SVGExportConfig` has no slot for it. Not introduced or fixed by this change.
- **Live canvas DPR behavior.** Unchanged; this fix operates orthogonally to DPR scaling.

## Testing

The project has Vitest unit tests for `src/core/` only. Two additions:

1. `__tests__/effects.test.ts` (extend or create): assert `REFERENCE_DIM === 1080`. Locks the contract and surfaces accidental changes in code review.
2. Manual validation step (documented in the implementation plan, not automated): tune a preset that exercises both per-layer blur and noise, export at 4× the live canvas resolution, open both PNGs side-by-side at matched zoom, confirm visual parity.

No renderer-level automated tests are added — the project does not currently have a renderer test harness, and the fix is four arithmetic call sites with no branching logic worth covering.

## Implementation order

1. Add `REFERENCE_DIM` export to `src/core/effects.ts` and the constant-locking test.
2. Apply `pixelScale` in `canvas-renderer.ts` (per-layer blur, masked blur, noise size).
3. Apply `pixelScale` in `exportSVG()` (per-step blur, noise tile size).
4. Manual validate: preview → export at 4× → eyeball-compare.

Each step lands as its own commit on `fix/blur-resolution-scaling`.
