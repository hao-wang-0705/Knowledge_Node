'use client';

import React, { memo, useCallback, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useQueryPanelStore, QUERY_PANEL_CONSTANTS } from '@/stores/queryPanelStore';
import { useNodeStore } from '@/stores/nodeStore';
import { useToastActions } from '@/components/ui/toast';
import QueryPanelHeader from './QueryPanelHeader';
import SearchNodeContainer from './SearchNodeContainer';

/**
 * 查询面板主容器组件（常驻模式）
 * v3.6: 重构为展示 search_root 下的真实搜索节点
 */
const QueryPanel: React.FC = memo(() => {
  const searchNodeIds = useQueryPanelStore((state) => state.searchNodeIds);
  const loadSearchNodes = useQueryPanelStore((state) => state.loadSearchNodes);
  const addSearchNode = useQueryPanelStore((state) => state.addSearchNode);
  const hydratePanelWidth = useQueryPanelStore((state) => state.hydratePanelWidth);
  
  // 订阅 nodeStore 的 nodes 变化，用于触发重新加载
  const nodes = useNodeStore((state) => state.nodes);
  const searchRootId = useNodeStore((state) => state.getSearchRootId());
  
  const toast = useToastActions();
  const [showLimitWarning, setShowLimitWarning] = useState(false);

  // 客户端挂载时同步面板宽度
  useEffect(() => {
    hydratePanelWidth();
  }, [hydratePanelWidth]);

  // 当 nodes 变化或 searchRootId 变化时重新加载搜索节点
  useEffect(() => {
    if (searchRootId) {
      loadSearchNodes();
    }
  }, [searchRootId, nodes, loadSearchNodes]);

  // 处理新建搜索节点
  const handleAddSearchNode = useCallback(() => {
    const newId = addSearchNode();
    
    if (newId === null) {
      // 达到上限，显示提示
      setShowLimitWarning(true);
      toast.error(`已达上限，最多支持 ${QUERY_PANEL_CONSTANTS.MAX_SEARCH_NODES} 个搜索节点`);
      
      // 3 秒后隐藏警告条
      setTimeout(() => setShowLimitWarning(false), 3000);
    }
  }, [addSearchNode, toast]);

  return (
    <div
      className={cn(
        'h-full flex flex-col',
        'bg-white/95 dark:bg-slate-900/95',
        'bg-gradient-to-b from-slate-50/50 to-white dark:from-slate-900/50 dark:to-slate-900'
      )}
    >
      {/* 面板头部 */}
      <QueryPanelHeader
        queryCount={searchNodeIds.length}
        onAddQuery={handleAddSearchNode}
        showLimitWarning={showLimitWarning}
      />

      {/* 搜索节点容器 */}
      <SearchNodeContainer searchNodeIds={searchNodeIds} />
    </div>
  );
});

QueryPanel.displayName = 'QueryPanel';

export default QueryPanel;
