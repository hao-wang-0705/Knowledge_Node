/**
 * 快捷动作类型定义 - v4.1
 * 节点级 AI 快捷动作系统
 */

// =============================================================================
// 快捷动作类型
// =============================================================================

/**
 * 快捷动作类型
 * - extract_tasks: 提取为待办，从文本中识别任务项生成 todo 子节点
 * - structured_summary: 结构化提炼，提取核心论点生成大纲树
 * - inline_rewrite: 原地重写，扩写润色当前节点内容
 */
export type QuickActionType = 'extract_tasks' | 'structured_summary' | 'inline_rewrite';

/**
 * 快捷动作配置
 */
export interface QuickActionConfig {
  type: QuickActionType;
  /** 显示名称 */
  label: string;
  /** 图标名称 (lucide-react) */
  icon: string;
  /** 动作描述 */
  description: string;
  /** 是否为破坏性动作（会替换原内容） */
  isDestructive?: boolean;
}

/**
 * 预置快捷动作列表
 */
export const QUICK_ACTIONS: QuickActionConfig[] = [
  {
    type: 'extract_tasks',
    label: '提取为待办',
    icon: 'CheckSquare',
    description: '从文本中提取任务项，生成带标签的待办节点',
  },
  {
    type: 'structured_summary',
    label: '结构化提炼',
    icon: 'ListTree',
    description: '提取核心论点，生成层次清晰的大纲',
  },
  {
    type: 'inline_rewrite',
    label: '扩写润色',
    icon: 'Wand2',
    description: '将简短想法扩写为专业完整的表述',
    isDestructive: true,
  },
];

// =============================================================================
// API 请求/响应类型
// =============================================================================

/**
 * 快捷动作上下文
 */
export interface QuickActionContext {
  /** 当前节点内容 */
  nodeContent: string;
  /** 兄弟节点内容（上下文） */
  siblings?: string[];
  /** 祖先节点内容（路径） */
  ancestors?: string[];
}

/**
 * 快捷动作请求 DTO
 */
export interface QuickActionRequest {
  /** 用户 ID */
  userId: string;
  /** 目标节点 ID */
  nodeId: string;
  /** 动作类型 */
  actionType: QuickActionType;
  /** 上下文信息 */
  context: QuickActionContext;
}

// =============================================================================
// SSE 事件类型
// =============================================================================

/**
 * SSE 事件类型
 */
export type QuickActionEventType = 'node' | 'replace' | 'done' | 'error';

/**
 * 节点创建事件（extract_tasks / structured_summary）
 */
export interface QuickActionNodeEvent {
  event: 'node';
  data: {
    /** 临时节点 ID */
    tempId: string;
    /** 父节点临时 ID（null 表示作为目标节点的直接子节点） */
    parentTempId: string | null;
    /** 节点内容 */
    content: string;
    /** 节点类型 */
    nodeType: 'text' | 'heading' | 'todo';
    /** 超级标签 ID（如 #任务） */
    supertagId?: string | null;
    /** 字段值（如 due_date） */
    fields?: Record<string, unknown>;
  };
}

/**
 * 内容替换事件（inline_rewrite）
 */
export interface QuickActionReplaceEvent {
  event: 'replace';
  data: {
    /** 目标节点 ID */
    nodeId: string;
    /** 新内容（增量或完整） */
    content: string;
    /** 是否为最终内容 */
    isFinal?: boolean;
  };
}

/**
 * 完成事件
 */
export interface QuickActionDoneEvent {
  event: 'done';
  data: {
    success: boolean;
    /** 生成的节点数量 */
    nodeCount: number;
    /** 动作类型 */
    actionType: QuickActionType;
  };
}

/**
 * 错误事件
 */
export interface QuickActionErrorEvent {
  event: 'error';
  data: {
    code: string;
    message: string;
  };
}

/**
 * SSE 事件联合类型
 */
export type QuickActionEvent =
  | QuickActionNodeEvent
  | QuickActionReplaceEvent
  | QuickActionDoneEvent
  | QuickActionErrorEvent;

// =============================================================================
// 前端状态类型
// =============================================================================

/**
 * 快捷动作执行状态
 */
export interface QuickActionState {
  /** 正在执行快捷动作的节点 ID */
  executingNodeId: string | null;
  /** 当前执行的动作类型 */
  executingActionType: QuickActionType | null;
  /** 是否正在执行 */
  isExecuting: boolean;
  /** 临时 ID 到真实 ID 的映射 */
  tempIdMap: Map<string, string>;
  /** 已生成的节点数量 */
  generatedNodeCount: number;
  /** AbortController 用于取消请求 */
  abortController: AbortController | null;
}

/**
 * 快捷动作进度信息
 */
export interface QuickActionProgress {
  /** 动作类型 */
  actionType: QuickActionType;
  /** 已生成节点数 */
  nodeCount: number;
  /** 替换内容（仅 inline_rewrite） */
  replacedContent?: string;
}

// =============================================================================
// 工具函数类型
// =============================================================================

/**
 * 获取快捷动作配置
 */
export function getQuickActionConfig(type: QuickActionType): QuickActionConfig | undefined {
  return QUICK_ACTIONS.find(action => action.type === type);
}

/**
 * 判断动作是否为破坏性动作
 */
export function isDestructiveAction(type: QuickActionType): boolean {
  const config = getQuickActionConfig(type);
  return config?.isDestructive ?? false;
}
