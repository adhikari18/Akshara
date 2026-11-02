# `Akshara` (अक्षर • खरी र पाटी) Engineering Roadmap (210+ Hours Planned)

This document outlines the multi-milestone engineering, computational linguistics, and dataset roadmap for **Akshara (`Khari`)** beyond the `v0.1.0` core release. Each milestone is decomposed into concrete, testable engineering work items (4–8 hours each) across vector geometry, Devanagari typography, Web Audio speech processing, interactive pedagogy, and cross-platform deployment.

---

## Milestone 1: Complete 49-Character Devanagari Vector Stroke Dataset (`packages/data/strokes/`) (~42 hrs)

Currently, `packages/data/strokes/` provides production-verified 4- and 5-step vector definitions for `क`, `ख`, `ग`, `घ`, `अ`, and `आ`. This milestone completes the canonical `300x300` vector stroke and waypoint corpus across the entire Nepali Varnamala:

- [ ] **1.1 Complete 13 *Swor Varna* (स्वर वर्ण) Stroke Vectors (`इ` to `अः`) (~8 hrs):**
  - Author verified SVG cubic Bézier paths, directional hints, and ordered waypoint arrays for `इ, ई, उ, ऊ, ऋ, ए, ऐ, ओ, औ, अं, अः`, including top-hook *Reph/Ekar* flags and *Chandrabindu/Shirbindu* dots.
- [ ] **1.2 *Talavya* (Palatal) & *Murdhanya* (Retroflex) Vyanjan Vectors (`च–ञ`, `ट–ण`) (~8 hrs):**
  - Encode stroke topologies for `च, छ, ज, झ, ञ` and `ट, ठ, ड, ढ, ण` enforcing loop-first, right-stem (*Khadi Pai*) second, and *Shirorekha* strictly last.
- [ ] **1.3 *Dantya* (Dental) & *Oshthya* (Labial) Vyanjan Vectors (`त–न`, `प–म`) (~8 hrs):**
  - Encode stroke topologies for `त, थ, द, ध, न` and `प, फ, ब, भ, म`, handling the inner diagonal slash of `ब` and the broken-Shirorekha top loop of `थ`, `ध`, and `भ`.
- [ ] **1.4 *Antastha*, *Ushma* & *Samyukta* Compound Vectors (`य–ह`, `क्ष, त्र, ज्ञ`) (~10 hrs):**
  - Encode stroke sequences for `य, र, ल, व`, `श, ष, स, ह`, and the three canonical Nepali compound letters `क्ष` (`क् + ष`), `त्र` (`त् + र`), and `ज्ञ` (`ज् + ञ`).
- [ ] **1.5 Nepali Devanagari Numerals (`०` to `९` / सुन्ना देखि नौ) (~8 hrs):**
  - Add a new `numerals` category to `letter.schema.json` and author single- and multi-stroke tracing definitions for Nepali numerals `०, १, २, ३, ४, ५, ६, ७, ८, ९`.

---

## Milestone 2: Computational Geometry & Adaptive Motor-Control Engine (`packages/core/`) (~36 hrs)

- [ ] **2.1 Discrete Fréchet Distance & Uniform Arc-Length Resampling (~8 hrs):**
  - Implement uniform arc-length polyline resampling (`resampleByArcLength`) and dynamic-programming Discrete Fréchet Distance (`discreteFrechetDistance`) in `packages/core/src/tracing-evaluator.ts` to grade continuous curve fidelity alongside waypoint unlocks.
- [ ] **2.2 Tangent-Angle Directional Enforcement & Loop Winding Detector (~7 hrs):**
  - Compute signed turning angles ($\sum \Delta \theta$) along `loop` strokes (`क`, `ख`, `ग`, `छ`, `ढ`) to verify that learners trace counter-clockwise vs. clockwise loops in the authentic hand-movement direction rather than tracing backward.
