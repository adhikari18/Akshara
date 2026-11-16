'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NUMERAL_LIST, STROKE_LIST, type LetterStrokeDataset } from '@akshara/data';
import {
  DEMO_GALLERY_BASE_SPEED,
  GALLERY_SPEEDS,
  buildDemoTimeline,
  demoFrameAt,
  type DemoGalleryFrame,
  type GallerySpeed,
} from './demoTimeline';

type GalleryPage = 'letters' | 'numbers';

/** A global Start / Stop press; `nonce` makes repeated presses of the same button take effect. */
interface GlobalCommand {
  playing: boolean;
  nonce: number;
}

/** Chalk colour per stroke, in drawing order. */
const STROKE_COLOURS = [
  '#fbbf24',
  '#38bdf8',
  '#34d399',
  '#f472b6',
  '#a78bfa',
  '#fb923c',
  '#f87171',
];
const colourOf = (strokeIndex: number) => STROKE_COLOURS[strokeIndex % STROKE_COLOURS.length]!;

const speedLabel = (s: GallerySpeed) => `${s}×`;

/**
 * "Demo" tab: every letter (one page) and every numeral ० – ९ (another page) on its own small
 * Pati slate. When stopped a slate shows the tracing setup the learner sees (headline guide,
 * faint letter, numbered start dot of each stroke, checkpoint dots); when playing it draws the
 * expected trace stroke by stroke in teacher chalk, then loops.
 */
