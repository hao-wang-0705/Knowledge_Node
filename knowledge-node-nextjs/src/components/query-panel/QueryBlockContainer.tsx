'use client';

import React, { memo } from 'react';
import { cn } from '@/lib/utils';
import { QueryBlock as QueryBlockType } from '@/types/query';
import QueryBlock from './QueryBlock';

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
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-850 flex items-center justify-center">
            <span className="text-2xl">🔍</span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
            暂无查询块
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            点击上方「+」按钮创建查询
          </p>
        </div>
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
      {queries.map((query, index) => (
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
