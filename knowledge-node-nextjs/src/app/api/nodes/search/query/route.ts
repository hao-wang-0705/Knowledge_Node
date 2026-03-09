import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { proxyToBackend, toProxyResponse } from '@/lib/backend-proxy';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const result = await proxyToBackend(
      session.user.id,
      '/api/nodes/search/query',
      { method: 'POST', body: JSON.stringify(body) }
    );
    return toProxyResponse(result);
  } catch (error) {
    console.error('Error querying search nodes:', error);
    return NextResponse.json(
      { success: false, error: '搜索查询失败' },
      { status: 500 }
    );
  }
}
