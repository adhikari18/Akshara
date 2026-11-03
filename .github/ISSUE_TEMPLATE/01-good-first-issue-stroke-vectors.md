---
name: "✏️ [Good First Issue] Author Vector Stroke Definitions for Pavarga (प, फ, ब, भ, म)"
about: "Add canonical 300x300 SVG stroke paths and ordered waypoints for the Labial (ओष्ठ्य) consonant row"
title: "feat(data): add canonical vector stroke definitions for Pavarga (प, फ, ब, भ, म)"
labels: ["good first issue", "education"]
assignees: ""
---

## Context

`packages/data/strokes/` currently includes vector stroke definitions for all 13 Swor Varna (`अ` to `अः`) and the Vyanjan rows from `क` to `ण` (Kanthya, Talavya, Murdhanya). We need community contributors to author the Labial row of Vyanjan Varna: **Pavarga (`प, फ, ब, भ, म`)**. Note that `भ` has a split *Shirorekha* (see `kha.json` and the `segments` field).

## Acceptance Criteria

1. Create `pa.json`, `pha.json`, `ba.json`, `bha.json`, and `ma.json` inside `packages/data/strokes/` conforming to [`packages/data/schema/letter.schema.json`](../../packages/data/schema/letter.schema.json).
2. Enforce the **Devanagari Topological Invariant**:
   - Loop / curve body components (`type: "loop" | "curve"`) must come **first**.
   - Right vertical stems (`type: "stem"`) must come **second**.
   - The horizontal headline bar (`type: "shirorekha"`) must be **strictly last**.
3. Define at least 3 ordered waypoints `(x, y)` per stroke within the `300x300` coordinate space (`shirorekhaY: 75`, `baselineY: 240`).
4. Run `npm run validate:data && npm test` to verify schema compliance, topological order, and end-to-end traceability.
5. Tip: sketch only `type` + `svgPath` per stroke and generate waypoints with `npm run akshara -- compile` (see `packages/cli/README.md`).

