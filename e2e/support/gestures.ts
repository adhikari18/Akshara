/**
 * Canvas regression harness: gesture fixtures, faithful replay, and pixel probes.
 *
 * A fixture is a recorded (or generated) stream of pointer samples in the slate's 300×300
 * logical space, plus the outcome it must produce. Replays go through the Chrome DevTools
 * protocol so pen pressure and tilt are real PointerEvent fields, and they honour the recorded
 * timing so the 1€ filter sees true sample intervals. Canvas assertions read pixels straight
 * from the slate's backing store ("ink probes") — platform-independent, unlike screenshots.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';

export const LOGICAL_SIZE = 300;
export const FIXTURE_DIR = join(__dirname, '..', 'fixtures', 'gestures');
const STROKES_DIR = join(__dirname, '..', '..', 'packages', 'data', 'strokes');

/** [x, y, t(ms)] for mouse; [x, y, t, pressure, tiltX, tiltY] for pen. */
export type FixturePoint =
  [number, number, number] | [number, number, number, number, number, number];

export interface FixtureGesture {
  pointerType: 'mouse' | 'pen';
  points: FixturePoint[];
  /** Lift the pointer at the end (default true). `false` leaves the gesture "held". */
  release?: boolean;
}

export type InkKind = 'chalk' | 'teacher' | 'none';

export interface InkProbe {
  /** Logical slate coordinates. */
  x: number;
  y: number;
  ink: InkKind;
  note?: string;
}

export interface GestureFixture {
  version: 1;
  name: string;
  description: string;
  source: 'generated' | 'recorded';
  target: { kind: 'letter'; id: string } | { kind: 'number'; value: number };
  level?: 'Easy' | 'Medium' | 'Hard';
  gestures: FixtureGesture[];
  expect: {
    /** Number of progress dots marked done under the slate. */
    strokesDone?: number;
    /** Whether the celebration ("स्याबास!") must (true) or must not (false) appear. */
    complete?: boolean;
    /** Regular expression the hint bubble must match. */
    hint?: string;
    /** Strokes (0-based) whose authored curve must now be drawn in chalk on the canvas. */
    inkOnStrokes?: number[];
    /** Strokes whose curve must NOT be chalked (e.g. a stroke the learner was stopped on). */
    noInkOnStrokes?: number[];
    /** Individual pixel probes. */
    probes?: InkProbe[];
  };
}

export interface StrokeJson {
  id: string;
  character: string;
  phonetics: { romanized: string };
  strokes: Array<{ id: string; svgPath: string }>;
}

export function loadStrokeJson(id: string): StrokeJson {
  return JSON.parse(readFileSync(join(STROKES_DIR, `${id}.json`), 'utf8')) as StrokeJson;
}

export function loadFixtures(dir = FIXTURE_DIR): GestureFixture[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as GestureFixture);
}

const DEVANAGARI_DIGITS = '०१२३४५६७८९';
const toDevanagari = (n: number) =>
  String(n)
    .split('')
    .map((d) => DEVANAGARI_DIGITS[Number(d)])
    .join('');

/** Open the fixture's letter (tracing studio) or number (number studio) and set its level. */
export async function openTarget(page: Page, fixture: GestureFixture): Promise<void> {
  await page.goto(fixture.target.kind === 'letter' ? '/student/trace/' : '/student/numbers/');
  if (fixture.target.kind === 'letter') {
    const letter = loadStrokeJson(fixture.target.id);
    await page
      .getByRole('button', {
        name: `${letter.character} (${letter.phonetics.romanized})`,
        exact: true,
      })
      .click();
    await expect(
      page.getByRole('img', { name: `Pati slate for tracing ${letter.character}` })
    ).toBeVisible();
  } else {
    const v = fixture.target.value;
    await page.getByRole('button', { name: new RegExp(`^${toDevanagari(v)} \\(${v}\\)`) }).click();
  }
  if (fixture.level) {
    await page.getByRole('radio', { name: new RegExp(fixture.level) }).click();
  }
}

