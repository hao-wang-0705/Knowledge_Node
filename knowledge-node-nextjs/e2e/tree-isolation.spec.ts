/**
 * ADR-005 树隔离：每日笔记树与笔记本树隔离、笔记本根节点删除保护
 */
import { expect, test } from '@playwright/test';
import { registerAndLogin } from './helpers/auth';

test('删除笔记本根节点返回 409 且提示通过删除笔记本操作', async ({ page }) => {
  await registerAndLogin(page);
  const request = page.context().request;

  const createNbRes = await request.post('/api/notebooks', {
    data: { name: 'E2E Tree Isolation Notebook' },
  });
  expect(createNbRes.ok()).toBeTruthy();
  const createNbJson = await createNbRes.json();
  expect(createNbJson.success).toBe(true);
  const rootNodeId = createNbJson.data.rootNodeId as string;
  expect(rootNodeId).toBeTruthy();

  const deleteNodeRes = await request.delete(`/api/nodes/${rootNodeId}`);
  expect(deleteNodeRes.status()).toBe(409);
  const deleteNodeJson = await deleteNodeRes.json();
  expect(deleteNodeJson.success).toBe(false);
  expect(deleteNodeJson.code).toBe('NOTEBOOK_ROOT');
  expect(deleteNodeJson.error).toContain('不能直接删除笔记本根节点');
});

test('GET /api/nodes 默认不包含笔记本树（scope 隔离）', async ({ page }) => {
  await registerAndLogin(page);
  const request = page.context().request;

  const createNbRes = await request.post('/api/notebooks', {
    data: { name: 'E2E Scope Isolation Notebook' },
  });
  expect(createNbRes.ok()).toBeTruthy();
  const createNbJson = await createNbRes.json();
  const rootNodeId = createNbJson.data.rootNodeId as string;

  const listRes = await request.get('/api/nodes');
  expect(listRes.ok()).toBeTruthy();
  const listJson = await listRes.json();
  const nodeIds = (listJson.data || []).map((n: { id: string }) => n.id);
  expect(nodeIds).not.toContain(rootNodeId);
});
