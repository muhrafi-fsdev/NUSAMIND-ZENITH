import { test, expect } from '@playwright/test';
for (const width of [390, 1440]) {
  test(`legacy chat and native auth at ${width}px`, async ({ page, browser }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === new URL(info.project.use.baseURL!).origin ? route.continue() : route.abort());
    await page.goto('/');
    await expect(page.getByRole('textbox')).toBeVisible();
    await expect(page.locator('body')).toContainText('Zenith');
    const input = page.getByRole('textbox');
    await input.fill('hitung 12 + 8');
    await input.press('Enter');
    await expect(page.locator('body')).toContainText('20', { timeout: 15_000 });
    await expect(page.locator('body')).not.toContainText('401');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
    expect(errors).toEqual([]);
    await page.screenshot({ path: `docs/n2/evidence/chat-${width}.png`, fullPage: true });
    console.log(`Browser ${browser.version()}, viewport ${width}, rendered calculation and keyboard focus verified.`);
  });
}
