/**
 * AI 工具基类
 * 所有工具必须继承此基类
 */

import OpenAI from 'openai';
import {
  AITool,
  ToolInput,
  ToolOutput,
  ToolCategory,
  ExecutionContext,
} from '../interfaces';

/**
 * 工具基类 - 提供通用功能实现
 */
export abstract class BaseTool<
  TInput extends ToolInput = ToolInput,
  TOutput extends ToolOutput = ToolOutput,
> implements AITool<TInput, TOutput> {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly inputSchema: Record<string, unknown>;
  abstract readonly category: ToolCategory;
  abstract readonly requiresContext: boolean;

  /** OpenAI 客户端实例 */
  protected client: OpenAI | null = null;

  /**
   * 获取 OpenAI 客户端
   */
  protected getClient(): OpenAI {
    if (!this.client) {
      // 优先级：显式 OPENAI / AI 配置 > GEMINI > VENUS（统一通过 OpenAI 兼容 SDK 调用）
      const apiKey =
        process.env.OPENAI_API_KEY ||
        process.env.AI_API_KEY ||
        process.env.GEMINI_API_KEY ||
        process.env.VENUS_API_KEY;

      const baseURL =
        process.env.OPENAI_BASE_URL ||
        process.env.AI_BASE_URL ||
        process.env.VENUS_API_URL;

      if (!apiKey) {
        throw new Error('AI 服务未配置：缺少 OPENAI_API_KEY / GEMINI_API_KEY / VENUS_API_KEY');
      }

      this.client = new OpenAI({
        apiKey,
        baseURL,
      });
    }
    return this.client;
  }

  /**
   * 执行工具 - 子类必须实现
   */
  abstract execute(input: TInput, context: ExecutionContext): AsyncGenerator<TOutput>;

  /**
   * 验证输入参数
   */
  validateInput(input: TInput): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    // 基础验证 - 检查必需字段
    if (this.inputSchema.required && Array.isArray(this.inputSchema.required)) {
      for (const field of this.inputSchema.required as string[]) {
        if (input[field] === undefined || input[field] === null) {
          errors.push(`缺少必需字段: ${field}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * 构建系统提示词
   */
  protected buildSystemPrompt(context: ExecutionContext): string {
    let prompt = `你是一个专业的AI助手。`;

    if (context.nodes && context.nodes.length > 0) {
      prompt += `\n\n当前上下文中包含以下节点信息：`;
      for (const node of context.nodes) {
        prompt += `\n- 节点「${node.title}」`;
        if (node.content) {
          prompt += `: ${node.content.substring(0, 200)}...`;
        }
      }
    }

    return prompt;
  }

  /**
   * 创建流式输出块
   */
  protected createChunk(content: string): TOutput {
    return {
      type: 'chunk',
      content,
    } as TOutput;
  }

  /**
   * 创建完成输出
   */
  protected createComplete(content: string, metadata?: Record<string, unknown>): TOutput {
    return {
      type: 'complete',
      content,
      metadata,
    } as TOutput;
  }

  /**
   * 创建错误输出
   */
  protected createError(error: string): TOutput {
    return {
      type: 'error',
      error,
    } as TOutput;
  }

  /**
   * 创建元数据输出
   */
  protected createMetadata(metadata: Record<string, unknown>): TOutput {
    return {
      type: 'metadata',
      metadata,
    } as TOutput;
  }
}
