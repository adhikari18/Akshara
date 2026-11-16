import { describe, expect, it } from 'vitest';
import { pointerEventToLogical } from '@/components/tracing/usePatiRenderer';

const rect = { left: 100, top: 50, width: 600, height: 600 };

describe('pointerEventToLogical', () => {
  it('maps client coordinates onto the 300×300 slate and clamps', () => {
    expect(pointerEventToLogical({ clientX: 400, clientY: 350 }, rect, 5)).toEqual({
      x: 150,
      y: 150,
      timestamp: 5,
    });
    const outside = pointerEventToLogical({ clientX: 0, clientY: 9999 }, rect, 1);
    expect(outside.x).toBe(0);
    expect(outside.y).toBe(300);
  });

  it('carries pen pressure and tilt, but not a pen-less tilt', () => {
    const pen = pointerEventToLogical(
      { clientX: 400, clientY: 350, pressure: 0.8, tiltX: 30, tiltY: -10, pointerType: 'pen' },
      rect,
      0
    );
    expect(pen).toMatchObject({ pressure: 0.8, tiltX: 30, tiltY: -10 });
    const mouse = pointerEventToLogical(
      { clientX: 400, clientY: 350, pressure: 0.5, tiltX: 30, pointerType: 'mouse' },
      rect,
      0
    );
    expect(mouse.pressure).toBe(0.5);
    expect(mouse.tiltX).toBeUndefined();
  });

  it('leaves pressure unset when the device reports none', () => {
    expect(
      pointerEventToLogical({ clientX: 400, clientY: 350, pressure: 0 }, rect, 0).pressure
    ).toBeUndefined();
  });
});
