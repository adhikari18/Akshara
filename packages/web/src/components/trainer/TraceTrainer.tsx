'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  NUMERAL_LIST,
  STROKE_LIST,
  validateLetterDataset,
  type LetterStrokeDataset,
  type StrokeTopologyType,
} from '@akshara/data';
import type { Point2D } from '@akshara/core';
import { DemoCard } from '@/components/demo/TracingDemoGallery';
import type { GallerySpeed } from '@/components/demo/demoTimeline';
import { DEVANAGARI_FONTS, getFont, glyphText, loadFont } from '@/lib/devanagariFonts';
import { buildFontGuide, paintGlyphFaint, placeGlyph, type GlyphPlacement } from './fontGuide';
import {
  buildPreviewDataset,
  buildGlyphGuide,
  fitStrokePath,
  gestureLength,
  guessStrokeType,
  TAP_SNAP_DISTANCE,
  snapToGuide,
  type DrawnStroke,
  type GlyphGuide,
  type InputMode,
} from './traceFit';

const STROKE_TYPES: StrokeTopologyType[] = ['curve', 'loop', 'diagonal', 'stem', 'shirorekha'];
const COLOURS = ['#fbbf24', '#38bdf8', '#34d399', '#f472b6', '#a78bfa', '#fb923c', '#f87171'];
const colourOf = (i: number) => COLOURS[i % COLOURS.length]!;
const STORAGE_KEY = 'akshara.trace-trainer.drafts';
const FONT_CHOICE_KEY = 'akshara.trace-trainer.fonts';
/** Reference "font" meaning: the letter's current stroke data. */
const CURRENT_DATA = 'current';

function loadFontChoices(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(FONT_CHOICE_KEY) ?? '{}') as Record<
      string,
      string
    >;
  } catch {
    return {};
  }
}
/** Taps and tiny slips are not strokes. */
const MIN_STROKE_LENGTH = 12;

type Drafts = Record<string, DrawnStroke[]>;
const NO_STROKES: DrawnStroke[] = [];

function loadDrafts(): Drafts {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as Drafts;
  } catch {
    return {};
  }
}

/**
 * Trace Trainer: a native speaker picks a numeral (or letter), sees how it is traced today, draws
 * the correct stroke sequence on the slate, previews the result, and exports the corrected
 * stroke JSON (packages/data/strokes/<id>.json) for the maintainers.
 */
