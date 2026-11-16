/**
 * Canvas regression suite (roadmap 2.6).
 *
 * 1. Every fixture in e2e/fixtures/gestures/ is replayed on the slate and its recorded outcome
 *    asserted — add a fixture (generate or `npm run e2e:record`) and it becomes a test.
 * 2. Renderer features are checked by reading canvas pixels ("ink probes"), which works the same
 *    on every OS — unlike screenshot baselines, which differ with font rendering.
 */
import { expect, test } from '@playwright/test';
import {
  assertFixtureOutcome,
  colorDistance,
  curvePoints,
  isTeacherChalk,
  loadFixtures,
  loadStrokeJson,
  openTarget,
  readSlatePixels,
  replayGestures,
  strokesDone,
} from './support/gestures';

const fixtures = loadFixtures();

test.describe('gesture fixtures replayed on the Pati slate', () => {
  test('there is a baseline set of fixtures', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(8);
  });

  for (const fixture of fixtures) {
    test(`${fixture.name} (${fixture.source})`, async ({ page }) => {
      test.info().annotations.push({ type: 'fixture', description: fixture.description });
      await openTarget(page, fixture);
      await replayGestures(page, fixture.gestures);
      await assertFixtureOutcome(page, fixture);
    });
  }
});

test.describe('renderer pixel probes', () => {
  const ka = loadStrokeJson('ka');

  test('Stroke order guide paints each stroke in its own colour', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('switch', { name: /Stroke order guide/ }).click();
    // क's stem (stroke 2) is emerald, the Shirorekha (stroke 4) amber — probe away from badges,
    // waypoint rings and the text label
    const stem = (await curvePoints(page, ka.strokes[1]!.svgPath)).filter(
      (p) => p.y > 200 && p.y < 235
    );
    const headline = (await curvePoints(page, ka.strokes[3]!.svgPath)).filter((p) => p.x > 200);
    const stemPixels = await readSlatePixels(page, stem);
    const headlinePixels = await readSlatePixels(page, headline);
    for (const px of stemPixels) expect(colorDistance(px, '#34d399')).toBeLessThan(90);
    for (const px of headlinePixels) expect(colorDistance(px, '#fbbf24')).toBeLessThan(90);

    // Toggling it off removes the overlay
    await page.getByRole('switch', { name: /Stroke order guide/ }).click();
    const after = await readSlatePixels(page, stem);
    for (const px of after) expect(colorDistance(px, '#34d399')).toBeGreaterThan(90);
  });

  test('"Show me" draws teacher chalk along the curve without touching learner progress', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Show me/ }).click();
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: /Pause/ }).click();
    const loop = (await curvePoints(page, ka.strokes[0]!.svgPath)).slice(1, 8);
    const pixels = await readSlatePixels(page, loop);
    expect(pixels.filter(isTeacherChalk).length).toBeGreaterThanOrEqual(loop.length - 1);
    expect(await strokesDone(page)).toBe(0);
    await expect(page.getByRole('status')).toHaveText(/चरण 1\/4/);
  });

  test('a new letter repaints the slate (StrictMode frame-loop regression)', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('switch', { name: /Stroke order guide/ }).click();
    const kaStem = (await curvePoints(page, ka.strokes[1]!.svgPath)).filter((p) => p.y > 200);
    expect(colorDistance((await readSlatePixels(page, kaStem))[0]!, '#34d399')).toBeLessThan(90);
    await page.getByRole('button', { name: 'Next letter' }).click();
    const kha = loadStrokeJson('kha');
    await expect(
      page.getByRole('img', { name: `Pati slate for tracing ${kha.character}` })
    ).toBeVisible();
    // ख has no stroke at क's stem position: if the slate repainted, the emerald is gone there
    const repainted = await readSlatePixels(page, kaStem);
    expect(repainted.some((px) => colorDistance(px, '#34d399') > 90)).toBe(true);
  });
});

test.describe('layout stability while tracing', () => {
  // Every hint change (stroke done, mistakes, …) happens mid-gesture; the slate must not move.
  for (const width of [390, 768, 1024, 1280]) {
    test(`the slate never moves under the finger at ${width}px wide`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1600 });
      const fixture = fixtures.find((f) => f.name === 'ka-faithful')!;
      await openTarget(page, fixture);
      // replayGestures throws if the slate shifts during any gesture
      await replayGestures(page, fixture.gestures);
      await assertFixtureOutcome(page, fixture);
    });
  }
});
