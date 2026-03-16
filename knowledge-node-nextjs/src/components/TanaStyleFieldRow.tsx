'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { 
  Type, Hash, CalendarDays, List, Circle, X, 
  AlertCircle, CheckCircle2, ChevronDown, Link2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FieldDefinition, FieldType } from '@/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useNodeStore } from '@/stores/nodeStore';

// ============================================================================
// 字段类型图标配置
// ============================================================================

interface FieldTypeConfig {
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  placeholder: string;
}

const FIELD_TYPE_CONFIG: Record<FieldType, FieldTypeConfig> = {
  text: { 
    icon: <Type size={14} />, 
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
    placeholder: 'Add text'
  },
  number: { 
    icon: <Hash size={14} />, 
    color: 'text-green-500',
    bgColor: 'bg-green-50',
    placeholder: 'Add number'
  },
  date: { 
    icon: <CalendarDays size={14} />, 
    color: 'text-orange-500',
    bgColor: 'bg-orange-50',
    placeholder: 'Add date'
  },
  select: { 
    icon: <List size={14} />, 
    color: 'text-purple-500',
    bgColor: 'bg-purple-50',
    placeholder: 'Select option'
  },
  status: {
    icon: <List size={14} />,
    color: 'text-purple-500',
    bgColor: 'bg-purple-50',
    placeholder: '状态'
  },
  'multi-select': { 
    icon: <List size={14} />, 
    color: 'text-pink-500',
    bgColor: 'bg-pink-50',
    placeholder: 'Select options'
  },
  reference: {
    icon: <Link2 size={14} />,
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-50',
    placeholder: 'Select node'
  },
};

// ============================================================================
// 日期状态辅助函数
// ============================================================================

type DateStatusType = 'none' | 'overdue' | 'today' | 'soon' | 'normal';

interface DateStatusResult {
  status: DateStatusType;
  label: string;
  className: string;
}

const getDateStatus = (dateStr: string | undefined): DateStatusResult => {
  if (!dateStr) {
    return { status: 'none', label: '', className: '' };
  }
  
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  
  const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return { status: 'overdue', label: `逾期 ${Math.abs(diffDays)} 天`, className: 'text-red-600' };
  }
  if (diffDays === 0) {
    return { status: 'today', label: '今天', className: 'text-orange-600 font-medium' };
  }
  if (diffDays <= 3) {
    return { status: 'soon', label: `${diffDays} 天后`, className: 'text-yellow-600' };
  }
  return { status: 'normal', label: '', className: '' };
};

// 格式化日期显示
const formatDate = (dateStr: string) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const options: Intl.DateTimeFormatOptions = { 
    weekday: 'short', 
    day: 'numeric', 
    month: 'short' 
  };
  return date.toLocaleDateString('zh-CN', options);
};

// ============================================================================
// TanaStyleFieldRow 组件
// ============================================================================

interface TanaStyleFieldRowProps {
  fieldDef: FieldDefinition;
  value: any;
  onChange: (value: any) => void;
  isNodeFocused?: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  className?: string;
  nodeId?: string;
}

