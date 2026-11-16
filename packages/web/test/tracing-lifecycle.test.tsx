import React from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { STROKE_DATASETS, STROKE_LIST, type StrokeDefinition } from '@akshara/data';
import { sampleStrokePath } from '@akshara/core';
import { TracingCanvas } from '@/components/TracingCanvas';
import * as audio from '@/lib/audio';
import { filterDeck, stepThroughDeck } from '@/components/tracing/LetterDeck';
import { advanceDust, type PatiScene } from '@/components/tracing/useTracingSession';

vi.mock('@/lib/audio', () => ({
  playStrokeSuccessSound: vi.fn(),
  playTopologicalWarningSound: vi.fn(),
  playWaypointChime: vi.fn(),
  speakNepaliPhonics: vi.fn(),
}));

const ka = STROKE_DATASETS.ka!;

beforeAll(() => {
  HTMLCanvasElement.prototype.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 300,
      bottom: 300,
      width: 300,
      height: 300,
      toJSON: () => ({}),
    }) as DOMRect;
});

const canvas = () => screen.getByRole('img', { name: /Pati slate/ });
const showMe = () => screen.getByRole('button', { name: /Show me|Pause/ });
const strokeDots = () => screen.getByRole('list', { name: 'Lines to draw' });

function trace(stroke: StrokeDefinition) {
  const [first, ...rest] = sampleStrokePath(stroke, 3);
  fireEvent.pointerDown(canvas(), { pointerId: 1, clientX: first.x, clientY: first.y });
  for (const p of rest)
    fireEvent.pointerMove(canvas(), { pointerId: 1, clientX: p.x, clientY: p.y });
  fireEvent.pointerUp(canvas(), { pointerId: 1 });
}

/** Number of strokes marked done in the progress dots under the slate. */
const doneStrokes = () => strokeDots().querySelectorAll('li[aria-label$=" done"]').length;

/** Any feedback sound or speech played since the last `vi.clearAllMocks()`. */
const soundsPlayed = () =>
  [
    audio.playStrokeSuccessSound,
    audio.playTopologicalWarningSound,
    audio.playWaypointChime,
    audio.speakNepaliPhonics,
  ].reduce((n, fn) => n + vi.mocked(fn).mock.calls.length, 0);

