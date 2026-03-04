/**
 * 日历节点诊断 API
 * 扫描所有日历节点（年/周/日），检测 parentId 异常
 * - 年节点的 parentId 应指向 daily_root
 * - 周节点的 parentId 应指向对应的年节点
 * - 日节点的 parentId 应指向对应的周节点
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { proxyToBackend, toProxyResponse } from '@/lib/backend-proxy';

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
    console.error('[calendar-diagnostic] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
