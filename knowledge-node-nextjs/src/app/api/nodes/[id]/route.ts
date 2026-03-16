import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import type { UpdateNodeRequest } from '@/types';
import { proxyToBackend, toProxyResponse } from '@/lib/backend-proxy';

// GET /api/nodes/[id] - 获取单个节点
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const result = await proxyToBackend(
      session.user.id,
      `/api/nodes/${id}`,
      { method: 'GET' }
    );
    return toProxyResponse(result);
  } catch (error) {
    console.error('Error fetching node:', error);
    return NextResponse.json(
      { success: false, error: '获取节点失败' },
      { status: 500 }
    );
  }
}

// PUT /api/nodes/[id] - 更新节点
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body: UpdateNodeRequest = await req.json();
    
    const result = await proxyToBackend(
      session.user.id,
      `/api/nodes/${id}`,
      { method: 'PATCH', body: JSON.stringify(body) }
    );
    return toProxyResponse(result);
  } catch (error) {
    console.error('Error updating node:', error);
    return NextResponse.json(
      { success: false, error: '更新节点失败' },
      { status: 500 }
    );
  }
}

// PATCH /api/nodes/[id] - 部分更新节点（与 PUT 相同逻辑）
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // 复用 PUT 逻辑
  return PUT(req, { params });
}

// DELETE /api/nodes/[id] - 删除节点
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const result = await proxyToBackend(
      session.user.id,
      `/api/nodes/${id}`,
      { method: 'DELETE' }
    );
    if (!result.ok && result.status === 409) {
      const text = JSON.stringify(result.body || '');
      if (text.includes('不能直接删除笔记本根节点')) {
        return NextResponse.json(
          {
            success: false,
            error: '不能直接删除笔记本根节点，请通过删除笔记本操作',
            code: 'NOTEBOOK_ROOT',
          },
          { status: 409 }
        );
      }
    }
    return toProxyResponse(result);
  } catch (error) {
    console.error('Error deleting node:', error);
    return NextResponse.json(
      { success: false, error: '删除节点失败' },
      { status: 500 }
    );
  }
}
