'use client';

import { useState, useCallback } from 'react';
import { useNodeStore } from '@/stores/nodeStore';
import { useSearchNodeStore } from '@/stores/searchNodeStore';
import type { SearchConfig } from '@/types/search';

/**
 * v4.0: 搜索节点配置/执行状态与逻辑
 * 参考 useNodeCommand 设计，供 NodeComponent 在 node.type === 'search' 时使用
 */
export function useSearchNode(nodeId: string) {
  const node = useNodeStore((s) => s.nodes[nodeId]);
  const nodes = useNodeStore((s) => s.nodes);
  const updateNode = useNodeStore((s) => s.updateNode);
  const addSearchNode = useNodeStore((s) => s.addSearchNode);
  const deleteNode = useNodeStore((s) => s.deleteNode);
  const executeSearch = useSearchNodeStore((s) => s.executeSearch);
  const refreshSearch = useSearchNodeStore((s) => s.refreshSearch);

  const [showSearchConfig, setShowSearchConfig] = useState(false);
  const [pendingSearchNodeId, setPendingSearchNodeId] = useState<string | null>(null);
  const [deleteAfterSearchCreate, setDeleteAfterSearchCreate] = useState(false);

  const handleOpenSearchConfig = useCallback(() => {
    if (node?.type === 'search') {
      setPendingSearchNodeId(nodeId);
      setShowSearchConfig(true);
    }
  }, [node?.type, nodeId]);

  /**
   * 配置确认后的回调
   * @param config 搜索配置（自然语言输入后解析得到）
   */
  const handleSearchConfigConfirm = useCallback(
    (config: SearchConfig) => {
      if (pendingSearchNodeId) {
        // 编辑现有搜索节点
        const existingNode = nodes[pendingSearchNodeId];
        if (existingNode?.type === 'search') {
          updateNode(pendingSearchNodeId, {
            content: `🔎 ${config.label || '搜索节点'}`,
            payload: config,
          });
          // 更新后自动执行搜索
          setTimeout(() => {
            executeSearch(pendingSearchNodeId, config);
          }, 100);
        }
      } else {
        // 创建新搜索节点
        const newNodeId = addSearchNode(node?.parentId ?? null, config, nodeId);
        if (deleteAfterSearchCreate) {
          deleteNode(nodeId);
        }
        // 创建后自动执行搜索
        setTimeout(() => {
          executeSearch(newNodeId, config);
        }, 100);
      }
      setShowSearchConfig(false);
      setPendingSearchNodeId(null);
      setDeleteAfterSearchCreate(false);
    },
    [
      pendingSearchNodeId,
      nodes,
      node?.parentId,
      nodeId,
      updateNode,
      addSearchNode,
      deleteAfterSearchCreate,
      deleteNode,
      executeSearch,
    ]
  );

  const handleCloseSearchConfig = useCallback(() => {
    setShowSearchConfig(false);
    setPendingSearchNodeId(null);
    setDeleteAfterSearchCreate(false);
  }, []);

  const handleExecuteSearch = useCallback(() => {
    if (!node || node.type !== 'search') return;
    const config = node.payload as SearchConfig;
    if (!config?.conditions || config.conditions.length === 0) {
      // 未配置条件，打开配置弹窗
      setPendingSearchNodeId(nodeId);
      setShowSearchConfig(true);
      return;
    }
    refreshSearch(nodeId, config);
  }, [node, nodeId, refreshSearch]);

  /** 供 handleKeyDown 使用：/search 回车时打开配置并标记创建后删当前节点 */
  const openSearchConfigAndDeleteCurrentAfterCreate = useCallback(() => {
    setPendingSearchNodeId(null);
    setDeleteAfterSearchCreate(true);
    setShowSearchConfig(true);
  }, []);

  const searchConfigForModal =
    pendingSearchNodeId != null ? (nodes[pendingSearchNodeId]?.payload as SearchConfig) : undefined;

  return {
    showSearchConfig,
    setShowSearchConfig,
    pendingSearchNodeId,
    setPendingSearchNodeId,
    deleteAfterSearchCreate,
    setDeleteAfterSearchCreate,
    handleOpenSearchConfig,
    handleSearchConfigConfirm,
    handleCloseSearchConfig,
    handleExecuteSearch,
    openSearchConfigAndDeleteCurrentAfterCreate,
    searchConfigForModal,
  };
}
