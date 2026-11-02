---
name: "📐 [Math / Core] Discrete Fréchet Distance & Catmull-Rom Spline Resampling for Child Jitter"
about: "Enhance @akshara/core stroke evaluation with arc-length resampling and discrete Fréchet trajectory similarity"
title: "feat(core): implement discrete Fréchet distance and Catmull-Rom resampling in tracing-evaluator.ts"
labels: ["math", "core"]
assignees: ""
---

## Context

`packages/core/src/tracing-evaluator.ts` currently validates strokes using sequential Euclidean waypoint unlocking ($\sqrt{(x_p - x_w)^2 + (y_p - y_w)^2} \le r_{\text{adaptive}}$), Exponential Moving Average (EMA) pointer smoothing, and perpendicular point-to-segment corridor checks.

To better grade freehand loops (`क`, `ख`, `घ`, `छ`) drawn at varying speeds by 4-to-7-year-old learners, we want to add **Discrete Fréchet Distance** and uniform arc-length resampling.

## Tasks

1. Implement `resamplePolylineByArcLength(points: Point2D[], numSamples: number): Point2D[]` in `packages/core/src/tracing-evaluator.ts`.
2. Implement `discreteFrechetDistance(curveP: Point2D[], curveQ: Point2D[]): number` using dynamic programming in $O(MN)$ time.
3. Combine the Fréchet similarity score with sequential waypoint completion to compute a smoother `accuracyScore` (0–100%).
4. Add unit tests in `packages/core/test/tracing-evaluator.test.ts` with synthetic high-jitter child pointer trajectories.
