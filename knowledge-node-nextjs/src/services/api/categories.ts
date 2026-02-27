/**
 * 分类 API
 * 注意：categories API 在 Next.js App Router 中，使用相对路径直接访问
 * 
 * 安全说明：
 * - 所有 API 请求都会经过中间件认证检查
 * - 未登录用户的请求会被中间件拦截并返回 401
 * - API 不提供本地存储回退，必须登录才能使用
 */
import type { TagCategoryGroup } from '@/types';
import { AuthenticationError } from './settings';

// API 响应类型
export interface CategoryResponse {
  id: string;
  name: string;
  icon: string;
  color: string;
  description?: string;
  isSystem: boolean;
  order: number;
  createdAt: number;
  updatedAt: number;
}

// 创建分类参数
export interface CreateCategoryParams {
  id?: string;
  name: string;
  icon?: string;
  color?: string;
  description?: string;
  order?: number;
}

// 更新分类参数
export interface UpdateCategoryParams {
  name?: string;
  icon?: string;
  color?: string;
  description?: string;
  order?: number;
}

// API 响应结构
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

// 直接访问 Next.js API 路由（相对路径）
async function fetchCategories<T>(
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
    throw new Error(`服务器返回无效响应: ${response.status}`);
  }
  
  if (!response.ok) {
    // 检查是否为认证错误
    if (response.status === 401 || data?.code === 'UNAUTHORIZED') {
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

// 将 API 响应转换为前端类型
function toCategory(response: CategoryResponse): TagCategoryGroup {
  return {
    id: response.id,
    name: response.name,
    icon: response.icon,
    color: response.color,
    description: response.description,
    isSystem: response.isSystem,
    order: response.order,
    createdAt: response.createdAt,
    updatedAt: response.updatedAt,
  };
}

export const categoriesApi = {
  // 获取所有分类
  async getAll(): Promise<TagCategoryGroup[]> {
    const response = await fetchCategories<CategoryResponse[]>('/api/categories');
    return (response || []).map(toCategory);
  },

  // 获取单个分类
  async getOne(id: string): Promise<TagCategoryGroup> {
    const response = await fetchCategories<CategoryResponse>(`/api/categories/${id}`);
    return toCategory(response);
  },

  // 创建分类
  async create(params: CreateCategoryParams): Promise<TagCategoryGroup> {
    const response = await fetchCategories<CategoryResponse>('/api/categories', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return toCategory(response);
  },

  // 更新分类
  async update(id: string, params: UpdateCategoryParams): Promise<TagCategoryGroup> {
    const response = await fetchCategories<CategoryResponse>(`/api/categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(params),
    });
    return toCategory(response);
  },

  // 删除分类
  async delete(id: string): Promise<void> {
    await fetchCategories<void>(`/api/categories/${id}`, {
      method: 'DELETE',
    });
  },

  // 批量更新分类（用于排序）
  async batchUpdate(categories: Array<{ id: string } & UpdateCategoryParams>): Promise<void> {
    await fetchCategories<void>('/api/categories', {
      method: 'PUT',
      body: JSON.stringify({ categories }),
    });
  },
};

export default categoriesApi;
