import React from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { STROKE_DATASETS, STROKE_LIST } from '@akshara/data';
import type { StrokeDefinition } from '@akshara/data';
import { TracingCanvas } from '@/components/TracingCanvas';
import * as audio from '@/lib/audio';

vi.mock('@/lib/audio', () => ({
  playStrokeSuccessSound: vi.fn(),
  playTopologicalWarningSound: vi.fn(),
  playWaypointChime: vi.fn(),
  speakNepaliPhonics: vi.fn(),
}));

const ka = STROKE_DATASETS.ka;

beforeAll(() => {
  // Give the canvas a real CSS box so pointer coordinates map 1:1 onto the
  // 300x300 logical space (jsdom lays out everything at 0x0 otherwise).
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

function getCanvas(): HTMLCanvasElement {
  return screen.getByRole('img', { name: /Pati slate/ }) as HTMLCanvasElement;
}

/**
 * Replays a stroke the way a careful learner would: pointer down on the first
 * waypoint, interpolated moves along each waypoint segment (so the EMA filter
 * converges), and a few settle samples on the final waypoint.
 */
function traceStroke(canvas: HTMLCanvasElement, stroke: StrokeDefinition): void {
  const [first, ...rest] = stroke.waypoints;
  fireEvent.pointerDown(canvas, { pointerId: 1, clientX: first.x, clientY: first.y });

  let prev = first;
  for (const wp of rest) {
    const steps = 8;
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      fireEvent.pointerMove(canvas, {
        pointerId: 1,
        clientX: prev.x + (wp.x - prev.x) * t,
        clientY: prev.y + (wp.y - prev.y) * t,
      });
    }
    prev = wp;
  }
  // Settle samples so the smoothed point converges onto the final waypoint
  for (let i = 0; i < 4; i++) {
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: prev.x, clientY: prev.y });
  }
  fireEvent.pointerUp(canvas, { pointerId: 1 });
}

describe('TracingCanvas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the full 49-letter deck and the default letter क', () => {
    render(<TracingCanvas />);
    expect(
      screen.getByRole('button', { name: `सबै All (${STROKE_LIST.length})` })
    ).toBeInTheDocument();
    expect(screen.getAllByTestId('letter-tile')).toHaveLength(STROKE_LIST.length);
    expect(getCanvas()).toBeInTheDocument();
    // Phonetics card for ka
    expect(screen.getByText(ka.phonetics.nepaliName)).toBeInTheDocument();
  });

  it('filters the deck to the 13 Swor Varna vowels', async () => {
    const user = userEvent.setup();
    render(<TracingCanvas />);

    await user.click(screen.getByRole('button', { name: /स्वर Vowels/ }));

    const sworCount = STROKE_LIST.filter((l) => l.category === 'swor').length;
    expect(sworCount).toBe(13);
    expect(screen.getAllByTestId('letter-tile')).toHaveLength(sworCount);
  });

  it('switches the slate when another letter is selected', async () => {
    const user = userEvent.setup();
    render(<TracingCanvas />);

    const kha = STROKE_DATASETS.kha;
    const khaTile = screen
      .getAllByTestId('letter-tile')
      .find((b) => b.textContent?.trim().startsWith(kha.character));
    expect(khaTile).toBeDefined();
    await user.click(khaTile!);
    expect(khaTile).toHaveAttribute('aria-pressed', 'true');

    expect(getCanvas()).toHaveAccessibleName(`Pati slate for tracing ${kha.character}`);
    expect(screen.getByText(kha.phonetics.nepaliName)).toBeInTheDocument();
  });

  it('steps to the next and previous letter with the arrow buttons', async () => {
    const user = userEvent.setup();
    render(<TracingCanvas />);
    const start = STROKE_LIST.findIndex((l) => l.id === 'ka');
    const next = STROKE_LIST[(start + 1) % STROKE_LIST.length];

    await user.click(screen.getByRole('button', { name: 'Next letter' }));
    expect(getCanvas()).toHaveAccessibleName(`Pati slate for tracing ${next.character}`);

    await user.click(screen.getByRole('button', { name: 'Previous letter' }));
    expect(getCanvas()).toHaveAccessibleName(`Pati slate for tracing ${ka.character}`);
  });

  it('completes stroke 1 of क when traced along its waypoints', () => {
    render(<TracingCanvas />);
    traceStroke(getCanvas(), ka.strokes[0]);

    // Evaluator hands off to stroke 2 with an encouragement hint
    expect(screen.getByText(/राम्रो! अब चरण 2/)).toBeInTheDocument();
  });

  it('completes the whole letter and shows the celebration overlay', () => {
    render(<TracingCanvas />);
    const canvas = getCanvas();
    for (const stroke of ka.strokes) {
      traceStroke(canvas, stroke);
    }

    expect(screen.getByText(/स्याबास!.*पूरा भयो!/)).toBeInTheDocument();
    expect(screen.getByText(/Accuracy:/)).toBeInTheDocument();
    // Celebration offers a direct path to the next letter
    expect(screen.getAllByRole('button', { name: /Next letter/ }).length).toBe(2);
  });

  it('warns when the learner draws the Shirorekha headline first', () => {
    render(<TracingCanvas />);
    const canvas = getCanvas();
    const headline = ka.strokes.find((s) => s.type === 'shirorekha')!;

    // Attempt the headline bar immediately (stroke 1 is the loop body)
    traceStroke(canvas, headline);

    expect(screen.getAllByText(/शिरोरेखा.*अन्त्यमा मात्र/).length).toBeGreaterThan(0);
  });

  it('plays one warning sound per premature-Shirorekha gesture, not one per pointer sample', () => {
    render(<TracingCanvas />);
    const canvas = getCanvas();
    const headline = ka.strokes.find((s) => s.type === 'shirorekha')!;

    // One gesture along the headline produces dozens of pointer samples…
    traceStroke(canvas, headline);
    expect(audio.playTopologicalWarningSound).toHaveBeenCalledTimes(1);

    // …and a second, separate attempt is announced again.
    traceStroke(canvas, headline);
    expect(audio.playTopologicalWarningSound).toHaveBeenCalledTimes(2);
  });
});
