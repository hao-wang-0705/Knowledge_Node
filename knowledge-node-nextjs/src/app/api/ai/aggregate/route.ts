/**
 * AI 聚合分析 API 端点
 * POST /api/ai/aggregate
 * 
 * 透传到后端 Agent API，支持 SSE 流式输出
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// ============================================================================
// 类型定义
// ============================================================================

interface AggregateRequest {
  query: string;
  mode?: 'summarize' | 'extract' | 'analyze' | 'custom';
  outputFormat?: string;
  nodes?: Array<{
    id: string;
    title: string;
    content?: string;
    fields?: Record<string, unknown>;
  }>;
}

// ============================================================================
// API Handler
// ============================================================================

export async function POST(request: NextRequest) {
  // 验证用户身份
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response(
      JSON.stringify({ success: false, error: '未登录，请先登录后再使用 AI 功能' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 解析请求体
  let body: AggregateRequest;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: '无效的请求格式' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 验证输入
  if (!body.query?.trim()) {
    return new Response(
      JSON.stringify({ success: false, error: '请提供查询内容' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!body.nodes || body.nodes.length === 0) {
    return new Response(
      JSON.stringify({ success: false, error: '没有可聚合的节点数据' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 调用后端 Agent API（流式）
  const backendUrl = process.env.BACKEND_API_URL || process.env.BACKEND_URL || 'http://localhost:4000';

  try {
    const response = await fetch(`${backendUrl}/api/agent/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: session.user.id,
        prompt: body.query.trim(),
        options: {
          stream: true,
          forceTool: 'aggregate',
        },
        context: {
          nodes: body.nodes,
          metadata: {
            mode: body.mode || 'custom',
            outputFormat: body.outputFormat,
          },
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: '后端请求失败' }));
      return new Response(
        JSON.stringify({ success: false, error: errorData.message || 'AI 服务请求失败' }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 转发 SSE 流
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            controller.enqueue(encoder.encode(chunk));
          }
        } catch (error) {
          console.error('[Aggregate API] Stream error:', error);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : '处理失败' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
