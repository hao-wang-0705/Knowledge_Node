import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { proxyToBackend, toProxyResponse } from '@/lib/backend-proxy';

// GET /api/nodes/[id]/tree - 获取节点子树（转发 backend）
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const { id } = await params;
    const result = await proxyToBackend(
      session.user.id,
      `/api/nodes/${id}/tree`,
      { method: 'GET' }
    );
    return toProxyResponse(result);
  } catch (error) {
    console.error('Error fetching node tree:', error);
    return NextResponse.json({ success: false, error: '获取节点树失败' }, { status: 500 });
  }
}
