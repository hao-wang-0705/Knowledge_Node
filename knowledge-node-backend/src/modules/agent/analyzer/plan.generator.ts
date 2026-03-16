/**
 * 计划生成器
 * 根据意图分析结果生成执行计划
 */

import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  ExecutionPlan,
  ExecutionStep,
  IntentAnalysisResult,
  ExecutionContext,
} from '../interfaces';
import { ToolRegistry } from '../tools';

@Injectable()
export class PlanGenerator {
  private readonly logger = new Logger(PlanGenerator.name);

  constructor(private readonly toolRegistry: ToolRegistry) {}

  /**
   * 生成执行计划
   */
  generate(
    intent: IntentAnalysisResult,
    context: ExecutionContext,
    userPrompt: string,
  ): ExecutionPlan {
    const planId = uuidv4();
    const steps = this.buildSteps(intent, userPrompt);

    const plan: ExecutionPlan = {
      id: planId,
      steps,
      context,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.logger.log(`Generated plan ${planId} with ${steps.length} steps`);
    return plan;
  }

  /**
   * 构建执行步骤
   */
  private buildSteps(intent: IntentAnalysisResult, userPrompt: string): ExecutionStep[] {
    const steps: ExecutionStep[] = [];
    const tools = intent.recommendedTools || ['text_generate'];

    for (let i = 0; i < tools.length; i++) {
      const toolName = tools[i];
      const tool = this.toolRegistry.get(toolName);

      if (!tool) {
        this.logger.warn(`Tool ${toolName} not found in registry, skipping`);
        continue;
      }

      const stepId = `step-${i + 1}`;
      const input = this.buildToolInput(toolName, userPrompt, intent, i);
      const dependsOn = i > 0 ? [`step-${i}`] : undefined;

      steps.push({
        id: stepId,
        tool: toolName,
        input,
        dependsOn,
        status: 'pending',
      });
    }

    // 如果没有有效步骤，添加默认文本生成步骤
    if (steps.length === 0) {
      steps.push({
        id: 'step-1',
        tool: 'text_generate',
        input: { prompt: userPrompt },
        status: 'pending',
      });
    }

    return steps;
  }

  /**
   * 构建工具输入参数
   */
  private buildToolInput(
    toolName: string,
    userPrompt: string,
    intent: IntentAnalysisResult,
    stepIndex: number,
  ): Record<string, unknown> {
    switch (toolName) {
      case 'text_generate':
        return {
          prompt: userPrompt,
          systemPrompt: this.buildSystemPromptForIntent(intent),
        };

      case 'web_search':
        return {
          query: this.extractSearchQuery(userPrompt),
        };

      case 'summarize':
        return {
          style: this.inferSummarizeStyle(userPrompt),
        };

      case 'expand':
        return {
          targetLength: this.inferTargetLength(userPrompt),
        };

      case 'transcribe':
        return {};

      default:
        return { prompt: userPrompt };
    }
  }

  /**
   * 根据意图构建系统提示词
   */
  private buildSystemPromptForIntent(intent: IntentAnalysisResult): string {
    const basePrompt = '你是一个专业的AI助手。';
    
    const intentPrompts: Record<string, string> = {
      '内容总结': '请提炼核心要点，输出简洁有条理的总结。',
      '内容扩展': '请详细展开内容，补充细节和说明。',
      '联网搜索': '请基于搜索结果，整理准确、时效性强的内容。',
      '通用文本生成': '请根据用户需求生成高质量的内容。',
    };

    const specificPrompt = intentPrompts[intent.primaryIntent] || intentPrompts['通用文本生成'];

    return `${basePrompt}\n${specificPrompt}\n\n输出要求：
1. 严禁使用Markdown格式标记
2. 段落间用双换行分隔
3. 直接输出核心内容`;
  }

  /**
   * 从用户输入中提取搜索查询
   */
  private extractSearchQuery(userPrompt: string): string {
    // 移除常见的前缀词
    const prefixes = ['帮我搜索', '搜索', '查找', '联网查', '在线搜', '帮我查'];
    let query = userPrompt;
    
    for (const prefix of prefixes) {
      if (query.startsWith(prefix)) {
        query = query.slice(prefix.length).trim();
        break;
      }
    }

    return query || userPrompt;
  }

  /**
   * 推断总结风格
   */
  private inferSummarizeStyle(prompt: string): 'brief' | 'detailed' | 'bullet' {
    if (prompt.includes('详细') || prompt.includes('全面')) {
      return 'detailed';
    }
    if (prompt.includes('要点') || prompt.includes('列表') || prompt.includes('清单')) {
      return 'bullet';
    }
    return 'brief';
  }

  /**
   * 推断目标长度
   */
  private inferTargetLength(prompt: string): number {
    const lengthMatch = prompt.match(/(\d+)字/);
    if (lengthMatch) {
      return parseInt(lengthMatch[1], 10);
    }
    
    if (prompt.includes('简短') || prompt.includes('简洁')) {
      return 150;
    }
    if (prompt.includes('详细') || prompt.includes('完整')) {
      return 500;
    }
    
    return 300;
  }

  /**
   * 更新计划状态
   */
  updatePlanStatus(plan: ExecutionPlan, status: ExecutionPlan['status']): ExecutionPlan {
    return {
      ...plan,
      status,
      updatedAt: new Date(),
    };
  }

  /**
   * 更新步骤状态
   */
  updateStepStatus(
    plan: ExecutionPlan,
    stepId: string,
    update: Partial<ExecutionStep>,
  ): ExecutionPlan {
    return {
      ...plan,
      steps: plan.steps.map(step =>
        step.id === stepId ? { ...step, ...update } : step
      ),
      updatedAt: new Date(),
    };
  }
}
