'use client';

/**
 * SupertagPinnedView - 超级标签聚焦页面主容器
 * v3.6: 基于 ViewConfig 配置驱动的声明式渲染
 * 
 * 布局结构：
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ PinnedViewHeader (面包屑 + 视图切换 + 设置按钮 + 关闭按钮)         │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ QuickCapture (常驻输入框)                                         │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ [Header Widgets - AI 聚合等]                                      │
 * ├──────────────────────────────────┬──────────────────────────────┤
 * │ DynamicRenderer (主视图容器)      │ FocusPanel (焦点面板，可选)   │
 * │ - KanbanBoard                    │                              │
 * │ - DynamicTable                   │                              │
 * │ - NodeList                       │                              │
 * └──────────────────────────────────┴──────────────────────────────┘
 */

import React, { useCallback, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useFocusStore, useFieldDefinitions } from '@/stores/focusStore';
import type { ViewConfig, ViewLayoutType } from '@/types/view-config';
import { DynamicRenderer } from './core/DynamicRenderer';
import { parseViewConfig, DEFAULT_VIEW_CONFIG } from './core/ConfigParser';
import PinnedViewHeader from './shared/PinnedViewHeader';
import QuickCapture from './shared/QuickCapture';
import FocusPanel from './shared/FocusPanel';
import ViewSwitcher from './shared/ViewSwitcher';

// 注册视图容器
import { registerView } from './registry/ViewRegistry';
import { registerWidget } from './registry/WidgetRegistry';
import { DynamicTable } from './containers/DynamicTable';
import { KanbanBoard } from './containers/KanbanBoard';
import { NodeList } from './containers/NodeList';
import { AIAggregationBlock } from './widgets/AIAggregationBlock';

// 注册默认视图
registerView({
  type: 'table',
  component: DynamicTable,
  displayName: '表格视图',
  icon: '📊',
});

registerView({
  type: 'kanban',
  component: KanbanBoard,
  displayName: '看板视图',
  icon: '📋',
  requiresGroupField: true,
});

registerView({
  type: 'list',
  component: NodeList,
  displayName: '列表视图',
  icon: '📝',
});

// 注册默认组件
registerWidget({
  type: 'ai-aggregation',
  component: AIAggregationBlock,
  displayName: 'AI 聚合',
  icon: '✨',
  allowedPositions: ['header', 'sidebar'],
});

interface SupertagPinnedViewProps {
  tagId: string;
  onBack: () => void;
}

/**
 * SupertagPinnedView 主容器组件
 */
export function SupertagPinnedView({ tagId, onBack }: SupertagPinnedViewProps) {
  // Store 状态
  const focusedTag = useFocusStore((state) => state.focusedTag);
  const nodes = useFocusStore((state) => state.nodes);
  const isLoading = useFocusStore((state) => state.isLoading);
  const isPanelOpen = useFocusStore((state) => state.isPanelOpen);
  const selectedNodeId = useFocusStore((state) => state.selectedNodeId);
  const selectNode = useFocusStore((state) => state.selectNode);
  const updateLocalNode = useFocusStore((state) => state.updateLocalNode);
  const updateNodeFields = useFocusStore((state) => state.updateNodeFields);
  const refreshNodes = useFocusStore((state) => state.refreshNodes);
  
  // 视图切换状态
  const [currentViewType, setCurrentViewType] = React.useState<ViewLayoutType>('table');
  
  // 解析视图配置
  const viewConfig = useMemo<ViewConfig>(() => {
    if (!focusedTag?.viewConfig) {
      return DEFAULT_VIEW_CONFIG;
    }
    return parseViewConfig(focusedTag.viewConfig);
  }, [focusedTag?.viewConfig]);
  
  // 合并当前视图类型
  const effectiveViewConfig = useMemo<ViewConfig>(() => {
    return {
      ...viewConfig,
      layout: {
        ...viewConfig.layout,
        type: currentViewType,
      },
    };
  }, [viewConfig, currentViewType]);
  
  // 初始化视图类型
  useEffect(() => {
    if (viewConfig.layout.type) {
      setCurrentViewType(viewConfig.layout.type);
    }
  }, [viewConfig.layout.type]);
  
  // 关闭焦点面板
  const handleClosePanel = useCallback(() => {
    selectNode(null);
  }, [selectNode]);
  
  // 节点选中
  const handleNodeSelect = useCallback((nodeId: string) => {
    selectNode(nodeId);
  }, [selectNode]);
  
  // 节点更新
  const handleNodeUpdate = useCallback(async (nodeId: string, updates: Partial<typeof nodes[0]>) => {
    // 乐观更新
    updateLocalNode(nodeId, updates);
    
    // 如果更新包含 fields，调用 API 同步
    if (updates.fields) {
      try {
        await updateNodeFields(nodeId, updates.fields as Record<string, unknown>);
      } catch (error) {
        console.error('[SupertagPinnedView] 更新节点失败:', error);
        // 回滚由 updateNodeFields 内部处理
      }
    }
  }, [updateLocalNode, updateNodeFields]);
  
  // 节点删除
  const handleNodeDelete = useCallback(async (nodeId: string) => {
    if (!window.confirm('确定要删除这个节点吗？')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/nodes/${nodeId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (response.ok) {
        // 刷新列表
        await refreshNodes();
      } else {
        console.error('[SupertagPinnedView] 删除节点失败');
      }
    } catch (error) {
      console.error('[SupertagPinnedView] 删除节点出错:', error);
    }
  }, [refreshNodes]);
  
  // 视图切换
  const handleViewChange = useCallback((type: ViewLayoutType) => {
    setCurrentViewType(type);
  }, []);
  
  if (!focusedTag) {
    return null;
  }
  
  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-tl-xl overflow-hidden">
      {/* 顶部导航栏 */}
      <PinnedViewHeader
        tag={focusedTag}
        onBack={onBack}
      >
        <ViewSwitcher
          currentType={currentViewType}
          availableTypes={['table', 'kanban', 'list']}
          groupByField={viewConfig.layout.groupByField}
          fieldDefinitions={focusedTag.fieldDefinitions || []}
          onChange={handleViewChange}
        />
      </PinnedViewHeader>
      
      {/* 快捷录入区 */}
      <QuickCapture
        tagName={focusedTag.name}
        defaultFields={viewConfig.actions?.quickCapture?.defaultFields}
        placeholder={viewConfig.actions?.quickCapture?.placeholder}
      />
      
      {/* 主内容区域 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：动态渲染区域 */}
        <div
          className={cn(
            'flex-1 overflow-hidden transition-all duration-300',
            isPanelOpen && 'lg:mr-[400px]'
          )}
        >
          <DynamicRenderer
            tagTemplate={focusedTag}
            nodes={nodes}
            viewConfig={effectiveViewConfig}
            selectedNodeId={selectedNodeId}
            onNodeSelect={handleNodeSelect}
            onNodeUpdate={handleNodeUpdate}
            onNodeDelete={handleNodeDelete}
            isLoading={isLoading}
            className="h-full"
          />
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
}

export default SupertagPinnedView;
