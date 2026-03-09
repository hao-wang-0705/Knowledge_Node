/**
 * 条件卡片组件
 * v3.5: 展示单个解析条件的可视化卡片
 * v3.5.1: 支持标签和字段的中文名称显示
 */

import React, { useMemo } from 'react';
import { Tag, Search, Calendar, FileText, GitBranch, X, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { SearchCondition } from '@/types/search';
import { useSupertagStore } from '@/stores/supertagStore';

interface ConditionCardProps {
  /** 条件数据 */
  condition: SearchCondition;
  /** 索引 */
  index: number;
  /** 是否可编辑 */
  editable?: boolean;
  /** 删除回调 */
  onDelete?: (index: number) => void;
  /** 编辑回调 */
  onEdit?: (index: number) => void;
  /** 额外的类名 */
  className?: string;
}

// 条件类型图标映射
const typeIconMap: Record<SearchCondition['type'], React.ElementType> = {
  keyword: Search,
  tag: Tag,
  field: FileText,
  date: Calendar,
  ancestor: GitBranch,
};

// 条件类型标签映射
const typeLabelMap: Record<SearchCondition['type'], string> = {
  keyword: '关键词',
  tag: '标签',
  field: '字段',
  date: '时间',
  ancestor: '祖先',
};

// 操作符中文映射
const operatorLabelMap: Record<string, string> = {
  equals: '等于',
  contains: '包含',
  gt: '大于',
  lt: '小于',
  gte: '大于等于',
  lte: '小于等于',
  is: '是',
  isNot: '不是',
  hasAny: '包含任意',
  hasAll: '包含全部',
  today: '今天',
  withinDays: '天内',
};

// 根据条件类型返回背景色
const typeColorMap: Record<SearchCondition['type'], string> = {
  keyword: 'bg-blue-50 border-blue-200 text-blue-700',
  tag: 'bg-teal-50 border-teal-200 text-teal-700',
  field: 'bg-purple-50 border-purple-200 text-purple-700',
  date: 'bg-amber-50 border-amber-200 text-amber-700',
  ancestor: 'bg-slate-50 border-slate-200 text-slate-700',
};

const ConditionCard: React.FC<ConditionCardProps> = ({
  condition,
  index,
  editable = true,
  onDelete,
  onEdit,
  className,
}) => {
  const Icon = typeIconMap[condition.type];
  const typeLabel = typeLabelMap[condition.type];
  const colorClass = typeColorMap[condition.type];
  
  // 获取 Supertag Store 用于查询中文名
  const { supertags } = useSupertagStore();

  // 获取标签中文名（从标签 ID 映射到名称）
  const getTagDisplayName = useMemo(() => {
    return (tagId: string): string => {
      const tag = supertags[tagId];
      return tag?.name || tagId;
    };
  }, [supertags]);

  // 获取字段中文名（从字段 key 映射到名称）
  const getFieldDisplayName = useMemo(() => {
    return (fieldKey: string): string => {
      // 遍历所有标签，查找匹配的字段
      for (const tag of Object.values(supertags)) {
        const field = tag.fieldDefinitions?.find(f => f.key === fieldKey);
        if (field) {
          return field.name;
        }
      }
      return fieldKey;
    };
  }, [supertags]);

  // 格式化条件值（支持标签 ID 转中文名）
  const formattedValue = useMemo(() => {
    const value = condition.value;
    
    // 标签类型：将标签 ID 转换为中文名
    if (condition.type === 'tag') {
      if (Array.isArray(value)) {
        return value.map(v => typeof v === 'string' ? getTagDisplayName(v) : String(v)).join(', ');
      }
      return typeof value === 'string' ? getTagDisplayName(value) : String(value);
    }
    
    // 其他类型
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    if (typeof value === 'boolean') {
      return value ? '是' : '否';
    }
    return String(value);
  }, [condition.value, condition.type, getTagDisplayName]);

  // 格式化操作符
  const formattedOperator = useMemo(() => {
    const op = condition.operator;
    // 特殊处理 withinDays
    if (op === 'withinDays') {
      return `${condition.value} 天内`;
    }
    return operatorLabelMap[op] || op;
  }, [condition.operator, condition.value]);

  // 获取字段显示名称
  const fieldDisplayName = useMemo(() => {
    if (!condition.field) return null;
    return getFieldDisplayName(condition.field);
  }, [condition.field, getFieldDisplayName]);

  // 构建描述文本
  const description = useMemo(() => {
    const negate = condition.negate ? '不' : '';
    
    switch (condition.type) {
      case 'keyword':
        return `文本 ${negate}${formattedOperator} "${formattedValue}"`;
      case 'tag':
        return `标签 ${negate}${formattedOperator} "${formattedValue}"`;
      case 'field':
        return `${fieldDisplayName || '字段'} ${negate}${formattedOperator} "${formattedValue}"`;
      case 'date':
        if (condition.operator === 'today') {
          return `${fieldDisplayName || '时间'} 是今天`;
        }
        if (condition.operator === 'withinDays') {
          return `${fieldDisplayName || '时间'} 在 ${condition.value} 天内`;
        }
        return `${fieldDisplayName || '时间'} ${negate}${formattedOperator} ${formattedValue}`;
      case 'ancestor':
        return `祖先节点 ${negate}${formattedOperator} "${formattedValue}"`;
      default:
        return `${typeLabel} ${negate}${formattedOperator} ${formattedValue}`;
    }
  }, [condition, typeLabel, formattedOperator, formattedValue, fieldDisplayName]);

  return (
    <div
      className={cn(
        'group flex items-center gap-3 rounded-lg border px-3 py-2.5',
        'transition-all duration-200',
        'hover:shadow-sm',
        colorClass,
        className
      )}
    >
      {/* 类型图标 */}
      <div
        className={cn(
          'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md',
          'bg-white/60'
        )}
      >
        <Icon className="h-4 w-4" />
      </div>

      {/* 条件描述 */}
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium">{description}</p>
        {condition.negate && (
          <span className="text-xs opacity-70">（否定条件）</span>
        )}
      </div>

      {/* 操作按钮 */}
      {editable && (
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {onEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-white/50"
              onClick={() => onEdit(index)}
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-red-100 hover:text-red-600"
              onClick={() => onDelete(index)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default ConditionCard;
