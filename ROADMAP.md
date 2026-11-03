# `Akshara` (अक्षर) Engineering Roadmap (~171 Hours Planned)

This document outlines the multi-milestone engineering, computational linguistics, and dataset roadmap for `Akshara` beyond the `v0.1.0` core release. Each milestone is decomposed into concrete, testable engineering work items (3–6 hours each) across vector geometry, Devanagari typography, Web Audio DSP, interactive pedagogy, and cross-platform deployment.

## Progress Overview

| Milestone | Focus | Est. Hours | Done | Progress |
|---|---|---|---|---|
| 1 | Devanagari Vector Stroke Dataset | ~35 | 30 | 86% |
| 2 | Computational Geometry, Stroke-Order Guide & Motor-Control Engine | ~25 | 0 | 0% |
| 3 | *Samyukta Akshara* & *Barakhari* Typography | ~21 | 0 | 0% |
| 4 | Audio Corpus, Speech DSP & Pronunciation Grading | ~37 | 0 | 0% |
| 5 | SOV Grammar, *Vibhakti* & Story Reader | ~29 | 0 | 0% |
| 6 | Spaced Repetition, Offline PWA & Mobile App | ~24 | 0 | 0% |
| **Total** | | **~171** | **30** | **~18%** |

---

## Milestone 1: Complete 49-Letter Devanagari Vector Stroke Dataset + Numerals (`packages/data/strokes/`) (~35 hrs)

`packages/data/strokes/` now provides vector definitions for all 49 letters: the 13 *Swor Varna* (`अ` to `अः`) and the 36 *Vyanjan Varna* (`क` to `ज्ञ`), enforced by `npm run validate:data`. Only the numerals remain. This milestone completes the canonical `300x300` vector stroke and waypoint corpus across the entire Nepali Varnamala (13 vowels + 33 consonants + 3 compounds = 49 letters), plus the 10 Nepali numerals:

- [x] **1.1 Complete Remaining 11 *Swor Varna* (स्वर वर्ण) Stroke Vectors (`इ` to `अः`) (~5 hrs):**
  - Author verified SVG cubic Bézier paths, directional hints, and ordered waypoint arrays for `इ, ई, उ, ऊ, ऋ, ए, ऐ, ओ, औ, अं, अः`, including top-hook *Ekar/Aikar* flags and *Shirbindu/Visarga* marks.
- [x] **1.2 Automated SVG-to-Waypoint Compiler CLI (`@akshara/cli`) (~5 hrs):**
  - Build a CLI utility that parses raw SVG `<path d="...">` glyphs using cubic Bézier arc-length quadrature and automatically samples equidistant waypoints and bounding boxes, so the remaining 36 letters and 10 numerals can be authored quickly.
- [x] **1.3 Split/Partial *Shirorekha* Schema Extension (~3 hrs):**
  - Extend the `shirorekha` metadata in `letter.schema.json` (previously a single `startX`–`endX` span) with optional `segments` to support split headline spans (e.g. `ध`, `भ`), validate segment/subpath/waypoint invariants, and teach `@akshara/cli` to emit segments. *(A trial migration of `ख`/`ग` was reverted: Kohinoor, ITF Devanagari and Devanagari MT all draw their headlines continuous.)*
- [x] **1.4 *Kanthya* `ङ`, *Talavya* (Palatal) & *Murdhanya* (Retroflex) Vyanjan Vectors (`ङ`, `च–ञ`, `ट–ण`) (~6 hrs):**
  - Encode stroke topologies for `ङ`, `च, छ, ज, झ, ञ` and `ट, ठ, ड, ढ, ण` enforcing body/loop-first, right-stem (*Khadi Pai*) second where present, and *Shirorekha* strictly last. Note that `ङ, छ, ट, ठ, ड, ढ` have no vertical stem.
- [x] **1.5 *Dantya* (Dental) & *Oshthya* (Labial) Vyanjan Vectors (`त–न`, `प–म`) (~5 hrs):**
  - Encode stroke topologies for `त, थ, द, ध, न` and `प, फ, ब, भ, म`, handling the inner diagonal slash of `ब`, the split *Shirorekha* of `ध` (using the schema from 1.3), and the partial headlines of `थ` and `भ` whose left elements sit outside the bar.
