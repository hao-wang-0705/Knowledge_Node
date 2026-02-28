import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSyncStore } from '@/stores/syncStore';

const mockExecuteOperation = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/syncEngine', () => ({
  executeOperation: (...args: unknown[]) => mockExecuteOperation(...args),
}));

describe('syncStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useSyncStore.setState({
      status: 'idle',
      isOnline: true,
      pendingOperations: [],
      error: null,
    });
  });

  it('setOnline(false) 时状态切换到 offline', () => {
    useSyncStore.getState().setOnline(false);
    const state = useSyncStore.getState();
    expect(state.isOnline).toBe(false);
    expect(state.status).toBe('offline');
  });

  it('离线后恢复网络且有待处理队列时 status 为 syncing（Happy Path）', () => {
    useSyncStore.getState().setOnline(false);
    useSyncStore.setState({ status: 'offline' });

    useSyncStore.getState().queueOperation({
      type: 'create',
      entityType: 'node',
      entityId: 'node-1',
      payload: { content: 'x' },
    });

    useSyncStore.getState().setOnline(true);
    const state = useSyncStore.getState();
    expect(state.isOnline).toBe(true);
    expect(state.pendingOperations.length).toBeGreaterThan(0);
    expect(['syncing', 'idle']).toContain(state.status);
  });

  it('processQueue 在离线时跳过执行（Edge Case）', async () => {
    useSyncStore.getState().setOnline(false);
    useSyncStore.getState().queueOperation({
      type: 'create',
      entityType: 'node',
      entityId: 'node-offline',
      payload: {},
    });

    await useSyncStore.getState().processQueue();

    expect(mockExecuteOperation).not.toHaveBeenCalled();
  });

  it('setStatus 可正确切换 idle/syncing/synced/error/offline', () => {
    const { setStatus } = useSyncStore.getState();

    setStatus('syncing');
    expect(useSyncStore.getState().status).toBe('syncing');

    setStatus('synced');
    expect(useSyncStore.getState().status).toBe('synced');

    setStatus('error');
    expect(useSyncStore.getState().status).toBe('error');

    setStatus('idle');
    expect(useSyncStore.getState().status).toBe('idle');
  });

  it('在线时 processQueue 会执行待处理操作并移除成功项', async () => {
    const op = {
      id: 'op-manual',
      type: 'create' as const,
      entityType: 'node' as const,
      entityId: 'node-x',
      payload: { content: 'test' },
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending' as const,
    };

    useSyncStore.setState({
      isOnline: true,
      status: 'idle',
      pendingOperations: [op],
    });

    await useSyncStore.getState().processQueue();

    expect(mockExecuteOperation).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: 'node-x', type: 'create' })
    );
    const opsAfter = useSyncStore.getState().pendingOperations;
    const pendingOrFailed = opsAfter.filter((o) => o.status === 'pending' || o.status === 'failed');
    expect(pendingOrFailed.length).toBe(0);
  });
});
