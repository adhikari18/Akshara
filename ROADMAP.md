# `Akshara` (अक्षर) Learning Platform Engineering Roadmap (~486 Hours Planned)

This document outlines the multi-milestone roadmap for growing `Akshara` beyond the `v0.1.0` literacy studio into a local-first Nepali learning platform. The end state combines computational linguistics, adaptive instruction, durable learner progress, classroom tools, offline operation, and cloud-ready synchronization while preserving the existing tracing engine and reusable data packages.

The estimates are planning ranges, not promises. They include integration, tests, accessibility, documentation, debugging, and roughly 30–40% contingency because the difficult work is usually at the boundaries between storage, synchronization, curriculum, and UI. Completed milestones retain their original estimates; new work uses broader 8–14 hour slices.

## Execution Constraints and Architecture Boundary

All core milestones must be buildable and verifiable on a disconnected development machine. The project must not require a live cloud account, production service, real learner data, sound device, native mobile emulator, or internet access to demonstrate success.

- Browser clients store progress locally in IndexedDB and continue working offline.
- A localhost Node API and SQLite database stand in for the future hosted control plane.
- A filesystem-backed object-store adapter stands in for future cloud object storage.
- Synthetic learners, classrooms, assignments, and device identities are used in tests and demos.
- Storage and sync use explicit interfaces so hosted PostgreSQL/object-storage adapters can be added later without changing the learning domain.
- The responsive PWA is the session's mobile deliverable. Native React Native/Expo and real cloud deployment are post-session production work.
- Audio research remains part of the product vision, but fixtures and deterministic signal tests—not a microphone or speakers—are the acceptance path on the disconnected desktop.

## Progress Overview

| Milestone | Focus | Est. Hours | Done | Progress |
|---|---|---|---|---|
| 1 | Devanagari Vector Stroke Dataset | ~35 | 35 | 100% |
| 2 | Computational Geometry, Stroke-Order Guide & Motor-Control Engine | ~25 | 25 | 100% |
| 3 | *Samyukta Akshara* & *Barakhari* Typography | ~34 | 0 | 0% |
| 4 | Audio Corpus, Speech DSP & Pronunciation Grading | ~60 | 0 | 0% |
| 5 | SOV Grammar, *Vibhakti* & Story Reader | ~48 | 0 | 0% |
| 6 | Curriculum, Learner Profiles & Adaptive Review | ~56 | 0 | 0% |
| 7 | Local-First Storage, Backup & Cloud-Ready Sync | ~72 | 0 | 0% |
| 8 | Classroom, Parent/Teacher Insights & Content Packs | ~52 | 0 | 0% |
| 9 | Offline PWA, Reliability, Accessibility & Scale | ~44 | 0 | 0% |
| 10 | Production Cloud & Native Mobile (post-session) | ~60 | 0 | 0% |
| **Total** | | **~486** | **60** | **~12%** |

---

## Milestone 1: Complete 49-Letter Devanagari Vector Stroke Dataset + Numerals (`packages/data/strokes/`) (~35 hrs)

`packages/data/strokes/` now provides vector definitions for all 49 letters—the 13 *Swor Varna* (`अ` to `अः`) and the 36 *Vyanjan Varna* (`क` to `ज्ञ`)—plus all 10 Nepali numerals, enforced by `npm run validate:data`. This milestone completed the canonical `300x300` vector stroke and waypoint corpus across the entire Nepali Varnamala (13 vowels + 33 consonants + 3 compounds = 49 letters):

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
- [x] **1.7 Nepali Devanagari Numerals (`०` to `९` / सुन्ना देखि नौ) (~5 hrs):**
  - Add a `numerals` category to `letter.schema.json` and author single- and multi-stroke tracing definitions for Nepali numerals `०, १, २, ३, ४, ५, ६, ७, ८, ९`.
  - Done: `category: "numeral"` (headline-free: no `shirorekha` block or stroke, a single stroke allowed), `strokes/num-0.json` … `num-9.json` (६ is two strokes), registered under `numerals` in `stroke-manifest.json`, plus `numbers.json` with Nepali names for ० – १००. The web studio's **अङ्क • Numbers** tab traces any number 0 – 100 digit by digit. Stroke shapes and names await native-speaker review.

