/**
 * 节点 API
 */
import apiClient from './client';
import type { Node, NodeReference } from '@/types';
import type { SearchQuery } from '@/types/search';

// API 响应类型
export interface NodeResponse {
  id: string;
  serverId?: string;
  content: string;
  type: string;
  parentId?: string;
  appliedParentId?: string;
  appliedSortOrder?: number;
  sortOrder?: number;
  nodeRole?: string;
  childrenIds: string[];
  isCollapsed: boolean;
  fields: Record<string, any>;
  supertagId?: string;
  tags: string[];
  references?: Record<string, any>;
  blockedBy?: { id: string; content: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface MentionedByResponseItem {
  node: NodeResponse;
  breadcrumbs: Array<{ id: string; title: string }>;
  sourceType: 'reference' | 'field';
  fieldKey?: string;
}

export interface MentionedByItem {
  node: Node;
  breadcrumbs: Array<{ id: string; title: string }>;
  sourceType: 'reference' | 'field';
  fieldKey?: string;
}

// 创建节点参数
export interface CreateNodeParams {
  id?: string;
  content?: string;
  type?: string;
  parentId?: string;
  childrenIds?: string[];
  isCollapsed?: boolean;
  fields?: Record<string, any>;
  supertagId?: string;
  tags?: string[];
  references?: Record<string, any>;
}

// 更新节点参数
export interface UpdateNodeParams {
  content?: string;
  type?: string;
  parentId?: string;
  childrenIds?: string[];
  isCollapsed?: boolean;
  fields?: Record<string, any>;
  supertagId?: string;
  tags?: string[];
  references?: Record<string, any>;
  payload?: Record<string, any>;
  sortOrder?: number;
}

// 将 API 响应转换为前端 Node 类型
function toNode(response: NodeResponse): Node {
  return {
    id: response.id,
    content: response.content,
    type: response.type as Node['type'],
    parentId: response.parentId ?? null,
    nodeRole: response.nodeRole as Node['nodeRole'],
    childrenIds: response.childrenIds,
    isCollapsed: response.isCollapsed,
    fields: response.fields,
    supertagId: response.supertagId ?? null,
    tags: response.tags,
    references: response.references as NodeReference[] | undefined,
    blockedBy: response.blockedBy,
    createdAt: new Date(response.createdAt).getTime(),
  };
}

export const nodesApi = {
  // 获取所有节点（可选 rootNodeId 子树）
  async getAll(rootNodeId?: string): Promise<Node[]> {
    const params = rootNodeId ? { rootNodeId } : undefined;
    const response = await apiClient.get<NodeResponse[]>('/api/nodes', params);
    return response.map(toNode);
  },

  // 获取根级别节点
  async getRootNodes(): Promise<Node[]> {
    const response = await apiClient.get<NodeResponse[]>('/api/nodes/root');
    return response.map(toNode);
  },

  // 获取单个节点
  async getOne(id: string): Promise<Node> {
    const response = await apiClient.get<NodeResponse>(`/api/nodes/${id}`);
    return toNode(response);
  },

  // 获取节点及其子节点（树形结构）
  async getNodeWithChildren(id: string): Promise<any> {
    return apiClient.get(`/api/nodes/${id}/tree`);
  },

  // 获取提及该节点的反向链接节点列表
  async getMentionedBy(id: string): Promise<MentionedByItem[]> {
    const response = await apiClient.get<MentionedByResponseItem[]>(`/api/nodes/${id}/mentioned-by`);
    return response.map((item) => ({
      node: toNode(item.node),
      breadcrumbs: item.breadcrumbs ?? [],
      sourceType: item.sourceType,
      fieldKey: item.fieldKey,
    }));
  },

  // 创建节点
  async create(params: CreateNodeParams, options?: { opId?: string }): Promise<Node> {
    const response = await apiClient.post<NodeResponse>('/api/nodes', params, {
      headers: options?.opId ? { 'x-op-id': options.opId } : undefined,
    });
    return toNode(response);
  },

  // 批量创建节点
  async batchCreate(nodes: CreateNodeParams[]): Promise<{ count: number }> {
    return apiClient.post('/api/nodes/batch', { nodes });
  },

  // 更新节点（将 type 映射为 nodeType 以符合后端 DTO）；返回 node 与级联解锁的节点 id 列表（供 sync 合并）
  async update(
    id: string,
    params: UpdateNodeParams,
    options?: { opId?: string }
  ): Promise<{ node: Node; unlockedNodeIds: string[] }> {
    const body: Record<string, unknown> = { ...params };
    if (params.type !== undefined && body.nodeType === undefined) {
      body.nodeType = params.type;
      delete body.type;
    }
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (options?.opId) headers['x-op-id'] = options.opId;
    const res = await fetch(`/api/nodes/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
      credentials: 'same-origin',
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = data?.error ?? data?.message ?? `Request failed with status ${res.status}`;
      throw new (await import('./client')).ApiError(msg, res.status, data);
    }
    const raw = (data && typeof data === 'object' && 'data' in data ? data.data : data) as NodeResponse;
    const unlockedHeader = res.headers.get('X-Unlocked-Node-Ids');
    const unlockedNodeIds = unlockedHeader ? unlockedHeader.split(',').map((s) => s.trim()).filter(Boolean) : [];
    return { node: toNode(raw), unlockedNodeIds };
  },

  // 批量更新节点
  async batchUpdate(nodes: Array<{ id: string } & UpdateNodeParams>): Promise<Node[]> {
    const response = await apiClient.patch<NodeResponse[]>('/api/nodes/batch', { nodes });
    return response.map(toNode);
  },

  // 切换折叠状态
  async toggleCollapse(id: string): Promise<Node> {
    const response = await apiClient.patch<NodeResponse>(`/api/nodes/${id}/toggle-collapse`);
    return toNode(response);
  },

  // 删除节点
  async delete(id: string, options?: { opId?: string }): Promise<void> {
    await apiClient.delete(`/api/nodes/${id}`, {
      headers: options?.opId ? { 'x-op-id': options.opId } : undefined,
    });
  },

  // 批量删除节点
  async batchDelete(ids: string[]): Promise<void> {
    await apiClient.delete('/api/nodes/batch');
  },

  // 按功能标签查找节点
  async getBySupertag(supertagId: string): Promise<Node[]> {
    const response = await apiClient.get<NodeResponse[]>(`/api/nodes/supertag/${supertagId}`);
    return response.map(toNode);
  },

  // 搜索节点
  async search(query: string): Promise<Node[]> {
    const response = await apiClient.get<NodeResponse[]>('/api/nodes/search', { q: query });
    return response.map(toNode);
  },

  async advancedSearch(query: SearchQuery): Promise<Node[]> {
    const response = await apiClient.post<NodeResponse[]>('/api/nodes/search/query', query);
    return response.map(toNode);
  },
};

export default nodesApi;
