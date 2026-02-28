import { expect, test } from '@playwright/test';
import { registerAndLogin } from './helpers/auth';

/**
 * 404/500 统一错误结构契约：{ success: false, error: string, code?: string }
 * 前端消费：可依赖 success、error、code 做统一错误提示
 */
test('已登录时请求不存在的 /api/nodes/:id 返回 404 及统一错误结构', async ({ page }) => {
  await registerAndLogin(page);
  const request = page.context().request;

  const res = await request.get('/api/nodes/non-existent-id-404-test');
  expect(res.status()).toBe(404);
  const json = await res.json();
  expect(json.success).toBe(false);
  expect(json.error).toBeDefined();
  expect(typeof json.error).toBe('string');
});
