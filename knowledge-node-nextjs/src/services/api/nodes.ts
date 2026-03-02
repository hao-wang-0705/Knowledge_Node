/**
 * 节点 API
 */
import apiClient from './client';
import type { Node, NodeReference } from '@/types';

// API 响应类型
export interface NodeResponse {
  id: string;
  content: string;
  type: string;
  parentId?: string;
  nodeRole?: string;
  childrenIds: string[];
  isCollapsed: boolean;
  fields: Record<string, any>;
  supertagId?: string;
  tags: string[];
  references?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
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

// 移动节点参数
export interface MoveNodeParams {
  newParentId?: string;
  newIndex?: number;
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

  // 创建节点
  async create(params: CreateNodeParams): Promise<Node> {
    const response = await apiClient.post<NodeResponse>('/api/nodes', params);
    return toNode(response);
  },

  // 批量创建节点
  async batchCreate(nodes: CreateNodeParams[]): Promise<{ count: number }> {
    return apiClient.post('/api/nodes/batch', { nodes });
  },

  // 更新节点
  async update(id: string, params: UpdateNodeParams): Promise<Node> {
    const response = await apiClient.patch<NodeResponse>(`/api/nodes/${id}`, params);
    return toNode(response);
  },

  // 批量更新节点
  async batchUpdate(nodes: Array<{ id: string } & UpdateNodeParams>): Promise<Node[]> {
    const response = await apiClient.patch<NodeResponse[]>('/api/nodes/batch', { nodes });
    return response.map(toNode);
  },

  // 移动节点
  async move(id: string, params: MoveNodeParams): Promise<Node> {
    const response = await apiClient.patch<NodeResponse>(`/api/nodes/${id}/move`, params);
    return toNode(response);
  },

  // 缩进节点
  async indent(id: string): Promise<Node> {
    const response = await apiClient.patch<NodeResponse>(`/api/nodes/${id}/indent`);
    return toNode(response);
  },

  // 反缩进节点
  async outdent(id: string): Promise<Node> {
    const response = await apiClient.patch<NodeResponse>(`/api/nodes/${id}/outdent`);
    return toNode(response);
  },

  // 切换折叠状态
  async toggleCollapse(id: string): Promise<Node> {
    const response = await apiClient.patch<NodeResponse>(`/api/nodes/${id}/toggle-collapse`);
    return toNode(response);
  },

  // 删除节点
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/nodes/${id}`);
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
};

export default nodesApi;