/** Screen box of the slate canvas, scrolled into view. */
async function slateBox(page: Page) {
  const canvas = page.getByRole('img', { name: /Pati slate/ });
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Pati slate canvas is not visible');
  return box;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Replay a fixture's gestures on the slate through CDP input events, at the recorded timing
 * (scaled by E2E_REPLAY_SPEED, default 1). Pen samples carry pressure (`force`) and tilt.
 */
export async function replayGestures(page: Page, gestures: FixtureGesture[]): Promise<void> {
  const speed = Number(process.env.E2E_REPLAY_SPEED ?? 1) || 1;
  const cdp = await page.context().newCDPSession(page);
  try {
    for (const [gestureIndex, gesture] of gestures.entries()) {
      // Re-measure per gesture (a hand finds the slate afresh), then insist it stays put.
      const box = await slateBox(page);
      const toScreen = (x: number, y: number) => ({
        x: box.x + (x / LOGICAL_SIZE) * box.width,
        y: box.y + (y / LOGICAL_SIZE) * box.height,
      });
      const start = Date.now();
      const t0 = gesture.points[0]?.[2] ?? 0;
      for (let i = 0; i < gesture.points.length; i++) {
        const [x, y, t, pressure, tiltX, tiltY] = gesture.points[i]!;
        const due = start + (t - t0) / speed;
        const wait = due - Date.now();
        if (wait > 0) await sleep(wait);
        const s = toScreen(x, y);
        const pen = gesture.pointerType === 'pen';
        await cdp.send('Input.dispatchMouseEvent', {
          type: i === 0 ? 'mousePressed' : 'mouseMoved',
          x: s.x,
          y: s.y,
          button: 'left',
          buttons: 1,
          clickCount: i === 0 ? 1 : 0,
          pointerType: gesture.pointerType,
          ...(pen ? { force: pressure ?? 0.5, tiltX: tiltX ?? 0, tiltY: tiltY ?? 0 } : {}),
        });
      }
      // Layout stability: the slate must not move while a finger is on it. A shift here means
      // the learner's stroke lands somewhere else on the letter (a real bug, caught once for a
      // hint bubble that grew when a stroke completed).
      const after = await page.getByRole('img', { name: /Pati slate/ }).boundingBox();
      const shift = after ? Math.hypot(after.x - box.x, after.y - box.y) : Infinity;
      if (shift > 1) {
        throw new Error(
          `Pati slate moved ${shift.toFixed(1)} px during gesture ${gestureIndex + 1} — layout shift under the learner's finger`
        );
      }
      if (gesture.release !== false) {
        const [x, y] = gesture.points[gesture.points.length - 1]!;
        const s = toScreen(x, y);
        await cdp.send('Input.dispatchMouseEvent', {
          type: 'mouseReleased',
          x: s.x,
          y: s.y,
          button: 'left',
          buttons: 0,
          clickCount: 1,
          pointerType: gesture.pointerType,
        });
        await sleep(120 / speed); // a hand lifting between strokes
      }
    }
  } finally {
    await cdp.detach();
  }
}

/** Wait until the renderer has painted the latest state (two animation frames). */
export async function settlePaint(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
  );
}

export type RGBA = [number, number, number, number];

/** Read slate pixels at logical coordinates from the canvas backing store. */
export async function readSlatePixels(
  page: Page,
  points: Array<{ x: number; y: number }>
): Promise<RGBA[]> {
  await settlePaint(page);
  return page.evaluate(
    ({ pts, size }) => {
      const canvas = document.querySelector<HTMLCanvasElement>('canvas[role="img"]');
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) throw new Error('slate canvas not found');
      const sx = canvas.width / size;
      const sy = canvas.height / size;
      return pts.map((p) => {
        const d = ctx.getImageData(Math.round(p.x * sx), Math.round(p.y * sy), 1, 1).data;
        return [d[0], d[1], d[2], d[3]] as [number, number, number, number];
      });
    },
    { pts: points, size: LOGICAL_SIZE }
  );
}