const TanaStyleFieldRow: React.FC<TanaStyleFieldRowProps> = ({
  fieldDef,
  value,
  onChange,
  isNodeFocused = false,
  onKeyDown,
  className,
  nodeId,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [selectOpen, setSelectOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [refPopoverOpen, setRefPopoverOpen] = useState(false);
  const [refSearch, setRefSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const nodes = useNodeStore((s) => s.nodes);

  const config = FIELD_TYPE_CONFIG[fieldDef.type];
  
  const targetIds = useMemo(() =>
    fieldDef.targetTagIds ?? (fieldDef.targetTagId ? [fieldDef.targetTagId] : []),
    [fieldDef.targetTagIds, fieldDef.targetTagId],
  );

  const referenceCandidates = useMemo(() => {
    if (fieldDef.type !== 'reference' || targetIds.length === 0) return [];
    const list = Object.values(nodes).filter(
      (n) => targetIds.some(tid => n.supertagId === tid) && n.id !== nodeId
    );
    if (!refSearch.trim()) return list.slice(0, 20);
    const q = refSearch.trim().toLowerCase();
    return list.filter((n) => (n.content || '').toLowerCase().includes(q)).slice(0, 20);
  }, [nodes, fieldDef.type, targetIds, nodeId, refSearch]);

  // 获取选项列表（包括清除选项）
  const getOptions = useCallback(() => {
    const options = fieldDef.options || [];
    return value ? [...options, '__clear__'] : options;
  }, [fieldDef.options, value]);

  // 重置选中索引当打开时
  useEffect(() => {
    if (selectOpen) {
      const options = fieldDef.options || [];
      const currentIndex = options.indexOf(value);
      setSelectedIndex(currentIndex >= 0 ? currentIndex : 0);
    }
  }, [selectOpen, value, fieldDef.options]);

  // 处理选择项
  const handleSelectOption = useCallback((option: string) => {
    if (option === '__clear__') {
      onChange('');
    } else {
      onChange(option);
    }
    setSelectOpen(false);
  }, [onChange]);

  // 处理键盘事件
  const handleSelectKeyDown = useCallback((e: React.KeyboardEvent) => {
    const options = getOptions();
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (options[selectedIndex]) {
        handleSelectOption(options[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setSelectOpen(false);
    }
    
    onKeyDown?.(e);
  }, [getOptions, selectedIndex, handleSelectOption, onKeyDown]);

  // 渲染值区域
  const renderValueEditor = () => {
    const hasValue = value !== undefined && value !== '' && value !== null;

    switch (fieldDef.type) {
      case 'text':
        if (isEditing) {
          return (
            <input
              ref={inputRef}
              type="text"
              autoFocus
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              onBlur={() => setIsEditing(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') {
                  setIsEditing(false);
                }
                onKeyDown?.(e);
              }}
              className="w-full bg-transparent border-none outline-none text-sm text-gray-700 dark:text-gray-300"
              placeholder={config.placeholder}
            />
          );
        }
        return (
          <span 
            onClick={() => setIsEditing(true)}
            className={cn(
              "cursor-text text-sm",
              hasValue ? "text-gray-700 dark:text-gray-300" : "text-gray-400"
            )}
          >
            {hasValue ? value : config.placeholder}
          </span>
        );

      case 'number':
        if (isEditing) {
          return (
            <input
              ref={inputRef}
              type="number"
              autoFocus
              value={value || ''}
              onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')}
              onBlur={() => setIsEditing(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') {
                  setIsEditing(false);
                }
                onKeyDown?.(e);
              }}
              className="w-full bg-transparent border-none outline-none text-sm text-gray-700 dark:text-gray-300"
              placeholder={config.placeholder}
            />
          );
        }
        return (
          <span 
            onClick={() => setIsEditing(true)}
            className={cn(
              "cursor-text text-sm",
              hasValue ? "text-gray-700 dark:text-gray-300" : "text-gray-400"
            )}
          >
            {hasValue ? value : config.placeholder}
          </span>
        );

      case 'date':
        const dateStatus = getDateStatus(value);
        return (
          <div className="flex items-center gap-2 group/date">
            <input
              ref={dateInputRef}
              type="date"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              className="absolute opacity-0 w-0 h-0 pointer-events-none"
            />
            <button
              onClick={() => dateInputRef.current?.showPicker()}
              className={cn(
                "flex items-center gap-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-1 -mx-1 py-0.5 text-sm transition-colors",
                hasValue ? "text-gray-700 dark:text-gray-300" : "text-gray-400",
                dateStatus.className
              )}
            >
              <span>{hasValue ? formatDate(value) : config.placeholder}</span>
              {hasValue && dateStatus.status !== 'normal' && dateStatus.status !== 'none' && (
                <span className={cn(
                  "text-xs px-1.5 py-0.5 rounded-full ml-1",
                  dateStatus.status === 'overdue' && "bg-red-100 text-red-600 dark:bg-red-900/30",
                  dateStatus.status === 'today' && "bg-orange-100 text-orange-600 dark:bg-orange-900/30",
                  dateStatus.status === 'soon' && "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30"
                )}>
                  {dateStatus.status === 'overdue' && <AlertCircle size={10} className="inline mr-0.5" />}
                  {dateStatus.label}
                </span>
              )}
            </button>
            {hasValue && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onChange('');
                }}
                className="opacity-0 group-hover/date:opacity-100 p-0.5 text-gray-400 hover:text-red-500 transition-opacity"
                title="清除日期"
              >
                <X size={12} />
              </button>
            )}
          </div>
        );

      case 'select':
        const options = fieldDef.options || [];
        return (
          <Popover open={selectOpen} onOpenChange={setSelectOpen}>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "flex items-center gap-1 text-left rounded px-1.5 py-0.5 -mx-1 transition-colors text-sm",
                  hasValue 
                    ? "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700" 
                    : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                )}
              >
                <span>{hasValue ? value : config.placeholder}</span>
                <ChevronDown size={12} className="text-gray-400" />
              </button>
            </PopoverTrigger>
            <PopoverContent 
              className="w-48 p-1" 
              align="start"
              onKeyDown={handleSelectKeyDown}
            >
              <div className="space-y-0.5">
                {options.map((option, index) => {
                  const isSelected = index === selectedIndex;
                  const isCurrentValue = value === option;
                  
                  return (
                    <button
                      key={option}
                      onClick={() => handleSelectOption(option)}
                      className={cn(
                        "w-full text-left px-2 py-1.5 text-sm rounded transition-colors flex items-center text-gray-700 dark:text-gray-300",
                        isSelected ? "bg-gray-100 dark:bg-gray-700" : "hover:bg-gray-50 dark:hover:bg-gray-800"
                      )}
                    >
                      <span className="flex-1">{option}</span>
                      {isCurrentValue && <CheckCircle2 size={14} className="text-green-500 ml-2" />}
                    </button>
                  );
                })}
                {hasValue && (
                  <>
                    <div className="border-t my-1 dark:border-gray-700" />
                    <button
                      onClick={() => handleSelectOption('__clear__')}
                      className={cn(
                        "w-full text-left px-2 py-1.5 text-sm rounded transition-colors text-gray-500",
                        selectedIndex === options.length
                          ? "bg-gray-100 dark:bg-gray-700"
                          : "hover:bg-gray-100 dark:hover:bg-gray-800"
                      )}
                    >
                      <X size={12} className="inline mr-2" />
                      清除选择
                    </button>
                  </>
                )}
              </div>
            </PopoverContent>
          </Popover>
        );

      case 'reference': {
        const refValue = value && typeof value === 'object' && 'nodeId' in value 
          ? value as { nodeId: string; title: string } 
          : null;
        const refValues = fieldDef.multiple && Array.isArray(value) 
          ? value as Array<{ nodeId: string; title: string }> 
          : refValue ? [refValue] : [];
        const hasRefValue = refValues.length > 0;
        
        return (
          <Popover open={refPopoverOpen} onOpenChange={setRefPopoverOpen}>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "text-left rounded px-1.5 py-0.5 -mx-1 transition-colors text-sm min-w-[100px]",
                  hasRefValue 
                    ? "text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/30" 
                    : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                )}
              >
                {hasRefValue
                  ? refValues.map((r) => r?.title || '(无标题)').join(', ')
                  : config.placeholder}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="start">
              <input
                type="text"
                value={refSearch}
                onChange={(e) => setRefSearch(e.target.value)}
                placeholder="搜索节点…"
                className="w-full px-2 py-1.5 text-sm border rounded mb-2 dark:bg-gray-800 dark:border-gray-600"
              />
              <div className="max-h-48 overflow-auto space-y-0.5">
                {referenceCandidates.length === 0 && (
                  <div className="text-sm text-gray-500 py-2">无匹配节点（需带目标标签）</div>
                )}
                {referenceCandidates.map((n) => {
                  const isSelected = refValues.some((r) => r?.nodeId === n.id);
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        if (fieldDef.multiple) {
                          const next = isSelected
                            ? refValues.filter((r) => r.nodeId !== n.id)
                            : [...refValues, { nodeId: n.id, title: (n.content || '').trim() || '(无标题)' }];
                          onChange(next);
                        } else {
                          onChange({ nodeId: n.id, title: (n.content || '').trim() || '(无标题)' });
                          setRefPopoverOpen(false);
                        }
                      }}
                      className={cn(
                        "w-full text-left px-2 py-1.5 text-sm rounded flex items-center gap-2",
                        isSelected 
                          ? "bg-cyan-100 dark:bg-cyan-900/40 text-cyan-800 dark:text-cyan-200" 
                          : "hover:bg-gray-100 dark:hover:bg-gray-700"
                      )}
                    >
                      <span className="flex-1 truncate">{n.content || '(无标题)'}</span>
                      {isSelected && <CheckCircle2 size={14} className="text-cyan-600" />}
                    </button>
                  );
                })}
              </div>
              {hasRefValue && !fieldDef.multiple && (
                <>
                  <div className="border-t my-2 dark:border-gray-600" />
                  <button
                    type="button"
                    onClick={() => { onChange(undefined); setRefPopoverOpen(false); }}
                    className="w-full text-left px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  >
                    <X size={12} className="inline mr-2" />
                    清除引用
                  </button>
                </>
              )}
              {hasRefValue && fieldDef.multiple && (
                <>
                  <div className="border-t my-2 dark:border-gray-600" />
                  <button
                    type="button"
                    onClick={() => { onChange([]); }}
                    className="w-full text-left px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  >
                    <X size={12} className="inline mr-2" />
                    清除所有引用
                  </button>
                </>
              )}
            </PopoverContent>
          </Popover>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div 
      className={cn(
        "flex items-center py-1.5 px-2 rounded-md transition-colors group",
        "hover:bg-gray-50 dark:hover:bg-gray-800/50",
        isNodeFocused && "bg-gray-50/50 dark:bg-gray-800/30",
        className
      )}
    >
      {/* 字段图标 + 名称 */}
      <div className={cn(
        "flex items-center gap-2 min-w-[120px] flex-shrink-0",
        config.color
      )}>
        <span className={cn(
          "flex items-center justify-center w-5 h-5 rounded",
          config.bgColor
        )}>
          {config.icon}
        </span>
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {fieldDef.name}
        </span>
      </div>

      {/* 分隔符 bullet */}
      <div className="flex items-center justify-center px-2">
        <Circle size={4} className="fill-gray-300 text-gray-300 dark:fill-gray-600 dark:text-gray-600" />
      </div>

      {/* 字段值编辑器 */}
      <div className="flex-1 min-w-0">
        {renderValueEditor()}
      </div>
    </div>
  );
};

export default TanaStyleFieldRow;
