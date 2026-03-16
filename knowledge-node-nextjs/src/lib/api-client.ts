import type {
  ApiResponse,
  Node,
  Supertag,
  CreateNodeRequest,
  UpdateNodeRequest,
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
   * 更新节点；返回 node 与级联解锁的节点 id 列表（卡点 Resolved 时）
   */
  update: async (
    id: string,
    data: UpdateNodeRequest
  ): Promise<{ node: Node; unlockedNodeIds: string[] }> => {
    const res = await fetch(`${API_BASE}/nodes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error ?? json?.message ?? '更新失败');
    const node = json?.data ?? json;
    const unlockedHeader = res.headers.get('X-Unlocked-Node-Ids');
    const unlockedNodeIds = unlockedHeader
      ? unlockedHeader
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    return { node, unlockedNodeIds };
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
// Supertag API（只读）
// v3.3: 重构为只读模式，移除所有用户写操作
// =============================================================================

export const supertagsApi = {
  /**
   * 获取所有 Supertags（系统预置标签）
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

  // =============================================================================
  // v3.3: 以下写操作已移除
  // =============================================================================

  /**
   * @deprecated v3.3: 用户写操作已移除
   */
  create: async (): Promise<never> => {
    throw new Error('[v3.3] 用户写操作已移除：supertagsApi.create 不再可用');
  },

  /**
   * @deprecated v3.3: 用户写操作已移除
   */
  update: async (): Promise<never> => {
    throw new Error('[v3.3] 用户写操作已移除：supertagsApi.update 不再可用');
  },

  /**
   * @deprecated v3.3: 用户写操作已移除
   */
  delete: async (): Promise<never> => {
    throw new Error('[v3.3] 用户写操作已移除：supertagsApi.delete 不再可用');
  },
};

export default {
  nodes: nodesApi,
  supertags: supertagsApi,
};
