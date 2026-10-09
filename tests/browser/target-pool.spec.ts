import { test, expect } from '@playwright/test';

test('3D remaining points follow the selected target pool and observations', async ({ page }) => {
  // Count actual WebGL point draws, so a stray background cloud cannot hide
  // behind a correct candidate count in the HTML table.
  await page.addInitScript(() => {
    const state = window as unknown as { pointDrawCounts: number[] };
    state.pointDrawCounts = [];
    const prototype = WebGL2RenderingContext.prototype;
    const isScene = (gl: WebGL2RenderingContext) =>
      gl.canvas instanceof HTMLCanvasElement && gl.canvas.parentElement?.id === 'scene';
    const clear = prototype.clear;
    prototype.clear = function(mask: number) {
      if (isScene(this) && (mask & this.COLOR_BUFFER_BIT)) state.pointDrawCounts = [];
      return clear.call(this, mask);
    };
    const drawArrays = prototype.drawArrays;
    prototype.drawArrays = function(mode: number, first: number, count: number) {
      if (isScene(this) && mode === this.POINTS) state.pointDrawCounts.push(count);
      return drawArrays.call(this, mode, first, count);
    };
  });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('[data-layer="gamut"]').uncheck();
  const counts = () => page.evaluate(() => (window as unknown as { pointDrawCounts: number[] }).pointDrawCounts);
  const targetCount = async () => Number((await page.locator('#candidate-total').innerText()).replaceAll(',', ''));
  const expectOnlyRemaining = async () => {
    const remaining = await targetCount();
    await expect.poll(async () => {
      const draws = await counts();
      // Filtered candidates may also have a halo at each matching point.
      return draws.length > 0 && draws.length <= 2 && draws.every(count => count === remaining);
    }).toBe(true);
  };

  await expect(page.locator('#candidate-total')).toHaveText('479');
  await expect.poll(counts).toEqual([479]);
  await page.locator('#target-scope').selectOption('all');
  await expect(page.locator('#candidate-total')).toHaveText('31,896');
  await expect.poll(counts).toEqual([31896]);
  await page.locator('#target-scope').selectOption('eligible');
  await expect.poll(counts).toEqual([479]);

  await page.locator('#guess').fill('Green');
  await page.locator('#score').fill('66.87');
  await page.locator('#submit-observation').click();
  await expect(page.locator('#candidate-body')).toContainText('Silver');
  await expectOnlyRemaining();
  await page.locator('#target-scope').selectOption('all');
  await expectOnlyRemaining();
  await page.locator('#target-scope').selectOption('eligible');
  await expectOnlyRemaining();

  await page.locator('[data-layer="candidates"]').uncheck();
  await expect.poll(counts).toEqual([]);
  await page.locator('#reset').click();
  await page.locator('#target-scope').selectOption('all');
  await page.locator('[data-layer="candidates"]').check();
  await expect.poll(counts).toEqual([31896]);
  await page.locator('#target-scope').selectOption('eligible');
  await expect.poll(counts).toEqual([479]);
  expect(errors).toEqual([]);
});
