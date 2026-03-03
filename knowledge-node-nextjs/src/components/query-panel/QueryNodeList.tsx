'use client';

import React, { memo, useCallback } from 'react';
import { Search, Loader2, FileQuestion } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNodeStore } from '@/stores/nodeStore';
import NodeComponent from '../NodeComponent';

interface QueryNodeListProps {
  /** 节点 ID 列表（仅顶层节点，子节点由 NodeComponent 递归渲染） */
  nodeIds: string[];
  /** 是否正在加载 */
  isLoading?: boolean;
  /** 查询文本（用于空状态提示） */
  queryText?: string;
  /** 节点跳转回调（点击 bullet 时触发，跳转到主页面聚焦视图） */
  onNodeNavigate?: (nodeId: string) => void;
}

/**
 * 查询结果节点列表组件
 * 直接复用 NodeComponent，支持完整编辑功能和层级展示
 */
const QueryNodeList: React.FC<QueryNodeListProps> = memo(({
  nodeIds,
  isLoading = false,
  queryText = '',
  onNodeNavigate,
}) => {
  const setHoistedNode = useNodeStore((state) => state.setHoistedNode);

  // 点击 bullet 时跳转到主页面聚焦视图
  const handleBulletClick = useCallback((nodeId: string) => {
    if (onNodeNavigate) {
      onNodeNavigate(nodeId);
    } else {
      // 默认行为：设置主页面聚焦节点
      setHoistedNode(nodeId);
    }
  }, [onNodeNavigate, setHoistedNode]);

  // 加载状态
  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-8 text-gray-400">
        <Loader2 size={24} className="animate-spin mb-2" />
        <p className="text-xs">正在查询...</p>
      </div>
    );
  }

  // 空状态：没有查询文本
  if (!queryText.trim()) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-8 text-gray-400">
        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
          <Search size={18} className="text-gray-300 dark:text-gray-600" />
        </div>
        <p className="text-xs text-center px-4">
          输入自然语言描述
          <br />
          <span className="text-gray-300 dark:text-gray-600">
            AI 将帮你找到相关笔记
          </span>
        </p>
      </div>
    );
  }

  // 空状态：查询无结果
  if (nodeIds.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-8 text-gray-400">
        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
          <FileQuestion size={18} className="text-gray-300 dark:text-gray-600" />
        </div>
        <p className="text-xs text-center px-4">
          未找到相关笔记
          <br />
          <span className="text-gray-300 dark:text-gray-600">
            尝试调整查询条件
          </span>
        </p>
      </div>
    );
  }

  // 正常展示节点列表 - 直接复用 NodeComponent
  return (
    <div 
      className={cn(
        'flex-1 overflow-y-auto min-h-0',
        'p-2',
        // 隐藏滚动条但保持功能
        'scrollbar-none',
        '[&::-webkit-scrollbar]:hidden',
        '[-ms-overflow-style:none]',
        '[scrollbar-width:none]'
      )}
    >
      {/* 结果计数 */}
      <div className="px-2 py-1 mb-1">
        <span className="text-[10px] text-gray-400 dark:text-gray-500">
          找到 {nodeIds.length} 条相关笔记
        </span>
      </div>

      {/* 节点列表 - 使用 NodeComponent 渲染 */}
      <div className="space-y-0.5">
        {nodeIds.map((nodeId) => (
          <NodeComponent
            key={nodeId}
            nodeId={nodeId}
            depth={0}
            onBulletClick={handleBulletClick}
          />
        ))}
      </div>
    </div>
  );
});

QueryNodeList.displayName = 'QueryNodeList';

export default QueryNodeList;
