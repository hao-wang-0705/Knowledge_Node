import type { Page } from '@playwright/test';

export async function registerAndLogin(page: Page): Promise<{ email: string; password: string }> {
  const stamp = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const email = `e2e_${stamp}@example.com`;
  const password = 'e2e-pass-123456';

  await page.goto('/register');
  await page.getByLabel('昵称').fill(`E2E_${stamp}`);
  await page.getByLabel('邮箱').fill(email);
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByLabel('确认密码').fill(password);
  await page.getByRole('button', { name: '注册' }).click();
  await page.waitForURL('**/');

  return { email, password };
}
