/**
 * 笔记本 API
 */
import apiClient from './client';
import type { Notebook, Node } from '@/types';

// API 响应类型
export interface NotebookResponse {
  id: string;
  name: string;
  icon?: string;
  rootNodeId: string;
  nodeCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface NotebookWithNodesResponse extends NotebookResponse {
  nodes: Array<{
    id: string;
    content: string;
    type: string;
    parentId?: string;
    childrenIds: string[];
    isCollapsed: boolean;
    fields: Record<string, any>;
    supertagId?: string;
    tags: string[];
    references?: Record<string, any>;
    createdAt: string;
    updatedAt: string;
  }>;
}

// 创建笔记本参数
export interface CreateNotebookParams {
  name: string;
  icon?: string;
  rootNodeId?: string;
}

// 更新笔记本参数
export interface UpdateNotebookParams {
  name?: string;
  icon?: string;
}

// 将 API 响应转换为前端 Notebook 类型
function toNotebook(response: NotebookResponse): Notebook {
  return {
    id: response.id,
    name: response.name,
    icon: response.icon,
    rootNodeId: response.rootNodeId,
    createdAt: new Date(response.createdAt).getTime(),
    updatedAt: new Date(response.updatedAt).getTime(),
  };
}

export const notebooksApi = {
  // 获取所有笔记本
  async getAll(): Promise<Array<Notebook & { nodeCount?: number }>> {
    const response = await apiClient.get<NotebookResponse[]>('/api/notebooks');
    return response.map((nb) => ({
      ...toNotebook(nb),
      nodeCount: nb.nodeCount,
    }));
  },

  // 获取单个笔记本
  async getOne(id: string): Promise<Notebook & { nodeCount?: number }> {
    const response = await apiClient.get<NotebookResponse>(`/api/notebooks/${id}`);
    return {
      ...toNotebook(response),
      nodeCount: response.nodeCount,
    };
  },

  // 获取笔记本及其所有节点
  async getOneWithNodes(id: string): Promise<{
    notebook: Notebook;
    nodes: Record<string, Node>;
    rootIds: string[];
  }> {
    const response = await apiClient.get<NotebookWithNodesResponse>(`/api/notebooks/${id}/nodes`);
    
    const notebook = toNotebook(response);
    const nodes: Record<string, Node> = {};
    const rootIds: string[] = [];
    
    response.nodes.forEach((node) => {
      nodes[node.id] = {
        id: node.id,
        content: node.content,
        type: node.type as Node['type'],
        parentId: node.parentId ?? null,
        childrenIds: node.childrenIds,
        isCollapsed: node.isCollapsed,
        fields: node.fields,
        supertagId: node.supertagId ?? null,
        tags: node.tags,
        references: node.references as any,
        createdAt: new Date(node.createdAt).getTime(),
      };
      
      // 没有 parentId 的节点是根节点
      if (!node.parentId) {
        rootIds.push(node.id);
      }
    });
    
    return { notebook, nodes, rootIds };
  },

  // 创建笔记本
  async create(params: CreateNotebookParams): Promise<Notebook> {
    const response = await apiClient.post<NotebookResponse>('/api/notebooks', params);
    return toNotebook(response);
  },

  // 更新笔记本
  async update(id: string, params: UpdateNotebookParams): Promise<Notebook> {
    const response = await apiClient.patch<NotebookResponse>(`/api/notebooks/${id}`, params);
    return toNotebook(response);
  },

  // 复制笔记本
  async duplicate(id: string, newName?: string): Promise<Notebook> {
    const response = await apiClient.post<NotebookResponse>(`/api/notebooks/${id}/duplicate`, { newName });
    return toNotebook(response);
  },

  // 删除笔记本
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/notebooks/${id}`);
  },
};

export default notebooksApi;
