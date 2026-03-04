import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { proxyToBackend, toProxyResponse } from '@/lib/backend-proxy';

/**
 * POST /api/nodes/init-daily
 * 首次登录时初始化每日笔记系统
 *
 * 触发条件：checkNeedsInitialization 为 true（未初始化且 daily_root 或今日 day 节点不可达）
 * 行为：
 * 1. 确保 user_root、daily_root 存在
 * 2. 创建 daily_root -> year -> week -> day 层级（确定性 ID，无 month）
 * 3. 生成当前周内周一到今天的日笔记
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const result = await proxyToBackend(session.user.id, '/api/nodes/ops/init-daily', {
      method: 'POST',
    });
    return toProxyResponse(result);
  } catch (error) {
    console.error('Error initializing daily notes:', error);
    return NextResponse.json(
      { success: false, error: '初始化失败，请稍后重试' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/nodes/init-daily
 * 检查用户是否需要初始化
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const result = await proxyToBackend(session.user.id, '/api/nodes/ops/init-daily/status', {
      method: 'GET',
    });
    return toProxyResponse(result);
  } catch (error) {
    console.error('Error checking initialization status:', error);
    return NextResponse.json(
      { success: false, error: '检查状态失败' },
      { status: 500 }
    );
  }
}
