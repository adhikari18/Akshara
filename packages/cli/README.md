# @akshara/cli

Authoring tools that turn raw SVG glyph paths into Akshara stroke datasets.

```bash
npm run build --workspace=@akshara/cli

# Inspect one path: arc length, bounding box, equidistant waypoints
npm run akshara -- sample "M 150 75 L 150 240" -n 4

# Compile a spec into a letter.schema.json-shaped file
npm run akshara -- compile spec.json -o packages/data/strokes/cha.json
```

## Spec format

A spec is a normal letter file where each stroke only needs `type` and `svgPath`
(plus optional `label`, instructions, `directionHint`, `toleranceRadius`, `waypointCount`, `waypointLabels`).
The compiler fills in:

- `waypoints` sampled at equal arc-length spacing (default 45 units, min 3, exact endpoints)
- `directionHint` inferred from stroke type and loop winding
- descriptive waypoint labels from stroke type and position (`Stem Top`, `Upper Left Arc`,
  `Segment 1 End (Gap)`, …) — override per stroke with `waypointLabels`
- `viewBox` and `shirorekha` derived from the final *Shirorekha* stroke (if omitted)
- split headline `shirorekha.segments` when the *Shirorekha* `svgPath` has several subpaths
  (e.g. `"M 60 75 L 140 75 M 170 75 L 240 75"` for `ग`); each segment is sampled separately
  so its ends are waypoints and no waypoint falls in the gap

The compiled result is checked against `letter.schema.json` (Ajv) and `validateLetterDataset`
from `@akshara/data`, and is not written if either fails. It rejects glyphs whose *Shirorekha* stroke is not last, and multiple
subpaths in any stroke other than the *Shirorekha*. Supported path commands:
`M L H V C S Q T Z` (absolute and relative); arcs are not supported.

Always run `npm run validate:data` and review the output visually in the Pati studio before committing.
