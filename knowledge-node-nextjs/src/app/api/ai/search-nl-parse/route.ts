/**
 * 自然语言搜索解析 API
 * POST /api/ai/search-nl-parse
 * 
 * 透传到后端 Agent API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// ============================================================================
// 类型定义
// ============================================================================

export interface SearchNLParseRequest {
  query: string;
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
  currentDate?: string;
}

// ============================================================================
// API Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录，请先登录后再使用 AI 功能' },
        { status: 401 }
      );
    }

    const body: SearchNLParseRequest = await request.json();
    const { query, supertags, currentDate } = body;

    // 验证必填参数
    if (!query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json(
        { success: false, error: '请输入查询条件' },
        { status: 400 }
      );
    }

    // 调用后端 Agent API
    const backendUrl = process.env.BACKEND_API_URL || process.env.BACKEND_URL || 'http://localhost:4000';
    const response = await fetch(`${backendUrl}/api/agent/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: session.user.id,
        prompt: query.trim(),
        options: {
          stream: false,
          forceTool: 'search_nl_parse',
        },
        context: {
          metadata: {
            query: query.trim(),
            supertags: supertags || [],
            currentDate: currentDate || new Date().toISOString().split('T')[0],
          },
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: '后端请求失败' }));
      return NextResponse.json(
        { success: false, error: errorData.message || 'AI 服务请求失败' },
        { status: response.status }
      );
    }

    const result = await response.json();

    // 解析返回值
    let parsedResult = null;
    try {
      parsedResult = JSON.parse(result.content || '{}');
    } catch {
      parsedResult = {
        success: false,
        error: '解析失败',
        suggestions: ['请重试或使用手动配置模式'],
      };
    }

    return NextResponse.json({
      success: parsedResult.success,
      config: parsedResult.config,
      explanation: parsedResult.explanation,
      warnings: parsedResult.warnings,
      confidence: parsedResult.confidence,
      error: parsedResult.error,
      suggestions: parsedResult.suggestions,
    });
  } catch (error) {
    console.error('[search-nl-parse] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'AI 解析失败',
        suggestions: ['请重试或使用手动配置模式'],
      },
      { status: 500 }
    );
  }
}
