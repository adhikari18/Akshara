#!/usr/bin/env node
/**
 * Generates the baseline gesture fixtures in e2e/fixtures/gestures/ from the authored stroke
 * curves: realistic hand speed (~250 px/s), 60 Hz sampling, small seeded jitter, pen pressure
 * ramps — plus deliberate mistakes (headline first, wrong-way loop, gap bridging, cut corners).
 * Human recordings made with `npm run e2e:record` live alongside them with `source: "recorded"`.
 *
 * Requires built packages: npm run build --workspace=@akshara/data --workspace=@akshara/core
 *
 *   node e2e/support/generate-fixtures.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STROKE_DATASETS, NUMERAL_LIST } from '../../packages/data/dist/index.js';
import { sampleStrokeSubpaths } from '../../packages/core/dist/index.js';
import { formatFixture } from './fixture-format.mjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'gestures');
const HZ = 60;
const SPEED = 250; // px/s — a confident child's hand
const STEP = SPEED / HZ;

/** Deterministic PRNG (mulberry32) so regenerated fixtures are byte-identical. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (n) => Math.round(n * 10) / 10;

/** Resample a polyline at constant speed into [x, y, t] samples with ±jitter px of tremor. */
function timed(points, { jitter = 0.6, seed = 1, pen = null } = {}) {
  const rand = rng(seed);
  const out = [];
  let carried = 0;
  let t = 0;
  const push = (x, y) => {
    const jx = (rand() - 0.5) * 2 * jitter;
    const jy = (rand() - 0.5) * 2 * jitter;
    const sample = [round(x + jx), round(y + jy), Math.round(t)];
    if (pen) {
      const p = pen(out.length);
      sample.push(round(p.pressure * 100) / 100, p.tiltX ?? 0, p.tiltY ?? 0);
    }
    out.push(sample);
    t += 1000 / HZ;
  };
  push(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    let d = STEP - carried;
    while (d <= len) {
      const k = d / len;
      push(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k);
      d += STEP;
    }
    carried = len - (d - STEP);
  }
  const last = points[points.length - 1];
  push(last.x, last.y);
  // Settle on the end point briefly, as a hand does before lifting
  for (let i = 0; i < 3; i++) push(last.x, last.y);
  return out;
}

/** One gesture per subpath of a stroke (the hand lifts over a split headline). */
const strokeGestures = (stroke, seed, options = {}) =>
  sampleStrokeSubpaths(stroke, 2).map((pts, i) => ({
    pointerType: options.pen ? 'pen' : 'mouse',
    points: timed(pts, { seed: seed + i, pen: options.pen }),
  }));

const faithful = (dataset, seed = 1) =>
  dataset.strokes.flatMap((s, i) => strokeGestures(s, seed + i * 10));

const line = (x0, y0, x1, y1, n = 40) =>
  Array.from({ length: n + 1 }, (_, i) => ({
    x: x0 + ((x1 - x0) * i) / n,
    y: y0 + ((y1 - y0) * i) / n,
  }));

const fixtures = [];
const add = (f) => fixtures.push({ version: 1, source: 'generated', level: 'Easy', ...f });

// ---- faithful traces ---------------------------------------------------------------------
const ka = STROKE_DATASETS.ka;
add({
  name: 'ka-faithful',
  description: 'क traced along every curve with a mouse: all four strokes complete and chalk.',
  target: { kind: 'letter', id: 'ka' },
  gestures: faithful(ka),
  expect: { strokesDone: 4, complete: true, inkOnStrokes: [0, 1, 2, 3] },
});

const dha = STROKE_DATASETS.dha;
add({
  name: 'dha-faithful-lift-over-gap',
  description: 'ध with the split Shirorekha drawn as two spans (pen lifted over the gap).',
  target: { kind: 'letter', id: 'dha' },
  gestures: faithful(dha, 5),
  expect: {
    strokesDone: dha.strokes.length,
    complete: true,
    inkOnStrokes: dha.strokes.map((_, i) => i),
  },
});

const tha = STROKE_DATASETS.tha;
add({
  name: 'tha-faithful-partial-headline',
  description: 'थ, whose Shirorekha is a short bar on the right.',
  target: { kind: 'letter', id: 'tha' },
  gestures: faithful(tha, 9),
  expect: {
    strokesDone: tha.strokes.length,
    complete: true,
    inkOnStrokes: tha.strokes.map((_, i) => i),
  },
});

