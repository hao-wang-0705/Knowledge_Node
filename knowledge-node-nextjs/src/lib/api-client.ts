import type {
  ApiResponse,
  Node,
  Supertag,
  CreateNodeRequest,
  UpdateNodeRequest,
  CreateSupertagRequest,
  UpdateSupertagRequest,
} from '@/types';

const API_BASE = '/api';

/**
 * API 请求封装
 */
async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || '请求失败');
  }

  return data;
}

// =============================================================================
// 节点 API
// =============================================================================

export const nodesApi = {
  /**
   * 获取所有节点
   */
  getAll: async (): Promise<Node[]> => {
    const res = await fetchApi<Node[]>('/nodes');
    return res.data || [];
  },

  /**
   * 获取单个节点
   */
  getById: async (id: string): Promise<Node> => {
    const res = await fetchApi<Node>(`/nodes/${id}`);
    if (!res.data) throw new Error('节点不存在');
    return res.data;
  },

  /**
   * 创建节点
   */
  create: async (data: CreateNodeRequest): Promise<Node> => {
    const res = await fetchApi<Node>('/nodes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.data) throw new Error('创建失败');
    return res.data;
  },

  /**
   * 更新节点
   */
  update: async (id: string, data: UpdateNodeRequest): Promise<Node> => {
    const res = await fetchApi<Node>(`/nodes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    if (!res.data) throw new Error('更新失败');
    return res.data;
  },

  /**
   * 删除节点
   */
  delete: async (id: string): Promise<void> => {
    await fetchApi(`/nodes/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * 初始化每日笔记
   */
  initDaily: async () => {
    const res = await fetchApi<{ initialized: boolean }>('/nodes/init-daily', {
      method: 'POST',
    });
    return res;
  },
};

// =============================================================================
// Supertag API
// =============================================================================

export const supertagsApi = {
  /**
   * 获取所有 Supertags
   */
  getAll: async (): Promise<Supertag[]> => {
    const res = await fetchApi<Supertag[]>('/supertags');
    return res.data || [];
  },

  /**
   * 获取单个 Supertag
   */
  getById: async (id: string): Promise<Supertag> => {
    const res = await fetchApi<Supertag>(`/supertags/${id}`);
    if (!res.data) throw new Error('标签不存在');
    return res.data;
  },

  /**
   * 创建 Supertag
   */
  create: async (data: CreateSupertagRequest): Promise<Supertag> => {
    const res = await fetchApi<Supertag>('/supertags', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.data) throw new Error('创建失败');
    return res.data;
  },

  /**
   * 更新 Supertag
   */
  update: async (id: string, data: UpdateSupertagRequest): Promise<Supertag> => {
    const res = await fetchApi<Supertag>(`/supertags/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    if (!res.data) throw new Error('更新失败');
    return res.data;
  },

  /**
   * 删除 Supertag
   */
  delete: async (id: string): Promise<void> => {
    await fetchApi(`/supertags/${id}`, {
      method: 'DELETE',
    });
  },
};

export default {
  nodes: nodesApi,
  supertags: supertagsApi,
};
