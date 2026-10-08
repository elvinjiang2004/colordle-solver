import { setGameProfile } from '../../src/color/gameProfile';
setGameProfile('osmanyo');
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { parseDictionary, targetPool } from '../../src/color/dictionary';
import { colordleScore } from '../../src/color/colordleScore';
const dictionary = parseDictionary(readFileSync(new URL('../../src/data/colornames.csv', import.meta.url), 'utf8'));
const pool = targetPool(dictionary);

test('complete solver flow, workers, controls, and narrow layout', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(() => {
    const recorded: string[] = [];
    Object.assign(window, { __browserErrors: recorded });
    window.addEventListener('error', event => recorded.push(event.message));
    window.addEventListener('unhandledrejection', event => recorded.push(String(event.reason)));
  });
  await page.goto('/');
  await page.locator('#game-profile').selectOption('osmanyo');
  await expect(page.locator('#candidate-total')).toHaveText('4,736');
  await expect(page.locator('#scene canvas')).toBeVisible();
  await page.screenshot({ path: 'test-results/desktop-initial.png', fullPage: true });

  const target = pool.find(c => c.name === 'Lilac') ?? pool[157];
  const guesses = ['Gainsboro', 'Salmon', 'Black'].map(name => dictionary.find(c => c.name === name)!);
  const add = async (hex: string, score: number) => {
    await page.locator('#guess').fill(hex);
    await page.locator('#score').fill(score.toFixed(2));
    await page.locator('#submit-observation').click();
  };
  for (let i = 0; i < guesses.length; i++) {
    await add(guesses[i].hex, colordleScore(target.lab, guesses[i].lab));
    await expect(page.locator('#history .history-item')).toHaveCount(i + 1);
    if (i === 0) {
      await expect(page.locator('#candidate-total')).toHaveText('4');
    }
    expect(Number((await page.locator('#candidate-total').innerText()).replaceAll(',', ''))).toBeGreaterThan(0);
  }
  await expect(page.locator('#candidate-body')).toContainText(target.name);
  await expect(page.locator('#geometry-status')).toContainText('Numerical shells', { timeout: 30_000 });
  await page.getByRole('button', { name: target.name, exact: true }).click();
  await expect(page.locator('#scene-tooltip')).toContainText('Predicted scores');
  await expect(page.locator('#candidate-detail')).toContainText('L*');

  await page.getByRole('button', { name: 'Edit guess 2', exact: true }).click();
  await page.locator('#score').fill('100');
  await page.locator('#submit-observation').click();
  await expect(page.locator('#candidate-total')).toHaveText('0');
  await expect(page.locator('#candidate-body')).toContainText('No eligible target');
  await page.getByRole('button', { name: 'Edit guess 2', exact: true }).click();
  await page.locator('#score').fill(colordleScore(target.lab, guesses[1].lab).toFixed(2));
  await page.locator('#submit-observation').click();
  await expect(page.locator('#candidate-body')).toContainText(target.name);
  await page.getByRole('button', { name: 'Remove guess 3', exact: true }).click();
  await expect(page.locator('#history .history-item')).toHaveCount(2);

  const canvas = page.locator('#scene canvas');
  const before = await canvas.screenshot();
  const bounds = (await canvas.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 90, bounds.y + bounds.height / 2 + 35, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(350);
  expect(Buffer.compare(before, await canvas.screenshot())).not.toBe(0);
  await page.mouse.wheel(0, -160);
  await page.getByRole('button', { name: 'Reset view' }).click();
  await canvas.focus();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('+');
  await page.keyboard.press('Home');
  await page.locator('[data-layer="shells"]').uncheck();
  await page.locator('[data-layer="shells"]').check();
  await page.locator('[data-layer="eliminated"]').check();
  await page.locator('#quality').selectOption('high');
  await expect(page.locator('#geometry-status')).toContainText('high quality', { timeout: 30_000 });
  await page.locator('#candidate-sort').selectOption('estimate');
  await page.locator('#candidate-sort').selectOption('latest');
  await page.locator('#history [data-select]').first().click();
  await expect(page.locator('#history [data-select]').first()).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: 'test-results/desktop-solved.png', fullPage: true });

  await page.getByRole('button', { name: 'Clear observations' }).click();
  await expect(page.locator('#candidate-total')).toHaveText('4,736');
  await page.locator('#guess').fill('Gain');
  await expect(page.locator('#suggestions')).toBeVisible();
  await page.locator('#guess').press('ArrowDown');
  await page.locator('#guess').press('Enter');
  await expect(page.locator('#guess')).toHaveValue('Gainsboro');
  await page.locator('#score').fill('101');
  await page.locator('#submit-observation').click();
  await expect(page.locator('#form-error')).toBeVisible();
  await expect(page.locator('#history .history-item')).toHaveCount(0);
  await add('#000000', 100);
  await expect(page.locator('#candidate-body')).toContainText('Black');
  await expect(page.locator('#geometry-status')).toContainText('Numerical shells');
  await page.getByRole('button', { name: 'Clear observations' }).click();
  await add('#00ff00', 0);
  await expect(page.locator('#history')).toContainText('0.00%');
  await expect(page.locator('#geometry-status')).toContainText('Numerical shells');

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#submit-observation')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => (window as unknown as { __browserErrors: string[] }).__browserErrors)).toEqual([]);
});