---

## Milestone 2: Computational Geometry, Stroke-Order Guide & Adaptive Motor-Control Engine (`packages/core/`, `packages/web/`) (~25 hrs)

- [x] **2.1 Discrete Fréchet Distance & Uniform Arc-Length Resampling (~5 hrs):**
  - Implement uniform arc-length polyline resampling (`resampleByArcLength`) and dynamic-programming Discrete Fréchet Distance (`discreteFrechetDistance`) in `packages/core/src/tracing-evaluator.ts` to grade continuous curve fidelity alongside waypoint unlocks.
  - Done: both exported from `@akshara/core`. Each completed stroke is graded (`StrokeStepEvaluation.strokeFidelity`, `TracingProgressSummary.strokeFidelities` / `meanFrechetDistance`); the trail and authored curve are resampled to the same arc-length grid, so the grade is pointer-rate independent, and only the Fréchet distance beyond the path tolerance lowers the accuracy score (≤ 15 pts). The web studio shows it as "Curve fit" in the grown-ups panel.
- [x] **2.2 Tangent-Angle Directional Enforcement & Loop Winding Detector (~4 hrs):**
  - Compute signed turning angles ($\sum \Delta \theta$) along `loop` strokes (`क`, `ख`, `छ`, `ठ`, `ढ`) to verify that learners trace counter-clockwise vs. clockwise loops in the authentic hand-movement direction rather than tracing backward.
  - Done: `signedTurningAngle`, `cumulativeTurningProfile` and `loopWindingOf` in `@akshara/core` (arc-length resampled, so jitter- and rate-independent; 180° retrace cusps ignored). Enforcement is keyed to geometry, not stroke type: every stroke whose authored curve turns ≥ 180° one way (41 strokes, incl. क ख छ ठ, the `curve`-typed body of ढ, ० and ४) is checked. Turning more than 90° further against the winding than the curve itself ever does raises one `wrong-direction` mistake, blocks further dots, and lifting the pen restarts the stroke at dot 1. The measurement also exposed wrong `directionHint`s on ग, इ, ई (open loops misread by the CLI's shoelace inference) and ऋ; the data is fixed and the CLI now infers loop winding from turning angle.
- [x] **2.3 Broken-*Shirorekha* Evaluator & Renderer Support (split `ध`; partial `थ`, `भ`) (~4 hrs):**
  - In classical Devanagari typography, characters with an upper-left open loop leave a gap in the *Shirorekha* above the loop so the glyph does not visually collapse into another letter (e.g., `ध` vs. `घ`, `भ` vs. `म`). Teach the evaluator and `TracingCanvas.tsx` ghost-guides to validate and render the split headline spans defined in 1.3.
  - Done: the slate's headline guide now follows the letter's real spans (short for थ/भ, two spans with a dotted "hop" over the gap for ध); the ghost path already followed the `svgPath` subpaths. The evaluator raises a `lift-over-gap` mistake when the pen is dragged across a gap at headline height (also for a fast pointer that jumps it in one sample), keeps the dots locked until the pen lifts, then resumes from the span before the gap. The premature-Shirorekha rule now uses the real spans, so sweeping left of थ's short bar is no longer "drawing the headline early". The "Show me" demo and the faithful-trace tests lift between subpaths (`sampleStrokeSubpaths`).
- [x] **2.4 Velocity-Adaptive 1€ Filter & Stylus Pressure Curves (~4 hrs):**
  - Upgrade the Exponential Moving Average (EMA) smoother to a velocity-adaptive **1€ Filter** (Casiez et al.) and incorporate `PointerEvent.pressure` and `tiltX/tiltY` to modulate chalk stroke width dynamically.
  - Done: `OneEuroFilter` / `OneEuroPointFilter` in `@akshara/core` (per-mode profiles in `ONE_EURO_PROFILES`, follow `setMode()`, reset on pen lift, real-time dt from pointer timestamps with a nominal fallback for coalesced events). At the child profile a ±3 px tremor becomes ±0.2 px while lag stays 8–43 ms. The legacy EMA remains behind `smoothingAlpha` for tests. `Point2D` carries `pressure` / `tiltX` / `tiltY`; `chalkWidthFor` maps them to a chalk width (light touch ≈ 0.55×, mouse 1×, firm 1.35×, 90° tilt up to 1.5×) and the slate draws the live trail with per-segment width; chalk dust scales with it.
- [x] **2.5 Full-Letter Stroke-Order Guide, Directional Arrows & Curve-Accurate Demo Replay (~4 hrs):**
  - Add a full-letter **"Stroke Order Guide"** mode to `TracingCanvas.tsx` displaying color-coded strokes, numbered start-point badges (`①, ②, ③…` / `१, २, ३…`), and tangent directional arrows along each SVG path. Upgrade **Auto-Trace Demo** to sample along true cubic Bézier curves (`svgPath`) with play/pause, step-by-stroke, and speed controls (`0.5× / 1× / 2×`) without resetting the learner's active `TracingEvaluator` progress, and surface bilingual stroke instructions (`nepaliInstruction` + `englishInstruction`) in the Stroke Order sidebar.
  - Done: a **Stroke order guide** toggle on the slate overlays every stroke in its own colour with tangent arrows along the true curve and a Devanagari-numbered start badge (१, २, ३ …; the Shirorekha is always amber; strokes already drawn are dimmed). **Show me** is now a pure teacher-chalk replay along the Bézier curves (`sampleStrokeSubpaths`), lifting between strokes and over Shirorekha gaps, with play/pause, previous/next stroke and 0.5× / 1× / 2× speed — it never touches the learner's `TracingEvaluator`; drawing on the slate simply pauses it. The sidebar shows the stroke order with `nepaliInstruction` + `englishInstruction`, colour-matched to the slate; tapping a stroke replays it.
- [x] **2.6 Baseline Playwright Canvas Regression Harness (~4 hrs):**
  - Stand up Playwright in CI with synthetic pointer-gesture fixtures replaying recorded strokes on `TracingCanvas.tsx` and drag-and-drop on `MatraBuilder.tsx`, so every later milestone ships with regression coverage.
  - Done: data-driven gesture fixtures (`e2e/fixtures/gestures/*.json`: pointer samples with timing, pen pressure/tilt, and the expected outcome) replayed through CDP input at recorded timing; a recorder (`npm run e2e:record`) turns a real drawing into a fixture. Canvas assertions read slate pixels ("ink probes": chalk along traced curves, pen-width taper, guide colours, teacher chalk) — OS-independent, unlike screenshot baselines. Every replay also asserts the slate never moves under the finger; this caught a real bug (the hint bubble resized mid-stroke and shifted the canvas up to 48 px), now fixed. `MatraBuilder` drag-and-drop is covered (drop, drag-over highlight, drops elsewhere, every matra). CI runs the suite against the static export and uploads the HTML report and traces on failure.

---

## Milestone 3: *Samyukta Akshara* (Conjunct Ligatures) & *Barakhari* Typography Engine (~34 hrs)

- [ ] **3.1 *Halanta* (`्`) & Half-Consonant (*आधा अक्षर*) Morphological Engine (~8 hrs):**
  - Extend `packages/core/src/matra-engine.ts` to model how each of the 33 base consonants (plus the compounds `क्ष` and `ज्ञ`) transforms when stripped of its inherent vowel (`क ➔ क्`, `ग ➔ ग्`, `च ➔ च्`, `त ➔ त्`, `स ➔ स्`), distinguishing vertical-stem-dropping consonants from bottom-virama consonants (`ङ, छ, ट, ठ, ड, ढ, द, ह`).
- [ ] **3.2 Special *Rakar* (`्र`), *Repha* (`र्`), and *Rukar* (`रु / रू`) Ligature Rules (~8 hrs):**
  - Model the three distinct orthographic behaviors of `र` in Nepali clusters:
    1. Preceding `र` + consonant ➔ top *Repha* hook (`र् + म = र्म` in `धर्म`).
    2. Consonant + following `र` ➔ bottom diagonal *Paden Rakar* (`प + ् + र = प्र`, `ट + ् + र = ट्र`).
    3. Irregular `र + ु = रु` and `र + ू = रू` belly attachment (instead of bottom foot attachment).
- [ ] **3.3 Interactive *Samyukta Akshara* Ligature Fusion Playground (`SamyuktaBuilder.tsx`) (~10 hrs):**
  - Build an interactive drag-and-drop conjunct studio where learners slice the vertical *Khadi Pai* stem off a consonant and weld it to a second consonant (`स + ् + क + ू + ल = स्कूल`, `न + म + स् + ते = नमस्ते`). Add Playwright coverage to the 2.6 harness.
- [ ] **3.4 Tracing Vectors for Composite *Matra* Diacritics on the *Pati* Slate (~8 hrs):**
  - Allow learners to trace composite consonant+matra syllables directly on `TracingCanvas.tsx` (e.g., tracing `क` followed by the left-standing arch of `ि` to write `कि`, or bottom curls `ु / ू` for `कु / कू`).

---

## Milestone 4: Audio Corpus, Web Audio Speech DSP, Formant Synthesis & Pronunciation Grading (~60 hrs)

- [ ] **4.1 Native-Speaker Audio Corpus Recording & Annotation (~10 hrs):**
  - Record, trim, and loudness-normalize native Nepali speaker audio for all 49 letters, core *Barakhari* syllables, and starter vocabulary; annotate syllable onset timings and document a contributor recording guide.
- [ ] **4.2 IndexedDB Audio Sprite Loader & Phoneme Timing Synchronizer (~8 hrs):**
  - Build an offline-capable Web Audio asset manager that decodes multi-syllable `.opus`/`.mp3` audio sprites (from 4.1) into `AudioBuffer` slices and synchronizes syllable highlighting during word and sentence playback.
- [ ] **4.3 Minimal-Pair Phonetic Contrast Drills (Aspiration & Retroflexion) (~8 hrs):**
  - Build an interactive listening and speaking discrimination module targeting the two hardest phonetic contrasts for English-dominant diaspora children:
    - **Voiceless vs. Aspirated vs. Voiced vs. Breathy-Voiced:** `क (ka)` vs. `ख (kha)` vs. `ग (ga)` vs. `घ (gha)`.
    - **Dental vs. Retroflex:** `त (ta - tongue on teeth)` vs. `ट (tta - tongue curled back to palate)`.
- [ ] **4.4 Microphone Voice-Onset-Time (VOT) Aspiration Detector (~9 hrs):**
  - Implement client-side Web Audio FFT burst/energy analysis to estimate Voice Onset Time and detect aspiration for `ख, छ, ठ, थ, फ`, robust to children's higher-pitched voices and background noise.
- [ ] **4.5 LPC Formant (`F1/F2`) Vowel Analyzer & Visual Feedback (~9 hrs):**
  - Implement LPC-based `F1/F2` formant estimation to distinguish vowel qualities (e.g., `अ /ʌ/` vs. `आ /aː/`) and render real-time visual feedback when learners practice aloud.
- [ ] **4.6 Offline Klatt-Style Formant Synthesizer Core (Vowels) (~8 hrs):**
  - Expand `packages/web/src/lib/audio.ts` with a deterministic cascade formant synthesizer modeling `F1/F2/F3` resonant filters for the ~6 Nepali oral vowel phonemes (and nasalized variants) underlying the 13 vowel letters.
- [ ] **4.7 Formant Synthesizer Consonant Bursts & Transitions (~8 hrs):**
  - Add stop bursts, aspiration noise, nasal murmurs, and formant transitions for the 33 consonants so the synthesizer can serve as a fallback when native audio files or OS `ne-NP` TTS voices are unavailable.

---

## Milestone 5: Progressive SOV Grammar, Postpositions (*Vibhakti*) & Story Reader (~48 hrs)

- [ ] **5.1 Nepali Case Postpositions (*विभक्ति / Vibhakti*: `ले, लाई, मा, बाट, को`) Builder (~8 hrs):**
  - Extend `packages/core/src/sentence-engine.ts` to teach ergative/instrumental `ले` (`रामले भात खायो`), dative `लाई` (`आमालाई फूल देऊ`), locative `मा` (`घरमा`), ablative `बाट` (`घरबाट`), and genitive `को/का/की` (`रामको किताब`).
- [ ] **5.2 Verb Honorific & Subject-Verb Agreement Matrix (`तिमी / तपाईं / ऊ / उनीहरू`) (~8 hrs):**
  - Build an interactive conjugation matcher teaching Nepali honorific tiers (`छौ / हुनुहुन्छ / छ / छन्`) and gender/plurality agreement (`जान्छ` vs. `जान्छिन्` vs. `जानुहुन्छ`).
- [ ] **5.3 Tap-to-Decode Story Reader Engine (*कथा पाटी*) (~8 hrs):**
  - Build the story reader component where tapping any word decomposes it into its constituent *Barakhari* aksharas (`क + छु + वा = कछुवा`), then into consonant + matra parts (`छु = छ + ु`), and plays synchronized audio.
- [ ] **5.4 Graded Micro-Story Content Authoring & Illustration (~8 hrs):**
  - Author 10 graded 5-sentence Nepali folk and nature micro-stories with vocabulary leveled to the letter/matra progression, and source or commission CC-licensed illustrations.
- [ ] **5.5 Story Narration Audio & Word-Timing Alignment (~8 hrs):**
  - Record native-speaker narration for the 10 stories and align word-level timestamps for read-along highlighting.
- [ ] **5.6 Printable PDF Practice Worksheets (*अभ्यास पुस्तिका*) Generator (~8 hrs):**
  - Generate customizable A4/Letter printable dotted-line Devanagari handwriting worksheets from `packages/data/strokes/*.json` so parents and teachers can print offline practice sheets.

---

## Milestone 6: Curriculum, Learner Profiles & Adaptive Review (~56 hrs)

- [ ] **6.1 Versioned Curriculum and Skill-Graph Schema (~10 hrs):**
  - Define courses, units, lessons, activities, prerequisites, learning objectives, and content versions in `@akshara/data`. Validate referential integrity, reject prerequisite cycles, and provide a deterministic migration path when lesson content changes.
- [ ] **6.2 Privacy-Preserving Local Learner Profiles (~8 hrs):**
  - Support multiple named synthetic/local profiles on a shared device without email, birth date, or other PII. Keep profile identity separate from mastery data and make deletion complete and testable.
- [ ] **6.3 Normalized Attempt and Mastery Event Model (~10 hrs):**
  - Convert tracing accuracy, *Matra* errors, word attempts, grammar choices, hints, and lesson completion into append-only domain events. Derive current progress from events so storage, analytics, and synchronization share one source of truth.
- [ ] **6.4 FSRS-Inspired Review Scheduler and Skill Dependencies (~12 hrs):**
  - Schedule personalized five-minute reviews using recall history, stroke accuracy, confusion pairs, and prerequisite skills. Inject a clock and seeded random source so every scheduling decision is deterministic in tests.
- [ ] **6.5 Learner Journey, Daily Goal and Mastery Passport UI (~8 hrs):**
  - Add a course map, next-lesson recommendation, daily review queue, streak-free motivational progress, and explainable mastery details suitable for children and supervising adults.
- [ ] **6.6 Curriculum and Scheduler Verification Suite (~8 hrs):**
  - Add property-based invariants for prerequisite ordering and scheduling, fixture-based migration tests, and Playwright journeys covering first use, practice, review, profile switching, and profile deletion.

**Milestone acceptance:** a new synthetic learner can complete a sequenced lesson, accumulate mastery events, receive a deterministic review plan, switch profiles without data leakage, and resume after a reload.

---

## Milestone 7: Local-First Storage, Backup & Cloud-Ready Synchronization (~72 hrs)

- [ ] **7.1 Storage Ports and IndexedDB Repository (~10 hrs):**
  - Introduce repository interfaces for profiles, curriculum, events, snapshots, and content assets. Implement IndexedDB transactions, indexes, schema migrations, quota/error handling, and an in-memory adapter for fast tests.
- [ ] **7.2 Local Node API and SQLite Control Plane (`packages/server/`) (~12 hrs):**
  - Build a localhost HTTP API backed by SQLite for synthetic accounts, devices, progress events, classrooms, and content manifests. Provide migrations, health checks, structured errors, and a one-command seed/reset workflow.
- [ ] **7.3 Durable Outbox and Incremental Sync Protocol (~12 hrs):**
  - Queue offline mutations with stable event IDs, upload idempotently, pull by opaque cursor, retry with bounded backoff, and retain acknowledged events until compaction is safe.
- [ ] **7.4 Multi-Device Conflict Resolution (~12 hrs):**
  - Define merge rules for append-only attempts, profile settings, assignments, and content versions. Surface conflicts that cannot be merged automatically and prove convergence independent of delivery order.
- [ ] **7.5 Filesystem Object Store and Content-Addressed Assets (~8 hrs):**
  - Implement a local object-storage adapter for curriculum packs, worksheet exports, and audio fixtures using hashes, manifests, atomic writes, integrity verification, and orphan cleanup. Keep the interface compatible with a future hosted object store.
- [ ] **7.6 Encrypted Export, Import and Disaster Recovery (~8 hrs):**
  - Export a portable learner archive, validate it before import, support dry-run/replace/merge modes, reject corrupt or incompatible archives, and document recovery from a damaged local database.
- [ ] **7.7 Fault-Injection and Convergence Harness (~10 hrs):**
  - Simulate two browser devices plus the local server under duplicate delivery, reordering, dropped requests, clock skew, restarts, and long offline periods. Assert no acknowledged completion disappears and all replicas converge.

**Milestone acceptance:** two simulated devices can work independently offline, reconnect in either order, and converge to the same mastery state without duplicating attempts or losing acknowledged progress. Backup/restore reproduces the same event-log checksum.

---

## Milestone 8: Classroom, Parent/Teacher Insights & Content Packs (~52 hrs)

- [ ] **8.1 Synthetic Classroom, Roster and Assignment Domain (~10 hrs):**
  - Model classrooms, invitations, assignments, due windows, accommodations, and learner membership using generated identities only. Enforce boundaries so one classroom cannot read another classroom's records.
- [ ] **8.2 Assignment and Guided Practice Experience (~8 hrs):**
  - Let a teacher assign lessons or skill reviews and let a learner see, download, complete, and synchronize assigned work while offline.
- [ ] **8.3 Explainable Progress Dashboard (~10 hrs):**
  - Show mastery by skill, common confusion pairs, recent effort, assignment completion, and recommended intervention. Every aggregate must link back to its underlying synthetic attempt events and clearly distinguish “not attempted” from “needs practice.”
- [ ] **8.4 Versioned Curriculum Content Packs (~10 hrs):**
  - Define signed-manifest-style local packages containing lessons, vocabulary, stories, stroke data references, and assets. Validate compatibility and checksums, preview changes, install atomically, and roll back a broken update.
- [ ] **8.5 Content Authoring and Preview Tools (~8 hrs):**
  - Add a localhost authoring surface or CLI for assembling lessons, validating Nepali text and references, previewing learner activities, and exporting reproducible content packs.
- [ ] **8.6 Classroom Isolation and Reporting Tests (~6 hrs):**
  - Seed multiple classrooms and hundreds of synthetic learners; verify authorization boundaries, assignment lifecycle, aggregate accuracy, CSV/PDF export, and accessible dashboard navigation.

**Milestone acceptance:** a teacher can install a curriculum pack, assign a lesson to a synthetic class, observe locally synchronized results, inspect the evidence behind a recommendation, and export a report without any external account or service.

---

## Milestone 9: Offline PWA, Reliability, Accessibility & Scale (~44 hrs)

- [ ] **9.1 Installable Offline-First PWA (~8 hrs):**
  - Add a manifest and versioned service worker that pre-caches the application shell and selected content packs, provides an explicit offline state, and upgrades caches without stranding learner data.
- [ ] **9.2 Responsive Phone and Tablet Learning Experience (~8 hrs):**
  - Adapt navigation, tracing, lesson, story, and review surfaces for touch-first phone/tablet layouts while retaining stylus pressure where the browser exposes it. Treat this PWA as the session's mobile deliverable.
- [ ] **9.3 Accessibility and Reduced-Motion Pass (~8 hrs):**
  - Provide keyboard alternatives to pointer interactions, semantic labels, focus management, high-contrast and reduced-motion modes, scalable text, and non-audio equivalents for essential instruction.
- [ ] **9.4 Observability, Diagnostics and Safe Data Repair (~6 hrs):**
  - Add structured local logs with redaction, sync diagnostics, storage-health checks, exportable support bundles containing synthetic/non-sensitive data, and guarded repair operations.
- [ ] **9.5 Performance Budgets and Large Synthetic Dataset Tests (~6 hrs):**
  - Set measurable budgets for startup, lesson navigation, tracing responsiveness, review selection, sync, and dashboard queries using generated multi-year learner histories.
- [ ] **9.6 Full Offline and Upgrade Regression Matrix (~8 hrs):**
  - Expand Playwright coverage across fresh install, cached reload, server loss, reconnect, service-worker upgrade, IndexedDB migration, backup restore, multiple tabs, and phone/tablet viewports.

**Milestone acceptance:** the complete learning journey remains usable with the local API stopped, survives application and schema upgrades, meets documented accessibility checks, and passes the offline/upgrade regression suite against a large generated dataset.

---

## Milestone 10: Production Cloud & Native Mobile (Post-Session) (~60 hrs)

This milestone records the intended production path but is not required to demonstrate the project in a disconnected coding session.

- [ ] **10.1 Hosted Database and Object-Storage Adapters (~12 hrs):**
  - Implement hosted adapters behind the repository and object-store contracts, with migrations, lifecycle policies, checksums, and integration tests against local stand-ins before any real deployment.
- [ ] **10.2 Authentication, Guardianship and Privacy Review (~12 hrs):**
  - Design adult-managed accounts, child profiles, consent, retention, account export/deletion, rate limits, and abuse controls. Do not migrate real learner data until this design has been reviewed independently.
- [ ] **10.3 Deployment, Backups and Restore Drills (~10 hrs):**
  - Add reproducible infrastructure configuration, staged releases, database backups, asset-version rollback, secret handling, and regularly tested restore procedures.
- [ ] **10.4 React Native / Expo Workspace and Shared Domain Layer (~10 hrs):**
  - Create `packages/mobile/` only after the PWA and sync contracts stabilize. Reuse `@akshara/core`, `@akshara/data`, curriculum, mastery, and sync logic while keeping platform UI adapters separate.
- [ ] **10.5 Native Tracing and Offline Storage Parity (~10 hrs):**
  - Port the tracing surface with low-latency gestures and stylus input, then run shared evaluator fixtures and sync scenarios against both web and native storage adapters.
- [ ] **10.6 Production Readiness and Cross-Platform Release Gates (~6 hrs):**
  - Require migration rehearsal, restore proof, privacy checks, dependency review, crash-free smoke tests, and behavioral parity for critical learner journeys before a staged release.

---

## Project-Level Success Bar

The learning-platform phase is successful when all of the following can be demonstrated locally with generated data:

1. Multiple learners progress through a versioned prerequisite-based curriculum and receive explainable adaptive reviews.
2. Two simulated devices make progress offline and later converge without losing or duplicating acknowledged work.
3. A teacher assigns work, reviews evidence-backed progress, and exports reports without accessing another classroom's data.
4. Curriculum packs and learner backups validate, import, upgrade, and roll back safely.
5. The PWA completes the core journey offline at phone, tablet, and desktop viewports with keyboard-accessible alternatives.
6. Unit, property, migration, fault-injection, and Playwright suites pass from a clean checkout without live cloud services, real accounts, sound hardware, Docker, or internet access.
