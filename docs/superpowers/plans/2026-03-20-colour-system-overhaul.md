# Colour System Overhaul + Demo Enhancements

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ColourFamily-based colour system with direct hex colour selection (from/catalyst/to), add background colour, randomize button, and PNG export.

**Architecture:** Strip the family→gradient resolve layer from `colours.ts`. Pass `{ current, catalyst, future }` hex strings directly through `RenderConfig` to the renderer. Presets store 3 hex values instead of a family name. Demo UI gets three brand-colour dropdowns, a background colour picker, randomize button, and PNG export with transparent background option.

**Tech Stack:** TypeScript, Vitest, Canvas 2D API, Lit, lil-gui

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/core/colours.ts` | **Rewrite** | Export flat `BRAND_PALETTE` array + `GradientColours` type. Remove families, resolve functions, text pairings. |
| `__tests__/colours.test.ts` | **Rewrite** | Test palette completeness and hex format. Remove family/scheme/pairing tests. |
| `src/renderer/canvas-renderer.ts` | **Modify** | Replace `scheme: ColourFamily` with `colours: GradientColours` and `background?: string` on `RenderConfig`. |
| `src/demo/presets.ts` | **Rewrite** | Replace `scheme: ColourFamily` with `colourFrom/colourCatalyst/colourTo` hex strings. 6 Figma presets. Add `background` field. |
| `src/demo/demo.ts` | **Modify** | Replace scheme dropdown with 3 colour dropdowns. Add background dropdown, randomize button, export button + transparent toggle. |
| `src/component/brand-shape.ts` | **Modify** | Replace `scheme` attribute with `colour-from`, `colour-catalyst`, `colour-to`, `background`. |
| `src/index.ts` | **Modify** | Update exports to match new `colours.ts` API. |

---

### Task 1: Rewrite `colours.ts` — flat brand palette

**Files:**
- Rewrite: `src/core/colours.ts`
- Rewrite: `__tests__/colours.test.ts`

- [ ] **Step 1: Write failing tests for new palette API**

```typescript
// __tests__/colours.test.ts
import { describe, it, expect } from 'vitest'
import { BRAND_PALETTE, getColourHex, brandColourNames, brandColourHexes, allColourHexes } from '../src/core/colours'

