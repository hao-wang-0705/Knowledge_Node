import type { SearchConfig } from './search';

// 导出同步相关类型
export * from './sync';

// 导出查询面板相关类型
export * from './query';

// 节点类型
// - text: 普通文本节点
// - heading: 标题节点
// - todo: 待办节点
// - command: 指令节点 (AI Command)
// - daily: 每日笔记节点
// - search: 搜索节点 (Search Node)
export type NodeType = 'text' | 'heading' | 'todo' | 'command' | 'daily' | 'search';

/** 节点结构角色（统一树：user_root / daily_root / search_root 为结构节点，其余为 normal） */
export type NodeRole = 'normal' | 'user_root' | 'daily_root' | 'search_root';

// =============================================================================
// 指令节点系统 (Command Node System)
// =============================================================================

/**
 * 上下文筛选条件
 */
export interface ContextFilter {
  /** 按 Supertag 筛选 */
  supertagIds?: string[];
  /** 按时间范围筛选 */
  dateRange?: {
    start: Date;
    end: Date;
  };
  /** 按节点路径筛选（祖先节点ID） */
  ancestorId?: string;
  /** 包含子节点层级深度 */
  depth?: number;
}

/**
 * 指令节点配置
 */
export interface CommandConfig {
  /** 指令模板 ID（如果使用预设模板） */
  templateId?: string;
  /** 自定义 Prompt */
  prompt: string;
  /** 上下文筛选条件 */
  contextFilter?: ContextFilter;
  /** Token 预算上限 */
  maxTokens?: number;
  /** AI 模型选择 */
  model?: 'gpt-4' | 'gpt-4-turbo' | 'gpt-3.5-turbo' | 'claude-3-opus' | 'claude-3-sonnet' | 'claude-3-haiku' | 'hunyuan-turbo' | 'hunyuan-pro' | 'deepseek-chat';
  /** 最近一次执行时间 */
  lastExecutedAt?: number;
  /** 最近一次执行状态 */
  lastExecutionStatus?: 'success' | 'error' | 'pending';
  /** 最近一次执行错误信息 */
  lastError?: string;
}

/**
 * 指令模板定义
 */
export interface CommandTemplate {
  id: string;
  name: string;
  description: string;
  prompt: string;
  icon: string;
  category: 'productivity' | 'analysis' | 'creative' | 'summary';
  /** 推荐的上下文筛选 */
  suggestedFilter?: Partial<ContextFilter>;
}

// =============================================================================
// 每日笔记系统 (Daily Notes System)
// =============================================================================

/**
 * 每日笔记层级类型
 */
export type DailyNoteLevel = 'year' | 'week' | 'day';

/**
 * 每日笔记节点 payload
 */
export interface DailyNotePayload {
  level: DailyNoteLevel;
  /** 年份 */
  year: number;
  /** 月份 (1-12) */
  month?: number;
  /** 周数 (1-53) */
  week?: number;
  /** 日期 (1-31) */
  day?: number;
  /** 星期几 (0-6, 0为周日) */
  dayOfWeek?: number;
  /** ISO 日期字符串 (仅 day 级别) */
  dateString?: string;
}

// =============================================================================
// 超级标签体系 (Supertag System)
// =============================================================================

// 字段类型 - v3.5 新增 multi-select 多选类型
export type FieldType = 'text' | 'number' | 'date' | 'select' | 'multi-select' | 'reference' | 'ai_text' | 'ai_select';

/**
 * AI 字段预设类型
 * v3.5: 简化为 3 种预设类型
 * - extraction: 信息抽取型（从内容中提取关键信息）
 * - summarization: 总结重写型（生成 TL;DR 或格式化重写）
 * - classification: 自动分类/判定型（根据内容特征自动分类）
 * 
 * 保留旧类型用于向后兼容：
 * - urgency_score: (deprecated) 使用 classification
 * - subtask_split: (deprecated) 使用 extraction
 * - custom: (deprecated) 使用 extraction/summarization/classification
 */
export type AIFieldPresetType = 'extraction' | 'summarization' | 'classification' | 'urgency_score' | 'subtask_split' | 'custom';

/**
 * AI 字段触发时机
 * v3.5: 保留字段用于未来扩展，当前版本仅实现 manual
 */
export type AIFieldTrigger = 'manual' | 'create' | 'update';

/**
 * AI 字段输出格式
 */
export type AIFieldOutputFormat = 'text' | 'select' | 'list';

/**
 * AI 字段配置
 * v3.5: 扩展支持子节点上下文收集
 */
