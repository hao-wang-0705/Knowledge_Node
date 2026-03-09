'use client';

/**
 * DynamicTable - 动态表格视图容器
 * v3.6: 自动读取字段定义生成表头，支持单元格内联编辑和树状展开
 */

import React, { useMemo, useCallback, useState } from 'react';
import { ChevronRight, ChevronDown, MoreHorizontal, Trash2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ViewContainerProps } from '../../registry/ViewRegistry';
import type { FieldDefinition, Node } from '@/types';
import InlineEditor from './InlineEditor';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/**
 * 表格列定义
 */
interface TableColumn {
  key: string;
  label: string;
  width?: string;
  type: 'content' | 'field';
  fieldDef?: FieldDefinition;
}

/**
 * DynamicTable 组件
 */
export function DynamicTable({
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
  
  // 生成列定义
  const columns = useMemo<TableColumn[]>(() => {
    const cols: TableColumn[] = [
      { key: 'content', label: '内容', width: '40%', type: 'content' },
    ];
    
    // 从字段定义生成列
    const fieldDefs = tagTemplate.fieldDefinitions || [];
    
    // 如果配置了 columns，按配置顺序
    if (layoutConfig.columns && layoutConfig.columns.length > 0) {
      layoutConfig.columns.forEach((key) => {
        const fieldDef = fieldDefs.find((f) => f.key === key);
        if (fieldDef) {
          cols.push({
            key: fieldDef.key,
            label: fieldDef.name,
            type: 'field',
            fieldDef,
          });
        }
      });
    } else {
      // 默认显示所有字段
      fieldDefs.forEach((fieldDef) => {
        cols.push({
          key: fieldDef.key,
          label: fieldDef.name,
          type: 'field',
          fieldDef,
        });
      });
    }
    
    return cols;
  }, [tagTemplate.fieldDefinitions, layoutConfig.columns]);
  
  // 过滤并排序节点
  const sortedNodes = useMemo(() => {
    // 只显示带当前 supertag 的顶级节点
    let filtered = nodes.filter((node) => node.supertagId === tagTemplate.id);
    
    // 排序
    if (layoutConfig.sortField) {
      const sortField = layoutConfig.sortField;
      const sortOrder = layoutConfig.sortOrder || 'asc';
      
      filtered.sort((a, b) => {
        let aVal: unknown;
        let bVal: unknown;
        
        if (sortField === 'content') {
          aVal = a.content;
          bVal = b.content;
        } else if (sortField === 'createdAt' || sortField === 'updatedAt') {
          aVal = a[sortField];
          bVal = b[sortField];
        } else {
          aVal = a.fields?.[sortField];
          bVal = b.fields?.[sortField];
        }
        
        // 空值排到最后
        if (aVal === undefined || aVal === null || aVal === '') return 1;
        if (bVal === undefined || bVal === null || bVal === '') return -1;
        
        // 比较
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        const aStr = String(aVal);
        const bStr = String(bVal);
        return sortOrder === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
      });
    }
    
    return filtered;
  }, [nodes, tagTemplate.id, layoutConfig.sortField, layoutConfig.sortOrder]);
  
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
  
  // 获取子节点
  const getChildNodes = useCallback((parentId: string): Node[] => {
    return nodes.filter((n) => n.parentId === parentId);
  }, [nodes]);
  
  // 处理字段更新
  const handleFieldChange = useCallback((nodeId: string, fieldKey: string, value: unknown) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node || !onNodeUpdate) return;
    
    onNodeUpdate(nodeId, {
      fields: {
        ...node.fields,
        [fieldKey]: value,
      },
    });
  }, [nodes, onNodeUpdate]);
  
  // 处理内容更新
  const handleContentChange = useCallback((nodeId: string, content: string) => {
    if (!onNodeUpdate) return;
    onNodeUpdate(nodeId, { content });
  }, [onNodeUpdate]);
  
  // 渲染表格行
  const renderRow = (node: Node, depth: number = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const childNodes = getChildNodes(node.id);
    const hasChildren = childNodes.length > 0;
    const isSelected = selectedNodeId === node.id;
    
    return (
      <React.Fragment key={node.id}>
        <tr
          className={cn(
            'group border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors',
            isSelected && 'bg-blue-50 dark:bg-blue-900/20'
          )}
          onClick={() => onNodeSelect?.(node.id)}
        >
          {columns.map((col, colIdx) => (
            <td
              key={col.key}
              className={cn(
                'px-3 py-2 text-sm',
                colIdx === 0 && 'font-medium'
              )}
              style={col.width ? { width: col.width } : undefined}
            >
              {col.type === 'content' ? (
                <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 20}px` }}>
                  {/* 展开/折叠按钮 */}
                  {hasChildren ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(node.id);
                      }}
                      className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                    >
                      {isExpanded ? (
                        <ChevronDown size={14} className="text-gray-500" />
                      ) : (
                        <ChevronRight size={14} className="text-gray-500" />
                      )}
                    </button>
                  ) : (
                    <span className="w-5" />
                  )}
                  
                  {/* 内容编辑 */}
                  <InlineEditor
                    value={node.content}
                    onChange={(val) => handleContentChange(node.id, String(val ?? ''))}
                    placeholder="输入内容..."
                    className="flex-1"
                  />
                  
                  {/* 操作按钮 */}
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 ml-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                        >
                          <MoreHorizontal size={14} className="text-gray-500" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-40 p-1" align="end">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onNodeSelect?.(node.id);
                          }}
                          className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                        >
                          <ExternalLink size={14} />
                          查看详情
                        </button>
                        {onNodeDelete && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onNodeDelete(node.id);
                            }}
                            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          >
                            <Trash2 size={14} />
                            删除
                          </button>
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              ) : col.fieldDef ? (
                <InlineEditor
                  value={node.fields?.[col.key]}
                  onChange={(val) => handleFieldChange(node.id, col.key, val)}
                  fieldDef={col.fieldDef}
                  nodeId={node.id}
                />
              ) : null}
            </td>
          ))}
        </tr>
        
        {/* 渲染子节点 */}
        {isExpanded && childNodes.map((child) => renderRow(child, depth + 1))}
      </React.Fragment>
    );
  };
  
  // 加载状态
  if (isLoading && sortedNodes.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    style={col.width ? { width: col.width } : undefined}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                  {columns.map((col) => (
                    <td key={col.key} className="px-3 py-3">
                      <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  
  // 空状态
  if (sortedNodes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <div className="text-center">
          <p className="text-lg mb-2">暂无数据</p>
          <p className="text-sm text-gray-400">使用上方输入框添加第一条记录</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-full flex flex-col">
      {/* 统计栏 */}
      <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <span className="text-xs text-gray-500">
          共 {sortedNodes.length} 条记录
        </span>
      </div>
      
      {/* 表格 */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700"
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedNodes.map((node) => renderRow(node))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DynamicTable;
