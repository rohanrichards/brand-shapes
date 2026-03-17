# Brand Shapes — Design Document

> Interactive brand component tool for generating morphing shapes with gradients, noise, and blur effects at runtime on any web page.

## 1. Origin & Purpose

This project extracts and expands the BrandShape component from [slidev-theme-portable](https://github.com/user/slidev-theme-portable) into a standalone, framework-agnostic tool.

**The existing BrandShape** renders morphing SVG shapes with three visual variants (wireframe, filled, gradient), using a colour system based on Portable's "hyper-chromatic" brand philosophy. It works within Slidev's Vue ecosystem but is tightly coupled to it.

**Brand Shapes** (this project) takes those ideas and builds a general-purpose tool that:
- Can be dropped into **any web page** via a `<brand-shape>` custom element or script tag
- Renders interactive, configurable brand components in **real-time**
- Exposes all parameters through a **lil-gui debug overlay** for live tweaking
- Ships as a **~42KB gzipped** library with zero framework dependencies

### What This Is NOT
- Not a design tool or visual editor (no drag-and-drop, no timeline)
- Not an SVG export pipeline (screen-only rendering)
- Not a Slidev theme (fully standalone)

## 2. Technology Stack

| Layer | Technology | Size (gzip) | Role |
|-------|-----------|-------------|------|
| **Data** | SVG path strings | ~2KB | 12 shape definitions as portable coordinate data |
| **Morphing** | GSAP + MorphSVGPlugin | ~31KB | Path interpolation between shapes (5-15 steps) |
| **Rendering** | Canvas 2D API | 0KB (native) | Path2D, createConicGradient(), ctx.filter, compositing |
| **Distribution** | Lit (Web Components) | ~5KB | `<brand-shape>` custom element, Shadow DOM |
| **Demo Controls** | lil-gui | ~4KB | Auto-generated debug overlay from config object |
| **Toolchain** | Vite + TypeScript | dev only | HMR dev server, library + UMD builds |
| **Testing** | Vitest | dev only | Unit tests for core modules |

**Total runtime bundle: ~42KB gzipped.**

### Why These Choices

**GSAP MorphSVGPlugin** over flubber:
- flubber is dead (last release March 2018, unmaintained, no ESM)
- GSAP handles mismatched point counts, compound paths, configurable shapeIndex/curveMode
- Now 100% free post-Webflow acquisition (verified 2026-03-18, custom "No Charge" license)
- Only restriction: can't build a visual animation builder competing with Webflow — not applicable

**Canvas 2D** over SVG DOM / WebGL:
- Native `createConicGradient()` — eliminates the fragile foreignObject hack entirely
- Native `ctx.filter = 'blur(Npx)'` — eliminates CPU-bound SVG feGaussianBlur
- Immediate-mode rendering — no DOM mutation overhead during real-time parameter changes
- `Path2D` constructor natively consumes SVG path strings — zero conversion needed
- 60fps at 10K elements — orders of magnitude more headroom than we need

**Lit Web Components** over React/Vue/vanilla:
- Framework-agnostic — works in any page (React, Vue, WordPress, static HTML)
- Shadow DOM encapsulates styles — no leakage into or from host page
- ~5KB gzipped — negligible overhead
- Standard W3C Custom Elements — future-proof

**lil-gui** over custom panel:
- Purpose-built for creative coding debug overlays
- Auto-generates controls from a config object (sliders, dropdowns, toggles, color pickers)
- ~4KB, dark theme, collapsible folders
- Successor to the canonical dat.GUI

## 3. Architecture

```
+--------------------------------------------------------------+
|  <brand-shape> Web Component (Lit)                            |
|                                                                |
|  +----------------------------------------------------------+ |
|  |  Config API (attributes / properties / lil-gui)           | |
|  |  from, to, steps, scheme, variant, noise, blur, ...      | |
|  +------------------------+----------------------------------+ |
|                           |                                    |
|  +------------------------v----------------------------------+ |
|  |  Core Engine (pure functions, no DOM)                      | |
|  |                                                            | |
|  |  shapes.ts    colours.ts    effects.ts    morph.ts        | |
|  |  12 SVG paths  5 families    gradients     GSAP           | |
|  |  3 categories  dark/light    noise gen     MorphSVG       | |
|  |               pairings      blur config    wrapper        | |
|  +------------------------+----------------------------------+ |
|                           |                                    |
|  +------------------------v----------------------------------+ |
|  |  Canvas Renderer                                           | |
|  |                                                            | |
|  |  - Path2D from SVG path strings                           | |
|  |  - createConicGradient() for filled/gradient variants     | |
|  |  - Stacked layers with globalAlpha + transforms           | |
|  |  - ctx.filter = 'blur()' for blur effect                  | |
|  |  - Pre-baked noise texture via ImageData                  | |
|  |  - requestAnimationFrame render loop                      | |
|  |  - devicePixelRatio for crisp rendering                   | |
|  +-----------------------------------------------------------+ |
|                                                                |
|  +-----------------------------------------------------------+ |
|  |  <canvas> element (Shadow DOM)                             | |
|  +-----------------------------------------------------------+ |
+----------------------------------------------------------------+
```

### Key Architectural Decisions

**Shape data is renderer-agnostic.** The 12 shapes are SVG path strings (M...L...Z coordinates). They feed into GSAP for morphing and into Canvas Path2D for rendering. This decouples brand assets from the rendering pipeline.

**Morphing is pure computation.** GSAP MorphSVGPlugin takes two path strings and produces N intermediate paths. The output is an array of path strings that any renderer can consume. The morph engine has no knowledge of Canvas.

**Effects are Canvas-native.** Conic gradients use `createConicGradient()`. Blur uses `ctx.filter`. Noise uses a pre-generated `ImageData` texture composited via `globalCompositeOperation`. No SVG filters, no foreignObject, no hacks.

**The Web Component is a thin shell.** Lit manages the custom element lifecycle, attribute observation, and Shadow DOM. It delegates all rendering to the Canvas renderer. ~50 lines of glue code.

### Rendering Strategy Per Variant

| Variant | Canvas Strategy |
|---------|----------------|
| **Wireframe** | `ctx.stroke(path2d)` with linear gradient stroke style, progressive opacity per step |
| **Filled** | `ctx.fill(path2d)` with `createConicGradient()` fill, stacked layers with scale/offset transforms |
| **Gradient** | Same as filled but with progressive `globalAlpha` per layer |

### Noise Strategy

Pre-generate a tileable noise texture (256x256 ImageData) using simplex noise at initialization. Composite onto rendered output via `ctx.globalCompositeOperation = 'overlay'` with low opacity (~0.12). Re-generate only when noise parameters change, not every frame.

### Animation Strategy

GSAP timeline orchestrates step-by-step reveal via requestAnimationFrame:
- Each morph step fades in sequentially over `duration / steps` milliseconds
- GSAP timeline provides easing, pause/resume, and reverse
- Config changes during animation smoothly interrupt and restart

## 4. Web Component API

```html
<!-- Minimal usage -->
<brand-shape from="organic-1" to="angular-3"></brand-shape>

<!-- Full configuration -->
<brand-shape
  from="primitive-2"
  to="organic-4"
  steps="10"
  scheme="pink"
  variant="filled"
  noise
  blur
  animate
  trigger="enter"
  duration="2000"
  align="right"
  spread="1.5"
></brand-shape>
```

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `from` | ShapeName | `'organic-1'` | Start shape |
| `to` | ShapeName | `'angular-3'` | End shape |
| `steps` | number (5-15) | `8` | Morph interpolation steps |
| `scheme` | ColourFamily | `'lime'` | Colour scheme |
| `variant` | string | `'filled'` | `wireframe` / `filled` / `gradient` |
| `noise` | boolean | `false` | Film grain overlay |
| `blur` | boolean | `false` | Edge blur effect |
| `animate` | boolean | `false` | Step-by-step reveal animation |
| `trigger` | string | `'enter'` | `enter` (viewport) / `click` |
| `duration` | number | `1500` | Animation duration (ms) |
| `align` | string | `'center'` | Stack direction for layers |
| `spread` | number | `1` | Layer offset multiplier |
| `width` | string | `'400px'` | Component width |
| `height` | string | `'400px'` | Component height |

## 5. Demo Page

Full-screen dark viewport with lil-gui overlay (top-right). The lil-gui panel is auto-generated from a config object with collapsible folders for Shape, Colour, Morph, Effects, and Animation parameters. All changes apply live. Presets dropdown loads pre-configured parameter sets.

## 6. What Was Eliminated (And Why)

| Technology | Reason | Evidence |
|-----------|--------|----------|
| **CSS-only animations** | Cannot morph SVG path `d` attribute | W3C spec |
| **flubber** | Dead since March 2018 (8 years) | npm: v0.4.2, 13 open issues, no ESM |
| **SVG DOM rendering** | foreignObject hack for conic gradients is fragile cross-browser | Safari bugs, export failures |
| **SVG filters** | feTurbulence CPU single-threaded; feGaussianBlur HW accel inconsistent | Browser-specific acceleration |
| **PixiJS** | 450KB for 1-15 shapes | Council debate: 3/4 agents agreed premature |
| **Phaser** | 1.2MB game engine overhead | Wrong tool for non-game content |
| **Three.js** | 3D engine overkill | No 2D-specific optimizations |
| **SVG-primary hybrid** | Main advantage (vector export) not needed | Screen-only confirmed |
| **Custom config panel** | lil-gui does it in 4KB | dat.GUI pattern confirmed |
| **anime.js** | GSAP MorphSVGPlugin superior and now free | Better morph quality |

## 7. Analysis Methodology

Architecture selected through multi-method analysis:

1. **Codebase Exploration** — Full read of all 15 source files in slidev-theme-portable
2. **FirstPrinciples Deconstruction** — 6 fundamental constituents, 7 constraints classified
3. **Research** — 9 technology areas, 14 verified web sources
4. **Council Debate** — 3-round debate, 4 agents (SVG Purist, Canvas Pragmatist, WebGL Maximalist, Hybrid Architect)
5. **RedTeam Analysis** — 8 specialized agents stress-tested 24 atomic claims

**Key RedTeam finding (8/8 unanimous):** SVG export from Canvas requires a parallel scene graph. Since screen-only rendering was confirmed, Canvas-primary is validated.

> Full research data: `~/.claude/MEMORY/WORK/20260318-000000_brand-component-architecture-exploration/PRD.md`

## 8. Target Requirements

| Requirement | Target |
|-------------|--------|
| FPS (idle) | 60fps |
| FPS (parameter change) | >30fps |
| Initial render | <100ms |
| Memory | <2MB |
| Bundle size | <50KB gzipped |
| Browsers | Chrome 99+, Firefox 110+, Safari 16+, Edge 99+ (94%+) |
| Integration | npm + CDN script tag + `<brand-shape>` custom element |

## 9. Project Structure

```
brand-shapes/
├── package.json              # Dependencies: gsap, lit, lil-gui (dev)
├── vite.config.ts            # Library mode + demo dev server
├── tsconfig.json
├── index.html                # Demo page entry point
│
├── src/
│   ├── index.ts              # Library entry — exports component + core
│   │
│   ├── core/                 # Pure functions, no DOM, fully testable
│   │   ├── shapes.ts         # 12 shape definitions (ported from slidev-theme)
│   │   ├── colours.ts        # 5 colour families + pairings (ported)
│   │   ├── morph.ts          # GSAP MorphSVGPlugin wrapper
│   │   └── effects.ts        # Conic gradient builders, noise gen, blur config
│   │
│   ├── renderer/
│   │   └── canvas-renderer.ts  # Canvas 2D render pipeline
│   │
│   ├── component/
│   │   └── brand-shape.ts    # Lit Web Component (<brand-shape>)
│   │
│   └── demo/                 # Demo page (not in library build)
│       ├── demo.ts           # Demo initialization
│       ├── config.ts         # lil-gui setup + presets
│       └── demo.css          # Full-screen layout
│
├── __tests__/
│   ├── shapes.test.ts
│   ├── colours.test.ts
│   ├── morph.test.ts
│   └── effects.test.ts
│
└── dist/                     # Build output
    ├── brand-shapes.es.js    # ES module
    ├── brand-shapes.umd.js   # UMD for CDN
    └── brand-shapes.d.ts     # TypeScript declarations
```

## 10. Phase Plan

### Phase 1 — Core Engine + Canvas Renderer
**Goal:** Port core modules, integrate GSAP, build Canvas render pipeline, verify visual output.

**Deliverables:**
- Project scaffolded (Vite + TS + Vitest)
- `shapes.ts` ported with tests
- `colours.ts` ported with tests
- `morph.ts` built with GSAP MorphSVGPlugin + tests
- `effects.ts` built (conic gradient, noise, blur config) + tests
- `canvas-renderer.ts` — renders all 3 variants to `<canvas>`
- Manual verification: Canvas output visually matches existing BrandShape

**Success criteria:** All tests pass. A bare `index.html` renders a morphing brand shape on Canvas with conic gradient, noise, and blur.

**Blocks:** Nothing — this is the foundation.

---

### Phase 2 — Web Component + Distribution
**Goal:** Wrap engine in Lit Web Component, build npm/CDN distribution.

**Deliverables:**
- `brand-shape.ts` Lit component with full attribute API
- Shadow DOM encapsulation
- Vite library build (ES module + UMD)
- Integration test: works in plain HTML page

**Success criteria:** `<brand-shape from="organic-1" to="angular-3" variant="filled" animate>` renders via `<script src="brand-shapes.umd.js">`.

**Blocks:** Phase 1.

---

### Phase 3 — Demo Page + lil-gui
**Goal:** Full-screen demo with live config overlay.

**Deliverables:**
- Full-screen dark demo page
- lil-gui panel (Shape, Colour, Morph, Effects, Animation folders)
- Preset configurations
- Live parameter changes at 60fps

**Success criteria:** `index.html` shows full-screen brand shape with lil-gui controlling every parameter in real-time.

**Blocks:** Phase 2.

---

### Phase 4 — Polish & Expand
**Goal:** Additional features, performance tuning, documentation.

**Deliverables:**
- Additional animation modes (loop, ping-pong, random walk)
- Shape composition (multiple shapes)
- Performance profiling
- README + npm publish

**Success criteria:** Published to npm, demo deployable, docs complete.

**Blocks:** Phase 3.

---

### Phase Dependencies

```
Phase 1 (Core Engine)  ──>  Phase 2 (Web Component)  ──>  Phase 3 (Demo)  ──>  Phase 4 (Polish)
```

Strictly serial between phases. Parallelizable within phases.
