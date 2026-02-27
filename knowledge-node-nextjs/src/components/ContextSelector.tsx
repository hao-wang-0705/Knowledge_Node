'use client';

import { useState, useMemo, useCallback } from 'react';
import { Tag, FolderTree, Clock, Filter, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ContextFilter, Supertag, Node } from '@/types';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

interface ContextSelectorProps {
  /** 当前筛选条件 */
  filter: ContextFilter;
  /** 筛选条件变更回调 */
  onFilterChange: (filter: ContextFilter) => void;
  /** 可选的 Supertags */
  supertags?: Supertag[];
  /** 节点树（用于路径选择） */
  nodes?: Record<string, Node>;
  /** 根节点 IDs */
  rootIds?: string[];
  /** 预览选中的节点数量 */
  selectedCount?: number;
  /** 自定义类名 */
  className?: string;
}

// 快捷时间范围选项
const TIME_PRESETS = [
  { id: 'today', label: '今天', getDates: () => ({ start: new Date(), end: new Date() }) },
  { id: 'yesterday', label: '昨天', getDates: () => ({ start: subDays(new Date(), 1), end: subDays(new Date(), 1) }) },
  { id: 'this-week', label: '本周', getDates: () => ({ start: startOfWeek(new Date(), { weekStartsOn: 1 }), end: endOfWeek(new Date(), { weekStartsOn: 1 }) }) },
  { id: 'last-7-days', label: '最近7天', getDates: () => ({ start: subDays(new Date(), 7), end: new Date() }) },
  { id: 'this-month', label: '本月', getDates: () => ({ start: startOfMonth(new Date()), end: endOfMonth(new Date()) }) },
  { id: 'last-30-days', label: '最近30天', getDates: () => ({ start: subDays(new Date(), 30), end: new Date() }) },
] as const;

/**
 * 上下文选择器组件
 * 用于配置指令节点的数据筛选条件
 */
export function ContextSelector({
  filter,
  onFilterChange,
  supertags = [],
  nodes: _nodes = {}, // 保留用于路径选择功能
  rootIds: _rootIds = [], // 保留用于路径选择功能
  selectedCount,
  className,
}: ContextSelectorProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>('time');

  // 切换 Supertag 选择
  const toggleSupertag = useCallback((tagId: string) => {
    const currentIds = filter.supertagIds || [];
    const newIds = currentIds.includes(tagId)
      ? currentIds.filter(id => id !== tagId)
      : [...currentIds, tagId];
    
    onFilterChange({
      ...filter,
      supertagIds: newIds.length > 0 ? newIds : undefined,
    });
  }, [filter, onFilterChange]);

  // 设置时间范围
  const setTimeRange = useCallback((presetId: string) => {
    const preset = TIME_PRESETS.find(p => p.id === presetId);
    if (preset) {
      const { start, end } = preset.getDates();
      onFilterChange({
        ...filter,
        dateRange: { start, end },
      });
    }
  }, [filter, onFilterChange]);

  // 清除时间范围
  const clearTimeRange = useCallback(() => {
    onFilterChange({
      ...filter,
      dateRange: undefined,
    });
  }, [filter, onFilterChange]);

  // 清除所有筛选
  const clearAll = useCallback(() => {
    onFilterChange({});
  }, [onFilterChange]);

  // 活跃的筛选条件数量
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filter.supertagIds?.length) count++;
    if (filter.dateRange) count++;
    if (filter.ancestorId) count++;
    return count;
  }, [filter]);

  // 格式化日期范围显示
  const dateRangeLabel = useMemo(() => {
    if (!filter.dateRange) return null;
    const { start, end } = filter.dateRange;
    if (format(start, 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd')) {
      return format(start, 'M月d日');
    }
    return `${format(start, 'M/d')} - ${format(end, 'M/d')}`;
  }, [filter.dateRange]);

  return (
    <div className={cn('bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800', className)}>
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-zinc-500" />
          <span className="font-medium text-sm">上下文筛选</span>
          {activeFilterCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 text-xs">
              {activeFilterCount}
            </span>
          )}
        </div>
        {activeFilterCount > 0 && (
          <button
            onClick={clearAll}
            className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            清除全部
          </button>
        )}
      </div>

      {/* 时间范围 */}
      <div className="border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setExpandedSection(expandedSection === 'time' ? null : 'time')}
          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
        >
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-zinc-400" />
            <span className="text-sm">时间范围</span>
            {dateRangeLabel && (
              <span className="px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 text-xs">
                {dateRangeLabel}
              </span>
            )}
          </div>
          <ChevronDown className={cn('w-4 h-4 text-zinc-400 transition-transform', expandedSection === 'time' && 'rotate-180')} />
        </button>
        
        {expandedSection === 'time' && (
          <div className="px-4 pb-3">
            <div className="flex flex-wrap gap-2">
              {TIME_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setTimeRange(preset.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs transition-colors',
                    filter.dateRange && 
                    format(filter.dateRange.start, 'yyyy-MM-dd') === format(preset.getDates().start, 'yyyy-MM-dd') &&
                    format(filter.dateRange.end, 'yyyy-MM-dd') === format(preset.getDates().end, 'yyyy-MM-dd')
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  )}
                >
                  {preset.label}
                </button>
              ))}
              {filter.dateRange && (
                <button
                  onClick={clearTimeRange}
                  className="px-2 py-1.5 rounded-full text-xs bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 hover:bg-red-200"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 标签筛选 */}
      <div className="border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setExpandedSection(expandedSection === 'tags' ? null : 'tags')}
          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
        >
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-zinc-400" />
            <span className="text-sm">按标签</span>
            {(filter.supertagIds?.length ?? 0) > 0 && (
              <span className="px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 text-xs">
                {filter.supertagIds?.length} 个
              </span>
            )}
          </div>
          <ChevronDown className={cn('w-4 h-4 text-zinc-400 transition-transform', expandedSection === 'tags' && 'rotate-180')} />
        </button>
        
        {expandedSection === 'tags' && (
          <div className="px-4 pb-3">
            {supertags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {supertags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => toggleSupertag(tag.id)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs transition-colors flex items-center gap-1.5',
                      filter.supertagIds?.includes(tag.id)
                        ? 'text-white'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                    )}
                    style={filter.supertagIds?.includes(tag.id) ? { backgroundColor: tag.color } : undefined}
                  >
                    {tag.icon && <span>{tag.icon}</span>}
                    {tag.name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-400">暂无标签</p>
            )}
          </div>
        )}
      </div>

      {/* 路径筛选 */}
      <div>
        <button
          onClick={() => setExpandedSection(expandedSection === 'path' ? null : 'path')}
          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
        >
          <div className="flex items-center gap-2">
            <FolderTree className="w-4 h-4 text-zinc-400" />
            <span className="text-sm">按路径</span>
            {filter.ancestorId && (
              <span className="px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 text-xs">
                已选择
              </span>
            )}
          </div>
          <ChevronDown className={cn('w-4 h-4 text-zinc-400 transition-transform', expandedSection === 'path' && 'rotate-180')} />
        </button>
        
        {expandedSection === 'path' && (
          <div className="px-4 pb-3">
            <p className="text-xs text-zinc-400">点击大纲中的节点以限定范围</p>
          </div>
        )}
      </div>

      {/* 预览 */}
      {selectedCount !== undefined && (
        <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-200 dark:border-zinc-800">
          <p className="text-xs text-zinc-500">
            将包含 <span className="font-medium text-indigo-600 dark:text-indigo-400">{selectedCount}</span> 个节点的内容
          </p>
        </div>
      )}
    </div>
  );
}
