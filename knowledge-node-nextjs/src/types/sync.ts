/**
 * 数据同步相关类型定义
 * 
 * 包含同步状态、操作队列、冲突处理等核心类型
 */

// =============================================================================
// 同步状态类型 (Sync Status Types)
// =============================================================================

/**
 * 同步状态枚举
 * - idle: 空闲状态，无待处理操作
 * - syncing: 正在同步中
 * - synced: 同步完成
 * - error: 同步出错
 * - offline: 离线状态
 */
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

/**
 * 操作类型
 */
export type OperationType = 'create' | 'update' | 'delete';

/**
 * 实体类型（与业务模型对应）
 */
export type EntityType = 'node' | 'notebook' | 'supertag' | 'category';

/**
 * 操作状态
 */
export type OperationStatus = 'pending' | 'processing' | 'failed' | 'completed';

// =============================================================================
// 同步操作类型 (Sync Operation Types)
// =============================================================================

/**
 * 同步操作定义
 * 表示一个待同步的数据变更操作
 */
export interface SyncOperation {
  /** 操作唯一标识 */
  id: string;
  /** 操作类型 */
  type: OperationType;
  /** 实体类型 */
  entityType: EntityType;
  /** 实体 ID */
  entityId: string;
  /** 操作负载数据 */
  payload: unknown;
  /** 操作创建时间戳 */
  timestamp: number;
  /** 重试次数 */
  retryCount: number;
  /** 操作状态 */
  status: OperationStatus;
  /** 错误信息（失败时） */
  error?: string;
  /** 最后尝试时间 */
  lastAttemptAt?: number;
}

/**
 * 创建同步操作的参数（不含自动生成的字段）
 */
export type CreateSyncOperationParams = Omit<
  SyncOperation,
  'id' | 'timestamp' | 'retryCount' | 'status' | 'error' | 'lastAttemptAt'
>;

// =============================================================================
// 同步统计类型 (Sync Statistics Types)
// =============================================================================

/**
 * 同步统计信息
 */
export interface SyncStats {
  /** 成功同步的操作总数 */
  totalSynced: number;
  /** 失败的操作总数 */
  totalFailed: number;
  /** 最后一次同步耗时（毫秒） */
  lastDuration: number;
  /** 当前队列大小 */
  queueSize: number;
}

// =============================================================================
// 同步配置类型 (Sync Configuration Types)
// =============================================================================

/**
 * 重试策略配置
 */
export interface RetryConfig {
  /** 最大重试次数 */
  maxRetries: number;
  /** 基础延迟（毫秒） */
  baseDelay: number;
  /** 最大延迟（毫秒） */
  maxDelay: number;
  /** 退避因子 */
  backoffFactor: number;
  /** 是否添加随机抖动 */
  jitter: boolean;
}

/**
 * 离线队列配置
 */
export interface OfflineQueueConfig {
  /** 队列最大容量 */
  maxSize: number;
  /** localStorage 存储键 */
  storageKey: string;
  /** 持久化防抖延迟（毫秒） */
  persistDebounce: number;
}

/**
 * 同步引擎配置
 */
export interface SyncEngineConfig {
  /** 重试策略 */
  retry: RetryConfig;
  /** 离线队列配置 */
  queue: OfflineQueueConfig;
  /** 批量处理大小 */
  batchSize: number;
  /** 同步间隔（毫秒） */
  syncInterval: number;
}

/**
 * 默认同步配置
 */
export const DEFAULT_SYNC_CONFIG: SyncEngineConfig = {
  retry: {
    maxRetries: 5,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffFactor: 2,
    jitter: true,
  },
  queue: {
    maxSize: 1000,
    storageKey: 'knowledge-node-offline-queue',
    persistDebounce: 100,
  },
  batchSize: 50,
  syncInterval: 5000,
};

// =============================================================================
// 冲突处理类型 (Conflict Resolution Types)
// =============================================================================

/**
 * 冲突类型
 * - none: 无冲突
 * - safe-update: 安全更新（本地无修改）
 * - real: 真正的冲突（两端都有修改）
 * - local-ahead: 本地版本领先（异常情况）
 */
export type ConflictType = 'none' | 'safe-update' | 'real' | 'local-ahead';

