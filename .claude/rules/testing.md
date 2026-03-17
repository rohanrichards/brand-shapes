---
description: Testing conventions for brand-shapes
globs: ["**/*.test.ts", "**/*.ts"]
---

# Testing Rules

- Use Vitest (`import { describe, it, expect } from 'vitest'`)
- Tests live in `__tests__/` mirroring `src/core/` structure
- Write failing test FIRST, then implement (red/green TDD)
- Test file naming: `{module}.test.ts` (e.g., `shapes.test.ts`)
- Run tests: `npx vitest run` (all) or `npx vitest run __tests__/specific.test.ts`
- No mocking of Canvas APIs in core tests — core modules are pure functions with no DOM
- Renderer tests (if added) should use jsdom or happy-dom environment
