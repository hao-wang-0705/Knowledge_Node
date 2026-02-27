/**
 * 用户设置 API
 * 注意：settings API 在 Next.js App Router 中，使用相对路径直接访问
 * 
 * 安全说明：
 * - 所有 API 请求都会经过中间件认证检查
 * - 未登录用户的请求会被中间件拦截并返回 401
 * - API 不提供本地存储回退，必须登录才能使用
 */

// 设置键名常量
export const SETTING_KEYS = {
  PINNED_TAGS: 'pinned_tags',
  RECENT_TAGS: 'recent_tags',
} as const;

// 认证错误类
export class AuthenticationError extends Error {
  constructor(message: string = '未登录，请先登录') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

// API 响应类型
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

// 直接访问 Next.js API 路由（相对路径）
async function fetchSettings<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  
  let data: ApiResponse<T>;
  
  try {
    data = await response.json();
  } catch {
    // JSON 解析失败
    throw new Error(`服务器返回无效响应: ${response.status}`);
  }
  
  if (!response.ok) {
    // 检查是否为认证错误（包括会话过期）
    if (response.status === 401 || data?.code === 'UNAUTHORIZED' || data?.code === 'SESSION_EXPIRED') {
      throw new AuthenticationError(data?.error || '未登录，请先登录');
    }
    throw new Error(data?.error || `请求失败，状态码: ${response.status}`);
  }
  
  // 确保响应格式正确
  if (!data.success) {
    throw new Error(data?.error || '请求失败');
  }
  
  return data.data as T;
}

export const settingsApi = {
  // 获取所有设置
  async getAll(): Promise<Record<string, unknown>> {
    return fetchSettings<Record<string, unknown>>('/api/settings');
  },

  // 获取特定设置
  async get<T = unknown>(key: string): Promise<T | null> {
    try {
      return await fetchSettings<T | null>(`/api/settings/${key}`);
    } catch (error) {
      // 认证错误需要重新抛出，让上层处理
      if (error instanceof AuthenticationError) {
        throw error;
      }
      // 其他错误（如设置不存在）返回 null
      console.error(`[settingsApi] 获取设置 ${key} 失败:`, error);
      return null;
    }
  },

  // 保存设置
  async set<T = unknown>(key: string, value: T): Promise<T> {
    return fetchSettings<T>(`/api/settings/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    });
  },

  // 删除设置
  async delete(key: string): Promise<void> {
    await fetchSettings<void>(`/api/settings/${key}`, {
      method: 'DELETE',
    });
  },
};

export default settingsApi;
