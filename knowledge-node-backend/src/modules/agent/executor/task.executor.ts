/**
 * 任务执行器
 * 执行单个工具任务
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  ExecutionStep,
  ExecutionContext,
  ToolOutput,
} from '../interfaces';
import { ToolRegistry } from '../tools';

@Injectable()
export class TaskExecutor {
  private readonly logger = new Logger(TaskExecutor.name);

  constructor(private readonly toolRegistry: ToolRegistry) {}

  /**
   * 执行单个步骤
   */
  async *execute(
    step: ExecutionStep,
    context: ExecutionContext,
  ): AsyncGenerator<ToolOutput> {
    const tool = this.toolRegistry.get(step.tool);

    if (!tool) {
      yield {
        type: 'error',
        error: `工具 ${step.tool} 不存在或已禁用`,
      };
      return;
    }

    // 验证输入
    const validation = tool.validateInput(step.input);
    if (!validation.valid) {
      yield {
        type: 'error',
        error: `输入验证失败: ${validation.errors?.join(', ')}`,
      };
      return;
    }

    this.logger.log(`Executing step ${step.id} with tool ${step.tool}`);

    try {
      // 合并前置步骤输出到上下文
      const enrichedContext = this.enrichContext(context, step);

      // 执行工具
      for await (const output of tool.execute(step.input, enrichedContext)) {
        yield output;
      }
    } catch (error) {
      this.logger.error(`Step ${step.id} execution failed:`, error);
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : '执行失败',
      };
    }
  }

  /**
   * 丰富执行上下文
   */
  private enrichContext(
    context: ExecutionContext,
    step: ExecutionStep,
  ): ExecutionContext {
    // 如果步骤有依赖，将前置步骤的输出添加到上下文
    if (step.dependsOn && step.output) {
      const previousOutputs = context.previousOutputs || new Map();
      
      // 从前置步骤提取完成输出
      const completeOutputs = step.output
        .filter(o => o.type === 'complete')
        .map(o => o.content)
        .join('\n');

      if (completeOutputs) {
        previousOutputs.set(step.id, completeOutputs);
      }

      return {
        ...context,
        previousOutputs,
      };
    }

    return context;
  }

  /**
   * 检查工具是否可用
   */
  isToolAvailable(toolName: string): boolean {
    return this.toolRegistry.has(toolName);
  }

  /**
   * 获取工具信息
   */
  getToolInfo(toolName: string) {
    const tool = this.toolRegistry.get(toolName);
    if (!tool) return null;

    return {
      name: tool.name,
      description: tool.description,
      category: tool.category,
      requiresContext: tool.requiresContext,
      inputSchema: tool.inputSchema,
    };
  }
}
