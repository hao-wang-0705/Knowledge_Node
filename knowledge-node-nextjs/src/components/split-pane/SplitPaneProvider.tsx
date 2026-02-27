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
 * 管理面板开关和布局
 * 
 * 使用 Fragment 包裹，不添加额外的 DOM 层级
 * 主内容区域的 marginRight 通过 CSS 变量控制
 */
const SplitPaneProvider: React.FC<SplitPaneProviderProps> = ({
  children,
}) => {
  const { isOpen, panelWidth } = useSplitPane();

  return (
    <>
      {/* 主内容区域包裹器 - 使用 flex-1 继承父级布局，添加 marginRight 支持面板 */}
      <div 
        className="flex-1 flex flex-col min-w-0 relative transition-all duration-200"
        style={{
          marginRight: isOpen ? panelWidth : 0,
        }}
      >
        {children}
      </div>

      {/* 右侧详情面板 - 固定定位，不影响主布局 */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full z-40 transition-transform duration-200',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        style={{ width: panelWidth }}
      >
        <NodeDetailPanel />
      </div>

      {/* 面板打开时的遮罩（可选，用于小屏幕） */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/10 z-30 lg:hidden"
          onClick={() => {
            // 点击遮罩关闭面板（仅在小屏幕）
          }}
        />
      )}
    </>
  );
};

export default SplitPaneProvider;
