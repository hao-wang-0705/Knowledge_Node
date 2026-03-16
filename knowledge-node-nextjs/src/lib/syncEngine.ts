/**
 * 同步引擎核心
 * 
 * 负责执行同步操作、重试策略和错误处理。
 * 是 syncStore 和 API 层之间的桥梁。
 * 
 * v3.1 增强：
 * - 改进父节点不存在错误的检测和重试策略
 * - 增加操作完成通知机制
 */

import {
  SyncOperation,
  OperationType,
  DEFAULT_SYNC_CONFIG,
  RetryConfig,
} from '@/types/sync';
import {
  nodesApi,
  AuthenticationError,
} from '@/services/api';

// =============================================================================
// 重试策略
// =============================================================================

/**
 * 计算指数退避延迟
 * @param retryCount 当前重试次数
 * @param config 重试配置
 * @returns 延迟时间（毫秒）
 */
export function getRetryDelay(
  retryCount: number,
  config: RetryConfig = DEFAULT_SYNC_CONFIG.retry
): number {
  const { baseDelay, maxDelay, backoffFactor, jitter } = config;
  
  // 指数退避计算
  let delay = Math.min(
    baseDelay * Math.pow(backoffFactor, retryCount),
    maxDelay
  );
  
  // 添加随机抖动，避免雷同时重试（雷鸣效应）
  if (jitter) {
    delay += Math.random() * 1000;
  }
  
  return Math.floor(delay);
}

/**
 * 判断是否为父节点不存在的错误（可重试）
 * 后端在父节点未同步完成时会返回 400 + "父节点不存在" 错误
 * v3.1 增强：更全面的错误模式匹配
 */
function isParentNotFoundError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  // 匹配各种父节点不存在的错误消息模式
  const patterns = [
    /父节点.*不存在/i,
    /parent.*not found/i,
    /parent.*does not exist/i,
    /parentId.*not found/i,
    /无法创建节点.*父节点/i,
  ];
  return patterns.some(pattern => pattern.test(msg));
}

/**
 * 判断是否为依赖未满足的错误（应该延迟重试）
 */
function isDependencyError(error: unknown): boolean {
  return isParentNotFoundError(error);
}

/**
 * 判断错误是否可重试
 */
export function isRetryableError(error: unknown): boolean {
  // 认证错误不重试
  if (error instanceof AuthenticationError) {
    return false;
  }
  
  // 网络错误可重试
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }
  
  // 父节点不存在的错误可重试（父节点可能还在同步队列中）
  if (isParentNotFoundError(error)) {
    console.log('[SyncEngine] 检测到父节点不存在错误，标记为可重试');
    return true;
  }
  
  // HTTP 错误码判断
  if (error instanceof Error && 'status' in error) {
    const status = (error as Error & { status: number }).status;
    // 5xx 服务器错误可重试
    if (status >= 500) return true;
    // 429 Too Many Requests 可重试
    if (status === 429) return true;
    // 408 Request Timeout 可重试
    if (status === 408) return true;
    // 400 父节点不存在错误可重试（特殊情况）
    if (status === 400 && isParentNotFoundError(error)) return true;
    // 4xx 客户端错误通常不可重试
    if (status >= 400 && status < 500) return false;
  }
  
  // 默认可重试
  return true;
}

// =============================================================================
// 操作执行器
// =============================================================================

/** 操作执行结果（如级联解锁的节点 id 列表） */
export type ExecuteResult = { unlockedNodeIds?: string[] };

/**
 * 执行单个同步操作
 * @param operation 同步操作
 * @returns 部分操作（如 update）可能返回 unlockedNodeIds，供调用方 refetch 合并
 * @throws 执行失败时抛出错误
 */
export async function executeOperation(operation: SyncOperation): Promise<ExecuteResult | void> {
  const { type, entityType, entityId, payload } = operation;

  console.log(`[SyncEngine] 执行操作: ${type} ${entityType}/${entityId}`);

  try {
    switch (entityType) {
      case 'node': {
        const out = await executeNodeOperation(type, entityId, payload, operation.id);
        return out;
      }
      case 'supertag':
        await executeSupertagOperation(type, entityId, payload);
        return;
      default:
        throw new Error(`未知的实体类型: ${entityType}`);
    }
  } catch (error) {
    if (error instanceof AuthenticationError) {
      console.error('[SyncEngine] 认证失败，需要重新登录');
      throw error;
    }
    const message = error instanceof Error ? error.message : '操作执行失败';
    console.error(`[SyncEngine] 操作失败: ${type} ${entityType}/${entityId}`, message);
    // 保留带 status 的原始错误，以便 isRetryableError 正确判断 4xx 不可重试
    if (error && typeof error === 'object' && 'status' in error) {
      throw error;
    }
    throw new Error(message);
  }
}

