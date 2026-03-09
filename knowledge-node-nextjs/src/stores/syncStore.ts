/**
 * 同步状态管理 Store
 * 
 * 负责管理全局同步状态、离线操作队列和网络状态检测。
 * 与业务 Store（nodeStore、notebookStore）解耦，提供统一的同步基础设施。
 * 
 * v3.1 增强：
 * - 依赖图管理：跨批次的父子节点依赖追踪
 * - 就绪状态追踪：只有依赖满足的操作才能执行
 * - 完成通知机制：操作完成后广播通知下游依赖
 */

import { create } from 'zustand';
import { generateId, debounce } from '@/utils/helpers';
import {
  SyncStatus,
  SyncOperation,
  SyncStoreState,
  SyncStoreActions,
  SyncStore,
  CreateSyncOperationParams,
  SyncStats,
  DEFAULT_SYNC_CONFIG,
  DependencyReadyState,
} from '@/types/sync';
import { getUserStorageKey } from '@/utils/userStorage';

// =============================================================================
// 常量配置
// =============================================================================

const OFFLINE_QUEUE_BASE_KEY = DEFAULT_SYNC_CONFIG.queue.storageKey;
const COMPLETED_OPS_BASE_KEY = `${DEFAULT_SYNC_CONFIG.queue.storageKey}:completed`;
const MAX_QUEUE_SIZE = DEFAULT_SYNC_CONFIG.queue.maxSize;
const PERSIST_DEBOUNCE = DEFAULT_SYNC_CONFIG.queue.persistDebounce;
const BLOCKED_WATCHDOG_TTL_MS = 120000;
const getOfflineQueueKey = () => getUserStorageKey(OFFLINE_QUEUE_BASE_KEY);
const getCompletedOpsKey = () => getUserStorageKey(COMPLETED_OPS_BASE_KEY);

// =============================================================================
// 初始状态
// =============================================================================

const initialState: SyncStoreState = {
  status: 'idle',
  isOnline: true,  // 固定初始值，避免 SSR/CSR hydration 不一致，客户端挂载后由 useNetworkStatus 更新
  pendingOperations: [],
  lastSyncAt: null,
  error: null,
  syncStats: {
    totalSynced: 0,
    totalFailed: 0,
    lastDuration: 0,
    queueSize: 0,
  },
  isInitialized: false,
};

// =============================================================================
// 依赖排序：确保 create 操作中父节点先于子节点
// =============================================================================

function sortByParentDependency(ops: SyncOperation[]): SyncOperation[] {
  const creates = ops.filter((o) => o.type === 'create' && o.entityType === 'node');
  const rest = ops.filter((o) => !(o.type === 'create' && o.entityType === 'node'));

  if (creates.length <= 1) return [...creates, ...rest];

  const idSet = new Set(creates.map((o) => o.entityId));

  const parentOf = new Map<string, string | null>();
  for (const op of creates) {
    const p = op.payload as Record<string, unknown> | undefined;
    const pid = (p?.parentId as string) ?? null;
    parentOf.set(op.entityId, pid);
  }

  const sorted: SyncOperation[] = [];
  const visited = new Set<string>();

  function visit(op: SyncOperation) {
    if (visited.has(op.entityId)) return;
    visited.add(op.entityId);
    const pid = parentOf.get(op.entityId) ?? null;
    if (pid && idSet.has(pid)) {
      const parentOp = creates.find((c) => c.entityId === pid);
      if (parentOp) visit(parentOp);
    }
    sorted.push(op);
  }

  for (const op of creates) visit(op);

  return [...sorted, ...rest];
}

// =============================================================================
// 依赖就绪状态管理
// =============================================================================

/**
 * 已完成的操作 opId 集合（用于判断依赖是否满足）
 * 注意：这是一个会话级别的缓存，页面刷新后会清空
 */
const completedOperations = new Set<string>();

/**
 * 判断操作的依赖是否全部满足
 */
function areDependenciesSatisfied(op: SyncOperation): boolean {
  if (!op.dependsOn || op.dependsOn.length === 0) {
    return true;
  }
  return op.dependsOn.every((depId) => completedOperations.has(depId));
}

/**
 * 计算操作的就绪状态
 */
function computeReadyState(op: SyncOperation): DependencyReadyState {
  if (op.type !== 'create' || !op.dependsOn || op.dependsOn.length === 0) {
    return 'ready';
  }
  return areDependenciesSatisfied(op) ? 'ready' : 'blocked';
}

/**
 * 标记操作完成并通知依赖
 */
