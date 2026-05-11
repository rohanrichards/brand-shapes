# Blur Resolution Scaling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make exported images visually identical to the live preview at any output resolution by scaling pixel-spatial effects (blur radii, noise tile size) relative to a 1080px reference dimension.

**Architecture:** Add `REFERENCE_DIM = 1080` and a pure `computePixelScale(w, h)` helper to `src/core/effects.ts`. Multiply blur radii and noise tile size by `pixelScale = min(canvas.w, canvas.h) / 1080` at render time in both `canvas-renderer.ts` and `demo.ts → exportSVG()`. No public API change — config types, slider ranges, Web Component attributes all stay the same.

**Tech Stack:** TypeScript strict, Vite, Vitest, Canvas 2D API. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-12-blur-resolution-scaling-design.md`

**Branch:** `fix/blur-resolution-scaling` (already created)

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/core/effects.ts` | Modify | Add `REFERENCE_DIM` constant and `computePixelScale` pure function |
| `__tests__/effects.test.ts` | Modify | Add unit tests for the new exports |
| `src/renderer/canvas-renderer.ts` | Modify | Compute `pixelScale` in `render()`, multiply at per-layer blur, masked blur, and noise sites |
| `src/demo/demo.ts` | Modify | Compute `pixelScale` in `exportSVG()`, multiply at per-step `blurRadius` and `noiseTileSize` |

No new files. No file restructure.

---

## Task 1: Add `REFERENCE_DIM` and `computePixelScale` to effects.ts

**Files:**
- Modify: `src/core/effects.ts` (append exports near end of file)
- Modify: `__tests__/effects.test.ts` (append new describe block)

- [ ] **Step 1: Write the failing tests**

Append to `__tests__/effects.test.ts`:

```typescript
import {
  lerpColour,
  generateStepFills,
  buildConicGradientConfig,
  buildLinearGradientStops,
  DEFAULT_NOISE_CONFIG,
  DEFAULT_BLUR_CONFIG,
  REFERENCE_DIM,
  computePixelScale,
} from '../src/core/effects'

// ... existing describe blocks unchanged ...

describe('REFERENCE_DIM', () => {
  it('is 1080', () => {
    expect(REFERENCE_DIM).toBe(1080)
  })
})

describe('computePixelScale', () => {
  it('returns 1 at the reference dimension (square)', () => {
    expect(computePixelScale(1080, 1080)).toBe(1)
  })

  it('returns 1 when wider than tall but min equals reference', () => {
    expect(computePixelScale(1920, 1080)).toBe(1)
  })

  it('returns 1 when taller than wide but min equals reference', () => {
    expect(computePixelScale(1080, 1920)).toBe(1)
  })

  it('returns 0.5 at half the reference dimension', () => {
    expect(computePixelScale(540, 540)).toBe(0.5)
  })

  it('returns 2 at double the reference dimension', () => {
    expect(computePixelScale(2160, 4000)).toBe(2)
  })

  it('anchors to the smaller dimension', () => {
    expect(computePixelScale(4000, 540)).toBe(0.5)
  })
})
```

Note: only the `import` statement is being changed in the existing test file — add `REFERENCE_DIM` and `computePixelScale` to the named imports. Append the two new `describe` blocks at the bottom of the file.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/effects.test.ts`

Expected: FAIL with "Cannot find name 'REFERENCE_DIM'" / "Cannot find name 'computePixelScale'" or "is not exported from" depending on how vitest surfaces it. Tests in the existing `lerpColour` / `buildConicGradientConfig` blocks should continue to pass.

- [ ] **Step 3: Implement the constant and helper**

Append to `src/core/effects.ts` (at the bottom of the file, after `DEFAULT_BLUR_CONFIG`):

```typescript
/**
 * Reference dimension (in pixels) at which "pixel" values in config are interpreted.
 * Used by computePixelScale to scale blur radii and noise tile size proportionally
 * with output resolution, so exports look identical to the live preview.
 */
export const REFERENCE_DIM = 1080

/**
 * Returns the scaling factor for pixel-spatial effects given an output canvas size.
 * Anchored to the smaller canvas dimension (matches the shape-fit scaling used
 * elsewhere in the renderer).
 *
 * Example: at a 1080×1080 canvas this returns 1 (config values render literally).
 * At a 4K (3840×2160) canvas this returns 2 (config values render at 2x size).
 */
