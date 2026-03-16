/**
 * Agent 网关服务
 * 统一的AI服务入口，整合意图分析、计划生成和任务执行
 */

import { Injectable, Logger } from '@nestjs/common';
import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AgentRequest,
  AgentResponse,
  AgentStreamEvent,
  ExecutionContext,
  ExecutionPlan,
  QuickActionRequest,
  QuickActionType,
} from './interfaces';
import { IntentAnalyzer } from './analyzer/intent.analyzer';
import { PlanGenerator } from './analyzer/plan.generator';
import { ChainExecutor } from './executor/chain.executor';
import { ToolRegistry } from './tools';
import type {
  SmartStructureNode,
  SmartStructureTagSchema,
} from './tools/smart-structure.tool';

@Injectable()
export class AgentGateway {
  private readonly logger = new Logger(AgentGateway.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly intentAnalyzer: IntentAnalyzer,
    private readonly planGenerator: PlanGenerator,
    private readonly chainExecutor: ChainExecutor,
    private readonly toolRegistry: ToolRegistry,
  ) {}

  /**
   * 执行 Agent 请求（流式输出）
   */
  async executeStream(request: AgentRequest, res: Response): Promise<void> {
    const { userId, nodeId, prompt, context, options } = request;

    try {
      // 如果显式指定了工具，则走强制单工具流式执行路径
      if (options?.forceTool) {
        await this.executeForcedToolStream(options.forceTool, request, res);
        return;
      }

      // 1. 发送开始事件
      this.sendSSE(res, 'started', { requestId: Date.now().toString() });

      // 2. 分析用户意图
      this.sendSSE(res, 'analyzing', { status: 'intent_analysis' });
      const intentResult = await this.intentAnalyzer.analyze(prompt);
      
      this.sendSSE(res, 'intent', {
        primaryIntent: intentResult.primaryIntent,
        tools: intentResult.recommendedTools,
        confidence: intentResult.confidence,
        requiresContext: intentResult.requiresContext,
      });

      // 3. 收集上下文
      let contextNodes: Array<{
        id: string;
        title: string;
        content?: string;
        fields?: Record<string, unknown>;
      }> = [];

      if (intentResult.requiresContext) {
        contextNodes = await this.collectContext(
          userId,
          nodeId,
          intentResult.contextQueryDSL,
          context,
        );
        
        this.sendSSE(res, 'context', {
          nodeCount: contextNodes.length,
          tokenEstimate: this.estimateTokens(contextNodes),
        });
      }

      // 4. 构建执行上下文
      const executionContext: ExecutionContext = {
        userId,
        nodeId,
        nodes: contextNodes,
        fields: context?.fields,
        config: options?.modelConfig,
      };

      // 5. 生成执行计划
      const plan = this.planGenerator.generate(intentResult, executionContext, prompt);
      
      this.sendSSE(res, 'plan_created', {
        planId: plan.id,
        steps: plan.steps.map(s => ({
          id: s.id,
          tool: s.tool,
        })),
      });

      // 6. 执行计划
      let fullContent = '';
      for await (const event of this.chainExecutor.execute(plan)) {
        // 转发执行事件
        this.sendSSE(res, event.type, event.data);

        // 收集内容
        if (event.type === 'step_chunk' && (event.data as { content?: string }).content) {
          fullContent += (event.data as { content: string }).content;
        }
      }

      // 7. 发送完成事件
      this.sendSSE(res, 'done', {
        success: true,
        content: fullContent,
        plan: options?.includePlan ? {
          id: plan.id,
          steps: plan.steps.map(s => ({
            tool: s.tool,
            status: s.status,
          })),
        } : undefined,
      });

      res.end();
    } catch (error) {
      this.logger.error('Agent execution error:', error);
      this.sendSSE(res, 'error', {
        code: 'AGENT_ERROR',
        message: error instanceof Error ? error.message : 'Agent 执行失败',
      });
      res.end();
    }
  }

