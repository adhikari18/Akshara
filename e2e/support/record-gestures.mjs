#!/usr/bin/env node
/* global document, window -- used inside page.evaluate callbacks, which run in the browser */
/**
 * Record real pointer gestures on the Pati slate into a regression fixture.
 *
 * Opens a headed Chromium on the running studio (start it with `npm run dev` first), selects the
 * letter or number, and captures every pointer sample on the slate — logical coordinates,
 * timing, pointer type, pen pressure and tilt. Press Enter in this terminal when done: the
 * outcome now on screen (done strokes, celebration, hint) is written as the fixture's
 * expectation, so the recording becomes a regression test immediately.
 *
 *   npm run e2e:record -- <name> --letter ka [--level Easy|Medium|Hard] [--url http://localhost:3000]
 *   npm run e2e:record -- <name> --number 42
 *
 * `--simulate <fixture>` replays an existing fixture instead of waiting for a human (used to
 * verify the recorder itself).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { formatFixture } from './fixture-format.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'fixtures', 'gestures');
const STROKES = join(here, '..', '..', 'packages', 'data', 'strokes');

function parseArgs(argv) {
  const args = { name: argv[0], url: 'http://localhost:3000', level: 'Easy' };
  for (let i = 1; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, '');
    args[key] = argv[++i];
  }
  if (!args.name || (!args.letter && args.number === undefined)) {
    console.error(
      'Usage: npm run e2e:record -- <name> --letter <id> | --number <n> [--level Easy]'
    );
    process.exit(1);
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const DIGITS = '०१२३४५६७८९';
const toDevanagari = (n) =>
  String(n)
    .split('')
    .map((d) => DIGITS[Number(d)])
    .join('');

const browser = await chromium.launch({ headless: Boolean(args.simulate) });
const page = await browser.newPage({ viewport: { width: 1280, height: 1600 } });
await page.goto(args.url);

if (args.letter) {
  const letter = JSON.parse(readFileSync(join(STROKES, `${args.letter}.json`), 'utf8'));
  await page
    .getByRole('button', {
      name: `${letter.character} (${letter.phonetics.romanized})`,
      exact: true,
    })
    .click();
} else {
  await page.getByRole('tab', { name: /अङ्क/ }).click();
  const v = Number(args.number);
  await page.getByRole('button', { name: new RegExp(`^${toDevanagari(v)} \\(${v}\\)`) }).click();
}
await page.getByRole('radio', { name: new RegExp(args.level) }).click();

// Capture pointer samples on the slate, in its 300×300 logical space.
await page.evaluate(() => {
  const canvas = document.querySelector('canvas[role="img"]');
  const gestures = [];
  let current = null;
  let t0 = 0;
  const sample = (e) => {
    const r = canvas.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * 3000) / 10;
    const y = Math.round(((e.clientY - r.top) / r.height) * 3000) / 10;
    const t = Math.round(e.timeStamp - t0);
    return e.pointerType === 'pen'
      ? [x, y, t, Math.round(e.pressure * 100) / 100, e.tiltX || 0, e.tiltY || 0]
      : [x, y, t];
  };
  canvas.addEventListener('pointerdown', (e) => {
    if (!current) t0 = gestures.length === 0 ? e.timeStamp : t0;
    current = { pointerType: e.pointerType === 'pen' ? 'pen' : 'mouse', points: [sample(e)] };
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!current) return;
    for (const ev of e.getCoalescedEvents?.() ?? [e]) current.points.push(sample(ev));
  });
  const end = () => {
    if (current && current.points.length > 1) gestures.push(current);
    current = null;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointerleave', end);
  window.__aksharaRecording = { gestures, held: () => current };
});

if (args.simulate) {
  // Replay a fixture through real mouse input, as a human would draw it.
  const fixture = JSON.parse(readFileSync(args.simulate, 'utf8'));
  const canvas = page.getByRole('img', { name: /Pati slate/ });
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  for (const g of fixture.gestures) {
    const [first, ...rest] = g.points;
    await page.mouse.move(
      box.x + (first[0] / 300) * box.width,
      box.y + (first[1] / 300) * box.height
    );
    await page.mouse.down();
    for (const p of rest) {
      await page.mouse.move(box.x + (p[0] / 300) * box.width, box.y + (p[1] / 300) * box.height);
    }
    await page.mouse.up();
  }
} else {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  await rl.question('Draw on the slate, then press Enter here to save the fixture… ');
  rl.close();
}

// Snapshot the outcome as the fixture's expectations.
const gestures = await page.evaluate(() => {
  const rec = window.__aksharaRecording;
  const held = rec.held();
  return held && held.points.length > 1
    ? [...rec.gestures, { ...held, release: false }]
    : rec.gestures;
});
const strokesDone = await page
  .getByRole('list', { name: 'Lines to draw' })
  .locator('li[aria-label$=" done"]')
  .count();
const complete = (await page.getByRole('heading', { name: /स्याबास!/ }).count()) > 0;
const hint = (await page.getByRole('status').first().textContent())?.trim() ?? '';
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const fixture = {
  version: 1,
  name: args.name,
  description: `Recorded on ${new Date().toISOString().slice(0, 10)}${args.simulate ? ' (simulated)' : ''}.`,
  source: 'recorded',
  target: args.letter
    ? { kind: 'letter', id: args.letter }
    : { kind: 'number', value: Number(args.number) },
  level: args.level,
  expect: {
    strokesDone,
    complete,
    // The hint's first sentence (a stable prefix) — edit freely after recording
    ...(complete ? {} : { hint: escape(hint.split(/[।!.]/)[0].slice(0, 40)) }),
  },
  gestures,
};
const out = join(args.out ?? OUT, `${args.name}.json`);
writeFileSync(out, formatFixture(fixture));
console.log(`✓ Saved ${gestures.length} gesture(s) → ${out}`);
console.log(`  expect: ${JSON.stringify(fixture.expect)}`);
await browser.close();
