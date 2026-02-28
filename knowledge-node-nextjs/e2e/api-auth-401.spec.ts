import { expect, test } from '@playwright/test';

test('未登录时 /api/nodes 返回 401 及统一错误结构', async ({ request }) => {
  const res = await request.get('/api/nodes');
  expect(res.status()).toBe(401);
  const json = await res.json();
  expect(json.success).toBe(false);
  expect(json.error).toBeDefined();
  expect(typeof json.error).toBe('string');
});

test('未登录时 /api/supertags 返回 401 及统一错误结构', async ({ request }) => {
  const res = await request.get('/api/supertags');
  expect(res.status()).toBe(401);
  const json = await res.json();
  expect(json.success).toBe(false);
  expect(json.error).toBeDefined();
});