  /**
   * 执行 Agent 请求（非流式）
   */
  async execute(request: AgentRequest): Promise<AgentResponse> {
    const { userId, nodeId, prompt, context, options } = request;

    try {
      // 如果显式指定了工具，则走强制单工具非流式执行路径
      if (options?.forceTool) {
        return this.executeForcedToolOnce(options.forceTool, request);
      }

      // 1. 分析意图
      const intentResult = await this.intentAnalyzer.analyze(prompt);

      // 2. 收集上下文
      let contextNodes: Array<{
        id: string;
        title: string;
        content?: string;
        fields?: Record<string, unknown>;
      }> = [];

      if (intentResult.requiresContext) {
        contextNodes = await this.collectContext(
          userId,
          nodeId,
          intentResult.contextQueryDSL,
          context,
        );
      }

      // 3. 构建执行上下文
      const executionContext: ExecutionContext = {
        userId,
        nodeId,
        nodes: contextNodes,
        fields: context?.fields,
        config: options?.modelConfig,
      };

      // 4. 生成并执行计划
      const plan = this.planGenerator.generate(intentResult, executionContext, prompt);

      let fullContent = '';
      let lastStepContent = '';
      const toolsUsed: string[] = [];
      const startTime = Date.now();

      for await (const event of this.chainExecutor.execute(plan)) {
        if (event.type === 'step_chunk' && (event.data as { content?: string }).content) {
          fullContent += (event.data as { content: string }).content;
        }
        if (event.type === 'step_completed') {
          const data = event.data as { tool: string; content?: string };
          toolsUsed.push(data.tool);
          if (typeof data.content === 'string' && data.content.length > 0) {
            lastStepContent = data.content;
          }
        }
      }

      // 对于结构化工具，优先使用最后一步的完整输出内容
      const finalContent = lastStepContent || fullContent;

      return {
        success: true,
        content: finalContent,
        plan: options?.includePlan ? {
          id: plan.id,
          steps: plan.steps.map(s => ({
            tool: s.tool,
            status: s.status,
            output: s.output?.find(o => o.type === 'complete')?.content,
          })),
        } : undefined,
        metadata: {
          executionTime: Date.now() - startTime,
          toolsUsed,
          tokensUsed: Math.ceil(fullContent.length / 2),
        },
      };
    } catch (error) {
      this.logger.error('Agent execution error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Agent 执行失败',
      };
    }
  }

  /**
   * 执行快捷动作
   */
  async executeQuickAction(request: QuickActionRequest, res: Response): Promise<void> {
    const { userId, nodeId, action, selectedContent, params } = request;

    try {
      // 智能解构：优先使用新的 smart_structure（deconstruct 模式）
      if (action === 'deconstruct') {
        const supertags = (params?.supertags as SmartStructureTagSchema[]) ?? [];
        const toolInstance = this.toolRegistry.get('smart_structure') || this.toolRegistry.get('smart_deconstruct');
        if (!toolInstance) {
          throw new Error('工具 smart_structure 不可用');
        }
        const context: ExecutionContext = { userId, nodeId };
        const input = toolInstance.name === 'smart_structure'
          ? {
              text: selectedContent ?? '',
              supertags,
              mode: 'deconstruct',
              nodeId,
              maxDepth: 3,
            }
          : {
              nodeId,
              text: selectedContent ?? '',
              supertags,
            };
        this.sendSSE(res, 'started', { action: 'deconstruct', tool: toolInstance.name });

        let completeJson = '';
        for await (const output of toolInstance.execute(input, context)) {
          if (output.type === 'chunk' && output.content) {
            this.sendSSE(res, 'chunk', { content: output.content });
          } else if (output.type === 'complete' && output.content) {
            completeJson = output.content;
          } else if (output.type === 'error') {
            throw new Error(output.error);
          }
        }

        let nodes: SmartStructureNode[] = [];
        if (completeJson) {
          try {
            const parsed = JSON.parse(completeJson);
            nodes = Array.isArray(parsed) ? parsed : (parsed.nodes || []);
          } catch {
            nodes = [];
          }
        }

        this.sendSSE(res, 'done', {
          success: true,
          actionType: 'deconstruct',
          nodes,
        });
        res.end();
        return;
      }

      // 映射快捷动作到工具
      const actionToolMap: Record<string, { tool: string; input: Record<string, unknown> }> = {
        expand: { tool: 'expand', input: { content: selectedContent } },
      };

      const mapped = actionToolMap[action];
      if (!mapped) {
        throw new Error(`不支持的快捷动作: ${action}`);
      }
      const { tool, input } = mapped;

      const context: ExecutionContext = {
        userId,
        nodeId,
      };

      const toolInstance = this.toolRegistry.get(tool);
      if (!toolInstance) {
        throw new Error(`工具 ${tool} 不可用`);
      }

      this.sendSSE(res, 'started', { action, tool });

      let fullContent = '';
      for await (const output of toolInstance.execute(input, context)) {
        if (output.type === 'chunk') {
          fullContent += output.content || '';
          this.sendSSE(res, 'chunk', { content: output.content });
        } else if (output.type === 'error') {
          throw new Error(output.error);
        }
      }

      this.sendSSE(res, 'done', {
        success: true,
        content: fullContent,
        action,
      });

      res.end();
    } catch (error) {
      this.logger.error('Quick action error:', error);
      this.sendSSE(res, 'error', {
        code: 'QUICK_ACTION_ERROR',
        message: error instanceof Error ? error.message : '快捷动作执行失败',
      });
      res.end();
    }
  }

