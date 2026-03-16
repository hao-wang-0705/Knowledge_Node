/**
 * 快捷动作 API 端点
 * POST /api/ai/quick-action
 * 
 * 透传到后端 Agent API，支持 SSE 流式输出
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const BACKEND_URL = process.env.BACKEND_API_URL || process.env.BACKEND_URL || 'http://localhost:4000';

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

    // 解析请求体
    const body = await request.json();

    // 验证必要参数
    if (!body.nodeId) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数：nodeId' },
        { status: 400 }
      );
    }

    // 映射前端 actionType 到后端 action（仅保留 expand / deconstruct）
    const action = body.actionType === 'deconstruct' ? 'deconstruct' : 'expand';

    // 构建请求体；deconstruct 时传入 supertags 供后端智能解构使用
    const requestBody = {
      userId: session.user.id,
      nodeId: body.nodeId,
      action,
      selectedContent: body.context?.nodeContent || body.selectedContent,
      params: body.params ?? {},
    };

    // 代理到后端 Agent API
    const backendResponse = await fetch(`${BACKEND_URL}/api/agent/quick-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    // 检查响应状态
    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      console.error('[Quick Action API] Backend error:', errorText);
      return NextResponse.json(
        { success: false, error: '后端服务错误' },
        { status: backendResponse.status }
      );
    }

    // 流式响应透传
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    // 读取后端 SSE 响应并转发
    const reader = backendResponse.body?.getReader();
    if (!reader) {
      return NextResponse.json(
        { success: false, error: '无法读取后端响应' },
        { status: 500 }
      );
    }

    // 异步处理流
    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          await writer.write(value);
        }
      } catch (error) {
        console.error('[Quick Action API] Stream error:', error);
      } finally {
        await writer.close();
      }
    })();

    return new NextResponse(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('[Quick Action API Error]', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

// GET 请求用于健康检查
export async function GET() {
  const backendUrl = process.env.BACKEND_API_URL || process.env.BACKEND_URL || 'http://localhost:4000';

  try {
    const response = await fetch(`${backendUrl}/api/agent/health`);
    const data = await response.json();

    return NextResponse.json({
      service: 'ai-quick-action',
      available: data.status === 'ok',
      timestamp: Date.now(),
    });
  } catch {
    return NextResponse.json({
      service: 'ai-quick-action',
      available: false,
      error: '后端服务不可用',
      timestamp: Date.now(),
    });
  }
}
