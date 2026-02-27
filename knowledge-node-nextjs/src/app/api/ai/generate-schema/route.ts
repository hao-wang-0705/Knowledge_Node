/**
 * AI Schema 生成 API
 * 根据标签名称自动生成字段定义
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  aiComplete,
  isAIAvailable,
  getAIStatus,
  SCHEMA_GENERATION_SYSTEM_PROMPT,
  buildSchemaGeneratePrompt,
  parseSchemaGenerateResponse,
} from '@/services/ai';

export async function POST(request: NextRequest) {
  // 检查用户登录状态
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json(
      { error: '请先登录' },
      { status: 401 }
    );
  }

  // 检查 AI 服务状态
  if (!isAIAvailable()) {
    const status = getAIStatus();
    return NextResponse.json(
      { 
        error: 'AI 服务不可用',
        details: status.errors,
      },
      { status: 503 }
    );
  }

  // 解析请求体
  const body = await request.json();
  const { tagName, tagDescription, existingFields } = body;

  if (!tagName || typeof tagName !== 'string') {
    return NextResponse.json(
      { error: '标签名称不能为空' },
      { status: 400 }
    );
  }

  // 构建 Prompt
  const userPrompt = buildSchemaGeneratePrompt({
    tagName,
    tagDescription,
    existingFields,
  });

  // 调用 AI 服务
  const response = await aiComplete({
    systemPrompt: SCHEMA_GENERATION_SYSTEM_PROMPT,
    prompt: userPrompt,
    maxTokens: 1000,
  });

  if (!response.content) {
    return NextResponse.json(
      { error: 'AI 响应为空' },
      { status: 500 }
    );
  }

  // 解析响应
  const result = parseSchemaGenerateResponse(response.content);

  if (!result.fields || result.fields.length === 0) {
    return NextResponse.json(
      { error: '无法生成字段定义' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    fields: result.fields,
    reasoning: result.reasoning,
  });
}
