# Akshara — Codebase Review & Next Steps

_Review date: 2026-11-13 · Commit reviewed: `710c702` · Scope: all four workspaces (`data`, `core`, `cli`, `web`), CI/CD, docs._

## TL;DR

The **domain layer is strong**: the data lives in its own package, is driven by a JSON Schema, has a headless evaluator and real invariant tests. The **delivery layer is the weak spot**. The web app is a set of large monolithic components with no tests, no linting, a deploy workflow that doesn't deploy, and a few rendering and scoring problems that children on real devices will notice.

**Recommendation:** spend about one short milestone (~12–15 h) hardening the current base (section 4) **before** starting Milestone 2/3 features. Most roadmap items extend `TracingCanvas.tsx` and `tracing-evaluator.ts`, and both of those carry the debt listed below.

---

## 1. Architecture overview

```
@akshara/data  (JSON + schema + validation)  ◄── @akshara/cli (SVG → waypoint compiler)
      ▲
@akshara/core  (headless evaluator, matra engine, sentence engine)
      ▲
@akshara/web   (Next.js 15 / React 19 / Canvas 2D)
```

| Package | LOC (src) | Tests |
|---|---|---|
| data | ~625 + 49 stroke JSONs | 17 (schema, topology, shirorekha) |
| core | ~965 | 18 + data-driven "trace all letters" suite |
| cli | ~650 | 30 |
| web | ~2,440 | **0** |

---

## 2. Pros (keep doing this)

1. **Clean layering.** `core` has no DOM dependencies, so it can be reused as-is by the planned React Native app (6.3) and by the worksheet generator (5.6).
2. **Data-first, schema-validated design.** Letters are declarative JSON checked against `letter.schema.json` (Draft 2020-12) plus semantic checks (`validateStrokeTopology`, `validateShirorekhaGeometry`). That lets non-programmers (native speakers, teachers) contribute data.
3. **One source of truth for stroke-order rules.** The topology validator lives in `data` and `core` re-exports it, so CI validation and the runtime evaluator can't drift apart.
4. **`trace-all-letters.test.ts`** auto-traces every letter through the real evaluator. It's an excellent regression net for dataset edits.
5. **Authoring tooling (`@akshara/cli`)** with arc-length sampling and its own unit tests. This is the right investment for scaling to numerals and conjuncts.
6. **Pedagogy is encoded, not just displayed.** Shirorekha-last enforcement, SVO-confusion detection, 360° matra placement, and child tolerance mode are real product differentiators.
7. **Good project hygiene for an OSS project:** ROADMAP with estimates, CONTRIBUTING, issue templates, conventional commits, strict TS, ESM with `exports` maps.
8. **Privacy-friendly:** no backend and no tracking. Voice settings stay in `localStorage`.

---

## 3. Cons / tech debt (by severity)

### 🔴 High

| # | Finding | Where | Impact |
|---|---|---|---|
| H1 | **The deploy workflow doesn't deploy.** The `deploy` job only runs `echo`. There is no `output: 'export'`, `basePath`, Pages artifact upload or `actions/deploy-pages`. | `.github/workflows/deploy.yml`, `next.config.mjs` | The live site doesn't exist or is stale, and the README implies otherwise. |
| H2 | **Canvas isn't DPI-aware.** Backing store is a fixed 300×300 with no `devicePixelRatio` scaling. | `TracingCanvas.tsx` | Chalk looks blurry on every iPad and phone, which are the main devices children use. |
| H3 | **Scoring depends on the input device.** `offTrackCount` goes up **per pointer sample**, so a 120 Hz stylus is penalized about 2× more than a 60 Hz mouse for the same mistake. A single topological warning can also fire dozens of times per gesture (and plays dozens of warning sounds). | `tracing-evaluator.ts` (`evaluatePointerSample`), `processPointerSample` | Star ratings are unfair and the audio is noisy. Count *episodes* (enter/exit off-track), not samples, and debounce the warning sound. |
| H4 | **Zero web tests and no linting.** No ESLint/Prettier, no React Testing Library, no Playwright (2.6 is still open). | `packages/web` | ~2.4k LOC of UI with stateful timers and canvas logic has no safety net, and every roadmap feature adds to it. |
| H5 | **Learners can cut corners between waypoints.** Only waypoint proximity is checked, so a straight line between waypoints of a curved stroke passes. | `tracing-evaluator.ts` | Learners can "complete" a curved stroke such as `क`'s loop without drawing the curve. Roadmap 2.1 (Fréchet) fixes this and should be prioritized. |

### 🟠 Medium

