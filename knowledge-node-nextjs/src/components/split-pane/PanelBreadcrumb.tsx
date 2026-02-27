'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNodeStore } from '@/stores/nodeStore';
import { getPlainTextWithoutReferences } from '@/utils/reference-helpers';

interface PanelBreadcrumbProps {
  history: string[];
  currentIndex?: number;
  onNavigate?: (index: number) => void;
  onGoBack?: () => void;
  canGoBack?: boolean;
  className?: string;
}

/**
 * 面板内迷你导航面包屑
 * - 显示当前位置和历史
 * - 支持返回上一级
 */
const PanelBreadcrumb: React.FC<PanelBreadcrumbProps> = ({
  history,
  currentIndex,
  onNavigate,
  onGoBack,
  canGoBack = false,
  className,
}) => {
  const nodes = useNodeStore((state) => state.nodes);
  
  // 获取最近的几个历史记录（最多3个）
  const recentHistory = history.slice(-3);
  const startIndex = history.length - recentHistory.length;
  
  // 获取节点标题
  const getNodeTitle = (nodeId: string): string => {
    const node = nodes[nodeId];
    if (!node) return '已删除';
    const plainContent = getPlainTextWithoutReferences(node.content);
    return plainContent.length > 15 ? plainContent.slice(0, 15) + '…' : plainContent || '未命名';
  };

  if (history.length === 0) return null;

  return (
    <div className={cn(
      'flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400',
      className
    )}>
      {/* 返回按钮 */}
      {canGoBack && onGoBack && (
        <button
          onClick={onGoBack}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
          title="返回 (⌫)"
        >
          <ChevronLeft size={14} />
        </button>
      )}
      
      {/* 历史省略 */}
      {history.length > 3 && (
        <>
          <span className="text-gray-400">…</span>
          <ChevronRight size={10} className="text-gray-300" />
        </>
      )}
      
      {/* 历史面包屑 */}
      {recentHistory.map((nodeId, idx) => {
        const actualIndex = startIndex + idx;
        const isLast = idx === recentHistory.length - 1;
        const isCurrent = currentIndex !== undefined ? actualIndex === currentIndex : isLast;
        
        return (
          <React.Fragment key={nodeId}>
            {idx > 0 && (
              <ChevronRight size={10} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />
            )}
            <button
              onClick={() => !isCurrent && onNavigate?.(actualIndex)}
              disabled={isCurrent}
              className={cn(
                'truncate max-w-[100px] px-1 py-0.5 rounded transition-colors',
                isCurrent 
                  ? 'text-gray-700 dark:text-gray-300 font-medium cursor-default' 
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer'
              )}
              title={getNodeTitle(nodeId)}
            >
              {getNodeTitle(nodeId)}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default PanelBreadcrumb;
