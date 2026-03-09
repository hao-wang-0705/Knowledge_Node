/**
 * ViewConfig Schema 类型定义
 * v3.6: 第二阶段平台化升级 - 声明式配置驱动视图渲染
 */

// =============================================================================
// 布局类型定义
// =============================================================================

/** 视图布局类型 */
export type ViewLayoutType = 'kanban' | 'table' | 'list';

/** 排序方向 */
export type SortOrder = 'asc' | 'desc';

/**
 * 视图布局配置
 */
export interface ViewLayoutConfig {
  /** 布局类型 */
  type: ViewLayoutType;
  /** 分组字段 key（kanban 必填） */
  groupByField?: string;
  /** 排序字段 key */
  sortField?: string;
  /** 排序方向 */
  sortOrder?: SortOrder;
  /** table 布局显示的列 key 列表 */
  columns?: string[];
  /** 是否启用虚拟滚动 */
  virtualScroll?: boolean;
  /** 每页数量（用于分页） */
  pageSize?: number;
}

// =============================================================================
// 组件配置定义
// =============================================================================

/** 组件类型 */
export type WidgetType = 'ai-aggregation' | 'stats-bar' | 'custom';

/**
 * AI 聚合组件查询配置
 */
export interface AIAggregationQueryConfig {
  /** 过滤条件 */
  filters: AIAggregationFilter[];
  /** 结果数量限制 */
  limit?: number;
  /** 是否包含子节点 */
  includeChildren?: boolean;
  /** 子节点遍历深度 */
  childDepth?: number;
}

/**
 * AI 聚合组件过滤条件
 */
export interface AIAggregationFilter {
  /** 字段 key */
  field: string;
  /** 操作符 */
  operator: 'eq' | 'neq' | 'in' | 'nin' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'startsWith' | 'endsWith';
  /** 比较值 */
  value: unknown;
}

/**
 * AI 聚合组件属性
 */
export interface AIAggregationWidgetProps {
  /** 组件标题 */
  title?: string;
  /** 数据源查询规则 */
  query: AIAggregationQueryConfig;
  /** System Prompt */
  prompt: string;
  /** 缓存时间（秒），默认 900 */
  cacheTTL?: number;
  /** 是否显示节点引用链接 */
  showBacklinks?: boolean;
  /** 自定义样式类名 */
  className?: string;
}

/**
 * 统计栏组件属性
 */
export interface StatsBarWidgetProps {
  /** 统计项配置 */
  items: StatsBarItem[];
  /** 布局方向 */
  direction?: 'horizontal' | 'vertical';
  /** 自定义样式类名 */
  className?: string;
}

/**
 * 统计栏项目
 */
export interface StatsBarItem {
  /** 项目 ID */
  id: string;
  /** 项目标签 */
  label: string;
  /** 字段 key（用于计算） */
  field: string;
  /** 统计类型 */
  aggregation: 'count' | 'sum' | 'avg' | 'min' | 'max';
  /** 图标 */
  icon?: string;
  /** 颜色 */
  color?: string;
}

/**
 * 自定义组件属性
 */
export interface CustomWidgetProps {
  /** 组件名称（用于动态加载） */
  componentName: string;
  /** 组件属性 */
  props?: Record<string, unknown>;
}

/**
 * 组件配置
 */
export interface WidgetConfig {
  /** 组件唯一 ID */
  id: string;
  /** 组件类型 */
  type: WidgetType;
  /** 组件属性 */
  props: AIAggregationWidgetProps | StatsBarWidgetProps | CustomWidgetProps | Record<string, unknown>;
}

/**
 * 视图组件挂载配置
 */
export interface ViewWidgetsConfig {
  /** 顶部区域组件 */
  header?: WidgetConfig[];
  /** 侧边栏区域组件 */
  sidebar?: WidgetConfig[];
}

// =============================================================================
// 数据流转规则定义
// =============================================================================

/**
 * Quick Capture 配置
 */
export interface QuickCaptureConfig {
  /** 默认字段值 */
  defaultFields?: Record<string, unknown>;
  /** 输入框占位符 */
  placeholder?: string;
  /** 是否启用智能捕获 */
  enableSmartCapture?: boolean;
}

/**
 * 拖拽配置
 */
export interface DragConfig {
  /** 拖拽更新的目标字段 key */
  targetField: string;
  /** 允许的状态转换规则（源状态 → 允许的目标状态列表） */
  allowedTransitions?: Record<string, string[]>;
  /** 拖拽防抖时间（毫秒），默认 300 */
  debounceMs?: number;
}

/**
 * 视图数据流转规则配置
 */
export interface ViewActionsConfig {
  /** Quick Capture 配置 */
  quickCapture?: QuickCaptureConfig;
  /** 拖拽配置 */
  drag?: DragConfig;
}

