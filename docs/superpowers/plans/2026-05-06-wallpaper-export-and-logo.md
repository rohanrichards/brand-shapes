# Wallpaper Export & Logo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user export brand-shape art at any pixel dimensions (1080p screen → A0 print) and overlay a Portable "P/" logo in the bottom-left, scaled proportionally.

**Architecture:** Refactor `render()` to accept an explicit `RenderTarget = { width, height, dpr }` so both live preview and offscreen export share one render path. Inline the two logo SVGs as Path2D-friendly TS constants in `src/core/logo.ts`; render via Path2D in canvas, embed inline in SVG export. Live preview reframes its canvas to letterbox the export aspect ratio inside the window so composition is WYSIWYG.

**Tech Stack:** TypeScript (strict), Vite, Vitest (node env), Canvas 2D API, Lit, lil-gui.

**Spec:** `docs/superpowers/specs/2026-05-06-wallpaper-export-and-logo-design.md`

---

## File Map

| Path | Status | Responsibility |
|---|---|---|
| `src/core/logo.ts` | NEW | Pure logo data (path strings, colors, dims) + `computeLogoPlacement` |
| `__tests__/logo.test.ts` | NEW | Placement math, all reference cases |
| `src/demo/assets/logo-source-black.svg` | NEW | Verbatim source SVG (traceability) |
| `src/demo/assets/logo-source-white.svg` | NEW | Verbatim source SVG (traceability) |
| `src/renderer/canvas-renderer.ts` | CHANGE | New `RenderTarget` arg; `drawLogo` final pass |
| `src/core/svg-export.ts` | CHANGE | Accept optional `logo`; emit inline `<g>` with paths |
| `__tests__/svg-export.test.ts` | CHANGE | Add tests for logo block presence, transform, fills |
| `src/demo/demo.ts` | CHANGE | New Export folder (W/H/format/quality/transparent), Logo folder, letterbox preview math, offscreen-canvas raster export |
| `CHANGELOG.md` | CHANGE | Note the feature |

**No automated tests added for `canvas-renderer.ts`.** The vitest environment is `node` and the project has no existing canvas-renderer tests; setting up jsdom + canvas-mock just for the logo invocation would be heavy. Logo math is fully covered by `logo.ts` tests; renderer changes verified via dev-server validation in Task 9.

---

## Task 1: Create `src/core/logo.ts` with constants and placement math

**Files:**
- Test: `__tests__/logo.test.ts`
- Create: `src/core/logo.ts`

- [ ] **Step 1.1: Write failing tests**

Create `__tests__/logo.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  computeLogoPlacement,
  LOGO_VIEWBOX,
  LOGO_BASE,
  LOGO_REFERENCE,
  LOGO_PATHS,
  LOGO_FILL,
} from '../src/core/logo'

describe('logo constants', () => {
  it('exposes the source SVG viewBox', () => {
    expect(LOGO_VIEWBOX).toEqual({ width: 240, height: 213 })
  })
  it('exposes the template-spec base size and padding', () => {
    expect(LOGO_BASE).toEqual({ width: 100, height: 88, padding: 48 })
  })
  it('uses 1920x1080 as the reference canvas', () => {
    expect(LOGO_REFERENCE).toEqual({ width: 1920, height: 1080 })
  })
  it('exports two non-empty path strings', () => {
    expect(LOGO_PATHS.body.length).toBeGreaterThan(50)
    expect(LOGO_PATHS.slash.length).toBeGreaterThan(20)
    expect(LOGO_PATHS.body).toMatch(/^M/)
    expect(LOGO_PATHS.slash).toMatch(/^M/)
  })
  it('exports black and white fill colors', () => {
    expect(LOGO_FILL.black).toBe('#181818')
    expect(LOGO_FILL.white).toBe('#FCFCFC')
  })
})

describe('computeLogoPlacement', () => {
  it('at template dims (1920x1080) returns exact spec', () => {
    const p = computeLogoPlacement(1920, 1080)
    expect(p.scale).toBe(1)
    expect(p.width).toBe(100)
    expect(p.height).toBe(88)
    expect(p.padding).toBe(48)
    expect(p.x).toBe(48)
    expect(p.y).toBe(1080 - 48 - 88)
  })

  it('at 4K (3840x2160) doubles everything', () => {
    const p = computeLogoPlacement(3840, 2160)
    expect(p.scale).toBe(2)
    expect(p.width).toBe(200)
    expect(p.height).toBe(176)
    expect(p.padding).toBe(96)
    expect(p.x).toBe(96)
    expect(p.y).toBe(2160 - 96 - 176)
  })

  it('at A0 portrait (9933x14043) is width-bound (min picks W ratio)', () => {
    const p = computeLogoPlacement(9933, 14043)
    // 9933/1920 = 5.1734, 14043/1080 = 13.0028 -> min = 5.1734
    expect(p.scale).toBeCloseTo(5.1734, 3)
    expect(p.width).toBeCloseTo(517.34, 1)
    expect(p.height).toBeCloseTo(455.26, 1)
    expect(p.padding).toBeCloseTo(248.32, 1)
    expect(p.x).toBeCloseTo(248.32, 1)
    expect(p.y + p.height + p.padding).toBeCloseTo(14043, 1)
  })

  it('at A0 landscape (14043x9933) is width-bound (the smaller ratio)', () => {
    const p = computeLogoPlacement(14043, 9933)
    // 14043/1920 = 7.3140, 9933/1080 = 9.1972 -> min = 7.3140
    expect(p.scale).toBeCloseTo(7.3140, 3)
    expect(p.x).toBeCloseTo(p.padding, 3)
    expect(p.y + p.height + p.padding).toBeCloseTo(9933, 1)
  })

  it('at portrait phone (1080x1920) is width-bound and small', () => {
    const p = computeLogoPlacement(1080, 1920)
    // min(1080/1920, 1920/1080) = min(0.5625, 1.7778) = 0.5625
    expect(p.scale).toBeCloseTo(0.5625, 4)
    expect(p.width).toBeCloseTo(56.25, 2)
    expect(p.height).toBeCloseTo(49.5, 2)
  })

  it('positions logo at bottom-left: x equals padding', () => {
    const p = computeLogoPlacement(2000, 1500)
    expect(p.x).toBe(p.padding)
  })

  it('positions logo at bottom-left: y + height + padding equals canvas height', () => {
    const p = computeLogoPlacement(2000, 1500)
    expect(p.y + p.height + p.padding).toBeCloseTo(1500, 6)
  })
})
```

