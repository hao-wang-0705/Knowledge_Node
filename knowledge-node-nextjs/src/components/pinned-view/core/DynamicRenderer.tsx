'use client';

/**
 * DynamicRenderer - 动态渲染器
 * v3.6: 根据 ViewConfig 动态渲染视图容器和扩展组件
 */

import React from 'react';
import type { ViewConfig } from '@/types/view-config';
import type { TagTemplate, Node } from '@/types';
import { ComponentResolver, type ResolvedViewConfig, type ResolvedWidget } from './ComponentResolver';
import { parseViewConfig, DEFAULT_VIEW_CONFIG } from './ConfigParser';

/**
 * DynamicRenderer Props
 */
export interface DynamicRendererProps {
  /** 标签模板 */
  tagTemplate: TagTemplate;
  /** 节点列表 */
  nodes: Node[];
  /** 视图配置（可选，会自动从 tagTemplate.viewConfig 读取） */
  viewConfig?: ViewConfig | null;
  /** 选中节点 ID */
  selectedNodeId?: string | null;
  /** 节点选中回调 */
  onNodeSelect?: (nodeId: string) => void;
  /** 节点更新回调 */
  onNodeUpdate?: (nodeId: string, updates: Partial<Node>) => void;
  /** 节点删除回调 */
  onNodeDelete?: (nodeId: string) => void;
  /** 是否加载中 */
  isLoading?: boolean;
  /** 自定义样式类名 */
  className?: string;
}

/**
 * 动态渲染器组件
 * 根据 ViewConfig 配置动态渲染视图容器和扩展组件
 */
export function DynamicRenderer({
  tagTemplate,
  nodes,
  viewConfig: viewConfigProp,
  selectedNodeId,
  onNodeSelect,
  onNodeUpdate,
  onNodeDelete,
  isLoading = false,
  className,
}: DynamicRendererProps) {
  // 解析视图配置
  const viewConfig = React.useMemo(() => {
    // 优先使用 props 传入的配置
    if (viewConfigProp) {
      return parseViewConfig(viewConfigProp);
    }
    // 其次使用 tagTemplate 中的配置
    if (tagTemplate.viewConfig) {
      return parseViewConfig(tagTemplate.viewConfig);
    }
    // 最后使用默认配置
    return DEFAULT_VIEW_CONFIG;
  }, [viewConfigProp, tagTemplate.viewConfig]);

  // 解析组件
  const resolved = React.useMemo<ResolvedViewConfig>(() => {
    return ComponentResolver.resolve(viewConfig, tagTemplate, nodes);
  }, [viewConfig, tagTemplate, nodes]);

  const { ViewContainer, layoutType, headerWidgets, sidebarWidgets } = resolved;

  // 渲染 Header Widgets
  const renderHeaderWidgets = () => {
    if (headerWidgets.length === 0) return null;

    return (
      <div className="flex flex-col gap-4 mb-4">
        {headerWidgets.map((widget) => (
          <WidgetRenderer
            key={widget.id}
            widget={widget}
            tagTemplate={tagTemplate}
            nodes={nodes}
          />
        ))}
      </div>
    );
  };

  // 渲染 Sidebar Widgets
  const renderSidebarWidgets = () => {
    if (sidebarWidgets.length === 0) return null;

    return (
      <div className="flex flex-col gap-4">
        {sidebarWidgets.map((widget) => (
          <WidgetRenderer
            key={widget.id}
            widget={widget}
            tagTemplate={tagTemplate}
            nodes={nodes}
          />
        ))}
      </div>
    );
  };

  // 渲染主视图容器
  const renderViewContainer = () => {
    if (!ViewContainer) {
      return (
        <div className="flex items-center justify-center h-64 text-gray-500">
          <p>视图类型 "{layoutType}" 未注册，请联系管理员</p>
        </div>
      );
    }

    return (
      <ViewContainer
        tagTemplate={tagTemplate}
        nodes={nodes}
        layoutConfig={viewConfig.layout}
        selectedNodeId={selectedNodeId}
        onNodeSelect={onNodeSelect}
        onNodeUpdate={onNodeUpdate}
        onNodeDelete={onNodeDelete}
        isLoading={isLoading}
      />
    );
  };

  // 根据是否有侧边栏决定布局
  const hasSidebar = sidebarWidgets.length > 0;

  return (
    <div className={`flex flex-col h-full ${className || ''}`}>
      {/* Header 区域 */}
      {renderHeaderWidgets()}

      {/* 主内容区域 */}
      {hasSidebar ? (
        <div className="flex flex-1 gap-4 min-h-0">
          {/* 主视图 */}
          <div className="flex-1 min-w-0">{renderViewContainer()}</div>
          {/* 侧边栏 */}
          <div className="w-80 shrink-0">{renderSidebarWidgets()}</div>
        </div>
      ) : (
        <div className="flex-1 min-h-0">{renderViewContainer()}</div>
      )}
    </div>
  );
}

/**
 * Widget 渲染器
 */
interface WidgetRendererProps {
  widget: ResolvedWidget;
  tagTemplate: TagTemplate;
  nodes: Node[];
}

function WidgetRenderer({ widget, tagTemplate, nodes }: WidgetRendererProps) {
  const { Component, config, type } = widget;

  if (!Component) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm">
        组件类型 "{type}" 未注册
      </div>
    );
  }

  return (
    <Component
      config={config}
      tagTemplate={tagTemplate}
      nodes={nodes}
    />
  );
}

export default DynamicRenderer;
