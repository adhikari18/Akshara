import { describe, expect, it } from 'vitest';
import {
  STROKE_DATASETS,
  validateLetterDataset,
  validateStrokeTopology,
  type StrokeDefinition,
} from '../src/index.js';

const ka = STROKE_DATASETS.ka!;
const withType = (s: StrokeDefinition, patch: Partial<StrokeDefinition>): StrokeDefinition => ({
  ...s,
  ...patch,
});

describe('validateStrokeTopology', () => {
  it('accepts body -> stem -> right-hook -> shirorekha order', () => {
    expect(validateStrokeTopology(ka.strokes).valid).toBe(true);
  });

  it('rejects a left-side body stroke drawn after the stem', () => {
    const [loop, stem, hook, bar] = ka.strokes;
    const result = validateStrokeTopology([stem!, loop!, hook!, bar!]);
    expect(result.valid).toBe(false);
    expect(result.violations.join()).toMatch(/violates Devanagari topological order/);
  });

  it('allows upper-crown marks after the stem', () => {
    const [loop, stem, , bar] = ka.strokes;
    const crown = withType(loop!, {
      id: 'crown',
      type: 'curve',
      waypoints: [
        { index: 0, x: 150, y: 40 },
        { index: 1, x: 170, y: 30 },
        { index: 2, x: 190, y: 60 },
      ],
    });
    const strokes = [loop!, stem!, crown, bar!].map((s, i) => ({ ...s, order: i + 1 }));
    expect(validateStrokeTopology(strokes, 75).valid).toBe(true);
  });

  it('rejects a non-final shirorekha and a single-stroke letter', () => {
    expect(validateStrokeTopology([...ka.strokes].reverse()).violations.join()).toMatch(
      /not the final stroke/
    );
    expect(validateStrokeTopology([ka.strokes[3]!]).valid).toBe(false);
  });

  it('is applied by validateLetterDataset', () => {
    const [loop, stem, hook, bar] = ka.strokes;
    const bad = {
      ...ka,
      strokes: [stem!, loop!, hook!, bar!].map((s, i) => ({ ...s, order: i + 1 })),
    };
    expect(validateLetterDataset(bad).errors.join()).toMatch(/Topological violation in 'ka'/);
  });
});
