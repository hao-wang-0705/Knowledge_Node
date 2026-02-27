import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/notebooks/[id] - 获取单个笔记本
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const notebook = await prisma.notebook.findUnique({
      where: { id },
    });

    if (!notebook || notebook.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: '笔记本不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: notebook.id,
        name: notebook.name,
        icon: notebook.icon,
        rootNodeId: notebook.rootNodeId,
        createdAt: notebook.createdAt.toISOString(),
        updatedAt: notebook.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching notebook:', error);
    return NextResponse.json(
      { success: false, error: '获取笔记本失败' },
      { status: 500 }
    );
  }
}

// PATCH /api/notebooks/[id] - 更新笔记本
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const body = await req.json();

    // 检查笔记本是否存在且属于当前用户
    const existing = await prisma.notebook.findUnique({
      where: { id },
    });

    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: '笔记本不存在' },
        { status: 404 }
      );
    }

    const notebook = await prisma.notebook.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.icon !== undefined && { icon: body.icon }),
      },
    });

    // 如果更新了名称，同步更新根节点内容
    if (body.name !== undefined && notebook.rootNodeId) {
      await prisma.node.update({
        where: { id: notebook.rootNodeId },
        data: { content: body.name },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: notebook.id,
        name: notebook.name,
        icon: notebook.icon,
        rootNodeId: notebook.rootNodeId,
        createdAt: notebook.createdAt.toISOString(),
        updatedAt: notebook.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error updating notebook:', error);
    return NextResponse.json(
      { success: false, error: '更新笔记本失败' },
      { status: 500 }
    );
  }
}

// DELETE /api/notebooks/[id] - 删除笔记本
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    // 检查笔记本是否存在且属于当前用户
    const existing = await prisma.notebook.findUnique({
      where: { id },
    });

    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: '笔记本不存在' },
        { status: 404 }
      );
    }

    // 删除笔记本（根节点及其子节点会通过级联删除自动删除）
    // 但由于 Node 没有直接关联 Notebook，需要手动删除
    if (existing.rootNodeId) {
      // 递归删除所有子节点（添加 userId 条件确保数据隔离）
      const deleteNodeRecursively = async (nodeId: string, userId: string) => {
        const children = await prisma.node.findMany({
          where: { parentId: nodeId, userId },  // 添加 userId 条件
          select: { id: true },
        });
        
        for (const child of children) {
          await deleteNodeRecursively(child.id, userId);
        }
        
        // 使用 deleteMany 添加 userId 条件确保只删除当前用户的节点
        await prisma.node.deleteMany({
          where: { id: nodeId, userId },
        });
      };

      await deleteNodeRecursively(existing.rootNodeId, session.user.id);
    }

    await prisma.notebook.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: '笔记本删除成功',
    });
  } catch (error) {
    console.error('Error deleting notebook:', error);
    return NextResponse.json(
      { success: false, error: '删除笔记本失败' },
      { status: 500 }
    );
  }
}
