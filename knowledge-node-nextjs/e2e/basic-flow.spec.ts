import { expect, test } from '@playwright/test';

test('主页可访问（基础冒烟）', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.ok()).toBeTruthy();
});
