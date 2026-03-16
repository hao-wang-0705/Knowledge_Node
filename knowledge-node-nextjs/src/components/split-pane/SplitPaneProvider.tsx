'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { useSplitPane } from './useSplitPane';
import NodeDetailPanel from './NodeDetailPanel';

interface SplitPaneProviderProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * 右侧面板 Context Provider
 * 仅管理 NodeDetailPanel（节点详情面板）
 * 
 */
const SplitPaneProvider: React.FC<SplitPaneProviderProps> = ({
  children,
}) => {
  // 节点详情面板状态
  const { isOpen: isDetailOpen, panelWidth: detailPanelWidth, closePanel: closeDetailPanel } = useSplitPane();

  return (
    <>
      {/* 主内容区域包裹器 */}
      <div 
        className="flex-1 flex flex-col min-w-0 relative transition-all duration-300 ease-in-out"
      >
        {children}
      </div>

      {/* 右侧节点详情面板 - 固定定位，覆盖式显示 */}
      <div
        className={cn(
          'fixed top-14 right-0 h-[calc(100vh-56px)] z-50 transition-transform duration-200',
          isDetailOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        style={{ width: detailPanelWidth }}
      >
        <NodeDetailPanel />
      </div>

      {/* 面板打开时的遮罩（用于点击关闭） */}
      {isDetailOpen && (
        <div 
          className="fixed inset-0 top-14 bg-black/20 z-40 backdrop-blur-[1px]"
          onClick={closeDetailPanel}
        />
      )}
    </>
  );
};

export default SplitPaneProvider;
