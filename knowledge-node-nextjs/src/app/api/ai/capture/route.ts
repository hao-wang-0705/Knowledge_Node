/**
 * AI 快速捕获 API 端点
 * POST /api/ai/capture
 * 
 * 透传到后端 Agent API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { type SupertagSchema } from '@/services/ai';

// ============================================================================
// 类型定义
// ============================================================================

interface ImageData {
  base64: string;
  name: string;
}

interface CaptureRequest {
  text?: string;
  images?: ImageData[];
  voiceTranscription?: string;
  manualTagId?: string;
  supertags: SupertagSchema[];
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

    // 解析请求体
    const body: CaptureRequest = await request.json();

    // 验证输入
    const hasInput = body.text?.trim() || body.voiceTranscription?.trim() || (body.images && body.images.length > 0);
    if (!hasInput) {
      return NextResponse.json(
        { success: false, error: '请提供要处理的内容' },
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
        prompt: body.text || body.voiceTranscription || '',
        options: {
          stream: false,
          forceTool: 'capture',
        },
        context: {
          metadata: {
            text: body.text,
            imageCount: body.images?.length,
            voiceTranscription: body.voiceTranscription,
            manualTagId: body.manualTagId,
            supertags: body.supertags,
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

    return NextResponse.json({
      success: true,
      data: result.content ? JSON.parse(result.content) : result,
      meta: {
        model: result.metadata?.model,
        tokensUsed: result.metadata?.tokensUsed,
      },
    });
  } catch (error) {
    console.error('[AI Capture API Error]', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '处理失败' },
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
      service: 'ai-capture',
      available: data.status === 'ok',
      timestamp: Date.now(),
    });
  } catch {
    return NextResponse.json({
      service: 'ai-capture',
      available: false,
      error: '后端服务不可用',
      timestamp: Date.now(),
    });
  }
}
