---
name: "✏️ [Good First Issue] Review & Refine Stroke Vectors for One Varga"
about: "Check a row of letters against how Nepali teachers actually write them, and fix stroke order, direction, or shape"
title: "fix(data): review stroke vectors for <varga> (<letters>)"
labels: ["good first issue", "education"]
assignees: ""
---

## Context

`packages/data/strokes/` now contains vector stroke definitions for all 49 letters: the 13 Swor Varna (`अ` to `अः`) and the 36 Vyanjan Varna (`क` to `ज्ञ`). Most shapes were traced from standard Devanagari fonts (Kohinoor Devanagari, ITF Devanagari), so they still need review by people who teach or write Nepali by hand:

- Is the **stroke order** the one children are taught in Nepali schools?
- Does each stroke **start and travel in the right direction**?
- Are partial or split *Shirorekha* headlines (`थ`, `भ`, `श`, `क्ष`, split `ध`) shown the way teachers write them?

Pick one row (e.g. Kanthya `क ख ग घ ङ`, Talavya `च छ ज झ ञ`, … Samyukta `क्ष त्र ज्ञ`) and review it.

## Acceptance Criteria

1. Open the Pati studio (`npm run dev`) and trace every letter in your chosen row.
2. For each letter, either confirm it is correct in the issue, or fix the JSON in `packages/data/strokes/` conforming to [`packages/data/schema/letter.schema.json`](../../packages/data/schema/letter.schema.json):
   - Body strokes (`loop`, `curve`, `diagonal`) **first**, vertical stems (`stem`) **second**, the *Shirorekha* (`shirorekha`) **strictly last**.
   - At least 3 ordered waypoints per stroke in the `300x300` space (`shirorekhaY: 75`, `baselineY: 240`).
3. Tip: edit only `type` + `svgPath` per stroke and regenerate waypoints with `npm run akshara -- compile` (see `packages/cli/README.md`).
4. Run `npm run validate:data && npm test` to verify schema compliance, topological order, and end-to-end traceability.
