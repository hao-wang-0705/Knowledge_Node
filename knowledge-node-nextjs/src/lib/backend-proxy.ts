import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

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
  headers?: Record<string, string>;
}> {
  const baseUrl = getBackendBaseUrl();
  const headers = new Headers(init.headers || undefined);
  const internalApiKey = process.env.INTERNAL_API_KEY;
  if (!internalApiKey) {
    throw new Error('INTERNAL_API_KEY is required for backend proxy');
  }
  const opId = headers.get('x-op-id') || randomUUID();
  const requestId = headers.get('x-request-id') || randomUUID();
  headers.set('x-op-id', opId);
  headers.set('x-request-id', requestId);
  headers.set('x-trace-id', requestId);
  headers.set('x-user-id', userId);
  headers.set('x-internal-api-key', internalApiKey);
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

  const forwardedHeaders: Record<string, string> = {};
  const unlockedIds = response.headers.get('X-Unlocked-Node-Ids');
  if (unlockedIds) forwardedHeaders['X-Unlocked-Node-Ids'] = unlockedIds;

  return {
    ok: response.ok,
    status: response.status,
    body,
    headers: forwardedHeaders,
  };
}

export function toProxyResponse(
  result: {
    ok: boolean;
    status: number;
    body: unknown;
    headers?: Record<string, string>;
  },
  options?: { headers?: Record<string, string> }
): NextResponse {
  const headers = options?.headers ?? result.headers ?? undefined;
  if (result.ok) {
    return NextResponse.json(
      {
        success: true,
        data: result.body,
      },
      { status: result.status || 200, headers }
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
