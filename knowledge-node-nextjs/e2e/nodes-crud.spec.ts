import { expect, test } from '@playwright/test';
import { registerAndLogin } from './helpers/auth';

test('节点 CRUD 端到端链路可用', async ({ page }) => {
  await registerAndLogin(page);
  const request = page.context().request;

  const createRes = await request.post('/api/nodes', {
    data: {
      content: 'E2E Node Root',
      nodeType: 'text',
    },
  });
  expect(createRes.ok()).toBeTruthy();
  const createJson = await createRes.json();
  expect(createJson.success).toBe(true);
  const nodeId = createJson.data.id as string;

  const getRes = await request.get(`/api/nodes/${nodeId}`);
  expect(getRes.ok()).toBeTruthy();
  const getJson = await getRes.json();
  expect(getJson.data.content).toBe('E2E Node Root');

  const updateRes = await request.patch(`/api/nodes/${nodeId}`, {
    data: { content: 'E2E Node Updated' },
  });
  expect(updateRes.ok()).toBeTruthy();
  const updateJson = await updateRes.json();
  expect(updateJson.data.content).toBe('E2E Node Updated');

  const deleteRes = await request.delete(`/api/nodes/${nodeId}`);
  expect(deleteRes.ok()).toBeTruthy();
  const deleteJson = await deleteRes.json();
  expect(deleteJson.success).toBe(true);

  const getAfterDeleteRes = await request.get(`/api/nodes/${nodeId}`);
  expect(getAfterDeleteRes.status()).toBe(404);
});
