---
name: "✏️ [Good First Issue] Author Vector Stroke Definitions for Antastha (य, र, ल, व)"
about: "Add canonical 300x300 SVG stroke paths and ordered waypoints for the semivowel (अन्तस्थ) consonant row"
title: "feat(data): add canonical vector stroke definitions for Antastha (य, र, ल, व)"
labels: ["good first issue", "education"]
assignees: ""
---

## Context

`packages/data/strokes/` currently includes vector stroke definitions for all 13 Swor Varna (`अ` to `अः`) and the five Vyanjan vargas from `क` to `म`. We need community contributors to author the semivowels: **Antastha (`य, र, ल, व`)**. Note that `र` has no vertical stem and `व` must not include the inner diagonal of `ब`.

## Acceptance Criteria

1. Create `ya.json`, `ra.json`, `la.json`, and `wa.json` inside `packages/data/strokes/` conforming to [`packages/data/schema/letter.schema.json`](../../packages/data/schema/letter.schema.json).
2. Enforce the **Devanagari Topological Invariant**:
   - Loop / curve body components (`type: "loop" | "curve"`) must come **first**.
   - Right vertical stems (`type: "stem"`) must come **second**.
   - The horizontal headline bar (`type: "shirorekha"`) must be **strictly last**.
3. Define at least 3 ordered waypoints `(x, y)` per stroke within the `300x300` coordinate space (`shirorekhaY: 75`, `baselineY: 240`).
4. Run `npm run validate:data && npm test` to verify schema compliance, topological order, and end-to-end traceability.
5. Tip: sketch only `type` + `svgPath` per stroke and generate waypoints with `npm run akshara -- compile` (see `packages/cli/README.md`).

