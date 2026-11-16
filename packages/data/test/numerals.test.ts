import { describe, expect, it } from 'vitest';
import {
  NUMBERS,
  NUMERAL_LIST,
  STROKE_DATASETS,
  digitsOf,
  toDevanagariNumerals,
  validateLetterDataset,
  validateNumbers,
  validateStrokeTopology,
  type LetterStrokeDataset,
} from '../src/index.js';
import { validateAgainstLetterSchema } from '../src/schema-validator.js';

describe('Nepali numbers 0 – 100 (numbers.json)', () => {
  it('passes structural validation', () => {
    expect(validateNumbers()).toEqual([]);
    expect(NUMBERS).toHaveLength(101);
  });

  it('writes numbers in Devanagari digits', () => {
    expect(toDevanagariNumerals(0)).toBe('०');
    expect(toDevanagariNumerals(42)).toBe('४२');
    expect(toDevanagariNumerals(100)).toBe('१००');
    expect(digitsOf(42)).toEqual([4, 2]);
    expect(digitsOf(100)).toEqual([1, 0, 0]);
    expect(() => toDevanagariNumerals(-1)).toThrow();
    expect(() => digitsOf(1.5)).toThrow();
  });

  it('spells landmark numbers', () => {
    const name = (n: number) => NUMBERS[n]!.nepaliName;
    expect([0, 1, 2, 5, 10, 20, 42, 50, 99, 100].map(name)).toEqual([
      'शून्य',
      'एक',
      'दुई',
      'पाँच',
      'दश',
      'बीस',
      'बयालीस',
      'पचास',
      'उनान्सय',
      'सय',
    ]);
    expect(NUMBERS[0]!.alsoCalled).toBe('सुन्ना');
  });

  it('reports malformed tables', () => {
    const broken = NUMBERS.map((n) => ({ ...n }));
    broken[7]!.devanagari = '8';
    broken[8]!.nepaliName = broken[9]!.nepaliName;
    expect(validateNumbers(broken)).toEqual([
      "7 is written '8', expected '७'",
      `name '${NUMBERS[9]!.nepaliName}' is used twice`,
    ]);
    expect(validateNumbers(NUMBERS.slice(0, 50))).toContain(
      'expected 101 entries (0 – 100), found 50'
    );
  });
});

describe('numeral stroke datasets (० – ९)', () => {
  it.each(NUMERAL_LIST.map((d) => [d.character, d] as const))(
    '%s passes the JSON schema and dataset validation without a Shirorekha',
    (_ch, numeral) => {
      expect(validateAgainstLetterSchema(numeral)).toEqual({ valid: true, errors: [] });
      expect(validateLetterDataset(numeral).errors).toEqual([]);
      expect(numeral.shirorekha).toBeUndefined();
      expect(numeral.strokes.every((s) => s.type !== 'shirorekha')).toBe(true);
    }
  );

  it('rejects a numeral that carries a Shirorekha, in both the schema and the validator', () => {
    const withHeadline = { ...NUMERAL_LIST[4]!, shirorekha: STROKE_DATASETS.ka!.shirorekha };
    expect(validateAgainstLetterSchema(withHeadline).valid).toBe(false);
    expect(validateLetterDataset(withHeadline as LetterStrokeDataset).errors).toContain(
      "Numeral 'num-4' must not define a shirorekha (numerals have no headline)."
    );
  });

  it('still requires letters to have a Shirorekha', () => {
    const { shirorekha: _drop, ...headless } = STROKE_DATASETS.ka!;
    expect(validateAgainstLetterSchema(headless).valid).toBe(false);
    expect(validateLetterDataset(headless as LetterStrokeDataset).errors).toContain(
      "Letter 'ka' must define a shirorekha."
    );
  });

  it('allows a single headline-free stroke only when the Shirorekha is not required', () => {
    const zero = NUMERAL_LIST[0]!.strokes;
    expect(zero).toHaveLength(1);
    expect(validateStrokeTopology(zero, undefined, { requireShirorekha: false }).valid).toBe(true);
    expect(validateStrokeTopology(zero).valid).toBe(false);
    const headlineStroke = STROKE_DATASETS.ka!.strokes.at(-1)!;
    expect(
      validateStrokeTopology([...zero, headlineStroke], undefined, { requireShirorekha: false })
        .violations[0]
    ).toMatch(/numerals are written without one/);
  });
});
