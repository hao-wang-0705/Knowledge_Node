import { NextResponse } from 'next/server';
import { getServerSession, Session } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * 验证会话并确保用户存在于数据库中
 * 
 * 解决问题：当数据库被重置但浏览器仍保留旧的 JWT token 时，
 * session.user.id 在 users 表中不存在，导致外键约束错误
 * 
 * @returns 验证结果对象，包含 session 或 error response
 */
export async function validateUserSession(): Promise<
  | { success: true; session: Session; userId: string }
  | { success: false; response: NextResponse }
> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return {
      success: false,
      response: NextResponse.json(
        { success: false, error: '未登录', code: 'UNAUTHORIZED' },
        { status: 401 }
      ),
    };
  }

  // 验证用户是否存在于数据库中
  const userExists = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true },
  });

  if (!userExists) {
    console.error(
      `[Auth] User ${session.user.id} not found in database - session may be stale`
    );
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          error: '用户会话已过期，请重新登录',
          code: 'SESSION_EXPIRED',
        },
        { status: 401 }
      ),
    };
  }

  return {
    success: true,
    session,
    userId: session.user.id,
  };
}

/**
 * 简化版：仅检查 session 是否存在（用于只读操作）
 * 注意：此函数不验证用户是否在数据库中存在
 */
export async function getAuthenticatedSession(): Promise<
  | { success: true; session: Session; userId: string }
  | { success: false; response: NextResponse }
> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return {
      success: false,
      response: NextResponse.json(
        { success: false, error: '未登录', code: 'UNAUTHORIZED' },
        { status: 401 }
      ),
    };
  }

  return {
    success: true,
    session,
    userId: session.user.id,
  };
}
