import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SyncOperation } from '@/types/sync';
import {
  executeOperation,
  getRetryDelay,
  isRetryableError,
  mergeOperations,
} from '@/lib/syncEngine';

const {
  mockedNodesApi,
  mockedSupertagsApi,
  AuthenticationError,
} = vi.hoisted(() => ({
  mockedNodesApi: {
    create: vi.fn(async () => ({})),
    update: vi.fn(async () => ({})),
    delete: vi.fn(async () => ({})),
  },
  mockedSupertagsApi: {
    create: vi.fn(async () => ({})),
    update: vi.fn(async () => ({})),
    delete: vi.fn(async () => ({})),
  },
  AuthenticationError: class AuthenticationError extends Error {},
}));

vi.mock('@/services/api', () => ({
  nodesApi: mockedNodesApi,
  supertagsApi: mockedSupertagsApi,
  AuthenticationError,
}));

const createOperation = (overrides: Partial<SyncOperation>): SyncOperation => ({
  id: 'op-1',
  type: 'create',
  entityType: 'node',
  entityId: 'node-1',
  payload: {},
  timestamp: Date.now(),
  retryCount: 0,
  status: 'pending',
  ...overrides,
});

describe('syncEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('指数退避延迟按配置增长（无 jitter）', () => {
    const delay1 = getRetryDelay(0, {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 5000,
      backoffFactor: 2,
      jitter: false,
    });
    const delay2 = getRetryDelay(2, {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 5000,
      backoffFactor: 2,
      jitter: false,
    });

    expect(delay1).toBe(1000);
    expect(delay2).toBe(4000);
  });

  it('可重试错误识别正确', () => {
    expect(isRetryableError(new TypeError('fetch failed'))).toBe(true);
    expect(isRetryableError(new AuthenticationError('expired'))).toBe(false);

    const notRetryable = Object.assign(new Error('bad request'), { status: 404 });
    expect(isRetryableError(notRetryable)).toBe(false);
  });

  it('可执行 node create 操作', async () => {
    await executeOperation(createOperation({ type: 'create', entityType: 'node', payload: { content: 'x' } }));
    expect(mockedNodesApi.create).toHaveBeenCalledTimes(1);
  });

  it('delete 节点在服务端已不存在(404)时视为成功，不阻塞队列', async () => {
    const notFoundError = Object.assign(new Error('Not Found'), { status: 404 });
    mockedNodesApi.delete.mockRejectedValueOnce(notFoundError);

    await expect(
      executeOperation(
        createOperation({ type: 'delete', entityType: 'node', entityId: 'node-gone' })
      )
    ).resolves.toBeUndefined();
    expect(mockedNodesApi.delete).toHaveBeenCalledWith('node-gone', expect.any(Object));
  });

  it('连续操作可正确合并', () => {
    const ops: SyncOperation[] = [
      createOperation({ id: '1', type: 'create', payload: { content: 'a' } }),
      createOperation({ id: '2', type: 'update', payload: { content: 'b' } }),
      createOperation({ id: '3', type: 'delete' }),
    ];

    const merged = mergeOperations(ops);
    expect(merged).toHaveLength(0);
  });
});
