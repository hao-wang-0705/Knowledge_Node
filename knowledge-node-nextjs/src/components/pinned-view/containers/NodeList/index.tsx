'use client';

/**
 * NodeList - 列表视图容器
 * v3.6: 基于原有 FocusNodeList 迁移，作为轻量级阅读视图
 */

import React, { useMemo, useCallback, useState } from 'react';
import { ChevronRight, ChevronDown, Hash, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ViewContainerProps } from '../../registry/ViewRegistry';
import type { Node, FieldDefinition } from '@/types';

/**
 * NodeList 组件
 */
export function NodeList({
  tagTemplate,
  nodes,
  layoutConfig,
  selectedNodeId,
  onNodeSelect,
  onNodeUpdate,
  onNodeDelete,
  isLoading = false,
}: ViewContainerProps) {
  // 展开状态
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  
  // 过滤并排序节点
  const sortedNodes = useMemo(() => {
    // 只显示带当前 supertag 的顶级节点
    let filtered = nodes.filter((node) => node.supertagId === tagTemplate.id);
    
    // 排序
    if (layoutConfig.sortField) {
      const sortField = layoutConfig.sortField;
      const sortOrder = layoutConfig.sortOrder || 'asc';
      
      filtered.sort((a, b) => {
        const aVal = sortField === 'content' ? a.content : a.fields?.[sortField];
        const bVal = sortField === 'content' ? b.content : b.fields?.[sortField];
        
        if (aVal === undefined || aVal === null) return 1;
        if (bVal === undefined || bVal === null) return -1;
        
        const aStr = String(aVal);
        const bStr = String(bVal);
        return sortOrder === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
      });
    }
    
    return filtered;
  }, [nodes, tagTemplate.id, layoutConfig]);
  
  // 获取子节点
  const getChildNodes = useCallback((parentId: string): Node[] => {
    return nodes.filter((n) => n.parentId === parentId);
  }, [nodes]);
  
  // 切换展开状态
  const toggleExpand = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);
  
  // 查找日期字段值
  const getDateFieldValue = useCallback((node: Node): string | null => {
    const dateField = tagTemplate.fieldDefinitions?.find((f) => f.type === 'date');
    if (dateField) {
      return node.fields?.[dateField.key] as string | null;
    }
    return null;
  }, [tagTemplate.fieldDefinitions]);
  
  // 格式化日期
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
    });
  };
  
  // 渲染列表项
  const renderItem = (node: Node, depth: number = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const childNodes = getChildNodes(node.id);
    const hasChildren = childNodes.length > 0;
    const isSelected = selectedNodeId === node.id;
    const dateValue = getDateFieldValue(node);
    
    return (
      <div key={node.id}>
        <div
          onClick={() => onNodeSelect?.(node.id)}
          className={cn(
            'flex items-center gap-2 px-3 py-2 cursor-pointer rounded-lg mx-2',
            'transition-colors duration-100',
            isSelected
              ? 'bg-blue-50 dark:bg-blue-900/30'
              : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
          )}
          style={{ paddingLeft: `${12 + depth * 20}px` }}
        >
          {/* 展开/折叠按钮 */}
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.id);
              }}
              className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded shrink-0"
            >
              {isExpanded ? (
                <ChevronDown size={14} className="text-gray-500" />
              ) : (
                <ChevronRight size={14} className="text-gray-500" />
              )}
            </button>
          ) : (
            <span className="w-5 shrink-0" />
          )}
          
          {/* 内容 */}
          <span className="flex-1 text-sm text-gray-800 dark:text-gray-200 truncate">
            {node.content || '(无标题)'}
          </span>
          
          {/* 日期标签 */}
          {dateValue && (
            <span className="text-xs text-gray-500 shrink-0">
              {formatDate(dateValue)}
            </span>
          )}
        </div>
        
        {/* 渲染子节点 */}
        {isExpanded && childNodes.map((child) => renderItem(child, depth + 1))}
      </div>
    );
  };
  
  // 加载状态
  if (isLoading && sortedNodes.length === 0) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="px-4 py-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }
  
  // 空状态
  if (sortedNodes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center px-4 py-12">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <Inbox size={32} className="text-gray-300 dark:text-gray-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            还没有任何{' '}
            <span className="inline-flex items-center gap-1" style={{ color: tagTemplate.color }}>
              <Hash size={16} strokeWidth={2.5} />
              {tagTemplate.name}
            </span>
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            使用上方输入框快速创建第一个记录
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-full flex flex-col">
      {/* 统计栏 */}
      <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800">
        <p className="text-xs text-gray-500">
          共 {sortedNodes.length} 个{tagTemplate.name}
        </p>
      </div>
      
      {/* 列表 */}
      <div className="flex-1 overflow-y-auto py-2">
        {sortedNodes.map((node) => renderItem(node))}
      </div>
    </div>
  );
}

export default NodeList;
