# SVG Export — Design Spec

## Overview

Add SVG export to Brand Shapes alongside the existing PNG export. The exported SVG reflects exactly what's on screen — whichever variant (wireframe, filled, gradient) is active, with the current shapes, colours, transforms, and noise. The SVG works in browsers, PowerPoint, Google Slides, Keynote, Illustrator, Affinity Designer, and other tools that consume SVG.

## Use Case

Users generate static brand shape assets for presentations, design tools, and software. PNG export exists but SVG is preferred for scalability and professional use. The exported SVG must look as close to the canvas render as possible while being portable across platforms.

## Core Approach: Vector Clip Paths + Rasterized Gradient Fills

SVG has no native conic/angular gradient. CSS `conic-gradient` via `<foreignObject>` works in browsers but is stripped by PowerPoint, Illustrator, Affinity, Keynote, and Google Slides. Therefore:

- **Wireframe variant:** Pure SVG — stroked `<path>` elements with `<linearGradient>`. No rasterization needed.
- **Filled variant:** Each shape is a `<clipPath>` (vector path) with a high-resolution rasterized conic gradient fill (`<image>` with base64 PNG). Shape edges stay vector-sharp at any scale. The gradient fill renders at 2048x2048 — enough to look crisp at any reasonable size.
- **Gradient variant:** Same approach as filled, but with per-layer opacity ramp (quadratic: `t * t`).

### Why This Works

- **Scales like vector:** Shape edges are true vector clip paths — razor-sharp at any zoom level.
- **Looks correct:** The conic gradient is rendered at source, so it matches the canvas output exactly.
- **Universally portable:** `<clipPath>` + `<image>` is basic SVG 1.1 — every tool supports it.
- **Gradient is smooth:** Conic gradients are smooth colour blends. Even at 1024px they scale well since there are no hard edges to reveal the raster.

### What Users Lose vs Pure Vector

- **File size:** Base64 JPEG per layer (~30-80KB each at quality 90). With 15 layers, total SVG could reach ~500KB-1.2MB. JPEG is used instead of PNG because conic gradients have no transparency and no hard edges — JPEG at quality 90 is visually lossless for smooth gradients and 3-5x smaller than PNG.
- **Gradient editability:** Can't click the gradient in Illustrator to change colours — must re-export from Brand Shapes.

## SVG Structure

### Wireframe Variant

Wireframe uses `buildLinearGradientStops()` from `effects.ts` which returns stops at offsets `0`, `0.45`, `0.55`, `1`. The SVG gradient must use these exact values.

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <defs>
    <linearGradient id="wireStroke" x1="0" y1="0" x2="1" y2="1">
      <!-- stops from buildLinearGradientStops(current, catalyst, future) -->
      <stop offset="0" stop-color="#4B01E6"/>
      <stop offset="0.45" stop-color="#FEA6E1"/>
      <stop offset="0.55" stop-color="#BEF958"/>
      <stop offset="1" stop-color="#4B01E6"/>
    </linearGradient>
    <filter id="noise">
      <feTurbulence type="fractal" baseFrequency="0.65" numOctaves="3" result="noise"/>
      <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise"/>
      <feBlend in="SourceGraphic" in2="grayNoise" mode="overlay"/>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="#000000"/>
  <g filter="url(#noise)">
    <path d="M..." stroke="url(#wireStroke)" stroke-width="1.5" fill="none"
          opacity="1.0" transform="translate(tx,ty) scale(s)"/>
    <path d="M..." stroke="url(#wireStroke)" stroke-width="1.5" fill="none"
          opacity="0.7" transform="translate(tx,ty) scale(s)"/>
    <!-- ...one path per layer -->
  </g>
</svg>
```

### Filled / Gradient Variants

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <defs>
    <filter id="noise">
      <feTurbulence type="fractal" baseFrequency="0.65" numOctaves="3" result="noise"/>
      <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise"/>
      <feBlend in="SourceGraphic" in2="grayNoise" mode="overlay"/>
    </filter>
    <!-- One clipPath per layer -->
    <clipPath id="clip-0">
      <path d="M..."/>
    </clipPath>
    <clipPath id="clip-1">
      <path d="M..."/>
    </clipPath>
    <!-- ...etc -->
  </defs>
  <rect width="100%" height="100%" fill="#000000"/>
  <g filter="url(#noise)">
    <!-- Each layer: rasterized gradient clipped to vector shape -->
    <g clip-path="url(#clip-0)" opacity="1.0"
       transform="translate(cx,cy) scale(stepScale) translate(-cx,-cy) translate(tx,ty) scale(baseScale)">
      <image href="data:image/png;base64,..." width="vbW" height="vbH"/>
    </g>
    <g clip-path="url(#clip-1)" opacity="0.85"
       transform="...">
      <image href="data:image/png;base64,..." width="vbW" height="vbH"/>
    </g>
    <!-- ...one group per layer -->
  </g>
</svg>
```