export function TraceTrainer() {
  const [group, setGroup] = useState<'numbers' | 'letters'>('numbers');
  const [glyphId, setGlyphId] = useState<string>(NUMERAL_LIST[0]!.id);
  const [drafts, setDrafts] = useState<Drafts>(() => loadDrafts());
  const [showGhost, setShowGhost] = useState(true);
  const [snap, setSnap] = useState(true);
  const [mode, setMode] = useState<InputMode>('points');
  /** Points placed so far for the stroke being built in point mode. */
  const [pending, setPending] = useState<Point2D[]>([]);
  const [speed, setSpeed] = useState<GallerySpeed>(1);
  const [copied, setCopied] = useState(false);

  const list = group === 'numbers' ? NUMERAL_LIST : STROKE_LIST;
  const dataset = useMemo(
    () => [...NUMERAL_LIST, ...STROKE_LIST].find((d) => d.id === glyphId) ?? NUMERAL_LIST[0]!,
    [glyphId]
  );
  const strokeGuide = useMemo(() => buildGlyphGuide(dataset), [dataset]);
  // Which font's version of each letter is the reference for training (per letter, remembered)
  const [fontChoices, setFontChoices] = useState<Record<string, string>>(() => loadFontChoices());
  const fontId = fontChoices[glyphId] ?? CURRENT_DATA;
  const [fontsReady, setFontsReady] = useState(0);
  const [fontRef, setFontRef] = useState<{
    key: string;
    placement: GlyphPlacement;
    guide: GlyphGuide | null;
  } | null>(null);
  useEffect(() => {
    try {
      window.localStorage.setItem(FONT_CHOICE_KEY, JSON.stringify(fontChoices));
    } catch {
      /* storage unavailable */
    }
  }, [fontChoices]);
  // Load every candidate font once so the comparison strip renders each glyph in its own font
  useEffect(() => {
    let alive = true;
    Promise.all(DEVANAGARI_FONTS.map((f) => loadFont(f))).then(() => {
      if (alive) setFontsReady((n) => n + 1);
    });
    return () => {
      alive = false;
    };
  }, []);
  // The chosen font's glyph: where it sits on the slate, and its centreline as the snap guide
  useEffect(() => {
    if (fontId === CURRENT_DATA) return;
    let alive = true;
    const font = getFont(fontId);
    loadFont(font).then(() => {
      if (!alive) return;
      const probe = document.createElement('canvas').getContext('2d');
      const placement = probe ? placeGlyph(probe, font, dataset) : null;
      setFontRef(
        placement
          ? { key: `${fontId}:${dataset.id}`, placement, guide: buildFontGuide(placement) }
          : null
      );
    });
    return () => {
      alive = false;
    };
  }, [fontId, dataset, fontsReady]);
  const activeFontRef =
    fontId !== CURRENT_DATA && fontRef?.key === `${fontId}:${dataset.id}` ? fontRef : null;
  const guide = activeFontRef?.guide ?? strokeGuide;
  const chooseFont = (id: string) => {
    setFontChoices((all) => ({ ...all, [glyphId]: id }));
    setPending([]);
  };
  const downloadFontChoices = () => {
    const blob = new Blob([JSON.stringify(fontChoices, null, 2) + '\n'], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'akshara-font-choices.json';
    a.click();
    URL.revokeObjectURL(url);
  };
  const drawn = useMemo(() => drafts[glyphId] ?? NO_STROKES, [drafts, glyphId]);
  const setDrawn = useCallback(
    (update: (prev: DrawnStroke[]) => DrawnStroke[]) =>
      setDrafts((all) => ({ ...all, [glyphId]: update(all[glyphId] ?? []) })),
    [glyphId]
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
    } catch {
      /* storage may be unavailable (private mode); the session still works */
    }
  }, [drafts]);

  const [corrected, draftProblem, buildError] = useMemo((): [
    LetterStrokeDataset | null,
    string | null,
    string | null,
  ] => {
    if (drawn.length === 0) return [null, null, null];
    try {
      const { dataset: built, problem } = buildPreviewDataset(dataset, drawn, guide);
      return [built, problem, null];
    } catch (e) {
      return [null, null, e instanceof Error ? e.message : String(e)];
    }
  }, [dataset, drawn, guide]);
  const validation = useMemo(
    () => (corrected ? validateLetterDataset(corrected) : null),
    [corrected]
  );
  const json = useMemo(() => (corrected ? JSON.stringify(corrected, null, 2) : ''), [corrected]);

  const addStroke = (points: Point2D[], strokeMode: InputMode) => {
    if (strokeMode === 'draw' && gestureLength(points) < MIN_STROKE_LENGTH) return;
    if (strokeMode === 'points' && points.length < 2) return;
    setDrawn((prev) => {
      const index = prev.length;
      const type = guessStrokeType(points, dataset);
      const sameSlot = dataset.strokes[index];
      return [
        ...prev,
        {
          points,
          type,
          mode: strokeMode,
          snap,
          label: sameSlot?.label ?? `Stroke ${index + 1}`,
          nepaliInstruction: sameSlot?.nepaliInstruction ?? '',
          englishInstruction: sameSlot?.englishInstruction ?? '',
        },
      ];
    });
  };
  const placePoint = (p: Point2D) => {
    // In point mode a click adds the next numbered point; snapping pulls it onto the glyph.
    const snapped = snap ? (snapToGuide(guide, p, TAP_SNAP_DISTANCE)?.point ?? p) : p;
    setPending((prev) => [...prev, snapped]);
  };
  const finishPoints = () => {
    addStroke(pending, 'points');
    setPending([]);
  };
  const updateStroke = (i: number, patch: Partial<DrawnStroke>) =>
    setDrawn((prev) => prev.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const removeStroke = (i: number) => setDrawn((prev) => prev.filter((_, k) => k !== i));
  const moveStroke = (i: number, dir: -1 | 1) =>
    setDrawn((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  const download = () => {
    const blob = new Blob([json + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${dataset.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable: the JSON is still shown below */
    }
  };

  const command = useMemo(() => ({ playing: true, nonce: 0 }), []);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border-2 border-line bg-card p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-2xl font-black text-ink leading-tight">
              लेखाइ प्रशिक्षण • Trace Trainer
            </h2>
            <p className="text-sm font-semibold text-ink-soft max-w-2xl">
              For native Nepali writers: pick a number or letter, look at how it is traced today,
              then write it the proper way on the slate. One pen-down to pen-up is one stroke, in
              the order you write them. Export the result and send it to the maintainers.
            </p>
          </div>
          <div role="tablist" aria-label="Glyph groups" className="flex gap-2">
            {(
              [
                ['numbers', `अङ्क • Numbers`],
                ['letters', `अक्षर • Letters`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={group === id}
                onClick={() => {
                  setGroup(id);
                  setGlyphId((id === 'numbers' ? NUMERAL_LIST : STROKE_LIST)[0]!.id);
                  setPending([]);
                }}
                className={`btn ${group === id ? 'bg-amber-400 text-slate-900' : 'bg-sunken text-ink-soft'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div
          role="radiogroup"
          aria-label={group === 'numbers' ? 'Pick a number' : 'Pick a letter'}
          className="flex flex-wrap gap-2"
        >
          {list.map((d) => {
            const hasDraft = (drafts[d.id]?.length ?? 0) > 0;
            return (
              <button
                key={d.id}
                type="button"
                role="radio"
                aria-checked={glyphId === d.id}
                aria-label={`Train ${d.character}`}
                onClick={() => {
                  setGlyphId(d.id);
                  setPending([]);
                }}
                className={`relative min-w-[44px] min-h-[44px] rounded-2xl border-2 px-2 text-2xl font-black ${
                  glyphId === d.id
                    ? 'border-amber-400 bg-amber-100 dark:bg-amber-400/20 text-ink'
                    : 'border-line bg-sunken text-ink-soft'
                }`}
              >
                {d.character}
                {hasDraft && (
                  <span
                    aria-label="has a correction"
                    className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-500"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <section
        className="rounded-3xl border-2 border-line bg-card p-4 space-y-2"
        aria-labelledby="font-pick-heading"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="font-pick-heading" className="font-bold text-ink">
            फन्ट छान्नुहोस् • Which font&apos;s {dataset.character} to train from
          </h3>
          <button
            type="button"
            className="btn bg-sunken text-ink-soft"
            onClick={downloadFontChoices}
            disabled={Object.keys(fontChoices).length === 0}
          >
            ⬇ Download font choices
          </button>
        </div>
        <p className="text-xs text-ink-soft">
          Pick the version of {dataset.character} that is written best. It becomes the faint letter
          you trace over (and snap to) on the slate. The choice is remembered for each letter.
        </p>
        <div
          role="radiogroup"
          aria-label={`Reference font for ${dataset.character}`}
          className="flex flex-wrap gap-2"
        >
          <FontTile
            label="Current stroke data"
            sample={dataset.character}
            family={undefined}
            checked={fontId === CURRENT_DATA}
            onChoose={() => chooseFont(CURRENT_DATA)}
          />
          {DEVANAGARI_FONTS.map((font) => {
            const text = glyphText(font, dataset.id, dataset.character);
            if (!text) return null;
            return (
              <FontTile
                key={font.id}
                label={font.name}
                hint={font.style}
                sample={text}
                family={font.source === 'system' ? undefined : `"${font.family}", sans-serif`}
                checked={fontId === font.id}
                onChoose={() => chooseFont(font.id)}
              />
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* 1. Current trace */}
        <section className="space-y-2" aria-labelledby="current-trace-heading">
          <h3 id="current-trace-heading" className="font-bold text-ink">
            1 • अहिलेको लेखाइ • How {dataset.character} is traced today
          </h3>
          <DemoCard dataset={dataset} command={command} globalSpeed={speed} />
          <p className="text-xs text-ink-faint">
            {dataset.strokes.length} {dataset.strokes.length === 1 ? 'stroke' : 'strokes'}:{' '}
            {dataset.strokes.map((s) => s.label.replace(/\s*\(.*\)$/, '')).join(' → ')}
          </p>
        </section>

        {/* 2. Draw the correct trace */}
        <section className="space-y-2" aria-labelledby="draw-heading">
          <h3 id="draw-heading" className="font-bold text-ink">
            2 • सही तरिकाले लेख्नुहोस् • Write {dataset.character} the correct way
          </h3>
          <div role="radiogroup" aria-label="Input method" className="flex gap-2">
            {(
              [
                ['points', '🔢 Place numbered points'],
                ['draw', '✍️ Draw by hand'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={mode === id}
                onClick={() => {
                  setMode(id);
                  setPending([]);
                }}
                className={`btn flex-1 ${mode === id ? 'bg-sky-500 text-white' : 'bg-sunken text-ink-soft'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-ink-soft">
            {mode === 'points'
              ? 'Tap the points of one stroke in writing order (1, 2, 3…): where it starts, where it bends, where it ends. The trace follows the faint letter between your points. Then press “Finish stroke”.'
              : 'Write one stroke with your finger or mouse; lift to finish it. The line is smoothed and, with snapping on, pulled onto the faint letter.'}
          </p>
          <TrainerSlate
            dataset={dataset}
            guide={guide}
            fontPlacement={activeFontRef?.placement ?? null}
            drawn={drawn}
            pending={pending}
            mode={mode}
            showGhost={showGhost}
            onStroke={(pts) => addStroke(pts, 'draw')}
            onPoint={placePoint}
          />
          {mode === 'points' && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-ink-soft">
                {pending.length === 0
                  ? `Stroke ${drawn.length + 1}: tap its first point`
                  : `Stroke ${drawn.length + 1}: ${pending.length} ${pending.length === 1 ? 'point' : 'points'} placed`}
              </span>
              <button
                type="button"
                className="btn bg-emerald-500 text-white"
                onClick={finishPoints}
                disabled={pending.length < 2}
              >
                ✓ Finish stroke
              </button>
              <button
                type="button"
                className="btn bg-sunken text-ink-soft"
                onClick={() => setPending((prev) => prev.slice(0, -1))}
                disabled={pending.length === 0}
              >
                ↩ Undo point
              </button>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm font-bold text-ink-soft">
              <input
                type="checkbox"
                checked={showGhost}
                onChange={(e) => setShowGhost(e.target.checked)}
              />
              Show faint {dataset.character}
            </label>
            <label className="flex items-center gap-2 text-sm font-bold text-ink-soft">
              <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} />
              Snap to the faint {dataset.character}
            </label>
            <button
              type="button"
              className="btn bg-sunken text-ink-soft"
              onClick={() => setDrawn((prev) => prev.slice(0, -1))}
              disabled={drawn.length === 0}
            >
              ↩ Undo stroke
            </button>
            <button
              type="button"
              className="btn bg-rose-500 text-white"
              onClick={() => setDrawn(() => [])}
              disabled={drawn.length === 0}
            >
              ✕ Clear
            </button>
          </div>
          {drawn.length > 0 && (
            <ol aria-label="Your strokes" className="space-y-2">
              {drawn.map((s, i) => (
                <li
                  key={i}
                  className="rounded-2xl border border-line bg-sunken p-2 space-y-1 text-xs"
                  style={{ borderLeft: `6px solid ${colourOf(i)}` }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-ink">Stroke {i + 1}</span>
                    <select
                      aria-label={`Type of stroke ${i + 1}`}
                      value={s.type}
                      onChange={(e) =>
                        updateStroke(i, { type: e.target.value as StrokeTopologyType })
                      }
                      className="rounded-lg bg-card px-2 py-1 font-bold text-ink"
                    >
                      {STROKE_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <span className="ml-auto flex gap-1">
                      <button
                        type="button"
                        aria-label={`Move stroke ${i + 1} up`}
                        onClick={() => moveStroke(i, -1)}
                        disabled={i === 0}
                        className="rounded-lg bg-card px-2 py-1"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label={`Move stroke ${i + 1} down`}
                        onClick={() => moveStroke(i, 1)}
                        disabled={i === drawn.length - 1}
                        className="rounded-lg bg-card px-2 py-1"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete stroke ${i + 1}`}
                        onClick={() => removeStroke(i)}
                        className="rounded-lg bg-card px-2 py-1 text-rose-600"
                      >
                        🗑
                      </button>
                    </span>
                  </div>
                  <input
                    aria-label={`Label of stroke ${i + 1}`}
                    value={s.label}
                    onChange={(e) => updateStroke(i, { label: e.target.value })}
                    placeholder="Label, e.g. Top Curve (माथिको घुमाउरो)"
                    className="w-full rounded-lg bg-card px-2 py-1 text-ink"
                  />
                  <input
                    aria-label={`Nepali instruction of stroke ${i + 1}`}
                    value={s.nepaliInstruction}
                    onChange={(e) => updateStroke(i, { nepaliInstruction: e.target.value })}
                    placeholder="नेपाली निर्देशन"
                    className="w-full rounded-lg bg-card px-2 py-1 text-ink"
                  />
                  <input
                    aria-label={`English instruction of stroke ${i + 1}`}
                    value={s.englishInstruction}
                    onChange={(e) => updateStroke(i, { englishInstruction: e.target.value })}
                    placeholder="English instruction"
                    className="w-full rounded-lg bg-card px-2 py-1 text-ink"
                  />
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* 3. Preview & export */}
        <section className="space-y-2" aria-labelledby="preview-heading">
          <h3 id="preview-heading" className="font-bold text-ink">
            3 • तपाईंको लेखाइ • Your corrected trace
          </h3>
          {corrected ? (
            <>
              <DemoCard key={json} dataset={corrected} command={command} globalSpeed={speed} />
              {draftProblem && (
                <p
                  role="status"
                  className="rounded-2xl border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-400/10 dark:text-amber-200"
                >
                  Preview of your draft. Not ready to export yet: {friendlyProblem(draftProblem)}
                </p>
              )}
              {!draftProblem && validation && !validation.valid && (
                <ul
                  role="alert"
                  className="rounded-2xl border border-rose-300 bg-rose-50 p-2 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
                >
                  {validation.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              )}
              {!draftProblem && validation?.valid && (
                <p className="text-xs font-bold text-emerald-600">
                  ✓ Valid stroke data — ready to export.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn bg-emerald-500 text-white"
                  onClick={download}
                  disabled={!!draftProblem}
                >
                  ⬇ Download {dataset.id}.json
                </button>
                <button
                  type="button"
                  className="btn bg-sky-500 text-white"
                  onClick={copy}
                  disabled={!!draftProblem}
                >
                  {copied ? '✓ Copied' : '⧉ Copy JSON'}
                </button>
              </div>
              <details className="rounded-2xl border border-line bg-sunken p-2 text-xs">
                <summary className="cursor-pointer font-bold text-ink-soft">
                  Stroke JSON (packages/data/strokes/{dataset.id}.json)
                </summary>
                <pre
                  aria-label="Corrected stroke JSON"
                  className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] text-ink"
                >
                  {json}
                </pre>
              </details>
            </>
          ) : (
            <div className="rounded-3xl border-2 border-dashed border-line p-6 text-center text-sm text-ink-faint">
              {buildError ? (
                <span role="alert" className="text-rose-600">
                  Could not build the preview: {buildError}
                </span>
              ) : (
                'Draw the first stroke on the slate to see your version here.'
              )}
            </div>
          )}
          <label className="flex items-center gap-2 text-xs font-bold text-ink-soft">
            Preview speed
            <select
              aria-label="Preview speed"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value) as GallerySpeed)}
              className="rounded-lg bg-sunken px-2 py-1 text-ink"
            >
              {[0.5, 1, 1.5, 2, 3].map((s) => (
                <option key={s} value={s}>
                  {s}×
                </option>
              ))}
            </select>
          </label>
        </section>
      </div>
    </div>
  );
}

/** The compiler's reasons, in words for the author. */
function friendlyProblem(message: string): string {
  if (/needs at least 2 strokes|must be last|shirorekha/i.test(message)) {
    return 'letters end with the Shirorekha (headline) as their last stroke — draw it last and set its type to “shirorekha”.';
  }
  if (/multiple subpaths/i.test(message)) return 'each stroke must be one continuous line.';
  return message;
}

interface FontTileProps {
  label: string;
  hint?: string;
  sample: string;
  family: string | undefined;
  checked: boolean;
  onChoose: () => void;
}
/** One font in the comparison strip: the letter drawn in that font. */
function FontTile({ label, hint, sample, family, checked, onChoose }: FontTileProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-label={label}
      title={hint ? `${label} — ${hint}` : label}
      onClick={onChoose}
      className={`flex w-24 flex-col items-center gap-1 rounded-2xl border-2 p-2 ${
        checked ? 'border-amber-400 bg-amber-100 dark:bg-amber-400/20' : 'border-line bg-sunken'
      }`}
    >
      <span
        className="text-4xl leading-tight text-ink"
        style={family ? { fontFamily: family } : undefined}
      >
        {sample}
      </span>
      <span className="text-[10px] font-bold leading-tight text-ink-soft text-center">{label}</span>
    </button>
  );
}

interface TrainerSlateProps {
  dataset: LetterStrokeDataset;
  guide: GlyphGuide;
  fontPlacement: GlyphPlacement | null;
  drawn: DrawnStroke[];
  pending: Point2D[];
  mode: InputMode;
  showGhost: boolean;
  onStroke: (points: Point2D[]) => void;
  onPoint: (point: Point2D) => void;
}

/**
 * The drawing surface: 300 × 300 logical units. In draw mode a pointer gesture becomes a stroke;
 * in point mode each tap places the next numbered point of the stroke being built.
 */
function TrainerSlate({
  dataset,
  guide,
  fontPlacement,
  drawn,
  pending,
  mode,
  showGhost,
  onStroke,
  onPoint,
}: TrainerSlateProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const live = useRef<Point2D[] | null>(null);
  const [, bump] = useState(0);

  const toLogical = (e: React.PointerEvent<HTMLCanvasElement>): Point2D => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = rect.width > 0 ? 300 / rect.width : 1;
    const sy = rect.height > 0 ? 300 / rect.height : 1;
    return {
      x: Math.max(0, Math.min(300, (e.clientX - rect.left) * sx)),
      y: Math.max(0, Math.min(300, (e.clientY - rect.top) * sy)),
    };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    paintTrainer(canvas, dataset, guide, fontPlacement, drawn, live.current, pending, showGhost);
  });

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={600}
      role="img"
      aria-label={`Writing slate for ${dataset.character}`}
      className="w-full aspect-square rounded-2xl bg-slate-800 touch-none select-none cursor-crosshair"
      onPointerDown={(e) => {
        if (mode === 'points') {
          onPoint(toLogical(e));
          return;
        }
        e.currentTarget.setPointerCapture?.(e.pointerId);
        live.current = [toLogical(e)];
        bump((n) => n + 1);
      }}
      onPointerMove={(e) => {
        if (!live.current) return;
        live.current.push(toLogical(e));
        bump((n) => n + 1);
      }}
      onPointerUp={(e) => {
        if (!live.current) return;
        const pts = [...live.current, toLogical(e)];
        live.current = null;
        onStroke(pts);
      }}
      onPointerCancel={() => {
        live.current = null;
        bump((n) => n + 1);
      }}
    />
  );
}

function paintTrainer(
  canvas: HTMLCanvasElement,
  dataset: LetterStrokeDataset,
  guide: GlyphGuide,
  fontPlacement: GlyphPlacement | null,
  drawn: DrawnStroke[],
  live: Point2D[] | null,
  pending: Point2D[],
  showGhost: boolean
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(canvas.width / 300, 0, 0, canvas.height / 300, 0, 0);
  ctx.clearRect(0, 0, 300, 300);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, 300, 300);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

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

  if (showGhost && fontPlacement) {
    // The chosen font's glyph, plus its centreline (what taps and drawings snap to)
    paintGlyphFaint(ctx, fontPlacement, 'rgb(226, 232, 240)', 0.16);
    ctx.save();
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.35)';
    ctx.lineWidth = 1.2;
    for (const t of guide.tracks) {
      ctx.beginPath();
      ctx.moveTo(t.points[0]!.x, t.points[0]!.y);
      for (const q of t.points.slice(1)) ctx.lineTo(q.x, q.y);
      ctx.stroke();
    }
    ctx.restore();
  } else if (showGhost) {
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.14)';
    ctx.lineWidth = 18;
    for (const s of dataset.strokes) ctx.stroke(new Path2D(s.svgPath));
  }

  // Fitted strokes so far (what will be exported), with their order number at the start
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  drawn.forEach((s, i) => {
    const path = fitStrokePath(s, guide);
    if (!path) return;
    ctx.strokeStyle = colourOf(i);
    ctx.lineWidth = 7;
    ctx.stroke(new Path2D(path));
    const start = s.points[0]!;
    ctx.beginPath();
    ctx.arc(start.x, start.y, 10, 0, Math.PI * 2);
    ctx.fillStyle = colourOf(i);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.fillText(String(i + 1), start.x, start.y + 0.5);
  });

  // The gesture in progress, raw
  if (live && live.length > 1) {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(live[0]!.x, live[0]!.y);
    for (const p of live.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  // Point mode: the stroke being built — its route so far plus its numbered points
  if (pending.length > 0) {
    const preview = fitStrokePath(
      {
        points: pending,
        type: 'curve',
        label: '',
        nepaliInstruction: '',
        englishInstruction: '',
        mode: 'points',
        snap: true,
      },
      guide
    );
    if (pending.length >= 2 && preview) {
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 5;
      ctx.stroke(new Path2D(preview));
      ctx.restore();
    }
    ctx.font = 'bold 11px system-ui, sans-serif';
    pending.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = colourOf(drawn.length);
      ctx.stroke();
      ctx.fillStyle = '#0f172a';
      ctx.fillText(String(i + 1), p.x, p.y + 0.5);
    });
  }
}
