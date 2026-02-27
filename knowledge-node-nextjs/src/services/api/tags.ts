/**
 * 标签 API（Supertag）
 */
import apiClient from './client';
import type { Supertag } from '@/types';
import { PRESET_CATEGORY_IDS } from '@/types';

// =============== Supertag API 响应类型 ===============

export interface SupertagResponse {
  id: string;
  name: string;
  color: string;
  category?: string;
  categoryId?: string;
  icon?: string;
  description?: string;
  fieldDefinitions: any[];
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { nodes: number };
  /** v2.1 */
  parentId?: string | null;
  templateContent?: any;
  resolvedFieldDefinitions?: any[];
}

export interface CreateSupertagParams {
  name: string;
  color: string;
  categoryId?: string;
  icon?: string;
  description?: string;
  fieldDefinitions?: any[];
  isSystem?: boolean;
  parentId?: string | null;
  templateContent?: any;
}

export interface UpdateSupertagParams {
  name?: string;
  color?: string;
  categoryId?: string;
  icon?: string;
  description?: string;
  fieldDefinitions?: any[];
  parentId?: string | null;
  templateContent?: any;
}

// =============== 类型转换函数 ===============

function toSupertag(response: SupertagResponse): Supertag {
  return {
    id: response.id,
    name: response.name,
    color: response.color,
    categoryId: response.categoryId || response.category || PRESET_CATEGORY_IDS.UNCATEGORIZED,
    icon: response.icon,
    description: response.description,
    fieldDefinitions: response.fieldDefinitions ?? [],
    isSystem: response.isSystem,
    parentId: response.parentId ?? undefined,
    templateContent: response.templateContent ?? undefined,
    resolvedFieldDefinitions: response.resolvedFieldDefinitions,
  };
}

// =============== Supertag API ===============

export const supertagsApi = {
  // 获取所有功能标签（含 parentId / templateContent 用于继承树与模版）
  async getAll(): Promise<Array<Supertag & { nodeCount?: number }>> {
    const response = await apiClient.get<SupertagResponse[]>('/api/supertags');
    return response.map((tag) => ({
      ...toSupertag(tag),
      parentId: tag.parentId ?? undefined,
      templateContent: tag.templateContent ?? undefined,
      nodeCount: tag._count?.nodes,
    }));
  },

  // 按分类获取功能标签
  async getByCategory(category: string): Promise<Supertag[]> {
    const response = await apiClient.get<SupertagResponse[]>(`/api/supertags/category/${category}`);
    return response.map(toSupertag);
  },

  // 获取单个功能标签（含继承合并后的 resolvedFieldDefinitions）
  async getOne(id: string): Promise<Supertag & { nodeCount?: number }> {
    const response = await apiClient.get<SupertagResponse>(`/api/supertags/${id}`);
    return {
      ...toSupertag(response),
      resolvedFieldDefinitions: response.resolvedFieldDefinitions ?? response.fieldDefinitions,
      nodeCount: response._count?.nodes,
    };
  },

  // 创建功能标签
  async create(params: CreateSupertagParams): Promise<Supertag> {
    const response = await apiClient.post<SupertagResponse>('/api/supertags', params);
    return toSupertag(response);
  },

  // 批量创建功能标签
  async batchCreate(supertags: CreateSupertagParams[]): Promise<any[]> {
    return apiClient.post('/api/supertags/batch', { supertags });
  },

  // 更新功能标签
  async update(id: string, params: UpdateSupertagParams): Promise<Supertag> {
    const response = await apiClient.patch<SupertagResponse>(`/api/supertags/${id}`, params);
    return toSupertag(response);
  },

  // 删除功能标签
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/supertags/${id}`);
  },
};

// =============== 搜索 API ===============

export const tagsApi = {
  // 搜索所有标签
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
