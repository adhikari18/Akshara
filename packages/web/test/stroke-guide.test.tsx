import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { STROKE_DATASETS, STROKE_LIST, NUMERAL_LIST } from '@akshara/data';
import {
  ARROW_SPACING,
  SHIROREKHA_GUIDE_COLOR,
  STROKE_GUIDE_COLORS,
  buildStrokeGuide,
  strokeGuideColor,
} from '@/components/tracing/strokeGuide';
import { StrokeSidebar } from '@/components/tracing/StrokeSidebar';
import { TracingEvaluator } from '@akshara/core';

vi.mock('@/lib/audio', () => ({
  playStrokeSuccessSound: vi.fn(),
  playTopologicalWarningSound: vi.fn(),
  playWaypointChime: vi.fn(),
  speakNepaliPhonics: vi.fn(),
}));

const ka = STROKE_DATASETS.ka!;

describe('stroke order guide geometry', () => {
  it('gives every stroke a colour, a Devanagari start badge and direction arrows', () => {
    const guide = buildStrokeGuide(ka);
    expect(guide).toHaveLength(ka.strokes.length);
    expect(guide.map((g) => g.badge)).toEqual(['१', '२', '३', '४']);
    for (const entry of guide) {
      expect(entry.start).toEqual({
        x: ka.strokes[entry.index]!.waypoints[0]!.x,
        y: ka.strokes[entry.index]!.waypoints[0]!.y,
      });
      expect(entry.arrows.length).toBeGreaterThan(0);
      expect(entry.polylines.length).toBeGreaterThan(0);
    }
  });

  it('colours the Shirorekha amber and cycles the palette for body strokes', () => {
    expect(strokeGuideColor(ka, ka.strokes.length - 1)).toBe(SHIROREKHA_GUIDE_COLOR);
    expect(strokeGuideColor(ka, 0)).toBe(STROKE_GUIDE_COLORS[0]);
    expect(strokeGuideColor(ka, 1)).toBe(STROKE_GUIDE_COLORS[1]);
    const dha = STROKE_DATASETS.dha!;
    // A split headline keeps a polyline per span (the gap is never bridged)
    expect(buildStrokeGuide(dha)[dha.strokes.length - 1]!.polylines).toHaveLength(2);
  });

  it('spaces arrows by arc length and points them along the direction of travel', () => {
    const stem = buildStrokeGuide(ka)[1]!; // the vertical stem, drawn top to bottom
    for (const arrow of stem.arrows) {
      expect(arrow.angle).toBeCloseTo(Math.PI / 2, 1); // straight down in y-down space
    }
    for (let i = 1; i < stem.arrows.length; i++) {
      const gap = Math.hypot(
        stem.arrows[i]!.x - stem.arrows[i - 1]!.x,
        stem.arrows[i]!.y - stem.arrows[i - 1]!.y
      );
      expect(gap).toBeCloseTo(ARROW_SPACING, 0);
    }
  });

  it('builds for every letter and numeral and caches per dataset', () => {
    for (const d of [...STROKE_LIST, ...NUMERAL_LIST]) {
      const a = buildStrokeGuide(d);
      expect(a).toHaveLength(d.strokes.length);
      expect(buildStrokeGuide(d)).toBe(a);
    }
  });
});

describe('StrokeSidebar stroke order', () => {
  it('lists every stroke with Nepali and English instructions, and replays one on tap', () => {
    const evaluator = new TracingEvaluator(ka);
    const onPickStroke = vi.fn();
    render(
      <StrokeSidebar
        dataset={ka}
        mode="child"
        onModeChange={() => {}}
        progress={evaluator.getProgress()}
        lastEval={null}
        currentStroke={ka.strokes[0]!}
        onPickStroke={onPickStroke}
        demoStrokeIndex={null}
      />
    );
    for (const stroke of ka.strokes) {
      expect(screen.getByText(stroke.nepaliInstruction)).toBeInTheDocument();
      expect(screen.getByText(stroke.englishInstruction)).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole('button', { name: /^Show stroke 2:/ }));
    expect(onPickStroke).toHaveBeenCalledWith(1);
    expect(screen.getByRole('button', { name: /^Show stroke 1:/ })).toHaveAttribute(
      'aria-current',
      'step'
    );
  });
});