- [ ] **Step 1.2: Run tests to verify they fail**

Run: `cd "F:/Documents/GitHub/brand-shapes" && npx vitest run __tests__/logo.test.ts`
Expected: FAIL — module `../src/core/logo` does not exist.

- [ ] **Step 1.3: Create `src/core/logo.ts` with the minimum to pass**

```typescript
// src/core/logo.ts
//
// Pure logo data and placement math. Zero DOM dependencies.
//
// The two path strings are copied verbatim from src/demo/assets/logo-source-*.svg.
// The body path uses fill-rule="evenodd" (the P has a hole); slash is a simple parallelogram.

export type LogoColor = 'black' | 'white'

export const LOGO_VIEWBOX = { width: 240, height: 213 } as const
export const LOGO_BASE = { width: 100, height: 88, padding: 48 } as const
export const LOGO_REFERENCE = { width: 1920, height: 1080 } as const

export const LOGO_PATHS = {
  body: 'M0 0.996613V212.997H47.8309V154.305H86.4413C97.8708 154.305 108.196 152.235 117.416 148.096C126.733 143.956 134.656 138.387 141.187 131.39C147.815 124.392 152.905 116.261 156.459 106.997C160.013 97.7321 161.789 87.9747 161.789 77.7245C161.789 67.376 160.013 57.5695 156.459 48.3048C152.905 39.0405 147.815 30.9091 141.187 23.9114C134.656 16.9138 126.733 11.3455 117.416 7.20585C108.196 3.06624 97.8708 0.996613 86.4413 0.996613H0ZM80.5345 114.241H47.8309V41.0609H80.5345C85.5289 41.0609 90.0911 42.0956 94.2211 44.1656C98.351 46.1365 101.809 48.7975 104.594 52.1487C107.475 55.4012 109.684 59.2942 111.221 63.8279C112.854 68.2632 113.67 72.8952 113.67 77.7245C113.67 82.5539 112.854 87.1862 111.221 91.6216C109.684 96.0565 107.475 99.9496 104.594 103.301C101.809 106.553 98.303 109.214 94.077 111.284C89.947 113.255 85.4328 114.241 80.5345 114.241Z',
  slash: 'M240 4.20461L94.7983 212.997H74.0907L219.876 4.20461H240Z',
} as const

export const LOGO_FILL = { black: '#181818', white: '#FCFCFC' } as const

export interface LogoPlacement {
  /** Top-left x of the logo box, in canvas pixels */
  x: number
  /** Top-left y of the logo box, in canvas pixels */
  y: number
  /** Logo box width in canvas pixels */
  width: number
  /** Logo box height in canvas pixels */
  height: number
  /** Scaled padding from canvas edges in canvas pixels */
  padding: number
  /** Multiplier from base (100x88, 48 padding) to canvas dims */
  scale: number
}

/**
 * Place the logo at bottom-left, scaled proportionally to the export canvas.
 *
 * Rule: scale = min(canvasWidth / 1920, canvasHeight / 1080).
 * `min()` keeps the logo from blowing up disproportionately on extreme aspects
 * (e.g., wide banners — width-only scaling would yield a giant logo there).
 */
export function computeLogoPlacement(
  canvasWidth: number,
  canvasHeight: number,
): LogoPlacement {
  const scale = Math.min(
    canvasWidth / LOGO_REFERENCE.width,
    canvasHeight / LOGO_REFERENCE.height,
  )
  const width = LOGO_BASE.width * scale
  const height = LOGO_BASE.height * scale
  const padding = LOGO_BASE.padding * scale
  return {
    x: padding,
    y: canvasHeight - padding - height,
    width,
    height,
    padding,
    scale,
  }
}
```

