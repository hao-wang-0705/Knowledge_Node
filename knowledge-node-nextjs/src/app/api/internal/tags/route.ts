import { NextResponse } from 'next/server';
import { proxyToBackend, toProxyResponse } from '@/lib/backend-proxy';

/**
 * POST /api/internal/tags - 创建系统预置标签（管理员专用）
 * 统一收口到 backend internal tags API，Next 仅做代理转发。
 */
export async function POST(request: Request) {
  const adminKey = request.headers.get('x-admin-key');
  if (!adminKey) {
    return NextResponse.json({ success: false, error: '缺少 x-admin-key' }, { status: 401 });
  }

  const payload = await request.json();
  const result = await proxyToBackend('internal-admin', '/api/internal/tags', {
    method: 'POST',
    headers: { 'x-admin-key': adminKey },
    body: JSON.stringify(payload),
  });
  return toProxyResponse(result);
}

/**
 * GET /api/internal/tags - 获取所有标签模版（管理员专用）
 * 统一收口到 backend internal tags API，Next 仅做代理转发。
 */
export async function GET(request: Request) {
  const adminKey = request.headers.get('x-admin-key');
  if (!adminKey) {
    return NextResponse.json({ success: false, error: '缺少 x-admin-key' }, { status: 401 });
  }

  const result = await proxyToBackend('internal-admin', '/api/internal/tags', {
    method: 'GET',
    headers: { 'x-admin-key': adminKey },
  });
  return toProxyResponse(result);
}