- [x] **1.6 *Antastha*, *Ushma* & *Samyukta* Compound Vectors (`य–ह`, `क्ष, त्र, ज्ञ`) (~6 hrs):**
  - Encode stroke sequences for `य, र, ल, व`, `श, ष, स, ह`, and the three canonical Nepali compound letters `क्ष` (`क् + ष`), `त्र` (`त् + र`), and `ज्ञ` (`ज् + ञ`).
- [ ] **1.7 Nepali Devanagari Numerals (`०` to `९` / सुन्ना देखि नौ) (~5 hrs):**
  - Add a `numerals` category to `letter.schema.json` and author single- and multi-stroke tracing definitions for Nepali numerals `०, १, २, ३, ४, ५, ६, ७, ८, ९`.

---

## Milestone 2: Computational Geometry, Stroke-Order Guide & Adaptive Motor-Control Engine (`packages/core/`, `packages/web/`) (~25 hrs)

- [ ] **2.1 Discrete Fréchet Distance & Uniform Arc-Length Resampling (~5 hrs):**
  - Implement uniform arc-length polyline resampling (`resampleByArcLength`) and dynamic-programming Discrete Fréchet Distance (`discreteFrechetDistance`) in `packages/core/src/tracing-evaluator.ts` to grade continuous curve fidelity alongside waypoint unlocks.
- [ ] **2.2 Tangent-Angle Directional Enforcement & Loop Winding Detector (~4 hrs):**
  - Compute signed turning angles ($\sum \Delta \theta$) along `loop` strokes (`क`, `ख`, `छ`, `ठ`, `ढ`) to verify that learners trace counter-clockwise vs. clockwise loops in the authentic hand-movement direction rather than tracing backward.
- [ ] **2.3 Broken-*Shirorekha* Evaluator & Renderer Support (split `ध`; partial `थ`, `भ`) (~4 hrs):**
  - In classical Devanagari typography, characters with an upper-left open loop leave a gap in the *Shirorekha* above the loop so the glyph does not visually collapse into another letter (e.g., `ध` vs. `घ`, `भ` vs. `म`). Teach the evaluator and `TracingCanvas.tsx` ghost-guides to validate and render the split headline spans defined in 1.3.
- [ ] **2.4 Velocity-Adaptive 1€ Filter & Stylus Pressure Curves (~4 hrs):**
  - Upgrade the Exponential Moving Average (EMA) smoother to a velocity-adaptive **1€ Filter** (Casiez et al.) and incorporate `PointerEvent.pressure` and `tiltX/tiltY` to modulate chalk stroke width dynamically.
- [ ] **2.5 Full-Letter Stroke-Order Guide, Directional Arrows & Curve-Accurate Demo Replay (~4 hrs):**
  - Add a full-letter **"Stroke Order Guide"** mode to `TracingCanvas.tsx` displaying color-coded strokes, numbered start-point badges (`①, ②, ③…` / `१, २, ३…`), and tangent directional arrows along each SVG path. Upgrade **Auto-Trace Demo** to sample along true cubic Bézier curves (`svgPath`) with play/pause, step-by-stroke, and speed controls (`0.5× / 1× / 2×`) without resetting the learner's active `TracingEvaluator` progress, and surface bilingual stroke instructions (`nepaliInstruction` + `englishInstruction`) in the Stroke Order sidebar.
- [ ] **2.6 Baseline Playwright Canvas Regression Harness (~4 hrs):**
  - Stand up Playwright in CI with synthetic pointer-gesture fixtures replaying recorded strokes on `TracingCanvas.tsx` and drag-and-drop on `MatraBuilder.tsx`, so every later milestone ships with regression coverage.

---

## Milestone 3: *Samyukta Akshara* (Conjunct Ligatures) & *Barakhari* Typography Engine (~21 hrs)