- [ ] **Step 1.4: Run tests to verify they pass**

Run: `cd "F:/Documents/GitHub/brand-shapes" && npx vitest run __tests__/logo.test.ts`
Expected: 9 passing.

- [ ] **Step 1.5: Commit**

```bash
cd "F:/Documents/GitHub/brand-shapes" && git add src/core/logo.ts __tests__/logo.test.ts && git commit -m "feat(logo): add pure logo geometry and placement math"
```

---

## Task 2: Copy source SVGs into project

**Files:**
- Create: `src/demo/assets/logo-source-black.svg`
- Create: `src/demo/assets/logo-source-white.svg`

These files are not imported by code — they exist as canonical sources so the path strings inlined into `logo.ts` can be regenerated/verified later.

- [ ] **Step 2.1: Copy the two source SVGs**

```bash
mkdir -p "F:/Documents/GitHub/brand-shapes/src/demo/assets" && \
  cp "C:/Users/rohan/Downloads/P-logo-simple-black.svg" "F:/Documents/GitHub/brand-shapes/src/demo/assets/logo-source-black.svg" && \
  cp "C:/Users/rohan/Downloads/P-logo-simple-white.svg" "F:/Documents/GitHub/brand-shapes/src/demo/assets/logo-source-white.svg"
```

- [ ] **Step 2.2: Verify paths in source SVGs match constants in logo.ts**

