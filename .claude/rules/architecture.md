---
description: Architecture boundaries for brand-shapes
globs: ["src/**/*.ts"]
---

# Architecture Rules

## Module Boundaries

- `src/core/` — ZERO DOM imports. Pure functions only. Must work in Node.
- `src/renderer/` — Canvas 2D API only. No SVG DOM, no foreignObject.
- `src/component/` — Lit Web Component. Thin shell delegating to renderer.
- `src/demo/` — Demo page code. NOT included in library build.

## Import Direction

```
demo/ → component/ → renderer/ → core/
```

Never import upward. Core must not import from renderer, renderer must not import from component.

## Canvas Rendering

- Use `Path2D` constructor with SVG path strings — no manual path parsing
- Use `createConicGradient()` — no foreignObject, no CSS background hacks
- Use `ctx.filter = 'blur(Npx)'` — no SVG feGaussianBlur
- Always handle `devicePixelRatio` for crisp rendering
- Pre-bake noise textures at init, not per-frame
