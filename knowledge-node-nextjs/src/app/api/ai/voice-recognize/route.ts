/**
 * AI 语音识别 API 端点
 * POST /api/ai/voice-recognize
 *
 * 透传到后端 Agent API（当前为占位实现）
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

interface VoiceRecognizeRequest {
  audioBase64: string;
  format?: string;
  language?: string;
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

    const body: VoiceRecognizeRequest = await request.json();

    if (!body.audioBase64) {
      return NextResponse.json(
        { success: false, error: '请提供音频数据' },
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
        prompt: '语音转写',
        options: {
          stream: false,
          forceTool: 'voice_recognize',
        },
        context: {
          metadata: {
            audioBase64: body.audioBase64,
            format: body.format || 'webm',
            language: body.language || 'zh',
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

    let data = result;
    if (result.content) {
      try {
        data = JSON.parse(result.content);
      } catch {
        data = { text: result.content };
      }
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('[AI Voice Recognize API Error]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '语音识别处理失败',
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    service: 'ai-voice-recognize',
    available: false,
    note: '语音识别功能开发中',
    timestamp: Date.now(),
  });
}