## Gradient Rasterization

For filled and gradient variants, the conic gradient for each layer must be rasterized:

- **Resolution:** Square canvas, sized to the larger of viewBox width/height, multiplied by a DPI scale factor (e.g., `max(vbW, vbH) * 4` ≈ 656px for a 164-wide viewBox). This keeps the gradient circular (not stretched to the viewBox aspect ratio) while being high enough resolution for crisp output. The `<image>` element in the SVG is positioned and sized to cover the viewBox area, with the gradient centered.
- **Format:** JPEG at quality 0.9 via `canvas.toDataURL('image/jpeg', 0.9)`. Conic gradients have no transparency and no hard edges — JPEG is visually lossless and 3-5x smaller than PNG.
- **Per-layer:** Each layer gets its own gradient image because the conic gradient angle rotates per step (`90deg + (stepIndex / totalSteps) * 120deg`)
- **Centroid:** Filled variant centers on `pathCentroid(path)`. Gradient variant centers on viewBox midpoint. This matches the canvas renderer's two different approaches.
- **Encoding:** Base64-encoded, embedded directly in the SVG as `data:image/jpeg;base64,...`
- **Aspect ratio handling:** The rasterized canvas is square (gradient is circular). The `<image>` element is positioned so the gradient center aligns with the correct centroid, and the image extends beyond the clip path bounds — the clip path crops it to the shape.

## Noise

Applied via SVG `<filter>` using `<feTurbulence>`:

```svg
<filter id="noise">
  <feTurbulence type="fractal" baseFrequency="0.65" numOctaves="3" result="noise"/>
  <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise"/>
  <feBlend in="SourceGraphic" in2="grayNoise" mode="overlay"/>
</filter>
```

- Applied to the entire shape group (`<g filter="url(#noise)">`)
- Included when noise is enabled in the current config
- Degrades gracefully — tools that don't support SVG filters simply skip it, shapes still render correctly
- **Known visual deviation:** `<feTurbulence>` produces deterministic Perlin-like noise, not the random per-pixel static that the canvas renderer generates. The `overlay` blend mode also differs from the canvas `source-atop` compositing. The SVG noise will have a slightly different character — more structured, less random — but serves the same visual purpose of adding texture. This is an accepted tradeoff for keeping the SVG portable (rasterizing the noise would add file size for minimal benefit).

## What's Excluded

- **Blur:** Not included in SVG export (per design decision)
- **Animations:** SVG export is static only — captures the current frame
- **Audio-reactive state:** If audio animation is running, exports the current deformed state as static
- **Transparent background:** When background is `'transparent'`, the `<rect>` background element is omitted entirely from the SVG

## Per-Layer Transforms

Each layer has:
- **Scale:** `scaleFrom + (scaleTo - scaleFrom) * t` where `t` is layer position (0=back, 1=front)
- **Offset:** Alignment-based offset (`left`/`right`/`top`/`bottom`/`center`) scaled by `spread`
- **Opacity:** Wireframe uses `1 - (i / n) * 0.6`. Gradient variant uses `Math.max(0.05, t * t)` (quadratic, min 0.05). Filled is full opacity.

### Transform Math (Critical — differs between variants)

The SVG `viewBox` matches the output dimensions, so the base translate/scale that the canvas renderer applies (`translate(tx,ty) scale(scaleFactor)`) is handled by the SVG viewBox mapping. Only the per-step scale + offset needs to be in the `transform` attribute.

**Filled variant:** Scale and offset are relative to each layer's actual path centroid (computed via `pathCentroid(path)`). This matches the canvas renderer's `renderFilled` which calls `pathCentroid(steps[i])` per layer.

```
centerX = pathCentroid(path).x
centerY = pathCentroid(path).y
transform="translate(centerX + offsetX, centerY + offsetY) scale(stepScale) translate(-centerX, -centerY)"
```

**Gradient variant:** Scale and offset are relative to the fixed viewBox center (`vb[2]/2, vb[3]/2`). This matches the canvas renderer's `renderGradient` which uses the viewBox midpoint.

```
centerX = viewBox.width / 2
centerY = viewBox.height / 2
transform="translate(centerX + offsetX, centerY + offsetY) scale(stepScale) translate(-centerX, -centerY)"
```

**Wireframe variant:** No per-step scale/offset. Just the base transform (handled by SVG viewBox).

### Edge Case: Single Layer (steps === 1)

When `steps === 1`, `t = 0`, so `stepScale = scaleFrom` and gradient opacity = `Math.max(0.05, 0) = 0.05`. This matches the canvas renderer exactly but produces a nearly invisible shape in gradient variant. This is expected behavior — single-layer gradient mode is not a useful configuration.