// =============================================================================
// ViewConfig 主定义
// =============================================================================

/** ViewConfig Schema 版本 */
export type ViewConfigVersion = '1.0';

/**
 * ViewConfig Schema 主配置
 * 定义超级标签 Pinned 页面的声明式视图配置
 */
export interface ViewConfig {
  /** Schema 版本号 */
  version: ViewConfigVersion;
  /** 布局配置 */
  layout: ViewLayoutConfig;
  /** 组件挂载树 */
  widgets?: ViewWidgetsConfig;
  /** 数据流转规则 */
  actions?: ViewActionsConfig;
}

// =============================================================================
// 辅助类型
// =============================================================================

/**
 * 深度只读类型
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/**
 * 只读 ViewConfig
 */
export type ReadonlyViewConfig = DeepReadonly<ViewConfig>;

/**
 * ViewConfig 验证结果
 */
export interface ViewConfigValidationResult {
  /** 是否有效 */
  valid: boolean;
  /** 错误列表 */
  errors: ViewConfigValidationError[];
}

/**
 * ViewConfig 验证错误
 */
export interface ViewConfigValidationError {
  /** 错误路径 */
  path: string;
  /** 错误消息 */
  message: string;
  /** 错误类型 */
  type: 'missing' | 'invalid' | 'type_mismatch';
}

// =============================================================================
// AI 缓存相关类型
// =============================================================================

/**
 * AI 聚合缓存记录
 */
export interface AIAggregateCache {
  /** 缓存记录 ID */
  id: string;
  /** 标签 ID */
  tagId: string;
  /** Query 配置的 hash */
  queryHash: string;
  /** AI 生成内容 */
  content: string;
  /** 引用的节点 ID 列表 */
  nodeRefs: string[];
  /** 创建时间 */
  createdAt: Date;
  /** 过期时间 */
  expiresAt: Date;
}

/**
 * AI 聚合请求
 */
export interface AIAggregateRequest {
  /** 标签 ID */
  tagId: string;
  /** 查询配置 */
  query: AIAggregationQueryConfig;
  /** System Prompt */
  prompt: string;
  /** 是否强制刷新缓存 */
  forceRefresh?: boolean;
}

/**
 * AI 聚合响应
 */
export interface AIAggregateResponse {
  /** 生成的内容 */
  content: string;
  /** 引用的节点 ID 列表 */
  nodeRefs: string[];
  /** 结构化站会纪要（可选） */
  standup?: StandupSummaryPayload;
  /** 是否来自缓存 */
  fromCache: boolean;
  /** 缓存过期时间 */
  expiresAt?: Date;
}

/**
 * 站会纪要条目（结构化）
 */
export interface StandupSummaryItem {
  /** 节点 ID（内部锚点） */
  nodeId: string;
  /** 任务标题（对用户可见） */
  title: string;
  /** 一句话摘要 */
  summary: string;
  /** 状态 */
  status?: string;
  /** 优先级 */
  priority?: string;
  /** 截止日期（ISO 字符串） */
  dueDate?: string;
}

/**
 * 站会纪要结构化负载
 */
export interface StandupSummaryPayload {
  /** 高优预警 */
  highRisk: StandupSummaryItem[];
  /** 进展摘要 */
  progress: StandupSummaryItem[];
  /** 阻塞/风险 */
  risks: StandupSummaryItem[];
  /** 统计信息 */
  stats?: {
    totalCandidates: number;
    highRiskCount: number;
    inProgressCount: number;
    riskCount: number;
  };
}

/**
 * AI 聚合 SSE 事件类型
 */
export type AIAggregateEventType = 'chunk' | 'nodeRef' | 'done' | 'error';

/**
 * AI 聚合 SSE 事件
 */
export interface AIAggregateChunkEvent {
  event: 'chunk';
  data: {
    /** 文本片段 */
    text: string;
  };
}

export interface AIAggregateNodeRefEvent {
  event: 'nodeRef';
  data: {
    /** 节点 ID */
    nodeId: string;
    /** 节点标题 */
    title: string;
  };
}

export interface AIAggregateDoneEvent {
  event: 'done';
  data: {
    /** 完整内容 */
    content: string;
    /** 节点引用列表 */
    nodeRefs: string[];
    /** 结构化站会纪要（可选） */
    standup?: StandupSummaryPayload;
  };
}

export interface AIAggregateErrorEvent {
  event: 'error';
  data: {
    /** 错误码 */
    code: string;
    /** 错误消息 */
    message: string;
  };
}

export type AIAggregateEvent =
  | AIAggregateChunkEvent
  | AIAggregateNodeRefEvent
  | AIAggregateDoneEvent
  | AIAggregateErrorEvent;