function markOperationComplete(opId: string): void {
  completedOperations.add(opId);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(getCompletedOpsKey(), JSON.stringify(Array.from(completedOperations)));
  }
  console.log(`[SyncStore] 操作完成，标记 opId: ${opId}`);
}

/**
 * 清除完成状态缓存（用于重置）
 */
function clearCompletedOperations(): void {
  completedOperations.clear();
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(getCompletedOpsKey());
  }
}

function loadCompletedOperations(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(getCompletedOpsKey());
    if (!raw) return;
    const ids = JSON.parse(raw) as string[];
    if (!Array.isArray(ids)) return;
    completedOperations.clear();
    ids.forEach((id) => {
      if (typeof id === 'string' && id.trim()) completedOperations.add(id);
    });
  } catch (error) {
    console.warn('[SyncStore] 加载 completedOperations 失败，已忽略:', error);
  }
}

// =============================================================================
// Store 实现
// =============================================================================

export const useSyncStore = create<SyncStore>((set, get) => {
  // 防抖持久化函数（在 store 创建时初始化）
  const debouncedPersist = debounce(() => {
    if (typeof window === 'undefined') return;
    const { pendingOperations } = get();
    try {
      localStorage.setItem(getOfflineQueueKey(), JSON.stringify(pendingOperations));
      console.log(`[SyncStore] 队列已持久化，共 ${pendingOperations.length} 个操作`);
    } catch (error) {
      console.error('[SyncStore] 持久化队列失败:', error);
    }
  }, PERSIST_DEBOUNCE);

  return {
    ...initialState,

    // =========================================================================
    // 网络状态管理
    // =========================================================================

    setOnline: (online: boolean) => {
      const prevOnline = get().isOnline;
      set({ isOnline: online });

      if (online && !prevOnline) {
        // 网络恢复：更新状态并尝试处理队列
        console.log('[SyncStore] 网络已恢复');
        set({ status: get().pendingOperations.length > 0 ? 'syncing' : 'idle' });
        // 注意：实际的队列处理由外部调用 processQueue 触发
      } else if (!online && prevOnline) {
        // 网络断开
        console.log('[SyncStore] 网络已断开');
        set({ status: 'offline' });
      }
    },

    // =========================================================================
    // 状态管理
    // =========================================================================

    setStatus: (status: SyncStatus) => {
      set({ status });
    },

    setError: (error: string | null) => {
      set({ error });
      if (error) {
        set({ status: 'error' });
      }
    },

    // =========================================================================
    // 队列操作
    // =========================================================================

    queueOperation: (op: CreateSyncOperationParams) => {
      const { pendingOperations, isOnline } = get();

      // 检查队列大小限制
      if (pendingOperations.length >= MAX_QUEUE_SIZE) {
        // 移除最旧的操作
        const oldest = pendingOperations[0];
        console.warn(`[SyncStore] 队列已满，移除最旧操作: ${oldest.id}`);
        set((state) => ({
          pendingOperations: state.pendingOperations.slice(1),
        }));
      }

      // 检查是否有相同实体的待处理操作，可以合并（含 failed，避免队列膨胀）
      const existingIndex = pendingOperations.findIndex(
        (p) =>
          p.entityType === op.entityType &&
          p.entityId === op.entityId &&
          (p.status === 'pending' || p.status === 'failed')
      );

      // 计算依赖就绪状态
      const readyState = computeReadyState({
        ...op,
        dependsOn: op.dependsOn,
      } as SyncOperation);

      const newOperation: SyncOperation = {
        ...op,
        id: generateId(),
        timestamp: Date.now(),
        retryCount: 0,
        status: 'pending',
        readyState,
      };

      if (existingIndex !== -1 && op.type === 'update') {
        // 合并更新操作：用新的 payload 替换旧的，过滤 undefined 防止覆盖 create 中的有效字段（如 parentId）
        set((state) => {
          const updated = [...state.pendingOperations];
          const incomingPayload = (op.payload as Record<string, unknown>) ?? {};
          const filteredPayload = Object.fromEntries(
            Object.entries(incomingPayload).filter(([, v]) => v !== undefined)
          );
          updated[existingIndex] = {
            ...updated[existingIndex],
            payload: {
              ...(updated[existingIndex].payload as object),
              ...filteredPayload,
            },
            timestamp: Date.now(),
            status: 'pending',
            retryCount: 0,
            error: undefined,
            readyState: computeReadyState(updated[existingIndex]),
          };
          return { pendingOperations: updated };
        });
        console.log(`[SyncStore] 合并更新操作: ${op.entityType}/${op.entityId}`);
      } else if (existingIndex !== -1 && (op.type === 'create' || op.type === 'delete')) {
        // 同实体的 create/delete 覆盖旧操作，重置状态
        set((state) => {
          const updated = [...state.pendingOperations];
          updated[existingIndex] = { ...newOperation };
          return { pendingOperations: updated };
        });
        console.log(`[SyncStore] 覆盖操作: ${op.type} ${op.entityType}/${op.entityId}`);
      } else {
        // 添加新操作
        set((state) => ({
          pendingOperations: [...state.pendingOperations, newOperation],
          syncStats: {
            ...state.syncStats,
            queueSize: state.pendingOperations.length + 1,
          },
        }));
        
        // 日志：包含依赖信息
        if (op.dependsOn && op.dependsOn.length > 0) {
          console.log(
            `[SyncStore] 添加操作 (依赖 ${op.dependsOn.length} 个): ${op.type} ${op.entityType}/${op.entityId}`,
            { dependsOn: op.dependsOn, readyState }
          );
        } else {
          console.log(`[SyncStore] 添加操作: ${op.type} ${op.entityType}/${op.entityId}`);
        }
      }

      // 持久化队列
      debouncedPersist();

      // 如果在线且不是正在同步，立即尝试处理
      if (isOnline && get().status !== 'syncing') {
        // 使用 setTimeout 避免同步调用导致的状态问题
        setTimeout(() => {
          get().processQueue();
        }, 0);
      }
    },

    processQueue: async () => {
      const state = get();

      // 检查前置条件
      if (!state.isOnline) {
        console.log('[SyncStore] 离线状态，跳过队列处理');
        return;
      }

      if (state.status === 'syncing') {
        console.log('[SyncStore] 正在同步中，跳过');
        return;
      }

      // 筛选待处理的操作
      let rawPendingOps = state.pendingOperations.filter(
        (op) => op.status === 'pending' || op.status === 'failed'
      );

      if (rawPendingOps.length === 0) {
        set({ status: 'idle' });
        return;
      }

      // 先做操作归约，降低重试风暴（create+delete=>no-op 等）
      const { mergeOperations } = await import('@/lib/syncEngine');
      const mergedOps = mergeOperations(rawPendingOps);
      if (mergedOps.length !== rawPendingOps.length) {
        const mergedIds = new Set(mergedOps.map((op) => op.id));
        set((s) => ({
          pendingOperations: s.pendingOperations.filter(
            (op) => !(rawPendingOps.some((raw) => raw.id === op.id) && !mergedIds.has(op.id))
          ),
        }));
      }
      rawPendingOps = mergedOps;

      // 更新所有操作的就绪状态
      rawPendingOps = rawPendingOps.map((op) => ({
        ...op,
        readyState: computeReadyState(op),
      }));

      // 筛选就绪的操作（无依赖或依赖已满足）
      const readyOps = rawPendingOps.filter((op) => op.readyState === 'ready');
      const blockedOps = rawPendingOps.filter((op) => op.readyState === 'blocked');

      // blocked 看门狗：超过 TTL 进入 dead-letter（failed）
      const now = Date.now();
      const deadLetterOps = blockedOps.filter(
        (op) => now - (op.lastAttemptAt ?? op.timestamp) > BLOCKED_WATCHDOG_TTL_MS
      );
      if (deadLetterOps.length > 0) {
        const deadIds = new Set(deadLetterOps.map((op) => op.id));
        set((s) => ({
          pendingOperations: s.pendingOperations.map((op) =>
            deadIds.has(op.id)
              ? {
                  ...op,
                  status: 'failed',
                  error: 'blocked watchdog timeout',
                  lastAttemptAt: now,
                }
              : op
          ),
        }));
      }

      if (blockedOps.length > 0) {
        console.log(`[SyncStore] ${blockedOps.length} 个操作因依赖未满足而阻塞`);
      }

      if (readyOps.length === 0) {
        console.log('[SyncStore] 没有就绪的操作，所有操作都在等待依赖');
        // 更新状态但不标记为 idle，因为还有阻塞的操作
        set({ status: blockedOps.length > 0 ? 'syncing' : 'idle' });
        return;
      }

      // 按依赖关系排序：父节点 create 必须先于子节点 create
      const pendingOps = sortByParentDependency(readyOps);

      console.log(`[SyncStore] 开始处理队列，共 ${pendingOps.length} 个就绪操作（${blockedOps.length} 个阻塞）`);
      set({ status: 'syncing', error: null });

      const startTime = Date.now();
      let successCount = 0;
      let failCount = 0;

      // 动态导入同步引擎，避免循环依赖
      const { executeWithRetry } = await import('@/lib/syncEngine');
      // 动态导入节点同步通知函数
      const { notifyNodeSyncComplete } = await import('@/utils/nodeCreationGuard');

      for (const op of pendingOps) {
        // 更新操作状态为处理中
        set((state) => ({
          pendingOperations: state.pendingOperations.map((o) =>
            o.id === op.id ? { ...o, status: 'processing' as const, lastAttemptAt: Date.now() } : o
          ),
        }));

        try {
          await executeWithRetry(op, DEFAULT_SYNC_CONFIG.retry.maxRetries);

          // 成功：从队列移除
          set((state) => ({
            pendingOperations: state.pendingOperations.filter((o) => o.id !== op.id),
          }));
          successCount++;
          
          // 标记操作完成（用于依赖追踪）
          markOperationComplete(op.id);
          
          // 通知等待该节点同步完成的 Promise
          if (op.entityType === 'node' && op.type === 'create') {
            notifyNodeSyncComplete(op.entityId, true);
          }

          console.log(`[SyncStore] 操作成功: ${op.type} ${op.entityType}/${op.entityId}`);
        } catch (error) {
          // 失败：标记状态并增加重试次数
          const errorMessage = error instanceof Error ? error.message : '未知错误';
          const newRetryCount = op.retryCount + 1;
          const maxRetries = DEFAULT_SYNC_CONFIG.retry.maxRetries;

          set((state) => ({
            pendingOperations: state.pendingOperations.map((o) =>
              o.id === op.id
                ? {
                    ...o,
                    status: 'failed' as const,
                    retryCount: newRetryCount,
                    error: errorMessage,
                    lastAttemptAt: Date.now(),
                  }
                : o
            ),
          }));

          failCount++;
          console.error(
            `[SyncStore] 操作失败 (${newRetryCount}/${maxRetries}): ${op.type} ${op.entityType}/${op.entityId}`,
            errorMessage
          );

          // 超过最大重试次数，标记为永久失败并通知
          if (newRetryCount >= maxRetries) {
            console.error(`[SyncStore] 操作已达最大重试次数，放弃: ${op.id}`);
            // 通知等待该节点同步完成的 Promise（失败）
            if (op.entityType === 'node' && op.type === 'create') {
              notifyNodeSyncComplete(op.entityId, false);
            }
          }
        }
      }

      // 更新统计和状态
      const duration = Date.now() - startTime;
      const remainingPending = get().pendingOperations.filter(
        (op) => op.status === 'pending' || op.status === 'failed'
      );

      set((state) => ({
        status: remainingPending.length > 0 ? 'error' : 'synced',
        lastSyncAt: Date.now(),
        syncStats: {
          totalSynced: state.syncStats.totalSynced + successCount,
          totalFailed: state.syncStats.totalFailed + failCount,
          lastDuration: duration,
          queueSize: get().pendingOperations.length,
        },
      }));

      // 持久化更新后的队列
      debouncedPersist();

      console.log(
        `[SyncStore] 队列处理完成: 成功 ${successCount}, 失败 ${failCount}, 耗时 ${duration}ms`
      );

      // 同步过程中可能新增了 pending 操作（例如结构调整批量入队），或有阻塞操作变为就绪
      // 继续 drain 队列直到清空
      const hasPendingOps = get().pendingOperations.some(
        (op) => op.status === 'pending' || (op.status === 'failed' && op.retryCount < DEFAULT_SYNC_CONFIG.retry.maxRetries)
      );
      if (get().isOnline && hasPendingOps) {
        setTimeout(() => {
          get().processQueue();
        }, 100); // 稍微延迟，让依赖状态更新
      }

      // 3秒后如果状态是 synced，自动切换到 idle
      if (get().status === 'synced') {
        setTimeout(() => {
          if (get().status === 'synced') {
            set({ status: 'idle' });
          }
        }, 3000);
      }
    },

    retryFailed: async () => {
      const { pendingOperations, isOnline } = get();

      if (!isOnline) {
        console.log('[SyncStore] 离线状态，无法重试');
        return;
      }

      const failedOps = pendingOperations.filter(
        (op) =>
          op.status === 'failed' &&
          op.retryCount < DEFAULT_SYNC_CONFIG.retry.maxRetries
      );

      if (failedOps.length === 0) {
        console.log('[SyncStore] 没有可重试的操作');
        return;
      }

      console.log(`[SyncStore] 准备重试 ${failedOps.length} 个失败操作`);

      // 将失败的操作状态改为 pending
      set((state) => ({
        pendingOperations: state.pendingOperations.map((op) =>
          op.status === 'failed' && op.retryCount < DEFAULT_SYNC_CONFIG.retry.maxRetries
            ? { ...op, status: 'pending' as const }
            : op
        ),
      }));

      // 触发队列处理
      await get().processQueue();
    },

    removeOperation: (id: string) => {
      set((state) => ({
        pendingOperations: state.pendingOperations.filter((op) => op.id !== id),
        syncStats: {
          ...state.syncStats,
          queueSize: state.pendingOperations.length - 1,
        },
      }));
      debouncedPersist();
    },

    clearQueue: () => {
      set({
        pendingOperations: [],
        syncStats: {
          ...get().syncStats,
          queueSize: 0,
        },
      });
      localStorage.removeItem(getOfflineQueueKey());
      // 清除完成状态缓存
      clearCompletedOperations();
      console.log('[SyncStore] 队列已清空');
    },

    // =========================================================================
    // 持久化操作
    // =========================================================================

    persistQueue: () => {
      debouncedPersist();
    },

    loadQueue: () => {
      if (typeof window === 'undefined') return;
      try {
        const stored = localStorage.getItem(getOfflineQueueKey());
        if (stored) {
          const queue = JSON.parse(stored) as SyncOperation[];
          // 验证数据格式
          let validQueue = queue.filter(
            (op) =>
              op.id &&
              op.type &&
              op.entityType &&
              op.entityId &&
              typeof op.timestamp === 'number'
          );

          if (validQueue.length !== queue.length) {
            console.warn(
              `[SyncStore] 过滤了 ${queue.length - validQueue.length} 个无效操作`
            );
          }

          // 清除已达最大重试次数的失败操作，避免堆积
          const maxRetries = DEFAULT_SYNC_CONFIG.retry.maxRetries;
          const beforeExpired = validQueue.length;
          validQueue = validQueue.filter(
            (op) => !(op.status === 'failed' && (op.retryCount ?? 0) >= maxRetries)
          );
          if (validQueue.length !== beforeExpired) {
            console.log(
              `[SyncStore] 清理 ${beforeExpired - validQueue.length} 个已达最大重试的失败操作`
            );
          }

          set({
            pendingOperations: validQueue,
            syncStats: {
              ...get().syncStats,
              queueSize: validQueue.length,
            },
          });
          console.log(`[SyncStore] 从存储加载了 ${validQueue.length} 个操作`);
        }
      } catch (error) {
        console.error('[SyncStore] 加载队列失败:', error);
        // 清除损坏的数据
        localStorage.removeItem(getOfflineQueueKey());
      }
    },

    // =========================================================================
    // 初始化
    // =========================================================================

    initialize: () => {
      if (get().isInitialized) {
        return;
      }

      console.log('[SyncStore] 初始化...');

      // 加载离线队列
      get().loadQueue();
      loadCompletedOperations();

      // 设置网络状态
      const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
      set({
        isOnline: online,
        status: online ? 'idle' : 'offline',
        isInitialized: true,
      });

      // 如果在线且有待处理操作，尝试处理
      if (online && get().pendingOperations.length > 0) {
        console.log('[SyncStore] 检测到待处理操作，准备同步');
        setTimeout(() => {
          get().processQueue();
        }, 1000); // 延迟 1 秒，等待其他 store 初始化
      }

      console.log('[SyncStore] 初始化完成', {
        online,
        queueSize: get().pendingOperations.length,
      });
    },

    // =========================================================================
    // 统计更新
    // =========================================================================

    updateStats: (updates: Partial<SyncStats>) => {
      set((state) => ({
        syncStats: {
          ...state.syncStats,
          ...updates,
        },
      }));
    },
  };
});

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 获取同步状态的友好描述
 */
export function getSyncStatusDescription(status: SyncStatus): string {
  const descriptions: Record<SyncStatus, string> = {
    idle: '就绪',
    syncing: '同步中...',
    synced: '已同步',
    error: '同步失败',
    offline: '离线',
  };
  return descriptions[status];
}

/**
 * 获取同步状态的颜色类名
 */
export function getSyncStatusColor(status: SyncStatus): string {
  const colors: Record<SyncStatus, string> = {
    idle: 'text-gray-400',
    syncing: 'text-blue-500',
    synced: 'text-green-500',
    error: 'text-red-500',
    offline: 'text-orange-500',
  };
  return colors[status];
}
