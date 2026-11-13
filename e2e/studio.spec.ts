import { expect, test, type Page } from '@playwright/test';
import ka from '../packages/data/strokes/ka.json' with { type: 'json' };

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
  await page.goto('/');
});

test('studio loads with the Pati tracing slate active', async ({ page }) => {
  await expect(page).toHaveTitle(/Akshara/);
  await expect(page.getByRole('heading', { name: /Akshara/ })).toBeVisible();
  await expect(page.getByRole('img', { name: /Pati slate/ })).toBeVisible();
});

test('all four pedagogical tabs render their studios', async ({ page }) => {
  await page.getByRole('button', { name: /मात्रा र बाह्रखरी/ }).click();
  await expect(page.getByText(/Step 1: Choose Base Consonant/)).toBeVisible();

  await page.getByRole('button', { name: /शब्द र वाक्य/ }).click();
  await expect(page.getByText(/Sentence Unscrambler/)).toBeVisible();

  await page.getByRole('button', { name: /वर्णमाला/ }).click();
  await expect(page.getByText(/Swor Varna \(13 Nepali Vowels/)).toBeVisible();

  await page.getByRole('button', { name: /पाटी लेखन/ }).click();
  await expect(page.getByRole('img', { name: /Pati slate/ })).toBeVisible();
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
  await page.getByRole('button', { name: /मात्रा र बाह्रखरी/ }).click();
  // Tap the okar card (◌ो) in the palette
  await page.getByRole('button').filter({ hasText: '◌ो' }).first().click();
  await expect(page.getByRole('button', { name: /Speak[\s\S]*को/ })).toBeVisible();
});

test('SVO order in the sentence builder surfaces the SOV coaching tip', async ({ page }) => {
  await page.getByRole('button', { name: /शब्द र वाक्य/ }).click();

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
