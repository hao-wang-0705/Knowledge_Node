import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/notebooks - 获取用户所有笔记本
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const notebooks = await prisma.notebook.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    });

    // 获取每个笔记本的节点数量
    const notebooksWithCount = await Promise.all(
      notebooks.map(async (nb) => {
        let nodeCount = 0;
        if (nb.rootNodeId) {
          // 递归计算节点数量
          const countNodes = async (parentId: string): Promise<number> => {
            const children = await prisma.node.findMany({
              where: { parentId, userId: session.user.id },
              select: { id: true },
            });
            let count = children.length;
            for (const child of children) {
              count += await countNodes(child.id);
            }
            return count;
          };
          nodeCount = await countNodes(nb.rootNodeId) + 1; // +1 for root node
        }

        return {
          id: nb.id,
          name: nb.name,
          icon: nb.icon,
          rootNodeId: nb.rootNodeId,
          nodeCount,
          createdAt: nb.createdAt.toISOString(),
          updatedAt: nb.updatedAt.toISOString(),
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: notebooksWithCount,
    });
  } catch (error) {
    console.error('Error fetching notebooks:', error);
    return NextResponse.json(
      { success: false, error: '获取笔记本失败' },
      { status: 500 }
    );
  }
}

// POST /api/notebooks - 创建新笔记本
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
    const name = body.name?.trim() || '无标题笔记本';

    // 创建笔记本和根节点在同一个事务中
    const result = await prisma.$transaction(async (tx) => {
      // 先创建笔记本
      const notebook = await tx.notebook.create({
        data: {
          userId: session.user.id,
          name,
          icon: body.icon ?? null,
        },
      });

      // 创建根节点
      const rootNode = await tx.node.create({
        data: {
          userId: session.user.id,
          content: name,
          nodeType: 'text',
        },
      });

      // 更新笔记本的根节点 ID
      const updatedNotebook = await tx.notebook.update({
        where: { id: notebook.id },
        data: { rootNodeId: rootNode.id },
      });

      return { notebook: updatedNotebook, rootNode };
    });

    return NextResponse.json({
      success: true,
      data: {
        id: result.notebook.id,
        name: result.notebook.name,
        icon: result.notebook.icon,
        rootNodeId: result.notebook.rootNodeId,
        nodeCount: 1,
        createdAt: result.notebook.createdAt.toISOString(),
        updatedAt: result.notebook.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error creating notebook:', error);
    return NextResponse.json(
      { success: false, error: '创建笔记本失败' },
      { status: 500 }
    );
  }
}
