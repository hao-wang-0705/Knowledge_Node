/**
 * 链式执行器
 * 按顺序执行多步任务，支持上下文传递
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  ExecutionPlan,
  ExecutionStep,
  ExecutionContext,
  ToolOutput,
  AgentStreamEvent,
  AgentStreamEventType,
} from '../interfaces';
import { TaskExecutor } from './task.executor';
import { PlanGenerator } from '../analyzer/plan.generator';

@Injectable()
export class ChainExecutor {
  private readonly logger = new Logger(ChainExecutor.name);

  constructor(
    private readonly taskExecutor: TaskExecutor,
    private readonly planGenerator: PlanGenerator,
  ) {}

  /**
   * 执行完整计划
   */
  async *execute(plan: ExecutionPlan): AsyncGenerator<AgentStreamEvent> {
    this.logger.log(`Starting execution of plan ${plan.id}`);

    // 发送计划创建事件
    yield this.createEvent('plan_created', {
      planId: plan.id,
      steps: plan.steps.map(s => ({
        id: s.id,
        tool: s.tool,
        status: s.status,
      })),
    });

    // 更新计划状态
    let currentPlan = this.planGenerator.updatePlanStatus(plan, 'running');

    // 按依赖顺序执行步骤
    const executionOrder = this.resolveExecutionOrder(currentPlan.steps);
    const stepOutputs = new Map<string, string>();

    for (const stepId of executionOrder) {
      const step = currentPlan.steps.find(s => s.id === stepId);
      if (!step) continue;

      // 发送步骤开始事件
      yield this.createEvent('step_started', {
        stepId: step.id,
        tool: step.tool,
      });

      // 更新步骤状态
      currentPlan = this.planGenerator.updateStepStatus(currentPlan, stepId, {
        status: 'running',
        startedAt: new Date(),
      });

      // 准备上下文（包含前置步骤输出）
      const context = this.prepareContext(currentPlan.context, step, stepOutputs);

      // 执行步骤
      const outputs: ToolOutput[] = [];
      let stepContent = '';

      try {
        for await (const output of this.taskExecutor.execute(step, context)) {
          outputs.push(output);

          // 转发输出事件
          if (output.type === 'chunk') {
            stepContent += output.content || '';
            yield this.createEvent('step_chunk', {
              stepId: step.id,
              content: output.content,
            });
          } else if (output.type === 'error') {
            throw new Error(output.error);
          } else if (output.type === 'metadata') {
            yield this.createEvent('step_chunk', {
              stepId: step.id,
              metadata: output.metadata,
            });
          }
        }

        // 保存步骤输出
        stepOutputs.set(stepId, stepContent);

        // 发送步骤完成事件
        yield this.createEvent('step_completed', {
          stepId: step.id,
          tool: step.tool,
          content: stepContent,
        });

        // 更新步骤状态
        currentPlan = this.planGenerator.updateStepStatus(currentPlan, stepId, {
          status: 'completed',
          output: outputs,
          completedAt: new Date(),
        });
      } catch (error) {
        // 发送步骤失败事件
        yield this.createEvent('step_failed', {
          stepId: step.id,
          tool: step.tool,
          error: error instanceof Error ? error.message : '执行失败',
        });

        // 更新步骤状态
        currentPlan = this.planGenerator.updateStepStatus(currentPlan, stepId, {
          status: 'failed',
          error: error instanceof Error ? error.message : '执行失败',
          completedAt: new Date(),
        });

        // 根据配置决定是否继续执行
        const shouldContinue = this.shouldContinueOnError(currentPlan, step);
        if (!shouldContinue) {
          yield this.createEvent('plan_failed', {
            planId: currentPlan.id,
            failedStep: stepId,
            error: error instanceof Error ? error.message : '执行失败',
          });
          return;
        }
      }
    }

    // 发送计划完成事件
    yield this.createEvent('plan_completed', {
      planId: currentPlan.id,
      results: Object.fromEntries(stepOutputs),
      stepsCompleted: currentPlan.steps.filter(s => s.status === 'completed').length,
      totalSteps: currentPlan.steps.length,
    });
  }

  /**
   * 解析执行顺序（拓扑排序）
   */
  private resolveExecutionOrder(steps: ExecutionStep[]): string[] {
    const order: string[] = [];
    const visited = new Set<string>();
    const inProgress = new Set<string>();

    const visit = (stepId: string) => {
      if (visited.has(stepId)) return;
      if (inProgress.has(stepId)) {
        throw new Error(`检测到循环依赖: ${stepId}`);
      }

      inProgress.add(stepId);

      const step = steps.find(s => s.id === stepId);
      if (step?.dependsOn) {
        for (const depId of step.dependsOn) {
          visit(depId);
        }
      }

      inProgress.delete(stepId);
      visited.add(stepId);
      order.push(stepId);
    };

    for (const step of steps) {
      visit(step.id);
    }

    return order;
  }

  /**
   * 准备执行上下文
   */
  private prepareContext(
    baseContext: ExecutionContext,
    step: ExecutionStep,
    stepOutputs: Map<string, string>,
  ): ExecutionContext {
    const previousOutputs = new Map<string, unknown>();

    // 添加依赖步骤的输出
    if (step.dependsOn) {
      for (const depId of step.dependsOn) {
        const output = stepOutputs.get(depId);
        if (output) {
          previousOutputs.set(depId, output);
        }
      }
    }

    return {
      ...baseContext,
      previousOutputs,
    };
  }

  /**
   * 判断失败后是否继续执行
   */
  private shouldContinueOnError(_plan: ExecutionPlan, _step: ExecutionStep): boolean {
    // 目前策略：失败即停止
    // 可以扩展为根据步骤配置或计划配置决定
    return false;
  }

  /**
   * 创建流式事件
   */
  private createEvent(type: AgentStreamEventType, data: unknown): AgentStreamEvent {
    return {
      type,
      data,
      timestamp: Date.now(),
    };
  }
}
