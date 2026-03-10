/**
 * 快捷动作 API 端点
 * POST /api/ai/quick-action
 * 
 * 处理节点级快捷 AI 动作请求，通过 SSE 流式输出
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// 优先使用 BACKEND_API_URL（Docker 内部通信），其次 BACKEND_URL，最后默认值
const BACKEND_URL = process.env.BACKEND_API_URL || process.env.BACKEND_URL || 'http://localhost:4000';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'dev-internal-key';

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
    if (!body.nodeId || !body.actionType || !body.context?.nodeContent) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数：nodeId, actionType, context.nodeContent' },
        { status: 400 }
      );
    }

    // 验证动作类型
    const validActionTypes = ['extract_tasks', 'structured_summary', 'inline_rewrite'];
    if (!validActionTypes.includes(body.actionType)) {
      return NextResponse.json(
        { success: false, error: '无效的动作类型' },
        { status: 400 }
      );
    }

    // 构建请求体
    const requestBody = {
      userId: session.user.id,
      nodeId: body.nodeId,
      actionType: body.actionType,
      context: body.context,
    };

    // 代理到后端
    const backendResponse = await fetch(`${BACKEND_URL}/api/ai/quick-action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': session.user.id,
        'x-internal-api-key': INTERNAL_API_KEY,
      },
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
    const encoder = new TextEncoder();

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
        await writer.write(encoder.encode(
          `data: ${JSON.stringify({ event: 'error', data: { code: 'STREAM_ERROR', message: '流传输错误' } })}\n\n`
        ));
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
  return NextResponse.json({
    service: 'ai-quick-action',
    available: true,
    timestamp: Date.now(),
  });
}
