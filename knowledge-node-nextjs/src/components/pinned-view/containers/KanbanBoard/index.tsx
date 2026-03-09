'use client';

/**
 * KanbanBoard - 看板视图容器
 * v3.6: 以 select 类型字段分组，支持卡片跨列拖拽自动更新状态
 */

import React, { useMemo, useCallback, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { ViewContainerProps } from '../../registry/ViewRegistry';
import type { Node, FieldDefinition } from '@/types';
import KanbanColumn from './KanbanColumn';
import KanbanCard from './KanbanCard';
import { cn } from '@/lib/utils';

/**
 * 看板列定义
 */
interface KanbanColumnDef {
  id: string;
  title: string;
  color?: string;
}

/**
 * KanbanBoard 组件
 */
export function KanbanBoard({
  tagTemplate,
  nodes,
  layoutConfig,
  selectedNodeId,
  onNodeSelect,
  onNodeUpdate,
  onNodeDelete,
  isLoading = false,
}: ViewContainerProps) {
  // 拖拽状态
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  
  // 分组字段定义
  const groupFieldDef = useMemo<FieldDefinition | undefined>(() => {
    if (!layoutConfig.groupByField) return undefined;
    return tagTemplate.fieldDefinitions?.find(
      (f) => f.key === layoutConfig.groupByField && (f.type === 'select' || f.type === 'multi-select')
    );
  }, [tagTemplate.fieldDefinitions, layoutConfig.groupByField]);
  
  // 生成列定义
  const columns = useMemo<KanbanColumnDef[]>(() => {
    if (!groupFieldDef) {
      return [{ id: '__all__', title: '所有项目' }];
    }
    
    const options = groupFieldDef.options || [];
    const cols: KanbanColumnDef[] = options.map((opt) => ({
      id: opt,
      title: opt,
    }));
    
    // 添加"未分类"列
    cols.push({ id: '__uncategorized__', title: '未分类' });
    
    return cols;
  }, [groupFieldDef]);
  
  // 按列分组节点
  const nodesByColumn = useMemo(() => {
    const result: Record<string, Node[]> = {};
    
    // 初始化所有列
    columns.forEach((col) => {
      result[col.id] = [];
    });
    
    // 过滤带当前 supertag 的节点
    const tagNodes = nodes.filter((n) => n.supertagId === tagTemplate.id);
    
    // 分组
    tagNodes.forEach((node) => {
      const fieldValue = layoutConfig.groupByField
        ? node.fields?.[layoutConfig.groupByField]
        : null;
      
      if (!fieldValue || !columns.some((c) => c.id === fieldValue)) {
        result['__uncategorized__']?.push(node);
      } else {
        result[fieldValue]?.push(node);
      }
    });
    
    // 排序
    if (layoutConfig.sortField) {
      const sortField = layoutConfig.sortField;
      const sortOrder = layoutConfig.sortOrder || 'asc';
      
      Object.keys(result).forEach((colId) => {
        result[colId].sort((a, b) => {
          const aVal = sortField === 'content' ? a.content : a.fields?.[sortField];
          const bVal = sortField === 'content' ? b.content : b.fields?.[sortField];
          
          if (aVal === undefined || aVal === null) return 1;
          if (bVal === undefined || bVal === null) return -1;
          
          const aStr = String(aVal);
          const bStr = String(bVal);
          return sortOrder === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
        });
      });
    }
    
    return result;
  }, [nodes, tagTemplate.id, columns, layoutConfig]);
  
  // 配置拖拽传感器
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  // 查找节点所在列
  const findColumnForNode = useCallback((nodeId: string): string | null => {
    for (const [colId, colNodes] of Object.entries(nodesByColumn)) {
      if (colNodes.some((n) => n.id === nodeId)) {
        return colId;
      }
    }
    return null;
  }, [nodesByColumn]);
  
  // 拖拽开始
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);
  
  // 拖拽悬停
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;
    setOverId(over?.id as string | null);
  }, []);
  
  // 拖拽结束
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    
    setActiveId(null);
    setOverId(null);
    
    if (!over || !onNodeUpdate || !layoutConfig.groupByField) return;
    
    const activeNodeId = active.id as string;
    let targetColumnId = over.id as string;
    
    // 如果放置目标是节点，找到该节点所在列
    if (!columns.some((c) => c.id === targetColumnId)) {
      const foundColumn = findColumnForNode(targetColumnId);
      if (foundColumn) {
        targetColumnId = foundColumn;
      } else {
        return;
      }
    }
    
    // 更新节点字段
    const newValue = targetColumnId === '__uncategorized__' ? '' : targetColumnId;
    const node = nodes.find((n) => n.id === activeNodeId);
    
    if (node && node.fields?.[layoutConfig.groupByField] !== newValue) {
      onNodeUpdate(activeNodeId, {
        fields: {
          ...node.fields,
          [layoutConfig.groupByField]: newValue,
        },
      });
    }
  }, [columns, findColumnForNode, layoutConfig.groupByField, nodes, onNodeUpdate]);
  
  // 获取正在拖拽的节点
  const activeNode = useMemo(() => {
    if (!activeId) return null;
    return nodes.find((n) => n.id === activeId) || null;
  }, [activeId, nodes]);
  
  // 加载状态
  if (isLoading && nodes.length === 0) {
    return (
      <div className="h-full flex gap-4 p-4 overflow-x-auto">
        {columns.slice(0, 4).map((col) => (
          <div
            key={col.id}
            className="w-72 shrink-0 bg-gray-50 dark:bg-gray-900 rounded-lg p-3"
          >
            <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-3" />
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }
  
  // 无分组字段警告
  if (!groupFieldDef) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <div className="text-center">
          <p className="text-lg mb-2">看板视图需要分组字段</p>
          <p className="text-sm text-gray-400">
            请配置一个 select 类型的字段作为分组依据
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="h-full flex gap-4 p-4 overflow-x-auto">
        {columns.map((column) => {
          const columnNodes = nodesByColumn[column.id] || [];
          
          return (
            <SortableContext
              key={column.id}
              items={columnNodes.map((n) => n.id)}
              strategy={verticalListSortingStrategy}
            >
              <KanbanColumn
                id={column.id}
                title={column.title}
                count={columnNodes.length}
                isOver={overId === column.id}
              >
                {columnNodes.map((node) => (
                  <KanbanCard
                    key={node.id}
                    node={node}
                    fieldDefinitions={tagTemplate.fieldDefinitions || []}
                    isSelected={selectedNodeId === node.id}
                    isDragging={activeId === node.id}
                    onSelect={() => onNodeSelect?.(node.id)}
                    onDelete={onNodeDelete ? () => onNodeDelete(node.id) : undefined}
                  />
                ))}
                
                {/* 空列提示 */}
                {columnNodes.length === 0 && (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    拖拽卡片到此处
                  </div>
                )}
              </KanbanColumn>
            </SortableContext>
          );
        })}
      </div>
      
      {/* 拖拽预览 */}
      <DragOverlay>
        {activeNode && (
          <KanbanCard
            node={activeNode}
            fieldDefinitions={tagTemplate.fieldDefinitions || []}
            isSelected={false}
            isDragging
            isOverlay
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}

export default KanbanBoard;
