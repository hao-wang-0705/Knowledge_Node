/**
 * 自然语言搜索解析 API
 * POST /api/ai/search-nl-parse
 *
 * 解析用户的自然语言查询，生成结构化的搜索条件
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  AIClient,
  SEARCH_NL_PARSE_SYSTEM_PROMPT,
  buildSearchNLParsePrompt,
  parseSearchNLResponse,
} from '@/services/ai';

export interface SearchNLParseRequest {
  /** 用户的自然语言查询 */
  query: string;
  /** Supertag schema 列表 */
  supertags: Array<{
    id: string;
    name: string;
    icon?: string;
    fields: Array<{
      key: string;
      name: string;
      type: 'text' | 'number' | 'date' | 'select';
      options?: string[];
    }>;
  }>;
  /** 当前日期（可选，默认使用服务器日期） */
  currentDate?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: SearchNLParseRequest = await request.json();
    const { query, supertags, currentDate } = body;

    // 验证必填参数
    if (!query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json(
        { success: false, error: '请输入查询条件' },
        { status: 400 }
      );
    }

    // 初始化 AI 客户端
    const client = new AIClient();

    // 检查服务可用性
    if (!client.isAvailable()) {
      const validation = client.getValidation();
      return NextResponse.json(
        {
          success: false,
          error: 'AI 服务不可用',
          details: validation.errors,
        },
        { status: 503 }
      );
    }

    // 构建提示词
    const userPrompt = buildSearchNLParsePrompt({
      query: query.trim(),
      supertags: supertags || [],
      currentDate: currentDate || new Date().toISOString().split('T')[0],
    });

    // 调用 AI 服务
    const response = await client.complete({
      systemPrompt: SEARCH_NL_PARSE_SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.3, // 降低温度以获得更稳定的结构化输出
    });

    // 解析 AI 响应
    const parseResult = parseSearchNLResponse(response.content);

    return NextResponse.json({
      success: parseResult.success,
      config: parseResult.config,
      explanation: parseResult.explanation,
      warnings: parseResult.warnings,
      confidence: parseResult.confidence,
      error: parseResult.error,
      suggestions: parseResult.suggestions,
    });
  } catch (error) {
    console.error('[search-nl-parse] Error:', error);

    const message = error instanceof Error ? error.message : 'AI 解析失败';

    return NextResponse.json(
      {
        success: false,
        error: message,
        suggestions: ['请重试或使用手动配置模式'],
      },
      { status: 500 }
    );
  }
}