export function computePixelScale(width: number, height: number): number {
  return Math.min(width, height) / REFERENCE_DIM
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/effects.test.ts`

Expected: all tests PASS, including the new `REFERENCE_DIM` and `computePixelScale` blocks. No existing tests regress.

- [ ] **Step 5: Commit**

```bash
git add src/core/effects.ts __tests__/effects.test.ts
git commit -m "feat(effects): add REFERENCE_DIM and computePixelScale helper

Reference dimension and scaling helper used by the renderer to keep
blur radii and noise tile size proportional across output resolutions.
Pure function with no DOM dependencies — fits the src/core/ contract."
```

---

## Task 2: Apply `pixelScale` in canvas-renderer.ts

**Files:**
- Modify: `src/renderer/canvas-renderer.ts` (import, `applyMaskedBlur` signature, three use sites in `render()`)

No new tests — the renderer is not currently covered by automated tests (per `.claude/rules/testing.md`). Manual visual check at the end.

- [ ] **Step 1: Add the import**

In `src/renderer/canvas-renderer.ts`, find the existing import block from `'../core/effects'` (around line 18-22):

```typescript
  type BlurConfig,
  DEFAULT_BLUR_CONFIG,
```

Add `computePixelScale` to the named imports so the block reads:

```typescript
  type BlurConfig,
  DEFAULT_BLUR_CONFIG,
  computePixelScale,
```

- [ ] **Step 2: Update `applyMaskedBlur` signature to accept `pixelScale`**

Find `applyMaskedBlur` (around line 108). Change its signature and the one blur-radius use site inside it.

Before:

```typescript
function applyMaskedBlur(
  ctx: CanvasRenderingContext2D,
  scene: OffscreenCanvas,
  width: number,
  height: number,
  dpr: number,
  blur: BlurConfig,
): void {
  const blurredCanvas = new OffscreenCanvas(width * dpr, height * dpr)
  const blurredCtx = blurredCanvas.getContext('2d')!
  blurredCtx.filter = `blur(${blur.maskBlurRadius}px)`
```

After:

```typescript
function applyMaskedBlur(
  ctx: CanvasRenderingContext2D,
  scene: OffscreenCanvas,
  width: number,
  height: number,
  dpr: number,
  blur: BlurConfig,
  pixelScale: number,
): void {
  const blurredCanvas = new OffscreenCanvas(width * dpr, height * dpr)
  const blurredCtx = blurredCanvas.getContext('2d')!
  blurredCtx.filter = `blur(${blur.maskBlurRadius * pixelScale}px)`
```

The rest of the function (gradient stops, mask geometry, composite ops) is unchanged.

- [ ] **Step 3: Compute `pixelScale` once at the top of `render()`**

Find `render()` (around line 241). After the line `ctx.scale(dpr, dpr)` (around line 248), and before `ctx.clearRect`, add:

```typescript
  const pixelScale = computePixelScale(width, height)
```

So the top of `render()` reads:

```typescript
export function render(canvas: HTMLCanvasElement, config: RenderConfig, target: RenderTarget): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const { width, height, dpr } = target
  canvas.width = width * dpr
  canvas.height = height * dpr
  ctx.scale(dpr, dpr)

  const pixelScale = computePixelScale(width, height)

  ctx.clearRect(0, 0, width, height)
```

- [ ] **Step 4: Apply `pixelScale` at the per-layer blur use site**

Find the per-layer blur loop inside `render()` (around line 291-309). One line changes — the `blurRadius` calculation (around line 304).

Before:

```typescript
      const t = steps.length === 1 ? 0 : i / (steps.length - 1)
      const blurRadius = config.blur.layerBlurTo + (config.blur.layerBlurFrom - config.blur.layerBlurTo) * t

      offCtx.filter = blurRadius > 0 ? `blur(${blurRadius}px)` : 'none'
```

After:

```typescript
      const t = steps.length === 1 ? 0 : i / (steps.length - 1)
      const blurRadius = (config.blur.layerBlurTo + (config.blur.layerBlurFrom - config.blur.layerBlurTo) * t) * pixelScale

      offCtx.filter = blurRadius > 0 ? `blur(${blurRadius}px)` : 'none'
```

- [ ] **Step 5: Apply `pixelScale` to the noise tile**

Find the noise block in `render()` (around line 327-339).

Before:

```typescript
  if (config.noise.enabled) {
    const noiseTexture = generateNoiseTexture(config.noise.size, config.noise.opacity)
    const noiseCanvas = new OffscreenCanvas(config.noise.size, config.noise.size)
    const noiseCtx = noiseCanvas.getContext('2d')!
    noiseCtx.putImageData(noiseTexture, 0, 0)
    const pattern = offCtx.createPattern(noiseCanvas, 'repeat')
```

After:

```typescript
  if (config.noise.enabled) {
    const scaledNoiseSize = Math.max(1, Math.round(config.noise.size * pixelScale))
    const noiseTexture = generateNoiseTexture(scaledNoiseSize, config.noise.opacity)
    const noiseCanvas = new OffscreenCanvas(scaledNoiseSize, scaledNoiseSize)
    const noiseCtx = noiseCanvas.getContext('2d')!
    noiseCtx.putImageData(noiseTexture, 0, 0)
    const pattern = offCtx.createPattern(noiseCanvas, 'repeat')
```

- [ ] **Step 6: Pass `pixelScale` into the `applyMaskedBlur` call**

Find the call site (around line 343).

Before:

```typescript
  if (config.blur.maskEnabled && config.blur.maskBlurRadius > 0) {
    applyMaskedBlur(ctx, offscreen, width, height, dpr, config.blur)
  } else {
```

After:

```typescript
  if (config.blur.maskEnabled && config.blur.maskBlurRadius > 0) {
    applyMaskedBlur(ctx, offscreen, width, height, dpr, config.blur, pixelScale)
  } else {
```

- [ ] **Step 7: Run tests to confirm nothing regresses**

Run: `npx vitest run`

Expected: all tests PASS. The renderer is not tested directly, but the changes must not break `effects.ts` exports (already covered by Task 1 tests).

- [ ] **Step 8: Run the build to verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: no errors. `pixelScale` is `number`, signature compatible with the call.

- [ ] **Step 9: Manual visual check on the live preview**

Run: `npx vite`

Open the dev server URL in a browser. Toggle blur and noise controls. Confirm:

- Live preview still renders blur and noise (not blank, not broken)
- Blur effect is visibly present at non-zero slider values
- Noise grain is visible when noise is enabled
- Per-layer blur (`layerBlurFrom > 0` or `layerBlurTo > 0`) shows the depth-of-field falloff as before
- Masked blur (mask enabled, mask radius > 0) shows the linear gradient blur region

Note: blur and noise will look *slightly different* than before this commit — that's the fix. They should be a touch less blurry / less grainy on a typical sub-1080px live preview, because the slider is now interpreted at 1080p reference. This is correct.

Stop the dev server (`Ctrl+C`) before continuing.

- [ ] **Step 10: Commit**

```bash
git add src/renderer/canvas-renderer.ts
git commit -m "fix(renderer): scale blur and noise by pixelScale

Per-layer blur, masked blur, and noise tile size are now multiplied by
computePixelScale(width, height) so the rendered output stays
proportional across canvas sizes. Fixes exports looking under-blurred
and grain looking too fine at high output resolutions.

applyMaskedBlur gains a pixelScale parameter."
```

---

## Task 3: Apply `pixelScale` in `exportSVG()`

**Files:**
- Modify: `src/demo/demo.ts` (import + two use sites inside `exportSVG`)

- [ ] **Step 1: Add the import**

In `src/demo/demo.ts`, find the existing import from `../core/effects` (search for `core/effects` in the file). Add `computePixelScale` to the named imports.

If there is no existing import from `../core/effects` in demo.ts, add a new one near the other core imports:

```typescript
import { computePixelScale } from '../core/effects'
```

Run `npx tsc --noEmit` after this step to confirm the import resolves.

- [ ] **Step 2: Compute `pixelScale` at the top of `exportSVG()`**

Find `exportSVG()` (around line 845). The function already computes `screenW` and `screenH` (around line 864-865). Add `pixelScale` right after.

Before:

```typescript
  const screenW = exportConfig.width
  const screenH = exportConfig.height
  const baseScale = Math.min(screenW / vb[2], screenH / vb[3]) * 0.8
```

After:

```typescript
  const screenW = exportConfig.width
  const screenH = exportConfig.height
  const pixelScale = computePixelScale(screenW, screenH)
  const baseScale = Math.min(screenW / vb[2], screenH / vb[3]) * 0.8
```

- [ ] **Step 3: Apply `pixelScale` to the per-step `blurRadius`**

Find the `blurRadius` calculation inside the `steps.map(...)` (around line 909-913).

Before:

```typescript
    const hasLayerBlur = config.layerBlurEnabled && (config.layerBlurFrom > 0 || config.layerBlurTo > 0)
    const t = paths.length === 1 ? 0 : i / (paths.length - 1)
    const blurRadius = hasLayerBlur
      ? config.layerBlurTo + (config.layerBlurFrom - config.layerBlurTo) * t
      : 0
```

After:

```typescript
    const hasLayerBlur = config.layerBlurEnabled && (config.layerBlurFrom > 0 || config.layerBlurTo > 0)
    const t = paths.length === 1 ? 0 : i / (paths.length - 1)
    const blurRadius = hasLayerBlur
      ? (config.layerBlurTo + (config.layerBlurFrom - config.layerBlurTo) * t) * pixelScale
      : 0
```

- [ ] **Step 4: Apply `pixelScale` to `noiseTileSize`**

Find the noise tile rasterization (around line 927-928).

Before:

```typescript
  // Rasterize noise tile matching the canvas renderer's exact algorithm
  const noiseTileSize = 256
  const noiseImage = config.noise ? rasterizeNoiseTile(noiseTileSize, config.noiseOpacity) : undefined
```

After:

```typescript
  // Rasterize noise tile matching the canvas renderer's exact algorithm.
  // Tile pixel-count is scaled by pixelScale so the grain occupies the same
  // proportion of the image as the live preview does — see REFERENCE_DIM.
  const noiseTileSize = Math.max(1, Math.round(256 * pixelScale))
  const noiseImage = config.noise ? rasterizeNoiseTile(noiseTileSize, config.noiseOpacity) : undefined
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run && npx tsc --noEmit`

Expected: all tests PASS, no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/demo/demo.ts
git commit -m "fix(export): scale SVG blur and noise tile by pixelScale

exportSVG now multiplies per-step blur radii and the noise tile size by
computePixelScale(exportW, exportH) so SVG exports match the live
preview at any output resolution — same fix as the canvas renderer."
```

---

## Task 4: End-to-end validation

No code changes. Visual confirmation that the fix delivers the goal.

- [ ] **Step 1: Run dev server**

Run: `npx vite`

- [ ] **Step 2: Tune a configuration that exercises the fix**

In the browser, enable a preset or manually set:
- Variant: gradient
- Layer Blur Enabled: on
- Layer From: ~10
- Layer To: 0
- Mask Enabled: on, Mask Radius: ~15
- Noise: on, Opacity: ~0.15

Observe the live preview.

- [ ] **Step 3: Export PNG at preview-matching resolution**

Open the Export folder in the lil-gui panel. Note the dev-server canvas size (right-click → Inspect → measure the `<canvas>` element, or read the viewport size). Set Export Width/Height to match the live canvas dimensions. Format: PNG. Click Export.

Open the downloaded PNG side-by-side with the live preview. Confirm they look essentially identical (within DPR aliasing tolerance).

- [ ] **Step 4: Export PNG at 4× preview resolution**

Without changing the configuration, set Export Width/Height to 4× the live canvas dimensions. Click Export.

Open the downloaded PNG. View at "fit to window" so it scales down to roughly the live preview's display size. Compare to the live preview.

Confirm: the 4× export looks **visually identical** in proportion of blur softness and grain texture — not noticeably sharper or finer than the live preview. If it looks under-blurred or smoother, the fix is incomplete.

- [ ] **Step 5: Export SVG at 4× preview resolution**

Switch Format to SVG. Click Export.

Open the SVG file in a browser. Compare to the live preview. Confirm the per-layer blur proportion matches and the noise grain looks like the live preview (not visibly finer).

- [ ] **Step 6: Push branch**

If all checks pass:

```bash
git push -u origin fix/blur-resolution-scaling
```

If any check fails, return to the failing task, identify the missed call site or wrong scaling direction, and amend.

---

## Self-Review Checklist (already done by plan author)

- ✅ Spec section "Scaling rule" → Task 1
- ✅ Spec section "Canvas renderer changes" → Task 2 (per-layer blur, masked blur, noise — all three sites)
- ✅ Spec section "SVG export changes" → Task 3 (per-step blur, noise tile)
- ✅ Spec section "Testing" → Task 1 includes the constant-locking test + the computePixelScale tests; Task 4 covers the manual validation step
- ✅ No placeholders: every code block contains full code; every test has assertions; every commit has an exact message
- ✅ Type consistency: `computePixelScale(width, height): number` used identically in renderer and demo; `applyMaskedBlur` new parameter is `pixelScale: number` matching the variable name in the call site
- ✅ Spec "out of scope" items (preset re-tuning, masked-blur-in-SVG, DPR behavior) are correctly excluded from tasks
