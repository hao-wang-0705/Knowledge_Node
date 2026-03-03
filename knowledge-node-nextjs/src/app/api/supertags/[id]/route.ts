import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { proxyToBackend, toProxyResponse } from '@/lib/backend-proxy';

/**
 * GET /api/supertags/[id] - 获取单个标签详情
 * 统一收口到 backend tags service，Next 仅做鉴权与代理。
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: '未登录' },
      { status: 401 }
    );
  }

  const { id } = await params;

  const result = await proxyToBackend(
    session.user.id,
    `/api/supertags/${id}`,
    { method: 'GET' }
  );
  return toProxyResponse(result);
}

// 注意：PUT 和 DELETE 方法已被彻底删除
// 用户无法通过此接口修改或删除标签
// 系统预置标签由管理员通过 /api/internal/tags 管理
