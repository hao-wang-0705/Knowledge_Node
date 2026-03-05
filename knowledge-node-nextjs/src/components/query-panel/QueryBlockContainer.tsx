'use client';

import React, { memo } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { QueryBlock as QueryBlockType } from '@/types/query';
import QueryBlock from './QueryBlock';
import { EmptyState } from '@/components/ui/empty-state';

interface QueryBlockContainerProps {
  /** 查询块列表 */
  queries: QueryBlockType[];
}

/**
 * 查询块容器组件
 * 使用 Flexbox 均分高度，管理多个 QueryBlock 的布局
 */
const QueryBlockContainer: React.FC<QueryBlockContainerProps> = memo(({ queries }) => {
  if (queries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <EmptyState
          icon={<Search className="w-8 h-8" />}
          title="暂无查询块"
          description="点击上方「+」按钮创建查询"
          variant="default"
        />
      </div>
    );
  }

  return (
    <div 
      className={cn(
        'flex-1 flex flex-col gap-3 p-3 overflow-hidden',
        'min-h-0' // 重要：允许子元素收缩
      )}
    >
      {queries.map((query) => (
        <QueryBlock
          key={query.id}
          query={query}
          isNew={query.queryText === '' && query.nodes.length === 0}
        />
      ))}
    </div>
  );
});

QueryBlockContainer.displayName = 'QueryBlockContainer';

export default QueryBlockContainer;
