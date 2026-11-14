import { describe, expect, it } from 'vitest';
import {
  SENTENCES,
  getAcceptableOrders,
  validateSentenceEntry,
  type SentenceEntry,
} from '@akshara/data';
import { evaluateSOVSentence, scrambleSentenceTokens } from '../src/index.js';

const byId = (id: string) => SENTENCES.find((s) => s.id === id)!;
/** Token ids for a sentence, picked by their text. */
const pick = (sentence: SentenceEntry, words: string) =>
  words.split(' ').map((w) => sentence.tokens.find((t) => t.text === w)!.id);

describe('sentence dataset (M9)', () => {
  it.each(SENTENCES.map((s) => [s.id, s] as const))('%s is structurally valid', (_id, s) => {
    expect(validateSentenceEntry(s)).toEqual([]);
  });

  it('includes at least one sentence with an alternative (adverbial) order', () => {
    expect(SENTENCES.some((s) => (s.acceptableOrders?.length ?? 0) > 0)).toBe(true);
    expect(SENTENCES.some((s) => s.tokens.length > 3)).toBe(true);
  });
});

describe('evaluateSOVSentence with any token count and acceptableOrders', () => {
  it.each(SENTENCES.map((s) => [s.id, s] as const))('%s accepts every listed order', (_id, s) => {
    getAcceptableOrders(s).forEach((order, idx) => {
      const result = evaluateSOVSentence(s, order);
      expect(result.correct).toBe(true);
      expect(result.matchedOrderIndex).toBe(idx);
      expect(result.feedback.code).toBe('sentence-correct');
      expect(result.feedback.alternativeOrder).toBe(idx > 0);
    });
  });

  const school = byId('sov-6');

  it('accepts a fronted time adverbial (आज म स्कुल जान्छु)', () => {
    const result = evaluateSOVSentence(school, pick(school, 'आज म स्कुल जान्छु'));
    expect(result.correct).toBe(true);
    expect(result.feedback.alternativeOrder).toBe(true);
    expect(result.feedback.assembledSentence).toBe('आज म स्कुल जान्छु');
  });

  it('detects English SVO transfer in a 4-token sentence', () => {
    for (const attempt of ['म जान्छु आज स्कुल', 'आज म जान्छु स्कुल', 'जान्छु म आज स्कुल']) {
      const result = evaluateSOVSentence(school, pick(school, attempt));
      expect(result.correct, attempt).toBe(false);
      expect(result.isSVOConfusion, attempt).toBe(true);
      expect(result.feedback.code).toBe('sentence-svo-confusion');
    }
  });

  it('calls other mistakes plain wrong order (verb-final but not an accepted order)', () => {
    for (const attempt of ['म स्कुल आज जान्छु', 'स्कुल म आज जान्छु']) {
      const result = evaluateSOVSentence(school, pick(school, attempt));
      expect(result.correct, attempt).toBe(false);
      expect(result.isSVOConfusion, attempt).toBe(false);
      expect(result.feedback.code).toBe('sentence-wrong-order');
    }
  });

  it('keeps the classic 3-token behaviour (S-V-O is SVO confusion, O-S-V is wrong order)', () => {
    const ram = byId('sov-1');
    expect(evaluateSOVSentence(ram, pick(ram, 'राम जान्छ घर')).isSVOConfusion).toBe(true);
    const osv = evaluateSOVSentence(ram, pick(ram, 'घर राम जान्छ'));
    expect(osv.isSVOConfusion).toBe(false);
    expect(osv.feedback.code).toBe('sentence-wrong-order');
    expect(evaluateSOVSentence(ram, pick(ram, 'राम')).feedback.code).toBe('sentence-instructions');
  });
});

describe('scrambleSentenceTokens', () => {
  it.each(SENTENCES.map((s) => [s.id, s] as const))(
    '%s scrambles to a permutation that is not an acceptable order',
    (_id, s) => {
      const scrambled = scrambleSentenceTokens(s).map((t) => t.id);
      expect([...scrambled].sort()).toEqual(s.tokens.map((t) => t.id).sort());
      expect(evaluateSOVSentence(s, scrambled).correct).toBe(false);
    }
  );

  it('presents 3-token sentences in English S-V-O order, as before', () => {
    for (const s of SENTENCES.filter((x) => x.tokens.length === 3)) {
      expect(scrambleSentenceTokens(s)).toEqual([s.tokens[0], s.tokens[2], s.tokens[1]]);
    }
  });

  it('moves the verb next to the subject for longer sentences', () => {
    const school = byId('sov-6');
    expect(scrambleSentenceTokens(school).map((t) => t.text)).toEqual(['म', 'जान्छु', 'आज', 'स्कुल']);
  });

  it('falls back when the English-like order is itself acceptable', () => {
    const s: SentenceEntry = {
      ...byId('sov-1'),
      // Pretend S-V-O were acceptable: the scrambler must pick something else
      acceptableOrders: [['sov-1-s', 'sov-1-v', 'sov-1-o']],
    };
    const scrambled = scrambleSentenceTokens(s).map((t) => t.id);
    expect(getAcceptableOrders(s).some((o) => o.join() === scrambled.join())).toBe(false);
  });
});

describe('validateSentenceEntry', () => {
  const base = byId('sov-6');
  const ids = base.tokens.map((t) => t.id);

  it('rejects orders that are not permutations, not verb-final, or duplicated', () => {
    expect(validateSentenceEntry({ ...base, acceptableOrders: [ids.slice(0, 3)] })).toEqual([
      'acceptableOrders[0] must use every token id exactly once',
    ]);
    expect(
      validateSentenceEntry({
        ...base,
        acceptableOrders: [['sov-6-v', 'sov-6-s', 'sov-6-t', 'sov-6-p']],
      })
    ).toEqual(['acceptableOrders[0] must end with the verb (Nepali is verb-final)']);
    expect(validateSentenceEntry({ ...base, acceptableOrders: [ids] })).toEqual([
      'acceptableOrders[0] duplicates an earlier order',
    ]);
  });

  it('requires exactly one verb and unique token ids', () => {
    const twoVerbs = { ...base, tokens: base.tokens.map((t) => ({ ...t, role: 'verb' as const })) };
    expect(validateSentenceEntry(twoVerbs)).toContain('needs exactly one verb token (found 4)');
    const dupIds = {
      ...base,
      tokens: base.tokens.map((t) => ({ ...t, id: 'x' })),
      acceptableOrders: [],
    };
    expect(validateSentenceEntry(dupIds)).toContain('token ids must be unique');
  });
});
