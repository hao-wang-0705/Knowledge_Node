'use client';

/**
 * 字段胶囊组件 (v3.7)
 * 
 * 将基础字段以胶囊形式内联展示
 * 展示优先级：date > select > text
 * 最多展示 3 个，超出显示 +N
 */

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { FieldDefinition } from '@/types';
import { format, isValid, parseISO } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface FieldPillsProps {
  fields: Record<string, unknown>;
  definitions: FieldDefinition[];
  maxDisplay?: number;
}

// 字段类型优先级
const TYPE_PRIORITY: Record<string, number> = {
  date: 1,
  select: 2,
  'multi-select': 3,
  text: 4,
  number: 5,
};

// 优先级颜色映射
const PRIORITY_COLORS: Record<string, string> = {
  P0: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  P1: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  P2: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  P3: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

// 状态颜色映射
const STATUS_COLORS: Record<string, string> = {
  '待办': 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  '进行中': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  '已完成': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  '已取消': 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500 line-through',
};

// 格式化日期
function formatDateValue(value: unknown): string | null {
  if (!value) return null;
  
  // 尝试解析 ISO 日期字符串
  if (typeof value === 'string') {
    const date = parseISO(value);
    if (isValid(date)) {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // 友好日期显示
      if (date.toDateString() === now.toDateString()) {
        return '今天';
      } else if (date.toDateString() === tomorrow.toDateString()) {
        return '明天';
      } else {
        return format(date, 'M月d日', { locale: zhCN });
      }
    }
    return value;
  }
  
  if (typeof value === 'number') {
    const date = new Date(value);
    if (isValid(date)) {
      return format(date, 'M月d日', { locale: zhCN });
    }
  }
  
  return null;
}

// 获取字段显示值
function getDisplayValue(
  fieldDef: FieldDefinition,
  value: unknown
): { text: string; colorClass?: string } | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  switch (fieldDef.type) {
    case 'date': {
      const text = formatDateValue(value);
      return text ? { text: `📅 ${text}`, colorClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' } : null;
    }
    
    case 'select': {
      const text = String(value);
      // 检查是否是优先级字段
      if (PRIORITY_COLORS[text]) {
        return { text, colorClass: PRIORITY_COLORS[text] };
      }
      // 检查是否是状态字段
      if (STATUS_COLORS[text]) {
        return { text, colorClass: STATUS_COLORS[text] };
      }
      return { text, colorClass: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' };
    }
    
    case 'multi-select': {
      if (Array.isArray(value) && value.length > 0) {
        return {
          text: value.slice(0, 2).join(', ') + (value.length > 2 ? `+${value.length - 2}` : ''),
          colorClass: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
        };
      }
      return null;
    }
    
    case 'text':
    case 'number': {
      const text = String(value);
      if (text.length > 20) {
        return { text: text.slice(0, 20) + '...', colorClass: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' };
      }
      return { text, colorClass: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' };
    }
    
    default:
      return null;
  }
}

const FieldPills: React.FC<FieldPillsProps> = ({
  fields,
  definitions,
  maxDisplay = 3,
}) => {
  // 计算要展示的胶囊
  const pills = useMemo(() => {
    // 按优先级排序字段定义
    const sortedDefs = [...definitions].sort((a, b) => {
      const priorityA = TYPE_PRIORITY[a.type] ?? 99;
      const priorityB = TYPE_PRIORITY[b.type] ?? 99;
      return priorityA - priorityB;
    });
    
    // 生成胶囊数据
    const result: Array<{ key: string; text: string; colorClass: string }> = [];
    
    for (const def of sortedDefs) {
      const value = fields[def.key];
      const displayData = getDisplayValue(def, value);
      
      if (displayData) {
        result.push({
          key: def.key,
          text: displayData.text,
          colorClass: displayData.colorClass || 'bg-gray-100 text-gray-600',
        });
      }
      
      if (result.length >= maxDisplay) {
        break;
      }
    }
    
    return result;
  }, [fields, definitions, maxDisplay]);
  
  // 计算超出数量
  const totalCount = useMemo(() => {
    return definitions.filter((def) => {
      const value = fields[def.key];
      return value !== null && value !== undefined && value !== '';
    }).length;
  }, [fields, definitions]);
  
  const overflowCount = totalCount - pills.length;
  
  if (pills.length === 0) {
    return null;
  }
  
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {pills.map((pill) => (
        <span
          key={pill.key}
          className={cn(
            'px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap',
            pill.colorClass
          )}
        >
          {pill.text}
        </span>
      ))}
      
      {overflowCount > 0 && (
        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
          +{overflowCount}
        </span>
      )}
    </div>
  );
};

export default FieldPills;