Run: `cd "F:/Documents/GitHub/brand-shapes" && grep -c '0\.996613' src/demo/assets/logo-source-black.svg src/demo/assets/logo-source-white.svg src/core/logo.ts`
Expected: each file shows `≥1` (the body path's first numeric coordinate appears in all three).

- [ ] **Step 2.3: Commit**

```bash
cd "F:/Documents/GitHub/brand-shapes" && git add src/demo/assets/logo-source-black.svg src/demo/assets/logo-source-white.svg && git commit -m "chore(assets): add Portable logo source SVGs (black/white)"
```

---

## Task 3: Refactor `render()` to take an explicit `RenderTarget`

**Files:**
- Modify: `src/renderer/canvas-renderer.ts`
- Modify: `src/demo/demo.ts` (single call site)

The current `render(canvas, config)` reads `canvas.clientWidth/Height` and `window.devicePixelRatio` directly. This task makes those caller-supplied so export can drive the renderer at any size.

- [ ] **Step 3.1: Add `RenderTarget` interface and update `render` signature**

In `src/renderer/canvas-renderer.ts`, add to the public exports near the top (after the existing `Variant` and `Alignment` exports):

```typescript
export interface RenderTarget {
  /** Logical canvas pixels (CSS px). Backing-store size is width * dpr. */
  width: number
  height: number
  /** Backing-store density. 1 for export at absolute pixel sizes; window.devicePixelRatio for live preview. */
  dpr: number
}
```

Then change the `render` function signature and replace its first three lines that read from canvas/window. Locate the function (currently around line 161):

**Before:**
```typescript
export function render(canvas: HTMLCanvasElement, config: RenderConfig): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  canvas.width = width * dpr
  canvas.height = height * dpr
  ctx.scale(dpr, dpr)
```

**After:**
```typescript
export function render(canvas: HTMLCanvasElement, config: RenderConfig, target: RenderTarget): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const { width, height, dpr } = target
  canvas.width = width * dpr
  canvas.height = height * dpr
  ctx.scale(dpr, dpr)
```

The rest of the function body keeps its existing references to `width`, `height`, `dpr` — those names are now scoped from `target`.

- [ ] **Step 3.2: Update the demo call site to pass `target`**

In `src/demo/demo.ts`, find every call to `render(canvas, ...)`. Each must now pass a `RenderTarget`. Use `grep` to find them:

Run: `cd "F:/Documents/GitHub/brand-shapes" && grep -n "render(canvas" src/demo/demo.ts`

For each call, replace with:
```typescript
const dpr = window.devicePixelRatio || 1
render(canvas, buildRenderConfig(config), {
  width: canvas.clientWidth,
  height: canvas.clientHeight,
  dpr,
})
```

(Adjust `buildRenderConfig(config)` to whatever the existing call already passes as the second arg — do not change config logic in this task, only add the target arg.)

- [ ] **Step 3.3: Type-check**

Run: `cd "F:/Documents/GitHub/brand-shapes" && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3.4: Run all tests**

Run: `cd "F:/Documents/GitHub/brand-shapes" && npx vitest run`
Expected: all tests pass (no regressions).

- [ ] **Step 3.5: Manual sanity check**

Reload the dev server (`http://localhost:5173`). The shape should still render full-window as before. Note: this task does NOT yet implement letterboxing — preview behavior is identical to before; just the renderer plumbing changed.

- [ ] **Step 3.6: Commit**

```bash
cd "F:/Documents/GitHub/brand-shapes" && git add src/renderer/canvas-renderer.ts src/demo/demo.ts && git commit -m "refactor(renderer): accept explicit RenderTarget for export-driven dims"
```

---

## Task 4: Add `drawLogo` final pass to the canvas renderer

**Files:**
- Modify: `src/renderer/canvas-renderer.ts`

- [ ] **Step 4.1: Import logo module**

At the top of `src/renderer/canvas-renderer.ts`, add to the existing imports:

```typescript
import {
  LOGO_PATHS,
  LOGO_FILL,
  LOGO_VIEWBOX,
  computeLogoPlacement,
  type LogoColor,
} from '../core/logo'
```

- [ ] **Step 4.2: Extend `RenderConfig` with optional `logo`**

In the same file, find `export interface RenderConfig {` and add after the last existing field, before the closing `}`:

```typescript
  /** When set, draws the Portable logo overlay in the bottom-left. */
  logo?: { color: LogoColor }
```

- [ ] **Step 4.3: Add `drawLogo` private function**

Add this function below `applyMaskedBlur` and above `export function render` in `src/renderer/canvas-renderer.ts`:

```typescript
/**
 * Draws the Portable logo at the bottom-left corner, scaled proportionally to canvas dims.
 * Path data is fixed (Portable brand assets, see src/core/logo.ts).
 */
function drawLogo(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  color: LogoColor,
): void {
  const placement = computeLogoPlacement(width, height)
  const sx = placement.width / LOGO_VIEWBOX.width
  const sy = placement.height / LOGO_VIEWBOX.height

  ctx.save()
  ctx.translate(placement.x, placement.y)
  ctx.scale(sx, sy)
  ctx.fillStyle = LOGO_FILL[color]

  const body = new Path2D(LOGO_PATHS.body)
  ctx.fill(body, 'evenodd')

  const slash = new Path2D(LOGO_PATHS.slash)
  ctx.fill(slash)

  ctx.restore()
}
```

- [ ] **Step 4.4: Invoke `drawLogo` at the end of `render`**

Find the final lines of `render` (after all noise/blur compositing). Just before the function's closing brace, add:

```typescript
  if (config.logo) {
    drawLogo(ctx, width, height, config.logo.color)
  }
```

This goes at the end so the logo sits on top of all rendered layers (including blur and noise).

- [ ] **Step 4.5: Type-check and test**

Run: `cd "F:/Documents/GitHub/brand-shapes" && npx tsc --noEmit && npx vitest run`
Expected: no type errors; all tests pass.

- [ ] **Step 4.6: Manual visual check**

In the dev server, open the browser console and run:

```javascript
// Temporarily inject logo into config to verify rendering
window.__demo_test_logo = true
```

Then in `src/demo/demo.ts` we'll wire the GUI in Task 7. For now, make a one-off temporary edit at the existing config object: add `logo: { color: 'black' }` and reload. Confirm the P/ logo appears bottom-left. Revert the temporary edit before committing.

- [ ] **Step 4.7: Commit**

```bash
cd "F:/Documents/GitHub/brand-shapes" && git add src/renderer/canvas-renderer.ts && git commit -m "feat(renderer): draw Portable logo overlay when config.logo set"
```

---

## Task 5: Extend SVG export with logo block

**Files:**
- Modify: `src/core/svg-export.ts`
- Modify: `__tests__/svg-export.test.ts`

- [ ] **Step 5.1: Add failing tests for logo block**

Append to `__tests__/svg-export.test.ts` before the final closing `})`:

```typescript
describe('generateSVG — logo overlay', () => {
  it('omits logo block when config.logo is undefined', () => {
    const svg = generateSVG(makeWireframeConfig())
    expect(svg).not.toContain('M240 4.20461') // slash path
    expect(svg).not.toContain('#181818')
    expect(svg).not.toContain('#FCFCFC')
  })

  it('includes black logo paths and fill when color=black', () => {
    const svg = generateSVG(makeWireframeConfig({
      width: 1920, height: 1080,
      logo: { color: 'black' },
    }))
    expect(svg).toContain('M240 4.20461') // slash signature
    expect(svg).toContain('M0 0.996613')  // body signature
    expect(svg).toContain('fill="#181818"')
    expect(svg).toContain('fill-rule="evenodd"') // body path attribute
  })

  it('uses white fill when color=white', () => {
    const svg = generateSVG(makeWireframeConfig({
      width: 1920, height: 1080,
      logo: { color: 'white' },
    }))
    expect(svg).toContain('fill="#FCFCFC"')
    expect(svg).not.toContain('fill="#181818"')
  })

  it('places logo at bottom-left with template-spec transform at 1920x1080', () => {
    const svg = generateSVG(makeWireframeConfig({
      width: 1920, height: 1080,
      logo: { color: 'black' },
    }))
    // At 1920x1080: scale=1, x=48, y=1080-48-88=944
    // Logo viewBox is 240x213, target box is 100x88 -> sx=100/240, sy=88/213
    expect(svg).toMatch(/translate\(48[ ,]\s*944\)/)
    expect(svg).toContain('scale(0.41666')  // 100/240
  })

  it('scales placement proportionally for 4K (3840x2160)', () => {
    const svg = generateSVG(makeWireframeConfig({
      width: 3840, height: 2160,
      logo: { color: 'black' },
    }))
    // scale=2: x=96, y=2160-96-176=1888
    expect(svg).toMatch(/translate\(96[ ,]\s*1888\)/)
  })

  it('emits logo as the last block (after viewport-clipped shapes)', () => {
    const svg = generateSVG(makeWireframeConfig({
      width: 1920, height: 1080,
      logo: { color: 'black' },
    }))
    const logoIdx = svg.indexOf('M240 4.20461')
    const closeViewportGroup = svg.lastIndexOf('</g>')
    // Logo should appear after the viewport-clip group closes (so logo is not clipped)
    expect(logoIdx).toBeGreaterThan(closeViewportGroup - 'M240 4.20461'.length)
  })
})
```

- [ ] **Step 5.2: Run tests to verify they fail**

Run: `cd "F:/Documents/GitHub/brand-shapes" && npx vitest run __tests__/svg-export.test.ts`
Expected: 6 new failures (logo handling not yet implemented). Existing tests still pass.

- [ ] **Step 5.3: Add logo support to `svg-export.ts`**

In `src/core/svg-export.ts`:

(a) Import logo module at the top (after the existing import):
```typescript
import {
  LOGO_PATHS,
  LOGO_FILL,
  LOGO_VIEWBOX,
  computeLogoPlacement,
  type LogoColor,
} from './logo'
```

(b) Add `logo` to `SVGExportConfig`. Find `export interface SVGExportConfig {` and add before the closing `}`:
```typescript
  /** When set, embeds the Portable logo overlay in the bottom-left. */
  logo?: { color: LogoColor }
```

(c) Add a `logoBlock` helper function before `export function generateSVG`:
```typescript
function logoBlock(config: SVGExportConfig): string {
  if (!config.logo) return ''
  const placement = computeLogoPlacement(config.width, config.height)
  const sx = placement.width / LOGO_VIEWBOX.width
  const sy = placement.height / LOGO_VIEWBOX.height
  const fill = LOGO_FILL[config.logo.color]
  return `\n  <g transform="translate(${placement.x}, ${placement.y}) scale(${sx}, ${sy})">
    <path fill-rule="evenodd" d="${LOGO_PATHS.body}" fill="${fill}"/>
    <path d="${LOGO_PATHS.slash}" fill="${fill}"/>
  </g>`
}
```

(d) Find the final `return` statement of `generateSVG` (the template literal that builds the `<svg>...`). It currently ends like:

```typescript
  <g clip-path="url(#viewport-clip)">
    ${body}
  </g>
</svg>`
}
```

Add the logo block AFTER the closing `</g>` of the viewport-clip group, BEFORE `</svg>`:

```typescript
  <g clip-path="url(#viewport-clip)">
    ${body}
  </g>${logoBlock(config)}