  /**
   * 获取可用工具列表
   */
  getAvailableTools() {
    return this.toolRegistry.getToolDescriptions();
  }

  /**
   * 收集上下文节点
   */
  private async collectContext(
    userId: string,
    nodeId: string | undefined,
    dsl: { tags?: string[]; dateRange?: string; scope?: string } | undefined,
    requestContext: AgentRequest['context'] | undefined,
  ): Promise<Array<{ id: string; title: string; content?: string; fields?: Record<string, unknown> }>> {
    // 如果请求中已提供节点，直接使用
    if (requestContext?.nodes && requestContext.nodes.length > 0) {
      return requestContext.nodes.map(n => ({
        id: n.id,
        title: n.title || '',
        content: n.content,
        fields: n.fields,
      }));
    }

    // 根据 DSL 查询节点
    const where: Record<string, unknown> = {
      userId,
      deletedAt: null,
    };

    // 标签筛选
    if (dsl?.tags && dsl.tags.length > 0) {
      where.tags = {
        some: {
          tag: {
            name: { in: dsl.tags },
          },
        },
      };
    }

    // 时间范围筛选
    if (dsl?.dateRange) {
      const dateFilter = this.getDateRangeFilter(dsl.dateRange);
      if (dateFilter) {
        where.createdAt = dateFilter;
      }
    }

    // 范围筛选
    if (dsl?.scope === 'relative' && nodeId) {
      // 查询当前节点的子树
      where.ancestorPath = { contains: nodeId };
    }

    try {
      const nodes = await this.prisma.node.findMany({
        where,
        select: {
          id: true,
          content: true,
          fields: true,
        },
        take: 50, // 限制数量
        orderBy: { updatedAt: 'desc' },
      });

      return nodes.map(n => ({
        id: n.id,
        title: this.extractTitle(n.content),
        content: n.content || undefined,
        fields: n.fields as Record<string, unknown> | undefined,
      }));
    } catch (error) {
      this.logger.error('Context collection error:', error);
      return [];
    }
  }

  /**
   * 获取日期范围过滤条件
   */
  private getDateRangeFilter(dateRange: string): { gte?: Date; lte?: Date } | null {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (dateRange) {
      case 'today':
        return { gte: today };
      case 'yesterday': {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return { gte: yesterday, lte: today };
      }
      case 'this_week': {
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        return { gte: weekStart };
      }
      case 'last_week': {
        const lastWeekEnd = new Date(today);
        lastWeekEnd.setDate(lastWeekEnd.getDate() - lastWeekEnd.getDay());
        const lastWeekStart = new Date(lastWeekEnd);
        lastWeekStart.setDate(lastWeekStart.getDate() - 7);
        return { gte: lastWeekStart, lte: lastWeekEnd };
      }
      case 'this_month': {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return { gte: monthStart };
      }
      case 'last_month': {
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return { gte: lastMonthStart, lte: lastMonthEnd };
      }
      default:
        return null;
    }
  }

  /**
   * 从内容中提取标题
   */
  private extractTitle(content: string | null): string {
    if (!content) return '未命名';
    const firstLine = content.split('\n')[0].trim();
    return firstLine.slice(0, 100) || '未命名';
  }

  /**
   * 估算 Token 数量
   */
  private estimateTokens(nodes: Array<{ content?: string }>): number {
    const totalChars = nodes.reduce((sum, n) => sum + (n.content?.length || 0), 0);
    return Math.ceil(totalChars / 2);
  }

