/**
 * 是否建议解构 API
 * POST /api/ai/should-suggest-deconstruct
 * 调用后端 Agent forceTool: should_suggest_deconstruct，返回 { suggest: boolean }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const BACKEND_URL = process.env.BACKEND_API_URL || process.env.BACKEND_URL || 'http://localhost:4000';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const content = typeof body.content === 'string' ? body.content : '';

    const backendResponse = await fetch(`${BACKEND_URL}/api/agent/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: session.user.id,
        prompt: content.slice(0, 100) || '判断是否适合解构',
        options: {
          stream: false,
          forceTool: 'should_suggest_deconstruct',
        },
        context: {
          metadata: { content },
        },
      }),
    });

    if (!backendResponse.ok) {
      const errText = await backendResponse.text();
      console.error('[should-suggest-deconstruct] Backend error:', errText);
      return NextResponse.json(
        { success: false, suggest: false, error: '后端服务错误' },
        { status: backendResponse.status }
      );
    }

    const result = (await backendResponse.json()) as { success?: boolean; content?: string; error?: string };
    let suggest = false;
    if (result.success && result.content) {
      try {
        const parsed = JSON.parse(result.content) as { suggest?: boolean };
        suggest = parsed.suggest === true;
      } catch {
        // ignore parse error, keep suggest false
      }
    }

    return NextResponse.json({ success: true, suggest });
  } catch (error) {
    console.error('[should-suggest-deconstruct]', error);
    return NextResponse.json(
      { success: false, suggest: false, error: error instanceof Error ? error.message : '请求失败' },
      { status: 500 }
    );
  }
}
