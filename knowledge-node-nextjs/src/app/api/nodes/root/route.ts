import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { proxyToBackend, toProxyResponse } from '@/lib/backend-proxy';

// GET /api/nodes/root - 获取根级节点（转发 backend）
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const { search } = new URL(req.url);
    const result = await proxyToBackend(
      session.user.id,
      `/api/nodes/root${search}`,
      { method: 'GET' }
    );
    return toProxyResponse(result);
  } catch (error) {
    console.error('Error fetching root nodes:', error);
    return NextResponse.json({ success: false, error: '获取根节点失败' }, { status: 500 });
  }
}
