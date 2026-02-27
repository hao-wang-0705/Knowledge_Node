'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { nodesApi } from '@/lib/api-client';
import type { Node, CreateNodeRequest, UpdateNodeRequest } from '@/types';

// Query Keys
export const nodeKeys = {
  all: ['nodes'] as const,
  lists: () => [...nodeKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...nodeKeys.lists(), filters] as const,
  details: () => [...nodeKeys.all, 'detail'] as const,
  detail: (id: string) => [...nodeKeys.details(), id] as const,
};

/**
 * 获取所有节点的 Hook
 */
export function useNodes() {
  return useQuery({
    queryKey: nodeKeys.lists(),
    queryFn: nodesApi.getAll,
  });
}

/**
 * 获取单个节点的 Hook
 */
export function useNode(id: string) {
  return useQuery({
    queryKey: nodeKeys.detail(id),
    queryFn: () => nodesApi.getById(id),
    enabled: !!id,
  });
}

/**
 * 创建节点的 Hook（带乐观更新）
 */
export function useCreateNode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateNodeRequest) => nodesApi.create(data),
    
    // 乐观更新
    onMutate: async (newNode) => {
      // 取消正在进行的查询
      await queryClient.cancelQueries({ queryKey: nodeKeys.lists() });

      // 保存之前的数据用于回滚
      const previousNodes = queryClient.getQueryData<Node[]>(nodeKeys.lists());

      // 乐观更新：添加临时节点
      if (previousNodes) {
        const tempNode: Node = {
          id: `temp-${Date.now()}`,
          content: newNode.content ?? '',
          type: newNode.nodeType ?? 'text',
          parentId: newNode.parentId ?? null,
          childrenIds: [],
          isCollapsed: false,
          tags: [],
          supertagId: newNode.supertagId ?? null,
          fields: newNode.fields ?? {},
          payload: newNode.payload ?? {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        
        queryClient.setQueryData<Node[]>(
          nodeKeys.lists(),
          [...previousNodes, tempNode]
        );
      }

      return { previousNodes };
    },

    // 出错时回滚
    onError: (err, newNode, context) => {
      if (context?.previousNodes) {
        queryClient.setQueryData(nodeKeys.lists(), context.previousNodes);
      }
      console.error('创建节点失败:', err);
    },

    // 成功或失败后都重新获取数据
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: nodeKeys.lists() });
    },
  });
}

/**
 * 更新节点的 Hook（带乐观更新）
 */
export function useUpdateNode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateNodeRequest }) =>
      nodesApi.update(id, data),

    // 乐观更新
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: nodeKeys.lists() });
      await queryClient.cancelQueries({ queryKey: nodeKeys.detail(id) });

      const previousNodes = queryClient.getQueryData<Node[]>(nodeKeys.lists());

      if (previousNodes) {
        queryClient.setQueryData<Node[]>(
          nodeKeys.lists(),
          previousNodes.map((node) =>
            node.id === id
              ? {
                  ...node,
                  ...data,
                  type: data.nodeType ?? node.type,
                  updatedAt: Date.now(),
                }
              : node
          )
        );
      }

      return { previousNodes };
    },

    onError: (err, variables, context) => {
      if (context?.previousNodes) {
        queryClient.setQueryData(nodeKeys.lists(), context.previousNodes);
      }
      console.error('更新节点失败:', err);
    },

    onSettled: (data, error, { id }) => {
      queryClient.invalidateQueries({ queryKey: nodeKeys.lists() });
      queryClient.invalidateQueries({ queryKey: nodeKeys.detail(id) });
    },
  });
}

/**
 * 删除节点的 Hook（带乐观更新）
 */
export function useDeleteNode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => nodesApi.delete(id),

    // 乐观更新
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: nodeKeys.lists() });

      const previousNodes = queryClient.getQueryData<Node[]>(nodeKeys.lists());

      if (previousNodes) {
        // 递归删除节点及其所有子节点
        const idsToDelete = new Set<string>();
        const collectChildIds = (nodeId: string) => {
          idsToDelete.add(nodeId);
          previousNodes
            .filter((n) => n.parentId === nodeId)
            .forEach((n) => collectChildIds(n.id));
        };
        collectChildIds(id);

        queryClient.setQueryData<Node[]>(
          nodeKeys.lists(),
          previousNodes.filter((node) => !idsToDelete.has(node.id))
        );
      }

      return { previousNodes };
    },

    onError: (err, id, context) => {
      if (context?.previousNodes) {
        queryClient.setQueryData(nodeKeys.lists(), context.previousNodes);
      }
      console.error('删除节点失败:', err);
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: nodeKeys.lists() });
    },
  });
}

/**
 * 批量操作节点的 Hook
 */
export function useBatchNodeOperations() {
  const createNode = useCreateNode();
  const updateNode = useUpdateNode();
  const deleteNode = useDeleteNode();

  return {
    createNode,
    updateNode,
    deleteNode,
    isLoading:
      createNode.isPending || updateNode.isPending || deleteNode.isPending,
  };
}