export function TracingDemoGallery() {
  const [page, setPage] = useState<GalleryPage>('letters');
  const [command, setCommand] = useState<GlobalCommand>({ playing: true, nonce: 0 });
  const [globalSpeed, setGlobalSpeed] = useState<GallerySpeed>(1);

  const datasets = page === 'letters' ? STROKE_LIST : NUMERAL_LIST;
  const send = (playing: boolean) => setCommand((c) => ({ playing, nonce: c.nonce + 1 }));

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border-2 border-line bg-card p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-2xl font-black text-ink leading-tight">
              लेखाइ डेमो • Tracing Demo
            </h2>
            <p className="text-sm font-semibold text-ink-soft">
              See how every {page === 'letters' ? 'letter' : 'number'} is traced, stroke by stroke.
            </p>
          </div>
          <div role="tablist" aria-label="Demo pages" className="flex gap-2">
            {(
              [
                ['letters', `अक्षर • Letters (${STROKE_LIST.length})`],
                ['numbers', `अङ्क • Numbers (${NUMERAL_LIST.length})`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={page === id}
                onClick={() => setPage(id)}
                className={`btn ${page === id ? 'bg-amber-400 text-slate-900' : 'bg-sunken text-ink-soft'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3" role="group" aria-label="All demos">
          <button
            type="button"
            className="btn bg-emerald-500 text-white"
            onClick={() => send(true)}
          >
            ▶ Start all
          </button>
          <button type="button" className="btn bg-rose-500 text-white" onClick={() => send(false)}>
            ■ Stop all
          </button>
          <span className="text-sm font-bold text-ink-soft" id="global-speed-label">
            Speed for all:
          </span>
          <div role="radiogroup" aria-labelledby="global-speed-label" className="flex gap-1">
            {GALLERY_SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={globalSpeed === s}
                onClick={() => setGlobalSpeed(s)}
                className={`min-h-[40px] rounded-xl px-3 text-sm font-bold ${
                  globalSpeed === s ? 'bg-sky-500 text-white' : 'bg-sunken text-ink-soft'
                }`}
              >
                {speedLabel(s)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ul
        aria-label={page === 'letters' ? 'Letter demos' : 'Number demos'}
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3"
        key={page}
      >
        {datasets.map((dataset) => (
          <li key={dataset.id}>
            <DemoCard dataset={dataset} command={command} globalSpeed={globalSpeed} />
          </li>
        ))}
      </ul>
    </div>
  );
}

interface DemoCardProps {
  dataset: LetterStrokeDataset;
  command: GlobalCommand;
  globalSpeed: GallerySpeed;
}

/** One letter's slate with its own play / stop and speed override. */
export function DemoCard({ dataset, command, globalSpeed }: DemoCardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timeline = useMemo(() => buildDemoTimeline(dataset), [dataset]);
  const [playing, setPlaying] = useState(command.playing);
  /** null = follow the global speed. */
  const [ownSpeed, setOwnSpeed] = useState<GallerySpeed | null>(null);
  const [strokeIndex, setStrokeIndex] = useState<number | null>(null);
  const position = useRef(0);
  const speed = ownSpeed ?? globalSpeed;
  const speedRef = useRef(speed);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  // Global Start / Stop applies to every card (each can then be stopped / started on its own)
  const lastNonce = useRef(command.nonce);
  useEffect(() => {
    if (command.nonce === lastNonce.current) return;
    lastNonce.current = command.nonce;
    position.current = 0;
    setPlaying(command.playing);
  }, [command]);

  // Paint loop: advance the chalk while playing; when stopped, show the tracing setup.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    if (!playing) {
      position.current = 0;
      paintDemo(canvas, dataset, null);
      return undefined;
    }
    let raf = 0;
    let last: number | null = null;
    let shownStroke = -1;
    const tick = (now: number) => {
      if (last !== null) {
        const dt = Math.min(0.1, (now - last) / 1000);
        position.current =
          (position.current + dt * DEMO_GALLERY_BASE_SPEED * speedRef.current) % timeline.total;
      }
      last = now;
      const frame = demoFrameAt(timeline, position.current);
      paintDemo(canvas, dataset, frame);
      if (frame.strokeIndex !== shownStroke) {
        shownStroke = frame.strokeIndex;
        setStrokeIndex(frame.strokeIndex);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, dataset, timeline]);

  const char = dataset.character;
  // While stopped the slate shows the setup, whatever stroke the last run reached.
  const shownStroke = playing ? strokeIndex : null;
  const current = shownStroke !== null ? dataset.strokes[shownStroke] : null;

  return (
    <figure className="rounded-3xl border-2 border-line bg-card p-2 sm:p-3 flex flex-col gap-2 h-full">
      <figcaption className="flex items-baseline justify-between gap-2 px-1">
        <span className="text-2xl font-black text-ink leading-none">{char}</span>
        <span className="text-[11px] font-semibold text-ink-faint">
          {dataset.phonetics.romanized} • {dataset.strokes.length}{' '}
          {dataset.strokes.length === 1 ? 'stroke' : 'strokes'}
        </span>
      </figcaption>
      <canvas
        ref={canvasRef}
        width={300}
        height={300}
        role="img"
        aria-label={`Tracing demo for ${char}`}
        className="w-full aspect-square rounded-2xl bg-slate-800"
      />
      <p className="min-h-[2.5em] px-1 text-[11px] leading-tight text-ink-soft" aria-live="off">
        {current
          ? `${shownStroke! + 1}/${dataset.strokes.length}: ${current.label}`
          : 'Stopped — showing the tracing setup'}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            position.current = 0;
            setPlaying((p) => !p);
          }}
          aria-label={`${playing ? 'Stop' : 'Play'} ${char} demo`}
          aria-pressed={playing}
          className={`min-h-[36px] flex-1 rounded-xl text-sm font-bold ${
            playing ? 'bg-rose-500/90 text-white' : 'bg-emerald-500 text-white'
          }`}
        >
          {playing ? '■ Stop' : '▶ Play'}
        </button>
        <select
          aria-label={`Speed for ${char}`}
          value={ownSpeed ?? 'global'}
          onChange={(e) =>
            setOwnSpeed(
              e.target.value === 'global' ? null : (Number(e.target.value) as GallerySpeed)
            )
          }
          className="min-h-[36px] rounded-xl bg-sunken px-2 text-xs font-bold text-ink"
        >
          <option value="global">Global ({speedLabel(globalSpeed)})</option>
          {GALLERY_SPEEDS.map((s) => (
            <option key={s} value={s}>
              {speedLabel(s)}
            </option>
          ))}
        </select>
      </div>
    </figure>
  );
}

/**
 * Paint one demo slate (300 × 300 logical units, like the Pati slate). `frame` null = stopped:
 * only the setup (guides, faint letter, numbered stroke starts, checkpoint dots).
 */
export function paintDemo(
  canvas: HTMLCanvasElement,
  dataset: LetterStrokeDataset,
  frame: DemoGalleryFrame | null
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(canvas.width / 300, 0, 0, canvas.height / 300, 0, 0);
  ctx.clearRect(0, 0, 300, 300);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, 300, 300);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Guide lines: Shirorekha band (letters only) and baseline
  ctx.save();
  ctx.setLineDash([6, 6]);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
  if (dataset.shirorekha) {
    ctx.beginPath();
    ctx.moveTo(20, dataset.viewBox.shirorekhaY);
    ctx.lineTo(280, dataset.viewBox.shirorekhaY);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(20, dataset.viewBox.baselineY);
  ctx.lineTo(280, dataset.viewBox.baselineY);
  ctx.stroke();
  ctx.restore();

  // Faint letter: every stroke as a wide ghost track
  const paths = dataset.strokes.map((s) => new Path2D(s.svgPath));
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.16)';
  ctx.lineWidth = 18;
  paths.forEach((p) => ctx.stroke(p));
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 5]);
  paths.forEach((p) => ctx.stroke(p));
  ctx.setLineDash([]);

  // Expected trace so far, in per-stroke chalk colours
  if (frame) {
    for (const piece of frame.drawn) {
      if (piece.points.length < 2) continue;
      ctx.strokeStyle = colourOf(piece.strokeIndex);
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(piece.points[0]!.x, piece.points[0]!.y);
      for (const p of piece.points.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
  }

  // Checkpoint dots of the stroke being demonstrated (all strokes' when stopped)
  const dotStrokes = frame ? [frame.strokeIndex] : dataset.strokes.map((_, i) => i);
  for (const i of dotStrokes) {
    const stroke = dataset.strokes[i];
    if (!stroke) continue;
    ctx.fillStyle = frame ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.35)';
    for (const wp of stroke.waypoints.slice(1)) {
      ctx.beginPath();
      ctx.arc(wp.x, wp.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Numbered start dot of every stroke (stroke order)
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  dataset.strokes.forEach((stroke, i) => {
    const start = stroke.waypoints[0]!;
    const active = frame?.strokeIndex === i && !frame.finished;
    ctx.beginPath();
    ctx.arc(start.x, start.y, active ? 11 : 9, 0, Math.PI * 2);
    ctx.fillStyle = colourOf(i);
    ctx.globalAlpha = frame && !active ? 0.6 : 1;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0f172a';
    ctx.fillText(String(i + 1), start.x, start.y + 0.5);
  });

  // Chalk tip
  if (frame?.pen) {
    ctx.beginPath();
    ctx.arc(frame.pen.x, frame.pen.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(255,255,255,0.8)';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}
