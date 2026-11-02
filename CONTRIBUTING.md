# Contributing to `Akshara` (अक्षर • खरी र पाटी)

Thank you for helping build **Akshara**—an open-source interactive engine teaching children and diaspora early learners how to read, pronounce, and write Nepali Devanagari script!

We welcome contributions from **TypeScript/React engineers**, **computational linguists**, **educators**, **voice artists**, and **illustrators** (including non-coders!).

---

## 1. Micro-Contributions for Non-Coders (No Programming Required!)

You do not need to write TypeScript to make a lasting impact on Nepali literacy:

### A. Authoring New Letter Stroke JSON Files (`packages/data/strokes/`)
1. Copy [`packages/data/strokes/ka.json`](./packages/data/strokes/ka.json) to a new file (e.g., `packages/data/strokes/cha.json`).
2. Plot the strokes on a `300x300` coordinate grid (`shirorekhaY = 75`, `baselineY = 240`).
3. Ensure your strokes follow the **Devanagari Topological Order**:
   - **Step 1:** Loop, curve, or diagonal body strokes (`"type": "loop"` or `"curve"`).
   - **Step 2:** Vertical stem / *Khadi Pai* (`"type": "stem"`).
   - **Final Step:** Top horizontal headline bar / *Shirorekha* (`"type": "shirorekha"`).
4. Run `npm run validate:data` to verify your JSON against [`packages/data/schema/letter.schema.json`](./packages/data/schema/letter.schema.json).

### B. Recording Native Nepali Phonics Audio
- Record crisp, warm, child-friendly pronunciations (`.mp3` or `.ogg`, mono, 44.1kHz) for:
  - **Swor Varna:** `अ` to `अः`
  - **Vyanjan Varna:** `क — कपुरी क` to `ज्ञ — ज्ञानी ज्ञ`
  - **Barakhari Syllables:** `क, का, कि, की, कु, कू, कृ, के, कै, को, कौ, कं, कः`
- See [Issue Template #03](./.github/ISSUE_TEMPLATE/03-assets-native-nepali-phonics-audio.md) for naming conventions.

### C. Expanding Word Tiles & SOV Sentences (`packages/data/words.json` & `sentences.json`)
- Add child-friendly 2- and 3-syllable Nepali nouns to [`packages/data/words.json`](./packages/data/words.json) or Subject-Object-Verb (SOV) practice sentences to [`packages/data/sentences.json`](./packages/data/sentences.json).

---

## 2. Local Monorepo Development Guide

### Prerequisites
- **Node.js** `>= 20.0.0`
- **npm** `>= 10.0.0`

### Setup & Commands

```bash
# 1. Install all workspace dependencies (@akshara/data, @akshara/core, @akshara/web)
npm install

# 2. Build all packages
npm run build

# 3. Validate JSON datasets and Devanagari topological rules
npm run validate:data

# 4. Run the Vitest unit test suite
npm test

# 5. Run TypeScript typechecking across the monorepo
npm run typecheck

# 6. Start the interactive Next.js learning studio at http://localhost:3000
npm run dev
```

---

## 3. Seeded Starter Issues

Check out our ready-to-pick-up issues in [`.github/ISSUE_TEMPLATE/`](./.github/ISSUE_TEMPLATE/):
- **`good first issue` / `education`:** [Author 4-Step Vector Stroke Definitions for Chavarga (`च, छ, ज, झ, ञ`)](./.github/ISSUE_TEMPLATE/01-good-first-issue-stroke-vectors.md)
- **`math` / `core`:** [Discrete Fréchet Distance & Catmull-Rom Spline Resampling for Child Jitter](./.github/ISSUE_TEMPLATE/02-math-frechet-jitter-smoothing.md)
- **`assets` / `good first issue`:** [Native Nepali Child-Friendly Phonics Audio Pack](./.github/ISSUE_TEMPLATE/03-assets-native-nepali-phonics-audio.md)
- **`education` / `frontend`:** [Interactive Conjunct Consonant (`संयुक्त अक्षर` / Halanta) Ligature Playground](./.github/ISSUE_TEMPLATE/04-education-conjunct-akshara-samyukta.md)

---

## License

By contributing to `Akshara`, you agree that your contributions will be licensed under the [MIT License](./LICENSE).

