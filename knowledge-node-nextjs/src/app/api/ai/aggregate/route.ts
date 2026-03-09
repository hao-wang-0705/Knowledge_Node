import { NextRequest } from 'next/server';

/**
 * AI 聚合代理 API
 * POST /api/ai/aggregate
 *
 * 作用：
 * - 将前端请求透传到后端 Nest /api/ai/aggregate
 * - 保留 text/event-stream SSE 流式响应
 */

const DEFAULT_BACKEND_BASE = 'http://localhost:4000';

function getBackendBaseUrl(): string {
  const base =
    process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    DEFAULT_BACKEND_BASE;

  return base.replace(/\/+$/, '');
}

export async function POST(request: NextRequest) {
  const backendBase = getBackendBaseUrl();

  // 直接读取原始 body 文本，保持与前端 fetch(JSON.stringify(...)) 一致
  const bodyText = await request.text();

  let backendResponse: Response;
  try {
    backendResponse = await fetch(`${backendBase}/api/ai/aggregate`, {
      method: 'POST',
      headers: {
        'Content-Type':
          request.headers.get('content-type') || 'application/json',
      },
      body: bodyText,
      // 禁用缓存，确保每次都是实时请求
      cache: 'no-store',
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Upstream request failed';
    return new Response(
      JSON.stringify({
        event: 'error',
        data: { code: 'UPSTREAM_FETCH_ERROR', message },
      }),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
      },
    );
  }

  // 如果后端返回非 2xx，直接透传状态码和文本内容，方便前端错误提示
  if (!backendResponse.ok || !backendResponse.body) {
    const text = await backendResponse.text().catch(() => '');
    return new Response(
      text ||
        JSON.stringify({
          event: 'error',
          data: {
            code: 'UPSTREAM_ERROR',
            message: `Upstream responded with status ${backendResponse.status}`,
          },
        }),
      {
        status: backendResponse.status,
        headers: {
          'Content-Type':
            backendResponse.headers.get('content-type') ||
            'application/json; charset=utf-8',
        },
      },
    );
  }

  // 成功场景：将后端的 SSE 流 body 直接透传给前端
  const headers = new Headers();
  headers.set(
    'Content-Type',
    backendResponse.headers.get('content-type') || 'text/event-stream',
  );
  headers.set('Cache-Control', 'no-cache');
  headers.set('Connection', 'keep-alive');
  headers.set('X-Accel-Buffering', 'no');

  return new Response(backendResponse.body, {
    status: backendResponse.status,
    headers,
  });
}

