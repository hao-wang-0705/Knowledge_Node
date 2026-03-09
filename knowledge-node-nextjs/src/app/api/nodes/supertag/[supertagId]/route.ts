import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { proxyToBackend, toProxyResponse } from '@/lib/backend-proxy';

/**
 * GET /api/nodes/supertag/[supertagId] - 获取指定超级标签下的所有节点
 * 
 * 用于超级标签聚焦页面，返回所有带该标签的节点列表
 * 
 * @route GET /api/nodes/supertag/:supertagId
 * @param supertagId - 超级标签 ID
 * @returns { success: boolean, data: Node[] }
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ supertagId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const { supertagId } = await params;
    
    if (!supertagId) {
      return NextResponse.json(
        { success: false, error: '缺少 supertagId 参数' },
        { status: 400 }
      );
    }

    // 代理到后端 API
    const result = await proxyToBackend(
      session.user.id,
      `/api/nodes/supertag/${supertagId}`,
      { method: 'GET' }
    );
    
    return toProxyResponse(result);
  } catch (error) {
    console.error('[API] nodes/supertag 错误:', error);
    return NextResponse.json(
      { success: false, error: '获取节点失败' },
      { status: 500 }
    );
  }
}
