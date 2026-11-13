import Ajv2020Module from 'ajv/dist/2020.js';
import type { ErrorObject } from 'ajv';
import letterSchema from '../schema/letter.schema.json' with { type: 'json' };

// ajv ships CommonJS; normalise the default export across ESM/CJS interop.
const Ajv2020 =
  (Ajv2020Module as unknown as { default?: typeof Ajv2020Module }).default ?? Ajv2020Module;

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateLetter = ajv.compile(letterSchema);

function formatError(err: ErrorObject): string {
  const where = err.instancePath || '(root)';
  if (err.keyword === 'additionalProperties') {
    return `${where}: unknown property '${(err.params as { additionalProperty: string }).additionalProperty}'`;
  }
  if (err.keyword === 'enum') {
    return `${where}: ${err.message} (${(err.params as { allowedValues: unknown[] }).allowedValues.join(', ')})`;
  }
  return `${where}: ${err.message}`;
}

/**
 * Validates arbitrary JSON against `schema/letter.schema.json` (JSON Schema 2020-12).
 * Catches structural mistakes the topological validator does not: typos in
 * property names, wrong types, out-of-range tolerances, unknown enum values.
 *
 * Kept out of the main `@akshara/data` entry so browser bundles don't pull in Ajv.
 */
export function validateAgainstLetterSchema(data: unknown): { valid: boolean; errors: string[] } {
  const valid = validateLetter(data) as boolean;
  return { valid, errors: valid ? [] : (validateLetter.errors ?? []).map(formatError) };
}
