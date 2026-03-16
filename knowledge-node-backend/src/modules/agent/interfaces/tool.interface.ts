/**
 * Agent 工具系统接口定义
 */

/**
 * 工具执行上下文
 */
export interface ExecutionContext {
  /** 用户ID */
  userId: string;
  /** 当前节点ID */
  nodeId?: string;
  /** 关联节点数据 */
  nodes?: Array<{
    id: string;
    title: string;
    content?: string;
    fields?: Record<string, unknown>;
  }>;
  /** 字段数据 */
  fields?: Record<string, unknown>;
  /** 前置步骤输出 */
  previousOutputs?: Map<string, unknown>;
  /** 执行配置 */
  config?: {
    maxTokens?: number;
    temperature?: number;
    model?: string;
  };
  /** 自定义元数据（来自请求 context.metadata） */
  metadata?: Record<string, unknown>;
}

/**
 * 工具输入基础类型
 */
export interface ToolInput {
  /** 用户原始指令 */
  prompt?: string;
  /** 额外参数 */
  [key: string]: unknown;
}

/**
 * 工具输出类型
 */
export interface ToolOutput {
  /** 输出类型 */
  type: 'chunk' | 'complete' | 'error' | 'metadata';
  /** 文本内容 */
  content?: string;
  /** 元数据 */
  metadata?: Record<string, unknown>;
  /** 错误信息 */
  error?: string;
}

/**
 * AI工具接口 - 所有工具必须实现此接口
 */
export interface AITool<TInput extends ToolInput = ToolInput, TOutput extends ToolOutput = ToolOutput> {
  /** 工具唯一标识 */
  readonly name: string;
  /** 工具描述 - 用于意图识别匹配 */
  readonly description: string;
  /** 输入参数JSON Schema */
  readonly inputSchema: Record<string, unknown>;
  /** 工具分类 */
  readonly category: ToolCategory;
  /** 是否需要上下文 */
  readonly requiresContext: boolean;

  /**
   * 执行工具
   * @param input 输入参数
   * @param context 执行上下文
   * @returns 异步生成器，支持流式输出
   */
  execute(input: TInput, context: ExecutionContext): AsyncGenerator<TOutput>;

  /**
   * 验证输入参数
   * @param input 输入参数
   * @returns 验证结果
   */
  validateInput(input: TInput): { valid: boolean; errors?: string[] };
}

/**
 * 工具分类
 */
export type ToolCategory =
  | 'productivity'  // 生产力工具
  | 'analysis'      // 分析工具
  | 'creative'      // 创意工具
  | 'summary'       // 总结工具
  | 'search'        // 搜索工具
  | 'expansion'     // 扩展工具
  | 'transform'     // 转换工具
  | 'extraction';   // 提取工具

/**
 * 工具注册信息
 */
export interface ToolRegistration {
  tool: AITool;
  priority: number;
  enabled: boolean;
}
