/**
 * Agent 执行计划接口定义
 */

import { ExecutionContext, ToolOutput } from './tool.interface';

/**
 * 执行计划
 */
export interface ExecutionPlan {
  /** 计划ID */
  id: string;
  /** 执行步骤 */
  steps: ExecutionStep[];
  /** 执行上下文 */
  context: ExecutionContext;
  /** 计划状态 */
  status: PlanStatus;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

/**
 * 执行步骤
 */
export interface ExecutionStep {
  /** 步骤ID */
  id: string;
  /** 使用的工具名称 */
  tool: string;
  /** 工具输入参数 */
  input: Record<string, unknown>;
  /** 依赖的前置步骤ID列表 */
  dependsOn?: string[];
  /** 步骤状态 */
  status: StepStatus;
  /** 步骤输出 */
  output?: ToolOutput[];
  /** 执行开始时间 */
  startedAt?: Date;
  /** 执行完成时间 */
  completedAt?: Date;
  /** 错误信息 */
  error?: string;
  /** 重试次数 */
  retryCount?: number;
}

/**
 * 计划状态
 */
export type PlanStatus =
  | 'pending'     // 待执行
  | 'running'     // 执行中
  | 'completed'   // 已完成
  | 'failed'      // 执行失败
  | 'cancelled';  // 已取消

/**
 * 步骤状态
 */
export type StepStatus =
  | 'pending'     // 待执行
  | 'running'     // 执行中
  | 'completed'   // 已完成
  | 'failed'      // 执行失败
  | 'skipped';    // 已跳过

/**
 * 意图分析结果
 */
export interface IntentAnalysisResult {
  /** 识别到的主要意图 */
  primaryIntent: string;
  /** 子意图列表（用于多步任务） */
  subIntents?: string[];
  /** 推荐的工具 */
  recommendedTools: string[];
  /** 置信度 0-1 */
  confidence: number;
  /** 是否需要上下文 */
  requiresContext: boolean;
  /** 上下文查询DSL */
  contextQueryDSL?: ContextQueryDSL;
  /** 执行策略 */
  actionStrategy: ActionStrategy;
  /** 原始分析数据 */
  rawAnalysis?: Record<string, unknown>;
}

/**
 * 上下文查询DSL
 */
export interface ContextQueryDSL {
  /** 标签筛选 */
  tags?: string[];
  /** 日期范围 */
  dateRange?: 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | string;
  /** 搜索范围 */
  scope?: 'relative' | 'global';
  /** 祖先节点ID */
  ancestorId?: string;
  /** 深度限制 */
  depth?: number;
  /** 关键词 */
  keywords?: string[];
  /** 字段筛选 */
  fieldFilters?: Record<string, unknown>;
}

/**
 * 执行策略
 */
export type ActionStrategy =
  | 'append_children'   // 追加为子节点
  | 'replace_content'   // 替换内容
  | 'create_sibling'    // 创建同级节点
  | 'return_only';      // 仅返回结果