export interface AIFieldConfig {
  /** AI 字段预设类型（决定使用哪个系统 Prompt） */
  aiType: AIFieldPresetType;
  /** 用户自定义 Prompt（必填，与系统 Prompt 组合使用） */
  prompt: string;
  /** 触发时机（当前版本仅 manual 有效，create/update 为预留接口） */
  triggerOn: AIFieldTrigger;
  /** 依赖的输入字段（从节点 content 或其他字段获取） */
  inputFields?: string[];
  /** 输出格式 */
  outputFormat: AIFieldOutputFormat;
  /** select 类型的选项列表 */
  options?: string[];
  /** v3.5: 是否包含子节点内容作为上下文 */
  includeChildren?: boolean;
  /** v3.5: 子节点遍历深度（默认 1） */
  contextDepth?: number;
}

/**
 * v2.1 默认内容模版节点树（用于 Supertag.templateContent）
 * v3.5: 新增嵌套标签和预设字段值支持
 */
export interface TemplateNode {
  content: string;
  children?: TemplateNode[];
  /** v3.5: 预设子节点自带的超级标签 ID（递归应用） */
  supertagId?: string;
  /** v3.5: 预设字段初始值 */
  fields?: Record<string, unknown>;
}

// 字段定义
export interface FieldDefinition {
  id: string;
  key: string;           // 例如 "author", "due_date"
  name: string;          // 字段显示名称 (中文)，例如 "作者", "截止日期"
  type: FieldType;
  options?: string[];    // 用于 'select' / 'multi-select' 类型的选项列表
  /** v2.1: reference 类型时的目标 Supertag ID */
  targetTagId?: string;
  /** v2.1: reference 是否允许多选 */
  multiple?: boolean;
  /** v3.4: AI 字段配置（仅 ai_text/ai_select 类型） */
  aiConfig?: AIFieldConfig;
  /** v3.5: 数字字段格式化显示 */
  format?: 'currency' | 'percent' | 'rating' | 'default';
  displayConfig?: Record<string, unknown>;
}

// =============================================================================
// 标签模版系统 (Tag Template System) - v3.4 重构
// =============================================================================

/**
 * 标签模版定义 (系统预置标签)
 * v3.4: 移除父子继承关系和分类系统
 */
export interface TagTemplate {
  id: string;
  name: string;              // 标签名称，例如 "书籍", "会议"
  color: string;             // 标签颜色
  icon?: string;             // 标签图标 (如 ☑️, 📅, 💡)
  description?: string;      // 标签描述
  fieldDefinitions: FieldDefinition[];
  /** v3.3: 是否为全局默认标签（系统预置） */
  isGlobalDefault: boolean;
  /** v3.3: 创建者 ID（预留 UGC 市场） */
  creatorId?: string | null;
  /** v3.3: 标签状态 active/deprecated */
  status: 'active' | 'deprecated';
  order?: number;            // 在列表中的排序
  /** v2.1: 默认内容模版（节点树） */
  templateContent?: TemplateNode | TemplateNode[] | null;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 超级标签定义 (Schema)
 * @deprecated v3.4: 请使用 TagTemplate 类型，此类型保留仅为向后兼容
 */
export interface Supertag {
  id: string;
  name: string;          // 例如 "书籍", "会议"
  color: string;         // 标签颜色
  fieldDefinitions: FieldDefinition[];
  isSystem?: boolean;    // 是否为系统标签（日历标签）- 已废弃
  icon?: string;         // 标签图标 (如 ☑️, 📅, 💡)
  description?: string;  // 标签描述
  order?: number;        // 在列表中的排序
  /** v2.1: 默认内容模版（节点树），应用标签时若无子节点则自动填充 */
  templateContent?: TemplateNode | TemplateNode[] | null;
  /** v3.3: 向后兼容字段 */
  isGlobalDefault?: boolean;
  status?: 'active' | 'deprecated';
  creatorId?: string | null;
}

// =============================================================================
// 独立引用系统 (Independent Reference System)
// =============================================================================

/**
 * 节点引用 - 作为独立实体存储，而非嵌入在正文中
 * 与正文区分开，换行单独展示，编辑时互不干扰
 */
export interface NodeReference {
  id: string;            // 引用自身的唯一 ID
  targetNodeId: string;  // 被引用的节点 ID
  title: string;         // 引用时的节点标题快照
  createdAt: number;     // 引用创建时间
  note?: string;         // 可选的引用批注/备注
}

// 核心单元：节点
export interface Node {
  id: string;
  content: string;       // 笔记文本内容
  type?: NodeType;       // 节点类型，默认为 'text'
  parentId: string | null;
  childrenIds: string[]; // 子节点 ID 排序列表
  isCollapsed: boolean;
  /** 结构角色（user_root / daily_root / normal） */
  nodeRole?: NodeRole;
  // ========== 超级标签体系 ==========
  tags: string[];        // 应用于此节点的 Supertag ID 列表
  supertagId?: string | null;  // 功能标签 ID（排他性，建议只有一个）
  // ===================================
  /** Supertag 定义的字段值。reference 类型时为 { nodeId, title } 或该数组 */
  fields: Record<string, any>;
  createdAt: number;
  updatedAt?: number;    // 更新时间
  // ========== 独立引用系统 ==========
  references?: NodeReference[];  // 独立的引用列表（与 content 分离）
  // ===================================
  // ========== 指令节点系统 ==========
  payload?: CommandConfig | DailyNotePayload | SearchConfig | Record<string, any>;  // 扩展数据
  // ===================================
}

// Store 类型定义
export interface NodeStore {
  nodes: Record<string, Node>;
  rootIds: string[];
  focusedNodeId: string | null;
  
