# Wireframe Variant Feature Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the wireframe variant render the same layer geometry as filled/gradient, support blur, expose a user-controlled line thickness slider, and explicitly skip noise.

**Architecture:** Introduce `renderWireframeLayer` mirroring `renderFilledLayer` so the blur-path's per-step loop can branch into wireframe the same way it branches into filled/gradient. Add `lineWidth: number` to `RenderConfig` (default `1.5`, resolution-scaled via the existing `pixelScale`). Reorganize lil-gui: move `Variant` + new `Line Width` into the `Shape` folder; rename `Effects` → `Film Grain`.

**Tech Stack:** TypeScript strict, Vite, Vitest, Canvas 2D, Lit Web Components, lil-gui. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-12-wireframe-parity-design.md`

**Branch:** `feat/wireframe-parity` (already created)

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/renderer/canvas-renderer.ts` | Modify | Add `lineWidth` to `RenderConfig`/`DEFAULT_CONFIG`. Introduce `renderWireframeLayer`. Refactor `renderWireframe` to delegate per-step. Remove wireframe exclusion from blur path. Add noise-block guard. |
| `src/component/brand-shape.ts` | Modify | New `line-width` attribute + property, default `1.5`, threaded into `_buildConfig`. |
| `src/core/svg-export.ts` | Modify | `wireframeBody` applies per-step transforms (mirroring `filledGradientBody`) and divides stroke width by `stepScale`. |
| `src/demo/demo.ts` | Modify | Add `lineWidth` to demo `config` defaults + `buildRenderConfig`. Restructure lil-gui (move `Variant` to Shape, add `Line Width` with conditional visibility, rename `Effects` → `Film Grain`). Update SVG-export stroke-width computation. Gate SVG noise on variant. |

No new files. No file restructure.

---

## Task 1: Add `lineWidth` to renderer types, defaults, and Web Component

**Files:**
- Modify: `src/renderer/canvas-renderer.ts` (extend `RenderConfig` and `DEFAULT_CONFIG`)
- Modify: `src/component/brand-shape.ts` (add property + attribute + wire into `_buildConfig`)

No test added — adding a config field with a default is mechanical and the renderer is not currently test-covered.

- [ ] **Step 1: Confirm branch**

Run: `git rev-parse --abbrev-ref HEAD`
Expected: `feat/wireframe-parity`

If anything else, STOP and report BLOCKED.

- [ ] **Step 2: Add `lineWidth` to `RenderConfig`**

In `src/renderer/canvas-renderer.ts`, find the `RenderConfig` interface (around line 40-76). Add a new field just before the closing brace (before `logo?:`), with a JSDoc comment explaining its scope:

```typescript
  /** Wireframe stroke thickness in 1080-reference pixels (scaled by computePixelScale at render time). Only affects wireframe variant. Default 1.5. */
  lineWidth: number
  /** When set, draws the Portable logo overlay in the bottom-left. */
  logo?: { style: LogoStyle; color: string; opacity?: number; scale?: number }
```

- [ ] **Step 3: Add `lineWidth: 1.5` to `DEFAULT_CONFIG`**

Same file, find `DEFAULT_CONFIG` (around line 78-90). Add one line at the bottom of the object:

```typescript
export const DEFAULT_CONFIG: RenderConfig = {
  from: 'organic-1',
  to: 'angular-3',
  steps: 8,
  colours: { current: '#4B01E6', catalyst: '#BEF958', future: '#FEA6E1' },
  variant: 'filled',
  noise: { ...DEFAULT_NOISE_CONFIG },
  blur: { ...DEFAULT_BLUR_CONFIG },
  align: 'center',
  spread: 1,
  scaleFrom: 1.15,
  scaleTo: 0.95,
  lineWidth: 1.5,
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`

Expected: errors. TypeScript will flag every place that constructs a `RenderConfig` without `lineWidth`. The two known sites are `src/component/brand-shape.ts` `_buildConfig()` and `src/demo/demo.ts` `buildRenderConfig()`. The component is fixed in Step 5 of this task; the demo is fixed in Task 4.

Note the error count and file paths. If errors land in any file beyond `brand-shape.ts` and `demo.ts`, STOP and report — the spec assumes only those two callers exist.

- [ ] **Step 5: Add `line-width` to the Web Component**

In `src/component/brand-shape.ts`:

In the `static override properties` block (around line 20-49), add:

