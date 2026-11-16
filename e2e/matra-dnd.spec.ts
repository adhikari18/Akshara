/**
 * Drag-and-drop regression coverage for the Matra builder (roadmap 2.6): HTML5 drag of a matra
 * card onto the "magic box" drop zone, the drag-over highlight, and drops that must do nothing.
 */
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: /मात्रा र बाह्रखरी/ }).click();
});

const card = (page: import('@playwright/test').Page, id: string) =>
  page.locator(`[data-testid="matra-card"][data-matra-id="${id}"]`);
const anvil = (page: import('@playwright/test').Page) => page.getByTestId('matra-anvil');
const speak = (page: import('@playwright/test').Page, syllable: string) =>
  page.getByRole('button', { name: new RegExp(`^Speak ${syllable} `) });

test('dragging a matra onto the drop zone fuses it with the consonant', async ({ page }) => {
  await expect(speak(page, 'कि')).toBeVisible(); // default क + ि
  await card(page, 'o').dragTo(anvil(page));
  await expect(speak(page, 'को')).toBeVisible();
  await expect(card(page, 'o')).toHaveAttribute('aria-pressed', 'true');
});

test('the drop zone lights up while a matra is dragged over it, and clears after', async ({
  page,
}) => {
  // Step through the HTML5 drag lifecycle with one shared DataTransfer, so the intermediate
  // "dragging over" state can be observed (a single dragTo() jumps straight to the drop).
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await expect(anvil(page)).toHaveAttribute('data-drag-over', 'false');
  await card(page, 'u').dispatchEvent('dragstart', { dataTransfer });
  await anvil(page).dispatchEvent('dragenter', { dataTransfer });
  await anvil(page).dispatchEvent('dragover', { dataTransfer });
  await expect(anvil(page)).toHaveAttribute('data-drag-over', 'true');
  // Leaving without dropping clears the highlight and changes nothing
  await anvil(page).dispatchEvent('dragleave', { dataTransfer });
  await expect(anvil(page)).toHaveAttribute('data-drag-over', 'false');
  await expect(speak(page, 'कि')).toBeVisible();
  // Coming back and dropping fuses the matra and clears the highlight
  await anvil(page).dispatchEvent('dragover', { dataTransfer });
  await anvil(page).dispatchEvent('drop', { dataTransfer });
  await expect(anvil(page)).toHaveAttribute('data-drag-over', 'false');
  await expect(speak(page, 'कु')).toBeVisible();
});

test('dropping anywhere else changes nothing', async ({ page }) => {
  await card(page, 'aa').dragTo(page.getByRole('heading', { name: /Pick a letter/ }));
  await expect(speak(page, 'कि')).toBeVisible();
  await expect(anvil(page)).toHaveAttribute('data-drag-over', 'false');
});

test('a dropped matra stays applied when the base consonant changes', async ({ page }) => {
  await card(page, 'e').dragTo(anvil(page));
  await expect(speak(page, 'के')).toBeVisible();
  await page.getByRole('button', { pressed: false }).filter({ hasText: /^गga$/ }).click();
  await expect(speak(page, 'गे')).toBeVisible();
});

test('every matra card can be dropped and fuses correctly', async ({ page }) => {
  const ids = await page
    .locator('[data-testid="matra-card"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-matra-id')!));
  expect(ids.length).toBeGreaterThanOrEqual(13);
  for (const id of ids) {
    const sign = (await card(page, id).locator('span').first().textContent())!.replace('◌', '');
    await card(page, id).dragTo(anvil(page));
    const expected = sign === 'अ' ? 'क' : `क${sign}`;
    await expect(speak(page, expected), `matra ${id}`).toBeVisible();
  }
});
