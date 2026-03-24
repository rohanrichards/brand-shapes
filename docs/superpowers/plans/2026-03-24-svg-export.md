# SVG Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add SVG export to Brand Shapes using vector clip paths with rasterized conic gradient fills for cross-platform compatibility.

**Architecture:** `src/core/transforms.ts` (extracted shared utils), `src/core/svg-export.ts` (pure SVG string generation), `src/demo/gradient-rasterizer.ts` (canvas-based conic gradient to JPEG), and modifications to `src/demo/demo.ts` (Export SVG button). Wireframe variant is pure SVG; filled/gradient variants use vector clip paths with base64 JPEG gradient fills.

**Tech Stack:** TypeScript strict, SVG 1.1, Canvas 2D (for gradient rasterization), Vitest (TDD).

**Spec:** `docs/superpowers/specs/2026-03-24-svg-export-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/core/transforms.ts` | Create | Extract `pathCentroid()` and `computeStepTransform()` from canvas-renderer |
| `__tests__/transforms.test.ts` | Create | Unit tests for extracted transforms |
| `src/renderer/canvas-renderer.ts` | Modify | Import from transforms.ts instead of local functions |
| `src/core/svg-export.ts` | Create | Pure `generateSVG()` function + types |
| `__tests__/svg-export.test.ts` | Create | Unit tests for SVG string generation |
| `src/demo/gradient-rasterizer.ts` | Create | `rasterizeConicGradient()` — canvas to base64 JPEG |
| `src/demo/demo.ts` | Modify | Add Export SVG button, wire up SVG generation |
| `CLAUDE.md` | Modify | Remove "No SVG export" locked decision |

---

## Task 1: Extract Shared Transforms

**Files:**
- Create: `src/core/transforms.ts`
- Create: `__tests__/transforms.test.ts`
- Modify: `src/renderer/canvas-renderer.ts`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Write failing tests for pathCentroid**

```typescript
// __tests__/transforms.test.ts
import { describe, it, expect } from 'vitest'
import { pathCentroid, computeStepTransform } from '../src/core/transforms'

describe('pathCentroid', () => {
  it('returns center of a simple square path', () => {
    // Square: (0,0) (100,0) (100,100) (0,100)
    const path = 'M 0 0 L 100 0 L 100 100 L 0 100 Z'
    const [cx, cy] = pathCentroid(path)
    expect(cx).toBeCloseTo(50, 0)
    expect(cy).toBeCloseTo(50, 0)
  })

  it('returns [0,0] for empty path', () => {
    const [cx, cy] = pathCentroid('')
    expect(cx).toBe(0)
    expect(cy).toBe(0)
  })

  it('handles negative coordinates', () => {
    const path = 'M -50 -50 L 50 -50 L 50 50 L -50 50 Z'
    const [cx, cy] = pathCentroid(path)
    expect(cx).toBeCloseTo(0, 0)
    expect(cy).toBeCloseTo(0, 0)
  })

  it('handles scientific notation in paths', () => {
    const path = 'M 1e2 2e2 L 3e2 4e2'
    const [cx, cy] = pathCentroid(path)
    expect(cx).toBeCloseTo(200, 0)
    expect(cy).toBeCloseTo(300, 0)
  })
})

describe('computeStepTransform', () => {
  it('first step gets scaleFrom and full offset', () => {
    const result = computeStepTransform(0, 8, 'right', 1.0, 1.15, 0.95)
    expect(result.scale).toBeCloseTo(1.15)
    expect(result.offsetX).toBeGreaterThan(0)
    expect(result.offsetY).toBe(0)
  })

  it('last step gets scaleTo and zero offset', () => {
    const result = computeStepTransform(7, 8, 'right', 1.0, 1.15, 0.95)
    expect(result.scale).toBeCloseTo(0.95)
    expect(result.offsetX).toBeCloseTo(0)
  })

  it('center alignment produces zero offset', () => {
    const result = computeStepTransform(0, 8, 'center', 1.0, 1.15, 0.95)
    expect(result.offsetX).toBe(0)
    expect(result.offsetY).toBe(0)
  })

  it('single step returns t=0 (scaleFrom)', () => {
    const result = computeStepTransform(0, 1, 'right', 1.0, 1.15, 0.95)
    expect(result.scale).toBeCloseTo(1.15)
  })

  it('left alignment produces negative offsetX', () => {
    const result = computeStepTransform(0, 8, 'left', 1.0, 1.15, 0.95)
    expect(result.offsetX).toBeLessThan(0)
  })

  it('top alignment produces negative offsetY', () => {
    const result = computeStepTransform(0, 8, 'top', 1.0, 1.15, 0.95)
    expect(result.offsetY).toBeLessThan(0)
  })

  it('spread multiplier scales offset', () => {
    const spread1 = computeStepTransform(0, 8, 'right', 1.0, 1.15, 0.95)
    const spread2 = computeStepTransform(0, 8, 'right', 2.0, 1.15, 0.95)
    expect(spread2.offsetX).toBeCloseTo(spread1.offsetX * 2)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/transforms.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create transforms.ts with extracted functions**

```typescript
// src/core/transforms.ts

