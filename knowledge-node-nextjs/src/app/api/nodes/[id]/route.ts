import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { UpdateNodeRequest } from '@/types';

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

    const node = await prisma.node.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        children: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!node) {
      return NextResponse.json(
        { success: false, error: '节点不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: node.id,
        content: node.content,
        type: node.nodeType,
        parentId: node.parentId,
        childrenIds: node.children.map(c => c.id),
        isCollapsed: node.isCollapsed,
        tags: [],
        supertagId: node.supertagId,
        fields: node.fields,
        payload: node.payload,
        createdAt: node.createdAt.getTime(),
        updatedAt: node.updatedAt.getTime(),
      },
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

    // 验证节点所有权
    const existingNode = await prisma.node.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existingNode) {
      return NextResponse.json(
        { success: false, error: '节点不存在' },
        { status: 404 }
      );
    }

    const node = await prisma.node.update({
      where: { id },
      data: {
        ...(body.content !== undefined && { content: body.content }),
        ...(body.parentId !== undefined && { parentId: body.parentId }),
        ...(body.nodeType !== undefined && { nodeType: body.nodeType }),
        ...(body.supertagId !== undefined && { supertagId: body.supertagId }),
        ...(body.payload !== undefined && { payload: body.payload }),
        ...(body.fields !== undefined && { fields: body.fields }),
        ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
        ...(body.isCollapsed !== undefined && { isCollapsed: body.isCollapsed }),
      },
      include: {
        children: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: node.id,
        content: node.content,
        type: node.nodeType,
        parentId: node.parentId,
        childrenIds: node.children.map(c => c.id),
        isCollapsed: node.isCollapsed,
        tags: [],
        supertagId: node.supertagId,
        fields: node.fields,
        payload: node.payload,
        createdAt: node.createdAt.getTime(),
        updatedAt: node.updatedAt.getTime(),
      },
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

    // 验证节点所有权
    const existingNode = await prisma.node.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existingNode) {
      return NextResponse.json(
        { success: false, error: '节点不存在' },
        { status: 404 }
      );
    }

    // 删除节点（级联删除子节点由数据库处理）
    await prisma.node.delete({
      where: { id },
    });

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