describe('"Show me" auto-demo (useAutoDemo)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
  const demoStatus = () => screen.queryByText(/stroke \d+ of \d+/);

  it("replays the whole letter as an overlay without touching the learner's progress", () => {
    render(<TracingCanvas />);
    fireEvent.click(showMe());
    expect(showMe()).toHaveTextContent('Pause');
    expect(demoStatus()).toHaveTextContent('Watch: stroke 1 of 4');

    advance(60_000);
    // The hand has finished: button offers "Show me" again, slate ends on the last stroke…
    expect(showMe()).toHaveTextContent('Show me');
    expect(demoStatus()).toHaveTextContent('Paused at stroke 4 of 4');
    // …and the learner has drawn nothing: no line is done, no celebration
    expect(doneStrokes()).toBe(0);
    expect(screen.queryByText(/स्याबास!.*पूरा भयो!/)).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(`चरण 1/${ka.strokes.length}`);
  });

  it('starts on the stroke the learner is working on', () => {
    render(<TracingCanvas />);
    trace(ka.strokes[0]!);
    expect(doneStrokes()).toBe(1);
    fireEvent.click(showMe());
    expect(demoStatus()).toHaveTextContent('stroke 2 of 4');
    // Learner's finished line stays finished while the teacher draws
    advance(2_000);
    expect(doneStrokes()).toBe(1);
  });

  it('pauses when the learner touches the slate, and resumes from where it stopped', () => {
    render(<TracingCanvas />);
    fireEvent.click(showMe());
    advance(500);
    const start = ka.strokes[0]!.waypoints[0]!;
    fireEvent.pointerDown(canvas(), { pointerId: 1, clientX: start.x, clientY: start.y });
    expect(showMe()).toHaveTextContent('Show me');
    expect(demoStatus()).toHaveTextContent('Paused at stroke 1 of 4');
    fireEvent.pointerUp(canvas(), { pointerId: 1 });
    fireEvent.click(showMe());
    expect(demoStatus()).toHaveTextContent('Watch: stroke 1 of 4');
  });

  it('steps stroke by stroke with the previous / next buttons', () => {
    render(<TracingCanvas />);
    const next = () => fireEvent.click(screen.getByRole('button', { name: 'Next stroke' }));
    const prev = () => fireEvent.click(screen.getByRole('button', { name: 'Previous stroke' }));
    expect(screen.getByRole('button', { name: 'Previous stroke' })).toBeDisabled();
    next();
    expect(demoStatus()).toHaveTextContent('Paused at stroke 1 of 4');
    next();
    next();
    next();
    expect(demoStatus()).toHaveTextContent('stroke 4 of 4');
    expect(screen.getByRole('button', { name: 'Next stroke' })).toBeDisabled();
    prev();
    expect(demoStatus()).toHaveTextContent('stroke 3 of 4');
    // Stepping never draws for the learner
    expect(doneStrokes()).toBe(0);
  });

  it('runs twice as fast at 2× and half as fast at 0.5×', () => {
    const timeToFinish = (speed: '0.5×' | '1×' | '2×') => {
      const view = render(<TracingCanvas />);
      fireEvent.click(screen.getByRole('radio', { name: speed }));
      fireEvent.click(showMe());
      let elapsed = 0;
      while (showMe().textContent?.includes('Pause') && elapsed < 120_000) {
        advance(250);
        elapsed += 250;
      }
      view.unmount();
      return elapsed;
    };
    const normal = timeToFinish('1×');
    const fast = timeToFinish('2×');
    const slow = timeToFinish('0.5×');
    expect(fast).toBeLessThan(normal * 0.7);
    expect(slow).toBeGreaterThan(normal * 1.5);
  });

  it('jumps to a stroke tapped in the stroke-order list', () => {
    render(<TracingCanvas />);
    fireEvent.click(screen.getByRole('button', { name: /^Show stroke 3:/ }));
    expect(demoStatus()).toHaveTextContent('Watch: stroke 3 of 4');
    expect(showMe()).toHaveTextContent('Pause');
  });

  it('is cleared when the learner switches letter, leaving no timers or sounds behind', () => {
    render(<TracingCanvas />);
    fireEvent.click(showMe());
    advance(1_500);
    fireEvent.click(screen.getByRole('button', { name: 'Next letter' }));
    expect(showMe()).toHaveTextContent('Show me');
    expect(demoStatus()).toBeNull();
    advance(50); // one pending paint frame; nothing should re-arm
    expect(vi.getTimerCount()).toBe(0);
    vi.clearAllMocks();
    advance(60_000);
    expect(soundsPlayed()).toBe(0);
    expect(doneStrokes()).toBe(0);
  });

  it('is cleared when the slate is wiped', () => {
    render(<TracingCanvas />);
    fireEvent.click(showMe());
    advance(1_500);
    fireEvent.click(screen.getByRole('button', { name: /पुछ्नुहोस्/ }));
    expect(showMe()).toHaveTextContent('Show me');
    expect(demoStatus()).toBeNull();
    advance(50);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('session lifecycle (useTracingSession)', () => {
  it('starts a fresh session when the difficulty level changes', () => {
    render(<TracingCanvas />);
    trace(ka.strokes[0]!);
    expect(doneStrokes()).toBe(1);

    fireEvent.click(screen.getByRole('radio', { name: /Hard/ }));
    expect(doneStrokes()).toBe(0);
    expect(screen.getByRole('status')).toHaveTextContent(`चरण 1/${ka.strokes.length}`);
  });

  it('keeps progress across a mid-letter pen lift', () => {
    render(<TracingCanvas />);
    trace(ka.strokes[0]!);
    trace(ka.strokes[1]!);
    expect(doneStrokes()).toBe(2);
  });

  it('follows a new initialLetterId from the parent', () => {
    const { rerender } = render(<TracingCanvas initialLetterId="ka" />);
    rerender(<TracingCanvas initialLetterId="kha" />);
    expect(canvas()).toHaveAccessibleName(
      `Pati slate for tracing ${STROKE_DATASETS.kha!.character}`
    );
  });
});

describe('LetterDeck helpers', () => {
  it('filters vowels and consonants (samyukta counted as consonants)', () => {
    expect(filterDeck('swor')).toHaveLength(13);
    expect(filterDeck('vyanjan')).toHaveLength(STROKE_LIST.length - 13);
    expect(filterDeck('all')).toBe(STROKE_LIST);
  });

  it('steps through the deck with wrap-around in both directions', () => {
    const vowels = filterDeck('swor');
    expect(stepThroughDeck(vowels, vowels[0]!.id, -1)).toBe(vowels[vowels.length - 1]);
    expect(stepThroughDeck(vowels, vowels[vowels.length - 1]!.id, 1)).toBe(vowels[0]);
    // A letter outside the filtered deck starts from the deck's first letter
    expect(stepThroughDeck(vowels, 'ka', 1)).toBe(vowels[1]);
    expect(stepThroughDeck([], 'ka', 1)).toBeNull();
  });
});

describe('render & paint budget (M2)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

  it('does not re-render React for pointer samples that change nothing meaningful', () => {
    let updates = 0;
    render(
      <React.Profiler
        id="studio"
        onRender={(_id, phase) => {
          if (phase === 'update') updates += 1;
        }}
      >
        <TracingCanvas />
      </React.Profiler>
    );
    advance(50);
    updates = 0;

    // Touch down on dot 1 (unlocks it → one meaningful change → one commit)…
    const start = ka.strokes[0]!.waypoints[0]!;
    fireEvent.pointerDown(canvas(), { pointerId: 1, clientX: start.x, clientY: start.y });
    const afterDown = updates;
    expect(afterDown).toBeGreaterThanOrEqual(1);

    // …then 40 jittery samples inside the same ring: hot path only, no React re-renders.
    for (let i = 0; i < 40; i++) {
      fireEvent.pointerMove(canvas(), {
        pointerId: 1,
        clientX: start.x + (i % 2 ? 2 : -2),
        clientY: start.y + (i % 3) - 1,
      });
    }
    expect(updates).toBe(afterDown);

    // Reaching the next dot is meaningful again.
    const next = ka.strokes[0]!.waypoints[1]!;
    for (const p of sampleStrokePath(ka.strokes[0]!, 3)) {
      fireEvent.pointerMove(canvas(), { pointerId: 1, clientX: p.x, clientY: p.y });
      if (Math.hypot(p.x - next.x, p.y - next.y) < 4) break;
    }
    expect(updates).toBeGreaterThan(afterDown);
    fireEvent.pointerUp(canvas(), { pointerId: 1 });
  });

  it('paints at most once per animation frame however many samples arrive', () => {
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
    render(<TracingCanvas />);
    advance(50);
    getContext.mockClear();

    const start = ka.strokes[0]!.waypoints[0]!;
    fireEvent.pointerDown(canvas(), { pointerId: 1, clientX: start.x, clientY: start.y });
    for (let i = 0; i < 40; i++) {
      fireEvent.pointerMove(canvas(), {
        pointerId: 1,
        clientX: start.x + (i % 3),
        clientY: start.y,
      });
    }
    // Nothing is painted synchronously in the event handlers…
    expect(getContext).not.toHaveBeenCalled();
    // …one frame later the slate is painted exactly once for all 41 samples.
    advance(17);
    expect(getContext).toHaveBeenCalledTimes(1);
    fireEvent.pointerUp(canvas(), { pointerId: 1 });
    getContext.mockRestore();
  });
});

describe('repaints after React-driven changes, even under StrictMode', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

  // StrictMode mounts, unmounts and remounts effects in development. The unmount used to cancel
  // the pending frame but keep its id, so the renderer believed a frame was still queued and
  // never painted a new letter again.
  it('paints the next letter on the following frame', () => {
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
    render(
      <React.StrictMode>
        <TracingCanvas />
      </React.StrictMode>
    );
    advance(50);
    getContext.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Next letter' }));
    advance(17);
    expect(getContext).toHaveBeenCalled();
    getContext.mockRestore();
  });
});

describe('chalk dust animation (M3)', () => {
  const sceneWith = (dust: PatiScene['dust']): PatiScene =>
    ({
      trail: [],
      dust,
      penDown: false,
      lastEval: null,
      committedDigest: '',
    }) as unknown as PatiScene;

  it('moves, fades and finally removes particles, independent of frame rate', () => {
    const particle = () => ({ x: 100, y: 100, vx: 0.5, vy: 0.2, alpha: 0.55, radius: 1 });
    const at60 = sceneWith([particle()]);
    const at120 = sceneWith([particle()]);
    advanceDust(at60, 1000 / 60);
    advanceDust(at120, 1000 / 120);
    advanceDust(at120, 1000 / 120);
    expect(at60.dust[0]!.x).toBeCloseTo(100.5, 6);
    expect(at60.dust[0]!.y).toBeGreaterThan(100);
    expect(at60.dust[0]!.alpha).toBeLessThan(0.55);
    // Two 120 Hz steps land where one 60 Hz step does
    expect(at120.dust[0]!.x).toBeCloseTo(at60.dust[0]!.x, 6);
    expect(at120.dust[0]!.alpha).toBeCloseTo(at60.dust[0]!.alpha, 6);

    let alive = true;
    let frames = 0;
    while (alive && frames < 200) {
      alive = advanceDust(at60, 1000 / 60);
      frames += 1;
    }
    expect(alive).toBe(false);
    expect(at60.dust).toHaveLength(0);
    expect(frames).toBeGreaterThan(20);
    expect(frames).toBeLessThan(100);
  });
});
