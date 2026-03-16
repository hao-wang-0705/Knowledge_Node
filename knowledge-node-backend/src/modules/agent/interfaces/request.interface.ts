/**
 * Agent 请求/响应接口定义
 */

/**
 * Agent 统一请求接口
 */
export interface AgentRequest {
  /** 用户ID */
  userId: string;
  /** 当前节点ID */
  nodeId?: string;
  /** 用户指令/提示 */
  prompt: string;
  /** 上下文数据 */
  context?: AgentRequestContext;
  /** 执行选项 */
  options?: AgentRequestOptions;
}

/**
 * 请求上下文
 */
export interface AgentRequestContext {
  /** 关联节点 */
  nodes?: Array<{
    id: string;
    title: string;
    content?: string;
    fields?: Record<string, unknown>;
  }>;
  /** 字段数据 */
  fields?: Record<string, unknown>;
  /** 选中的文本 */
  selectedText?: string;
  /** 当前页面/视图 */
  currentView?: string;
  /** 自定义元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 请求选项
 */
export interface AgentRequestOptions {
  /** 是否流式输出 */
  stream?: boolean;
  /** 最大执行步骤数 */
  maxSteps?: number;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 指定使用的工具（跳过意图识别） */
  forceTool?: string;
  /** 模型配置 */
  modelConfig?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  };
  /** 是否返回执行计划详情 */
  includePlan?: boolean;
}

/**
 * Agent 响应接口（非流式）
 */
export interface AgentResponse {
  /** 是否成功 */
  success: boolean;
  /** 响应内容 */
  content?: string;
  /** 执行计划详情 */
  plan?: {
    id: string;
    steps: Array<{
      tool: string;
      status: string;
      output?: string;
    }>;
  };
  /** 元数据 */
  metadata?: {
    tokensUsed?: number;
    executionTime?: number;
    toolsUsed?: string[];
  };
  /** 错误信息 */
  error?: string;
}

/**
 * Agent 流式响应事件
 */
export interface AgentStreamEvent {
  /** 事件类型 */
  type: AgentStreamEventType;
  /** 事件数据 */
  data: unknown;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 流式事件类型
 */
export type AgentStreamEventType =
  | 'plan_created'     // 执行计划已创建
  | 'step_started'     // 步骤开始执行
  | 'step_chunk'       // 步骤输出块
  | 'step_completed'   // 步骤执行完成
  | 'step_failed'      // 步骤执行失败
  | 'plan_completed'   // 计划执行完成
  | 'plan_failed'      // 计划执行失败
  | 'error';           // 错误事件

/**
 * 快捷动作请求
 */
export interface QuickActionRequest {
  /** 用户ID */
  userId: string;
  /** 节点ID */
  nodeId: string;
  /** 动作类型 */
  action: QuickActionType;
  /** 选中的内容 */
  selectedContent?: string;
  /** 额外参数 */
  params?: Record<string, unknown>;
}

/**
 * 快捷动作类型
 */
export type QuickActionType =
  | 'expand'           // 扩展
  | 'deconstruct';     // 智能解构（返回节点树预览，不写库）