</svg>`
}
```

- [ ] **Step 5.4: Run tests to verify they pass**

Run: `cd "F:/Documents/GitHub/brand-shapes" && npx vitest run __tests__/svg-export.test.ts`
Expected: all tests pass.

- [ ] **Step 5.5: Run the full test suite**

Run: `cd "F:/Documents/GitHub/brand-shapes" && npx vitest run`
Expected: all suites green.

- [ ] **Step 5.6: Commit**

```bash
cd "F:/Documents/GitHub/brand-shapes" && git add src/core/svg-export.ts __tests__/svg-export.test.ts && git commit -m "feat(svg-export): emit inline logo block when config.logo set"
```

---

## Task 6: Replace export controls in demo (Width / Height / Format / Quality / TransparentBg)

**Files:**
- Modify: `src/demo/demo.ts`

This task replaces the existing Export folder. It also rewrites the raster export to render to an offscreen canvas at user-specified pixel dims (no DPR multiplication).

- [ ] **Step 6.1: Replace the `exportConfig` object**

Find the current declaration in `src/demo/demo.ts` (around line 738):

```typescript
const exportConfig = {
  transparentBg: false,
  highRes: false,
}
```

Replace with:

```typescript
const exportConfig = {
  width: 1920,
  height: 1080,
  format: 'png' as 'png' | 'jpg' | 'svg',
  quality: 0.95,
  transparentBg: false,
}
```

- [ ] **Step 6.2: Replace `exportPNG` with a unified `exportRaster(format)`**

Find the current `exportPNG` function (around line 743) and the `exportSVG` function (around line 774). Replace `exportPNG` entirely with:

```typescript
function exportRaster(format: 'png' | 'jpg'): void {
  const { width, height, quality, transparentBg } = exportConfig
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    alert('Export width and height must be positive numbers.')
    return
  }

  const off = document.createElement('canvas')
  off.width = width
  off.height = height
  // Set CSS size so renderer's canvas.width = width * dpr math (with dpr=1) is consistent
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
    render(off, buildRenderConfig(config), { width, height, dpr: 1 })
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
    a.download = `brand-shape-${width}x${height}.${format === 'jpg' ? 'jpg' : 'png'}`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (format === 'jpg') {
    off.toBlob(callback, mime, quality)
  } else {
    off.toBlob(callback, mime)
  }
}
```

