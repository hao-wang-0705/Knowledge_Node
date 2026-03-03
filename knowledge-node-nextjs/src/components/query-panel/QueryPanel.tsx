'use client';

import React, { memo, useCallback, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useQueryPanelStore, QUERY_PANEL_CONSTANTS } from '@/stores/queryPanelStore';
import { useToastActions } from '@/components/ui/toast';
import QueryPanelHeader from './QueryPanelHeader';
import QueryBlockContainer from './QueryBlockContainer';

/**
 * 查询面板主容器组件（常驻模式）
 * 作为布局的一部分，不再使用 fixed 定位
 */
const QueryPanel: React.FC = memo(() => {
  const queries = useQueryPanelStore((state) => state.queries);
  const addQueryBlock = useQueryPanelStore((state) => state.addQueryBlock);
  const initMockData = useQueryPanelStore((state) => state.initMockData);
  
  const toast = useToastActions();
  const [showLimitWarning, setShowLimitWarning] = useState(false);

  // 初始化时加载 Mock 数据（如果没有查询块）
  useEffect(() => {
    if (queries.length === 0) {
      initMockData();
    }
  }, []);

  // 处理新建查询块
  const handleAddQuery = useCallback(() => {
    const newId = addQueryBlock();
    
    if (newId === null) {
      // 达到上限，显示提示
      setShowLimitWarning(true);
      toast.error(`已达上限，最多支持 ${QUERY_PANEL_CONSTANTS.MAX_QUERY_BLOCKS} 个查询块`);
      
      // 3 秒后隐藏警告条
      setTimeout(() => setShowLimitWarning(false), 3000);
    }
  }, [addQueryBlock, toast]);

  return (
    <div
      className={cn(
        'h-full flex flex-col',
        'bg-white/95 dark:bg-slate-900/95',
        // 轻微的背景区分
        'bg-gradient-to-b from-slate-50/50 to-white dark:from-slate-900/50 dark:to-slate-900'
      )}
    >
      {/* 面板头部 - 移除关闭按钮 */}
      <QueryPanelHeader
        queryCount={queries.length}
        onAddQuery={handleAddQuery}
        showLimitWarning={showLimitWarning}
      />

      {/* 查询块容器 */}
      <QueryBlockContainer queries={queries} />
    </div>
  );
});

QueryPanel.displayName = 'QueryPanel';

export default QueryPanel;
