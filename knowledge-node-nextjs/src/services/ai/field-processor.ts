/**
 * AI 字段处理器
 * v3.4: 实现 AI 智能字段的自动计算逻辑
 * v3.5: 新增 extraction/summarization/classification 三种预设类型，支持子节点上下文
 * 
 * 支持的预设 AI 字段类型：
 * - extraction: 信息抽取型
 * - summarization: 总结重写型
 * - classification: 自动分类/判定型
 * 
 * 已废弃（保留向后兼容）：
 * - urgency_score: 紧急度评分（P0-P3）
 * - subtask_split: 子任务拆解
 * - custom: 自定义 Prompt
 */

import type { Node, FieldDefinition, AIFieldConfig, AIFieldPresetType } from '@/types';
import { gatewayComplete, isGatewayAvailable } from './gateway';
import { AI_FIELD_PROMPTS, buildAIFieldPrompt, parseAIFieldResponse, getAIFieldSystemPrompt } from './prompts';
import { collectNodeContext, collectChildrenContext } from './context-collector';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * AI 字段处理请求参数
 */
export interface AIFieldProcessRequest {
  /** 节点内容 */
  nodeContent: string;
  /** AI 字段定义 */
  fieldDef: FieldDefinition;
  /** 节点的其他字段值 */
  existingFields?: Record<string, unknown>;
  /** 请求 ID（用于追踪） */
  requestId?: string;
  /** v3.5: 子节点上下文（用于 includeChildren 场景） */
  childrenContext?: string;
  /** v3.5: 当前节点 ID（用于上下文收集） */
  nodeId?: string;
  /** v3.5: 所有节点映射（用于上下文收集） */
  nodes?: Record<string, Node>;
}

/**
 * AI 字段处理结果
 */
export interface AIFieldProcessResult {
  /** 字段 key */
  fieldKey: string;
  /** 计算后的值 */
  value: unknown;
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
  /** 原始 AI 响应 */
  rawResponse?: string;
}

/**
 * 批量处理结果
 */
export interface BatchProcessResult {
  /** 处理后的字段值映射 */
  fields: Record<string, unknown>;
  /** 处理详情 */
  details: AIFieldProcessResult[];
  /** 总体是否成功 */
  success: boolean;
  /** 处理耗时（毫秒） */
  duration: number;
}

// ============================================================================
// AI 字段处理器类
// ============================================================================

/**
 * AI 字段处理器
 * 负责处理 AI 智能字段的计算逻辑
 */