The key differences from the old code: (a) takes `width/height/format/quality` from `exportConfig`; (b) renders to a fresh offscreen canvas at exact pixel dims (no DPR scaling); (c) uses the same `render()` signature as live preview (Task 3 refactor pays off here); (d) handles JPG vs PNG MIME and quality.

`buildRenderConfig` is the existing helper that converts the demo's `config` into a `RenderConfig`. If it doesn't exist with that name, find whatever currently maps demo config → renderer config and use that. (Check the existing call sites updated in Task 3.2.)

- [ ] **Step 6.3: Update `exportSVG` to use export width/height (not live canvas)**

Find inside `exportSVG()` the lines:

```typescript
const screenW = canvas.clientWidth
const screenH = canvas.clientHeight
```

Replace with:

```typescript
const screenW = exportConfig.width
const screenH = exportConfig.height
```

Find the `gradientScaleFactor` computation:

```typescript
const resMultiplier = exportConfig.highRes ? 2 : 1
const gradientScaleFactor = baseScale * (window.devicePixelRatio || 1) * resMultiplier
```

Replace with:

```typescript
// Export at exact pixel dims: rasterized gradient density anchored to the export size,
// not the live preview canvas. dpr=1 keeps gradient scale 1:1 with output pixels.
const gradientScaleFactor = baseScale
```

Find the `noiseTileSize` line:
```typescript
const noiseTileSize = exportConfig.highRes ? 512 : 256
```

Replace with:
```typescript
const noiseTileSize = 256
```

(High-res mode is gone; users now control resolution via Width/Height directly.)

Inside `exportSVG`, change the filename:
```typescript
a.download = 'brand-shape.svg'
```
to:
```typescript
a.download = `brand-shape-${exportConfig.width}x${exportConfig.height}.svg`
```

- [ ] **Step 6.4: Replace the export GUI folder**

Find the existing block (around line 886):

```typescript
const exportFolder = gui.addFolder('Export')
exportFolder.add(exportConfig, 'transparentBg').name('Transparent BG')
exportFolder.add(exportConfig, 'highRes').name('High Res SVG')
exportFolder.add({ exportPNG }, 'exportPNG').name('Export PNG')
exportFolder.add({ exportSVG }, 'exportSVG').name('Export SVG')
```

Replace entirely with:

```typescript
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
```

- [ ] **Step 6.5: Type-check, test, and dev-server smoke test**

Run: `cd "F:/Documents/GitHub/brand-shapes" && npx tsc --noEmit && npx vitest run`
Expected: no errors; all tests pass.

In the dev server: confirm the new Export folder appears with Width / Height / Format / JPG Quality (hidden by default) / Transparent BG / Export. Switch Format to JPG → Quality should appear, Transparent BG should hide. Switch to SVG → Quality hides, Transparent BG shows.

Click Export at default 1920×1080 PNG. Verify the downloaded file is exactly 1920×1080 (use any image viewer to check dimensions).

- [ ] **Step 6.6: Commit**

```bash
cd "F:/Documents/GitHub/brand-shapes" && git add src/demo/demo.ts && git commit -m "feat(demo): replace export folder with Width/Height/Format/Quality controls"
```

---

## Task 7: Add logo controls to demo

**Files:**
- Modify: `src/demo/demo.ts`

- [ ] **Step 7.1: Add `logo` block to the demo config**

In `src/demo/demo.ts`, find the main `config` object (the one that drives the live preview — search for properties like `from`, `to`, `colourFrom`). Add to it:

```typescript
  logoEnabled: false,
  logoColor: 'black' as 'black' | 'white',
```

(Place these near the `background` field for grouping.)

- [ ] **Step 7.2: Pass logo into `RenderConfig` from `buildRenderConfig` (or equivalent)**

Locate the function in `src/demo/demo.ts` that builds the `RenderConfig` passed to `render()`. (Search for the call site to `render(canvas, ...)`.) Add to the returned object:

```typescript
  logo: config.logoEnabled ? { color: config.logoColor } : undefined,
```

- [ ] **Step 7.3: Add the Logo GUI folder**

Add this block right before the existing `const exportFolder = gui.addFolder('Export')` line in `src/demo/demo.ts`:

```typescript
const logoFolder = gui.addFolder('Logo')
logoFolder.add(config, 'logoEnabled').name('Enabled').onChange(onConfigChange)
logoFolder.add(config, 'logoColor', ['black', 'white']).name('Color').onChange(onConfigChange)
```

`onConfigChange` is the existing function that triggers a re-render when config changes (defined earlier in the file — verify its name with grep if uncertain).

- [ ] **Step 7.4: Type-check, test, and visual confirmation**

Run: `cd "F:/Documents/GitHub/brand-shapes" && npx tsc --noEmit && npx vitest run`
Expected: green.

In the dev server: toggle "Logo → Enabled" on. Confirm the P/ logo appears bottom-left at template scale on a 1920×1080-aspect window. Switch color black ↔ white. Confirm the live preview updates immediately.

