import { expect, test, type Page } from '@playwright/test';
import ka from '../packages/data/strokes/ka.json' with { type: 'json' };
import num4 from '../packages/data/strokes/num-4.json' with { type: 'json' };
import num2 from '../packages/data/strokes/num-2.json' with { type: 'json' };

const LOGICAL_SIZE = 300;

interface Waypoint {
  x: number;
  y: number;
}

/**
 * Traces one stroke on the Pati canvas with real mouse gestures, mapping
 * 300x300 logical waypoint coordinates onto the canvas' on-screen box.
 */
async function traceStroke(page: Page, waypoints: Waypoint[]): Promise<void> {
  const canvas = page.getByRole('img', { name: /Pati slate/ });
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  const toScreen = (wp: Waypoint) => ({
    x: box.x + (wp.x / LOGICAL_SIZE) * box.width,
    y: box.y + (wp.y / LOGICAL_SIZE) * box.height,
  });

  const [first, ...rest] = waypoints;
  const start = toScreen(first);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (const wp of rest) {
    const target = toScreen(wp);
    await page.mouse.move(target.x, target.y, { steps: 12 });
  }
  // Settle on the final waypoint so the jitter smoothing converges
  const last = toScreen(waypoints[waypoints.length - 1]);
  for (let i = 0; i < 4; i++) {
    await page.mouse.move(last.x + (i % 2), last.y);
  }
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/student/trace/');
});

test('the student slate loads with the Pati tracing slate active', async ({ page }) => {
  await expect(page).toHaveTitle(/Akshara/);
  await expect(page.getByRole('img', { name: /Pati slate/ })).toBeVisible();
});

test('the role chooser leads to the three experiences', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Student/ }).click();
  await expect(page.getByRole('navigation', { name: 'Student doors' })).toBeVisible();
  await page.getByRole('link', { name: /Akshara home/ }).click();
  await page.getByRole('link', { name: /Parent/ }).click();
  await expect(page.getByText(/Grown-ups only/)).toBeVisible();
});

test('every student activity page renders its studio', async ({ page }) => {
  await page.goto('/student/matras/');
  await expect(page.getByRole('heading', { name: /Add a matra sign/ })).toBeVisible();

  await page.goto('/student/words/');
  await page.getByRole('tab', { name: /Make Sentences/ }).click();
  await expect(page.getByText(/Sentence Unscrambler/)).toBeVisible();

  await page.goto('/student/alphabet/');
  await expect(page.getByText(/Swor Varna \(13 Nepali Vowels/)).toBeVisible();

  await page.goto('/student/quiz/');
  await expect(page.getByRole('heading', { name: /Letter quiz/ })).toBeVisible();

  // The student home guides: one "next" card and three doors
  await page.goto('/student/');
  await expect(page.getByRole('link', { name: /^Next: write/ })).toBeVisible();
  const doors = page.getByRole('navigation', { name: 'Student doors' });
  await doors.getByRole('link', { name: /Write/ }).click();
  await expect(page.getByRole('list', { name: 'Lesson map' })).toBeVisible();
  await page.getByRole('link', { name: /^Vowels/ }).click();
  await page.getByRole('link', { name: 'Write अ', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Pati slate for tracing अ' })).toBeVisible();
});

test('learner can trace क stroke by stroke to the celebration overlay', async ({ page }) => {
  for (const stroke of ka.strokes) {
    await traceStroke(page, stroke.waypoints);
  }
  await expect(page.getByText(/स्याबास!.*पूरा भयो!/)).toBeVisible();
  await expect(page.getByText(/Accuracy:/)).toBeVisible();
});

test('drawing the Shirorekha first triggers the topological guardrail', async ({ page }) => {
  const headline = ka.strokes.find((s) => s.type === 'shirorekha')!;
  await traceStroke(page, headline.waypoints);
  await expect(page.getByText(/शिरोरेखा.*अन्त्यमा मात्र/).first()).toBeVisible();
});

test('matra fusion anvil updates when a matra card is tapped', async ({ page }) => {
  await page.goto('/student/matras/');
  // Tap the okar card (◌ो) in the palette
  await page.getByRole('button').filter({ hasText: '◌ो' }).first().click();
  await expect(page.getByRole('button', { name: /Speak[\s\S]*को/ })).toBeVisible();
});

test('SVO order in the sentence builder surfaces the SOV coaching tip', async ({ page }) => {
  await page.goto('/student/words/');
  await page.getByRole('tab', { name: /Make Sentences/ }).click();

  // sov-1: राम (S) घर (O) जान्छ (V) — tap in English SVO order
  const token = (romanized: string, gloss: string) =>
    page
      .getByRole('button')
      .filter({ hasText: romanized })
      .filter({ hasText: `“${gloss}”` });

  await token('Raam', 'Ram').click();
  await token('jaanchha', 'goes').click();
  await token('ghar', 'home').click();

  await expect(page.getByText(/You used English SVO order/)).toBeVisible();
});

test('theme toggle switches light/dark and persists across reloads', async ({ page }) => {
  const html = page.locator('html');
  await page.getByRole('radio', { name: 'Dark theme' }).click();
  await expect(html).toHaveClass(/dark/);
  await page.reload();
  await expect(html).toHaveClass(/dark/);
  await expect(page.getByRole('radio', { name: 'Dark theme' })).toHaveAttribute(
    'aria-checked',
    'true'
  );

  await page.getByRole('radio', { name: 'Light theme' }).click();
  await expect(html).not.toHaveClass(/dark/);
});

test('auto theme follows the OS color scheme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).not.toHaveClass(/dark/);
});

/**
 * Points every `spacing` units along a stroke's authored curve, sampled by the browser's own
 * SVG engine — a faithful trace (straight dot-to-dot lines would be rejected as cut corners).
 */
async function curvePoints(page: Page, svgPath: string, spacing = 6): Promise<Waypoint[]> {
  return page.evaluate(
    ({ d, step }) => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      svg.appendChild(path);
      document.body.appendChild(svg);
      const total = path.getTotalLength();
      const pts: { x: number; y: number }[] = [];
      for (let s = 0; s < total; s += step) {
        const p = path.getPointAtLength(s);
        pts.push({ x: p.x, y: p.y });
      }
      const end = path.getPointAtLength(total);
      pts.push({ x: end.x, y: end.y });
      svg.remove();
      return pts;
    },
    { d: svgPath, step: spacing }
  );
}

test('numbers: a learner traces ४२ digit by digit and hears its name', async ({ page }) => {
  await page.goto('/student/numbers/');
  await page.getByRole('button', { name: /^४२ \(42\)/ }).click();
  await expect(page.getByRole('heading', { name: 'बयालीस' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Pati slate for tracing ४' })).toBeVisible();

  // Digits are traced along their curves: straight dot-to-dot lines would be cut corners.
  for (const stroke of num4.strokes)
    await traceStroke(page, await curvePoints(page, stroke.svgPath));
  // The "now write २" banner only shows for a short pause; assert where the flow lands instead.
  await expect(page.getByRole('listitem', { name: 'Digit ४: done' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Pati slate for tracing २' })).toBeVisible();

  for (const stroke of num2.strokes)
    await traceStroke(page, await curvePoints(page, stroke.svgPath));
  await expect(
    page.getByRole('heading', { name: 'स्याबास! तपाईंले ४२ (बयालीस) लेख्नुभयो!' })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /^४२ \(42\), \d stars/ })).toBeVisible();
});
