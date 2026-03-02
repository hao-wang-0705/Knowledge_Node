import { NextResponse } from 'next/server';

type BackendErrorShape = {
  error?: string;
  message?: string | string[];
  code?: string;
};

const DEFAULT_BACKEND_BASE = 'http://localhost:4000';

function getBackendBaseUrl(): string {
  return (
    process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    DEFAULT_BACKEND_BASE
  ).replace(/\/+$/, '');
}

function resolveErrorMessage(body: unknown): string {
  const err = (body ?? {}) as BackendErrorShape;
  if (typeof err.error === 'string' && err.error.trim()) return err.error;
  if (typeof err.message === 'string' && err.message.trim()) return err.message;
  if (Array.isArray(err.message) && err.message.length > 0) return err.message.join('; ');
  return '请求后端服务失败';
}

export async function proxyToBackend(
  userId: string,
  path: string,
  init: RequestInit = {}
): Promise<{
  ok: boolean;
  status: number;
  body: unknown;
}> {
  const baseUrl = getBackendBaseUrl();
  const headers = new Headers(init.headers || undefined);
  headers.set('x-user-id', userId);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  return {
    ok: response.ok,
    status: response.status,
    body,
  };
}

export function toProxyResponse(result: {
  ok: boolean;
  status: number;
  body: unknown;
}): NextResponse {
  if (result.ok) {
    return NextResponse.json(
      {
        success: true,
        data: result.body,
      },
      { status: result.status || 200 }
    );
  }

  const message = resolveErrorMessage(result.body);
  const payload: { success: false; error: string; code?: string } = {
    success: false,
    error: message,
  };

  const code = (result.body as BackendErrorShape | null)?.code;
  if (code) payload.code = code;

  return NextResponse.json(payload, { status: result.status || 500 });
}