  /**
   * 发送 SSE 事件
   */
  private sendSSE(res: Response, event: string, data: unknown): void {
    res.write(`data: ${JSON.stringify({ event, data })}\n\n`);
  }

  /**
   * 将旧工具名映射到新工具名，返回 [实际工具名, 模式] 或 null
   */
  private resolveToolAlias(toolName: string): { resolvedTool: string; mode?: string } {
    switch (toolName) {
      case 'capture':
        return { resolvedTool: 'smart_structure', mode: 'quick' };
      case 'smart_capture':
        return { resolvedTool: 'smart_structure', mode: 'structure' };
      case 'smart_deconstruct':
        return { resolvedTool: 'smart_structure', mode: 'deconstruct' };
      case 'transcribe':
        return { resolvedTool: 'voice_recognize' };
      default:
        return { resolvedTool: toolName };
    }
  }

  /**
   * 构造强制工具输入参数
   */
  private buildForcedToolInput(
    toolName: string,
    prompt: string,
    context: AgentRequest['context'] | undefined,
  ): Record<string, unknown> {
    const metadata = (context?.metadata || {}) as Record<string, unknown>;

    switch (toolName) {
      // ---- v5.0: 新工具 ----
      case 'smart_structure':
        return {
          text: (metadata.text as string) ?? prompt,
          supertags: (metadata.supertags as unknown[]) || [],
          mode: (metadata.mode as string) ?? 'quick',
          nodeId: metadata.nodeId as string | undefined,
          manualTagId: metadata.manualTagId as string | undefined,
          maxDepth: (metadata.maxDepth as number) ?? 3,
        };

      case 'image_recognize':
        return {
          images: (metadata.images as unknown[]) || [],
          extractionHint: metadata.extractionHint as string | undefined,
        };

      case 'voice_recognize':
        return {
          audioBase64: (metadata.audioBase64 as string) ?? '',
          format: (metadata.format as string) ?? 'webm',
          language: (metadata.language as string) ?? 'zh',
        };

      // ---- 旧工具（向后兼容） ----
      case 'capture':
        return {
          text: (metadata.text as string) ?? prompt,
          imageCount: metadata.imageCount as number | undefined,
          voiceTranscription: metadata.voiceTranscription as string | undefined,
          manualTagId: metadata.manualTagId as string | undefined,
          supertags: (metadata.supertags as unknown[]) || [],
        };

      case 'smart_capture':
        return {
          text: (metadata.text as string) ?? prompt,
          supertags: (metadata.supertags as unknown[]) || [],
        };

      case 'search_nl_parse':
        return {
          query: (metadata.query as string) ?? prompt,
          supertags: (metadata.supertags as unknown[]) || [],
        };

      case 'aggregate':
        return {
          query: (metadata.query as string) ?? prompt,
          mode: (metadata.mode as string) ?? 'custom',
          outputFormat: metadata.outputFormat as string | undefined,
        };

      case 'should_suggest_deconstruct':
        return {
          content: (metadata.content as string) ?? prompt ?? '',
        };

      default:
        return { prompt };
    }
  }

  /**
   * 非流式执行强制指定的工具
   */
  private async executeForcedToolOnce(
    rawToolName: string,
    request: AgentRequest,
  ): Promise<AgentResponse> {
    // 别名解析
    const { resolvedTool: toolName, mode: aliasMode } = this.resolveToolAlias(rawToolName);

    const tool = this.toolRegistry.get(toolName);
    if (!tool) {
      return {
        success: false,
        error: `工具 ${toolName} 不存在或已禁用`,
      };
    }

    const { userId, nodeId, prompt, context, options } = request;

    const input = this.buildForcedToolInput(toolName, prompt, context);
    // 如果通过别名映射了模式，覆盖 input.mode
    if (aliasMode && toolName === 'smart_structure') {
      input.mode = aliasMode;
    }

    const validation = tool.validateInput(input as never);
    if (!validation.valid) {
      return {
        success: false,
        error: `输入验证失败: ${validation.errors?.join(', ')}`,
      };
    }

    const executionContext: ExecutionContext = {
      userId,
      nodeId,
      nodes: context?.nodes,
      fields: context?.fields,
      config: options?.modelConfig,
    };

    let fullContent = '';
    let completeContent = '';
    let tokensUsed: number | undefined;
    const toolsUsed: string[] = [toolName];
    const startTime = Date.now();

    try {
      for await (const output of tool.execute(input as never, executionContext)) {
        if (output.type === 'chunk' && output.content) {
          fullContent += output.content;
        } else if (output.type === 'complete' && output.content) {
          completeContent = output.content;
          if (output.metadata && typeof output.metadata.tokensUsed === 'number') {
            tokensUsed = output.metadata.tokensUsed as number;
          }
        } else if (output.type === 'error') {
          return {
            success: false,
            error: output.error,
          };
        }
      }

      const finalContent = completeContent || fullContent;

      return {
        success: true,
        content: finalContent,
        metadata: {
          executionTime: Date.now() - startTime,
          toolsUsed,
          tokensUsed: tokensUsed ?? Math.ceil(finalContent.length / 2),
        },
      };
    } catch (error) {
      this.logger.error('Forced tool execution error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Agent 执行失败',
      };
    }
  }

