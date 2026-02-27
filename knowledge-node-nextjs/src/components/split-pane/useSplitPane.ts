'use client';

import { useCallback } from 'react';
import { useSplitPaneStore } from '@/stores/splitPaneStore';

/**
 * 右侧面板操作 Hook
 * 提供 openPanel/closePanel/navigateInPanel/goBack 方法
 */
export function useSplitPane() {
  const isOpen = useSplitPaneStore((state) => state.isOpen);
  const panelNodeId = useSplitPaneStore((state) => state.panelNodeId);
  const panelHistory = useSplitPaneStore((state) => state.panelHistory);
  const panelWidth = useSplitPaneStore((state) => state.panelWidth);
  
  const openPanel = useSplitPaneStore((state) => state.openPanel);
  const closePanel = useSplitPaneStore((state) => state.closePanel);
  const navigateInPanel = useSplitPaneStore((state) => state.navigateInPanel);
  const goBack = useSplitPaneStore((state) => state.goBack);
  const setPanelWidth = useSplitPaneStore((state) => state.setPanelWidth);
  
  /**
   * 处理节点点击事件
   * - 普通点击：跳转到节点（使用默认跳转逻辑）
   * - Cmd/Ctrl + Click：在右侧面板打开
   */
  const handleNodeClick = useCallback((nodeId: string, e: React.MouseEvent) => {
    const isModifierClick = e.metaKey || e.ctrlKey;
    
    if (isModifierClick) {
      // Cmd/Ctrl + Click: 在面板中打开
      if (isOpen) {
        // 如果面板已打开，在面板内导航
        navigateInPanel(nodeId);
      } else {
        // 打开新面板
        openPanel(nodeId);
      }
      return true; // 表示已处理，阻止默认跳转
    }
    
    return false; // 未处理，执行默认跳转
  }, [isOpen, navigateInPanel, openPanel]);

  return {
    // 状态
    isOpen,
    panelNodeId,
    panelHistory,
    panelWidth,
    canGoBack: panelHistory.length > 1,
    
    // 操作
    openPanel,
    closePanel,
    navigateInPanel,
    goBack,
    setPanelWidth,
    handleNodeClick,
  };
}

export default useSplitPane;
