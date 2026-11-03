# Akshara (अक्षर) ✍️🇳🇵

**Interactive open-source Nepali Devanagari literacy engine teaching children and diaspora early learners how to read, pronounce, and write through parametric *Pati* slate stroke tracing, *Barakhari* *Matra* fusion, and Subject-Object-Verb (SOV) sentence construction.**

[![License: MIT](https://img.shields.io/badge/License-MIT-amber.svg)](./LICENSE)
[![CI Status](https://img.shields.io/badge/CI-Passing-emerald.svg)](./.github/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![JSON Schema](https://img.shields.io/badge/Schema-Draft_2020--12-purple.svg)](./packages/data/schema/letter.schema.json)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

---

## Overview & Cultural Heritage (`अक्षर र पाटी`)

For generations across Nepal, children learned their first **अक्षर** (*Akshara* — indestructible syllable) during *Saraswati Puja* (*Shree Panchami*) by tracing chalk across a dark seasoned wooden slate (**पाटी** / *Pati*).

Yet today, millions of Nepali diaspora children and early learners lack modern, open-source digital tools tailored to the unique topological and phonetic mechanics of **Nepali Devanagari**:
1. **No Open-Source Vector Stroke Dataset for Nepali Devanagari:** Existing apps treat Devanagari like static flashcards or allow children to scribble over a bitmap mask in any order—teaching backwards habits like drawing the top horizontal bar (*Shirorekha* / शिरोरेखा) first.
2. **Abugida *Matra* & *Barakhari* Complexity:** Unlike Latin alphabets where vowels sit linearly beside consonants, Devanagari *Matras* (मात्रा) orbit 360° around a base consonant—attaching to the **left** (`ि` *Hraswa Ikar*), **right** (`ा, ी, ो, ौ, ः`), **top** (`े, ै, ं`), or **bottom** (`ु, ू, ृ, ्`).
3. **English SVO vs. Nepali SOV Syntactic Transfer:** Heritage learners raised in English environments instinctively assemble words in **Subject–Verb–Object (SVO)** order (*"Ram goes home"*), whereas Nepali requires **Subject–Object–Verb (SOV)** order (*"राम घर जान्छ"* — `कर्ता + कर्म + क्रिया`).

**`Akshara`** bridges this gap with a headless TypeScript geometry and phonology core (`@akshara/core`), a canonical JSON Schema and stroke dataset (`@akshara/data`), and an interactive Next.js + HTML5 Canvas *Pati* learning studio (`@akshara/web`).

---

## Visual Architecture Diagram

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                              AKSHARA (अक्षर)                                  │
│                  Nepali Devanagari Literacy Monorepo Engine                  │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │
        ┌──────────────────────────────┴──────────────────────────────┐
        ▼                                                             ▼
┌───────────────────────────────────────┐   ┌──────────────────────────────────┐
│        @akshara/data (JSON)           │   │     @akshara/core (Headless TS)  │
├───────────────────────────────────────┤   ├──────────────────────────────────┤
│ • schema/letter.schema.json           │   │ • src/tracing-evaluator.ts       │
│ • vowels.json (13 Swor: अ – अः)       │──►│   - Euclidean Waypoint Check:    │
│ • consonants.json (36 Vyanjan: क – ज्ञ)│   │     √((xp-xw)²+(yp-yw)²) ≤ r_ad  │
│ • strokes/*.json (38 letters: अ–अः,   │   │   - EMA Child Jitter Smoothing   │
│   क–म 300x300 SVG + Waypoints)        │   │   - Shirorekha-Last Enforcement  │
│ • words.json (कलम, घर, बस, चरा...)    │   │ • src/matra-engine.ts            │
│ • sentences.json (SOV Corpus)         │   │   - 13-Step Barakhari Fusion     │
└───────────────────┬───────────────────┘   │   - Orthographic Akshara Split   │
                    │                       │ • src/sentence-engine.ts         │
                    │                       │   - SOV vs SVO Grammar Evaluator │
                    └──────────┬────────────┴─────────────────┬────────────────┘
                               ▼                              ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                   @akshara/web (Next.js 15 + React 19 + Tailwind)            │
├─────────────────────────┬──────────────────────────┬─────────────────────────┤
│   TracingCanvas.tsx     │     MatraBuilder.tsx     │ WordSentenceBuilder.tsx │
│ • Dark Wooden Pati Slate│ • Drag & Drop Matras     │ • 2/3-Akshara Word Tiles│
│ • Chalk Dust Particles  │   (ा ि ी ु ू ृ े ै ो ौ)  │ • SOV Unscrambler       │
│ • Glowing Waypoints &   │ • 360° Attachment Compass│   (राम + घर + जान्छ)     │
│   Adaptive Tolerance    │ • 13-Card Barakhari Strip│ • Web Speech + Formant  │
│ • Premature Shirorekha  │ • Live Unicode Formula   │   Pentatonic Audio      │
│   Guardrail Alert       │   U+0915 + U+093F = कि   │   Synthesis             │
└─────────────────────────┴──────────────────────────┴─────────────────────────┘
```

---

## Pedagogical Dual-Track Breakdown

| Track | Engine Component | Core Pedagogical & Algorithmic Mechanics |
| :--- | :--- | :--- |
| **1. Writing Engine** *(Tactile Vector Tracing)* | [`tracing-evaluator.ts`](./packages/core/src/tracing-evaluator.ts) & [`TracingCanvas.tsx`](./packages/web/src/components/TracingCanvas.tsx) | • **Devanagari Topological Order:** Enforces loop/curve body components first (`loop`, `curve`), vertical stems second (`stem` / *Khadi Pai*), and the horizontal headline bar (`shirorekha` / शिरोरेखा) **strictly last**.<br>• **Child Motor-Jitter Tolerance:** Combines an Exponential Moving Average (EMA) low-pass pointer filter with adaptive tolerance radii (`1.45x` in Child Mode) so 4-to-7-year-old learners can complete strokes without frustration.<br>• **Traditional *Pati* Slate Aesthetic:** Seasoned dark wooden slate canvas with chalk strokes, dust particles, glowing numbered waypoints, and auto-trace replay. |
| **2. Reading Engine** *(Phonics & Syllable Fusion)* | [`matra-engine.ts`](./packages/core/src/matra-engine.ts) & [`MatraBuilder.tsx`](./packages/web/src/components/MatraBuilder.tsx) | • **Dynamic *Matra* Drag-and-Drop:** Snap any vowel diacritic (`ा, ि, ी, ु, ू, ृ, े, ै, ो, ौ, ं, ः, ्`) onto any of the 36 *Vyanjan* consonants (`क ➔ का, कि, की...`).<br>• **360° Topological Compass:** Explicitly highlights whether a *Matra* stands to the **left** (`ि`), **right** (`ा, ी`), **top** (`े, ै, ं`), or **bottom** (`ु, ू, ृ`) of the consonant stem.<br>• **Instant Phonics Playback:** Speaks composite syllables via `ne-NP` Web Speech synthesis paired with Web Audio pentatonic chimes. |
| **3. Word & Sentence Progression** *(Lexical & SOV Syntax)* | [`sentence-engine.ts`](./packages/core/src/sentence-engine.ts) & [`WordSentenceBuilder.tsx`](./packages/web/src/components/WordSentenceBuilder.tsx) | • **2- & 3-Letter Noun Tiles:** Assemble foundational words (`कलम`, `घर`, `बस`, `चरा`, `पानी`, `कमल`, `आमा`, `किताब`) from syllable blocks.<br>• **SOV Sentence Unscrambler:** Arrange scrambled word tokens into grammatical Nepali **Subject (`कर्ता`) + Object (`कर्म`) + Verb (`क्रिया`)** sentences (e.g., `"राम घर जान्छ"`), with automatic detection and coaching when a learner uses English SVO order. |

---

## Repository File Tree

```text
Akshara/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                                        # Monorepo build, schema validation, typecheck & Vitest CI
│   │   └── deploy.yml                                    # Static build & GitHub Pages deployment workflow
│   └── ISSUE_TEMPLATE/
│       ├── 01-good-first-issue-stroke-vectors.md         # Seeded issue: Chavarga (च, छ, ज, झ, ञ) stroke vectors
│       ├── 02-math-frechet-jitter-smoothing.md           # Seeded issue: Discrete Fréchet distance & spline resampling
│       ├── 03-assets-native-nepali-phonics-audio.md      # Seeded issue: Native Nepali speaker phonics audio pack
│       └── 04-education-conjunct-akshara-samyukta.md     # Seeded issue: Samyukta Akshara conjunct ligature builder
├── packages/
│   ├── data/                                             # @akshara/data — Canonical schemas & Devanagari datasets
│   │   ├── schema/
│   │   │   └── letter.schema.json                        # Draft 2020-12 JSON Schema for stroke vectors & topology
│   │   ├── strokes/
│   │   │   ├── ka.json                                   # 4-step vector & waypoint definition for "क" (U+0915)
│   │   │   ├── kha.json                                  # 4-step vector & waypoint definition for "ख" (U+0916)
│   │   │   └── …                                         # 38 letters so far: all 13 Swor (अ–अः) + Vyanjan क–म
│   │   ├── vowels.json                                   # Complete 13 Swor Varna (अ to अः) with Matra mappings
│   │   ├── consonants.json                               # Complete 36 Vyanjan Varna (क to ज्ञ) with Paninian Varga
│   │   ├── words.json                                    # 2- and 3-letter noun building blocks (कलम, घर, बस, चरा...)
│   │   ├── sentences.json                                # SOV sentence unscrambler corpus (राम घर जान्छ...)
│   │   ├── src/
│   │   │   ├── index.ts                                  # Typed dataset exports & topological validator
│   │   │   └── validate-cli.ts                           # Dataset & schema verification CLI
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── core/                                             # @akshara/core — Headless geometry, Matra & SOV engine
│   │   ├── src/
│   │   │   ├── tracing-evaluator.ts                      # Waypoint Euclidean distance, EMA jitter & Shirorekha engine
│   │   │   ├── matra-engine.ts                           # Barakhari Unicode combiner & orthographic akshara splitter
│   │   │   ├── sentence-engine.ts                        # Word tile & SOV vs SVO syntactic evaluator
│   │   │   └── index.ts                                  # Public barrel exports
│   │   ├── test/
│   │   │   ├── tracing-evaluator.test.ts                 # Unit tests for vector tracing & Shirorekha-last rules
│   │   │   └── matra-engine.test.ts                      # Unit tests for Barakhari fusion & SOV sentence evaluation
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/                                              # @akshara/web — Next.js 15 + React 19 + Tailwind CSS Studio
│       ├── src/
│       │   ├── app/
│       │   │   ├── globals.css
│       │   │   ├── layout.tsx
│       │   │   └── page.tsx                              # 4-stage progressive Devanagari learning studio
│       │   ├── components/
│       │   │   ├── TracingCanvas.tsx                     # Interactive HTML5 Canvas Pati slate vector tracing
│       │   │   ├── MatraBuilder.tsx                      # Drag-and-drop Matra & 13-step Barakhari playground
│       │   │   └── WordSentenceBuilder.tsx               # Word tile builder & SOV sentence unscrambler
│       │   └── lib/
│       │       └── audio.ts                              # Web Speech (ne-NP) + Web Audio pentatonic synthesizer
│       ├── next.config.mjs
│       ├── postcss.config.mjs
│       ├── tailwind.config.mjs
│       ├── package.json
│       └── tsconfig.json
├── CONTRIBUTING.md                                       # Developer & non-coder micro-contribution guide
├── ROADMAP.md                                            # 130+ hour multi-milestone engineering roadmap
├── LICENSE                                               # MIT License
├── package.json                                          # Root npm workspace configuration
└── tsconfig.base.json                                    # Shared strict TypeScript configuration
```

---

## Quickstart Guide

### Prerequisites
- **Node.js** `>= 20.0.0`
- **npm** `>= 10.0.0`

### 1. Clone, Install & Build

```bash
git clone https://github.com/adhikari18/Akshara.git
cd Akshara
npm install
npm run build
```

### 2. Validate JSON Datasets & Run the Unit Test Suite

```bash
# Verify all 13 Swor, 36 Vyanjan, and stroke datasets against Shirorekha topological rules
npm run validate:data

# Run Vitest unit tests for @akshara/core
npm test
```

### 3. Launch the Interactive *Pati* Web Studio

```bash
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser to explore all 4 stages:
1. **१. पाटी लेखन (`Pati Tracing`):** Trace `क`, `ख`, `ग`, `घ`, `अ`, and `आ` with chalk on the wooden *Pati* slate, toggle Child Jitter (`1.45x`) tolerance, or click **Auto-Trace Demo** to watch animated stroke order.
2. **२. मात्रा र बाह्रखरी (`Matra Fusion`):** Drag any *Matra* diacritic onto any of the 36 *Vyanjan* consonants to inspect its 360° placement rule and hear the full 13-step *Barakhari*.
3. **३. शब्द र वाक्य (`Words & SOV`):** Assemble 2- and 3-letter words (`कलम`, `घर`, `बस`, `चरा`) and unscramble Nepali **Subject–Object–Verb** sentences (`राम घर जान्छ`).
4. **४. वर्णमाला (`Full Varnamala`):** Interactive audio reference chart for all 13 *Swor Varna* and 36 *Vyanjan Varna*.

---

## Micro-Contribution Guide for Non-Coders

We designed `Akshara` so educators, parents, native speakers, and illustrators can contribute without touching React or TypeScript:

1. **Record Native Nepali Phonics Audio (`assets`):** Record short, clear `.mp3`/`.ogg` clips for the 13 *Swor* and 36 *Vyanjan* characters ([Issue Template #03](./.github/ISSUE_TEMPLATE/03-assets-native-nepali-phonics-audio.md)).
2. **Add New Vocabulary & SOV Sentences (`education`):** Add everyday Nepali children's words to [`packages/data/words.json`](./packages/data/words.json) or simple Subject-Object-Verb sentences to [`packages/data/sentences.json`](./packages/data/sentences.json).
3. **Plot Character Stroke Coordinates (`good first issue`):** Add `300x300` waypoint coordinates for new letters in [`packages/data/strokes/`](./packages/data/strokes/) ([Issue Template #01](./.github/ISSUE_TEMPLATE/01-good-first-issue-stroke-vectors.md)).

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) and [`ROADMAP.md`](./ROADMAP.md) for full details.

---

## Platform & Hackathon Architecture Write-Up

### Project Title & Tagline
**Akshara (`अक्षर`)** — *An open-source parametric vector-tracing, Barakhari syllable-fusion, and SOV grammar engine reviving the traditional Nepali Pati wooden slate for the digital generation.*

### Inspiration & The Gap
Over 30 million people speak Nepali worldwide, including a rapidly growing global diaspora. Yet when parents try to teach their children how to read and write Nepali Devanagari, they face a stark digital divide:
- **Zero Open Vector Stroke Datasets:** While Chinese (HanziWriter) and Japanese Kana have rich open-source stroke-order datasets, Nepali Devanagari has none. Existing apps rely on static images or unscored freehand drawing.
- **Lost Topological Discipline:** In Devanagari calligraphy, stroke topology is structural—curved loops and bowls are drawn first, vertical pillars (*Khadi Pai*) second, and the unifying top horizontal bar (*Shirorekha* / शिरोरेखा) strictly last. Children who copy printed fonts on tablets almost always draw the *Shirorekha* first, distorting character proportions.
- **Abugida & Syntactic Friction:** English-dominant learners struggle with non-linear *Matra* placement (such as *Hraswa Ikar* `ि`, which visually precedes the consonant it phonetically follows) and English **SVO** vs. Nepali **SOV** word order.

### What It Does
`Akshara` guides learners through a 4-stage pedagogical progression:
1. **Tactile *Pati* Vector Tracing:** Learners trace characters (`क, ख, ग, घ, अ, आ`) on a dark wooden *Pati* slate with realistic chalk particles, guided by glowing sequential waypoints and instant topological feedback.
2. **Dynamic *Matra* & *Barakhari* Fusion:** Learners drag vowel diacritics (`ा, ि, ी, ु, ू, ृ, े, ै, ो, ौ, ं, ः, ्`) onto any of the 36 *Vyanjan* consonants, viewing live Unicode codepoint assembly (`U+0915 + U+093F = कि`), a 360° placement compass (`LEFT`, `RIGHT`, `TOP`, `BOTTOM`), and an interactive 13-step *Barakhari* ribbon.
3. **2- & 3-Letter Word Building Blocks:** Learners snap syllable tiles together to build concrete nouns (`कलम`, `घर`, `बस`, `चरा`, `पानी`, `कमल`, `आमा`, `किताब`).
4. **SOV Sentence Unscrambler:** Learners arrange scrambled tokens into authentic Nepali **Subject (`कर्ता`) + Object (`कर्म`) + Verb (`क्रिया`)** sentences (`"राम घर जान्छ"`), receiving targeted syntactic coaching if they fall back into English SVO habits.

### How We Built It
- **Monorepo Architecture (`npm workspaces`):** Clean separation between `@akshara/data` (JSON Schemas, 13 Swor, 36 Vyanjan, stroke vectors, SOV corpus), `@akshara/core` (zero-dependency TypeScript geometry & Unicode engines), and `@akshara/web` (Next.js 15, React 19, Tailwind CSS, HTML5 Canvas, Web Speech + Web Audio API).
- **Mathematical Stroke Evaluator (`tracing-evaluator.ts`):** Validates each pointer sample against sequential waypoints via Euclidean distance:
  $$\sqrt{(x_p - x_w)^2 + (y_p - y_w)^2} \le r_{\text{adaptive}}$$
  combined with perpendicular point-to-segment corridor deviation checks and an Exponential Moving Average (EMA) low-pass filter.

### Challenges Overcome
- **Compensating for Child Motor Jitter:** Young children learning on touchscreens exhibit high-frequency hand tremor. By combining EMA pointer smoothing ($\alpha = 0.6$) with an adaptive tolerance multiplier (`1.45x` in Child Mode plus velocity jitter compensation), we prevented false-negative stroke resets while preserving stroke directionality.
- **Real-Time *Shirorekha*-Last Enforcement:** We built both a static schema/topology verifier (`validateStrokeTopology`) and a live pointer heuristic (`detectPrematureShirorekhaAttempt`) that detects when a learner tries to draw the top headline bar at $y \approx 75$ before completing the character body and stem.
- **Devanagari Grapheme Cluster Segmentation:** Standard JavaScript `string.split('')` breaks Devanagari syllables apart (`"किताब"` splits into 5 raw code units `['क', 'ि', 'त', 'ा', 'ब']`). We implemented a Unicode codepoint cluster parser (`segmentDevanagariAksharas`) that binds combining matras (`U+093E..U+094C`), modifiers (`ं, ँ, ः`), and *Virama* conjuncts (`C + ् + C`) into intact orthographic *aksharas* (`['कि', 'ता', 'ब']`).

### What's Next
Our **[130+ Hour Engineering Roadmap](./ROADMAP.md)** expands `Akshara` with:
1. Full `300x300` vector stroke definitions for all 49 Nepali *Swor* and *Vyanjan* characters plus Nepali numerals (`०–९`).
2. Discrete Fréchet Distance curve grading and 1€ filter stylus pressure support.
3. Interactive *Samyukta Akshara* (conjunct consonant / *Halanta* `्`) ligature builder (`क्ष, त्र, ज्ञ, प्र, द्य`).
4. Client-side Web Audio microphone Voice-Onset-Time (VOT) and formant analysis for grading aspirated vs. unaspirated pronunciation aloud.
5. An offline-first PWA and React Native tablet build for rural Nepali classrooms and diaspora weekend schools.

---

## License

Released under the [MIT License](./LICENSE). Copyright (c) 2026 Ashok Adhikari.

