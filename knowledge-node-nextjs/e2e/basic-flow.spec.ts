import { expect, test } from '@playwright/test';
import { registerAndLogin } from './helpers/auth';

test('主页可访问（基础冒烟）', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.ok()).toBeTruthy();
});

/**
 * 登录后进入首页，断言大纲/编辑器区域存在，同步指示器可访问
 * 覆盖「手工冒烟：编辑器打开、同步指示器可用」
 */
test('登录后首页展示大纲与同步指示器（E2E 冒烟）', async ({ page }) => {
  await registerAndLogin(page);
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const main = page.getByRole('main');
  await expect(main).toBeVisible({ timeout: 5000 });

  const syncIndicator = page.getByRole('button', { name: /就绪|同步|已同步|离线|失败/ });
  await expect(syncIndicator).toBeVisible({ timeout: 3000 });

  // Nexus 品牌展示
  await expect(page.getByText('Nexus')).toBeVisible({ timeout: 3000 });
});
