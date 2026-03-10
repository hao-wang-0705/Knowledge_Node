/**
 * AI 指令执行 API 端点
 * POST /api/ai/command/execute
 *
 * 代理请求到后端，使用 session 中的 userId 确保用户身份正确
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
    if (!body.nodeId || !body.surface?.userPrompt) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数：nodeId, surface.userPrompt' },
        { status: 400 }
      );
    }

    // 构建请求体 - 使用 session 中的 userId
    const requestBody = {
      userId: session.user.id, // 使用服务端 cuid 格式的 userId
      nodeId: body.nodeId,
      surface: body.surface,
      parentNodeId: body.parentNodeId,
      autoExecute: body.autoExecute ?? true,
    };

    console.log('[Command Execute API] Forwarding request:', {
      userId: session.user.id,
      nodeId: body.nodeId,
      userPrompt: body.surface?.userPrompt?.slice(0, 50),
    });

    // 代理到后端
    const backendResponse = await fetch(`${BACKEND_URL}/api/ai/command/execute`, {
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
      console.error('[Command Execute API] Backend error:', errorText);
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
        console.error('[Command Execute API] Stream error:', error);
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
    console.error('[Command Execute API Error]', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

// GET 请求用于健康检查
export async function GET() {
  return NextResponse.json({
    service: 'ai-command-execute',
    available: true,
    timestamp: Date.now(),
  });
}
