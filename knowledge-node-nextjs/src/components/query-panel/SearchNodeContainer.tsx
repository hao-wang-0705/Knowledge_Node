'use client';

import React, { memo, useCallback } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNodeStore } from '@/stores/nodeStore';
import { EmptyState } from '@/components/ui/empty-state';
import SearchNodeCard from './SearchNodeCard';
import NodeComponent from '@/components/NodeComponent';

interface SearchNodeContainerProps {
  /** search_root 下的搜索节点 ID 列表 */
  searchNodeIds: string[];
}

/**
 * 搜索节点容器组件
 * v3.6: 替代原 QueryBlockContainer，展示 search_root 下的真实搜索节点
 * v3.7: 搜索结果使用完整 NodeComponent，支持全功能增删改查
 */
const SearchNodeContainer: React.FC<SearchNodeContainerProps> = memo(({ searchNodeIds }) => {
  const navigateToNode = useNodeStore((state) => state.navigateToNode);
  
  // 点击 bullet 时跳转到主页面对应节点
  const handleBulletClick = useCallback((nodeId: string) => {
    navigateToNode(nodeId);
  }, [navigateToNode]);
  
  // 渲染搜索结果中的节点（完整版，复用 NodeComponent）
  const renderResultNode = useCallback((nodeId: string) => {
    return (
      <NodeComponent
        key={nodeId}
        nodeId={nodeId}
        depth={0}
        onBulletClick={handleBulletClick}
      />
    );
  }, [handleBulletClick]);

  if (searchNodeIds.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <EmptyState
          icon={<Search className="w-8 h-8" />}
          title="暂无搜索节点"
          description="点击上方「+」按钮创建搜索"
          variant="default"
        />
      </div>
    );
  }

  return (
    <div 
      className={cn(
        'flex-1 flex flex-col gap-3 p-3 overflow-auto',
        'min-h-0' // 允许子元素收缩
      )}
    >
      {searchNodeIds.map((nodeId) => (
        <SearchNodeCard 
          key={nodeId} 
          nodeId={nodeId}
          renderResultNode={renderResultNode}
        />
      ))}
    </div>
  );
});

SearchNodeContainer.displayName = 'SearchNodeContainer';

export default SearchNodeContainer;
