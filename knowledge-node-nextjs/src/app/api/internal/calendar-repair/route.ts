/**
 * 日历节点修复 API
 * 根据诊断结果批量修复损坏的日历节点 parentId，并校正 sortOrder
 * GET: dry-run，返回诊断报告 + 将执行的 repairItems
 * POST: 支持手动 items 或 auto=true（自动从诊断生成 items）；dryRun 仅返回计划不写入
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { proxyToBackend, toProxyResponse } from '@/lib/backend-proxy';

/** GET: dry-run，返回诊断报告 + repairItems（将执行的修复项） */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const result = await proxyToBackend(session.user.id, '/api/nodes/ops/calendar-diagnostic', {
      method: 'GET',
    });
    return toProxyResponse(result);
  } catch (error) {
    console.error('[calendar-repair] GET Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.text();
    const result = await proxyToBackend(session.user.id, '/api/nodes/ops/calendar-repair', {
      method: 'POST',
      body: body || '{}',
      headers: { 'Content-Type': 'application/json' },
    });
    return toProxyResponse(result);
  } catch (error) {
    console.error('[calendar-repair] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
