import { test, expect } from '@playwright/test';

test('Ryan default preserves both reported targets and keeps profile changes consistent', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await expect(page.locator('#game-profile')).toHaveValue('ryan');
  const initial = await page.locator('#candidate-total').innerText();
  await page.locator('#guess').fill('green');
  await page.locator('#score').fill('66.87');
  await page.locator('#submit-observation').click();
  await expect(page.locator('#candidate-body')).toContainText('Silver');
  await expect(page.locator('#geometry-status')).toContainText('Numerical shells', { timeout: 30_000 });
  await page.locator('#reset').click();
  await page.locator('#guess').fill('aurora');
  await page.locator('#score').fill('60.33');
  await page.locator('#submit-observation').click();
  await expect(page.locator('#candidate-body')).toContainText('Pig Pink');
  await expect(page.locator('#geometry-status')).toContainText('Numerical shells', { timeout: 30_000 });
  await page.screenshot({ path: 'test-results/ryan-regression.png', fullPage: true });
  await page.locator('#target-scope').selectOption('all');
  expect(Number((await page.locator('#candidate-total').innerText()).replaceAll(',', ''))).toBeGreaterThan(0);
  await page.locator('#target-scope').selectOption('eligible');
  await expect(page.locator('#candidate-body')).toContainText('Pig Pink');
  await page.locator('#game-profile').selectOption('osmanyo');
  await expect(page.locator('#candidate-total')).toHaveText('4,736');
  await expect(page.locator('#history .history-item')).toHaveCount(0);
  await page.locator('#game-profile').selectOption('ryan');
  await expect(page.locator('#candidate-total')).toHaveText(initial);
  await page.locator('#guess').fill('pigpink');
  await page.locator('#score').fill('100');
  await page.locator('#submit-observation').click();
  await expect(page.locator('#candidate-body')).toContainText('Pig Pink');
  await expect(page.locator('#geometry-status')).toContainText('Numerical shells', { timeout: 30_000 });
  await page.locator('#reset').click();
  for (const width of [820, 390, 320]) {
    await page.setViewportSize({ width, height: 950 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect(errors).toEqual([]);
});