/**
 * 判断是否为唯一约束冲突（P2002），可降级为 update
 */
function isUniqueConstraintError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes('Unique constraint') ||
    msg.includes('P2002') ||
    msg.includes('duplicate key')
  );
}

/**
 * 判断是否为「资源不存在」(404) 错误
 * 用于 delete 的幂等处理：服务端已无该节点时视为删除成功
 */
function isNotFoundError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'status' in error) {
    if ((error as { status: number }).status === 404) return true;
  }
  const msg = error instanceof Error ? error.message : String(error);
  return /not found/i.test(msg);
}

/**
 * 执行节点操作
 * create 失败若为唯一约束冲突，自动降级为 update
 * update 返回级联解锁的节点 id 列表，供调用方 refetch 合并
 */
async function executeNodeOperation(
  type: OperationType,
  entityId: string,
  payload: unknown,
  opId: string
): Promise<ExecuteResult | void> {
  switch (type) {
    case 'create': {
      try {
        await nodesApi.create(payload as Parameters<typeof nodesApi.create>[0], { opId });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          const p = payload as Record<string, unknown>;
          const parentId = p.parentId;
          const { unlockedNodeIds } = await nodesApi.update(entityId, {
            content: p.content as string | undefined,
            parentId: parentId === null || parentId === undefined ? undefined : (parentId as string),
            type: p.nodeType as string | undefined,
            isCollapsed: p.isCollapsed as boolean | undefined,
            fields: p.fields as Record<string, unknown> | undefined,
            supertagId: p.supertagId as string | undefined,
            payload: p.payload as Record<string, unknown> | undefined,
            sortOrder: p.sortOrder as number | undefined,
            tags: p.tags as string[] | undefined,
            references: p.references as unknown[] | undefined,
          }, { opId });
          if (unlockedNodeIds?.length) return { unlockedNodeIds };
        } else {
          throw error;
        }
      }
      return;
    }
    case 'update': {
      const { unlockedNodeIds } = await nodesApi.update(
        entityId,
        payload as Parameters<typeof nodesApi.update>[1],
        { opId }
      );
      if (unlockedNodeIds?.length) return { unlockedNodeIds };
      return;
    }
    case 'delete': {
      try {
        await nodesApi.delete(entityId, { opId });
      } catch (error) {
        // 幂等：节点已在服务端不存在(404)时视为删除成功，避免阻塞队列
        if (isNotFoundError(error)) {
          console.log(`[SyncEngine] 删除节点 ${entityId} 在服务端已不存在，视为成功`);
          return;
        }
        throw error;
      }
      return;
    }
    default:
      throw new Error(`未知的操作类型: ${type}`);
  }
}

/**
 * 执行笔记本操作
 */
/**
 * 执行 Supertag 操作
 * v3.3: 用户写操作已移除，此函数仅记录日志并抛出错误
 * @deprecated 标签同步操作已移除，系统标签由管理员统一管理
 */
async function executeSupertagOperation(
  type: OperationType,
  entityId: string,
  _payload: unknown
): Promise<void> {
  console.warn(`[SyncEngine] v3.3: Supertag 写操作已移除 - ${type} ${entityId}`);
  throw new Error('[v3.3] 用户写操作已移除：Supertag 同步操作不再可用，标签由系统统一管理');
}

// =============================================================================
// 批量操作
// =============================================================================

/**
 * 批量执行操作结果
 */
export interface BatchExecutionResult {
  success: string[];
  failed: Array<{
    id: string;
    error: string;
    retryable: boolean;
  }>;
}

/**
 * 批量执行同步操作
 * @param operations 操作列表
 * @param batchSize 批次大小
 * @returns 执行结果
 */
