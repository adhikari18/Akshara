import React from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { NUMERAL_LIST, type StrokeDefinition } from '@akshara/data';
import { sampleStrokePath } from '@akshara/core';
import { DIGIT_ADVANCE_MS, NumberStudio } from '@/components/NumberStudio';
import * as audio from '@/lib/audio';

vi.mock('@/lib/audio', () => ({
  playStrokeSuccessSound: vi.fn(),
  playTopologicalWarningSound: vi.fn(),
  playWaypointChime: vi.fn(),
  speakNepaliPhonics: vi.fn(),
}));

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
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});
afterEach(() => vi.useRealTimers());

const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const canvas = () => screen.getByRole('img', { name: /Pati slate/ });
const pick = (devanagari: string, value: number) =>
  fireEvent.click(
    screen.getByRole('button', { name: new RegExp(`^${devanagari} \\(${value}\\)`) })
  );
const digitChips = () =>
  within(screen.getByRole('list', { name: 'Digits to write' })).getAllByRole('listitem');

function traceStroke(stroke: StrokeDefinition) {
  const [first, ...rest] = sampleStrokePath(stroke, 3);
  fireEvent.pointerDown(canvas(), { pointerId: 1, clientX: first.x, clientY: first.y });
  for (const p of rest)
    fireEvent.pointerMove(canvas(), { pointerId: 1, clientX: p.x, clientY: p.y });
  fireEvent.pointerUp(canvas(), { pointerId: 1 });
}
const traceDigit = (d: number) => NUMERAL_LIST[d]!.strokes.forEach(traceStroke);

describe('NumberStudio', () => {
  it('shows a 0–100 chart and starts on १ (एक)', () => {
    render(<NumberStudio />);
    expect(screen.getAllByTestId('number-tile')).toHaveLength(101);
    expect(screen.getByRole('button', { name: /^१ \(1\)/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('heading', { name: 'एक' })).toBeInTheDocument();
    expect(canvas()).toHaveAccessibleName('Pati slate for tracing १');
  });

  it('breaks a picked number into digits, place value and its Nepali name', () => {
    render(<NumberStudio />);
    pick('४२', 42);
    expect(screen.getByRole('heading', { name: 'बयालीस' })).toBeInTheDocument();
    expect(digitChips().map((li) => li.textContent?.replace('✅', ''))).toEqual(['४', '२']);
    expect(screen.getAllByTestId('ten-rod')).toHaveLength(4);
    expect(screen.getAllByTestId('one-cube')).toHaveLength(2);
    expect(screen.getByText(/4 tens \+ 2 ones/)).toBeInTheDocument();
    expect(canvas()).toHaveAccessibleName('Pati slate for tracing ४');
  });

  it('traces ४२ digit by digit, then celebrates and announces the whole number', () => {
    render(<NumberStudio />);
    pick('४२', 42);

    traceDigit(4);
    // Intermediate digit: its own name is spoken, and the next digit is offered
    expect(audio.speakNepaliPhonics).toHaveBeenCalledWith('चार', 'chaar');
    expect(screen.getByText('राम्रो! अब २ लेख्नुहोस्।')).toBeInTheDocument();
    expect(digitChips()[0]).toHaveAccessibleName('Digit ४: done');

    advance(DIGIT_ADVANCE_MS);
    expect(canvas()).toHaveAccessibleName('Pati slate for tracing २');
    expect(digitChips()[1]).toHaveAccessibleName('Digit २: now');

    vi.mocked(audio.speakNepaliPhonics).mockClear();
    traceDigit(2);
    expect(
      screen.getByRole('heading', { name: 'स्याबास! तपाईंले ४२ (बयालीस) लेख्नुभयो!' })
    ).toBeInTheDocument();
    // The last digit announces the number, not the digit
    expect(audio.speakNepaliPhonics).toHaveBeenCalledWith('बयालीस', '42');
    expect(audio.speakNepaliPhonics).not.toHaveBeenCalledWith('दुई', 'dui');
    expect(screen.getByRole('button', { name: /^४२ \(42\), 3 stars/ })).toBeInTheDocument();
  });

  it('can skip the pause with "Next digit"', () => {
    render(<NumberStudio />);
    pick('४२', 42);
    traceDigit(4);
    fireEvent.click(screen.getByRole('button', { name: /Next digit/ }));
    expect(canvas()).toHaveAccessibleName('Pati slate for tracing २');
  });

  it('gives each repeated digit a fresh slate (११ is two separate १s)', () => {
    render(<NumberStudio />);
    pick('११', 11);
    traceDigit(1);
    advance(DIGIT_ADVANCE_MS);
    expect(canvas()).toHaveAccessibleName('Pati slate for tracing १');
    expect(digitChips()[1]).toHaveAccessibleName('Digit १: now');
    expect(screen.getByRole('list', { name: 'Lines to draw' }).textContent).not.toContain('✓');
    traceDigit(1);
    expect(screen.getByRole('heading', { name: /तपाईंले ११ \(एघार\)/ })).toBeInTheDocument();
  });

  it('"Show me" replays the current digit without writing it for the learner', () => {
    render(<NumberStudio />);
    pick('४२', 42);
    fireEvent.click(screen.getByRole('button', { name: /Show me/ }));
    expect(screen.getByText(/Watch: stroke 1 of 1/)).toBeInTheDocument();
    for (let i = 0; i < 60; i++) advance(1000);
    // The teacher's hand finished; the learner still has both digits to write
    expect(screen.getByRole('button', { name: /Show me/ })).toBeInTheDocument();
    expect(digitChips()[0]).toHaveAccessibleName('Digit ४: now');
    expect(canvas()).toHaveAccessibleName('Pati slate for tracing ४');
    expect(screen.queryByRole('heading', { name: /स्याबास!/ })).not.toBeInTheDocument();
  });

  it('wraps between ० and १०० and shows a hundred block for १००', () => {
    render(<NumberStudio initialValue={0} />);
    expect(screen.getByRole('heading', { name: 'शून्य' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Previous number' }));
    expect(screen.getByRole('heading', { name: 'सय' })).toBeInTheDocument();
    expect(digitChips()).toHaveLength(3);
    expect(screen.getByText(/1 hundred/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next number' }));
    expect(screen.getByRole('heading', { name: 'शून्य' })).toBeInTheDocument();
  });

  it('draws numerals without the Shirorekha guide label', () => {
    render(<NumberStudio />);
    expect(screen.queryByText(/शिरोरेखा/)).not.toBeInTheDocument();
  });
});
