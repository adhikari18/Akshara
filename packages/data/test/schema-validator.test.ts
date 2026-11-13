import { describe, expect, it } from 'vitest';
import { STROKE_LIST } from '../src/index.js';
import { validateAgainstLetterSchema } from '../src/schema-validator.js';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

describe('validateAgainstLetterSchema', () => {
  it.each(STROKE_LIST.map((d) => [d.id, d] as const))(
    '%s conforms to letter.schema.json',
    (_id, dataset) => {
      expect(validateAgainstLetterSchema(dataset).errors).toEqual([]);
    }
  );

  it('reports misspelled properties', () => {
    const bad: any = clone(STROKE_LIST[0]);
    bad.strokes[0].toleranceRadious = 20;
    expect(validateAgainstLetterSchema(bad).errors.join()).toMatch(
      /unknown property 'toleranceRadious'/
    );
  });

  it('reports invalid enum values and out-of-range numbers', () => {
    const bad: any = clone(STROKE_LIST[0]);
    bad.strokes[0].directionHint = 'sideways';
    bad.strokes[0].toleranceRadius = 5;
    const errors = validateAgainstLetterSchema(bad).errors.join('\n');
    expect(errors).toMatch(/directionHint: must be equal to one of the allowed values/);
    expect(errors).toMatch(/toleranceRadius: must be >= 12/);
  });

  it('reports missing required fields', () => {
    const bad: any = clone(STROKE_LIST[0]);
    delete bad.phonetics.ipa;
    expect(validateAgainstLetterSchema(bad).errors.join()).toMatch(
      /must have required property 'ipa'/
    );
  });
});
