import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { proxyToBackend, toProxyResponse } from '@/lib/backend-proxy';

/**
 * GET /api/supertags - 获取用户可用的所有标签
 * 统一收口到 backend tags service，Next 仅做鉴权与代理。
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: '未登录' },
      { status: 401 }
    );
  }

  const result = await proxyToBackend(
    session.user.id,
    '/api/supertags',
    { method: 'GET' }
  );
  return toProxyResponse(result);
}

// 注意：POST 方法已被彻底删除
// 用户无法通过此接口创建标签
// 管理员创建标签请使用 /api/internal/tags