Export PNG at 1920×1080 with logo enabled. Open the file. Confirm logo is there at bottom-left, ~48px from edges, at the correct color.

Export PNG at 9933×14043 (A0 portrait) with logo enabled. **Warning: this may take 10–60s and produce a 100+ MB file. Skip if your machine is low on memory.** If it succeeds, confirm logo is crisp at native resolution (no fuzzy upscaling).

- [ ] **Step 7.5: Commit**

```bash
cd "F:/Documents/GitHub/brand-shapes" && git add src/demo/demo.ts && git commit -m "feat(demo): add Logo folder with Enabled/Color controls"
```

---

## Task 8: Live-preview letterbox to export aspect

**Files:**
- Modify: `src/demo/demo.ts`
- Modify: `index.html` (CSS for centered canvas + neutral surround)

- [ ] **Step 8.1: Update CSS in index.html**

Open `F:/Documents/GitHub/brand-shapes/index.html`. Find the existing `<style>` block (and the `<canvas>` element). Add the following rules (or update existing rules to match):

```css
body {
  margin: 0;
  background: #1a1a1a;
  overflow: hidden;
}

canvas {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: block;
}
```

The canvas no longer fills the window — it's centered, sized to the export aspect via JS. The body background fills the surround.

- [ ] **Step 8.2: Add `computePreviewTarget` helper**

In `src/demo/demo.ts`, add this function before `function handleResize`:

```typescript
function computePreviewTarget(
  windowW: number,
  windowH: number,
  exportW: number,
  exportH: number,
  dpr: number,
): { width: number; height: number; dpr: number } {
  const exportAspect = exportW / exportH
  const windowAspect = windowW / windowH

  let width: number
  let height: number
  if (windowAspect > exportAspect) {
    // Window is wider than export — pillarbox: fit to height.
    height = windowH
    width = Math.round(height * exportAspect)
  } else {
    // Window is taller (or equal) — letterbox: fit to width.
    width = windowW
    height = Math.round(width / exportAspect)
  }
  return { width, height, dpr }
}
```

- [ ] **Step 8.3: Update `handleResize` to letterbox**

Replace the existing `handleResize` function:

```typescript
function handleResize() {
  canvas.style.width = `${window.innerWidth}px`
  canvas.style.height = `${window.innerHeight}px`
  if (!animId) startCurrentMode()
}
```

With:

```typescript
function handleResize() {
  const dpr = window.devicePixelRatio || 1
  const target = computePreviewTarget(
    window.innerWidth,
    window.innerHeight,
    exportConfig.width,
    exportConfig.height,
    dpr,
  )
  canvas.style.width = `${target.width}px`
  canvas.style.height = `${target.height}px`
  if (!animId) startCurrentMode()
}
```

- [ ] **Step 8.4: Trigger reframe when Width/Height change**

In Task 6.4 the export folder created Width and Height controllers. Update those two `.add(...)` calls to chain `.onChange(handleResize)`:

```typescript
exportFolder.add(exportConfig, 'width', 16, 16384, 1).name('Width (px)').onChange(handleResize)
exportFolder.add(exportConfig, 'height', 16, 16384, 1).name('Height (px)').onChange(handleResize)
```

- [ ] **Step 8.5: Update the live render call's target to use the helper**

Find the place in `src/demo/demo.ts` where `render(canvas, ..., target)` is called for the live preview (modified in Task 3.2). Replace its target argument with the computed letterbox target:

```typescript
const dpr = window.devicePixelRatio || 1
const previewTarget = computePreviewTarget(
  window.innerWidth,
  window.innerHeight,
  exportConfig.width,
  exportConfig.height,
  dpr,
)
render(canvas, buildRenderConfig(config), previewTarget)
```

If there are multiple call sites (e.g., one in `renderStatic`, one inside an animation loop), update each. Use `grep` to locate them: `cd "F:/Documents/GitHub/brand-shapes" && grep -n "render(canvas" src/demo/demo.ts`

- [ ] **Step 8.6: Type-check and run all tests**

Run: `cd "F:/Documents/GitHub/brand-shapes" && npx tsc --noEmit && npx vitest run`
Expected: green.

- [ ] **Step 8.7: Visual confirmation**

In the dev server:
- Default state (1920×1080): on a 16:9 window the canvas fills it. On a non-16:9 window the canvas is letterboxed/pillarboxed and centered with the dark grey surround visible.
- Change Width to 1080 and Height to 1920 (portrait). The canvas reframes immediately to portrait inside the window. The shape composition redraws against the new aspect — different from before.
- Resize the window. Letterbox reframes accordingly.
- Toggle the logo. Logo position scales with the active canvas size (not window size).

- [ ] **Step 8.8: Commit**

```bash
cd "F:/Documents/GitHub/brand-shapes" && git add src/demo/demo.ts index.html && git commit -m "feat(demo): letterbox live preview to export aspect"
```

---

## Task 9: Update CHANGELOG and finalize

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 9.1: Add CHANGELOG entry**