  /**
   * 流式执行强制指定的工具
   */
  private async executeForcedToolStream(
    rawToolName: string,
    request: AgentRequest,
    res: Response,
  ): Promise<void> {
    const { resolvedTool: toolName, mode: aliasMode } = this.resolveToolAlias(rawToolName);

    const tool = this.toolRegistry.get(toolName);
    if (!tool) {
      this.sendSSE(res, 'error', {
        code: 'TOOL_NOT_FOUND',
        message: `工具 ${toolName} 不存在或已禁用`,
      });
      res.end();
      return;
    }

    const { userId, nodeId, prompt, context, options } = request;

    const input = this.buildForcedToolInput(toolName, prompt, context);
    if (aliasMode && toolName === 'smart_structure') {
      input.mode = aliasMode;
    }

    const validation = tool.validateInput(input as never);
    if (!validation.valid) {
      this.sendSSE(res, 'error', {
        code: 'INVALID_INPUT',
        message: `输入验证失败: ${validation.errors?.join(', ')}`,
      });
      res.end();
      return;
    }

    const executionContext: ExecutionContext = {
      userId,
      nodeId,
      nodes: context?.nodes,
      fields: context?.fields,
      config: options?.modelConfig,
    };

    try {
      this.sendSSE(res, 'started', { requestId: Date.now().toString(), tool: toolName });

      // 构造一个“单步计划”的事件序列，兼容前端现有事件消费逻辑
      const planId = `forced-${Date.now()}`;
      this.sendSSE(res, 'plan_created', {
        planId,
        steps: [{ id: 'step-1', tool: toolName }],
      });

      this.sendSSE(res, 'step_started', {
        stepId: 'step-1',
        tool: toolName,
      });

      let fullContent = '';
      let completeContent = '';

      for await (const output of tool.execute(input as never, executionContext)) {
        if (output.type === 'chunk' && output.content) {
          fullContent += output.content;
          this.sendSSE(res, 'step_chunk', {
            stepId: 'step-1',
            content: output.content,
          });
        } else if (output.type === 'metadata') {
          this.sendSSE(res, 'step_chunk', {
            stepId: 'step-1',
            metadata: output.metadata,
          });
        } else if (output.type === 'complete' && output.content) {
          completeContent = output.content;
        } else if (output.type === 'error') {
          this.sendSSE(res, 'step_failed', {
            stepId: 'step-1',
            tool: toolName,
            error: output.error,
          });
          this.sendSSE(res, 'plan_failed', {
            planId,
            failedStep: 'step-1',
            error: output.error,
          });
          res.end();
          return;
        }
      }

      const finalContent = completeContent || fullContent;

      this.sendSSE(res, 'step_completed', {
        stepId: 'step-1',
        tool: toolName,
        content: finalContent,
      });

      this.sendSSE(res, 'plan_completed', {
        planId,
        results: { 'step-1': finalContent },
        stepsCompleted: 1,
        totalSteps: 1,
      });

      this.sendSSE(res, 'done', {
        success: true,
        content: finalContent,
      });

      res.end();
    } catch (error) {
      this.logger.error('Forced tool stream execution error:', error);
      this.sendSSE(res, 'error', {
        code: 'AGENT_ERROR',
        message: error instanceof Error ? error.message : 'Agent 执行失败',
      });
      res.end();
    }
  }
}