export async function batchExecuteOperations(
  operations: SyncOperation[],
  batchSize: number = DEFAULT_SYNC_CONFIG.batchSize
): Promise<BatchExecutionResult> {
  const result: BatchExecutionResult = {
    success: [],
    failed: [],
  };
  
  // 按批次处理
  for (let i = 0; i < operations.length; i += batchSize) {
    const batch = operations.slice(i, i + batchSize);
    
    // 并行执行批次内的操作
    const batchResults = await Promise.allSettled(
      batch.map(async (op) => {
        try {
          await executeOperation(op);
          return { id: op.id, success: true };
        } catch (error) {
          const message = error instanceof Error ? error.message : '未知错误';
          const retryable = isRetryableError(error);
          return { id: op.id, success: false, error: message, retryable };
        }
      })
    );
    
    // 整理结果
    batchResults.forEach((r, index) => {
      const op = batch[index];
      if (r.status === 'fulfilled') {
        if (r.value.success) {
          result.success.push(op.id);
        } else {
          result.failed.push({
            id: op.id,
            error: r.value.error || '未知错误',
            retryable: r.value.retryable ?? true,
          });
        }
      } else {
        result.failed.push({
          id: op.id,
          error: r.reason?.message || '操作被拒绝',
          retryable: isRetryableError(r.reason),
        });
      }
    });
  }
  
  console.log(
    `[SyncEngine] 批量执行完成: 成功 ${result.success.length}, 失败 ${result.failed.length}`
  );
  
  return result;
}

// =============================================================================
// 操作合并
// =============================================================================

/**
 * 合并相同实体的连续操作
 * 优化：将多个 update 合并为一个，delete 会消除之前的 create/update
 */
export function mergeOperations(operations: SyncOperation[]): SyncOperation[] {
  const merged: Map<string, SyncOperation> = new Map();
  
  for (const op of operations) {
    const key = `${op.entityType}:${op.entityId}`;
    const existing = merged.get(key);
    
    if (!existing) {
      merged.set(key, op);
      continue;
    }
    
    // 删除操作会消除之前的操作
    if (op.type === 'delete') {
      if (existing.type === 'create') {
        // create + delete = 无操作
        merged.delete(key);
      } else {
        // update + delete = delete
        merged.set(key, op);
      }
      continue;
    }
    
    // 更新操作合并
    if (op.type === 'update') {
      // 检查 update 的 payload 是否含有非空 references 数组
      // 若有，则不与 create 合并，保留为独立 update
      // 这样 update 会在所有 create 之后执行，确保被引用的实体节点已创建
      // 后端 syncMentionEdgesForNode 才能正确建立 MENTION 边
      const updatePayload = op.payload as Record<string, unknown> | undefined;
      const hasReferences = Array.isArray(updatePayload?.references) && updatePayload.references.length > 0;

      if (existing.type === 'create' && !hasReferences) {
        // create + update = create (合并 payload)，但 references 相关的 update 不合并
        merged.set(key, {
          ...existing,
          payload: {
            ...(existing.payload as object),
            ...(op.payload as object),
          },
          timestamp: op.timestamp,
        });
      } else if (existing.type === 'create' && hasReferences) {
        // create + update(with references) = 保留两者
        // update 作为新操作加入，会在 create 之后执行
        merged.set(`${key}:update`, op);
      } else if (existing.type === 'update') {
        // update + update = update (合并 payload)
        merged.set(key, {
          ...existing,
          payload: {
            ...(existing.payload as object),
            ...(op.payload as object),
          },
          timestamp: op.timestamp,
        });
      }
      continue;
    }
    
    // 创建操作（通常不应该有重复的创建）
    if (op.type === 'create') {
      console.warn(`[SyncEngine] 检测到重复的创建操作: ${key}`);
    }
  }
  
  return Array.from(merged.values());
}

// =============================================================================
// 延迟执行
// =============================================================================

/**
 * 带延迟的操作执行（用于重试）
 */
export async function executeWithDelay(
  operation: SyncOperation,
  delayMs: number
): Promise<void> {
  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  await executeOperation(operation);
}

/**
 * 带重试的操作执行
 * @returns 同 executeOperation，可能含 unlockedNodeIds
 */
export async function executeWithRetry(
  operation: SyncOperation,
  maxRetries: number = DEFAULT_SYNC_CONFIG.retry.maxRetries
): Promise<ExecuteResult | void> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = getRetryDelay(attempt - 1);
        console.log(`[SyncEngine] 第 ${attempt} 次重试，延迟 ${delay}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      
      const result = await executeOperation(operation);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (!isRetryableError(error)) {
        console.error('[SyncEngine] 不可重试的错误:', lastError.message);
        throw lastError;
      }
      
      if (attempt === maxRetries) {
        console.error(`[SyncEngine] 已达最大重试次数 (${maxRetries})`);
      }
    }
  }
  
  throw lastError || new Error('操作失败');
}
