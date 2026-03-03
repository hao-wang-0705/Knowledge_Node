'use client';

/**
 * Supertag Hooks
 * v3.3: 重构为只读模式，移除所有写操作 hooks
 * 
 * 保留的只读 hooks:
 * - useSupertags: 获取所有标签列表
 * - useSupertag: 获取单个标签详情
 * 
 * 已移除的写操作 hooks:
 * - useCreateSupertag
 * - useUpdateSupertag
 * - useDeleteSupertag
 * - useSupertagOperations
 */

import { useQuery } from '@tanstack/react-query';
import { supertagsApi } from '@/services/api/tags';
import type { Supertag } from '@/types';

// Query Keys
export const supertagKeys = {
  all: ['supertags'] as const,
  lists: () => [...supertagKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...supertagKeys.lists(), filters] as const,
  details: () => [...supertagKeys.all, 'detail'] as const,
  detail: (id: string) => [...supertagKeys.details(), id] as const,
};

/**
 * 获取所有 Supertags 的 Hook（只读）
 * 返回系统预置标签列表
 */
export function useSupertags() {
  return useQuery({
    queryKey: supertagKeys.lists(),
    queryFn: supertagsApi.getAll,
    staleTime: 5 * 60 * 1000, // 5 分钟缓存
  });
}

/**
 * 获取单个 Supertag 的 Hook（只读）
 * @param id 标签 ID
 */
export function useSupertag(id: string) {
  return useQuery({
    queryKey: supertagKeys.detail(id),
    queryFn: () => supertagsApi.getOne(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 分钟缓存
  });
}

// =============================================================================
// v3.3: 以下写操作 hooks 已移除
// =============================================================================

/**
 * @deprecated v3.3: 用户写操作已移除，此 hook 不再可用
 * 如需创建标签，请使用管理员内部 API
 */
export function useCreateSupertag() {
  console.warn('[v3.3] useCreateSupertag 已废弃：用户写操作已移除');
  return {
    mutate: () => { throw new Error('用户写操作已移除'); },
    mutateAsync: () => Promise.reject(new Error('用户写操作已移除')),
    isPending: false,
    isError: true,
    error: new Error('用户写操作已移除'),
  };
}

/**
 * @deprecated v3.3: 用户写操作已移除，此 hook 不再可用
 */
export function useUpdateSupertag() {
  console.warn('[v3.3] useUpdateSupertag 已废弃：用户写操作已移除');
  return {
    mutate: () => { throw new Error('用户写操作已移除'); },
    mutateAsync: () => Promise.reject(new Error('用户写操作已移除')),
    isPending: false,
    isError: true,
    error: new Error('用户写操作已移除'),
  };
}

/**
 * @deprecated v3.3: 用户写操作已移除，此 hook 不再可用
 */
export function useDeleteSupertag() {
  console.warn('[v3.3] useDeleteSupertag 已废弃：用户写操作已移除');
  return {
    mutate: () => { throw new Error('用户写操作已移除'); },
    mutateAsync: () => Promise.reject(new Error('用户写操作已移除')),
    isPending: false,
    isError: true,
    error: new Error('用户写操作已移除'),
  };
}

/**
 * @deprecated v3.3: 用户写操作已移除，此 hook 不再可用
 */
export function useSupertagOperations() {
  console.warn('[v3.3] useSupertagOperations 已废弃：用户写操作已移除');
  return {
    createSupertag: useCreateSupertag(),
    updateSupertag: useUpdateSupertag(),
    deleteSupertag: useDeleteSupertag(),
    isLoading: false,
  };
}