describe('BRAND_PALETTE', () => {
  it('contains exactly 16 brand colours', () => {
    expect(BRAND_PALETTE).toHaveLength(16)
  })

  it('every entry has a name and valid hex', () => {
    for (const c of BRAND_PALETTE) {
      expect(c.name).toBeTruthy()
      expect(c.hex).toMatch(/^#[0-9A-F]{6}$/i)
    }
  })

  it('contains all 5 mid-tones', () => {
    const hexes = BRAND_PALETTE.map(c => c.hex)
    expect(hexes).toContain('#BEF958') // lime
    expect(hexes).toContain('#81330C') // brown
    expect(hexes).toContain('#FF38C0') // pink
    expect(hexes).toContain('#EE4811') // vermillion
    expect(hexes).toContain('#4B01E6') // blue
  })

  it('contains all 5 darks', () => {
    const hexes = BRAND_PALETTE.map(c => c.hex)
    expect(hexes).toContain('#263212')
    expect(hexes).toContain('#341405')
    expect(hexes).toContain('#400E30')
    expect(hexes).toContain('#471605')
    expect(hexes).toContain('#170045')
  })

  it('contains all 5 lights', () => {
    const hexes = BRAND_PALETTE.map(c => c.hex)
    expect(hexes).toContain('#EDFFCC')
    expect(hexes).toContain('#EFD8C2')
    expect(hexes).toContain('#FFC3F6')
    expect(hexes).toContain('#FFC6BF')
    expect(hexes).toContain('#DEDAFF')
  })

  it('contains white', () => {
    const hexes = BRAND_PALETTE.map(c => c.hex)
    expect(hexes).toContain('#FFFFFF')
  })

  it('has no duplicate hex values', () => {
    const hexes = BRAND_PALETTE.map(c => c.hex)
    expect(new Set(hexes).size).toBe(hexes.length)
  })
})

describe('getColourHex', () => {
  it('returns hex for a valid name', () => {
    expect(getColourHex('lime')).toBe('#BEF958')
  })

  it('returns undefined for an invalid name', () => {
    expect(getColourHex('nope')).toBeUndefined()
  })
})

describe('brandColourNames', () => {
  it('returns 16 names', () => {
    expect(brandColourNames).toHaveLength(16)
  })
})

describe('brandColourHexes', () => {
  it('returns 16 hex values', () => {
    expect(brandColourHexes).toHaveLength(16)
  })

  it('all entries are valid hex', () => {
    for (const hex of brandColourHexes) {
      expect(hex).toMatch(/^#[0-9A-F]{6}$/i)
    }
  })
})

describe('allColourHexes', () => {
  it('includes brand palette plus preset extras', () => {
    expect(allColourHexes).toHaveLength(18)
    expect(allColourHexes).toContain('#FEA6E1') // rose accent
    expect(allColourHexes).toContain('#C2F462') // alt lime
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd F:\Documents\GitHub\brand-shapes && npx vitest run __tests__/colours.test.ts`
Expected: FAIL — `BRAND_PALETTE` not found

- [ ] **Step 3: Implement new `colours.ts`**

```typescript
// src/core/colours.ts

export interface BrandColour {
  name: string
  hex: string
}

export interface GradientColours {
  current: string
  catalyst: string
  future: string
}

export const BRAND_PALETTE: BrandColour[] = [
  // Lime
  { name: 'lime-dark', hex: '#263212' },
  { name: 'lime', hex: '#BEF958' },
  { name: 'lime-light', hex: '#EDFFCC' },
  // Brown
  { name: 'brown-dark', hex: '#341405' },
  { name: 'brown', hex: '#81330C' },
  { name: 'brown-light', hex: '#EFD8C2' },
  // Pink
  { name: 'pink-dark', hex: '#400E30' },
  { name: 'pink', hex: '#FF38C0' },
  { name: 'pink-light', hex: '#FFC3F6' },
  // Vermillion
  { name: 'vermillion-dark', hex: '#471605' },
  { name: 'vermillion', hex: '#EE4811' },
  { name: 'vermillion-light', hex: '#FFC6BF' },
  // Blue
  { name: 'blue-dark', hex: '#170045' },
  { name: 'blue', hex: '#4B01E6' },
  { name: 'blue-light', hex: '#DEDAFF' },
  // White
  { name: 'white', hex: '#FFFFFF' },
]

const hexMap = new Map(BRAND_PALETTE.map(c => [c.name, c.hex]))

export function getColourHex(name: string): string | undefined {
  return hexMap.get(name)
}

export const brandColourNames = BRAND_PALETTE.map(c => c.name)

/** Hex values only, for use in dropdowns */
export const brandColourHexes = BRAND_PALETTE.map(c => c.hex)

/**
 * Off-palette colours used by Figma presets.
 * NOT part of the core brand palette, but needed as dropdown options
 * so preset colours display correctly in lil-gui.
 */
export const PRESET_EXTRAS: BrandColour[] = [
  { name: 'rose-accent', hex: '#FEA6E1' },
  { name: 'alt-lime', hex: '#C2F462' },
]

/** All colours available in dropdowns: brand palette + preset extras */
export const allColourHexes = [...brandColourHexes, ...PRESET_EXTRAS.map(c => c.hex)]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd F:\Documents\GitHub\brand-shapes && npx vitest run __tests__/colours.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
cd F:\Documents\GitHub\brand-shapes
git add src/core/colours.ts __tests__/colours.test.ts
git commit -m "feat: replace ColourFamily system with flat BRAND_PALETTE"
```

---

### Task 2: Update `RenderConfig` and renderer to take direct hex colours + background

**Files:**
- Modify: `src/renderer/canvas-renderer.ts`

- [ ] **Step 1: Update `RenderConfig` interface**

Replace `scheme: ColourFamily` with `colours: GradientColours` and add `background?: string`:

```typescript
// In RenderConfig interface, replace:
//   scheme: ColourFamily
// With:
  colours: GradientColours
  background?: string
```

Update the import line:

```typescript
// Replace:
//   import { type ColourFamily, resolveScheme, resolveGradientColours } from '../core/colours'
// With:
import type { GradientColours } from '../core/colours'
```

- [ ] **Step 2: Update `DEFAULT_CONFIG`**

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
}
```

- [ ] **Step 3: Update `render()` function**

Replace lines 147-148:

```typescript
// Replace:
//   const colours = resolveScheme(config.scheme)
//   const gradientColours = resolveGradientColours(config.scheme)
// With (single variable, used for all variants):
const colours = config.colours
```

Then update the three render calls (lines 166-173) to all pass `colours` instead of some passing `gradientColours`:

```typescript
case 'wireframe':
  renderWireframe(offCtx, steps, colours, ...)
  break
case 'filled':
  renderFilled(offCtx, steps, colours, ...)
  break
case 'gradient':
  renderGradient(offCtx, steps, colours, ...)
  break
```

Add background fill at the top of `render()`, after `ctx.clearRect(0, 0, width, height)`:

```typescript
if (config.background && config.background !== 'transparent') {
  ctx.fillStyle = config.background
  ctx.fillRect(0, 0, width, height)
}
```

- [ ] **Step 4: Verify build compiles**

Run: `cd F:\Documents\GitHub\brand-shapes && npx tsc --noEmit`
Expected: Errors in demo.ts, brand-shape.ts (they still reference `scheme`) — that's expected, we fix those next.

- [ ] **Step 5: Commit**

```bash
cd F:\Documents\GitHub\brand-shapes
git add src/renderer/canvas-renderer.ts
git commit -m "feat: RenderConfig takes direct hex colours + background"
```

---

### Task 3: Rewrite presets with Figma-sourced colour combos

**Files:**
- Rewrite: `src/demo/presets.ts`

- [ ] **Step 1: Rewrite presets.ts**

```typescript
import type { ShapeName } from '../core/shapes'
import type { Variant, Alignment } from '../renderer/canvas-renderer'

export interface PresetConfig {
  from: ShapeName
  to: ShapeName
  steps: number
  colourFrom: string
  colourCatalyst: string
  colourTo: string
  variant: Variant
  noise: boolean
  blur: boolean
  align: Alignment
  spread: number
  noiseOpacity: number
  blurRadius: number
  scaleFrom: number
  scaleTo: number
  background: string
}

export const presets: Record<string, PresetConfig> = {
  'Organic Flow': {
    from: 'organic-1', to: 'organic-3', steps: 10,
    colourFrom: '#4B01E6', colourCatalyst: '#BEF958', colourTo: '#FEA6E1',
    variant: 'filled',
    noise: true, blur: false,
    align: 'right', spread: 1.2,
    noiseOpacity: 0.08, blurRadius: 2, scaleFrom: 1.15, scaleTo: 0.95,
    background: '#000000',
  },
  'Angular Edge': {
    from: 'angular-1', to: 'angular-4', steps: 12,
    colourFrom: '#EE4811', colourCatalyst: '#341405', colourTo: '#FF38C0',
    variant: 'filled',
    noise: false, blur: false,
    align: 'left', spread: 1.5,
    noiseOpacity: 0.12, blurRadius: 2, scaleFrom: 1.15, scaleTo: 0.95,
    background: '#000000',
  },
  'Chromatic Burst': {
    from: 'primitive-2', to: 'organic-4', steps: 8,
    colourFrom: '#BEF958', colourCatalyst: '#FEA6E1', colourTo: '#81330C',
    variant: 'filled',
    noise: true, blur: true,
    align: 'center', spread: 1.0,
    noiseOpacity: 0.10, blurRadius: 3, scaleFrom: 1.2, scaleTo: 0.85,
    background: '#000000',
  },
  'Vermillion Heat': {
    from: 'organic-2', to: 'angular-2', steps: 10,
    colourFrom: '#BEF958', colourCatalyst: '#FFC3F6', colourTo: '#4B01E6',
    variant: 'gradient',
    noise: true, blur: false,
    align: 'bottom', spread: 1.3,
    noiseOpacity: 0.12, blurRadius: 2, scaleFrom: 1.15, scaleTo: 0.95,
    background: '#000000',
  },
  'Earth Tone': {
    from: 'primitive-1', to: 'primitive-4', steps: 8,
    colourFrom: '#EE4811', colourCatalyst: '#FFC3F6', colourTo: '#C2F462',
    variant: 'filled',
    noise: true, blur: false,
    align: 'right', spread: 1.8,
    noiseOpacity: 0.15, blurRadius: 2, scaleFrom: 1.3, scaleTo: 0.8,
    background: '#000000',
  },
  'Wireframe Study': {
    from: 'organic-1', to: 'angular-3', steps: 12,
    colourFrom: '#81330C', colourCatalyst: '#FFC3F6', colourTo: '#4B01E6',
    variant: 'wireframe',
    noise: false, blur: false,
    align: 'center', spread: 1.0,
    noiseOpacity: 0.12, blurRadius: 2, scaleFrom: 1.15, scaleTo: 0.95,
    background: '#000000',
  },
}

export const presetNames = Object.keys(presets)
```

- [ ] **Step 2: Commit**

```bash
cd F:\Documents\GitHub\brand-shapes
git add src/demo/presets.ts
git commit -m "feat: replace family presets with 6 Figma-sourced colour combos"
```

---

### Task 4: Update demo.ts — colour dropdowns, background, randomize, export

**Files:**
- Modify: `src/demo/demo.ts`

- [ ] **Step 1: Update config object**

Replace `scheme: 'blue'` with direct colour fields and add new fields:

```typescript
// Replace scheme with:
  colourFrom: '#4B01E6',
  colourCatalyst: '#BEF958',
  colourTo: '#FEA6E1',
  background: '#000000',
```

- [ ] **Step 2: Update `buildRenderConfig()` to pass colours directly**

```typescript
function buildRenderConfig(customSteps?: string[]): RenderConfig {
  return {
    from: config.from as any,
    to: config.to as any,
    steps: config.steps,
    colours: {
      current: config.colourFrom,
      catalyst: config.colourCatalyst,
      future: config.colourTo,
    },
    variant: config.variant,
    noise: {
      enabled: config.noise,
      opacity: config.noiseOpacity,
      size: DEFAULT_NOISE_CONFIG.size,
    },
    blur: {
      enabled: config.blur,
      radius: config.blurRadius,
    },
    align: config.align,
    spread: config.spread,
    scaleFrom: config.scaleFrom,
    scaleTo: config.scaleTo,
    customSteps: customSteps,
    background: config.background,
  }
}
```

- [ ] **Step 3: Update preset application**

The preset onChange handler already uses `Object.assign(config, preset)` which will work since preset fields now match config fields. Remove the old `scheme` property from config entirely.

- [ ] **Step 4: Replace Colour folder in lil-gui**

Build the hex→label map for dropdown display, and replace the single scheme dropdown with 3 colour dropdowns:

```typescript
import { allColourHexes } from '../core/colours'

// Background options: brand colours + black + white + transparent
const backgroundOptions = ['transparent', '#000000', '#FFFFFF', ...allColourHexes]

const colourFolder = gui.addFolder('Colour')
colourFolder.add(config, 'colourFrom', allColourHexes).name('From').onChange(onConfigChange)
colourFolder.add(config, 'colourCatalyst', allColourHexes).name('Catalyst').onChange(onConfigChange)
colourFolder.add(config, 'colourTo', allColourHexes).name('To').onChange(onConfigChange)
colourFolder.add(config, 'background', backgroundOptions).name('Background').onChange(onConfigChange)
```

- [ ] **Step 5: Add Randomize button**

```typescript
import { shapeNames } from '../core/shapes'

function randomize() {
  const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
  config.from = pick(shapeNames) as any
  config.to = pick(shapeNames) as any
  config.steps = Math.floor(Math.random() * 11) + 5 // 5-15
  config.colourFrom = pick(allColourHexes)
  config.colourCatalyst = pick(allColourHexes)
  config.colourTo = pick(allColourHexes)
  config.variant = pick(['wireframe', 'filled', 'gradient'] as const)
  config.align = pick(['left', 'right', 'top', 'bottom', 'center'] as const)
  config.spread = Math.round((Math.random() * 9.5 + 0.5) * 10) / 10 // 0.5-10
  config.scaleFrom = Math.round((Math.random() * 1.5 + 0.5) * 100) / 100 // 0.5-2.0
  config.scaleTo = Math.round((Math.random() * 1.5 + 0.5) * 100) / 100
  config.background = pick(backgroundOptions)
  gui.controllersRecursive().forEach(c => c.updateDisplay())
  onConfigChange()
}

gui.add({ randomize }, 'randomize').name('Randomize')
```

- [ ] **Step 6: Add PNG Export with transparent background toggle**

```typescript
const exportConfig = {
  transparentBg: false,
}

function exportPNG() {
  // Re-render with transparent background if toggle is on
  if (exportConfig.transparentBg) {
    const savedBg = config.background
    config.background = 'transparent'
    startCurrentMode()
    // Wait one frame for render to complete
    requestAnimationFrame(() => {
      canvas.toBlob((blob) => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'brand-shape.png'
        a.click()
        URL.revokeObjectURL(url)
        // Restore background
        config.background = savedBg
        startCurrentMode()
      }, 'image/png')
    })
  } else {
    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'brand-shape.png'
      a.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }
}

const exportFolder = gui.addFolder('Export')
exportFolder.add(exportConfig, 'transparentBg').name('Transparent BG')
exportFolder.add({ exportPNG }, 'exportPNG').name('Export PNG')
```

- [ ] **Step 7: Verify the demo runs**

Run: `cd F:\Documents\GitHub\brand-shapes && npx vite --open`
Expected: Demo loads, colour dropdowns work, background changes, randomize randomizes (not noise/blur), export downloads PNG.

- [ ] **Step 8: Commit**

```bash
cd F:\Documents\GitHub\brand-shapes
git add src/demo/demo.ts
git commit -m "feat: colour dropdowns, background, randomize, PNG export"
```

---

### Task 5: Update Web Component attributes

**Files:**
- Modify: `src/component/brand-shape.ts`

- [ ] **Step 1: Replace `scheme` with colour attributes**

Replace `scheme` property and field with:

```typescript
// In static properties, replace scheme with:
    colourFrom: { type: String, attribute: 'colour-from' },
    colourCatalyst: { type: String, attribute: 'colour-catalyst' },
    colourTo: { type: String, attribute: 'colour-to' },
    background: { type: String },
```

Replace field declarations:

```typescript
// Replace:
//   scheme: ColourFamily = 'lime'
// With:
  colourFrom = '#4B01E6'
  colourCatalyst = '#BEF958'
  colourTo = '#FEA6E1'
  background = 'transparent'
```

Remove the `ColourFamily` import (no replacement needed — the `RenderConfig` type already defines `colours: GradientColours` so the types flow through without an explicit import in the component).

- [ ] **Step 2: Update `_buildConfig()`**

```typescript
private _buildConfig(): RenderConfig {
  return {
    from: this.from,
    to: this.to,
    steps: this.steps,
    colours: {
      current: this.colourFrom,
      catalyst: this.colourCatalyst,
      future: this.colourTo,
    },
    variant: this.variant,
    noise: {
      enabled: this.noiseEnabled,
      opacity: this.noiseOpacity,
      size: DEFAULT_NOISE_CONFIG.size,
    },
    blur: {
      enabled: this.blurEnabled,
      radius: this.blurRadius,
    },
    align: this.align,
    spread: this.spread,
    scaleFrom: this.scaleFrom,
    scaleTo: this.scaleTo,
    background: this.background,
  }
}
```

- [ ] **Step 3: Commit**

```bash
cd F:\Documents\GitHub\brand-shapes
git add src/component/brand-shape.ts
git commit -m "feat: replace scheme attribute with colour-from/catalyst/to + background"
```

---

### Task 6: Update library exports

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Update exports**

```typescript
export { shapes, getShape, shapeNames } from './core/shapes'
export type { ShapeCategory, ShapeName, ShapeDefinition } from './core/shapes'

export { BRAND_PALETTE, PRESET_EXTRAS, getColourHex, brandColourNames, brandColourHexes, allColourHexes } from './core/colours'
export type { BrandColour, GradientColours } from './core/colours'

export { generateMorphSteps, createMorphInterpolator, MIN_STEPS, MAX_STEPS } from './core/morph'
export type { MorphResult } from './core/morph'

export {
  lerpColour,
  generateStepFills,
  buildConicGradientConfig,
  buildLinearGradientStops,
  DEFAULT_NOISE_CONFIG,
  DEFAULT_BLUR_CONFIG,
} from './core/effects'
export type { ConicGradientConfig, GradientStop, NoiseConfig, BlurConfig } from './core/effects'

export { render, DEFAULT_CONFIG } from './renderer/canvas-renderer'
export type { RenderConfig, Variant, Alignment } from './renderer/canvas-renderer'

export { BrandShape } from './component/brand-shape'
```

- [ ] **Step 2: Verify full build**

Run: `cd F:\Documents\GitHub\brand-shapes && npx tsc --noEmit && npx vitest run`
Expected: Zero type errors, all tests pass.

- [ ] **Step 3: Commit**

```bash
cd F:\Documents\GitHub\brand-shapes
git add src/index.ts
git commit -m "chore: update library exports for new colour API"
```

---

### Task 7: Final verification

- [ ] **Step 1: Run full test suite**

Run: `cd F:\Documents\GitHub\brand-shapes && npx vitest run`
Expected: All tests pass.

- [ ] **Step 2: Run type check**

Run: `cd F:\Documents\GitHub\brand-shapes && npx tsc --noEmit`
Expected: Zero errors.

- [ ] **Step 3: Build library**

Run: `cd F:\Documents\GitHub\brand-shapes && npx vite build`
Expected: Clean build, outputs to `dist/`.

- [ ] **Step 4: Manual demo verification**

Run: `cd F:\Documents\GitHub\brand-shapes && npx vite --open`

Verify:
1. Preset dropdown loads and applies shape + colour combos
2. Three colour dropdowns show brand colour hex values, changing them updates the render
3. Background dropdown works (transparent, black, white, brand colours)
4. Randomize button randomizes shapes/colours/layout/variant but NOT noise/blur
5. Export PNG downloads a file, transparent BG toggle works
6. All three variants (wireframe, filled, gradient) render correctly with new colour system
7. Animation modes (trail, breathe) still work

- [ ] **Step 5: Commit any fixes, then final commit**

```bash
cd F:\Documents\GitHub\brand-shapes
git add -A
git commit -m "chore: final verification and cleanup"
```