  // 节点操作
  addNode: (parentId: string | null, afterId?: string) => string;
  addSearchNode: (parentId: string | null, config?: import('./search').SearchConfig, afterId?: string) => string;
  updateNode: (id: string, updates: Partial<Node>) => void;
  deleteNode: (id: string) => void;
  
  // 树形操作
  indentNode: (id: string) => void;      // Tab 缩进
  outdentNode: (id: string) => void;     // Shift+Tab 反缩进
  toggleCollapse: (id: string) => void;
  
  // 焦点管理
  setFocusedNode: (id: string | null) => void;
  
  // 持久化
  loadFromStorage: () => void;
  saveToStorage: () => void;
  
  // 初始化
  initWithMockData: () => void;
}

/**
 * SupertagStore 类型定义
 * v3.4: 简化为扁平列表模式，移除分类和继承相关方法
 */
export interface SupertagStore {
  supertags: Record<string, Supertag>;
  /** v3.4: 只读模式标识 */
  isReadOnly: boolean;
  
  // 只读查询方法
  loadFromAPI: () => Promise<void>;
  getAllSupertags: () => Supertag[];
  getSupertag: (id: string) => Supertag | undefined;
  getRecentTags: () => Supertag[];
  trackTagUsage: (tagId: string) => void;
}

// 工具函数类型
export type GenerateId = () => string;

// =============================================================================
// API 相关类型 (API Types)
// =============================================================================

/**
 * API 响应基础结构
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * 分页参数
 */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  cursor?: string;
}

/**
 * 分页响应
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
    nextCursor?: string;
  };
}

/**
 * 节点创建请求
 */
export interface CreateNodeRequest {
  id?: string; // 可选：客户端指定的节点 ID
  parentId?: string | null;
  content?: string;
  nodeType?: NodeType;
  supertagId?: string | null;
  payload?: Record<string, any>;
  fields?: Record<string, any>;
  sortOrder?: number;
  tags?: string[];
  references?: NodeReference[];
}

/**
 * 节点更新请求
 */
export interface UpdateNodeRequest {
  content?: string;
  parentId?: string | null;
  nodeType?: NodeType;
  supertagId?: string | null;
  payload?: Record<string, any>;
  fields?: Record<string, any>;
  sortOrder?: number;
  isCollapsed?: boolean;
  tags?: string[];
  references?: NodeReference[];
}

/**
 * 批量节点操作请求
 */
export interface BatchNodeRequest {
  operations: Array<{
    type: 'create' | 'update' | 'delete';
    id?: string;
    data?: CreateNodeRequest | UpdateNodeRequest;
  }>;
}

// =============================================================================
// v3.3: 用户写操作已移除，以下类型仅供管理员内部 API 使用
// =============================================================================

/**
 * 标签模版创建请求（仅管理员内部 API 使用）
 * v3.4: 移除 parentId 和 categoryId 字段
 * @internal
 */
export interface CreateTagTemplateRequest {
  name: string;
  color?: string;
  icon?: string;
  description?: string;
  order?: number;
  fieldDefinitions?: FieldDefinition[];
  templateContent?: TemplateNode | TemplateNode[] | null;
  isGlobalDefault?: boolean;
  status?: 'active' | 'deprecated';
}

