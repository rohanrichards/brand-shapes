# Wireframe Variant Feature Parity

**Date:** 2026-05-12
**Status:** Approved, ready for implementation plan
**Branch:** `feat/wireframe-parity`

## Problem

The `wireframe` variant in the brand-shapes renderer currently:

- Ignores layout transforms — every morph-step path is stroked at the base position. `align`, `spread`, `scaleFrom`, `scaleTo` have no effect.
- Cannot be blurred — `canvas-renderer.ts:286` explicitly excludes wireframe from the per-layer blur path, and masked blur is unreachable for the same reason.
- Has a hardcoded `lineWidth = 1.5 / scale` with no user control.
- Does not visually align with filled/gradient variants — switching variant collapses fanned-out layers into a single stack of overlapping silhouettes.

The user's requirement is that wireframe should render the **same shapes in the same positions** as filled/gradient. Placing a wireframe export next to a filled export should produce visually equivalent layer geometry, with each wireframe stroke tracing the corresponding filled silhouette (centered stroke acceptable — exact stroke-edge alignment is not required).

## Goal

- Wireframe layer geometry matches filled/gradient one-for-one.
- Wireframe supports per-layer blur and masked blur, scaled by `pixelScale` per the existing convention.
- Wireframe has a user-controlled line thickness slider, visible only when the variant is selected. Line thickness scales with `pixelScale` so wireframes look identical at any export resolution.
- Wireframe explicitly does **not** apply the noise overlay (grain on thin strokes is visually meaningless; user-confirmed drop).
- lil-gui structure reorganized: `Variant` and `Line Width` move into the `Shape` folder; the `Effects` folder is renamed to `Film Grain` and keeps `Noise` + `Noise Opacity`.

Gradient handling for wireframe (today: one global linear gradient across the canvas) is unchanged. Per-layer conic gradients on strokes are out of scope.

## Design

### Renderer changes (`src/renderer/canvas-renderer.ts`)

**1. Layout transforms applied per step.** Introduce `renderWireframeLayer(ctx, step, stepIdx, stepTotal, totalSteps, colours, config, scale, tx, ty, vb, gradient, pixelScale)` mirroring `renderFilledLayer`'s shape. It applies the same `computeStepTransform(stepIdx, stepTotal, align, spread, scaleFrom, scaleTo)` math to produce `(stepScale, offsetX, offsetY)`, then `ctx.translate(tx + offsetX, ty + offsetY)` / `ctx.scale(scale * stepScale, scale * stepScale)`, then `ctx.stroke(path)`.

**2. Refactor the existing `renderWireframe`** (no-blur fast path) to loop and delegate to `renderWireframeLayer`, so both paths share the per-step transform logic. The cross-canvas linear gradient is built once before the loop, same as today, and reused — Canvas gradients are sampled in canvas space regardless of in-flight ctx transforms.

