import { test, expect } from '@playwright/test';

test('keyboard autocomplete wraps upwards and closes after submitting a guess', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const guess = page.locator('#guess');
  await guess.fill('blue');
  const lastSuggestion = await page.locator('#suggestions [role=option]').last().innerText();
  await guess.press('ArrowUp');
  await guess.press('Enter');
  await expect(guess).toHaveValue(lastSuggestion);
  await expect(page.locator('#suggestions')).toBeHidden();

  await page.locator('#reset').click();
  await page.locator('#score').fill('66.87');
  await guess.fill('gre');
  await guess.press('ArrowDown');
  await expect(guess).toHaveAttribute('aria-activedescendant', 'suggestion-0');
  await guess.fill('green');
  await expect(guess).not.toHaveAttribute('aria-activedescendant');
  await guess.press('Enter');
  await expect(page.locator('#history .history-item')).toHaveCount(1);
  await expect(page.locator('#candidate-body')).toContainText('Silver');
  await expect(guess).toHaveValue('');
  await expect(guess).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#suggestions')).toBeHidden();
  expect(errors).toEqual([]);
});
