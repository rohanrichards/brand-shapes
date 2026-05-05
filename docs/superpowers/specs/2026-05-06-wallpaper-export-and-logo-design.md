# Wallpaper Export & Logo — Design

**Date:** 2026-05-06
**Branch:** `feat/wallpaper-export-and-logo`
**Status:** Approved (pending final user review)

## Problem

Two related gaps in the brand-shapes generator:

1. **Export dimensions are not user-controllable.** PNG export does `canvas.toBlob()` on the live canvas, which is sized to `window.innerWidth × innerHeight × devicePixelRatio`. Output size is whatever your screen happens to be. A user wants to print procedurally-generated brand art at A0 size (~9933×14043 px @ 300 DPI); today there is no way to produce a file that large.

2. **No logo overlay.** Brand artifacts shipped from this tool need the Portable "P/" logo in the bottom-left corner (per the supplied Zoom template at `1920×1080`, logo bbox `99×87` at `46/47px` padding from edges). There is no mechanism for it today.

## Goals

- User specifies export Width × Height in pixels and gets exactly that file. No hidden DPI multipliers, no presets, no math the user has to do.
- User can toggle a Portable logo overlay (black or white) on/off; size and placement match the template proportionally and scale to any export resolution.
- Live preview WYSIWYG: composition the user sees matches what gets exported, including aspect ratio and logo placement.
- Renderer remains pure (no DOM coupling beyond the canvas it draws to).

## Non-goals

