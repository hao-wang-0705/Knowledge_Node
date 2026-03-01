import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import type { CreateNodeRequest } from '@/types';
import { prisma } from '@/lib/prisma';
import { createOrUpsertNode, listNodes } from '@/services/server/nodesService';

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

    const { searchParams } = new URL(req.url);
    const scope = searchParams.get('scope') as 'general' | 'daily' | 'notebook' | null;
    const notebookId = searchParams.get('notebookId') ?? undefined;

    const options =
      scope === 'notebook' && notebookId
        ? { scope: 'notebook' as const, notebookId }
        : undefined;

    const formattedNodes = await listNodes(session.user.id, options);

    return NextResponse.json({
      success: true,
      data: formattedNodes,
    });
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

    // 验证用户是否存在于数据库中（防止 session 与数据库不同步）
    const userExists = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true },
    });

    if (!userExists) {
      console.error(`[API] User ${session.user.id} not found in database - session may be stale`);
      return NextResponse.json(
        { success: false, error: '用户会话已过期，请重新登录', code: 'SESSION_EXPIRED' },
        { status: 401 }
      );
    }

    const body: CreateNodeRequest = await req.json();
    const node = await createOrUpsertNode(session.user.id, body);

    return NextResponse.json({
      success: true,
      data: node,
    });
  } catch (error) {
    console.error('Error creating node:', error);
    return NextResponse.json(
      { success: false, error: '创建节点失败' },
      { status: 500 }
    );
  }
}