/** Learner chalk: completed strokes (#fef3c7) and the live trail (#fef08a). */
export const isChalk = ([r, g, b]: RGBA) => r > 200 && g > 190 && b > 110 && r - b < 150;
/** The "Show me" teacher chalk (#7dd3fc). */
export const isTeacherChalk = ([r, g, b]: RGBA) => b > 200 && g > 160 && r < 190 && b - r > 40;

export function classify(pixel: RGBA): InkKind {
  if (isTeacherChalk(pixel)) return 'teacher';
  if (isChalk(pixel)) return 'chalk';
  return 'none';
}

/** Distance between a pixel and a hex colour (RGB space). */
export function colorDistance([r, g, b]: RGBA, hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return Math.hypot(r - ((n >> 16) & 255), g - ((n >> 8) & 255), b - (n & 255));
}

/** Points every `spacing` units along an SVG path, sampled by the browser's SVG engine. */
export async function curvePoints(page: Page, svgPath: string, spacing = 12) {
  return page.evaluate(
    ({ d, step }) => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      svg.appendChild(path);
      document.body.appendChild(svg);
      const total = path.getTotalLength();
      const pts: Array<{ x: number; y: number }> = [];
      for (let s = 0; s <= total; s += step) {
        const p = path.getPointAtLength(s);
        pts.push({ x: p.x, y: p.y });
      }
      svg.remove();
      return pts;
    },
    { d: svgPath, step: spacing }
  );
}

/** Fraction of a stroke's curve that is chalked on the canvas. */
export async function chalkCoverage(page: Page, svgPath: string): Promise<number> {
  const pts = await curvePoints(page, svgPath);
  const pixels = await readSlatePixels(page, pts);
  return pixels.filter(isChalk).length / Math.max(1, pixels.length);
}

/** Number of progress dots marked done under the slate. */
export async function strokesDone(page: Page): Promise<number> {
  return page
    .getByRole('list', { name: 'Lines to draw' })
    .locator('li[aria-label$=" done"]')
    .count();
}

/** Assert every expectation recorded in a fixture. */
export async function assertFixtureOutcome(page: Page, fixture: GestureFixture): Promise<void> {
  const e = fixture.expect;
  const celebration = page.getByRole('heading', { name: /स्याबास!/ });
  if (e.complete === true) await expect(celebration).toBeVisible();
  if (e.complete === false) await expect(celebration).toHaveCount(0);
  if (e.hint) await expect(page.getByRole('status')).toHaveText(new RegExp(e.hint));
  if (e.strokesDone !== undefined) expect(await strokesDone(page)).toBe(e.strokesDone);

  if (e.inkOnStrokes?.length || e.noInkOnStrokes?.length) {
    const strokes =
      fixture.target.kind === 'letter'
        ? loadStrokeJson(fixture.target.id).strokes
        : loadStrokeJson(`num-${String(fixture.target.value).slice(-1)}`).strokes;
    for (const idx of e.inkOnStrokes ?? []) {
      const coverage = await chalkCoverage(page, strokes[idx]!.svgPath);
      expect(coverage, `chalk along stroke ${idx + 1}`).toBeGreaterThan(0.9);
    }
    for (const idx of e.noInkOnStrokes ?? []) {
      const coverage = await chalkCoverage(page, strokes[idx]!.svgPath);
      expect(coverage, `no chalk along stroke ${idx + 1}`).toBeLessThan(0.2);
    }
  }
  if (e.probes?.length) {
    const pixels = await readSlatePixels(page, e.probes);
    e.probes.forEach((probe, i) => {
      expect(classify(pixels[i]!), probe.note ?? `ink at (${probe.x}, ${probe.y})`).toBe(probe.ink);
    });
  }
}