```typescript
    lineWidth: { type: Number, attribute: 'line-width' },
```

Place it next to `spread`/`scaleFrom`/`scaleTo` (the other layout-ish props), after `scaleTo`:

```typescript
    scaleFrom: { type: Number, attribute: 'scale-from' },
    scaleTo: { type: Number, attribute: 'scale-to' },
    lineWidth: { type: Number, attribute: 'line-width' },
    gradientAngle: { type: Number, attribute: 'gradient-angle' },
```

In the public property declarations (around line 51-78), add the default value (next to `scaleTo = 0.95`):

```typescript
  scaleFrom = 1.15
  scaleTo = 0.95
  lineWidth = 1.5
  gradientAngle = 90
```

In `_buildConfig()` (around line 104-139), add `lineWidth: this.lineWidth` after `scaleTo`:

```typescript
      scaleFrom: this.scaleFrom,
      scaleTo: this.scaleTo,
      lineWidth: this.lineWidth,
      gradientAngle: this.gradientAngle,
```

- [ ] **Step 6: Typecheck and tests**

Run: `npx tsc --noEmit`
Expected: errors now only in `src/demo/demo.ts` (the `buildRenderConfig` call still missing `lineWidth`). Task 4 fixes this.

Run: `npx vitest run`
Expected: all 140 tests still pass — no behavior change to anything tested.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/canvas-renderer.ts src/component/brand-shape.ts
git commit -m "feat(renderer): add lineWidth to RenderConfig and Web Component

Adds a wireframe stroke thickness field to RenderConfig (default 1.5)
and exposes it on <brand-shape> as the 'line-width' attribute. No
rendering change yet — the renderer still uses its hardcoded value
until Task 2 lands."
```

**IMPORTANT:** No "Co-Authored-By: Claude" or "Generated with Claude Code" — project rule.

---

## Task 2: Refactor canvas-renderer for wireframe parity

**Files:**
- Modify: `src/renderer/canvas-renderer.ts` (introduce `renderWireframeLayer`, rewrite `renderWireframe`, remove blur-path exclusion, add noise-block guard)

- [ ] **Step 1: Add `renderWireframeLayer` function**

In `src/renderer/canvas-renderer.ts`, find `renderFilledLayer` (around line 395). Add `renderWireframeLayer` immediately before it (so wireframe code lives near the other per-layer renderers).

```typescript
/** Render a single wireframe layer to the given context. */
function renderWireframeLayer(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  step: string,
  stepIdx: number,
  stepTotal: number,
  config: RenderConfig,
  scale: number,
  tx: number,
  ty: number,
  gradient: CanvasGradient,
  pixelScale: number,
): void {
  const { scale: stepScale, offsetX, offsetY } = computeStepTransform(
    stepIdx, stepTotal, config.align, config.spread, config.scaleFrom, config.scaleTo,
  )
  const totalScale = scale * stepScale

  const [shapeCenterX, shapeCenterY] = pathCentroid(step)
  const shapeCenterCanvasX = tx + shapeCenterX * scale
  const shapeCenterCanvasY = ty + shapeCenterY * scale

  const opacity = stepTotal <= 1 ? 1 : 1 - (stepIdx / stepTotal) * 0.6

  ctx.save()
  ctx.translate(shapeCenterCanvasX + offsetX, shapeCenterCanvasY + offsetY)
  ctx.scale(stepScale, stepScale)
  ctx.translate(-shapeCenterCanvasX, -shapeCenterCanvasY)
  ctx.translate(tx, ty)
  ctx.scale(scale, scale)
  ctx.globalAlpha = opacity
  ctx.strokeStyle = gradient
  ctx.lineWidth = (config.lineWidth * pixelScale) / totalScale
  ctx.stroke(new Path2D(step))
  ctx.restore()
}
```

This mirrors the transform stack from `renderFilledLayer` exactly, so a wireframe layer lands in the same screen rect as the corresponding filled layer.

- [ ] **Step 2: Rewrite `renderWireframe` to delegate per-step**

Replace the existing `renderWireframe` (currently around line 364-393, the stroke loop) with a thin wrapper that builds the shared gradient once and loops through `renderWireframeLayer`.

Before:

```typescript
function renderWireframe(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  steps: string[],
  colours: { current: string; catalyst: string; future: string },
  scale: number,
  tx: number,
  ty: number,
  width: number,
  height: number,
): void {
  const gradientStops = buildLinearGradientStops(colours.current, colours.catalyst, colours.future)
  const gradient = ctx.createLinearGradient(0, 0, width, height)
  for (const stop of gradientStops) {
    gradient.addColorStop(stop.offset, stop.color)
  }

  for (let i = 0; i < steps.length; i++) {
    const opacity = 1 - (i / steps.length) * 0.6
    const path = new Path2D(steps[i])
    ctx.save()
    ctx.translate(tx, ty)
    ctx.scale(scale, scale)
    ctx.globalAlpha = opacity
    ctx.strokeStyle = gradient
    ctx.lineWidth = 1.5 / scale
    ctx.stroke(path)
    ctx.restore()
  }
  ctx.globalAlpha = 1
}
```

After:

```typescript
function renderWireframe(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  steps: string[],
  colours: { current: string; catalyst: string; future: string },
  config: RenderConfig,
  scale: number,
  tx: number,
  ty: number,
  width: number,
  height: number,
  pixelScale: number,
): void {
  const gradientStops = buildLinearGradientStops(colours.current, colours.catalyst, colours.future)
  const gradient = ctx.createLinearGradient(0, 0, width, height)
  for (const stop of gradientStops) {
    gradient.addColorStop(stop.offset, stop.color)
  }

  for (let i = 0; i < steps.length; i++) {
    const stepIdx = config.stepIndices ? config.stepIndices[i] : i
    const stepTotal = config.totalStepCount || steps.length
    renderWireframeLayer(ctx, steps[i], stepIdx, stepTotal, config, scale, tx, ty, gradient, pixelScale)
  }
  ctx.globalAlpha = 1
}
```

- [ ] **Step 3: Update the no-blur `renderWireframe` call site**

Find the `switch (config.variant)` block in `render()` (around line 313-323). The wireframe case currently calls the old signature. Update:

Before:

```typescript
      case 'wireframe':
        renderWireframe(offCtx, steps, colours, scaleFactor, translateX, translateY, width, height)
        break