- File size cap. (A0 PNG can run hundreds of MB; that is the user's problem to manage by choosing JPG or smaller dims.)
- DPI metadata stamping. Not needed — print shops override DPI in their own software. Pixel count is what matters.
- Auto logo color. User picks black or white explicitly.
- Logo position/size GUI controls. Fixed bottom-left at 100×88 / 48px padding (proportional to export size).
- Multiple logo brands or a custom logo upload. The two Portable variants are the only logos.

## Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | Refactor `render()` to take an explicit `RenderTarget = { width, height, dpr }` rather than reading `canvas.clientWidth/Height` and `window.devicePixelRatio`. | One source of truth for dimensions. Live preview computes them; export computes them. No DOM-state coupling inside the renderer. |
| D2 | Logo paths inlined into `src/core/logo.ts` as TypeScript constants (extracted verbatim from the source SVGs). Render via `Path2D` in canvas, embed as `<g>` with `<path>` children in SVG export. | Resolution-independent (critical for A0 print where bitmap-upscaling an SVG-as-image goes fuzzy). Zero runtime asset loading. Same path strings drive canvas + SVG export. |
| D3 | Logo composition is a final pass inside `render()`, after blur and noise. SVG export does the same in `generateSVG()`. | Logo is part of the rendered artifact, not a UI overlay. One implementation drives both preview and export. |
| D4 | Logo size and padding scale by `min(width / 1920, height / 1080)` relative to template. | At template dims (1920×1080) → exact spec (100×88, 48px padding). `min()` prevents disproportionate growth on wide banners. Confirmed numerically with user against several common output sizes. |
| D5 | Live preview canvas reframes to letterbox at the export aspect ratio inside the window. | WYSIWYG. Without this, a user setting 1080×1920 (portrait) on a 16:9 window would compose against the wrong aspect and re-tweak/re-export. |
| D6 | No DPI field, no preset dropdown. Just Width / Height / Format / Quality / Transparent BG. | YAGNI. Pixel count is the only thing that affects the file. Print shops override DPI anyway. Adding presets later is trivial if needed. |
| D7 | Filename pattern: `brand-shape-{width}x{height}.{ext}` | Disambiguates multiple exports at different sizes. |

## Architecture

```
src/core/logo.ts                    NEW   pure logo geometry + placement math
src/renderer/canvas-renderer.ts     CHG   render() signature; final logo pass
src/core/svg-export.ts              CHG   accept logo block; emit inline <g>
src/demo/demo.ts                    CHG   new export controls; logo controls; letterbox math
src/demo/assets/logo-source-*.svg   NEW   canonical source SVGs (traceability only;
                                          code uses inlined constants)
__tests__/logo.test.ts              NEW   placement math
__tests__/canvas-renderer.test.ts   CHG   target arg accepted; logo pass invoked
__tests__/svg-export.test.ts        CHG   logo block emitted
```

Module-boundary rules unchanged. Import direction: `demo → renderer → core` (renderer imports `logo` from core; svg-export imports `logo` from core).

## Components

### `src/core/logo.ts` (new)

```ts
export type LogoColor = 'black' | 'white'

export const LOGO_VIEWBOX = { width: 240, height: 213 } as const
export const LOGO_BASE = { width: 100, height: 88, padding: 48 } as const
export const LOGO_REFERENCE = { width: 1920, height: 1080 } as const

export const LOGO_PATHS = {
  // Both strings copied verbatim from the source SVGs in src/demo/assets/.
  // body uses fill-rule="evenodd" (the P has a hole); slash is a simple parallelogram.
  body:  'M0 0.996613V212.997H47.8309V154.305H86.4413C97.8708 154.305 108.196 152.235 117.416 148.096C126.733 143.956 134.656 138.387 141.187 131.39C147.815 124.392 152.905 116.261 156.459 106.997C160.013 97.7321 161.789 87.9747 161.789 77.7245C161.789 67.376 160.013 57.5695 156.459 48.3048C152.905 39.0405 147.815 30.9091 141.187 23.9114C134.656 16.9138 126.733 11.3455 117.416 7.20585C108.196 3.06624 97.8708 0.996613 86.4413 0.996613H0ZM80.5345 114.241H47.8309V41.0609H80.5345C85.5289 41.0609 90.0911 42.0956 94.2211 44.1656C98.351 46.1365 101.809 48.7975 104.594 52.1487C107.475 55.4012 109.684 59.2942 111.221 63.8279C112.854 68.2632 113.67 72.8952 113.67 77.7245C113.67 82.5539 112.854 87.1862 111.221 91.6216C109.684 96.0565 107.475 99.9496 104.594 103.301C101.809 106.553 98.303 109.214 94.077 111.284C89.947 113.255 85.4328 114.241 80.5345 114.241Z',
  slash: 'M240 4.20461L94.7983 212.997H74.0907L219.876 4.20461H240Z',
} as const

export const LOGO_FILL = { black: '#181818', white: '#FCFCFC' } as const

export interface LogoPlacement {
  x: number; y: number
  width: number; height: number
  padding: number
  scale: number
}

export function computeLogoPlacement(
  canvasWidth: number,
  canvasHeight: number,
): LogoPlacement
```

Placement rule: `scale = min(canvasWidth / LOGO_REFERENCE.width, canvasHeight / LOGO_REFERENCE.height)`. Logo box = `LOGO_BASE × scale`, anchored bottom-left with `LOGO_BASE.padding × scale`. Pure function, fully testable without a DOM.

### `src/renderer/canvas-renderer.ts` (changed)

```ts
export interface RenderTarget { width: number; height: number; dpr: number }
export interface RenderConfig { /* existing */ logo?: { color: LogoColor } }
export function render(canvas: HTMLCanvasElement, config: RenderConfig, target: RenderTarget): void
```

`render()` body uses `target.width/height/dpr` instead of reading from canvas/window. New private `drawLogo(ctx, width, height, color)` invoked at the end of the pipeline (after noise, after masked-blur composite). Builds two `Path2D` instances from `LOGO_PATHS`, applies a transform mapping `LOGO_VIEWBOX` to `computeLogoPlacement(width, height)`, fills both paths with `LOGO_FILL[color]`. Body path uses `fill-rule="evenodd"` (passed to `ctx.fill(path, 'evenodd')`).

### `src/core/svg-export.ts` (changed)

```ts
export interface SVGExportConfig { /* existing */ logo?: { color: LogoColor } }
```

When `logo` is present, append after all existing layers:

```html
<g transform="translate({x}, {y}) scale({scale})">
  <path fill-rule="evenodd" d="..." fill="{fill}"/>
  <path d="..." fill="{fill}"/>
</g>
```

Transform values from `computeLogoPlacement(svgConfig.width, svgConfig.height)`. Vector preserved.

### `src/demo/demo.ts` (changed)

**Export folder (rewritten):**

| Control | Type | Default | Visibility |
|---|---|---|---|
| Width | int 16–16384 | 1920 | always |
| Height | int 16–16384 | 1080 | always |
| Format | dropdown | png | always |
| Quality | float 0.5–1.0 | 0.95 | format=jpg |
| Transparent BG | bool | false | format=png\|svg |
| Export | button | — | always |

Format change calls `controller.show()/hide()` on Quality and Transparent BG.

**Logo folder (new):**

| Control | Type | Default |
|---|---|---|
| Enabled | bool | false |
| Color | dropdown black/white | black |

Both controls call `onConfigChange()` so the live preview updates immediately.

**Live-preview reframing.** New helper:

```ts
function computePreviewTarget(
  windowW: number, windowH: number,
  exportW: number, exportH: number,
  dpr: number,
): RenderTarget
```

Returns the largest rectangle of aspect `exportW:exportH` that fits inside `windowW × windowH`. The canvas's CSS size is set to that; the canvas is centered with CSS (e.g. `position: fixed; inset: 0; margin: auto`). The window background fills the inactive area (suggest `#1a1a1a`). On window resize OR when Width/Height fields change, recompute target and re-render.

**Export functions.**

```ts
function exportRaster(format: 'png' | 'jpg') {
  const { width, height, quality, transparentBg } = exportConfig
  const off = document.createElement('canvas')   // not appended
  off.width = width; off.height = height
  off.style.width = `${width}px`; off.style.height = `${height}px`
  const cfg = transparentBg ? { ...config, background: 'transparent' } : config
  render(off, buildRenderConfig(cfg), { width, height, dpr: 1 })
  const mime = format === 'png' ? 'image/png' : 'image/jpeg'
  off.toBlob(blob => {
    if (!blob) return
    download(blob, `brand-shape-${width}x${height}.${format}`)
  }, mime, format === 'jpg' ? quality : undefined)
}
```

`exportSVG()` keeps its current shape but reads `width`/`height` from `exportConfig`, recomputes `gradientScaleFactor` from those (not from live canvas), and includes a logo block when enabled.

## Data flow

**Live preview tick** — window resize or config change → `computePreviewTarget(window.innerW, window.innerH, exportConfig.width, exportConfig.height, devicePixelRatio)` → set canvas CSS size → `render(canvas, config, target)` → existing pipeline → `drawLogo` if enabled.

**Raster export** — read export config → create offscreen canvas at exact `width × height` (no DPR multiplication; user dims are absolute pixels) → `render(offscreen, cfg, { width, height, dpr: 1 })` → `toBlob` with format-appropriate MIME and (for JPG) quality → download.

**SVG export** — same export config drives `SVGExportConfig.{width, height}` and the gradient scale factor; logo block appended when enabled; serialize and download.

## Error handling

- **Width or Height ≤ 0 or non-finite** — disable Export button. lil-gui's `min(16)` prevents this in practice; defensive check in `exportRaster` throws a clear `Error('Export width/height must be positive')` (caught at button handler, no silent failure).
- **Width or Height > 16384** — clamp at lil-gui input (most browsers cap canvas at 16384 or 32767 per axis; 16384 is universally safe). Above that, `getContext('2d')` returns null on the offscreen canvas.
- **Offscreen `getContext('2d')` returns null** — `exportRaster` aborts and shows an alert: "Browser failed to allocate canvas at {w}×{h}. Try smaller dimensions or a different format."
- **`toBlob` callback receives null** — same failure path as above.
- **Logo paths invalid** — caught by tests at build time; no runtime guard needed.
- **Memory pressure on huge exports (e.g., A0 PNG)** — not handled in code. Documented in CHANGELOG: "PNG at A0 dimensions can exceed 200 MB raw and may fail in low-memory browsers; prefer JPG for prints larger than 4K."

## Testing

TDD red→green per existing rules.

### `__tests__/logo.test.ts` (new)

- `computeLogoPlacement(1920, 1080)` returns `{ x: 48, y: 1080-48-88, width: 100, height: 88, padding: 48, scale: 1 }`
- `computeLogoPlacement(3840, 2160)` returns `{ width: 200, height: 176, padding: 96, scale: 2 }`
- `computeLogoPlacement(9933, 14043)` returns scale ≈ 5.17 (within 0.01), proportional logo box
- `computeLogoPlacement(14043, 9933)` (A0 landscape) returns scale ≈ 7.31 (width-bound — `min` picks the smaller ratio: 14043/1920 = 7.31, 9933/1080 = 9.20)
- `computeLogoPlacement(1080, 1920)` returns scale ≈ 0.56
- y-coordinate places logo such that `y + height + padding === canvasHeight`
- x-coordinate equals `padding`

### `__tests__/canvas-renderer.test.ts` (extended)

`render()` is hard to test without a real canvas; existing tests use jsdom. The new assertions:

- `render()` accepts the new `target` argument and uses `target.width/height/dpr` (not `canvas.clientWidth`). Verified by passing a stub canvas with mismatched `clientWidth` and asserting the rendered backing-store size matches `target.width × target.dpr`.
- When `config.logo` is set, the canvas's `getContext('2d').__getEvents()` (jsdom-canvas-mock) includes `fill` calls with the logo path data and the correct fill style.
- When `config.logo` is absent, no logo-related fills happen.

### `__tests__/svg-export.test.ts` (extended)

- `generateSVG({ ...config, logo: { color: 'black' }, width: 1920, height: 1080 })` output contains:
  - `<g transform="translate(48, 944) scale(0.4166...)`>` (or equivalent — assert presence of both transform parts within tolerance)
  - The body path's `d` attribute
  - The slash path's `d` attribute
  - `fill="#181818"` on both paths
- `generateSVG({ ..., logo: undefined })` does not contain the logo paths.
- Logo block appears AFTER the noise/blur layers (string position assertion).

### Manual / dev-server validation

- Open dev server. Confirm letterboxed canvas appears centered on window with neutral surround when window aspect ≠ export aspect.
- Set Width=1920 / Height=1080, enable logo (black on light bg, white on dark bg), export PNG. Confirm output is exactly 1920×1080 and logo position matches the template within 1px.
- Set Width=9933 / Height=14043, export JPG quality=0.95. Confirm output dimensions, file size <50MB, logo crisp at native resolution, no rasterization artifacts on the SVG-derived paths.
- Toggle Transparent BG with Format=png. Confirm transparent background and logo still rendered.
- Switch Format → JPG. Confirm Transparent BG hidden, Quality shown.
- Resize window. Confirm letterbox reframes; logo scales and stays bottom-left within the active region.

## Open follow-ups (out of scope for this spec)

- Save/restore export settings to localStorage.
- DPI metadata stamping (PNG `pHYs` chunk, JPG JFIF density) if a print shop ever asks.
- Multiple logo positions (top-right, etc.) — add when requested.
- Custom logo upload — add when requested.
- Watermark / preset templates beyond the Portable logo.
