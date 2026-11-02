'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  STROKE_DATASETS,
  STROKE_LIST,
  type LetterStrokeDataset,
} from '@akshara/data';
import {
  TracingEvaluator,
  type LearnerToleranceMode,
  type Point2D,
  type StrokeStepEvaluation,
  type TracingProgressSummary,
} from '@akshara/core';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Eye,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
} from 'lucide-react';
import {
  playStrokeSuccessSound,
  playTopologicalWarningSound,
  playWaypointChime,
  speakNepaliPhonics,
} from '@/lib/audio';

interface ChalkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  radius: number;
}

type DeckCategoryFilter = 'all' | 'swor' | 'vyanjan';

interface TracingCanvasProps {
  initialLetterId?: string;
}

export function TracingCanvas({ initialLetterId = 'ka' }: TracingCanvasProps = {}) {
  const [selectedLetterId, setSelectedLetterId] = useState<string>(initialLetterId);
  const [categoryFilter, setCategoryFilter] = useState<DeckCategoryFilter>('all');
  const [toleranceMode, setToleranceMode] = useState<LearnerToleranceMode>('child');
  const [showGhostGuide, setShowGhostGuide] = useState<boolean>(true);
  const [showWaypoints, setShowWaypoints] = useState<boolean>(true);
  const [isAutoDemoPlaying, setIsAutoDemoPlaying] = useState<boolean>(false);

  useEffect(() => {
    if (initialLetterId && STROKE_DATASETS[initialLetterId]) {
      setSelectedLetterId(initialLetterId);
    }
  }, [initialLetterId]);

  const filteredStrokeList = useMemo(
    () =>
      categoryFilter === 'all'
        ? STROKE_LIST
        : STROKE_LIST.filter((item) => item.category === categoryFilter),
    [categoryFilter]
  );

  const sworCount = useMemo(
    () => STROKE_LIST.filter((item) => item.category === 'swor').length,
    []
  );
  const vyanjanCount = useMemo(
    () => STROKE_LIST.filter((item) => item.category === 'vyanjan').length,
    []
  );

  const dataset: LetterStrokeDataset = useMemo(
    () => STROKE_DATASETS[selectedLetterId] ?? STROKE_DATASETS.ka,
    [selectedLetterId]
  );

  const evaluatorRef = useRef<TracingEvaluator>(
    new TracingEvaluator(dataset, { mode: toleranceMode })
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef<boolean>(false);
  const activeTrailRef = useRef<Point2D[]>([]);
  const particlesRef = useRef<ChalkParticle[]>([]);

  const [lastEval, setLastEval] = useState<StrokeStepEvaluation | null>(null);
  const [progress, setProgress] = useState<TracingProgressSummary>(() =>
    evaluatorRef.current.getProgress()
  );

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const evaluator = evaluatorRef.current;
    const currentDataset = evaluator.getDataset();
    const currentProgress = evaluator.getProgress();
    const activeStroke = evaluator.getCurrentStroke();

    ctx.clearRect(0, 0, 300, 300);

    // 1. Traditional Pati (पाटी) dark slate background texture
    const slateGrad = ctx.createRadialGradient(150, 150, 20, 150, 150, 220);
    slateGrad.addColorStop(0, '#1e242b');
    slateGrad.addColorStop(1, '#12161b');
    ctx.fillStyle = slateGrad;
    ctx.fillRect(0, 0, 300, 300);

    // Subtle slate grain grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let g = 30; g < 300; g += 30) {
      ctx.beginPath();
      ctx.moveTo(g, 0);
      ctx.lineTo(g, 300);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, g);
      ctx.lineTo(300, g);
      ctx.stroke();
    }

    // 2. Canonical Shirorekha headline & Baseline guide rails
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.28)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(25, currentDataset.viewBox.shirorekhaY);
    ctx.lineTo(275, currentDataset.viewBox.shirorekhaY);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
    ctx.beginPath();
    ctx.moveTo(25, currentDataset.viewBox.baselineY);
    ctx.lineTo(275, currentDataset.viewBox.baselineY);
    ctx.stroke();
    ctx.restore();

    // Label Shirorekha line
    ctx.fillStyle = 'rgba(251, 191, 36, 0.55)';
    ctx.font = '10px sans-serif';
    ctx.fillText('शिरोरेखा (Shirorekha — Draw Last)', 30, currentDataset.viewBox.shirorekhaY - 8);

    // 3. Ghost guides for all strokes
    if (showGhostGuide) {
      currentDataset.strokes.forEach((stroke, idx) => {
        const isCompleted = idx < currentProgress.completedStrokeIds.length;
        if (isCompleted) return;
        const isCurrent = activeStroke?.id === stroke.id;

        ctx.save();
        const path = new Path2D(stroke.svgPath);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = isCurrent ? 18 : 14;
        ctx.strokeStyle = isCurrent
          ? 'rgba(254, 243, 199, 0.16)'
          : 'rgba(148, 163, 184, 0.08)';
        ctx.stroke(path);

        if (isCurrent) {
          ctx.setLineDash([6, 6]);
          ctx.lineWidth = 2.5;
          ctx.strokeStyle =
            stroke.type === 'shirorekha'
              ? 'rgba(251, 191, 36, 0.65)'
              : 'rgba(56, 189, 248, 0.65)';
          ctx.stroke(path);
        }
        ctx.restore();
      });
    }

    // 4. Completed strokes rendered in rich limestone chalk
    currentDataset.strokes.forEach((stroke, idx) => {
      if (idx >= currentProgress.completedStrokeIds.length) return;
      ctx.save();
      const path = new Path2D(stroke.svgPath);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 15;
      ctx.shadowColor = 'rgba(254, 243, 199, 0.35)';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = '#fef3c7';
      ctx.stroke(path);
      ctx.restore();
    });

    // 5. Active user chalk trail
    if (activeTrailRef.current.length > 1) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(activeTrailRef.current[0].x, activeTrailRef.current[0].y);
      for (let i = 1; i < activeTrailRef.current.length; i++) {
        ctx.lineTo(activeTrailRef.current[i].x, activeTrailRef.current[i].y);
      }
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 14;
      ctx.strokeStyle = lastEval?.topologicalViolation
        ? '#f87171'
        : lastEval?.isOffTrack
          ? '#fb923c'
          : '#fef08a';
      ctx.shadowColor = 'rgba(254, 240, 138, 0.45)';
      ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.restore();
    }

    // 6. Chalk dust particles
    particlesRef.current.forEach((pt) => {
      ctx.save();
      ctx.fillStyle = `rgba(254, 243, 199, ${pt.alpha})`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 7. Waypoints for the active stroke
    if (showWaypoints && activeStroke && !currentProgress.isLetterComplete) {
      const unlockedCount = currentProgress.unlockedWaypointsInCurrentStroke;
      activeStroke.waypoints.forEach((wp, wpIdx) => {
        const isUnlocked = wpIdx < unlockedCount;
        const isNextTarget = wpIdx === unlockedCount;

        ctx.save();
        if (isNextTarget) {
          // Adaptive tolerance radius ring
          const tolRadius =
            lastEval?.effectiveTolerance ??
            (toleranceMode === 'child'
              ? activeStroke.toleranceRadius * 1.45
              : toleranceMode === 'strict'
                ? activeStroke.toleranceRadius * 0.75
                : activeStroke.toleranceRadius);
          ctx.beginPath();
          ctx.arc(wp.x, wp.y, tolRadius, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(251, 191, 36, 0.10)';
          ctx.fill();
          ctx.setLineDash([3, 3]);
          ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }

        // Waypoint node circle
        ctx.beginPath();
        ctx.arc(wp.x, wp.y, isNextTarget ? 11 : 8, 0, Math.PI * 2);
        ctx.fillStyle = isUnlocked
          ? '#10b981'
          : isNextTarget
            ? '#f59e0b'
            : 'rgba(30, 41, 59, 0.9)';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = isUnlocked
          ? '#a7f3d0'
          : isNextTarget
            ? '#fef3c7'
            : 'rgba(148, 163, 184, 0.5)';
        ctx.stroke();

        // Waypoint index label
        ctx.fillStyle = isUnlocked || isNextTarget ? '#0f172a' : '#e2e8f0';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(wpIdx + 1), wp.x, wp.y);
        ctx.restore();
      });
    }
  }, [lastEval, showGhostGuide, showWaypoints, toleranceMode]);

  // Reset evaluator when character or tolerance mode changes
  useEffect(() => {
    evaluatorRef.current = new TracingEvaluator(dataset, { mode: toleranceMode });
    activeTrailRef.current = [];
    particlesRef.current = [];
    setLastEval(null);
    setProgress(evaluatorRef.current.getProgress());
    setIsAutoDemoPlaying(false);
  }, [dataset, toleranceMode]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas, progress, lastEval]);

  const toCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>): Point2D => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = 300 / rect.width;
    const scaleY = 300 / rect.height;
    return {
      x: Math.max(0, Math.min(300, (e.clientX - rect.left) * scaleX)),
      y: Math.max(0, Math.min(300, (e.clientY - rect.top) * scaleY)),
      timestamp: performance.now(),
    };
  };

  const spawnChalkDust = (pt: Point2D) => {
    for (let i = 0; i < 2; i++) {
      particlesRef.current.push({
        x: pt.x + (Math.random() - 0.5) * 10,
        y: pt.y + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 0.6,
        vy: Math.random() * 0.8,
        alpha: 0.55,
        radius: 1 + Math.random() * 1.5,
      });
    }
    if (particlesRef.current.length > 60) {
      particlesRef.current.splice(0, particlesRef.current.length - 60);
    }
  };

  const processPointerSample = (pt: Point2D) => {
    const evaluator = evaluatorRef.current;
    const prevUnlocked = evaluator.getProgress().unlockedWaypointsInCurrentStroke;
    const step = evaluator.evaluatePointerSample(pt);
    const updatedProgress = evaluator.getProgress();

    activeTrailRef.current.push(step.smoothedPoint);
    spawnChalkDust(step.smoothedPoint);

    if (step.topologicalViolation) {
      playTopologicalWarningSound();
    } else if (step.letterCompleted) {
      activeTrailRef.current = [];
      playStrokeSuccessSound(true);
      speakNepaliPhonics(dataset.phonetics.audioPrompt, dataset.phonetics.romanized);
    } else if (step.strokeCompleted) {
      activeTrailRef.current = [];
      playStrokeSuccessSound(false);
    } else if (updatedProgress.unlockedWaypointsInCurrentStroke > prevUnlocked) {
      playWaypointChime(updatedProgress.unlockedWaypointsInCurrentStroke);
    }

    setLastEval(step);
    setProgress(updatedProgress);
    renderCanvas();
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isAutoDemoPlaying || progress.isLetterComplete) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    activeTrailRef.current = [];
    processPointerSample(toCanvasCoords(e));
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || isAutoDemoPlaying || progress.isLetterComplete) return;
    processPointerSample(toCanvasCoords(e));
  };

  const handlePointerUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    activeTrailRef.current = [];
    renderCanvas();
  };

  const handleReset = () => {
    setIsAutoDemoPlaying(false);
    evaluatorRef.current.reset();
    activeTrailRef.current = [];
    particlesRef.current = [];
    setLastEval(null);
    setProgress(evaluatorRef.current.getProgress());
    renderCanvas();
  };

  const handlePlayAutoDemo = () => {
    if (isAutoDemoPlaying) return;
    evaluatorRef.current.reset();
    activeTrailRef.current = [];
    particlesRef.current = [];
    setIsAutoDemoPlaying(true);

    // Flatten all strokes into interpolated animation frames
    const frames: Point2D[] = [];
    dataset.strokes.forEach((stroke) => {
      for (let i = 0; i < stroke.waypoints.length - 1; i++) {
        const a = stroke.waypoints[i];
        const b = stroke.waypoints[i + 1];
        const steps = 8;
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          frames.push({
            x: a.x + (b.x - a.x) * t,
            y: a.y + (b.y - a.y) * t,
          });
        }
      }
    });

    let frameIdx = 0;
    const interval = setInterval(() => {
      if (frameIdx >= frames.length) {
        clearInterval(interval);
        setIsAutoDemoPlaying(false);
        return;
      }
      processPointerSample(frames[frameIdx]);
      frameIdx += 1;
    }, 35);
  };

  const currentStroke = evaluatorRef.current.getCurrentStroke();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Column: Character Selector & Pati Slate Canvas */}
      <div className="lg:col-span-7 flex flex-col gap-4">
        {/* Character Deck Bar */}
        <div className="bg-slate-900/90 border border-amber-500/20 rounded-2xl p-4 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              अक्षर छान्नुहोस् • Select Character to Trace on Pati (पाटी)
            </span>
            <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
              {(['child', 'standard', 'strict'] as LearnerToleranceMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setToleranceMode(mode)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                    toleranceMode === mode
                      ? 'bg-amber-500 text-slate-950 font-semibold shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {mode === 'child'
                    ? 'Child Jitter (1.45x)'
                    : mode === 'standard'
                      ? 'Standard (1.0x)'
                      : 'Strict (0.75x)'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            {(
              [
                { id: 'all', label: `सबै • All (${STROKE_LIST.length})` },
                { id: 'swor', label: `स्वर वर्ण • Swor (${sworCount}/13)` },
                { id: 'vyanjan', label: `व्यञ्जन वर्ण • Vyanjan (${vyanjanCount})` },
              ] as Array<{ id: DeckCategoryFilter; label: string }>
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCategoryFilter(tab.id)}
                className={`px-3 py-1 rounded-lg text-xs font-medium border transition ${
                  categoryFilter === tab.id
                    ? 'bg-amber-500/20 border-amber-400/70 text-amber-200'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 max-h-52 overflow-y-auto pr-1">
            {filteredStrokeList.map((item) => {
              const active = item.id === selectedLetterId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedLetterId(item.id)}
                  className={`flex flex-col items-center justify-center py-2 px-1.5 rounded-xl border transition ${
                    active
                      ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-md'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <span className="text-2xl font-bold">{item.character}</span>
                  <span className="text-[11px] text-slate-400 mt-0.5">
                    {item.phonetics.romanized} ({item.strokes.length})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Traditional Wooden Pati Frame + Slate Canvas */}
        <div className="relative rounded-3xl p-4 sm:p-5 bg-gradient-to-br from-amber-950 via-stone-900 to-amber-950 border-4 border-amber-900/80 shadow-2xl">
          {/* Top Slate Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3 px-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                <Sparkles className="w-3.5 h-3.5" />
                पाटी लेखन (Pati Wooden Slate)
              </span>
              <button
                type="button"
                onClick={() =>
                  speakNepaliPhonics(dataset.phonetics.audioPrompt, dataset.phonetics.romanized)
                }
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition"
              >
                <Volume2 className="w-3.5 h-3.5" />
                सुन्नुहोस् ({dataset.phonetics.nepaliName})
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowGhostGuide((v) => !v)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border transition ${
                  showGhostGuide
                    ? 'bg-sky-500/20 border-sky-500/40 text-sky-200'
                    : 'bg-slate-900 border-slate-700 text-slate-400'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Ghost Guide
              </button>
              <button
                type="button"
                onClick={handlePlayAutoDemo}
                disabled={isAutoDemoPlaying}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-500/20 border border-amber-500/40 text-amber-200 hover:bg-amber-500/30 disabled:opacity-50 transition"
              >
                <Play className="w-3.5 h-3.5" />
                {isAutoDemoPlaying ? 'Tracing...' : 'Auto-Trace Demo'}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                पुछ्नुहोस् (Wipe Slate)
              </button>
            </div>
          </div>

          {/* Interactive HTML5 Canvas */}
          <div className="relative mx-auto w-full max-w-[420px] aspect-square rounded-2xl overflow-hidden border-2 border-stone-700 shadow-inner bg-[#12161b]">
            <canvas
              ref={canvasRef}
              width={300}
              height={300}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              className="w-full h-full touch-none cursor-crosshair select-none"
            />

            {/* Celebration Overlay when all strokes are completed */}
            {progress.isLetterComplete && (
              <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center animate-fade-in">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-4xl font-bold text-amber-200 mb-3">
                  {dataset.character}
                </div>
                <h3 className="text-lg font-bold text-emerald-300">
                  स्याबास! {dataset.phonetics.nepaliName} पूरा भयो!
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  Accuracy: <span className="font-bold text-amber-300">{progress.accuracyScore}%</span> •{' '}
                  {'⭐'.repeat(progress.stars)}
                </p>
                <div className="flex items-center gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() =>
                      speakNepaliPhonics(dataset.phonetics.audioPrompt, dataset.phonetics.romanized)
                    }
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition"
                  >
                    <Volume2 className="w-4 h-4" />
                    उच्चारण सुन्नुहोस् (Hear Phonics)
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500/20 border border-amber-400/50 text-amber-200 hover:bg-amber-500/30 transition"
                  >
                    <RotateCcw className="w-4 h-4" />
                    फेरि लेख्नुहोस् (Trace Again)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Pedagogical Instruction Banner below canvas */}
          <div
            className={`mt-3 rounded-xl p-3 border text-xs flex items-start gap-2.5 ${
              lastEval?.topologicalViolation
                ? 'bg-red-950/60 border-red-500/50 text-red-200'
                : progress.isLetterComplete
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                  : 'bg-slate-900/90 border-amber-500/30 text-amber-100'
            }`}
          >
            {lastEval?.topologicalViolation ? (
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-semibold">
                {lastEval?.pedagogicalHint ??
                  (currentStroke
                    ? `चरण ${currentStroke.order}/${dataset.strokes.length}: ${currentStroke.nepaliInstruction}`
                    : 'अक्षर पूरा भयो!')}
              </p>
              {currentStroke && !progress.isLetterComplete && (
                <p className="text-slate-400 mt-0.5">{currentStroke.englishInstruction}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Topological Stroke Order, Math Telemetry & Vocabulary */}
      <div className="lg:col-span-5 flex flex-col gap-4">
        {/* Character Phonetics & Articulation Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-4xl font-bold text-amber-300">
                {dataset.character}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white">{dataset.phonetics.nepaliName}</h2>
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-slate-800 text-sky-300">
                    {dataset.phonetics.ipa}
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-slate-800 text-slate-400">
                    {dataset.unicode}
                  </span>
                </div>
                <p className="text-xs text-amber-400/90 mt-0.5">{dataset.varga}</p>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  {dataset.phonetics.articulationTip}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Devanagari Topological Stroke Sequence */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Devanagari Topological Stroke Order
            </h3>
            <span className="text-xs font-mono text-amber-400">
              {Math.round(progress.overallCompletionRatio * 100)}% Complete
            </span>
          </div>

          <div className="space-y-2">
            {dataset.strokes.map((stroke, idx) => {
              const isDone = idx < progress.completedStrokeIds.length;
              const isCurrent = !progress.isLetterComplete && idx === progress.currentStrokeIndex;

              return (
                <div
                  key={stroke.id}
                  className={`p-3 rounded-xl border transition flex items-center justify-between gap-3 ${
                    isDone
                      ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                      : isCurrent
                        ? 'bg-amber-500/15 border-amber-500/50 text-amber-100'
                        : 'bg-slate-950/50 border-slate-800/80 text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
                        isDone
                          ? 'bg-emerald-500 text-slate-950'
                          : isCurrent
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {isDone ? '✓' : stroke.order}
                    </span>
                    <div>
                      <div className="text-xs font-semibold">{stroke.label}</div>
                      <div className="text-[11px] opacity-80">{stroke.englishInstruction}</div>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                      stroke.type === 'shirorekha'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : stroke.type === 'stem'
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                          : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    }`}
                  >
                    {stroke.type}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Algorithmic Telemetry */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-400" />
              Vector Evaluator Telemetry (@akshara/core)
            </h3>
            <span className="text-xs font-mono text-emerald-400">
              Score: {progress.accuracyScore}%
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5">
              <div className="text-[10px] text-slate-400 uppercase">Target Dist (d)</div>
              <div className="text-sm font-mono font-bold text-sky-300 mt-0.5">
                {lastEval ? `${lastEval.distanceToTargetWaypoint}px` : '—'}
              </div>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5">
              <div className="text-[10px] text-slate-400 uppercase">Tolerance (r)</div>
              <div className="text-sm font-mono font-bold text-amber-300 mt-0.5">
                {lastEval
                  ? `${lastEval.effectiveTolerance}px`
                  : `${currentStroke?.toleranceRadius ?? 28}px`}
              </div>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5">
              <div className="text-[10px] text-slate-400 uppercase">Waypoints</div>
              <div className="text-sm font-mono font-bold text-emerald-300 mt-0.5">
                {progress.unlockedWaypointsInCurrentStroke}/
                {progress.totalWaypointsInCurrentStroke}
              </div>
            </div>
          </div>

          <p className="text-[11px] font-mono text-slate-400 mt-2.5 bg-slate-950/70 p-2 rounded-lg border border-slate-800/80">
            Check: √((x_p - x_w)² + (y_p - y_w)²) ≤ r_adaptive • Shirorekha Enforced Last: TRUE
          </p>
        </div>

        {/* Sample Vocabulary Cards */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-3">
            शब्द भण्डार • Words Starting With &ldquo;{dataset.character}&rdquo; (Tap to Hear)
          </h3>
          <div className="grid grid-cols-3 gap-2.5">
            {dataset.vocabulary.map((vocab) => (
              <button
                key={vocab.word}
                type="button"
                onClick={() => speakNepaliPhonics(vocab.word, vocab.romanized)}
                className="flex flex-col items-center p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-amber-500/40 transition group"
              >
                <span className="text-2xl mb-1">{vocab.emoji}</span>
                <span className="text-base font-bold text-amber-200 group-hover:text-amber-300">
                  {vocab.word}
                </span>
                <span className="text-[11px] text-slate-400">
                  {vocab.romanized} • {vocab.meaning}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

