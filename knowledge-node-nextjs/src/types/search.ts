export type ConditionType = 'tag' | 'field' | 'keyword' | 'ancestor' | 'date';

export type ConditionOperator =
  | 'equals'
  | 'contains'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte'
  | 'is'
  | 'isNot'
  | 'hasAny'
  | 'hasAll'
  | 'today'
  | 'withinDays';

export type LogicalOperator = 'AND' | 'OR';

export interface SearchCondition {
  type: ConditionType;
  field?: string;
  operator: ConditionOperator;
  value: string | number | boolean | string[];
  negate?: boolean;
}

export interface SearchConfig {
  conditions: SearchCondition[];
  logicalOperator: LogicalOperator;
  label?: string;
}

export interface SearchQuery {
  conditions: SearchCondition[];
  logicalOperator: LogicalOperator;
  take?: number;
  cursor?: string;
}

export interface SearchQueryResult {
  items: Array<Record<string, unknown>>;
  nextCursor?: string | null;
}

// ============================================================================
// 自然语言搜索解析类型定义
// v3.5: 支持 AI 将自然语言转换为结构化查询条件
// ============================================================================

/**
 * 自然语言解析结果
 * AI 返回的解析结果结构
 */
export interface NLParseResult {
  /** 解析是否成功 */
  success: boolean;
  /** 解析出的搜索配置（与现有 SearchConfig 兼容） */
  config?: SearchConfig;
  /** 解析说明（人类可读的条件描述） */
  explanation?: string;
  /** 警告信息（部分无法识别的内容） */
  warnings?: string[];
  /** 置信度 (0-1)，低于 0.7 需要用户确认 */
  confidence?: number;
  /** 错误信息（解析失败时） */
  error?: string;
  /** 建议（解析失败时给用户的建议） */
  suggestions?: string[];
}

/**
 * 自然语言解析请求参数
 */
export interface NLParseRequest {
  /** 用户输入的自然语言查询 */
  query: string;
  /** 当前日期（用于相对日期计算） */
  currentDate: string;
  /** 可用的 Supertag Schema（用于标签和字段匹配） */
  supertagsSchema: NLSupertagSchema[];
}

/**
 * Supertag Schema（精简版，用于 AI 上下文）
 */
export interface NLSupertagSchema {
  id: string;
  name: string;
  icon?: string;
  fields: NLFieldSchema[];
}

/**
 * 字段 Schema（精简版，用于 AI 上下文）
 */
export interface NLFieldSchema {
  key: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'select';
  options?: string[];
}

/**
 * 自然语言解析状态
 */
export type NLParseStatus = 'idle' | 'parsing' | 'success' | 'warning' | 'error';

/**
 * 自然语言搜索 Store 状态
 */
export interface NLSearchState {
  /** 用户输入的自然语言 */
  inputText: string;
  /** 解析状态 */
  status: NLParseStatus;
  /** 解析结果 */
  result: NLParseResult | null;
  /** 是否显示高级模式（手动编辑） */
  showAdvancedMode: boolean;
}