#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { validateLetterDataset, type LetterStrokeDataset } from '@akshara/data';
import { validateAgainstLetterSchema } from '@akshara/data/schema-validator';
import { compileGlyph, type GlyphSpec } from './compiler.js';
import { pathBoundingBox, pathLength, sampleEquidistant } from './geometry.js';
import { parseSvgPath } from './svg-path.js';

const USAGE = `akshara — Akshara dataset authoring tools

Usage:
  akshara compile <spec.json> [-o <out.json>] [--spacing <units>]
      Compile a glyph spec (strokes with only "type" + "svgPath") into a full
      letter.schema.json-shaped file with equidistant waypoints, inferred
      direction hints, viewBox and shirorekha metadata.

  akshara sample "<svg path d>" [-n <count>]
      Print bounding box, arc length and <count> equidistant waypoints
      (default 5) for a single SVG path.
`;

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  const v = args[i + 1];
  if (v === undefined) throw new Error(`Missing value for ${name}`);
  return v;
}

export function run(argv: string[]): number {
  const [command, ...rest] = argv;
  try {
    if (command === 'compile') {
      const input = rest.find(
        (a, i) => !a.startsWith('-') && rest[i - 1] !== '-o' && rest[i - 1] !== '--spacing'
      );
      if (!input) throw new Error('compile requires an input spec file.');
      const spacingRaw = flag(rest, '--spacing');
      const spacing = spacingRaw === undefined ? undefined : Number(spacingRaw);
      if (spacing !== undefined && !(spacing > 0))
        throw new Error('--spacing must be a positive number.');
      const spec = JSON.parse(readFileSync(input, 'utf8')) as GlyphSpec;
      const compiled = compileGlyph(spec, { spacing });
      const schema = validateAgainstLetterSchema(compiled);
      const topology = schema.valid
        ? validateLetterDataset(compiled as unknown as LetterStrokeDataset)
        : { valid: false, errors: [] };
      const errors = [...schema.errors.map((e) => `[schema] ${e}`), ...topology.errors];
      if (errors.length > 0) {
        throw new Error(
          `Compiled '${spec.id}' failed dataset validation:\n   - ${errors.join('\n   - ')}`
        );
      }
      const json = JSON.stringify(compiled, null, 2) + '\n';
      const out = flag(rest, '-o');
      if (out) {
        writeFileSync(out, json);
        console.error(`✅ Compiled '${spec.id}' (${spec.strokes.length} strokes) -> ${out}`);
      } else {
        process.stdout.write(json);
      }
      return 0;
    }
    if (command === 'sample') {
      const d = rest.find((a, i) => !a.startsWith('-') && rest[i - 1] !== '-n');
      if (!d) throw new Error('sample requires an SVG path string.');
      const n = Number(flag(rest, '-n') ?? 5);
      const segs = parseSvgPath(d);
      const pts = sampleEquidistant(segs, n).map((p) => ({
        x: Math.round(p.x * 10) / 10,
        y: Math.round(p.y * 10) / 10,
      }));
      console.log(
        JSON.stringify(
          {
            length: Math.round(pathLength(segs) * 10) / 10,
            bbox: pathBoundingBox(segs),
            waypoints: pts,
          },
          null,
          2
        )
      );
      return 0;
    }
    console.log(USAGE);
    return command === undefined || command === '--help' || command === '-h' ? 0 : 1;
  } catch (err) {
    console.error(`❌ ${(err as Error).message}`);
    return 1;
  }
}

process.exitCode = run(process.argv.slice(2));