**3. Line width:** `ctx.lineWidth = (config.lineWidth * pixelScale) / (scale * stepScale)`. Default `config.lineWidth = 1.5` (matches today's pixel thickness at a 1080-canvas with stepScale=1). The `* pixelScale` keeps line thickness proportional across resolutions; the `/ (scale * stepScale)` compensates for the in-flight transform stack so the visible stroke is the same actual pixel thickness on every layer.

**4. Remove wireframe exclusion from the blur path** at `canvas-renderer.ts:286`. The per-layer blur loop becomes:

```ts
if (hasLayerBlur) {
  for each step i:
    clear tempCanvas
    switch (variant):
      case 'wireframe': renderWireframeLayer(...)
      case 'filled':    renderFilledLayer(...)
      case 'gradient':  renderGradientLayer(...)
    apply blur, drawImage to offscreen
}
```

Masked blur (post-composite) already works variant-agnostically; no change needed.

**5. Skip noise in wireframe.** The canvas-renderer noise block gains `&& config.variant !== 'wireframe'` to its guard. In `exportSVG`, the `svgConfig.noise` field is similarly gated: `noise: config.noise && config.variant !== 'wireframe'` — keeps SVG output consistent with the canvas behavior without touching `wireframeBody`'s noise overlay call (which is already a no-op when `noise: false`).

### Config schema

`RenderConfig` (in `canvas-renderer.ts`) gains `lineWidth: number`. Default value: `1.5`. No new nested `WireframeConfig` interface — YAGNI; if more wireframe-only fields appear later, namespace then.

`<brand-shape>` Web Component (`src/component/brand-shape.ts`) gets a `line-width` attribute (kebab-case for HTML, `lineWidth` for the JS property), defaulting to `1.5`.

### Demo / lil-gui changes (`src/demo/demo.ts`)

**1. Folder restructure:**

```ts
const shapeFolder = gui.addFolder('Shape')
shapeFolder.add(config, 'variant', ['wireframe', 'filled', 'gradient']) ...        // MOVED from effectsFolder
shapeFolder.add(config, 'from', shapeNames) ...
shapeFolder.add(config, 'to', shapeNames) ...
shapeFolder.add(config, 'steps', 5, 15, 1) ...
const lineWidthCtrl = shapeFolder.add(config, 'lineWidth', 0.5, 10, 0.1)           // NEW
  .name('Line Width').onChange(onConfigChange)

const grainFolder = gui.addFolder('Film Grain')                                    // RENAMED from 'Effects'
grainFolder.add(config, 'noise') ...
grainFolder.add(config, 'noiseOpacity', 0, 0.5, 0.01) ...
```

Variant goes first in the Shape folder because it determines the entire render style and gates the visibility of Line Width.

**2. Show/hide Line Width based on variant:**

```ts
function syncVariantVisibility() {
  if (config.variant === 'wireframe') lineWidthCtrl.show()
  else lineWidthCtrl.hide()
}
// hook into the existing variant onChange + call once at startup
```

Pattern mirrors the existing `syncFormatVisibility` for the JPG quality slider in the Export folder.

**3. Config object:** add `lineWidth: 1.5` to the demo's `config` defaults. The randomize function does not touch `lineWidth` — it stays at the user-set value or default.

**4. `buildRenderConfig`** passes `lineWidth` through to the renderer.

### SVG export changes

`SVGExportStep.strokeWidth` is already optional; `exportSVG` already computes `strokeWidth = 1.5 / scaleFactor` for wireframe. Update:

```ts
const strokeWidth = config.variant === 'wireframe'
  ? (config.lineWidth * pixelScale) / scaleFactor
  : undefined
```

`wireframeBody` in `src/core/svg-export.ts` needs to apply per-step transforms. Today it emits flat `<path>` elements under one shared `<g transform="...">`. Update to emit per-step transformed paths so layout matches the canvas. The per-step transform values are already computed by `exportSVG` and stored on each `SVGExportStep` (the `transform: { scale, offsetX, offsetY }` field used by the filled/gradient variants); `wireframeBody` just needs to consume them.

```ts
function wireframeBody(config: SVGExportConfig): string {
  const bt = config.baseTransform
  const paths = config.steps.map(step => {
    const t = step.transform
    const sw = step.strokeWidth ?? 1.5
    return `<g transform="translate(${t.offsetX},${t.offsetY}) scale(${t.scale})">
      <path d="${step.path}" stroke="url(#wireStroke)" stroke-width="${sw / t.scale}" fill="none" opacity="${step.opacity}"/>
    </g>`
  }).join('\n      ')

  // ... rest unchanged
}
```

Note the `sw / t.scale` — SVG `stroke-width` is in user-space units, and applying `scale(t.scale)` to the group scales the stroke too, so dividing keeps the visible thickness constant.

### What does not change

- `BlurConfig`, `NoiseConfig` shapes.
- Filled and gradient variant rendering.
- The single-global-linear-gradient color model for wireframe strokes.
- Logo, wireframe noise overlay positioning math, masked blur algorithm.

### Out of scope

- **Per-layer conic gradient strokes for wireframe.** Deferred — revisit only if the layout-fixed wireframe looks visually wrong.
- **Stroke alignment to filled silhouette edge** (inside-only stroke via clip + 2× width). Centered stroke is acceptable per user.
- **Line cap, line join, dashed strokes.** YAGNI.
- **Noise for wireframe.** Explicitly excluded.

## Testing

Following the project's existing pattern (pure-function tests only):

1. **`__tests__/canvas-renderer.test.ts` or extend `__tests__/effects.test.ts`** — if a new pure helper emerges from the refactor (e.g., a `computeWireframeLineWidth(userLineWidth, pixelScale, scale, stepScale)` function), add a unit test for it. If no clean pure helper falls out, no new automated tests are added; the renderer continues to be covered by manual visual validation.
2. **Manual validation** (in the implementation plan, not automated):
   - Side-by-side: variant=filled vs variant=wireframe with identical other config. Layer positions and scales must match.
   - Blur on wireframe: enable per-layer blur, see depth-of-field falloff on strokes. Enable masked blur, see linear gradient blur region working.
   - Line Width slider: visible only when wireframe selected, hidden otherwise. Slider values 0.5 → 10 produce expected thickness variation.
   - High-res export of wireframe (4× preview) — strokes scale proportionally, blur scales proportionally.
   - Film Grain folder works for filled/gradient as before; toggling noise has no effect when variant=wireframe.

## Implementation order

1. Refactor renderer: introduce `renderWireframeLayer`, rewrite `renderWireframe` to delegate, remove blur-path exclusion, add noise-path exclusion.
2. Add `lineWidth` to `RenderConfig` and Web Component, wire through.
3. Update SVG export: `wireframeBody` applies per-step transforms; `exportSVG` uses `config.lineWidth * pixelScale`.
4. lil-gui reorganization: move Variant to Shape, add Line Width with show/hide, rename Effects → Film Grain.
5. Manual validation.

Each numbered item lands as its own commit on `feat/wireframe-parity`.
