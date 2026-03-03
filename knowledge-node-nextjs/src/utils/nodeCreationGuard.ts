/**
 * 节点创建守卫模块
 * 
 * 提供统一的节点创建入口，实现：
 * 1. 父节点存在性校验
 * 2. 依赖追踪与同步队列入队
 * 3. 等待节点同步完成的机制
 * 
 * 设计目标：从架构层面减少父节点不存在等高危问题的发生概率
 */

import { Node } from '@/types';
import { SyncOperation, NodeSyncPromise } from '@/types/sync';
import { useSyncStore } from '@/stores/syncStore';
import { resolveCalendarParentId } from '@/utils/calendarNodeId';

// =============================================================================
// 节点同步等待机制
// =============================================================================

/**
 * 节点同步 Promise 映射表
 * key: nodeId, value: 等待该节点同步完成的 Promise 及其 resolve 函数
 */
const nodeSyncPromises = new Map<string, NodeSyncPromise>();

/**
 * 创建或获取节点同步等待 Promise
 * @param nodeId 节点 ID
 * @returns NodeSyncPromise 对象
 */
export function getOrCreateNodeSyncPromise(nodeId: string): NodeSyncPromise {
  const existing = nodeSyncPromises.get(nodeId);
  if (existing) return existing;

  let resolveFunc: (success: boolean) => void = () => {};
  const promise = new Promise<boolean>((resolve) => {
    resolveFunc = resolve;
  });

  const syncPromise: NodeSyncPromise = { promise, resolve: resolveFunc };
  nodeSyncPromises.set(nodeId, syncPromise);
  return syncPromise;
}

/**
 * 等待指定节点同步完成
 * @param nodeId 节点 ID
 * @param timeoutMs 超时时间（毫秒），默认 10000
 * @returns Promise<boolean> 同步是否成功
 */
export async function waitForNodeSync(nodeId: string, timeoutMs: number = 10000): Promise<boolean> {
  const syncPromise = getOrCreateNodeSyncPromise(nodeId);
  
  const timeoutPromise = new Promise<boolean>((resolve) => {
    setTimeout(() => {
      console.warn(`[waitForNodeSync] 节点 ${nodeId} 同步等待超时 (${timeoutMs}ms)`);
      resolve(false);
    }, timeoutMs);
  });

  return Promise.race([syncPromise.promise, timeoutPromise]);
}

/**
 * 通知节点同步完成
 * @param nodeId 节点 ID
 * @param success 同步是否成功
 */
export function notifyNodeSyncComplete(nodeId: string, success: boolean): void {
  const syncPromise = nodeSyncPromises.get(nodeId);
  if (syncPromise) {
    console.log(`[notifyNodeSyncComplete] 节点 ${nodeId} 同步完成:`, success ? '成功' : '失败');
    syncPromise.resolve(success);
    nodeSyncPromises.delete(nodeId);
  }
}

/**
 * 清理所有待处理的同步 Promise（用于重置或清理）
 */
export function clearAllNodeSyncPromises(): void {
  nodeSyncPromises.forEach((syncPromise, nodeId) => {
    console.warn(`[clearAllNodeSyncPromises] 清理未完成的同步 Promise: ${nodeId}`);
    syncPromise.resolve(false);
  });
  nodeSyncPromises.clear();
}

// =============================================================================
// 依赖追踪
// =============================================================================

/**
 * 查找指定父节点是否有待处理的 create 操作
 * @param parentId 父节点 ID
 * @returns 待处理的父节点 create 操作，或 undefined
 */
export function findPendingParentOperation(parentId: string): SyncOperation | undefined {
  const syncStore = useSyncStore.getState();
  const pendingOps = syncStore.pendingOperations;

  // 防御性检查：pendingOperations 可能在测试环境中未初始化
  if (!pendingOps || !Array.isArray(pendingOps)) {
    return undefined;
  }

  return pendingOps.find(
    (op) =>
      op.entityType === 'node' &&
      op.type === 'create' &&
      op.entityId === parentId &&
      (op.status === 'pending' || op.status === 'processing')
  );
}

/**
 * 收集所有祖先节点中待处理的 create 操作 entityId 列表
 * @param parentId 直接父节点 ID
 * @param nodes 当前节点状态
 * @returns 依赖的 entityId 数组
 */
export function collectAncestorDependencies(
  parentId: string | null,
  nodes: Record<string, Node>
): string[] {
  if (!parentId) return [];

  const dependencies: string[] = [];
  const pendingOp = findPendingParentOperation(parentId);
  
  if (pendingOp) {
    dependencies.push(parentId);
    // 递归检查父节点的父节点
    const parentNode = nodes[parentId];
    if (parentNode?.parentId) {
      dependencies.push(...collectAncestorDependencies(parentNode.parentId, nodes));
    }
  }

  return dependencies;
}

// =============================================================================
// 校验函数
// =============================================================================

/**
 * 校验父节点是否存在于前端状态
 * @param parentId 父节点 ID（可能需要解析日历 ID）
 * @param nodes 当前节点状态
 * @returns 校验结果
 */
