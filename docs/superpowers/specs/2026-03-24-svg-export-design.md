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

- **File size:** Base64 PNG per layer adds ~100-400KB total (vs ~5KB for pure vector paths).
- **Gradient editability:** Can't click the gradient in Illustrator to change colours — must re-export from Brand Shapes.

## SVG Structure

### Wireframe Variant

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <defs>
    <linearGradient id="wireStroke" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#4B01E6"/>
      <stop offset="29.3%" stop-color="#FEA6E1"/>
      <stop offset="45.9%" stop-color="#BEF958"/>
      <stop offset="100%" stop-color="#4B01E6"/>
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

For filled and gradient variants, the conic gradient for each layer must be rasterized to a PNG:

- **Resolution:** 2048x2048 pixels (covers the shape viewBox area at high DPI)
- **Method:** Use an offscreen `<canvas>` element, draw the conic gradient with `createConicGradient()`, export as PNG via `canvas.toDataURL('image/png')`
- **Per-layer:** Each layer gets its own gradient image because the conic gradient angle rotates per step (`90deg + (stepIndex / totalSteps) * 120deg`)
- **Centroid:** Gradient is centered on the path centroid (same as the canvas renderer)
- **Encoding:** Base64-encoded, embedded directly in the SVG as `data:image/png;base64,...`

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
- The `<feTurbulence>` noise won't look identical to the canvas noise (different algorithm, different seed) but serves the same visual purpose

## What's Excluded

- **Blur:** Not included in SVG export (per design decision)
- **Animations:** SVG export is static only — captures the current frame
- **Audio-reactive state:** If audio animation is running, exports the current deformed state as static

## Per-Layer Transforms

Each layer has:
- **Scale:** `scaleFrom + (scaleTo - scaleFrom) * t` where `t` is layer position (0=back, 1=front)
- **Offset:** Alignment-based offset (`left`/`right`/`top`/`bottom`/`center`) scaled by `spread`
- **Opacity:** Wireframe uses `1 - (i / n) * 0.6`. Gradient variant uses `t * t` (quadratic). Filled is full opacity.

These are applied as SVG `transform` and `opacity` attributes, matching the canvas renderer's `computeStepTransform()` logic exactly.

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
  viewBox: number[]            // [x, y, w, h] from the source shape
  background: string           // hex colour or 'transparent'
  variant: 'wireframe' | 'filled' | 'gradient'
  noise: boolean
  steps: SVGExportStep[]
}

interface SVGExportStep {
  path: string                 // SVG path d attribute
  transform: {
    scale: number
    offsetX: number
    offsetY: number
  }
  opacity: number
  gradientImage?: string       // base64 PNG data URL (filled/gradient only)
  gradientAngle?: number       // conic gradient angle in radians
  strokeColour?: string        // wireframe only
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

### Integration with Existing Code

- Reuses `computeStepTransform()` from `canvas-renderer.ts` (may need to extract to shared util)
- Reuses `buildLinearGradientStops()` from `effects.ts` for wireframe gradient
- Reuses `pathCentroid()` from `canvas-renderer.ts` (may need to extract)
- Gradient rasterization reuses the same `createConicGradient()` pattern as the canvas renderer

## GUI

Add to the existing Export folder in lil-gui:

| Control | Type | Notes |
|---------|------|-------|
| Export SVG | Button | Triggers SVG generation and download |

No additional settings — the SVG export uses whatever is currently configured (variant, colours, shapes, noise, etc.).

## Phase Plan

### Phase 1: SVG String Generation
- Create `src/core/svg-export.ts`
- `generateSVG()` pure function — takes config + pre-rasterized gradient images, returns SVG string
- Handles all three variants (wireframe, filled, gradient)
- Includes noise filter when enabled
- Unit tests for SVG structure (path count, gradient refs, transforms)

### Phase 2: Gradient Rasterization
- Helper to render conic gradient to canvas and export as base64 PNG
- Per-layer gradient with correct angle rotation and centroid positioning
- Lives in demo-side code (needs canvas context)

### Phase 3: Demo Integration
- "Export SVG" button in Export GUI folder
- Collects current state (paths from animation or static, config)
- Rasterizes gradients for each layer
- Calls `generateSVG()` and triggers browser download

### Phase 4: Cross-Platform Verification
- Test exported SVGs in: Chrome, Firefox, Safari, PowerPoint, Google Slides, Keynote, Illustrator
- Verify vector edges scale cleanly
- Verify noise filter degrades gracefully in non-browser tools
