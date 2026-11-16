import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NUMERAL_LIST, STROKE_DATASETS, STROKE_LIST } from '@akshara/data';
import { TracingDemoGallery } from '@/components/demo/TracingDemoGallery';
import { buildDemoTimeline, demoFrameAt } from '@/components/demo/demoTimeline';

describe('demo timeline', () => {
  const ka = STROKE_DATASETS.ka!;
  const timeline = buildDemoTimeline(ka);

  it('lays every stroke of the letter out in drawing order', () => {
    const order = timeline.tracks.map((t) => t.strokeIndex);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(new Set(order).size).toBe(ka.strokes.length);
  });

  it('starts with nothing drawn and the chalk on stroke 1', () => {
    const f = demoFrameAt(timeline, 0);
    expect(f.strokeIndex).toBe(0);
    expect(f.finished).toBe(false);
    expect(f.pen).toEqual(timeline.tracks[0]!.points[0]);
  });

  it('draws the whole letter, then holds before looping', () => {
    const f = demoFrameAt(timeline, timeline.total - 1);
    expect(f.finished).toBe(true);
    expect(f.pen).toBeNull();
    expect(f.drawn).toHaveLength(timeline.tracks.length);
    expect(f.strokeIndex).toBe(ka.strokes.length - 1);
  });

  it('lifts the chalk between strokes', () => {
    const first = timeline.tracks[0]!;
    const f = demoFrameAt(timeline, first.start + first.length + 1);
    expect(f.pen).toBeNull();
    expect(f.drawn).toHaveLength(1);
  });
});

describe('TracingDemoGallery', () => {
  it('shows every letter on one page and the numerals ० – ९ on another', async () => {
    const user = userEvent.setup();
    render(<TracingDemoGallery />);
    const letters = screen.getByRole('list', { name: 'Letter demos' });
    expect(within(letters).getAllByRole('img')).toHaveLength(STROKE_LIST.length);
    expect(screen.getByRole('img', { name: 'Tracing demo for क' })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Numbers/ }));
    const numbers = screen.getByRole('list', { name: 'Number demos' });
    expect(within(numbers).getAllByRole('img')).toHaveLength(NUMERAL_LIST.length);
    expect(NUMERAL_LIST).toHaveLength(10);
    expect(screen.getByRole('img', { name: 'Tracing demo for ०' })).toBeInTheDocument();
  });

  it('stops and starts all demos together, and each one on its own', async () => {
    const user = userEvent.setup();
    render(<TracingDemoGallery />);
    const kaToggle = () => screen.getByRole('button', { name: /^(Play|Stop) क demo$/ });
    expect(kaToggle()).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: /Stop all/ }));
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: /Start all/ }));
    expect(screen.queryAllByRole('button', { pressed: false })).toHaveLength(0);

    // Stop just क
    await user.click(kaToggle());
    expect(kaToggle()).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Stop ख demo' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await user.click(kaToggle());
    expect(kaToggle()).toHaveAttribute('aria-pressed', 'true');
  });

  it('has a global speed that each letter follows unless given its own', async () => {
    const user = userEvent.setup();
    render(<TracingDemoGallery />);
    await user.click(screen.getByRole('radio', { name: '2×' }));
    expect(screen.getByRole('radio', { name: '2×' })).toHaveAttribute('aria-checked', 'true');
    const kaSpeed = screen.getByRole('combobox', { name: 'Speed for क' });
    expect(within(kaSpeed).getByRole('option', { selected: true })).toHaveTextContent(
      'Global (2×)'
    );

    await user.selectOptions(kaSpeed, '0.5');
    expect(kaSpeed).toHaveValue('0.5');
    // Changing the global speed does not override a letter's own speed
    await user.click(screen.getByRole('radio', { name: '3×' }));
    expect(kaSpeed).toHaveValue('0.5');
    expect(screen.getByRole('combobox', { name: 'Speed for ख' })).toHaveValue('global');
  });

  it('is linked from the student and admin navigation', async () => {
    const { STUDENT_NAV, ADMIN_NAV } = await import('@/components/shell/nav');
    expect(STUDENT_NAV.map((n) => n.href)).toContain('/student/watch/');
    expect(ADMIN_NAV.map((n) => n.href)).toContain('/admin/demo/');
  });
});