- [ ] **3.1 *Halanta* (`्`) & Half-Consonant (*आधा अक्षर*) Morphological Engine (~5 hrs):**
  - Extend `packages/core/src/matra-engine.ts` to model how each of the 33 base consonants (plus the compounds `क्ष` and `ज्ञ`) transforms when stripped of its inherent vowel (`क ➔ क्`, `ग ➔ ग्`, `च ➔ च्`, `त ➔ त्`, `स ➔ स्`), distinguishing vertical-stem-dropping consonants from bottom-virama consonants (`ङ, छ, ट, ठ, ड, ढ, द, ह`).
- [ ] **3.2 Special *Rakar* (`्र`), *Repha* (`र्`), and *Rukar* (`रु / रू`) Ligature Rules (~5 hrs):**
  - Model the three distinct orthographic behaviors of `र` in Nepali clusters:
    1. Preceding `र` + consonant ➔ top *Repha* hook (`र् + म = र्म` in `धर्म`).
    2. Consonant + following `र` ➔ bottom diagonal *Paden Rakar* (`प + ् + र = प्र`, `ट + ् + र = ट्र`).
    3. Irregular `र + ु = रु` and `र + ू = रू` belly attachment (instead of bottom foot attachment).
- [ ] **3.3 Interactive *Samyukta Akshara* Ligature Fusion Playground (`SamyuktaBuilder.tsx`) (~6 hrs):**
  - Build an interactive drag-and-drop conjunct studio where learners slice the vertical *Khadi Pai* stem off a consonant and weld it to a second consonant (`स + ् + क + ू + ल = स्कूल`, `न + म + स् + ते = नमस्ते`). Add Playwright coverage to the 2.6 harness.
- [ ] **3.4 Tracing Vectors for Composite *Matra* Diacritics on the *Pati* Slate (~5 hrs):**
  - Allow learners to trace composite consonant+matra syllables directly on `TracingCanvas.tsx` (e.g., tracing `क` followed by the left-standing arch of `ि` to write `कि`, or bottom curls `ु / ू` for `कु / कू`).

---

## Milestone 4: Audio Corpus, Web Audio Speech DSP, Formant Synthesis & Pronunciation Grading (~37 hrs)

- [ ] **4.1 Native-Speaker Audio Corpus Recording & Annotation (~6 hrs):**
  - Record, trim, and loudness-normalize native Nepali speaker audio for all 49 letters, core *Barakhari* syllables, and starter vocabulary; annotate syllable onset timings and document a contributor recording guide.
- [ ] **4.2 IndexedDB Audio Sprite Loader & Phoneme Timing Synchronizer (~5 hrs):**
  - Build an offline-capable Web Audio asset manager that decodes multi-syllable `.opus`/`.mp3` audio sprites (from 4.1) into `AudioBuffer` slices and synchronizes syllable highlighting during word and sentence playback.
- [ ] **4.3 Minimal-Pair Phonetic Contrast Drills (Aspiration & Retroflexion) (~5 hrs):**
  - Build an interactive listening and speaking discrimination module targeting the two hardest phonetic contrasts for English-dominant diaspora children:
    - **Voiceless vs. Aspirated vs. Voiced vs. Breathy-Voiced:** `क (ka)` vs. `ख (kha)` vs. `ग (ga)` vs. `घ (gha)`.
    - **Dental vs. Retroflex:** `त (ta - tongue on teeth)` vs. `ट (tta - tongue curled back to palate)`.
- [ ] **4.4 Microphone Voice-Onset-Time (VOT) Aspiration Detector (~5 hrs):**
  - Implement client-side Web Audio FFT burst/energy analysis to estimate Voice Onset Time and detect aspiration for `ख, छ, ठ, थ, फ`, robust to children's higher-pitched voices and background noise.
- [ ] **4.5 LPC Formant (`F1/F2`) Vowel Analyzer & Visual Feedback (~5 hrs):**
  - Implement LPC-based `F1/F2` formant estimation to distinguish vowel qualities (e.g., `अ /ʌ/` vs. `आ /aː/`) and render real-time visual feedback when learners practice aloud.
- [ ] **4.6 Offline Klatt-Style Formant Synthesizer Core (Vowels) (~5 hrs):**
  - Expand `packages/web/src/lib/audio.ts` with a deterministic cascade formant synthesizer modeling `F1/F2/F3` resonant filters for the ~6 Nepali oral vowel phonemes (and nasalized variants) underlying the 13 vowel letters.
