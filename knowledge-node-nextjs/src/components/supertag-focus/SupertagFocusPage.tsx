'use client';

/**
 * 超级标签聚焦页面主容器 (v3.7)
 * 
 * 布局结构：
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ FocusHeader (面包屑 + 设置按钮 + 关闭按钮)                        │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ QuickCapture (常驻输入框)                                         │
 * ├──────────────────────────────────┬──────────────────────────────┤
 * │ FocusNodeList (节点列表)          │ FocusPanel (焦点面板，可选)   │
 * └──────────────────────────────────┴──────────────────────────────┘
 */

import React, { useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useFocusStore } from '@/stores/focusStore';
import FocusHeader from './FocusHeader';
import QuickCapture from './QuickCapture';
import FocusNodeList from './FocusNodeList';
import FocusPanel from './FocusPanel';

interface SupertagFocusPageProps {
  tagId: string;
  onBack: () => void;
}

const SupertagFocusPage: React.FC<SupertagFocusPageProps> = ({ tagId, onBack }) => {
  // Store 状态
  const focusedTag = useFocusStore((state) => state.focusedTag);
  const isPanelOpen = useFocusStore((state) => state.isPanelOpen);
  const selectedNodeId = useFocusStore((state) => state.selectedNodeId);
  const selectNode = useFocusStore((state) => state.selectNode);
  
  // 关闭焦点面板
  const handleClosePanel = useCallback(() => {
    selectNode(null);
  }, [selectNode]);
  
  if (!focusedTag) {
    return null;
  }
  
  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-tl-xl overflow-hidden">
      {/* 顶部导航栏 */}
      <FocusHeader tag={focusedTag} onBack={onBack} />
      
      {/* 快捷录入区 */}
      <QuickCapture tagName={focusedTag.name} />
      
      {/* 主内容区域 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：节点列表 */}
        <div
          className={cn(
            'flex-1 overflow-hidden transition-all duration-300',
            isPanelOpen && 'lg:mr-[400px]'
          )}
        >
          <FocusNodeList />
        </div>
        
        {/* 右侧：焦点面板 */}
        {isPanelOpen && selectedNodeId && (
          <>
            {/* 移动端遮罩 */}
            <div
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
              onClick={handleClosePanel}
            />
            
            {/* 焦点面板 */}
            <div
              className={cn(
                'fixed right-0 top-0 bottom-0 w-full sm:w-[400px]',
                'bg-white dark:bg-slate-900',
                'border-l border-gray-200 dark:border-gray-700/50',
                'shadow-2xl z-50',
                'transform transition-transform duration-300',
                isPanelOpen ? 'translate-x-0' : 'translate-x-full'
              )}
            >
              <FocusPanel nodeId={selectedNodeId} onClose={handleClosePanel} />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SupertagFocusPage;
