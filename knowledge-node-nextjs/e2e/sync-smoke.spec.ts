import { expect, test } from '@playwright/test';
import { registerAndLogin } from './helpers/auth';

test('节点写入后读侧结果一致（同步烟雾）', async ({ page }) => {
  await registerAndLogin(page);
  const request = page.context().request;

  const createRes = await request.post('/api/nodes', {
    data: { content: 'sync-smoke-initial', nodeType: 'text' },
  });
  const createJson = await createRes.json();
  const nodeId = createJson.data.id as string;
  expect(nodeId).toBeTruthy();

  await request.patch(`/api/nodes/${nodeId}`, {
    data: { content: 'sync-smoke-updated' },
  });

  const listRes = await request.get('/api/nodes');
  expect(listRes.ok()).toBeTruthy();
  const listJson = await listRes.json();
  const found = (listJson.data as Array<{ id: string; content: string }>).find((n) => n.id === nodeId);
  expect(found?.content).toBe('sync-smoke-updated');
});