add({
  name: 'num-0-faithful',
  description: '० traced on the Numbers page.',
  target: { kind: 'number', value: 0 },
  gestures: faithful(NUMERAL_LIST[0], 13),
  expect: { strokesDone: 1, complete: true, inkOnStrokes: [0] },
});

// ---- pen pressure: live trail width follows pressure --------------------------------------
// Stroke 1 with a mouse, then क's stem with a pen whose pressure ramps 0.1 → 1.0; the pen is
// held just before the final ring so the live (pressure-width) trail is still on the slate.
const stemTop = 75;
const stemHoldY = 195;
add({
  name: 'ka-pen-pressure-trail-width',
  description:
    'Pen pressure modulates the live chalk width: thin at a light touch, thick when pressing.',
  target: { kind: 'letter', id: 'ka' },
  gestures: [
    ...strokeGestures(ka.strokes[0], 21),
    {
      pointerType: 'pen',
      release: false,
      points: timed(line(150, stemTop, 150, stemHoldY), {
        jitter: 0,
        // pressure follows position down the stem: 0.1 at the top → 1.0 at the hold point
        pen: (i) => ({ pressure: Math.min(1, 0.1 + (0.9 * i * STEP) / (stemHoldY - stemTop)) }),
      }),
    },
  ],
  expect: {
    strokesDone: 1,
    probes: [
      // Probes sit between the stem's waypoint dots (y = 75, 130, 185) so a dot never hides ink
      { x: 150, y: 100, ink: 'chalk', note: 'trail centre under a light touch' },
      { x: 157.5, y: 100, ink: 'none', note: 'light touch: thin chalk does not reach 7.5 px' },
      { x: 150, y: 165, ink: 'chalk', note: 'trail centre while pressing hard' },
      { x: 157.5, y: 165, ink: 'chalk', note: 'firm pressure: thick chalk reaches 7.5 px' },
    ],
  },
});

// ---- deliberate mistakes ------------------------------------------------------------------
add({
  name: 'ka-headline-first',
  description: 'Drawing the Shirorekha before the body triggers the topology guardrail.',
  target: { kind: 'letter', id: 'ka' },
  gestures: [{ pointerType: 'mouse', points: timed(line(60, 75, 240, 75)) }],
  expect: { strokesDone: 0, complete: false, hint: 'शिरोरेखा.*अन्त्यमा मात्र', noInkOnStrokes: [3] },
});

add({
  name: 'ka-loop-backward',
  description: "क's loop traced backwards from its end: the winding detector stops it.",
  target: { kind: 'letter', id: 'ka' },
  gestures: [
    {
      pointerType: 'mouse',
      release: false,
      points: timed([...sampleStrokeSubpaths(ka.strokes[0], 2)[0]].reverse(), { seed: 31 }),
    },
  ],
  expect: { strokesDone: 0, complete: false, hint: 'Wrong way round', noInkOnStrokes: [0] },
});

add({
  name: 'dha-bridge-gap',
  description: "ध's headline dragged straight across its gap: the learner is asked to lift.",
  target: { kind: 'letter', id: 'dha' },
  gestures: [
    ...dha.strokes.slice(0, -1).flatMap((s, i) => strokeGestures(s, 41 + i * 10)),
    { pointerType: 'mouse', release: false, points: timed(line(62, 75, 237, 75), { jitter: 0 }) },
  ],
  expect: {
    strokesDone: dha.strokes.length - 1,
    complete: false,
    hint: 'The headline has a gap',
    noInkOnStrokes: [dha.strokes.length - 1],
  },
});

const uu = STROKE_DATASETS.uu;
const uuCurl = uu.strokes[0];
add({
  name: 'uu-corner-cut',
  description:
    "ऊ's first curl drawn as straight dot-to-dot lines (Medium): the corner cut is caught.",
  target: { kind: 'letter', id: 'uu' },
  level: 'Medium',
  gestures: [
    {
      pointerType: 'mouse',
      release: false,
      points: timed(
        uuCurl.waypoints.flatMap((w, i, all) =>
          i === 0 ? [{ x: w.x, y: w.y }] : line(all[i - 1].x, all[i - 1].y, w.x, w.y, 10).slice(1)
        ),
        { jitter: 0 }
      ),
    },
  ],
  expect: { strokesDone: 0, complete: false, hint: "Don't cut the corner" },
});

// ---- write --------------------------------------------------------------------------------
mkdirSync(OUT, { recursive: true });
for (const f of fixtures) {
  writeFileSync(join(OUT, `${f.name}.json`), formatFixture(f));
}
console.log(`✓ Wrote ${fixtures.length} gesture fixtures to e2e/fixtures/gestures/`);
