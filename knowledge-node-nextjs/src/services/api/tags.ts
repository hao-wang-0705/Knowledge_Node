/**
 * 标签 API（Supertag / TagTemplate）
 * v3.3: 重构为只读 API，移除所有用户写操作
 * v3.4: 移除分类系统和继承机制
 * 
 * 保留的只读 API:
 * - supertagsApi.getAll: 获取所有标签
 * - supertagsApi.getOne: 获取单个标签详情
 */

import apiClient from './client';
import type { Supertag, TagTemplate } from '@/types';

// =============== API 响应类型 ===============

export interface SupertagResponse {
  id: string;
  name: string;
  color: string;
  icon?: string;
  description?: string;
  fieldDefinitions: any[];
  isSystem?: boolean;
  isGlobalDefault?: boolean;
  creatorId?: string | null;
  status?: string;
  createdAt: string;
  updatedAt: string;
  _count?: { nodes: number };
  templateContent?: any;
}

// =============== 类型转换函数 ===============

function toSupertag(response: SupertagResponse): Supertag {
  return {
    id: response.id,
    name: response.name,
    color: response.color,
    icon: response.icon,
    description: response.description,
    fieldDefinitions: response.fieldDefinitions ?? [],
    templateContent: response.templateContent ?? undefined,
    isGlobalDefault: response.isGlobalDefault,
    status: response.status as 'active' | 'deprecated' | undefined,
    creatorId: response.creatorId,
  };
}

function toTagTemplate(response: SupertagResponse): TagTemplate {
  return {
    id: response.id,
    name: response.name,
    color: response.color,
    icon: response.icon,
    description: response.description,
    fieldDefinitions: response.fieldDefinitions ?? [],
    isGlobalDefault: response.isGlobalDefault ?? true,
    creatorId: response.creatorId ?? null,
    status: (response.status as 'active' | 'deprecated') ?? 'active',
    order: 0,
    templateContent: response.templateContent ?? null,
    createdAt: response.createdAt,
    updatedAt: response.updatedAt,
  };
}

// =============== Supertag API（只读） ===============

export const supertagsApi = {
  async getAll(): Promise<Array<Supertag & { nodeCount?: number }>> {
    const response = await apiClient.get<SupertagResponse[]>('/api/supertags');
    return response.map((tag) => ({
      ...toSupertag(tag),
      templateContent: tag.templateContent ?? undefined,
      nodeCount: tag._count?.nodes,
    }));
  },

  async getAllTemplates(): Promise<Array<TagTemplate & { nodeCount?: number }>> {
    const response = await apiClient.get<SupertagResponse[]>('/api/supertags');
    return response.map((tag) => ({
      ...toTagTemplate(tag),
      nodeCount: tag._count?.nodes,
    }));
  },

  async getOne(id: string): Promise<Supertag & { nodeCount?: number }> {
    const response = await apiClient.get<SupertagResponse>(`/api/supertags/${id}`);
    return {
      ...toSupertag(response),
      nodeCount: response._count?.nodes,
    };
  },

  async getTemplate(id: string): Promise<TagTemplate & { nodeCount?: number }> {
    const response = await apiClient.get<SupertagResponse>(`/api/supertags/${id}`);
    return {
      ...toTagTemplate(response),
      nodeCount: response._count?.nodes,
    };
  },

  // v3.3: 以下写操作 API 已移除

  /** @deprecated v3.3: 用户写操作已移除 */
  async create(): Promise<never> {
    throw new Error('[v3.3] 用户写操作已移除：supertagsApi.create 不再可用');
  },

  /** @deprecated v3.3: 用户写操作已移除 */
  async batchCreate(): Promise<never> {
    throw new Error('[v3.3] 用户写操作已移除：supertagsApi.batchCreate 不再可用');
  },

  /** @deprecated v3.3: 用户写操作已移除 */
  async update(): Promise<never> {
    throw new Error('[v3.3] 用户写操作已移除：supertagsApi.update 不再可用');
  },

  /** @deprecated v3.3: 用户写操作已移除 */
  async delete(): Promise<never> {
    throw new Error('[v3.3] 用户写操作已移除：supertagsApi.delete 不再可用');
  },
};

// =============== 搜索 API（只读） ===============

export const tagsApi = {
  async search(query: string): Promise<{
    supertags: Supertag[];
  }> {
    const response = await apiClient.get<{
      supertags: SupertagResponse[];
    }>('/api/tags/search', { q: query });
    
    return {
      supertags: response.supertags.map(toSupertag),
    };
  },
};

export default { supertagsApi, tagsApi };
