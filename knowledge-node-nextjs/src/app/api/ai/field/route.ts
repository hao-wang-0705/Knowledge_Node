/**
 * AI 字段处理 API
 * 处理 AI 智能字段的生成请求
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { processAIField, AIFieldProcessResult } from '@/services/ai/field-processor';
import { collectChildrenContextByLogicalId } from '@/services/ai/db-context-collector';
import type { FieldDefinition } from '@/types';

export interface AIFieldRequestBody {
  nodeContent: string;
  fieldDef: FieldDefinition;
  existingFields?: Record<string, unknown>;
  childrenContext?: string;
  /** 节点 ID（logicalId），用于后端从数据库获取子节点上下文 */
  nodeId?: string;
}

export async function POST(request: Request) {
  try {
    // 验证用户身份
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录，请先登录后再使用 AI 功能', fieldKey: '', value: null },
        { status: 401 }
      );
    }

    const body: AIFieldRequestBody = await request.json();
    
    const { nodeContent, fieldDef, existingFields, childrenContext, nodeId } = body;

    // 验证必需字段
    if (!fieldDef) {
      return NextResponse.json(
        { success: false, error: '缺少字段定义', fieldKey: '', value: null },
        { status: 400 }
      );
    }

    if (fieldDef.type !== 'ai_text' && fieldDef.type !== 'ai_select') {
      return NextResponse.json(
        { success: false, error: '不是 AI 字段类型', fieldKey: '', value: null },
        { status: 400 }
      );
    }

    // 如果配置了 includeChildren 且提供了 nodeId，从数据库查询子节点上下文
    let finalChildrenContext = childrenContext;
    if (fieldDef.aiConfig?.includeChildren && nodeId && !childrenContext) {
      const contextResult = await collectChildrenContextByLogicalId(
        nodeId,
        session.user.id,
        { maxDepth: fieldDef.aiConfig.contextDepth ?? 1 }
      );
      if (contextResult.nodeCount > 0) {
        finalChildrenContext = contextResult.content;
        console.log(`[AI Field API] 从数据库收集子节点上下文: ${contextResult.nodeCount} 个节点, 深度 ${contextResult.actualDepth}`);
      }
    }

    // 调用 AI 字段处理器
    const result = await processAIField({
      nodeContent: nodeContent || '',
      fieldDef,
      existingFields: existingFields || {},
      childrenContext: finalChildrenContext,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[AI Field API] 处理失败:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '处理失败',
        fieldKey: '',
        value: null,
      } as AIFieldProcessResult,
      { status: 500 }
    );
  }
}
