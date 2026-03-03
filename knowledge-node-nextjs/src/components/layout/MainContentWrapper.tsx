'use client';

import React, { memo, useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { useQueryPanelStore, QUERY_PANEL_CONSTANTS } from '@/stores/queryPanelStore';
import ResizeHandle from './ResizeHandle';
import { QueryPanel } from '@/components/query-panel';

interface MainContentWrapperProps {
  /** 子内容（各页面的主内容） */
  children: React.ReactNode;
  /** 是否显示查询面板 */
  showQueryPanel?: boolean;
  /** 自定义类名 */
  className?: string;
}

/**
 * 主内容区包裹器
 * 管理主内容区和查询面板的分屏布局，支持拖拽调整宽度
 */
const MainContentWrapper: React.FC<MainContentWrapperProps> = memo(({
  children,
  showQueryPanel = true,
  className,
}) => {
  const panelWidth = useQueryPanelStore((state) => state.panelWidth);
  const setPanelWidth = useQueryPanelStore((state) => state.setPanelWidth);
  
  // 拖拽状态 - 禁用过渡动画
  const [isResizing, setIsResizing] = useState(false);

  // 处理拖拽宽度变化
  const handleResize = useCallback((deltaX: number) => {
    setPanelWidth(panelWidth + deltaX);
  }, [panelWidth, setPanelWidth]);

  // 处理拖拽开始
  const handleResizeStart = useCallback(() => {
    setIsResizing(true);
  }, []);

  // 处理拖拽结束 - 保存到 localStorage
  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    // 持久化宽度
    if (typeof window !== 'undefined') {
      localStorage.setItem('queryPanelWidth', String(panelWidth));
    }
  }, [panelWidth]);

  return (
    <div 
      className={cn(
        'flex-1 flex min-h-0 min-w-0',
        // 白色内容区容器，实现一体化视觉效果
        'bg-white dark:bg-slate-900',
        'rounded-tl-xl',
        'overflow-hidden',
        className
      )}
    >
      {/* 主内容区 */}
      <div 
        className={cn(
          'flex-1 flex flex-col min-w-0 overflow-hidden',
          // 拖拽时禁用过渡
          !isResizing && 'transition-all duration-200'
        )}
      >
        {children}
      </div>

      {/* 查询面板（常驻显示） */}
      {showQueryPanel && (
        <>
          {/* 拖拽分割线 */}
          <ResizeHandle
            onResize={handleResize}
            onResizeStart={handleResizeStart}
            onResizeEnd={handleResizeEnd}
          />

          {/* 查询面板 */}
          <div 
            className={cn(
              'flex-shrink-0 flex flex-col',
              'border-l border-gray-100 dark:border-gray-800',
              // 拖拽时禁用过渡
              !isResizing && 'transition-all duration-200'
            )}
            style={{ 
              width: panelWidth,
              minWidth: QUERY_PANEL_CONSTANTS.MIN_WIDTH,
              maxWidth: QUERY_PANEL_CONSTANTS.MAX_WIDTH,
            }}
          >
            <QueryPanel />
          </div>
        </>
      )}
    </div>
  );
});

MainContentWrapper.displayName = 'MainContentWrapper';

export default MainContentWrapper;
