/**
 * AI 图像识别 API 端点
 * POST /api/ai/image-recognize
 *
 * 透传到后端 Agent API（当前为占位实现）
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

interface ImageRecognizeRequest {
  images: Array<{
    base64: string;
    mimeType: string;
  }>;
  extractionHint?: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录，请先登录后再使用 AI 功能' },
        { status: 401 },
      );
    }

    const body: ImageRecognizeRequest = await request.json();

    if (!body.images || body.images.length === 0) {
      return NextResponse.json(
        { success: false, error: '请提供至少一张图片' },
        { status: 400 },
      );
    }

    const backendUrl =
      process.env.BACKEND_API_URL ||
      process.env.BACKEND_URL ||
      'http://localhost:4000';

    const response = await fetch(`${backendUrl}/api/agent/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: session.user.id,
        prompt: body.extractionHint || '识别图片内容',
        options: {
          stream: false,
          forceTool: 'image_recognize',
        },
        context: {
          metadata: {
            images: body.images,
            extractionHint: body.extractionHint,
          },
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ message: '后端请求失败' }));
      return NextResponse.json(
        { success: false, error: errorData.message || 'AI 服务请求失败' },
        { status: response.status },
      );
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      data: result.content ? JSON.parse(result.content) : result,
    });
  } catch (error) {
    console.error('[AI Image Recognize API Error]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '图像识别处理失败',
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    service: 'ai-image-recognize',
    available: false,
    note: '图像识别功能开发中',
    timestamp: Date.now(),
  });
}
