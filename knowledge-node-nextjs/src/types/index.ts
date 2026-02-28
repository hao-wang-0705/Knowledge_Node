// 导出同步相关类型
export * from './sync';

// 节点类型
// - text: 普通文本节点
// - heading: 标题节点
// - todo: 待办节点
// - command: 指令节点 (AI Command)
// - daily: 每日笔记节点
export type NodeType = 'text' | 'heading' | 'todo' | 'command' | 'daily';

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
export type DailyNoteLevel = 'year' | 'month' | 'week' | 'day';

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

/**
 * 标签分类组
 * 支持用户自定义分类，用于组织和管理标签
 */
export interface TagCategoryGroup {
  id: string;
  name: string;          // 分类名称，如 "功能标签"、"生活"、"工作"
  icon: string;          // 分类图标
  color: string;         // 分类颜色
  description?: string;  // 分类描述
  isSystem?: boolean;    // 是否为系统分类（不可删除）
  order: number;         // 排序顺序
  createdAt: number;
  updatedAt: number;
}

/**
 * 预设分类ID
 */
export const PRESET_CATEGORY_IDS = {
  FUNCTION: 'cat_function',    // 功能标签
  WORK: 'cat_work',           // 工作
  LIFE: 'cat_life',           // 生活
  UNCATEGORIZED: 'cat_uncategorized', // 未分类
} as const;

/**
 * 功能标签图标映射
 */
export const TYPE_TAG_ICONS: Record<string, string> = {
  'tag_task': '☑️',
  'tag_meeting': '📅',
  'tag_idea': '💡',
  'tag_problem': '🔥',
  'tag_bug': '🐛',
  'tag_issue': '🐛',
  'tag_movie': '🎬',
  'tag_game': '🎮',
  'tag_tool': '🔧',
  'tag_doc': '📄',
  // 生活类标签
  'tag_food': '🍽️',
  'tag_travel': '✈️',
  'tag_expense': '💰',
};

// 字段类型 - v2.1 增加 reference（节点引用）
export type FieldType = 'text' | 'number' | 'date' | 'select' | 'reference';

/** v2.1 默认内容模版节点树（用于 Supertag.templateContent） */
export interface TemplateNode {
  content: string;
  children?: TemplateNode[];
}

// 笔记本类型
export interface Notebook {
  id: string;
  name: string;           // 笔记本名称
  icon?: string;          // 可选的图标 emoji
  rootNodeId: string;     // 笔记本的根节点 ID
  createdAt: number;
  updatedAt: number;
}

// 导航模式
export type NavigationMode = 'calendar' | 'notebook';

// 字段定义
export interface FieldDefinition {
  id: string;
  key: string;           // 例如 "author", "due_date"
  name: string;          // 字段显示名称 (中文)，例如 "作者", "截止日期"
  type: FieldType;
  options?: string[];    // 用于 'select' 类型的选项列表
  /** v2.1: reference 类型时的目标 Supertag ID */
  targetTagId?: string;
  /** v2.1: reference 是否允许多选 */
  multiple?: boolean;
  /** v2.1: 是否为继承自父标签的字段（只读展示用） */
  inherited?: boolean;
  displayConfig?: Record<string, unknown>;
}

// 超级标签定义 (Schema)
export interface Supertag {
  id: string;
  name: string;          // 例如 "书籍", "会议"
  color: string;         // 标签颜色
  fieldDefinitions: FieldDefinition[];
  isSystem?: boolean;    // 是否为系统标签（日历标签）
  categoryId: string;    // 所属分类 ID（关联 TagCategoryGroup）
  icon?: string;         // 标签图标 (如 ☑️, 📅, 💡)
  description?: string;  // 标签描述
  order?: number;        // 在分类内的排序
  /** v2.1: 父标签 ID（继承用） */
  parentId?: string | null;
  /** v2.1: 默认内容模版（节点树），应用标签时若无子节点则自动填充 */
  templateContent?: TemplateNode | TemplateNode[] | null;
  /** v2.1: 合并继承后的字段定义（由 API 返回，含父标签字段） */
  resolvedFieldDefinitions?: FieldDefinition[];
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
  payload?: CommandConfig | DailyNotePayload | Record<string, any>;  // 扩展数据
  // ===================================
}

// Store 类型定义
export interface NodeStore {
  nodes: Record<string, Node>;
  rootIds: string[];
  focusedNodeId: string | null;
  
  // 节点操作
  addNode: (parentId: string | null, afterId?: string) => string;
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

export interface SupertagStore {
  supertags: Record<string, Supertag>;
  
  // 功能标签操作
  addSupertag: (name: string, color: string) => string;
  updateSupertag: (id: string, updates: Partial<Supertag>) => void;
  deleteSupertag: (id: string) => void;
  
  // 字段操作
  addFieldDefinition: (supertagId: string, field: Omit<FieldDefinition, 'id'>) => void;
  updateFieldDefinition: (supertagId: string, fieldId: string, updates: Partial<FieldDefinition>) => void;
  removeFieldDefinition: (supertagId: string, fieldId: string) => void;
  
  // 持久化
  loadFromStorage: () => void;
  saveToStorage: () => void;
  
  // 初始化
  initWithMockData: () => void;
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

/**
 * Supertag 创建请求
 */
export interface CreateSupertagRequest {
  name: string;
  color?: string;
  icon?: string;
  description?: string;
  categoryId?: string;
  order?: number;
  fieldDefinitions?: FieldDefinition[];
  parentId?: string | null;
  templateContent?: TemplateNode | TemplateNode[] | null;
}

/**
 * Supertag 更新请求
 */
export interface UpdateSupertagRequest {
  name?: string;
  color?: string;
  icon?: string;
  description?: string;
  categoryId?: string;
  order?: number;
  fieldDefinitions?: FieldDefinition[];
  parentId?: string | null;
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
  sortOrder: number;
  isCollapsed: boolean;
  createdAt: Date;
  updatedAt: Date;
  children?: DbNode[];
}

/**
 * 数据库 Supertag 类型 (与 Prisma 模型对应)
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
  parentId?: string | null;
  templateContent?: TemplateNode | TemplateNode[] | null;
  resolvedFieldDefinitions?: FieldDefinition[];
}