export type Alignment = 'left' | 'right' | 'top' | 'bottom' | 'center'

/** Fast centroid from SVG path string — averages all coordinate pairs. */
export function pathCentroid(pathStr: string): [number, number] {
  const nums = pathStr.match(/-?[\d.]+(?:e[+-]?\d+)?/gi)
  if (!nums || nums.length < 2) return [0, 0]
  let sx = 0, sy = 0, count = 0
  for (let i = 0; i < nums.length - 1; i += 2) {
    sx += parseFloat(nums[i])
    sy += parseFloat(nums[i + 1])
    count++
  }
  return [sx / count, sy / count]
}

/**
 * Per-step transform for filled/gradient variants.
 * Back steps scale larger with offset; front steps scale smaller.
 */
export function computeStepTransform(
  stepIndex: number,
  totalSteps: number,
  align: Alignment,
  spread: number,
  scaleFrom: number,
  scaleTo: number,
): { scale: number; offsetX: number; offsetY: number } {
  const t = totalSteps === 1 ? 0 : stepIndex / (totalSteps - 1)
  const scale = scaleFrom + (scaleTo - scaleFrom) * t
  const maxOffset = 15 * spread
  const offset = (1 - t) * maxOffset

  let offsetX = 0
  let offsetY = 0
  switch (align) {
    case 'left': offsetX = -offset; break
    case 'right': offsetX = offset; break
    case 'top': offsetY = -offset; break
    case 'bottom': offsetY = offset; break
    case 'center': break
  }

  return { scale, offsetX, offsetY }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/transforms.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Update canvas-renderer.ts to import from transforms.ts**

In `src/renderer/canvas-renderer.ts`:

1. Remove the local `pathCentroid` function (lines 12-23)
2. Remove the local `computeStepTransform` function (lines 98-122)
3. Remove the `Alignment` type export (line 36)
4. Add import at top:

```typescript
import { pathCentroid, computeStepTransform, type Alignment } from '../core/transforms'
```

5. Keep the `Alignment` re-export for backwards compatibility:

```typescript
export type { Alignment } from '../core/transforms'
```

- [ ] **Step 6: Run all tests to verify no regressions**

Run: `npx vitest run`
Expected: All tests PASS (existing + new transforms tests)

- [ ] **Step 7: Update CLAUDE.md — remove "No SVG export" locked decision**

Change line 49 of `CLAUDE.md` from:
```
- **No SVG export** — screen-only rendering confirmed
```
To:
```
- **SVG export** — vector clip paths with rasterized gradient fills for cross-platform compatibility
```

- [ ] **Step 8: Commit**

```bash
git add src/core/transforms.ts __tests__/transforms.test.ts src/renderer/canvas-renderer.ts CLAUDE.md
git commit -m "refactor: extract pathCentroid and computeStepTransform to shared transforms module"
```

---

## Task 2: SVG Export Types + Wireframe Generation

**Files:**
- Create: `src/core/svg-export.ts`
- Create: `__tests__/svg-export.test.ts`

- [ ] **Step 1: Write failing tests for wireframe SVG generation**

```typescript
// __tests__/svg-export.test.ts
import { describe, it, expect } from 'vitest'
import { generateSVG, type SVGExportConfig, type SVGExportStep } from '../src/core/svg-export'

function makeWireframeConfig(overrides: Partial<SVGExportConfig> = {}): SVGExportConfig {
  return {
    width: 800,
    height: 600,
    viewBox: [0, 0, 164, 104] as [number, number, number, number],
    background: '#000000',
    variant: 'wireframe',
    noise: false,
    colours: { current: '#4B01E6', catalyst: '#BEF958', future: '#FEA6E1' },
    steps: [
      { path: 'M 10 10 L 90 10 L 90 90 Z', centroid: [63.3, 36.7], transform: { scale: 1, offsetX: 0, offsetY: 0 }, opacity: 1.0, strokeWidth: 1.5 },
      { path: 'M 20 20 L 80 20 L 80 80 Z', centroid: [60, 40], transform: { scale: 1, offsetX: 0, offsetY: 0 }, opacity: 0.7, strokeWidth: 1.5 },
    ],
    ...overrides,
  }
}

describe('generateSVG — wireframe', () => {
  it('returns valid SVG with correct root element', () => {
    const svg = generateSVG(makeWireframeConfig())
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"')
    expect(svg).toContain('width="800"')
    expect(svg).toContain('height="600"')
    expect(svg).toContain('</svg>')
  })

  it('includes linearGradient in defs', () => {
    const svg = generateSVG(makeWireframeConfig())
    expect(svg).toContain('<linearGradient')
    expect(svg).toContain('id="wireStroke"')
  })

  it('uses gradient stops from buildLinearGradientStops', () => {
    const svg = generateSVG(makeWireframeConfig())
    expect(svg).toContain('offset="0"')
    expect(svg).toContain('offset="0.45"')
    expect(svg).toContain('offset="0.55"')
    expect(svg).toContain('offset="1"')
  })

  it('includes one path per step with stroke and no fill', () => {
    const svg = generateSVG(makeWireframeConfig())
    expect(svg).toContain('stroke="url(#wireStroke)"')
    expect(svg).toContain('fill="none"')
    const pathMatches = svg.match(/<path[^/]*d="/g)
    expect(pathMatches?.length).toBe(2)
  })

  it('applies opacity to each path', () => {
    const svg = generateSVG(makeWireframeConfig())
    expect(svg).toContain('opacity="1"')
    expect(svg).toContain('opacity="0.7"')
  })

  it('includes background rect', () => {
    const svg = generateSVG(makeWireframeConfig())
    expect(svg).toContain('<rect width="100%" height="100%" fill="#000000"')
  })

  it('omits background rect when transparent', () => {
    const svg = generateSVG(makeWireframeConfig({ background: 'transparent' }))
    expect(svg).not.toContain('<rect')
  })

  it('includes noise filter when enabled', () => {
    const svg = generateSVG(makeWireframeConfig({ noise: true }))
    expect(svg).toContain('<filter id="noise"')
    expect(svg).toContain('feTurbulence')
    expect(svg).toContain('filter="url(#noise)"')
  })

  it('omits noise filter when disabled', () => {
    const svg = generateSVG(makeWireframeConfig({ noise: false }))
    expect(svg).not.toContain('<filter')
    expect(svg).not.toContain('feTurbulence')
  })

  it('includes stroke-width from step', () => {
    const svg = generateSVG(makeWireframeConfig())
    expect(svg).toContain('stroke-width="1.5"')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/svg-export.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement types and wireframe generation**

```typescript
// src/core/svg-export.ts
import { buildLinearGradientStops } from './effects'

export interface SVGExportColours {
  current: string
  catalyst: string
  future: string
}

export interface SVGExportStep {
  path: string
  centroid: [number, number]
  transform: {
    scale: number
    offsetX: number
    offsetY: number
  }
  opacity: number
  strokeWidth?: number
  gradientImage?: string
}

export interface SVGExportConfig {
  width: number
  height: number
  viewBox: [number, number, number, number]
  background: string
  variant: 'wireframe' | 'filled' | 'gradient'
  noise: boolean
  colours: SVGExportColours
  steps: SVGExportStep[]
}

function noiseFilterDef(): string {
  return `<filter id="noise">
      <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" result="noise"/>
      <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise"/>
      <feBlend in="SourceGraphic" in2="grayNoise" mode="overlay"/>
    </filter>`
}

function wireframeDefs(config: SVGExportConfig): string {
  const stops = buildLinearGradientStops(config.colours.current, config.colours.catalyst, config.colours.future)
  const stopElements = stops.map(s =>
    `<stop offset="${s.offset}" stop-color="${s.color}"/>`
  ).join('\n      ')

  let defs = `<linearGradient id="wireStroke" x1="0" y1="0" x2="1" y2="1">
      ${stopElements}
    </linearGradient>`

  if (config.noise) {
    defs += `\n    ${noiseFilterDef()}`
  }

  return defs
}

function wireframeBody(config: SVGExportConfig): string {
  const paths = config.steps.map(step => {
    const sw = step.strokeWidth ?? 1.5
    return `<path d="${step.path}" stroke="url(#wireStroke)" stroke-width="${sw}" fill="none" opacity="${step.opacity}"/>`
  }).join('\n    ')

  return paths
}

export function generateSVG(config: SVGExportConfig): string {
  const { width, height, viewBox, background } = config
  const [vx, vy, vw, vh] = viewBox

  let defs = ''
  let body = ''

  switch (config.variant) {
    case 'wireframe':
      defs = wireframeDefs(config)
      body = wireframeBody(config)
      break
    case 'filled':
    case 'gradient':
      // Implemented in Task 3
      defs = ''
      body = ''
      break
  }

  const bgRect = background && background !== 'transparent'
    ? `\n  <rect width="100%" height="100%" fill="${background}"/>`
    : ''

  const filterAttr = config.noise ? ' filter="url(#noise)"' : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${vx} ${vy} ${vw} ${vh}">
  <defs>
    ${defs}
  </defs>${bgRect}
  <g${filterAttr}>
    ${body}
  </g>
</svg>`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/svg-export.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/svg-export.ts __tests__/svg-export.test.ts
git commit -m "feat: add SVG export types and wireframe generation"
```

---

## Task 3: Filled + Gradient SVG Generation

**Files:**
- Modify: `src/core/svg-export.ts`
- Modify: `__tests__/svg-export.test.ts`

- [ ] **Step 1: Write failing tests for filled/gradient variants**

Add to `__tests__/svg-export.test.ts`:

```typescript
function makeFilledConfig(overrides: Partial<SVGExportConfig> = {}): SVGExportConfig {
  return {
    width: 800,
    height: 600,
    viewBox: [0, 0, 164, 104] as [number, number, number, number],
    background: '#000000',
    variant: 'filled',
    noise: false,
    colours: { current: '#4B01E6', catalyst: '#BEF958', future: '#FEA6E1' },
    steps: [
      { path: 'M 10 10 L 90 10 L 90 90 Z', centroid: [63.3, 36.7], transform: { scale: 1.1, offsetX: 5, offsetY: 0 }, opacity: 1.0, gradientImage: 'data:image/jpeg;base64,/9j/fake1' },
      { path: 'M 20 20 L 80 20 L 80 80 Z', centroid: [60, 40], transform: { scale: 0.95, offsetX: 0, offsetY: 0 }, opacity: 1.0, gradientImage: 'data:image/jpeg;base64,/9j/fake2' },
    ],
    ...overrides,
  }
}

describe('generateSVG — filled', () => {
  it('includes clipPath per step in defs', () => {
    const svg = generateSVG(makeFilledConfig())
    expect(svg).toContain('<clipPath id="clip-0">')
    expect(svg).toContain('<clipPath id="clip-1">')
  })

  it('each layer references its clipPath', () => {
    const svg = generateSVG(makeFilledConfig())
    expect(svg).toContain('clip-path="url(#clip-0)"')
    expect(svg).toContain('clip-path="url(#clip-1)"')
  })

  it('includes image element with gradient data URL', () => {
    const svg = generateSVG(makeFilledConfig())
    expect(svg).toContain('href="data:image/jpeg;base64,/9j/fake1"')
    expect(svg).toContain('href="data:image/jpeg;base64,/9j/fake2"')
  })

  it('applies transform with centroid pivot', () => {
    const svg = generateSVG(makeFilledConfig())
    // First step: centroid [63.3, 36.7], scale 1.1, offset (5, 0)
    expect(svg).toContain('translate(68.3,36.7) scale(1.1) translate(-63.3,-36.7)')
  })

  it('does not include linearGradient (that is wireframe only)', () => {
    const svg = generateSVG(makeFilledConfig())
    expect(svg).not.toContain('<linearGradient')
  })
})

describe('generateSVG — gradient variant', () => {
  it('applies opacity per step', () => {
    const config = makeFilledConfig({
      variant: 'gradient',
      steps: [
        { path: 'M 10 10 L 90 90', centroid: [50, 50], transform: { scale: 1, offsetX: 0, offsetY: 0 }, opacity: 0.05, gradientImage: 'data:image/jpeg;base64,/9j/x' },
        { path: 'M 20 20 L 80 80', centroid: [50, 50], transform: { scale: 1, offsetX: 0, offsetY: 0 }, opacity: 1.0, gradientImage: 'data:image/jpeg;base64,/9j/y' },
      ],
    })
    const svg = generateSVG(config)
    expect(svg).toContain('opacity="0.05"')
    expect(svg).toContain('opacity="1"')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/svg-export.test.ts`
Expected: New tests FAIL (filled/gradient case returns empty body)

- [ ] **Step 3: Implement filled/gradient generation**

Add to `src/core/svg-export.ts`:

```typescript
function filledGradientDefs(config: SVGExportConfig): string {
  const clipPaths = config.steps.map((step, i) =>
    `<clipPath id="clip-${i}">
      <path d="${step.path}"/>
    </clipPath>`
  ).join('\n    ')

  let defs = clipPaths
  if (config.noise) {
    defs += `\n    ${noiseFilterDef()}`
  }

  return defs
}

function filledGradientBody(config: SVGExportConfig): string {
  const [, , vw, vh] = config.viewBox

  return config.steps.map((step, i) => {
    const { scale, offsetX, offsetY } = step.transform
    const [cx, cy] = step.centroid
    const tx = cx + offsetX
    const ty = cy + offsetY

    const transform = scale !== 1 || offsetX !== 0 || offsetY !== 0
      ? ` transform="translate(${tx},${ty}) scale(${scale}) translate(${-cx},${-cy})"`
      : ''

    const href = step.gradientImage ?? ''

    return `<g clip-path="url(#clip-${i})" opacity="${step.opacity}"${transform}>
      <image href="${href}" width="${vw}" height="${vh}"/>
    </g>`
  }).join('\n    ')
}
```

Update the `generateSVG` switch:

```typescript
    case 'filled':
    case 'gradient':
      defs = filledGradientDefs(config)
      body = filledGradientBody(config)
      break
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/svg-export.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Run all tests for regressions**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/core/svg-export.ts __tests__/svg-export.test.ts
git commit -m "feat: add filled and gradient SVG generation with clip paths"
```

---

## Task 4: Gradient Rasterizer

**Files:**
- Create: `src/demo/gradient-rasterizer.ts`

This is browser API code (needs OffscreenCanvas or HTMLCanvasElement). Cannot be unit tested in node. Verified via `tsc --noEmit`.

- [ ] **Step 1: Create gradient-rasterizer.ts**

```typescript
// src/demo/gradient-rasterizer.ts

export interface ConicGradientOptions {
  colours: { current: string; catalyst: string; future: string }
  angleDeg: number
  centerX: number
  centerY: number
  viewBoxWidth: number
  viewBoxHeight: number
}

/**
 * Rasterize a conic gradient to a base64 JPEG data URL.
 * Renders to a square canvas (keeps gradient circular) sized to max(vbW, vbH) * scaleFactor.
 * The gradient is positioned so its center aligns with (centerX, centerY) in viewBox space.
 */
export function rasterizeConicGradient(options: ConicGradientOptions, scaleFactor = 4): string {
  const { colours, angleDeg, centerX, centerY, viewBoxWidth, viewBoxHeight } = options
  const size = Math.ceil(Math.max(viewBoxWidth, viewBoxHeight) * scaleFactor)

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  // Map viewBox coordinates to canvas coordinates
  const scale = size / Math.max(viewBoxWidth, viewBoxHeight)
  const canvasCX = centerX * scale
  const canvasCY = centerY * scale

  const angleRad = (angleDeg * Math.PI) / 180
  const gradient = ctx.createConicGradient(angleRad, canvasCX, canvasCY)
  gradient.addColorStop(0, colours.current)
  gradient.addColorStop(0.293, colours.future)
  gradient.addColorStop(0.459, colours.catalyst)
  gradient.addColorStop(1, colours.current)

  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  return canvas.toDataURL('image/jpeg', 0.9)
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run all tests for regressions**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/demo/gradient-rasterizer.ts
git commit -m "feat: add conic gradient rasterizer for SVG export"
```

---

## Task 5: Wire Export SVG into Demo

**Files:**
- Modify: `src/demo/demo.ts`

- [ ] **Step 1: Add imports**

Add at the top of `demo.ts`:

```typescript
import { generateSVG, type SVGExportConfig, type SVGExportStep } from '../core/svg-export'
import { pathCentroid, computeStepTransform } from '../core/transforms'
import { rasterizeConicGradient } from './gradient-rasterizer'
import { buildLinearGradientStops } from '../core/effects'
```

- [ ] **Step 2: Add exportSVG function**

Add after the existing `exportPNG` function:

```typescript
function exportSVG() {
  const fromShape = getShape(config.from as any)
  const vb = fromShape.viewBox.split(' ').map(Number) as [number, number, number, number]

  // Get current paths — either from animation state or generate static
  const toShape = getShape(config.to as any)
  const totalSteps = config.steps
  let paths: string[]
  if (config.animMode !== 'none' && animId != null) {
    // Animation running — get current custom paths from last render
    // Re-generate from current morph state
    paths = []
    for (let i = 0; i < totalSteps; i++) {
      const t = totalSteps === 1 ? 0 : i / (totalSteps - 1)
      const pts = getMorphPoints(fromShape.path, toShape.path, t)
      paths.push(smoothPath(pts))
    }
  } else {
    paths = []
    for (let i = 0; i < totalSteps; i++) {
      const t = totalSteps === 1 ? 0 : i / (totalSteps - 1)
      const pts = getMorphPoints(fromShape.path, toShape.path, t)
      paths.push(smoothPath(pts))
    }
  }

  const colours = {
    current: config.colourFrom,
    catalyst: config.colourTo,
    future: config.colourCatalyst,
  }

  const steps: SVGExportStep[] = paths.map((path, i) => {
    const stepIdx = i
    const stepTotal = totalSteps
    const { scale, offsetX, offsetY } = computeStepTransform(
      stepIdx, stepTotal, config.align as any, config.spread, config.scaleFrom, config.scaleTo,
    )

    // Opacity per variant
    let opacity = 1.0
    if (config.variant === 'wireframe') {
      opacity = 1 - (i / paths.length) * 0.6
    } else if (config.variant === 'gradient') {
      const t = paths.length === 1 ? 1 : i / (paths.length - 1)
      opacity = Math.max(0.05, t * t)
    }

    // Centroid — filled uses path centroid, gradient uses viewBox center
    const cent: [number, number] = config.variant === 'filled'
      ? pathCentroid(path)
      : [vb[2] / 2, vb[3] / 2]

    // Gradient image for filled/gradient variants
    let gradientImage: string | undefined
    if (config.variant === 'filled' || config.variant === 'gradient') {
      const angleDeg = 90 + (stepIdx / stepTotal) * 120
      gradientImage = rasterizeConicGradient({
        colours,
        angleDeg,
        centerX: cent[0],
        centerY: cent[1],
        viewBoxWidth: vb[2],
        viewBoxHeight: vb[3],
      })
    }

    // Stroke width for wireframe
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    const scaleX = width / vb[2]
    const scaleY = height / vb[3]
    const scaleFactor = Math.min(scaleX, scaleY) * 0.8
    const strokeWidth = config.variant === 'wireframe' ? 1.5 / scaleFactor : undefined

    return {
      path,
      centroid: cent,
      transform: { scale, offsetX, offsetY },
      opacity,
      strokeWidth,
      gradientImage,
    }
  })

  const svgConfig: SVGExportConfig = {
    width: canvas.clientWidth,
    height: canvas.clientHeight,
    viewBox: vb,
    background: exportConfig.transparentBg ? 'transparent' : config.background,
    variant: config.variant as any,
    noise: config.noise,
    colours,
    steps,
  }

  const svgString = generateSVG(svgConfig)
  const blob = new Blob([svgString], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'brand-shape.svg'
  a.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 3: Add Export SVG button to GUI**

Update the export folder section (after the existing `exportPNG` button):

```typescript
exportFolder.add({ exportSVG }, 'exportSVG').name('Export SVG')
```

- [ ] **Step 4: Verify TypeScript compiles and tests pass**

Run: `npx tsc --noEmit && npx vitest run`
Expected: No type errors, all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/demo/demo.ts
git commit -m "feat: wire Export SVG button into demo GUI"
```

---

## Task 6: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 2: TypeScript strict check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Manual test — export wireframe SVG**

1. Open demo, set variant to Wireframe
2. Click Export SVG
3. Open downloaded SVG in browser — verify stroked paths with gradient
4. Open in PowerPoint/Slides — verify it renders

- [ ] **Step 4: Manual test — export filled SVG**

1. Set variant to Filled
2. Click Export SVG
3. Open in browser — verify conic gradient fills with vector edges
4. Zoom in 400% — verify edges stay sharp (vector clip paths)

- [ ] **Step 5: Manual test — export gradient SVG**

1. Set variant to Gradient
2. Click Export SVG
3. Verify opacity ramp (back layers transparent, front opaque)

- [ ] **Step 6: Manual test — transparent background**

1. Check Transparent BG
2. Export SVG
3. Verify no background rect in SVG source

- [ ] **Step 7: Manual test — noise**

1. Enable noise
2. Export SVG
3. Verify `<feTurbulence>` filter in SVG source
4. Open in browser — verify noise overlay appears
