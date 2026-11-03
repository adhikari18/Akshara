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
(plus optional `label`, instructions, `directionHint`, `toleranceRadius`, `waypointCount`).
The compiler fills in:

- `waypoints` sampled at equal arc-length spacing (default 45 units, min 3, exact endpoints)
- `directionHint` inferred from stroke type and loop winding
- `viewBox` and `shirorekha` derived from the final *Shirorekha* stroke (if omitted)

It rejects glyphs whose *Shirorekha* stroke is not last. Supported path commands:
`M L H V C S Q T Z` (absolute and relative); arcs are not supported.

Always run `npm run validate:data` and review the output visually in the Pati studio before committing.