```

After:

```typescript
      case 'wireframe':
        renderWireframe(offCtx, steps, colours, config, scaleFactor, translateX, translateY, width, height, pixelScale)
        break
```

- [ ] **Step 4: Remove wireframe exclusion from the per-layer blur path**

Find the condition that gates the per-layer blur loop (around line 286).

Before:

```typescript
  if (hasLayerBlur && config.variant !== 'wireframe') {
```

After:

```typescript
  if (hasLayerBlur) {
```

- [ ] **Step 5: Add wireframe to the per-layer blur loop's variant dispatch**

Find the variant dispatch inside that loop (around line 297-302).

Before:

```typescript
      if (config.variant === 'filled') {
        renderFilledLayer(tempCtx, steps[i], stepIdx, stepTotal, colours, config, scaleFactor, translateX, translateY, vb)
      } else {
        renderGradientLayer(tempCtx, steps[i], stepIdx, stepTotal, i, steps.length, colours, config, scaleFactor, translateX, translateY, vb)
      }
```

After:

```typescript
      if (config.variant === 'filled') {
        renderFilledLayer(tempCtx, steps[i], stepIdx, stepTotal, colours, config, scaleFactor, translateX, translateY, vb)
      } else if (config.variant === 'wireframe') {
        const wireframeGradientStops = buildLinearGradientStops(colours.current, colours.catalyst, colours.future)
        const wireframeGradient = tempCtx.createLinearGradient(0, 0, width, height)
        for (const stop of wireframeGradientStops) {
          wireframeGradient.addColorStop(stop.offset, stop.color)
        }
        renderWireframeLayer(tempCtx, steps[i], stepIdx, stepTotal, config, scaleFactor, translateX, translateY, wireframeGradient, pixelScale)
      } else {
        renderGradientLayer(tempCtx, steps[i], stepIdx, stepTotal, i, steps.length, colours, config, scaleFactor, translateX, translateY, vb)
      }
```

Note: the gradient is rebuilt every iteration. This is consistent with how `tempCtx` is cleared per iteration (line 292 `tempCtx.clearRect(0, 0, width, height)`) and acceptable — cost is microseconds vs. the per-layer blur itself. The alternative (build gradient once outside the loop and pass it in) would require restructuring the per-layer loop signature; not worth it for this perf delta.

- [ ] **Step 6: Add noise-block guard**

Find the noise block (around line 327-339).

Before:

```typescript
  if (config.noise.enabled) {
```

After:

```typescript
  if (config.noise.enabled && config.variant !== 'wireframe') {
```

- [ ] **Step 7: Run tests and typecheck**

Run: `npx tsc --noEmit`
Expected: still only one error in `src/demo/demo.ts` (the demo's `buildRenderConfig` missing `lineWidth` — landing in Task 4).

Run: `npx vitest run`
Expected: all 140 tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/canvas-renderer.ts
git commit -m "feat(renderer): wireframe parity — layout, blur, line width

Introduces renderWireframeLayer mirroring renderFilledLayer's transform
stack so wireframe layers land in the same screen rects as filled
layers. Refactors renderWireframe to delegate. Removes the wireframe
exclusion from the per-layer blur path. Adds a noise-block guard so
wireframe explicitly skips the noise overlay. Stroke thickness is now
config.lineWidth scaled by pixelScale for resolution independence."
```

---

## Task 3: SVG export — per-step wireframe transforms + noise gate

**Files:**
- Modify: `src/core/svg-export.ts` (`wireframeBody` applies per-step transforms; stroke width compensated for stepScale)

The `demo.ts` side (the `exportSVG` function: stroke-width value computation, noise gating in `svgConfig`) is part of Task 4, because it depends on the demo config having `lineWidth` available.

- [ ] **Step 1: Rewrite `wireframeBody` to apply per-step transforms**

In `src/core/svg-export.ts`, find `wireframeBody` (around line 118-133).

Before:

```typescript
function wireframeBody(config: SVGExportConfig): string {
  const bt = config.baseTransform
  const paths = config.steps.map(step => {
    const sw = step.strokeWidth ?? 1.5
    return `<path d="${step.path}" stroke="url(#wireStroke)" stroke-width="${sw}" fill="none" opacity="${step.opacity}"/>`
  }).join('\n      ')

  const noise = noiseOverlay(config)

  if (bt) {
    return `<g transform="translate(${bt.translateX},${bt.translateY}) scale(${bt.scale})">
      ${paths}${noise}
    </g>`
  }
  return paths + noise
}
```

After:

```typescript
function wireframeBody(config: SVGExportConfig): string {
  const bt = config.baseTransform
  // Match filledGradientBody's per-step transform pattern. Inside the base-transform
  // group, coordinates are in shape-space, so step offsets must be divided by baseScale.
  const baseScale = bt?.scale ?? 1

  const paths = config.steps.map(step => {
    const { scale: stepScale, offsetX, offsetY } = step.transform
    const [cx, cy] = step.centroid

    const shapeOffsetX = offsetX / baseScale
    const shapeOffsetY = offsetY / baseScale
    const tx = cx + shapeOffsetX
    const ty = cy + shapeOffsetY

    const needsTransform = stepScale !== 1 || shapeOffsetX !== 0 || shapeOffsetY !== 0
    const stepTransform = needsTransform
      ? ` transform="translate(${tx},${ty}) scale(${stepScale}) translate(${-cx},${-cy})"`
      : ''

    // Stroke width divided by stepScale: when SVG applies scale(stepScale) to a group,
    // stroke widths inside that group scale too. Dividing compensates so the visible
    // stroke thickness stays constant across layers.
    const baseSw = step.strokeWidth ?? 1.5
    const sw = baseSw / stepScale

    return `<path d="${step.path}" stroke="url(#wireStroke)" stroke-width="${sw}" fill="none" opacity="${step.opacity}"${stepTransform}/>`
  }).join('\n      ')

  const noise = noiseOverlay(config)

  if (bt) {
    return `<g transform="translate(${bt.translateX},${bt.translateY}) scale(${bt.scale})">
      ${paths}${noise}
    </g>`
  }
  return paths + noise
}
```

- [ ] **Step 2: Typecheck and tests**

Run: `npx tsc --noEmit`
Expected: still only the one error in `demo.ts` from Task 1 (this task did not touch demo.ts).

Run: `npx vitest run`
Expected: all 140 tests pass. The `svg-export.test.ts` tests do not snapshot exact emitted SVG strings, so the wireframe markup change should not cause regressions; if any do fail, STOP and inspect.

- [ ] **Step 3: Commit**

```bash
git add src/core/svg-export.ts
git commit -m "feat(svg-export): wireframe applies per-step transforms

Mirrors filledGradientBody's per-step group transform pattern so SVG
exports of the wireframe variant produce the same layer geometry as
filled/gradient exports. Stroke width is divided by stepScale inside
each transformed group to keep visible thickness constant across
layers."
```

---

## Task 4: Demo — config defaults, lil-gui restructure, exportSVG wiring

**Files:**
- Modify: `src/demo/demo.ts` (config defaults, `buildRenderConfig`, lil-gui folders, `exportSVG` stroke-width + noise gate)

- [ ] **Step 1: Add `lineWidth` to demo config defaults**

In `src/demo/demo.ts`, find the `config` object literal (around line 21-73). Add `lineWidth: 1.5,` to the layout section (next to `scaleTo`):

Before:

```typescript
  scaleFrom: 1.15,
  scaleTo: 0.95,
  // Gradient controls
  gradientAngle: 90,
```

After:

```typescript
  scaleFrom: 1.15,
  scaleTo: 0.95,
  lineWidth: 1.5,
  // Gradient controls
  gradientAngle: 90,
```

- [ ] **Step 2: Add `lineWidth` to `buildRenderConfig`**

Same file, find `buildRenderConfig` (around line 98-145). Add `lineWidth: config.lineWidth,` after `scaleTo`:

Before:

```typescript
    scaleFrom: config.scaleFrom,
    scaleTo: config.scaleTo,
    gradientAngle: config.gradientAngle,
```

After:

```typescript
    scaleFrom: config.scaleFrom,
    scaleTo: config.scaleTo,
    lineWidth: config.lineWidth,
    gradientAngle: config.gradientAngle,
```

- [ ] **Step 3: Verify tsc is now clean**

Run: `npx tsc --noEmit`
Expected: empty (no errors). All callers of `buildRenderConfig` / `RenderConfig` now supply `lineWidth`.

If errors remain, STOP — the spec did not anticipate other call sites.

- [ ] **Step 4: Move `Variant` into the Shape folder, add `Line Width` control**

Find the `shapeFolder` block (around line 653-656) and the `effectsFolder` block (around line 664-667).

Before (lines 653-667):

```typescript
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
```

After:

```typescript
const shapeFolder = gui.addFolder('Shape')
const variantCtrl = shapeFolder.add(config, 'variant', ['wireframe', 'filled', 'gradient']).name('Variant').onChange(() => {
  syncVariantVisibility()
  onConfigChange()
})
addLockToggle(variantCtrl, 'variant')
addLockToggle(shapeFolder.add(config, 'from', shapeNames).name('From').onChange(onConfigChange), 'from')
addLockToggle(shapeFolder.add(config, 'to', shapeNames).name('To').onChange(onConfigChange), 'to')
addLockToggle(shapeFolder.add(config, 'steps', 5, 15, 1).name('Steps').onChange(onConfigChange), 'steps')
const lineWidthCtrl = shapeFolder.add(config, 'lineWidth', 0.5, 10, 0.1).name('Line Width').onChange(onConfigChange)

function syncVariantVisibility() {
  if (config.variant === 'wireframe') lineWidthCtrl.show()
  else lineWidthCtrl.hide()
}
syncVariantVisibility()

const colourFolder = gui.addFolder('Colour')
addLockToggle(colourFolder.add(config, 'colourFrom', allColourOptions).name('From').onChange(onConfigChange), 'colourFrom')
addLockToggle(colourFolder.add(config, 'colourCatalyst', allColourOptions).name('Catalyst').onChange(onConfigChange), 'colourCatalyst')
addLockToggle(colourFolder.add(config, 'colourTo', allColourOptions).name('To').onChange(onConfigChange), 'colourTo')
addLockToggle(colourFolder.add(config, 'background', backgroundOptions).name('Background').onChange(onConfigChange), 'background')

const grainFolder = gui.addFolder('Film Grain')
grainFolder.add(config, 'noise').name('Noise').onChange(onConfigChange)
grainFolder.add(config, 'noiseOpacity', 0, 0.5, 0.01).name('Noise Opacity').onChange(onConfigChange)
```

Notes on the diff:
- `Variant` moves from the (former) Effects folder to the top of `shapeFolder`. Its `onChange` triggers both visibility sync and the existing `onConfigChange`.
- `Line Width` is a new control added to `shapeFolder` after `steps`. Range `0.5..10` step `0.1` keeps the slider intuitive without exposing degenerate or absurd values.
- `syncVariantVisibility()` mirrors the pattern of `syncFormatVisibility` already used for the Export folder's JPG quality control. Called once after declaration to hide `Line Width` on initial load when variant defaults to `filled`.
- `const effectsFolder = ...` is renamed to `const grainFolder = gui.addFolder('Film Grain')`. The Lock-toggle is intentionally NOT added to the `variant` controller via the previous `addLockToggle(...variant...)` shorthand — we needed the onChange to chain through `syncVariantVisibility`, so the controller is built first, then passed into `addLockToggle`.
- No `effectsFolder` references remain after this edit. If grep finds any lingering `effectsFolder.` references in `demo.ts`, replace them with `grainFolder.` — none are expected.

- [ ] **Step 5: Update `exportSVG` stroke-width and noise gate**

In the same file, find `exportSVG` (around line 845). Two updates inside.

**5a — Stroke width:** Find the strokeWidth line (around line 907-908).

Before:

```typescript
    const scaleFactor = Math.min(screenW / vb[2], screenH / vb[3]) * 0.8
    const strokeWidth = config.variant === 'wireframe' ? 1.5 / scaleFactor : undefined
```

After:

```typescript
    const scaleFactor = Math.min(screenW / vb[2], screenH / vb[3]) * 0.8
    const strokeWidth = config.variant === 'wireframe' ? (config.lineWidth * pixelScale) / scaleFactor : undefined
```

**5b — Noise gate:** Find `svgConfig` assembly (around line 930-952). The line `noise: config.noise,` (around line 936) becomes:

Before:

```typescript
    background: exportConfig.transparentBg ? 'transparent' : config.background,
    variant: config.variant as any,
    noise: config.noise,
    noiseOpacity: config.noiseOpacity,
```

After:

```typescript
    background: exportConfig.transparentBg ? 'transparent' : config.background,
    variant: config.variant as any,
    noise: config.noise && config.variant !== 'wireframe',
    noiseOpacity: config.noiseOpacity,
```

- [ ] **Step 6: Run tests and typecheck**

Run: `npx tsc --noEmit`
Expected: empty (no errors).

Run: `npx vitest run`
Expected: all 140 tests pass.

- [ ] **Step 7: Smoke-test the dev server**

Run: `npx vite`

In the browser:
1. Verify the `Shape` folder contains: Variant, From, To, Steps, Line Width.
2. Variant defaults to `filled` — `Line Width` slider should be **hidden**.
3. Switch Variant to `wireframe` — `Line Width` slider should **appear**. The wireframe should now render with layers fanned out (matching the filled layout).
4. Switch Variant to `gradient` — `Line Width` slider hides again.
5. Verify the `Film Grain` folder exists (formerly `Effects`) and contains only `Noise` + `Noise Opacity`.
6. With Variant=wireframe and Noise on, confirm the noise overlay does NOT appear (skipped per spec).
7. Drag the `Line Width` slider with Variant=wireframe — stroke thickness should change visibly.

If any check fails, STOP and report. Otherwise stop the dev server.

- [ ] **Step 8: Commit**

```bash
git add src/demo/demo.ts
git commit -m "feat(demo): move Variant + Line Width to Shape folder

Reorganizes lil-gui per the spec: Variant moves from Effects to Shape,
new Line Width control added to Shape with visibility gated on
variant=wireframe. Effects folder renamed to Film Grain. exportSVG
now uses config.lineWidth * pixelScale for stroke thickness and
explicitly drops noise from wireframe SVG output."
```

---

## Task 5: End-to-end manual validation

No code changes. Visual confirmation that wireframe parity is delivered across both raster and SVG export paths.

- [ ] **Step 1: Run dev server**

Run: `npx vite`

- [ ] **Step 2: Layout parity check**

Configure: `Variant=filled`, `Spread=2`, `ScaleFrom=1.15`, `ScaleTo=0.95`, `Align=center`, `Steps=8`. Note the visual position and scale of each layer.

Switch `Variant=wireframe`. The wireframe strokes should land at the same per-layer positions and scales as the filled silhouettes did. Specifically: front layer (largest) at the front; back layer (smallest) at the back; both fanned along `Align=center`.

If the wireframe collapses to overlapping silhouettes at one position, Task 2 did not land correctly — STOP and inspect.

- [ ] **Step 3: Blur parity check**

With `Variant=wireframe`, enable `Layer Blur` with From=8, To=0. Confirm the back-most stroke is visibly blurred and the front-most stroke is sharp.

Enable `Mask Blur` with radius ~15. Confirm the linear-gradient masked blur region applies to the wireframe.

Disable both. Confirm the wireframe is sharp again.

- [ ] **Step 4: Line Width slider check**

With `Variant=wireframe`, drag the `Line Width` slider from 0.5 to 10. Confirm the stroke thickness varies smoothly and is visually proportional to the slider value. At Line Width=1.5 (default), the stroke should match what wireframe looked like before this branch (modulo the layout fix).

- [ ] **Step 5: Noise skipped on wireframe**

With `Variant=wireframe`, toggle the `Film Grain → Noise` control. Confirm there is no visible noise overlay either way. With `Variant=filled`, toggling `Noise` should show/hide grain as expected. (Sanity check that the Film Grain folder still works for non-wireframe variants.)

- [ ] **Step 6: High-res PNG export of wireframe**

Switch to `Variant=wireframe`, configure something representative (blur + non-default line width + a few step layers). Note the live canvas pixel dimensions. In Export folder: set Width/Height to 4× the live canvas dimensions, format PNG, click Export.

Open the resulting PNG in a viewer at fit-to-window. Compare to the live preview at the same display size. Wireframe stroke thickness, blur amount, and layer positions should all look proportionally identical.

- [ ] **Step 7: SVG export of wireframe**

Same configuration. Switch Export format to SVG, click Export. Open the SVG file in a browser. Compare to the live preview at matched display size. Layers should line up; stroke thickness should match; noise should NOT be present (gated at SVG level too).

- [ ] **Step 8: Filled/gradient regression check**

Switch to `Variant=filled`, then `Variant=gradient`. Confirm each renders as before this branch. Adjust all the layout/gradient controls briefly to confirm no regression.

- [ ] **Step 9: Push branch**

If all checks pass:

```bash
git push -u origin feat/wireframe-parity
```

If any check fails, return to the offending task and identify the missed change.

---

## Self-Review Checklist (already done by plan author)

- ✅ Spec section "Renderer changes — Layout transforms" → Task 2 Steps 1, 2, 5
- ✅ Spec section "Renderer changes — Refactor" → Task 2 Steps 1, 2, 3, 5
- ✅ Spec section "Renderer changes — Line width math" → Task 2 Step 1 (formula matches spec)
- ✅ Spec section "Renderer changes — Remove wireframe exclusion from blur" → Task 2 Step 4
- ✅ Spec section "Renderer changes — Skip noise in wireframe" → Task 2 Step 6
- ✅ Spec section "Config schema — RenderConfig.lineWidth" → Task 1 Step 2
- ✅ Spec section "Config schema — Web Component line-width attribute" → Task 1 Step 5
- ✅ Spec section "Demo / lil-gui — folder restructure" → Task 4 Step 4
- ✅ Spec section "Demo / lil-gui — show/hide" → Task 4 Step 4 (`syncVariantVisibility`)
- ✅ Spec section "Demo / lil-gui — randomize" → not modified, lineWidth stays at user/default value per spec
- ✅ Spec section "Demo / lil-gui — buildRenderConfig" → Task 4 Step 2
- ✅ Spec section "SVG export — wireframeBody per-step transforms" → Task 3 Step 1
- ✅ Spec section "SVG export — exportSVG line width" → Task 4 Step 5a
- ✅ Spec section "SVG export — noise gate" → Task 4 Step 5b
- ✅ Spec section "Testing — manual validation" → Task 5 in full
- ✅ Out-of-scope items (per-layer conic gradients, inside-stroke alignment, line cap/join, noise in wireframe) correctly excluded from all tasks
- ✅ No placeholders — every code edit shows full before/after
- ✅ Type consistency — `renderWireframeLayer(ctx, step, stepIdx, stepTotal, config, scale, tx, ty, gradient, pixelScale)` signature used identically at the no-blur call site and the blur-path call site
- ✅ `config.lineWidth` named consistently in renderer, component, demo, and SVG export sites
- ✅ `pixelScale` available at every site that needs it — already computed in `render()` (per the blur-resolution-scaling fix) and re-computed at the top of `exportSVG`