Open `F:/Documents/GitHub/brand-shapes/CHANGELOG.md`. Add at the top:

```markdown
## [Unreleased]

### Added
- **Wallpaper / print export.** Export controls now expose Width, Height, Format (PNG / JPG / SVG), JPG Quality, and Transparent BG. Output is rendered at exact user-specified pixel dimensions, suitable for screen wallpapers (1080p, 4K) and large-format print (A0 at 300 DPI = 9933×14043 px).
- **Portable logo overlay.** New Logo folder with Enabled and Color (black / white) controls. Logo is positioned bottom-left at 100×88 with 48px padding (matching the Zoom template at 1920×1080) and scales proportionally with `min(W/1920, H/1080)` for any export size. Vector-preserved in SVG export, Path2D-rendered in canvas (crisp at any resolution).
- **WYSIWYG live preview.** Canvas now letterboxes to the export aspect ratio inside the window so composition matches the export.

### Changed
- Renderer signature: `render(canvas, config, target)` where `target = { width, height, dpr }`. Previously the renderer read dimensions from `canvas.clientWidth/Height` and `window.devicePixelRatio` directly.
- Removed "High Res SVG" toggle. SVG export resolution is now driven by the user-chosen Width/Height.

### Notes
- A0-sized PNG exports can exceed 200 MB raw and may fail in low-memory browsers. Prefer JPG (quality 0.95) for prints larger than 4K.
```

If `CHANGELOG.md` doesn't have a `[Unreleased]` section convention, just prepend the block at the top below any title.

- [ ] **Step 9.2: Final full-suite test**

Run: `cd "F:/Documents/GitHub/brand-shapes" && npx tsc --noEmit && npx vitest run`
Expected: all green, no type errors.

- [ ] **Step 9.3: Commit**

```bash
cd "F:/Documents/GitHub/brand-shapes" && git add CHANGELOG.md && git commit -m "docs: changelog for wallpaper export and logo overlay"
```

- [ ] **Step 9.4: Final manual validation matrix**

Confirm each row by running it in the dev server:

| # | Setup | Expected |
|---|---|---|
| 1 | Width=1920, Height=1080, PNG, no logo | File is 1920×1080 PNG, no logo |
| 2 | Width=1920, Height=1080, PNG, logo black | Logo at bottom-left within ~1px of template (x=48, y=944, size 100×88) |
| 3 | Width=1920, Height=1080, PNG, logo white, dark bg | White logo visible against dark bg |
| 4 | Width=3840, Height=2160, JPG q=0.95, logo black | File is 3840×2160 JPG, <5MB, logo at 200×176, 96px padding |
| 5 | Width=1080, Height=1920, PNG, logo black | Portrait file, logo scaled smaller (56×49, 27px padding) |
| 6 | Width=1920, Height=1080, SVG, logo black | SVG file opens with logo inline as `<g>`/`<path>` (vector) |
| 7 | Format=PNG, transparent BG, logo enabled | Transparent PNG with logo present |
| 8 | Format=JPG | Transparent BG control hidden, Quality control visible |
| 9 | Format=SVG | Quality hidden, Transparent BG visible |
| 10 | Resize window to non-16:9 | Canvas letterboxes inside window with #1a1a1a surround |
| 11 | Change Height to 1920 (portrait) | Live preview reframes immediately to portrait aspect |

If any row fails, capture which one and report — do not mark the plan complete.

---

## Self-review

**Spec coverage:** every requirement in `2026-05-06-wallpaper-export-and-logo-design.md` maps to a task.

| Spec section | Task |
|---|---|
| D1 (RenderTarget arg) | Task 3 |
| D2 (Path2D logo, inlined) | Tasks 1, 4, 5 |
| D3 (final pass in render and SVG) | Tasks 4, 5 |
| D4 (`min(W/1920, H/1080)` scale) | Task 1 |
| D5 (letterboxed live preview) | Task 8 |
| D6 (export controls: W/H/format/quality/transparent) | Task 6 |
| D7 (filename pattern) | Tasks 6, 6.3 |
| Logo overlay components | Tasks 4, 5 |
| Error handling (zero/oversized dims, getContext null, toBlob null) | Task 6.2 |
| Testing (logo placement) | Task 1 |
| Testing (svg-export logo block) | Task 5 |
| Manual validation | Task 9.4 |

**Placeholder scan:** no TBDs, no "implement later"; every code step shows complete code.

**Type consistency:** `RenderTarget`, `LogoColor`, `LogoPlacement`, `computeLogoPlacement`, `LOGO_PATHS`, `LOGO_FILL`, `LOGO_VIEWBOX` are introduced in Task 1 and referenced consistently in Tasks 3, 4, 5. `exportConfig.{width, height, format, quality, transparentBg}` introduced in Task 6.1, used consistently in 6.2, 6.3, 6.4, 8.4. `computePreviewTarget` introduced in Task 8.2, used in 8.3 and 8.5. `buildRenderConfig` is the project's existing helper — Tasks 3.2 and 6.2 instruct the implementer to find its actual name and use it (rather than mandating a name that may not exist).

No issues found that need fixing.
