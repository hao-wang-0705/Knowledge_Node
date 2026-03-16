import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockedApiClient } = vi.hoisted(() => ({
  mockedApiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/services/api/client', () => ({
  __esModule: true,
  default: mockedApiClient,
}));

import { nodesApi } from '@/services/api/nodes';

describe('nodesApi.getMentionedBy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('会把后端提及结果转换为前端 Node 结构', async () => {
    mockedApiClient.get.mockResolvedValueOnce([
      {
        node: {
          id: 'src-1',
          content: 'source',
          type: 'text',
          parentId: null,
          childrenIds: [],
          isCollapsed: false,
          fields: {},
          tags: [],
          references: [],
          createdAt: new Date('2026-03-12T00:00:00.000Z').toISOString(),
          updatedAt: new Date('2026-03-12T00:00:00.000Z').toISOString(),
        },
        breadcrumbs: [{ id: 'p1', title: '父节点' }],
        sourceType: 'reference',
      },
    ]);

    const result = await nodesApi.getMentionedBy('target-1');

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/nodes/target-1/mentioned-by');
    expect(result).toHaveLength(1);
    expect(result[0].node.id).toBe('src-1');
    expect(result[0].node.createdAt).toBeTypeOf('number');
    expect(result[0].breadcrumbs[0]).toEqual({ id: 'p1', title: '父节点' });
    expect(result[0].sourceType).toBe('reference');
  });
});