/**
 * @deprecated v3.4: 用户写操作已移除，此类型保留仅为类型兼容
 */
export interface CreateSupertagRequest {
  name: string;
  color?: string;
  icon?: string;
  description?: string;
  order?: number;
  fieldDefinitions?: FieldDefinition[];
  templateContent?: TemplateNode | TemplateNode[] | null;
}

/**
 * @deprecated v3.4: 用户写操作已移除，此类型保留仅为类型兼容
 */
export interface UpdateSupertagRequest {
  name?: string;
  color?: string;
  icon?: string;
  description?: string;
  order?: number;
  fieldDefinitions?: FieldDefinition[];
  templateContent?: TemplateNode | TemplateNode[] | null;
}

/**
 * 数据库节点类型 (与 Prisma 模型对应)
 */
export interface DbNode {
  id: string;
  userId: string;
  parentId: string | null;
  content: string;
  nodeType: string;
  supertagId: string | null;
  payload: Record<string, any>;
  fields: Record<string, any>;
  tags: string[];
  references: NodeReference[] | null;
  sortOrder: number;
  isCollapsed: boolean;
  createdAt: Date;
  updatedAt: Date;
  children?: DbNode[];
}

/**
 * 数据库 TagTemplate 类型 (与 Prisma 模型对应)
 * v3.4: 移除 parentId, categoryId, resolvedFieldDefinitions 字段
 */
export interface DbTagTemplate {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  description: string | null;
  fieldDefinitions: FieldDefinition[];
  /** v3.3: 全局默认标志 */
  isGlobalDefault: boolean;
  /** v3.3: 创建者 ID（预留 UGC） */
  creatorId: string | null;
  /** v3.3: 标签状态 */
  status: string;
  order: number;
  templateContent: TemplateNode | TemplateNode[] | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: { nodes: number };
}

/**
 * @deprecated v3.4: 请使用 DbTagTemplate，此类型保留仅为向后兼容
 */
export interface DbSupertag {
  id: string;
  userId: string;
  name: string;
  color: string;
  icon: string | null;
  fieldDefinitions: FieldDefinition[];
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
  templateContent?: TemplateNode | TemplateNode[] | null;
}

// =============================================================================
// 智能捕获系统 (Smart Capture System) - v3.5
// =============================================================================

/**
 * 智能捕获节点（流式输出单元）
 * v3.5: 合并"文本格式化"与"标签匹配+字段提取"能力
 */
export interface SmartCaptureNode {
  /** 临时 ID，用于建立父子关系 */
  tempId: string;
  /** 父节点临时 ID，null 表示根节点 */
  parentTempId: string | null;
  /** 节点正文内容 */
  content: string;
  /** 匹配的超级标签 ID（单标签策略：仅挂载匹配度最高的一个） */
  supertagId: string | null;
  /** 提取的字段值 */
  fields: Record<string, unknown>;
  /** AI 置信度 (0-1)，用于前端展示和降级判断 */
  confidence: number;
  /** 是否为 AI 自动提取（用于前端 AI 标记视觉反馈） */
  isAIExtracted: boolean;
}

/**
 * 智能捕获 SSE 事件类型
 */
export type SmartCaptureEventType = 'node' | 'done' | 'error';

/**
 * 智能捕获节点事件
 */
export interface SmartCaptureNodeEvent {
  event: 'node';
  data: SmartCaptureNode;
}

/**
 * 智能捕获完成事件
 */
export interface SmartCaptureDoneEvent {
  event: 'done';
  data: {
    success: true;
    nodeCount: number;
    requestId: string;
  };
}

/**
 * 智能捕获错误事件
 */
export interface SmartCaptureErrorEvent {
  event: 'error';
  data: {
    code: string;
    message: string;
  };
}

/**
 * 智能捕获 SSE 事件联合类型
 */
export type SmartCaptureEvent = 
  | SmartCaptureNodeEvent 
  | SmartCaptureDoneEvent 
  | SmartCaptureErrorEvent;

/**
 * 智能捕获进度状态
 */
export interface SmartCaptureProgress {
  /** 已创建节点数 */
  nodeCount: number;
  /** tempId → realId 映射 */
  tempIdMap: Map<string, string>;
  /** 目标父节点 ID */
  targetParentId: string;
  /** 是否正在进行 */
  isActive: boolean;
  /** AbortController 用于取消 */
  abortController: AbortController | null;
  /** 带标签的节点数 */
  taggedNodeCount: number;
}