- [ ] **2.3 Broken-*Shirorekha* Topological Exception Solver (`थ, ध, भ, श, अ, आ`) (~7 hrs):**
  - In classical Devanagari typography, characters with an upper-left open loop (`थ`, `ध`, `भ`, `श`, `छ`) leave a gap in the *Shirorekha* above the loop so the glyph does not visually collapse into another letter (e.g., `ध` vs. `घ`, `भ` vs. `म`). Extend `shirorekha` schema metadata to support split/partial headline spans.
- [ ] **2.4 Kalman / 1€ Filter Pointer Smoothing & Apple Pencil / Stylus Pressure Curves (~7 hrs):**
  - Upgrade the Exponential Moving Average (EMA) smoother to a velocity-adaptive **1€ Filter** (Casiez et al.) and incorporate `PointerEvent.pressure` and `tiltX/tiltY` to modulate *Khari* chalk stroke width dynamically.
- [ ] **2.5 Automated SVG-to-Waypoint Compiler CLI (`@akshara/cli`) (~7 hrs):**
  - Build a CLI utility that parses raw SVG `<path d="...">` glyphs using cubic Bézier arc-length quadrature and automatically samples equidistant waypoints and bounding boxes to accelerate dataset authoring.

---

## Milestone 3: *Samyukta Akshara* (Conjunct Ligatures) & *Barakhari* Typography Engine (~34 hrs)

- [ ] **3.1 *Halanta* (`्`) & Half-Consonant (*आधा अक्षर*) Morphological Engine (~8 hrs):**
  - Extend `packages/core/src/matra-engine.ts` to model how each of the 36 consonants transforms when stripped of its inherent vowel (`क ➔ क्`, `ग ➔ ग्`, `च ➔ च्`, `त ➔ त्`, `स ➔ स्`), distinguishing vertical-stem-dropping consonants from bottom-virama consonants (`ट, ठ, ड, ढ, द, ह`).
- [ ] **3.2 Special *Rakar* (`्र`), *Repha* (`र्`), and *Rukar* (`रु / रू`) Ligature Rules (~8 hrs):**
  - Model the three distinct orthographic behaviors of `र` in Nepali clusters:
    1. Preceding `र` + consonant ➔ top *Repha* hook (`र् + म = र्म` in `धर्म`).
    2. Consonant + following `र` ➔ bottom diagonal *Paden Rakar* (`प + ् + र = प्र`, `ट + ् + र = ट्र`).
    3. Irregular `र + ु = रु` and `र + ू = रू` belly attachment (instead of bottom foot attachment).
- [ ] **3.3 Interactive *Samyukta Akshara* Ligature Fusion Playground (`SamyuktaBuilder.tsx`) (~10 hrs):**
  - Build an interactive drag-and-drop conjunct studio where learners slice the vertical *Khadi Pai* stem off a consonant and weld it to a second consonant (`स + ् + क + ू + ल = स्कूल`, `न + म + स् + ते = नमस्ते`).
- [ ] **3.4 Tracing Vectors for Common *Matra* Diacritics on the *Pati* Slate (~8 hrs):**
  - Allow learners to trace composite consonant+matra syllables directly on `TracingCanvas.tsx` (e.g., tracing `क` followed by the left-standing arch of `ि` to write `कि`, or bottom curls `ु / ू` for `कु / कू`).

---

## Milestone 4: Acoustic Speech Processing, Native Audio Corpus & Pronunciation Grading (~36 hrs)

- [ ] **4.1 Studio-Recorded Native Nepali Child Phonics Audio Corpus (`packages/web/public/audio/`) (~10 hrs):**
  - Record, master, and index 49 base Varnamala clips + 36 × 13 *Barakhari* syllable clips (`468` total `.opus`/`.mp3` files) spoken by native Nepali educators, with automatic offline IndexedDB caching.
- [ ] **4.2 Minimal-Pair Phonetic Contrast Drills (Aspiration & Retroflexion) (~8 hrs):**
  - Build an interactive listening and speaking discrimination game targeting the two hardest phonetic contrasts for English-dominant diaspora children:
    - **Voiceless vs. Aspirated vs. Voiced vs. Breathy-Voiced:** `क (ka)` vs. `ख (kha)` vs. `ग (ga)` vs. `घ (gha)`.
    - **Dental vs. Retroflex:** `त (ta - tongue on teeth)` vs. `ट (tta - tongue curled back to palate)`.
