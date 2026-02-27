import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { initializeDailyNotes, checkNeedsInitialization } from '@/utils/daily-notes-init';

/**
 * POST /api/nodes/init-daily
 * 首次登录时初始化每日笔记系统
 * 
 * 触发条件：用户首次登录（数据库中无该用户的任何节点）
 * 行为：
 * 1. 创建年/月/周层级结构
 * 2. 生成当前周内已过去日期的日笔记（包括今天）
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // 检查是否需要初始化
    const needsInit = await checkNeedsInitialization(userId);
    
    if (!needsInit) {
      return NextResponse.json({
        success: true,
        initialized: false,
        message: '用户已有数据，无需初始化',
      });
    }

    // 执行初始化
    const result = await initializeDailyNotes(userId);

    return NextResponse.json({
      initialized: true,
      ...result,
    });
  } catch (error) {
    console.error('Error initializing daily notes:', error);
    return NextResponse.json(
      { success: false, error: '初始化失败，请稍后重试' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/nodes/init-daily
 * 检查用户是否需要初始化
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const needsInit = await checkNeedsInitialization(session.user.id);

    return NextResponse.json({
      success: true,
      needsInitialization: needsInit,
    });
  } catch (error) {
    console.error('Error checking initialization status:', error);
    return NextResponse.json(
      { success: false, error: '检查状态失败' },
      { status: 500 }
    );
  }
}
