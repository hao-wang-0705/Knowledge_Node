/**
 * HTTP 客户端封装
 * 统一处理请求配置、错误处理和响应转换
 * 
 * 注意：现在使用相对路径调用 Next.js API Routes，
 * 这样可以利用 NextAuth 的 session 进行身份验证
 */

// 请求配置接口
interface RequestConfig extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

// API 错误类
export class ApiError extends Error {
  status: number;
  data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

// 构建 URL（包含查询参数）
function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
  // 使用相对路径，让请求发送到同源的 Next.js API Routes
  let url = path;
  
  if (params && Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }
  
  return url;
}

// 核心请求函数
async function request<T>(
  path: string,
  config: RequestConfig = {}
): Promise<T> {
  const { params, ...fetchConfig } = config;
  
  const url = buildUrl(path, params);
  
  // 不再发送自定义的 x-user-id header
  // Next.js API Routes 会使用 NextAuth session 获取用户身份
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchConfig.headers as Record<string, string>),
  };

  const response = await fetch(url, {
    ...fetchConfig,
    headers,
    // 确保发送 cookies 以便 NextAuth session 工作
    credentials: 'same-origin',
  });

  // 处理空响应
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new ApiError(
      data?.message || data?.error || `Request failed with status ${response.status}`,
      response.status,
      data
    );
  }

  // 如果响应包含 success 字段，返回 data 部分
  if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
    return data.data as T;
  }

  return data as T;
}

// HTTP 方法封装
export const apiClient = {
  get<T>(path: string, params?: Record<string, string | number | boolean | undefined>, config?: RequestConfig): Promise<T> {
    return request<T>(path, { method: 'GET', params, ...(config || {}) });
  },

  post<T>(path: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return request<T>(path, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      ...(config || {}),
    });
  },

  patch<T>(path: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return request<T>(path, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
      ...(config || {}),
    });
  },

  put<T>(path: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return request<T>(path, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      ...(config || {}),
    });
  },

  delete<T>(path: string, config?: RequestConfig): Promise<T> {
    return request<T>(path, { method: 'DELETE', ...(config || {}) });
  },
};

// 这些函数已废弃，保留以避免破坏性更改
// userId 现在由 NextAuth session 管理
export function setUserId(_userId: string): void {
  console.warn('[apiClient] setUserId 已废弃，userId 现在由 NextAuth session 管理');
}

export function getCurrentUserId(): string {
  console.warn('[apiClient] getCurrentUserId 已废弃，userId 现在由 NextAuth session 管理');
  return '';
}

export default apiClient;