export function validateParentExists(
  parentId: string | null,
  nodes: Record<string, Node>
): { valid: boolean; resolvedParentId: string | null; error?: string } {
  if (parentId === null) {
    return { valid: true, resolvedParentId: null };
  }

  const resolved = resolveCalendarParentId(parentId, nodes);
  
  if (resolved === null || resolved === undefined) {
    return { valid: true, resolvedParentId: null };
  }

  const parentNode = nodes[resolved];
  if (!parentNode) {
    const pendingOp = findPendingParentOperation(resolved);
    if (pendingOp) {
      return { valid: true, resolvedParentId: resolved };
    }
    
    return {
      valid: false,
      resolvedParentId: resolved,
      error: `父节点 ${resolved} 不存在且不在创建队列中`,
    };
  }

  return { valid: true, resolvedParentId: resolved };
}

// =============================================================================
// 统一创建入口
// =============================================================================

export interface NodeCreationGuardOptions {
  /** 要创建的节点 */
  node: Node;
  /** 排序顺序 */
  sortOrder: number;
  /** 是否等待同步完成（用于日历节点串行创建） */
  awaitSync?: boolean;
  /** 当前节点状态（用于依赖收集） */
  nodes: Record<string, Node>;
}

export interface NodeCreationResult {
  /** 是否成功入队 */
  queued: boolean;
  /** 错误信息 */
  error?: string;
  /** 依赖的父节点 ID 列表 */
  dependencies: string[];
}

/**
 * 统一的节点创建入队函数
 * 实现父节点校验和依赖追踪
 * 
 * @param options 创建选项
 * @returns 创建结果（同步）或 Promise（当 awaitSync=true）
 */
export function queueCreateWithDependency(
  options: NodeCreationGuardOptions
): NodeCreationResult | Promise<NodeCreationResult> {
  const { node, sortOrder, awaitSync = false, nodes } = options;
  const syncStore = useSyncStore.getState();

  // 1. 校验父节点
  const validation = validateParentExists(node.parentId, nodes);
  if (!validation.valid) {
    console.error(`[queueCreateWithDependency] 校验失败:`, validation.error);
    return {
      queued: false,
      error: validation.error,
      dependencies: [],
    };
  }

  // 2. 收集依赖（父节点中待处理的 create 操作）
  const dependencies = collectAncestorDependencies(validation.resolvedParentId, nodes);

  // 3. 入队 - 检查 queueOperation 是否存在（测试环境可能未完全初始化）
  if (typeof syncStore.queueOperation !== 'function') {
    console.warn(`[queueCreateWithDependency] syncStore.queueOperation 不可用，跳过入队`);
    return {
      queued: false,
      error: 'syncStore 未初始化',
      dependencies: [],
    };
  }

  console.log(`[queueCreateWithDependency] 创建节点 ${node.id.substring(0, 20)}...`, {
    parentId: node.parentId,
    resolvedParentId: validation.resolvedParentId,
    dependencies,
    awaitSync,
  });

  // 提取 Node 上可能存在的额外字段（如 scope, notebookId 等扩展字段）
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, content, parentId, type, supertagId, fields, payload: nodePayload, tags, references, childrenIds, isCollapsed, createdAt, updatedAt, nodeRole, ...extraFields } = node;

  syncStore.queueOperation({
    type: 'create',
    entityType: 'node',
    entityId: node.id,
    payload: {
      id: node.id,
      content: node.content,
      parentId: validation.resolvedParentId,
      nodeType: node.type || 'text',
      supertagId: node.supertagId,
      fields: node.fields,
      payload: node.payload,
      tags: node.tags || [],
      references: node.references || [],
      sortOrder,
      // 透传额外字段（如 scope, notebookId）
      ...extraFields,
    },
    dependsOn: dependencies.length > 0 ? dependencies : undefined,
  });

  const result: NodeCreationResult = {
    queued: true,
    dependencies,
  };

  // 4. 如果需要等待同步完成
  if (awaitSync) {
    return (async () => {
      const success = await waitForNodeSync(node.id);
      if (!success) {
        console.warn(`[queueCreateWithDependency] 节点 ${node.id} 同步等待失败或超时`);
      }
      return result;
    })();
  }

  return result;
}

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 检查节点是否为日历层级节点（年/周/日）
 */
export function isCalendarHierarchyNode(nodeId: string): boolean {
  return (
    nodeId.includes('year-') ||
    nodeId.includes('week-') ||
    nodeId.includes('day-') ||
    nodeId.includes('month-')
  );
}

/**
 * 获取节点在同级中的排序顺序
 */
export function getSortOrder(
  nodeId: string,
  parentId: string | null,
  nodes: Record<string, Node>,
  rootIds: string[]
): number {
  if (parentId === null) {
    return rootIds.indexOf(nodeId);
  }
  const parentNode = nodes[parentId];
  return parentNode?.childrenIds.indexOf(nodeId) ?? 0;
}
