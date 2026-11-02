---
name: "✏️ [Good First Issue] Author 4-Step Vector Stroke Definitions for Chavarga (च, छ, ज, झ, ञ)"
about: "Add canonical 300x300 SVG stroke paths and ordered waypoints for the Palatal (तालव्य) consonant row"
title: "feat(data): add canonical vector stroke definitions for Chavarga (च, छ, ज, झ, ञ)"
labels: ["good first issue", "education"]
assignees: ""
---

## Context

`packages/data/strokes/` currently includes verified vector stroke definitions for the Kanthya (Velar) stops (`ka.json`, `kha.json`, `ga.json`, `gha.json`) and initial vowels (`a.json`, `aa.json`). We need community contributors to author the next row of Vyanjan Varna: **Chavarga (`च, छ, ज, झ, ञ`)**.

## Acceptance Criteria

1. Create `cha.json`, `chha.json`, `ja.json`, `jha.json`, and `nya.json` inside `packages/data/strokes/` conforming to [`packages/data/schema/letter.schema.json`](../../packages/data/schema/letter.schema.json).
2. Enforce the **Devanagari Topological Invariant**:
   - Loop / curve body components (`type: "loop" | "curve"`) must come **first**.
   - Right vertical stems (`type: "stem"`) must come **second**.
   - The horizontal headline bar (`type: "shirorekha"`) must be **strictly last**.
3. Define at least 3 ordered waypoints `(x, y)` per stroke within the `300x300` coordinate space (`shirorekhaY: 75`, `baselineY: 240`).
4. Run `npm run validate:data && npm test` to verify schema compliance and topological order.
