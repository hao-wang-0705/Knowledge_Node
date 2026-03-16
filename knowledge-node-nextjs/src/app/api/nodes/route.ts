import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import type { CreateNodeRequest } from '@/types';
import { proxyToBackend, toProxyResponse } from '@/lib/backend-proxy';

// GET /api/nodes - 获取用户节点（ADR-005：支持 scope 树隔离）
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const { search } = new URL(req.url);
    const result = await proxyToBackend(
      session.user.id,
      `/api/nodes${search}`,
      { method: 'GET' }
    );
    return toProxyResponse(result);
  } catch (error) {
    console.error('Error fetching nodes:', error);
    return NextResponse.json(
      { success: false, error: '获取节点失败' },
      { status: 500 }
    );
  }
}

// POST /api/nodes - 创建新节点
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const body: CreateNodeRequest = await req.json();
    
    const result = await proxyToBackend(
      session.user.id,
      '/api/nodes',
      { method: 'POST', body: JSON.stringify(body) }
    );
    return toProxyResponse(result);
  } catch (error) {
    console.error('Error creating node:', error);
    return NextResponse.json(
      { success: false, error: '创建节点失败' },
      { status: 500 }
    );
  }
}