### Colour Role Mapping (Known Swap)

In `demo.ts`, the GUI labels map to colour roles with a swap:
- `config.colourFrom` → `colours.current`
- `config.colourTo` → `colours.catalyst` (GUI "To" = code "catalyst")
- `config.colourCatalyst` → `colours.future` (GUI "Catalyst" = code "future")

The SVG export must replicate this same mapping. The `SVGExportColours` type uses the code-level names (`current`, `catalyst`, `future`), not the GUI labels.

## Architecture

### New File

```
src/core/svg-export.ts — pure function, no DOM dependency for the SVG string generation
  - generateSVG(config: SVGExportConfig) → string
  - renderConicGradientToPNG(colours, angle, centerX, centerY, width, height) → string (base64)
```

Note: `renderConicGradientToPNG` needs a canvas context (DOM), so it lives as a separate helper that the demo calls before passing base64 strings into `generateSVG`. Alternatively, it can live in a demo-side helper if we want to keep `svg-export.ts` fully pure.

### Types

```typescript
interface SVGExportConfig {
  width: number
  height: number
  viewBox: [number, number, number, number]  // [x, y, w, h] from the source shape
  background: string                         // hex colour or 'transparent'
  variant: 'wireframe' | 'filled' | 'gradient'
  noise: boolean
  colours: SVGExportColours                  // for wireframe linearGradient
  steps: SVGExportStep[]
}

interface SVGExportStep {
  path: string                 // SVG path d attribute
  centroid: [number, number]   // path centroid for transform pivot
  transform: {
    scale: number
    offsetX: number
    offsetY: number
  }
  opacity: number
  strokeWidth?: number         // wireframe only — computed as 1.5 / baseScaleFactor
  gradientImage?: string       // base64 JPEG data URL (filled/gradient only)
}

interface SVGExportColours {
  current: string
  catalyst: string
  future: string
}
```

### Modified Files

```
src/demo/demo.ts
  - Add "Export SVG" button to the Export GUI folder
  - Wire up: collect current paths + config → rasterize gradients → call generateSVG → trigger download
```

### Refactoring: Extract Shared Utilities

Before SVG export implementation, extract these pure functions from `canvas-renderer.ts` into `src/core/transforms.ts`:

- `computeStepTransform()` — used by both canvas renderer and SVG export
- `pathCentroid()` — used by both canvas renderer and SVG export

Both are pure functions with no DOM dependency. The canvas renderer is then updated to import from the new location. This extraction is its own commit before SVG export work begins.

### Integration with Existing Code

- Imports `computeStepTransform()` and `pathCentroid()` from `src/core/transforms.ts`
- Imports `buildLinearGradientStops()` from `effects.ts` for wireframe gradient
- Gradient rasterization reuses the same `createConicGradient()` pattern as the canvas renderer

## GUI

Add to the existing Export folder in lil-gui:

| Control | Type | Notes |
|---------|------|-------|
| Export SVG | Button | Triggers SVG generation and download |

No additional settings — the SVG export uses whatever is currently configured (variant, colours, shapes, noise, etc.).

## Phase Plan

### Phase 0: Prep
- Extract `computeStepTransform()` and `pathCentroid()` from `canvas-renderer.ts` into `src/core/transforms.ts`
- Update `canvas-renderer.ts` to import from new location
- Update CLAUDE.md: remove "No SVG export" from locked decisions
- Verify all existing tests still pass

### Phase 1: SVG String Generation
- Create `src/core/svg-export.ts`
- `generateSVG()` pure function — takes config + pre-rasterized gradient images, returns SVG string
- Handles all three variants (wireframe, filled, gradient)
- Includes noise filter when enabled
- Unit tests for SVG structure (path count, clip paths, gradient refs, transforms, opacity, background omission when transparent)

### Phase 2: Gradient Rasterization
- Helper to render conic gradient to canvas and export as base64 JPEG
- Square canvas sized to `max(vbW, vbH) * 4` for resolution
- Per-layer gradient with correct angle rotation and centroid positioning
- Lives in demo-side code (needs canvas context)

### Phase 3: Demo Integration
- "Export SVG" button in Export GUI folder
- Collects current state (paths from animation or static, config)
- Rasterizes gradients for each layer (filled/gradient variants only)
- Calls `generateSVG()` and triggers browser download

### Phase 4: Cross-Platform Verification
- Test exported SVGs in: Chrome, Firefox, Safari, PowerPoint, Google Slides, Keynote, Illustrator
- Verify vector edges scale cleanly
- Verify noise filter degrades gracefully in non-browser tools
- Verify gradient aspect ratio is correct (circular, not stretched)
