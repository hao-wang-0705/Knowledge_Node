import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma, ensurePrismaClient } from '@/lib/prisma';

// GET /api/settings - 获取用户所有设置
export async function GET() {
  try {
    // 确保 Prisma 客户端已初始化
    ensurePrismaClient();
    
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录，请先登录', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const settings = await prisma.userSetting.findMany({
      where: { userId: session.user.id },
    });

    // 转换为键值对格式
    const settingsMap: Record<string, unknown> = {};
    settings.forEach((s) => {
      settingsMap[s.key] = s.value;
    });

    return NextResponse.json({
      success: true,
      data: settingsMap,
    });
  } catch (error) {
    console.error('[API] Error fetching settings:', error);
    const errorMessage = error instanceof Error ? error.message : '获取设置失败';
    return NextResponse.json(
      { success: false, error: errorMessage, code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}

// POST /api/settings - 创建或更新设置
export async function POST(req: Request) {
  try {
    // 确保 Prisma 客户端已初始化
    ensurePrismaClient();
    
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录，请先登录', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { key, value } = body;

    if (!key) {
      return NextResponse.json(
        { success: false, error: '设置键不能为空', code: 'BAD_REQUEST' },
        { status: 400 }
      );
    }

    // upsert 设置
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
        value: value ?? {},
      },
      update: {
        value: value ?? {},
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        key: setting.key,
        value: setting.value,
      },
    });
  } catch (error) {
    console.error('[API] Error saving setting:', error);
    const errorMessage = error instanceof Error ? error.message : '保存设置失败';
    return NextResponse.json(
      { success: false, error: errorMessage, code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