export class AIFieldProcessor {
  private static instance: AIFieldProcessor | null = null;

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): AIFieldProcessor {
    if (!AIFieldProcessor.instance) {
      AIFieldProcessor.instance = new AIFieldProcessor();
    }
    return AIFieldProcessor.instance;
  }

  /**
   * 检查 AI 服务是否可用
   */
  isAvailable(): boolean {
    return isGatewayAvailable();
  }

  /**
   * 处理单个 AI 字段
   * v3.5: 支持新的三种预设类型和子节点上下文收集
   */
  async processField(request: AIFieldProcessRequest): Promise<AIFieldProcessResult> {
    const { nodeContent, fieldDef, existingFields, requestId, childrenContext, nodeId, nodes } = request;

    // 验证字段类型
    if (!this.isAIField(fieldDef)) {
      return {
        fieldKey: fieldDef.key,
        value: null,
        success: false,
        error: `字段 ${fieldDef.key} 不是 AI 字段类型`,
      };
    }

    const aiConfig = fieldDef.aiConfig!;

    // 检查 AI 服务是否可用
    if (!this.isAvailable()) {
      return {
        fieldKey: fieldDef.key,
        value: null,
        success: false,
        error: 'AI 服务不可用',
      };
    }

    try {
      // v3.5: 收集子节点上下文
      let resolvedChildrenContext = childrenContext;
      if (!resolvedChildrenContext && aiConfig.includeChildren && nodeId && nodes) {
        const contextResult = collectChildrenContext(nodeId, nodes, {
          maxDepth: aiConfig.contextDepth ?? 1,
          showDepthIndicator: true,
        });
        resolvedChildrenContext = contextResult.content;
      }

      // 构建 Prompt
      const prompt = buildAIFieldPrompt({
        aiType: aiConfig.aiType,
        nodeContent,
        fieldDef,
        existingFields,
        customPrompt: aiConfig.prompt,
        childrenContext: resolvedChildrenContext,
      });

      // v3.5: 使用对应类型的系统 Prompt
      const systemPrompt = getAIFieldSystemPrompt(aiConfig.aiType);

      // 调用 AI 服务
      const response = await gatewayComplete({
        prompt,
        systemPrompt,
        temperature: 0.3, // 使用较低温度以获得更一致的结果
        maxTokens: 1000, // v3.5: 增大限制以避免总结类字段被截断
        requestId: requestId || `ai_field_${fieldDef.key}_${Date.now()}`,
      });

      // 解析响应
      const parsedValue = parseAIFieldResponse(response.content, aiConfig);

      return {
        fieldKey: fieldDef.key,
        value: parsedValue,
        success: true,
        rawResponse: response.content,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[AIFieldProcessor] 处理字段 ${fieldDef.key} 失败:`, errorMessage);

      return {
        fieldKey: fieldDef.key,
        value: null,
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * 批量处理节点的所有 AI 字段
   * v3.5: 新增 nodeId 和 nodes 参数用于子节点上下文收集
   */
  async processNodeFields(
    nodeContent: string,
    fieldDefinitions: FieldDefinition[],
    existingFields: Record<string, unknown> = {},
    triggerType: 'create' | 'update' | 'manual' = 'create',
    nodeId?: string,
    nodes?: Record<string, Node>
  ): Promise<BatchProcessResult> {
    const startTime = Date.now();
    const aiFields = fieldDefinitions.filter(
      (f) => this.isAIField(f) && this.shouldTrigger(f.aiConfig!, triggerType)
    );

    if (aiFields.length === 0) {
      return {
        fields: {},
        details: [],
        success: true,
        duration: Date.now() - startTime,
      };
    }

    // 并行处理所有 AI 字段
    const results = await Promise.all(
      aiFields.map((fieldDef) =>
        this.processField({
          nodeContent,
          fieldDef,
          existingFields,
          nodeId,
          nodes,
        })
      )
    );

    // 汇总结果
    const fields: Record<string, unknown> = {};
    let allSuccess = true;

    for (const result of results) {
      if (result.success) {
        fields[result.fieldKey] = result.value;
      } else {
        allSuccess = false;
      }
    }

    return {
      fields,
      details: results,
      success: allSuccess,
      duration: Date.now() - startTime,
    };
  }

  /**
   * 判断字段是否为 AI 字段
   */
  isAIField(fieldDef: FieldDefinition): boolean {
    return (
      (fieldDef.type === 'ai_text' || fieldDef.type === 'ai_select') &&
      !!fieldDef.aiConfig
    );
  }

  /**
   * 判断是否应该触发 AI 计算
   */
  private shouldTrigger(
    aiConfig: AIFieldConfig,
    triggerType: 'create' | 'update' | 'manual'
  ): boolean {
    // manual 触发只在显式调用时执行
    if (aiConfig.triggerOn === 'manual') {
      return triggerType === 'manual';
    }

    // create 触发仅在创建时执行
    if (aiConfig.triggerOn === 'create') {
      return triggerType === 'create';
    }

    // update 触发在创建和更新时都执行
    if (aiConfig.triggerOn === 'update') {
      return triggerType === 'create' || triggerType === 'update';
    }

    return false;
  }

  /**
   * 计算紧急度评分
   * @param nodeContent 节点内容
   * @param existingFields 现有字段值（可能包含 due_date, status 等）
   * @returns P0-P3 优先级
   */
  async calculateUrgencyScore(
    nodeContent: string,
    existingFields: Record<string, unknown> = {}
  ): Promise<string> {
    const prompt = buildAIFieldPrompt({
      aiType: 'urgency_score',
      nodeContent,
      fieldDef: {
        id: 'temp_urgency',
        key: 'urgency_score',
        name: '紧急度',
        type: 'ai_select',
        aiConfig: {
          aiType: 'urgency_score',
          prompt: '评估任务紧急程度',
          triggerOn: 'create',
          outputFormat: 'select',
          options: ['P0', 'P1', 'P2', 'P3'],
        },
      },
      existingFields,
    });

    const response = await gatewayComplete({
      prompt,
      systemPrompt: AI_FIELD_PROMPTS.SYSTEM,
      temperature: 0.2,
      maxTokens: 100,
    });

    return parseAIFieldResponse(response.content, {
      aiType: 'urgency_score',
      prompt: '评估任务紧急程度',
      triggerOn: 'create',
      outputFormat: 'select',
      options: ['P0', 'P1', 'P2', 'P3'],
    }) as string;
  }

  /**
   * 拆解子任务
   * @param nodeContent 节点内容（任务描述）
   * @returns 子任务列表
   */
  async splitSubtasks(nodeContent: string): Promise<string[]> {
    const prompt = buildAIFieldPrompt({
      aiType: 'subtask_split',
      nodeContent,
      fieldDef: {
        id: 'temp_subtasks',
        key: 'subtasks',
        name: '子任务',
        type: 'ai_text',
        aiConfig: {
          aiType: 'subtask_split',
          prompt: '将任务拆解为子任务',
          triggerOn: 'create',
          outputFormat: 'list',
        },
      },
    });

    const response = await gatewayComplete({
      prompt,
      systemPrompt: AI_FIELD_PROMPTS.SYSTEM,
      temperature: 0.5,
      maxTokens: 500,
    });

    return parseAIFieldResponse(response.content, {
      aiType: 'subtask_split',
      prompt: '将任务拆解为子任务',
      triggerOn: 'create',
      outputFormat: 'list',
    }) as string[];
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 获取 AI 字段处理器实例
 */
export function getAIFieldProcessor(): AIFieldProcessor {
  return AIFieldProcessor.getInstance();
}

/**
 * 处理单个 AI 字段
 */
export async function processAIField(
  request: AIFieldProcessRequest
): Promise<AIFieldProcessResult> {
  return getAIFieldProcessor().processField(request);
}

/**
 * 批量处理节点的 AI 字段
 * v3.5: 新增 nodeId 和 nodes 参数用于子节点上下文收集
 */
export async function processNodeAIFields(
  nodeContent: string,
  fieldDefinitions: FieldDefinition[],
  existingFields: Record<string, unknown> = {},
  triggerType: 'create' | 'update' | 'manual' = 'create',
  nodeId?: string,
  nodes?: Record<string, Node>
): Promise<BatchProcessResult> {
  return getAIFieldProcessor().processNodeFields(
    nodeContent,
    fieldDefinitions,
    existingFields,
    triggerType,
    nodeId,
    nodes
  );
}

/**
 * 检查节点是否包含需要处理的 AI 字段
 */
export function hasAIFields(fieldDefinitions: FieldDefinition[]): boolean {
  const processor = getAIFieldProcessor();
  return fieldDefinitions.some((f) => processor.isAIField(f));
}

/**
 * 获取需要处理的 AI 字段列表
 */
export function getAIFieldDefinitions(
  fieldDefinitions: FieldDefinition[],
  triggerType?: 'create' | 'update' | 'manual'
): FieldDefinition[] {
  const processor = getAIFieldProcessor();
  return fieldDefinitions.filter((f) => {
    if (!processor.isAIField(f)) return false;
    if (!triggerType) return true;
    
    const aiConfig = f.aiConfig!;
    if (aiConfig.triggerOn === 'manual') return triggerType === 'manual';
    if (aiConfig.triggerOn === 'create') return triggerType === 'create';
    if (aiConfig.triggerOn === 'update') return triggerType === 'create' || triggerType === 'update';
    return false;
  });
}
