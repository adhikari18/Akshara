import { describe, expect, it } from 'vitest';
import { SENTENCES, WORDS } from '@akshara/data';
import {
  evaluateSOVSentence,
  evaluateWordTiles,
  fuseConsonantWithMatra,
  generateBarakhari,
  segmentDevanagariAksharas,
} from '../src/index.js';

describe('Matra Engine, Barakhari Fusion & SOV Sentence Builder', () => {
  it('fuses base consonants with vowel matras accurately (क + ि -> कि)', () => {
    const ki = fuseConsonantWithMatra('ka', 'i');
    expect(ki.compositeAkshara).toBe('कि');
    expect(ki.romanized).toBe('ki');
    expect(ki.ipa).toBe('/ki/');
    expect(ki.position).toBe('left');
    expect(ki.unicodeSequence).toBe('U+0915 + U+093F');

    const kuu = fuseConsonantWithMatra('ka', 'uu');
    expect(kuu.compositeAkshara).toBe('कू');
    expect(kuu.romanized).toBe('kuu');
    expect(kuu.position).toBe('bottom');
  });

  it('generates the full 13-step Nepali Barakhari table for any consonant', () => {
    const kaBarakhari = generateBarakhari('ka');
    expect(kaBarakhari).toHaveLength(13);
    expect(kaBarakhari.map((b) => b.compositeAkshara)).toEqual([
      'क',
      'का',
      'कि',
      'की',
      'कु',
      'कू',
      'कृ',
      'के',
      'कै',
      'को',
      'कौ',
      'कं',
      'कः',
    ]);
  });

  it('segments Devanagari words into orthographic akshara clusters including matras and conjuncts', () => {
    expect(segmentDevanagariAksharas('कलम')).toEqual(['क', 'ल', 'म']);
    expect(segmentDevanagariAksharas('किताब')).toEqual(['कि', 'ता', 'ब']);
    expect(segmentDevanagariAksharas('पढ्छिन्')).toEqual(['प', 'ढ्छि', 'न्']);
  });

  it('evaluates 2- and 3-letter noun building blocks accurately', () => {
    const kalam = WORDS.find((w) => w.id === 'kalam')!;
    const partial = evaluateWordTiles(kalam, ['क', 'ल']);
    expect(partial.complete).toBe(false);
    expect(partial.correct).toBe(false);

    const complete = evaluateWordTiles(kalam, ['क', 'ल', 'म']);
    expect(complete.complete).toBe(true);
    expect(complete.correct).toBe(true);
    expect(complete.assembledWord).toBe('कलम');
  });

  it('validates Nepali SOV sentence order and detects English SVO interference', () => {
    const raamGhar = SENTENCES[0]; // राम घर जान्छ
    const correctSOV = evaluateSOVSentence(raamGhar, ['sov-1-s', 'sov-1-o', 'sov-1-v']);
    expect(correctSOV.correct).toBe(true);
    expect(correctSOV.assembledSentence).toBe('राम घर जान्छ');
    expect(correctSOV.isSVOConfusion).toBe(false);

    // English SVO order: राम (Subject) जान्छ (Verb) घर (Object)
    const englishSVO = evaluateSOVSentence(raamGhar, ['sov-1-s', 'sov-1-v', 'sov-1-o']);
    expect(englishSVO.correct).toBe(false);
    expect(englishSVO.isSVOConfusion).toBe(true);
    expect(englishSVO.feedbackEnglish).toContain('SVO');
  });
});

