# Phase 1: Core Engine + Canvas Renderer — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port core modules from slidev-theme-portable, replace flubber with GSAP MorphSVGPlugin, build Canvas 2D render pipeline, verify visual output.

**Architecture:** Pure-function core engine (shapes, colours, morph, effects) feeds into a Canvas 2D renderer. All rendering uses native Canvas APIs: Path2D for shapes, createConicGradient() for fills, ctx.filter for blur, ImageData for noise. No SVG DOM, no foreignObject.

**Tech Stack:** Vite + TypeScript + Vitest + GSAP (with MorphSVGPlugin) + Canvas 2D API

**Source reference:** `F:\Documents\GitHub\slidev-theme-portable\components\` (shapes.ts, colours.ts, morph.ts, effects.ts)

---

## File Structure

```
brand-shapes/
├── package.json                    # CREATE — project config + dependencies
├── tsconfig.json                   # CREATE — TypeScript config
├── vite.config.ts                  # CREATE — Vite dev + library build
├── vitest.config.ts                # CREATE — Vitest config
├── index.html                      # CREATE — bare demo page for manual verification
├── src/
│   ├── index.ts                    # CREATE — library entry, re-exports core
│   ├── core/
│   │   ├── shapes.ts               # CREATE — port from slidev-theme (12 shapes, types)
│   │   ├── colours.ts              # CREATE — port from slidev-theme (5 families, pairings)
│   │   ├── morph.ts                # CREATE — NEW: GSAP MorphSVGPlugin wrapper (replaces flubber)
│   │   └── effects.ts              # CREATE — adapt from slidev-theme (Canvas-native effects)
│   └── renderer/
│       └── canvas-renderer.ts      # CREATE — Canvas 2D render pipeline (3 variants)
├── __tests__/
│   ├── shapes.test.ts              # CREATE — port + expand from slidev-theme tests
│   ├── colours.test.ts             # CREATE — port + expand from slidev-theme tests
│   ├── morph.test.ts               # CREATE — NEW: GSAP morph wrapper tests
│   └── effects.test.ts             # CREATE — adapt from slidev-theme (Canvas-native)
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `F:\Documents\GitHub\brand-shapes\package.json`
- Create: `F:\Documents\GitHub\brand-shapes\tsconfig.json`
- Create: `F:\Documents\GitHub\brand-shapes\vite.config.ts`
- Create: `F:\Documents\GitHub\brand-shapes\vitest.config.ts`
- Create: `F:\Documents\GitHub\brand-shapes\src\index.ts`

- [ ] **Step 1: Initialize package.json**

```bash
cd F:/Documents/GitHub/brand-shapes
npm init -y
```

Then edit `package.json` to:

```json
{
  "name": "brand-shapes",
  "version": "0.0.1",
  "type": "module",
  "description": "Interactive brand component tool — morphing shapes with gradients, noise, and blur",
  "main": "dist/brand-shapes.umd.js",
  "module": "dist/brand-shapes.es.js",
  "types": "dist/brand-shapes.d.ts",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "license": "MIT"
}
```

- [ ] **Step 2: Install dependencies**

```bash
cd F:/Documents/GitHub/brand-shapes
npm install gsap
npm install -D typescript vite vitest @types/node
```

Note: GSAP includes MorphSVGPlugin in the main package (free post-Webflow acquisition). Import via `gsap/MorphSVGPlugin`.

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationDir": "dist",
    "outDir": "dist",
    "rootDir": "src",
    "sourceMap": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "__tests__"]
}
```

- [ ] **Step 4: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'BrandShapes',
      fileName: 'brand-shapes',
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      external: [],
    },
  },
})
```

- [ ] **Step 5: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
})
```

- [ ] **Step 6: Create src/index.ts (empty entry)**

```typescript
// brand-shapes library entry
// Modules will be re-exported as they are built
```

- [ ] **Step 7: Verify scaffold works**

```bash
cd F:/Documents/GitHub/brand-shapes
npx tsc --noEmit
npx vitest run
```

Expected: TypeScript compiles with no errors. Vitest runs with 0 tests.

- [ ] **Step 8: Commit**

```bash
cd F:/Documents/GitHub/brand-shapes
git add package.json tsconfig.json vite.config.ts vitest.config.ts src/index.ts package-lock.json
git commit -m "scaffold: Vite + TypeScript + Vitest project"
```

---

## Task 2: Port shapes.ts

**Files:**
- Create: `F:\Documents\GitHub\brand-shapes\src\core\shapes.ts`
- Create: `F:\Documents\GitHub\brand-shapes\__tests__\shapes.test.ts`

This is a near-direct port from `slidev-theme-portable/components/shapes.ts`. The types, data, and exports are identical.

- [ ] **Step 1: Write failing tests**

Create `__tests__/shapes.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { shapes, getShape, shapeNames, type ShapeName } from '../src/core/shapes'

