'use client';

import React, { memo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { QueryBlock as QueryBlockType } from '@/types/query';
import { useQueryPanelStore } from '@/stores/queryPanelStore';
import QueryBlockHeader from './QueryBlockHeader';
import QueryNodeList from './QueryNodeList';

interface QueryBlockProps {
  /** 查询块数据 */
  query: QueryBlockType;
  /** 是否为新建的空查询块 */
  isNew?: boolean;
}

/**
 * 单个查询块组件
 * 卡片式设计，包含输入区和结果展示区
 */
const QueryBlock: React.FC<QueryBlockProps> = memo(({ query, isNew = false }) => {
  const updateQueryBlock = useQueryPanelStore((state) => state.updateQueryBlock);
  const deleteQueryBlock = useQueryPanelStore((state) => state.deleteQueryBlock);

  // 更新查询文本
  const handleQueryChange = useCallback((text: string) => {
    updateQueryBlock(query.id, { queryText: text });
  }, [query.id, updateQueryBlock]);

  // 刷新查询（Mock：模拟加载效果）
  const handleRefresh = useCallback(() => {
    updateQueryBlock(query.id, { status: 'loading' });
    
    // 模拟异步查询
    setTimeout(() => {
      updateQueryBlock(query.id, { status: 'done' });
    }, 800);
  }, [query.id, updateQueryBlock]);

  // 删除查询块
  const handleDelete = useCallback(() => {
    deleteQueryBlock(query.id);
  }, [query.id, deleteQueryBlock]);

  const isLoading = query.status === 'loading';

  return (
    <div
      className={cn(
        'flex-1 min-h-0 flex flex-col',
        'bg-gradient-to-b from-white to-gray-50/50 dark:from-slate-800 dark:to-slate-850/50',
        'rounded-xl border border-gray-200/60 dark:border-gray-700/60',
        'shadow-sm hover:shadow-md transition-shadow duration-200',
        'overflow-hidden'
      )}
    >
      {/* 头部：输入框和操作按钮 */}
      <QueryBlockHeader
        queryText={query.queryText}
        onQueryChange={handleQueryChange}
        onRefresh={handleRefresh}
        onDelete={handleDelete}
        isLoading={isLoading}
        isNew={isNew}
      />

      {/* 内容区：节点列表 */}
      <QueryNodeList 
        nodeIds={query.nodes} 
        isLoading={isLoading}
        queryText={query.queryText}
      />
    </div>
  );
});

QueryBlock.displayName = 'QueryBlock';

export default QueryBlock;