- [ ] **4.3 Web Audio Microphone Voice-Onset-Time (VOT) & Formant (`F1/F2`) Analyzer (~10 hrs):**
  - Implement client-side Web Audio API LPC / FFT spectral analysis to detect aspiration bursts (Voice Onset Time for `ख, छ, ठ, थ, फ`) and vowel formant ratios (`अ /ʌ/` vs. `आ /aː/`), giving children visual feedback when practicing aloud.
- [ ] **4.4 Offline Formant-Synthesized Nepali TTS Fallback Engine (~8 hrs):**
  - Expand `packages/web/src/lib/audio.ts` with a deterministic Klatt-style cascade formant synthesizer for all 13 Nepali vowels and 36 consonant transitions when native audio files or OS `ne-NP` TTS voices are unavailable.

---

## Milestone 5: Progressive SOV Grammar, Postpositions (*Vibhakti*) & Story Reader (~32 hrs)

- [ ] **5.1 Nepali Case Postpositions (*विभक्ति / Vibhakti*: `ले, लाई, मा, बाट, को`) Builder (~8 hrs):**
  - Extend `packages/core/src/sentence-engine.ts` to teach ergative/instrumental `ले` (`रामले भात खायो`), dative `लाई` (`आमालाई फूल देऊ`), locative `मा` (`घरमा`), and genitive `को/का/की` (`रामको किताब`).
- [ ] **5.2 Verb Honorific & Subject-Verb Agreement Matrix (`तिमी / तपाईं / ऊ / उनीहरू`) (~8 hrs):**
  - Build an interactive conjugation matcher teaching Nepali honorific tiers (`छौ / हुनुहुन्छ / छ / छन्`) and gender/plurality agreement (`जान्छ` vs. `जान्छिन्` vs. `जानुहुन्छ`).
- [ ] **5.3 Illustrated Graded Micro-Stories (*कथा पाटी*) with Tap-to-Decode Aksharas (~8 hrs):**
  - Author 10 graded 5-sentence Nepali folk and nature micro-stories where tapping any word decomposes it into its constituent *Barakhari* aksharas (`क + छ + ु + वा = कछुवा`) and plays audio.
- [ ] **5.4 Printable PDF Practice Worksheets (*अभ्यास पुस्तिका*) Generator (~8 hrs):**
  - Generate customizable A4/Letter printable dotted-line Devanagari handwriting worksheets from `packages/data/strokes/*.json` so parents and teachers can print offline practice sheets.

---

## Milestone 6: Spaced Repetition (FSRS), Offline PWA & React Native Mobile App (~30 hrs)

- [ ] **6.1 Local-First Spaced Repetition (FSRS) & Mastery Passport (`localStorage` / `IndexedDB`) (~8 hrs):**
  - Track per-letter stroke accuracy, *Matra* confusion matrices, and SOV sentence streaks locally on device (zero cloud tracking or PII) to schedule personalized daily 5-minute reviews.
- [ ] **6.2 Installable Offline-First Progressive Web App (PWA) Service Worker (~6 hrs):**
  - Add manifest and Service Worker pre-caching so schools in rural Nepal or travelers without connectivity can run the full *Pati* studio offline.
- [ ] **6.3 React Native / Expo Mobile & Tablet App (`packages/mobile/`) (~10 hrs):**
  - Create a `packages/mobile/` workspace consuming `@akshara/core` and `@akshara/data` via `react-native-svg` and `react-native-gesture-handler` for iPad and Android tablets.
- [ ] **6.4 Playwright End-to-End Canvas & Drag-and-Drop Regression Suite (~6 hrs):**
  - Add automated Playwright browser tests simulating pointer stroke gestures on `TracingCanvas.tsx` and drag-and-drop matra fusion on `MatraBuilder.tsx`.
