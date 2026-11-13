import { describe, expect, it } from 'vitest';
import {
  STROKE_LIST,
  getShirorekhaSegments,
  hasSplitShirorekha,
  validateLetterDataset,
  validateShirorekhaGeometry,
  type LetterStrokeDataset,
} from '../src/index.js';

/** Minimal 2-stroke letter with a configurable headline. */
function letter(
  shirorekha: LetterStrokeDataset['shirorekha'],
  svgPath: string,
  xs: number[]
): LetterStrokeDataset {
  return {
    id: 'test',
    character: 'ध',
    unicode: 'U+0927',
    category: 'vyanjan',
    phonetics: { romanized: 'dha', ipa: '', nepaliName: '', audioPrompt: '', articulationTip: '' },
    viewBox: { width: 300, height: 300, shirorekhaY: 75, baselineY: 240 },
    shirorekha,
    strokes: [
      {
        id: 'test-stroke-1',
        order: 1,
        type: 'stem',
        label: '',
        nepaliInstruction: '',
        englishInstruction: '',
        svgPath: 'M 200 75 L 200 240',
        directionHint: 'top-to-bottom',
        toleranceRadius: 26,
        waypoints: [
          { index: 0, x: 200, y: 75 },
          { index: 1, x: 200, y: 150 },
          { index: 2, x: 200, y: 240 },
        ],
      },
      {
        id: 'test-stroke-2',
        order: 2,
        type: 'shirorekha',
        label: '',
        nepaliInstruction: '',
        englishInstruction: '',
        svgPath,
        directionHint: 'left-to-right',
        toleranceRadius: 26,
        waypoints: xs.map((x, index) => ({ index, x, y: 75 })),
      },
    ],
    vocabulary: [{ word: 'धन', romanized: 'dhan', meaning: 'Wealth', emoji: '💰' }],
  };
}

const split = {
  enforcedLast: true,
  startX: 60,
  endX: 240,
  y: 75,
  segments: [
    { startX: 60, endX: 110 },
    { startX: 140, endX: 240 },
  ],
};
const splitPath = 'M 60 75 L 110 75 M 140 75 L 240 75';

describe('getShirorekhaSegments', () => {
  it('falls back to a single continuous span', () => {
    const l = letter(
      { enforcedLast: true, startX: 55, endX: 245, y: 75 },
      'M 55 75 L 245 75',
      [55, 150, 245]
    );
    expect(getShirorekhaSegments(l)).toEqual([{ startX: 55, endX: 245 }]);
    expect(hasSplitShirorekha(l)).toBe(false);
  });

  it('returns explicit split spans', () => {
    const l = letter(split, splitPath, [60, 110, 140, 190, 240]);
    expect(getShirorekhaSegments(l)).toHaveLength(2);
    expect(hasSplitShirorekha(l)).toBe(true);
  });
});

describe('validateShirorekhaGeometry', () => {
  it('accepts a well-formed split headline', () => {
    expect(
      validateLetterDataset(letter(split, splitPath, [60, 110, 140, 190, 240])).errors
    ).toEqual([]);
  });

  it('rejects overlapping or too-close segments', () => {
    const bad = {
      ...split,
      segments: [
        { startX: 60, endX: 136 },
        { startX: 140, endX: 240 },
      ],
    };
    expect(validateShirorekhaGeometry(letter(bad, splitPath, [60, 136, 140, 240])).join()).toMatch(
      /gap of at least/
    );
  });

  it('rejects segments that do not match the declared extent', () => {
    const bad = { ...split, startX: 50 };
    expect(validateShirorekhaGeometry(letter(bad, splitPath, [60, 110, 140, 240])).join()).toMatch(
      /must start at/
    );
  });

  it('rejects a single-entry segments array', () => {
    const bad = { ...split, segments: [{ startX: 60, endX: 240 }] };
    expect(
      validateShirorekhaGeometry(letter(bad, 'M 60 75 L 240 75', [60, 150, 240])).join()
    ).toMatch(/at least 2 spans/);
  });

  it('requires one svg subpath per segment', () => {
    const errs = validateShirorekhaGeometry(letter(split, 'M 60 75 L 240 75', [60, 110, 140, 240]));
    expect(errs.join()).toMatch(/1 subpath\(s\) but the headline defines 2/);
  });

  it('rejects waypoints that fall inside the gap', () => {
    const errs = validateShirorekhaGeometry(letter(split, splitPath, [60, 110, 125, 140, 240]));
    expect(errs.join()).toMatch(/x=125\) falls outside/);
  });

  it('requires waypoints at both ends of every segment', () => {
    const errs = validateShirorekhaGeometry(letter(split, splitPath, [60, 100, 140, 240]));
    expect(errs.join()).toMatch(/both ends of segment 0/);
  });
});

describe('bundled stroke datasets', () => {
  it.each(STROKE_LIST.map((d) => [d.id, d] as const))(
    '%s passes full validation',
    (_id, dataset) => {
      expect(validateLetterDataset(dataset).errors).toEqual([]);
    }
  );
});