- [ ] **4.7 Formant Synthesizer Consonant Bursts & Transitions (~6 hrs):**
  - Add stop bursts, aspiration noise, nasal murmurs, and formant transitions for the 33 consonants so the synthesizer can serve as a fallback when native audio files or OS `ne-NP` TTS voices are unavailable.

---

## Milestone 5: Progressive SOV Grammar, Postpositions (*Vibhakti*) & Story Reader (~29 hrs)

- [ ] **5.1 Nepali Case Postpositions (*विभक्ति / Vibhakti*: `ले, लाई, मा, बाट, को`) Builder (~5 hrs):**
  - Extend `packages/core/src/sentence-engine.ts` to teach ergative/instrumental `ले` (`रामले भात खायो`), dative `लाई` (`आमालाई फूल देऊ`), locative `मा` (`घरमा`), ablative `बाट` (`घरबाट`), and genitive `को/का/की` (`रामको किताब`).
- [ ] **5.2 Verb Honorific & Subject-Verb Agreement Matrix (`तिमी / तपाईं / ऊ / उनीहरू`) (~5 hrs):**
  - Build an interactive conjugation matcher teaching Nepali honorific tiers (`छौ / हुनुहुन्छ / छ / छन्`) and gender/plurality agreement (`जान्छ` vs. `जान्छिन्` vs. `जानुहुन्छ`).
- [ ] **5.3 Tap-to-Decode Story Reader Engine (*कथा पाटी*) (~5 hrs):**
  - Build the story reader component where tapping any word decomposes it into its constituent *Barakhari* aksharas (`क + छु + वा = कछुवा`), then into consonant + matra parts (`छु = छ + ु`), and plays synchronized audio.
- [ ] **5.4 Graded Micro-Story Content Authoring & Illustration (~5 hrs):**
  - Author 10 graded 5-sentence Nepali folk and nature micro-stories with vocabulary leveled to the letter/matra progression, and source or commission CC-licensed illustrations.
- [ ] **5.5 Story Narration Audio & Word-Timing Alignment (~4 hrs):**
  - Record native-speaker narration for the 10 stories and align word-level timestamps for read-along highlighting.
- [ ] **5.6 Printable PDF Practice Worksheets (*अभ्यास पुस्तिका*) Generator (~5 hrs):**
  - Generate customizable A4/Letter printable dotted-line Devanagari handwriting worksheets from `packages/data/strokes/*.json` so parents and teachers can print offline practice sheets.

---

## Milestone 6: Spaced Repetition (FSRS), Offline PWA & React Native Mobile App (~24 hrs)

- [ ] **6.1 Local-First Spaced Repetition (FSRS) & Mastery Passport (`localStorage` / `IndexedDB`) (~5 hrs):**
  - Track per-letter stroke accuracy, *Matra* confusion matrices, and SOV sentence streaks locally on device (zero cloud tracking or PII) to schedule personalized daily 5-minute reviews.
- [ ] **6.2 Installable Offline-First Progressive Web App (PWA) Service Worker (~4 hrs):**
  - Add manifest and Service Worker pre-caching so schools in rural Nepal or learners without connectivity can run the full *Pati* studio offline.
- [ ] **6.3 React Native / Expo Workspace Scaffold (`packages/mobile/`) (~5 hrs):**
  - Create a `packages/mobile/` Expo workspace consuming `@akshara/core` and `@akshara/data`, with navigation, shared theming, and CI build checks for iPad and Android tablets.
- [ ] **6.4 Native Tracing Canvas Port (`react-native-svg` + `react-native-gesture-handler`) (~6 hrs):**
  - Port `TracingCanvas.tsx` to a native component with low-latency gesture capture, Apple Pencil / stylus pressure support, and parity with the web evaluator.
- [ ] **6.5 Full End-to-End Regression Suite Expansion (~4 hrs):**
  - Extend the 2.6 Playwright harness to cover `SamyuktaBuilder.tsx`, the story reader, PWA offline mode, and FSRS review flows.
