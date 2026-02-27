'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supertagsApi } from '@/lib/api-client';
import type { Supertag, CreateSupertagRequest, UpdateSupertagRequest } from '@/types';
import { PRESET_CATEGORY_IDS } from '@/types';

// Query Keys
export const supertagKeys = {
  all: ['supertags'] as const,
  lists: () => [...supertagKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...supertagKeys.lists(), filters] as const,
  details: () => [...supertagKeys.all, 'detail'] as const,
  detail: (id: string) => [...supertagKeys.details(), id] as const,
};

/**
 * 获取所有 Supertags 的 Hook
 */
export function useSupertags() {
  return useQuery({
    queryKey: supertagKeys.lists(),
    queryFn: supertagsApi.getAll,
  });
}

/**
 * 获取单个 Supertag 的 Hook
 */
export function useSupertag(id: string) {
  return useQuery({
    queryKey: supertagKeys.detail(id),
    queryFn: () => supertagsApi.getById(id),
    enabled: !!id,
  });
}

/**
 * 创建 Supertag 的 Hook（带乐观更新）
 */
export function useCreateSupertag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSupertagRequest) => supertagsApi.create(data),

    onMutate: async (newSupertag) => {
      await queryClient.cancelQueries({ queryKey: supertagKeys.lists() });

      const previousSupertags = queryClient.getQueryData<Supertag[]>(
        supertagKeys.lists()
      );

      if (previousSupertags) {
        const tempSupertag: Supertag = {
          id: `temp-${Date.now()}`,
          name: newSupertag.name,
          color: newSupertag.color ?? '#6366F1',
          icon: newSupertag.icon,
          fieldDefinitions: newSupertag.fieldDefinitions ?? [],
          isSystem: false,
          categoryId: newSupertag.categoryId ?? PRESET_CATEGORY_IDS.UNCATEGORIZED,
        };

        queryClient.setQueryData<Supertag[]>(supertagKeys.lists(), [
          ...previousSupertags,
          tempSupertag,
        ]);
      }

      return { previousSupertags };
    },

    onError: (err, newSupertag, context) => {
      if (context?.previousSupertags) {
        queryClient.setQueryData(
          supertagKeys.lists(),
          context.previousSupertags
        );
      }
      console.error('创建标签失败:', err);
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: supertagKeys.lists() });
    },
  });
}

/**
 * 更新 Supertag 的 Hook（带乐观更新）
 */
export function useUpdateSupertag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSupertagRequest }) =>
      supertagsApi.update(id, data),

    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: supertagKeys.lists() });
      await queryClient.cancelQueries({ queryKey: supertagKeys.detail(id) });

      const previousSupertags = queryClient.getQueryData<Supertag[]>(
        supertagKeys.lists()
      );

      if (previousSupertags) {
        queryClient.setQueryData<Supertag[]>(
          supertagKeys.lists(),
          previousSupertags.map((tag) =>
            tag.id === id ? { ...tag, ...data } : tag
          )
        );
      }

      return { previousSupertags };
    },

    onError: (err, variables, context) => {
      if (context?.previousSupertags) {
        queryClient.setQueryData(
          supertagKeys.lists(),
          context.previousSupertags
        );
      }
      console.error('更新标签失败:', err);
    },

    onSettled: (data, error, { id }) => {
      queryClient.invalidateQueries({ queryKey: supertagKeys.lists() });
      queryClient.invalidateQueries({ queryKey: supertagKeys.detail(id) });
    },
  });
}

/**
 * 删除 Supertag 的 Hook（带乐观更新）
 */
export function useDeleteSupertag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => supertagsApi.delete(id),

    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: supertagKeys.lists() });

      const previousSupertags = queryClient.getQueryData<Supertag[]>(
        supertagKeys.lists()
      );

      if (previousSupertags) {
        queryClient.setQueryData<Supertag[]>(
          supertagKeys.lists(),
          previousSupertags.filter((tag) => tag.id !== id)
        );
      }

      return { previousSupertags };
    },

    onError: (err, id, context) => {
      if (context?.previousSupertags) {
        queryClient.setQueryData(
          supertagKeys.lists(),
          context.previousSupertags
        );
      }
      console.error('删除标签失败:', err);
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: supertagKeys.lists() });
    },
  });
}

/**
 * Supertag 操作的组合 Hook
 */
export function useSupertagOperations() {
  const createSupertag = useCreateSupertag();
  const updateSupertag = useUpdateSupertag();
  const deleteSupertag = useDeleteSupertag();

  return {
    createSupertag,
    updateSupertag,
    deleteSupertag,
    isLoading:
      createSupertag.isPending ||
      updateSupertag.isPending ||
      deleteSupertag.isPending,
  };
}
