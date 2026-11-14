import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { STROKE_DATASETS, STROKE_LIST, STROKE_ORDER } from '../src/index.js';
// @ts-expect-error — plain .mjs build script without type declarations
import { renderStrokeIndex, resolveStrokeOrder } from '../scripts/generate-stroke-index.mjs';

const dataRoot = fileURLToPath(new URL('..', import.meta.url));
const manifest = JSON.parse(readFileSync(join(dataRoot, 'stroke-manifest.json'), 'utf8')) as {
  order: string[];
};

describe('stroke registry (generated from stroke-manifest.json)', () => {
  it('exposes every manifest letter, in manifest order', () => {
    expect(STROKE_ORDER).toEqual(manifest.order);
    expect(STROKE_LIST.map((d) => d.id)).toEqual(manifest.order);
    expect(Object.keys(STROKE_DATASETS).sort()).toEqual([...manifest.order].sort());
    expect(STROKE_LIST).toHaveLength(49);
  });

  it('has a committed strokes.generated.ts that matches the manifest byte-for-byte', () => {
    const script = join(dataRoot, 'scripts', 'generate-stroke-index.mjs');
    expect(() =>
      execFileSync(process.execPath, [script, '--check'], { stdio: 'pipe' })
    ).not.toThrow();
    const committed = readFileSync(join(dataRoot, 'src', 'strokes.generated.ts'), 'utf8');
    expect(committed).toBe(renderStrokeIndex(resolveStrokeOrder()));
  });

  describe('rejects a manifest out of sync with strokes/', () => {
    function fixture(order: unknown[], files: Record<string, string>) {
      const dir = mkdtempSync(join(tmpdir(), 'akshara-manifest-'));
      const strokesDir = join(dir, 'strokes');
      mkdirSync(strokesDir);
      for (const [name, id] of Object.entries(files)) {
        writeFileSync(join(strokesDir, `${name}.json`), JSON.stringify({ id }));
      }
      const manifestPath = join(dir, 'stroke-manifest.json');
      writeFileSync(manifestPath, JSON.stringify({ order }));
      return () => resolveStrokeOrder({ manifestPath, strokesDir });
    }

    it('accepts a consistent manifest', () => {
      expect(fixture(['ka', 'one'], { ka: 'ka', one: 'one' })()).toEqual(['ka', 'one']);
    });
    it('flags a stroke file missing from the manifest', () => {
      expect(fixture(['ka'], { ka: 'ka', one: 'one' })).toThrow(
        /one\.json exists but is not listed/
      );
    });
    it('flags a manifest entry without a stroke file', () => {
      expect(fixture(['ka', 'two'], { ka: 'ka' })).toThrow(
        /"two" is listed but strokes\/two\.json/
      );
    });
    it('flags duplicates and filename/id mismatches', () => {
      expect(fixture(['ka', 'ka'], { ka: 'ka' })).toThrow(/listed twice/);
      expect(fixture(['ka'], { ka: 'kha' })).toThrow(/declares id "kha"/);
    });
  });
});
