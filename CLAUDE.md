# Brand Shapes

Interactive brand component tool — morphing shapes with Canvas 2D rendering, distributed as a Web Component.

## Project Overview

- **Design doc:** `docs/DESIGN.md` — architecture, tech stack, decisions, phase plan
- **Phase 1 plan:** `docs/PHASE1-PLAN.md` — core engine + Canvas renderer implementation
- **Research:** `~/.claude/MEMORY/WORK/20260318-000000_brand-component-architecture-exploration/PRD.md`

## Tech Stack

- **Language:** TypeScript (strict)
- **Build:** Vite (dev server + library build)
- **Test:** Vitest (unit tests, TDD red/green)
- **Rendering:** Canvas 2D API (Path2D, createConicGradient, ctx.filter)
- **Morphing:** GSAP + MorphSVGPlugin (free, No Charge license)
- **Distribution:** Lit Web Components (`<brand-shape>` custom element)
- **Demo controls:** lil-gui (~4KB debug overlay)

## Architecture

```
src/core/       → Pure functions, no DOM (shapes, colours, morph, effects)
src/renderer/   → Canvas 2D render pipeline
src/component/  → Lit Web Component wrapper
src/demo/       → Demo page + lil-gui config (not in library build)
__tests__/      → Vitest unit tests (mirror src/core/)
```

## Development Rules

- **TDD:** Write failing test first, then implement, then verify. Red → green → commit.
- **Atomic commits:** Each commit is one logical unit. Don't batch.
- **Never work on main.** Always branch first (`git checkout -b <branch>`).
- **No AI attribution.** Never add Co-Authored-By or "Generated with Claude" to commits/PRs.
- **TypeScript strict.** No `any`, no `@ts-ignore` unless genuinely necessary with a comment explaining why.
- **Pure core.** `src/core/` modules must have zero DOM dependencies — pure functions only.
- **Canvas renderer owns all DOM.** Only `canvas-renderer.ts` and the Lit component touch the DOM.

## Key Decisions (locked in)

These were decided through rigorous analysis (FirstPrinciples + Research + Council + RedTeam). Don't revisit unless fundamentally blocked:

- **Canvas 2D over SVG DOM** — no foreignObject, no SVG filters, immediate-mode rendering
- **GSAP MorphSVGPlugin over flubber** — flubber is dead (2018), GSAP is free and superior
- **Lit over React/Vue** — framework-agnostic Web Components
- **lil-gui over custom panel** — 4KB, auto-generated from config object
- **SVG export** — vector clip paths with rasterized gradient fills for cross-platform compatibility
- **No WebGL/PixiJS** — premature at this scale (1-15 shapes)

## Porting From

Source code being ported from `F:\Documents\GitHub\slidev-theme-portable\components\`:
- `shapes.ts` → direct port (12 shapes, same types)
- `colours.ts` → direct port (5 families, same functions)
- `morph.ts` → rewrite (flubber → GSAP MorphSVGPlugin)
- `effects.ts` → adapt (SVG filters → Canvas-native configs)
