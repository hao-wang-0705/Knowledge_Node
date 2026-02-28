import { expect, test } from '@playwright/test';
import { registerAndLogin } from './helpers/auth';

test('标签创建并绑定到节点可用', async ({ page }) => {
  await registerAndLogin(page);
  const request = page.context().request;

  const supertagName = `E2E-Tag-${Date.now()}`;
  const createTagRes = await request.post('/api/supertags', {
    data: {
      name: supertagName,
      color: '#6366F1',
      fieldDefinitions: [],
    },
  });
  expect(createTagRes.ok()).toBeTruthy();
  const createTagJson = await createTagRes.json();
  const tagId = createTagJson.data.id as string;

  const createNodeRes = await request.post('/api/nodes', {
    data: {
      content: 'Node with tag',
      supertagId: tagId,
      fields: { source: 'e2e' },
    },
  });
  expect(createNodeRes.ok()).toBeTruthy();
  const createNodeJson = await createNodeRes.json();
  const nodeId = createNodeJson.data.id as string;
  expect(createNodeJson.data.supertagId).toBe(tagId);

  const getNodeRes = await request.get(`/api/nodes/${nodeId}`);
  const getNodeJson = await getNodeRes.json();
  expect(getNodeJson.data.supertagId).toBe(tagId);
});