| # | Finding | Where |
|---|---|---|
| M1 | **`TracingCanvas.tsx` is an 847-line god component.** It mixes the deck selector, tolerance UI, canvas renderer, particle system, pointer handling, auto-demo scheduler and sidebar. Split it into a `usePatiRenderer` hook, a `useTracingSession` hook, a `useAutoDemo` hook, a `LetterDeck` component and a `StrokeSidebar` component. |
| M2 | **React re-renders on every pointermove.** `setLastEval` and `setProgress` run per sample, and `renderCanvas` runs both imperatively *and* through an effect, so it draws twice per sample. Keep hot state in refs, draw in `requestAnimationFrame`, and push React state only when something meaningful changes (waypoint unlocked, stroke completed). |
| M3 | **Chalk particles never animate.** `vx`, `vy` and `alpha` are set but nothing updates them; they only move when the next pointer event triggers a redraw. Either add a rAF loop or drop the fields. |
| M4 | **Tolerance multipliers are duplicated.** `1.45 / 0.75` is hard-coded in both `MODE_MULTIPLIERS` (core) and the canvas ring rendering. Export `MODE_MULTIPLIERS` or `computeAdaptiveTolerance` and use it in the canvas. |
| M5 | **Magic numbers in viewBox units.** `22`, `15`, `35`, `45` and `4` in `detectPrematureShirorekhaAttempt` assume a 300-unit glyph. Lift them into named constants, ideally scaled from `viewBox`. |
| M6 | **`setMode()` is half-implemented.** It changes the tolerance mode but not `smoothingAlpha`, which was derived from the mode in the constructor. The web app avoids this by rebuilding the evaluator. Fix it or remove it. |
| M7 | **User-facing copy is hard-coded in `core`.** Nepali/English hints are string literals in the evaluator and sentence engine (one duplicated verbatim). Return **message codes plus params** from `core` and localize in the UI. That's a prerequisite for the honorific and Vibhakti features (5.1/5.2) and for a future Hindi/Maithili reuse. |
| M8 | **Stroke registry is hand-maintained.** There are 49 `import` lines, a 49-entry record and a 49-entry list in `data/src/index.ts`. Adding numerals (1.7) means editing three places. Generate an `index.generated.ts` at build time, or keep order in a `manifest.json`. |
| M9 | **The sentence engine assumes one canonical order and 3 tokens.** `isSVOConfusion` only fires when `length === 3`, and the scrambler in `WordSentenceBuilder` special-cases 3 tokens. Nepali allows some legitimate reordering (time/place adverbials). Support `acceptableOrders[]` in `sentences.json` before 5.1 adds postpositions. |
| M10 | **`fuseConsonantWithMatra` silently falls back to `'k'`** for unknown consonants instead of throwing. That hides data bugs. |
| M11 | **The README CI badge is static** (`img.shields.io/badge/CI-Passing`). Use the GitHub Actions status badge. |

### 🟡 Low

- **Accessibility:** no `aria-*`/`role` attributes in any component; the canvas has no text alternative; focus states rely on colour. This matters for a children's education tool.
- **Word tile "shuffle"** is a fixed permutation (`(idx*7 + len*3) % 11`), so the same word always produces the same layout and learners can memorize the positions.
- `segmentDevanagariAksharas` doesn't handle ZWJ/ZWNJ (U+200D/U+200C) or a leading combining mark. Add tests now; Samyukta work (Milestone 3) relies on this function.
- The `@akshara/data` root import pulls in the Ajv-based validation path at type level. Make sure the web bundle doesn't ship Ajv (check with `next build --analyze`).
- No `.nvmrc` or `engines` enforcement in CI beyond Node 20. No Dependabot or Renovate.
- `TracingCanvas` falls back to `STROKE_DATASETS.ka` silently on a bad `initialLetterId`. Log it in dev.

---

## 4. Recommended next work

### Phase A — Harden the base (do first, ~12–15 h)

| Priority | Task | Est. | Unblocks |
|---|---|---|---|
| 1 | Make deploy real: `output: 'export'`, `basePath`, `upload-pages-artifact` + `deploy-pages`, real CI badge (H1, M11) | 1.5 h | Shareable demo for native-speaker reviewers |
| 2 | Add ESLint (`next/core-web-vitals`, `@typescript-eslint`) and Prettier to CI (H4) | 1 h | Every future PR |
| 3 | DPI-aware canvas and an rAF render loop; move hot state to refs; animate or remove particles (H2, M2, M3) | 3 h | 2.4 pressure curves, 2.5 stroke-order guide |
| 4 | Score off-track *episodes*, debounce warning audio, share tolerance constants (H3, M4, M5, M6) | 2 h | Fair mastery data for FSRS (6.1) |
| 5 | Split `TracingCanvas` into hooks and subcomponents (M1) | 3 h | 2.5, 3.4, 6.4 (native port reuses the hooks' logic) |
| 6 | **Pull roadmap 2.6 forward**: Playwright smoke tests (load, trace `क` via synthetic pointer events, matra drop, SOV solve) | 3–4 h | Safe refactors from here on |

### Phase B — Highest-value features (in this order)

1. **2.1 Fréchet / arc-length grading** fixes H5, the biggest gap in pedagogical correctness.
2. **2.5 Stroke-order guide and curve-accurate demo**: the demo currently interpolates linearly between waypoints, so it doesn't follow the real curve. High visible value.
3. **1.7 Numerals**: closes Milestone 1. Do M8 (generated registry) at the same time.
4. **6.1 Local mastery passport plus 6.2 PWA**: cheap, and turns the demo into a daily-use tool (offline rural use is a stated goal). Depends on Phase A #4 for trustworthy scores.
5. **Message codes / i18n in core (M7)**, then **Milestone 5 grammar work**.
6. **Milestone 3 Samyukta** after segmenter hardening and the 3.1 halanta model.

Defer **4.4–4.7** (VOT detection, LPC formants, Klatt synthesizer). They're research-heavy, about 21 h, and have high risk relative to learner value. Recording native audio (4.1/4.2) gives most of the benefit for a fraction of the effort.

---

## 5. Verification notes

- The review was static. `vitest run` in this worktree failed on module resolution because `node_modules` isn't installed here; this is an environment issue, not a code issue. Run `npm ci && npm run build && npm test` to confirm the suite is green.
- Test counts above are `it/test` call counts from grep. `trace-all-letters.test.ts` generates its cases dynamically, so it shows 0.
