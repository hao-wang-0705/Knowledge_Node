import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma, ensurePrismaClient } from '@/lib/prisma';

// GET /api/settings/[key] - 获取特定设置
export async function GET(
  req: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    // 确保 Prisma 客户端已初始化
    ensurePrismaClient();
    
    const session = await getServerSession(authOptions);
    const { key } = await params;
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录，请先登录', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const setting = await prisma.userSetting.findUnique({
      where: {
        userId_key: {
          userId: session.user.id,
          key,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: setting ? setting.value : null,
    });
  } catch (error) {
    console.error('[API] Error fetching setting:', error);
    const errorMessage = error instanceof Error ? error.message : '获取设置失败';
    return NextResponse.json(
      { success: false, error: errorMessage, code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}

// PUT /api/settings/[key] - 更新特定设置
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    // 确保 Prisma 客户端已初始化
    ensurePrismaClient();
    
    const session = await getServerSession(authOptions);
    const { key } = await params;
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录，请先登录', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const body = await req.json();
    
    console.log(`[API] PUT /api/settings/${key}`, {
      userId: session.user.id,
      valueType: typeof body.value,
    });

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

    const setting = await prisma.userSetting.upsert({
      where: {
        userId_key: {
          userId: session.user.id,
          key,
        },
      },
      create: {
        userId: session.user.id,
        key,
        value: body.value ?? body,
      },
      update: {
        value: body.value ?? body,
      },
    });

    return NextResponse.json({
      success: true,
      data: setting.value,
    });
  } catch (error) {
    console.error('[API] Error updating setting:', error);
    const errorMessage = error instanceof Error ? error.message : '更新设置失败';
    return NextResponse.json(
      { success: false, error: errorMessage, code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}

// DELETE /api/settings/[key] - 删除特定设置
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    // 确保 Prisma 客户端已初始化
    ensurePrismaClient();
    
    const session = await getServerSession(authOptions);
    const { key } = await params;
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录，请先登录', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // 尝试删除，如果不存在则忽略
    try {
      await prisma.userSetting.delete({
        where: {
          userId_key: {
            userId: session.user.id,
            key,
          },
        },
      });
    } catch (deleteError) {
      // 如果记录不存在，忽略错误
      console.log(`[API] Setting ${key} not found for deletion, ignoring`);
    }

    return NextResponse.json({
      success: true,
      message: '设置删除成功',
    });
  } catch (error) {
    console.error('[API] Error deleting setting:', error);
    const errorMessage = error instanceof Error ? error.message : '删除设置失败';
    return NextResponse.json(
      { success: false, error: errorMessage, code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