/**
 * 冲突解决策略
 * - server-wins: 服务器版本优先
 * - local-wins: 本地版本优先
 * - merge: 智能合并
 * - manual: 用户手动处理
 */
export type ConflictResolution = 'server-wins' | 'local-wins' | 'merge' | 'manual';

/**
 * 带版本号的实体基类
 */
export interface VersionedEntity {
  /** 版本号（每次修改递增） */
  version: number;
  /** 最后修改时间戳 */
  lastModifiedAt: number;
  /** 最后修改用户 ID */
  lastModifiedBy?: string;
}

/**
 * 冲突检测结果
 */
export interface ConflictDetectionResult {
  /** 冲突类型 */
  type: ConflictType;
  /** 本地版本 */
  localVersion: number;
  /** 服务器版本 */
  serverVersion: number;
  /** 建议的解决策略 */
  suggestedResolution: ConflictResolution;
  /** 冲突详情描述 */
  description: string;
}

/**
 * 冲突解决结果
 */
export interface ConflictResolutionResult<T> {
  /** 解决后的数据 */
  resolvedData: T;
  /** 使用的解决策略 */
  strategy: ConflictResolution;
  /** 是否需要强制推送到服务器 */
  forcePush: boolean;
}

// =============================================================================
// 同步 Store 类型 (Sync Store Types)
// =============================================================================

/**
 * 同步 Store 状态
 */
export interface SyncStoreState {
  /** 当前同步状态 */
  status: SyncStatus;
  /** 网络是否在线 */
  isOnline: boolean;
  /** 待处理操作队列 */
  pendingOperations: SyncOperation[];
  /** 最后成功同步时间 */
  lastSyncAt: number | null;
  /** 错误信息 */
  error: string | null;
  /** 同步统计 */
  syncStats: SyncStats;
  /** 是否已初始化 */
  isInitialized: boolean;
}

/**
 * 同步 Store 操作
 */
export interface SyncStoreActions {
  // 网络状态
  setOnline: (online: boolean) => void;
  
  // 状态管理
  setStatus: (status: SyncStatus) => void;
  setError: (error: string | null) => void;
  
  // 队列操作
  queueOperation: (op: CreateSyncOperationParams) => void;
  processQueue: () => Promise<void>;
  retryFailed: () => Promise<void>;
  removeOperation: (id: string) => void;
  clearQueue: () => void;
  
  // 持久化
  persistQueue: () => void;
  loadQueue: () => void;
  
  // 初始化
  initialize: () => void;
  
  // 统计更新
  updateStats: (updates: Partial<SyncStats>) => void;
}

/**
 * 完整的同步 Store 类型
 */
export type SyncStore = SyncStoreState & SyncStoreActions;

// =============================================================================
// 同步事件类型 (Sync Event Types)
// =============================================================================

/**
 * 同步事件类型
 */
export type SyncEventType = 
  | 'sync:start'
  | 'sync:complete'
  | 'sync:error'
  | 'sync:offline'
  | 'sync:online'
  | 'queue:add'
  | 'queue:remove'
  | 'queue:process'
  | 'conflict:detected'
  | 'conflict:resolved';

/**
 * 同步事件负载
 */
export interface SyncEventPayload {
  type: SyncEventType;
  timestamp: number;
  data?: unknown;
  error?: string;
}

// =============================================================================
// API 同步相关类型 (API Sync Types)
// =============================================================================

/**
 * 批量同步请求
 */
export interface BatchSyncRequest {
  operations: SyncOperation[];
}

/**
 * 批量同步响应
 */
export interface BatchSyncResponse {
  /** 成功的操作 ID 列表 */
  success: string[];
  /** 失败的操作及错误信息 */
  failed: Array<{
    id: string;
    error: string;
    retryable: boolean;
  }>;
  /** 检测到的冲突 */
  conflicts: Array<{
    operationId: string;
    conflictType: ConflictType;
    serverData: unknown;
  }>;
}

/**
 * 同步状态查询响应
 */
export interface SyncStatusResponse {
  entityId: string;
  entityType: EntityType;
  version: number;
  lastModifiedAt: number;
  lastModifiedBy: string;
}