describe('shapes', () => {
  it('exports exactly 12 shapes', () => {
    expect(Object.keys(shapes)).toHaveLength(12)
  })

  it('has 4 primitive shapes', () => {
    const primitives = Object.values(shapes).filter(s => s.category === 'primitive')
    expect(primitives).toHaveLength(4)
  })

  it('has 4 organic shapes', () => {
    const organics = Object.values(shapes).filter(s => s.category === 'organic')
    expect(organics).toHaveLength(4)
  })

  it('has 4 angular shapes', () => {
    const angulars = Object.values(shapes).filter(s => s.category === 'angular')
    expect(angulars).toHaveLength(4)
  })

  it('each shape has a non-empty SVG path starting with M', () => {
    for (const [name, shape] of Object.entries(shapes)) {
      expect(shape.path, `${name} path`).toBeTruthy()
      expect(shape.path.startsWith('M'), `${name} path starts with M`).toBe(true)
    }
  })

  it('each shape has a valid viewBox (4 numbers)', () => {
    for (const [name, shape] of Object.entries(shapes)) {
      expect(shape.viewBox, `${name} viewBox`).toMatch(/^\d+ \d+ \d+ \d+$/)
    }
  })

  it('getShape returns correct shape by name', () => {
    const shape = getShape('primitive-1')
    expect(shape.category).toBe('primitive')
    expect(shape.path).toBeTruthy()
  })

  it('shapeNames lists all 12 names', () => {
    expect(shapeNames).toHaveLength(12)
    expect(shapeNames).toContain('primitive-1')
    expect(shapeNames).toContain('organic-4')
    expect(shapeNames).toContain('angular-4')
  })

  it('each path contains only valid SVG path commands', () => {
    const validCommands = /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s\-eE]+$/
    for (const [name, shape] of Object.entries(shapes)) {
      expect(shape.path, `${name} has valid SVG path chars`).toMatch(validCommands)
    }
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd F:/Documents/GitHub/brand-shapes && npx vitest run __tests__/shapes.test.ts
```

Expected: FAIL — module `../src/core/shapes` not found.

- [ ] **Step 3: Port shapes.ts from slidev-theme**

Create `src/core/shapes.ts` — direct copy from `slidev-theme-portable/components/shapes.ts`. The file is identical: same types (`ShapeCategory`, `ShapeName`, `ShapeDefinition`), same 12 shape path strings, same `getShape()` and `shapeNames` exports.

Copy the entire file contents from `F:\Documents\GitHub\slidev-theme-portable\components\shapes.ts` to `F:\Documents\GitHub\brand-shapes\src\core\shapes.ts`.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd F:/Documents/GitHub/brand-shapes && npx vitest run __tests__/shapes.test.ts
```

Expected: 9 tests PASS.

- [ ] **Step 5: Export from index.ts**

Update `src/index.ts`:

```typescript
export { shapes, getShape, shapeNames } from './core/shapes'
export type { ShapeCategory, ShapeName, ShapeDefinition } from './core/shapes'
```

- [ ] **Step 6: Commit**

```bash
cd F:/Documents/GitHub/brand-shapes
git add src/core/shapes.ts __tests__/shapes.test.ts src/index.ts
git commit -m "feat: port shape library (12 shapes, 3 categories)"
```

---

## Task 3: Port colours.ts

**Files:**
- Create: `F:\Documents\GitHub\brand-shapes\src\core\colours.ts`
- Create: `F:\Documents\GitHub\brand-shapes\__tests__\colours.test.ts`

Direct port from `slidev-theme-portable/components/colours.ts`. All types, data, and functions identical.

- [ ] **Step 1: Write failing tests**

Create `__tests__/colours.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  resolveColour,
  resolveScheme,
  resolveTextPairing,
  type ColourFamily,
} from '../src/core/colours'

describe('resolveColour', () => {
  it('resolves all 5 mid-tone tokens', () => {
    expect(resolveColour('lime')).toBe('#BEF958')
    expect(resolveColour('pink')).toBe('#FF38C0')
    expect(resolveColour('blue')).toBe('#4B01E6')
    expect(resolveColour('vermillion')).toBe('#EE4811')
    expect(resolveColour('brown')).toBe('#81330C')
  })

  it('resolves dark variant tokens', () => {
    expect(resolveColour('lime-dark')).toBe('#263212')
    expect(resolveColour('pink-dark')).toBe('#400E30')
    expect(resolveColour('blue-dark')).toBe('#170045')
    expect(resolveColour('vermillion-dark')).toBe('#471605')
    expect(resolveColour('brown-dark')).toBe('#341405')
  })

  it('resolves light variant tokens', () => {
    expect(resolveColour('lime-light')).toBe('#EDFFCC')
    expect(resolveColour('pink-light')).toBe('#FFC3F6')
    expect(resolveColour('blue-light')).toBe('#DEDAFF')
    expect(resolveColour('vermillion-light')).toBe('#FFC6BF')
    expect(resolveColour('brown-light')).toBe('#EFD8C2')
  })

  it('resolves white', () => {
    expect(resolveColour('white')).toBe('#FFFFFF')
  })
})

describe('resolveScheme', () => {
  it('maps lime to dark/mid/light narrative gradient', () => {
    expect(resolveScheme('lime')).toEqual({
      current: '#263212',
      catalyst: '#BEF958',
      future: '#EDFFCC',
    })
  })

  it('maps all 5 families correctly', () => {
    const families: ColourFamily[] = ['lime', 'pink', 'blue', 'vermillion', 'brown']
    for (const family of families) {
      const result = resolveScheme(family)
      expect(result.current, `${family} current`).toBeTruthy()
      expect(result.catalyst, `${family} catalyst`).toBeTruthy()
      expect(result.future, `${family} future`).toBeTruthy()
      expect(result.current).not.toBe(result.catalyst)
      expect(result.catalyst).not.toBe(result.future)
    }
  })
})

describe('resolveTextPairing', () => {
  it('returns cross-family text colours for lime', () => {
    const pairing = resolveTextPairing('lime')
    expect(pairing.onLight).toBe('#400E30')  // pink-dark
    expect(pairing.onDark).toBe('#FFC3F6')   // pink-light
  })

  it('all 5 families have text pairings', () => {
    const families: ColourFamily[] = ['lime', 'pink', 'blue', 'vermillion', 'brown']
    for (const family of families) {
      const pairing = resolveTextPairing(family)
      expect(pairing.onLight, `${family} onLight`).toMatch(/^#[0-9A-F]{6}$/i)
      expect(pairing.onDark, `${family} onDark`).toMatch(/^#[0-9A-F]{6}$/i)
    }
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd F:/Documents/GitHub/brand-shapes && npx vitest run __tests__/colours.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Port colours.ts from slidev-theme**

Copy `F:\Documents\GitHub\slidev-theme-portable\components\colours.ts` to `F:\Documents\GitHub\brand-shapes\src\core\colours.ts`. The file is identical.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd F:/Documents/GitHub/brand-shapes && npx vitest run __tests__/colours.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Export from index.ts**

Add to `src/index.ts`:

```typescript
export { resolveColour, resolveScheme, resolveTextPairing } from './core/colours'
export type { ColourFamily, ColourToken, GradientColours } from './core/colours'
```

- [ ] **Step 6: Commit**

```bash
cd F:/Documents/GitHub/brand-shapes
git add src/core/colours.ts __tests__/colours.test.ts src/index.ts
git commit -m "feat: port colour system (5 families, text pairings)"
```

---

## Task 4: Build morph.ts (GSAP MorphSVGPlugin)

**Files:**
- Create: `F:\Documents\GitHub\brand-shapes\src\core\morph.ts`
- Create: `F:\Documents\GitHub\brand-shapes\__tests__\morph.test.ts`

This is NOT a port — it's a new implementation replacing flubber with GSAP MorphSVGPlugin. The API shape is similar (`generateMorphSteps` → array of path strings) but the internals are entirely different.

**Important:** GSAP MorphSVGPlugin works by converting SVG paths to raw path data, interpolating, then converting back. In a test environment without a real DOM, we need to register the plugin and may need to use `MorphSVGPlugin.convertToPath()` or work with raw path strings directly.

- [ ] **Step 1: Write failing tests**

Create `__tests__/morph.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { generateMorphSteps, MIN_STEPS, MAX_STEPS } from '../src/core/morph'
import { shapes } from '../src/core/shapes'

describe('generateMorphSteps', () => {
  const fromPath = shapes['primitive-1'].path
  const toPath = shapes['angular-1'].path

  it('returns the requested number of steps', () => {
    const result = generateMorphSteps(fromPath, toPath, 8)
    expect(result.steps).toHaveLength(8)
  })

  it('clamps steps to minimum of 5', () => {
    const result = generateMorphSteps(fromPath, toPath, 2)
    expect(result.steps).toHaveLength(MIN_STEPS)
  })

  it('clamps steps to maximum of 15', () => {
    const result = generateMorphSteps(fromPath, toPath, 20)
    expect(result.steps).toHaveLength(MAX_STEPS)
  })

  it('first step matches the from path closely', () => {
    const result = generateMorphSteps(fromPath, toPath, 8)
    expect(result.steps[0]).toBeTruthy()
    expect(result.steps[0].startsWith('M')).toBe(true)
  })

  it('last step matches the to path closely', () => {
    const result = generateMorphSteps(fromPath, toPath, 8)
    const lastStep = result.steps[result.steps.length - 1]
    expect(lastStep).toBeTruthy()
    expect(lastStep.startsWith('M')).toBe(true)
  })

  it('all intermediate steps are valid SVG paths', () => {
    const result = generateMorphSteps(fromPath, toPath, 10)
    for (const step of result.steps) {
      expect(step).toBeTruthy()
      expect(step.startsWith('M')).toBe(true)
    }
  })

  it('exports MIN_STEPS and MAX_STEPS constants', () => {
    expect(MIN_STEPS).toBe(5)
    expect(MAX_STEPS).toBe(15)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd F:/Documents/GitHub/brand-shapes && npx vitest run __tests__/morph.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement morph.ts with GSAP MorphSVGPlugin**

Create `src/core/morph.ts`:

```typescript
import gsap from 'gsap'
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin'

gsap.registerPlugin(MorphSVGPlugin)

export const MIN_STEPS = 5
export const MAX_STEPS = 15

export interface MorphResult {
  steps: string[]
}

/**
 * Generate N intermediate SVG path strings between two shapes.
 * Uses GSAP MorphSVGPlugin for high-quality path interpolation.
 * Steps clamped to 5-15 per brand rules.
 */
export function generateMorphSteps(
  fromPath: string,
  toPath: string,
  stepCount: number,
): MorphResult {
  const clamped = Math.min(MAX_STEPS, Math.max(MIN_STEPS, stepCount))

  // Use MorphSVGPlugin.rawPathToString and MorphSVGPlugin.stringToRawPath
  // to interpolate between two SVG path strings
  const fromRaw = MorphSVGPlugin.stringToRawPath(fromPath)
  const toRaw = MorphSVGPlugin.stringToRawPath(toPath)

  // Ensure compatible point counts
  MorphSVGPlugin.equalizeSegmentQuantity(fromRaw, toRaw)

  const steps: string[] = []
  for (let i = 0; i < clamped; i++) {
    const t = clamped === 1 ? 0 : i / (clamped - 1)

    if (t === 0) {
      steps.push(MorphSVGPlugin.rawPathToString(fromRaw))
    } else if (t === 1) {
      steps.push(MorphSVGPlugin.rawPathToString(toRaw))
    } else {
      // Interpolate each segment
      const interpolated = fromRaw.map((segment, segIdx) => {
        const toSegment = toRaw[segIdx] || segment
        return segment.map((val, valIdx) => {
          const toVal = toSegment[valIdx] ?? val
          return val + (toVal - val) * t
        })
      })
      steps.push(MorphSVGPlugin.rawPathToString(interpolated))
    }
  }

  return { steps }
}
```

**Note:** The exact GSAP MorphSVGPlugin API for raw path manipulation may need adjustment during implementation. The key methods are `stringToRawPath`, `rawPathToString`, and path equalization. If GSAP's internal API differs, the implementation should be adapted — the test contract (N valid SVG path strings between from and to) remains the same.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd F:/Documents/GitHub/brand-shapes && npx vitest run __tests__/morph.test.ts
```

Expected: All tests PASS. If GSAP import issues occur in Node/Vitest, may need `vitest.config.ts` adjustments (e.g., `deps.inline: ['gsap']`).

- [ ] **Step 5: Export from index.ts**

Add to `src/index.ts`:

```typescript
export { generateMorphSteps, MIN_STEPS, MAX_STEPS } from './core/morph'
export type { MorphResult } from './core/morph'
```

- [ ] **Step 6: Commit**

```bash
cd F:/Documents/GitHub/brand-shapes
git add src/core/morph.ts __tests__/morph.test.ts src/index.ts
git commit -m "feat: GSAP MorphSVGPlugin morph engine (replaces flubber)"
```

---

## Task 5: Build effects.ts (Canvas-native)

**Files:**
- Create: `F:\Documents\GitHub\brand-shapes\src\core\effects.ts`
- Create: `F:\Documents\GitHub\brand-shapes\__tests__\effects.test.ts`

This is an **adaptation**, not a direct port. The slidev-theme version generates SVG filter markup (feTurbulence, feGaussianBlur, linearGradient). We keep the pure functions (`lerpColour`, `generateStepFills`, `buildConicGradientCSS`) but replace SVG filter builders with Canvas-native effect configs.

- [ ] **Step 1: Write failing tests**

Create `__tests__/effects.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  lerpColour,
  generateStepFills,
  buildConicGradientConfig,
  buildLinearGradientStops,
  NoiseConfig,
  BlurConfig,
  DEFAULT_NOISE_CONFIG,
  DEFAULT_BLUR_CONFIG,
} from '../src/core/effects'

describe('lerpColour', () => {
  it('returns first colour at t=0', () => {
    expect(lerpColour('#000000', '#ffffff', 0)).toBe('#000000')
  })

  it('returns second colour at t=1', () => {
    expect(lerpColour('#000000', '#ffffff', 1)).toBe('#ffffff')
  })

  it('returns midpoint at t=0.5', () => {
    const result = lerpColour('#000000', '#ffffff', 0.5)
    expect(result).toBe('#808080')
  })

  it('handles branded colours', () => {
    const result = lerpColour('#263212', '#EDFFCC', 0.5)
    expect(result).toMatch(/^#[0-9a-f]{6}$/i)
  })
})

describe('generateStepFills', () => {
  it('returns correct number of fills', () => {
    const fills = generateStepFills('#263212', '#BEF958', '#EDFFCC', 8)
    expect(fills).toHaveLength(8)
  })

  it('first fill is near current colour', () => {
    const fills = generateStepFills('#263212', '#BEF958', '#EDFFCC', 8)
    expect(fills[0]).toBe('#263212')
  })

  it('last fill is near future colour', () => {
    const fills = generateStepFills('#263212', '#BEF958', '#EDFFCC', 8)
    expect(fills[fills.length - 1]).toBe('#edffcc')
  })

  it('catalyst band appears in middle fills', () => {
    const fills = generateStepFills('#000000', '#ff0000', '#ffffff', 11)
    // Steps at ~45-55% should be catalyst (red)
    const midFill = fills[5]
    expect(midFill).toBe('#ff0000')
  })

  it('all fills are valid hex colours', () => {
    const fills = generateStepFills('#263212', '#BEF958', '#EDFFCC', 10)
    for (const fill of fills) {
      expect(fill).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})

describe('buildConicGradientConfig', () => {
  it('returns config with all three colours', () => {
    const config = buildConicGradientConfig('#263212', '#BEF958', '#EDFFCC')
    expect(config.current).toBe('#263212')
    expect(config.catalyst).toBe('#BEF958')
    expect(config.future).toBe('#EDFFCC')
  })

  it('defaults to 90 degree start angle', () => {
    const config = buildConicGradientConfig('#263212', '#BEF958', '#EDFFCC')
    expect(config.angleDeg).toBe(90)
  })

  it('accepts custom angle', () => {
    const config = buildConicGradientConfig('#263212', '#BEF958', '#EDFFCC', 180)
    expect(config.angleDeg).toBe(180)
  })

  it('defaults to 50/50 center', () => {
    const config = buildConicGradientConfig('#263212', '#BEF958', '#EDFFCC')
    expect(config.centerX).toBe(0.5)
    expect(config.centerY).toBe(0.5)
  })
})

describe('buildLinearGradientStops', () => {
  it('returns stops array with current/catalyst/future', () => {
    const stops = buildLinearGradientStops('#263212', '#BEF958', '#EDFFCC')
    expect(stops).toHaveLength(4)
    expect(stops[0]).toEqual({ offset: 0, color: '#263212' })
    expect(stops[1]).toEqual({ offset: 0.45, color: '#BEF958' })
    expect(stops[2]).toEqual({ offset: 0.55, color: '#BEF958' })
    expect(stops[3]).toEqual({ offset: 1, color: '#EDFFCC' })
  })
})

describe('noise and blur configs', () => {
  it('DEFAULT_NOISE_CONFIG has expected values', () => {
    expect(DEFAULT_NOISE_CONFIG.enabled).toBe(false)
    expect(DEFAULT_NOISE_CONFIG.opacity).toBeCloseTo(0.12)
    expect(DEFAULT_NOISE_CONFIG.size).toBe(256)
  })

  it('DEFAULT_BLUR_CONFIG has expected values', () => {
    expect(DEFAULT_BLUR_CONFIG.enabled).toBe(false)
    expect(DEFAULT_BLUR_CONFIG.radius).toBe(2)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd F:/Documents/GitHub/brand-shapes && npx vitest run __tests__/effects.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement effects.ts (Canvas-native)**

Create `src/core/effects.ts`:

```typescript
/**
 * Canvas-native effects for brand shapes.
 *
 * Ported from slidev-theme-portable SVG effects, adapted for Canvas 2D API.
 * - lerpColour and generateStepFills: unchanged (pure colour math)
 * - Gradient builders: return config objects for Canvas API (not SVG markup)
 * - Noise/blur: config objects for Canvas rendering (not SVG filters)
 */

export function lerpColour(colA: string, colB: string, t: number): string {
  const parse = (hex: string) => {
    const h = hex.replace('#', '')
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
  }
  const [r1, g1, b1] = parse(colA)
  const [r2, g2, b2] = parse(colB)
  const r = Math.round(r1 + (r2 - r1) * t)
  const g = Math.round(g1 + (g2 - g1) * t)
  const b = Math.round(b1 + (b2 - b1) * t)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

export function generateStepFills(
  current: string,
  catalyst: string,
  future: string,
  stepCount: number,
): string[] {
  const fills: string[] = []
  for (let i = 0; i < stepCount; i++) {
    const t = stepCount === 1 ? 0 : i / (stepCount - 1)
    let colour: string
    if (t <= 0.45) {
      colour = lerpColour(current, catalyst, t / 0.45)
    } else if (t <= 0.55) {
      colour = catalyst
    } else {
      colour = lerpColour(catalyst, future, (t - 0.55) / 0.45)
    }
    fills.push(colour)
  }
  return fills
}

export interface ConicGradientConfig {
  current: string
  catalyst: string
  future: string
  angleDeg: number
  centerX: number
  centerY: number
}

export function buildConicGradientConfig(
  current: string,
  catalyst: string,
  future: string,
  angleDeg: number = 90,
  centerX: number = 0.5,
  centerY: number = 0.5,
): ConicGradientConfig {
  return { current, catalyst, future, angleDeg, centerX, centerY }
}

export interface GradientStop {
  offset: number
  color: string
}

export function buildLinearGradientStops(
  current: string,
  catalyst: string,
  future: string,
): GradientStop[] {
  return [
    { offset: 0, color: current },
    { offset: 0.45, color: catalyst },
    { offset: 0.55, color: catalyst },
    { offset: 1, color: future },
  ]
}

export interface NoiseConfig {
  enabled: boolean
  opacity: number
  size: number
}

export const DEFAULT_NOISE_CONFIG: NoiseConfig = {
  enabled: false,
  opacity: 0.12,
  size: 256,
}

export interface BlurConfig {
  enabled: boolean
  radius: number
}

export const DEFAULT_BLUR_CONFIG: BlurConfig = {
  enabled: false,
  radius: 2,
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd F:/Documents/GitHub/brand-shapes && npx vitest run __tests__/effects.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Export from index.ts**

Add to `src/index.ts`:

```typescript
export {
  lerpColour,
  generateStepFills,
  buildConicGradientConfig,
  buildLinearGradientStops,
  DEFAULT_NOISE_CONFIG,
  DEFAULT_BLUR_CONFIG,
} from './core/effects'
export type { ConicGradientConfig, GradientStop, NoiseConfig, BlurConfig } from './core/effects'
```

- [ ] **Step 6: Commit**

```bash
cd F:/Documents/GitHub/brand-shapes
git add src/core/effects.ts __tests__/effects.test.ts src/index.ts
git commit -m "feat: Canvas-native effects (gradients, noise config, blur config)"
```

---

## Task 6: Build canvas-renderer.ts

**Files:**
- Create: `F:\Documents\GitHub\brand-shapes\src\renderer\canvas-renderer.ts`

This is entirely new code. The Canvas renderer takes the output of the core engine (morph steps, colours, effect configs) and draws to a `<canvas>` element using native Canvas 2D APIs.

No unit tests for this task — it's a visual rendering pipeline that must be verified by eye in Task 7. The core logic (shapes, colours, morph, effects) is already tested.

- [ ] **Step 1: Implement canvas-renderer.ts**

Create `src/renderer/canvas-renderer.ts`:

```typescript
import { type ShapeName, getShape } from '../core/shapes'
import { type ColourFamily, resolveScheme } from '../core/colours'
import { generateMorphSteps } from '../core/morph'
import {
  generateStepFills,
  buildConicGradientConfig,
  buildLinearGradientStops,
  type NoiseConfig,
  type BlurConfig,
  DEFAULT_NOISE_CONFIG,
  DEFAULT_BLUR_CONFIG,
} from '../core/effects'

export type Variant = 'wireframe' | 'filled' | 'gradient'
export type Alignment = 'left' | 'right' | 'top' | 'bottom' | 'center'

export interface RenderConfig {
  from: ShapeName
  to: ShapeName
  steps: number
  scheme: ColourFamily
  variant: Variant
  noise: NoiseConfig
  blur: BlurConfig
  align: Alignment
  spread: number
}

export const DEFAULT_CONFIG: RenderConfig = {
  from: 'organic-1',
  to: 'angular-3',
  steps: 8,
  scheme: 'lime',
  variant: 'filled',
  noise: { ...DEFAULT_NOISE_CONFIG },
  blur: { ...DEFAULT_BLUR_CONFIG },
  align: 'center',
  spread: 1,
}

/**
 * Generate a noise ImageData texture for overlay compositing.
 */
function generateNoiseTexture(size: number, opacity: number): ImageData {
  const data = new Uint8ClampedArray(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    const val = Math.random() * 255
    const idx = i * 4
    data[idx] = val
    data[idx + 1] = val
    data[idx + 2] = val
    data[idx + 3] = opacity * 255
  }
  return new ImageData(data, size, size)
}

/**
 * Compute per-step transform for filled/gradient variants.
 * Back steps scale larger with offset; front steps scale smaller.
 */
function computeStepTransform(
  stepIndex: number,
  totalSteps: number,
  align: Alignment,
  spread: number,
): { scale: number; offsetX: number; offsetY: number } {
  const t = totalSteps === 1 ? 0 : stepIndex / (totalSteps - 1)
  const scale = 1.15 - t * 0.2 // 1.15 → 0.95
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

/**
 * Main render function. Draws brand shape to the given canvas.
 */
export function render(canvas: HTMLCanvasElement, config: RenderConfig): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  canvas.width = width * dpr
  canvas.height = height * dpr
  ctx.scale(dpr, dpr)

  ctx.clearRect(0, 0, width, height)

  const fromShape = getShape(config.from)
  const toShape = getShape(config.to)
  const { steps } = generateMorphSteps(fromShape.path, toShape.path, config.steps)
  const colours = resolveScheme(config.scheme)

  // Apply blur if enabled
  if (config.blur.enabled) {
    ctx.filter = `blur(${config.blur.radius}px)`
  } else {
    ctx.filter = 'none'
  }

  // Parse viewBox for coordinate mapping
  const vb = fromShape.viewBox.split(' ').map(Number)
  const scaleX = width / vb[2]
  const scaleY = height / vb[3]
  const scaleFactor = Math.min(scaleX, scaleY) * 0.8
  const translateX = (width - vb[2] * scaleFactor) / 2
  const translateY = (height - vb[3] * scaleFactor) / 2

  switch (config.variant) {
    case 'wireframe':
      renderWireframe(ctx, steps, colours, scaleFactor, translateX, translateY)
      break
    case 'filled':
      renderFilled(ctx, steps, colours, config, scaleFactor, translateX, translateY)
      break
    case 'gradient':
      renderGradient(ctx, steps, colours, config, scaleFactor, translateX, translateY)
      break
  }

  // Reset filter before noise overlay
  ctx.filter = 'none'

  // Noise overlay
  if (config.noise.enabled) {
    const noiseTexture = generateNoiseTexture(config.noise.size, config.noise.opacity)
    ctx.globalCompositeOperation = 'overlay'
    const tempCanvas = new OffscreenCanvas(config.noise.size, config.noise.size)
    const tempCtx = tempCanvas.getContext('2d')!
    tempCtx.putImageData(noiseTexture, 0, 0)
    // Tile the noise across the canvas
    const pattern = ctx.createPattern(tempCanvas, 'repeat')
    if (pattern) {
      ctx.fillStyle = pattern
      ctx.fillRect(0, 0, width, height)
    }
    ctx.globalCompositeOperation = 'source-over'
  }
}

function renderWireframe(
  ctx: CanvasRenderingContext2D,
  steps: string[],
  colours: { current: string; catalyst: string; future: string },
  scale: number,
  tx: number,
  ty: number,
): void {
  const gradientStops = buildLinearGradientStops(colours.current, colours.catalyst, colours.future)
  const gradient = ctx.createLinearGradient(0, 0, ctx.canvas.clientWidth, ctx.canvas.clientHeight)
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

function renderFilled(
  ctx: CanvasRenderingContext2D,
  steps: string[],
  colours: { current: string; catalyst: string; future: string },
  config: RenderConfig,
  scale: number,
  tx: number,
  ty: number,
): void {
  const fills = generateStepFills(colours.current, colours.catalyst, colours.future, steps.length)

  // Draw back-to-front
  for (let i = 0; i < steps.length; i++) {
    const path = new Path2D(steps[i])
    const { scale: stepScale, offsetX, offsetY } = computeStepTransform(
      i, steps.length, config.align, config.spread,
    )

    // Build conic gradient for this step
    const centerX = ctx.canvas.clientWidth / 2
    const centerY = ctx.canvas.clientHeight / 2
    const angleDeg = 90 + (i / steps.length) * 120
    const angleRad = (angleDeg * Math.PI) / 180
    const conicGradient = ctx.createConicGradient(angleRad, centerX, centerY)
    conicGradient.addColorStop(0, colours.current)
    conicGradient.addColorStop(0.305, colours.future)
    conicGradient.addColorStop(0.472, colours.catalyst)
    conicGradient.addColorStop(1, colours.current)

    ctx.save()
    ctx.translate(tx + offsetX, ty + offsetY)
    ctx.scale(scale * stepScale, scale * stepScale)
    ctx.fillStyle = conicGradient
    ctx.fill(path)
    ctx.restore()
  }
}

function renderGradient(
  ctx: CanvasRenderingContext2D,
  steps: string[],
  colours: { current: string; catalyst: string; future: string },
  config: RenderConfig,
  scale: number,
  tx: number,
  ty: number,
): void {
  // Same as filled, but with progressive opacity
  for (let i = 0; i < steps.length; i++) {
    const path = new Path2D(steps[i])
    const { scale: stepScale, offsetX, offsetY } = computeStepTransform(
      i, steps.length, config.align, config.spread,
    )
    const opacity = 0.3 + (i / steps.length) * 0.7

    const centerX = ctx.canvas.clientWidth / 2
    const centerY = ctx.canvas.clientHeight / 2
    const angleDeg = 90 + (i / steps.length) * 120
    const angleRad = (angleDeg * Math.PI) / 180
    const conicGradient = ctx.createConicGradient(angleRad, centerX, centerY)
    conicGradient.addColorStop(0, colours.current)
    conicGradient.addColorStop(0.305, colours.future)
    conicGradient.addColorStop(0.472, colours.catalyst)
    conicGradient.addColorStop(1, colours.current)

    ctx.save()
    ctx.translate(tx + offsetX, ty + offsetY)
    ctx.scale(scale * stepScale, scale * stepScale)
    ctx.globalAlpha = opacity
    ctx.fillStyle = conicGradient
    ctx.fill(path)
    ctx.restore()
  }
  ctx.globalAlpha = 1
}
```

- [ ] **Step 2: Export from index.ts**

Add to `src/index.ts`:

```typescript
export { render, DEFAULT_CONFIG } from './renderer/canvas-renderer'
export type { RenderConfig, Variant, Alignment } from './renderer/canvas-renderer'
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd F:/Documents/GitHub/brand-shapes && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
cd F:/Documents/GitHub/brand-shapes
git add src/renderer/canvas-renderer.ts src/index.ts
git commit -m "feat: Canvas 2D renderer (wireframe, filled, gradient variants)"
```

---

## Task 7: Demo Page for Visual Verification

**Files:**
- Modify: `F:\Documents\GitHub\brand-shapes\index.html`

Create a bare-bones HTML page that renders the brand shape using the Canvas renderer. This is for manual visual verification — does the Canvas output look like the original BrandShape?

- [ ] **Step 1: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Brand Shapes — Phase 1 Verification</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0a0a0a;
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      gap: 32px;
      padding: 32px;
      font-family: system-ui, sans-serif;
      color: #fff;
    }
    .card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }
    .card label {
      font-size: 14px;
      opacity: 0.6;
    }
    canvas {
      width: 400px;
      height: 400px;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
    }
  </style>
</head>
<body>
  <div class="card">
    <canvas id="wireframe"></canvas>
    <label>Wireframe — lime</label>
  </div>
  <div class="card">
    <canvas id="filled"></canvas>
    <label>Filled — pink</label>
  </div>
  <div class="card">
    <canvas id="gradient"></canvas>
    <label>Gradient — blue (noise + blur)</label>
  </div>

  <script type="module">
    import { render } from './src/renderer/canvas-renderer.ts'

    render(document.getElementById('wireframe'), {
      from: 'organic-1', to: 'angular-3', steps: 8,
      scheme: 'lime', variant: 'wireframe',
      noise: { enabled: false, opacity: 0.12, size: 256 },
      blur: { enabled: false, radius: 2 },
      align: 'center', spread: 1,
    })

    render(document.getElementById('filled'), {
      from: 'primitive-2', to: 'organic-4', steps: 10,
      scheme: 'pink', variant: 'filled',
      noise: { enabled: false, opacity: 0.12, size: 256 },
      blur: { enabled: false, radius: 2 },
      align: 'right', spread: 1.2,
    })

    render(document.getElementById('gradient'), {
      from: 'angular-1', to: 'organic-2', steps: 12,
      scheme: 'blue', variant: 'gradient',
      noise: { enabled: true, opacity: 0.12, size: 256 },
      blur: { enabled: true, radius: 2 },
      align: 'left', spread: 1.5,
    })
  </script>
</body>
</html>
```

- [ ] **Step 2: Run dev server and verify visually**

```bash
cd F:/Documents/GitHub/brand-shapes && npx vite
```

Open http://localhost:5173 in a browser. Verify:
- Wireframe: stroked outlines with gradient colour, multiple opacity layers
- Filled: stacked shapes with conic gradient fills, offset transforms
- Gradient: same as filled but with progressive opacity
- Noise grain visible on the blue shape
- Slight blur on the blue shape

- [ ] **Step 3: Run all tests to confirm nothing broke**

```bash
cd F:/Documents/GitHub/brand-shapes && npx vitest run
```

Expected: All tests PASS across shapes, colours, morph, and effects.

- [ ] **Step 4: Commit**

```bash
cd F:/Documents/GitHub/brand-shapes
git add index.html
git commit -m "feat: Phase 1 verification demo page (3 variants)"
```

---

## Phase 1 Complete Checklist

After all tasks, verify:

- [ ] `npx vitest run` — all tests pass
- [ ] `npx tsc --noEmit` — no TypeScript errors
- [ ] `npx vite` → http://localhost:5173 — 3 brand shapes render correctly
- [ ] Wireframe variant shows stroked outlines with gradient
- [ ] Filled variant shows stacked conic-gradient shapes
- [ ] Gradient variant shows stacked shapes with progressive opacity
- [ ] Noise overlay visible when enabled
- [ ] Blur effect visible when enabled
- [ ] All commits are atomic and on the feature branch
