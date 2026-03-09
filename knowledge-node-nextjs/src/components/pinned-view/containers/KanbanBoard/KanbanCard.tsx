'use client';

/**
 * KanbanCard - 看板卡片组件
 * v3.6: 可拖拽的看板卡片，显示节点内容和关键字段
 */

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CalendarDays, User, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Node, FieldDefinition } from '@/types';

interface KanbanCardProps {
  node: Node;
  fieldDefinitions: FieldDefinition[];
  isSelected?: boolean;
  isDragging?: boolean;
  isOverlay?: boolean;
  onSelect?: () => void;
  onDelete?: () => void;
}

/**
 * 格式化日期显示
 */
function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  
  const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '明天';
  if (diffDays === -1) return '昨天';
  if (diffDays < 0) return `逾期 ${Math.abs(diffDays)} 天`;
  if (diffDays <= 7) return `${diffDays} 天后`;
  
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

/**
 * 获取日期状态样式
 */
function getDateStatusClass(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  
  const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 'text-red-600 bg-red-50';
  if (diffDays === 0) return 'text-orange-600 bg-orange-50';
  if (diffDays <= 3) return 'text-yellow-600 bg-yellow-50';
  return 'text-gray-500 bg-gray-100';
}

/**
 * KanbanCard 组件
 */
export function KanbanCard({
  node,
  fieldDefinitions,
  isSelected = false,
  isDragging = false,
  isOverlay = false,
  onSelect,
  onDelete,
}: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id: node.id,
    disabled: isOverlay,
  });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  
  // 查找日期字段
  const dateField = fieldDefinitions.find((f) => f.type === 'date');
  const dateValue = dateField ? node.fields?.[dateField.key] : null;
  
  // 查找负责人字段（reference 类型）
  const assigneeField = fieldDefinitions.find(
    (f) => f.type === 'reference' && (f.key.includes('assignee') || f.key.includes('owner') || f.name.includes('负责人'))
  );
  const assigneeValue = assigneeField ? node.fields?.[assigneeField.key] : null;
  
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
      className={cn(
        'group bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm',
        'border border-gray-200 dark:border-gray-700',
        'cursor-grab active:cursor-grabbing',
        'transition-all duration-150',
        isSelected && 'ring-2 ring-blue-400',
        isDragging && !isOverlay && 'opacity-50',
        isOverlay && 'shadow-lg ring-2 ring-blue-400 rotate-2',
        !isDragging && 'hover:shadow-md'
      )}
    >
      {/* 内容 */}
      <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2 mb-2">
        {node.content || '(无标题)'}
      </p>
      
      {/* 底部字段 */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          {/* 截止日期 */}
          {dateValue && (
            <span
              className={cn(
                'inline-flex items-center gap-1 px-1.5 py-0.5 rounded',
                getDateStatusClass(dateValue as string)
              )}
            >
              <CalendarDays size={12} />
              {formatDate(dateValue as string)}
            </span>
          )}
          
          {/* 负责人 */}
          {assigneeValue && typeof assigneeValue === 'object' && 'title' in assigneeValue && (
            <span className="inline-flex items-center gap-1 text-gray-500">
              <User size={12} />
              {(assigneeValue as { title: string }).title}
            </span>
          )}
        </div>
        
        {/* 删除按钮 */}
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

export default KanbanCard;
