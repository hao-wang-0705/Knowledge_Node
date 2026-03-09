'use client';

/**
 * KanbanColumn - 看板列组件
 * v3.6: 看板列容器，支持放置目标高亮
 */

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';

interface KanbanColumnProps {
  id: string;
  title: string;
  count: number;
  isOver?: boolean;
  children: React.ReactNode;
}

/**
 * KanbanColumn 组件
 */
export function KanbanColumn({
  id,
  title,
  count,
  isOver = false,
  children,
}: KanbanColumnProps) {
  const { setNodeRef, isOver: isDroppableOver } = useDroppable({
    id,
  });
  
  const showHighlight = isOver || isDroppableOver;
  
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'w-72 shrink-0 flex flex-col bg-gray-50 dark:bg-gray-900/50 rounded-lg',
        'transition-all duration-200',
        showHighlight && 'ring-2 ring-blue-400 ring-opacity-50 bg-blue-50 dark:bg-blue-900/20'
      )}
    >
      {/* 列头 */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {title}
        </h3>
        <span className="text-xs text-gray-500 bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded-full">
          {count}
        </span>
      </div>
      
      {/* 卡片列表 */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[200px]">
        {children}
      </div>
    </div>
  );
}

export default KanbanColumn;
