import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import type { UpdateNodeRequest } from '@/types';
import { deleteNode, getNodeById, updateNode } from '@/services/server/nodesService';

// GET /api/nodes/[id] - 获取单个节点
export async function GET(
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

    const node = await getNodeById(session.user.id, id);

    if (!node) {
      return NextResponse.json(
        { success: false, error: '节点不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: node,
    });
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

    const node = await updateNode(session.user.id, id, body);
    if (!node) {
      return NextResponse.json(
        { success: false, error: '节点不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: node,
    });
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

    const result = await deleteNode(session.user.id, id);
    if (!result.ok) {
      if (result.conflict === 'notebook_root') {
        return NextResponse.json(
          { success: false, error: '不能直接删除笔记本根节点，请通过删除笔记本操作', code: 'NOTEBOOK_ROOT' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { success: false, error: '节点不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '节点已删除',
    });
  } catch (error) {
    console.error('Error deleting node:', error);
    return NextResponse.json(
      { success: false, error: '删除节点失败' },
      { status: 500 }
    );
  }
}
