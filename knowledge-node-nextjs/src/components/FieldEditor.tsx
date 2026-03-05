'use client';

import React, { useCallback, useState, useRef, useEffect, useMemo } from 'react';
import { FieldDefinition, Node } from '@/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Hash, List, Circle, CalendarDays, X, AlertCircle, CheckCircle2, Link2, Plus, Sparkles, Loader2, Star, StarHalf, Percent, DollarSign, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNodeStore } from '@/stores/nodeStore';
import ReferenceFieldPill from './ReferenceFieldPill';

// 日期状态类型
type DateStatusType = 'none' | 'overdue' | 'today' | 'soon' | 'normal';

interface DateStatusResult {
  status: DateStatusType;
  label: string;
  className: string;
}

// 获取日期状态
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

interface FieldEditorProps {
  fieldDef: FieldDefinition;
  value: any;
  onChange: (value: any) => void;
  nodeId?: string;
  tagId?: string;
  className?: string;
  /** AI 字段手动触发回调 */
  onTriggerAI?: (fieldId: string) => Promise<void>;
}

// 获取数字格式化显示
const formatNumber = (value: number | string | undefined | null, format?: string): string => {
  if (value === undefined || value === null || value === '') return '';
  const num = Number(value);
  if (isNaN(num)) return String(value);
  
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(num);
    case 'percent':
      return new Intl.NumberFormat('zh-CN', { style: 'percent', minimumFractionDigits: 0 }).format(num / 100);
    case 'rating':
      return String(num); // rating 用星级渲染
    default:
      return String(num);
  }
};

// 星级评分渲染组件
const RatingDisplay: React.FC<{ value: number; max?: number }> = ({ value, max = 5 }) => {
  const fullStars = Math.floor(value);
  const hasHalf = value % 1 >= 0.5;
  const emptyStars = max - fullStars - (hasHalf ? 1 : 0);
  
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array(fullStars).fill(null).map((_, i) => (
        <Star key={`full-${i}`} size={14} className="fill-yellow-400 text-yellow-400" />
      ))}
      {hasHalf && <StarHalf size={14} className="fill-yellow-400 text-yellow-400" />}
      {Array(emptyStars).fill(null).map((_, i) => (
        <Star key={`empty-${i}`} size={14} className="text-gray-300" />
      ))}
    </span>
  );
};

// 获取字段类型对应的图标
const getFieldIcon = (type: string) => {
  switch (type) {
    case 'date':
      return <CalendarDays size={14} className="text-gray-400" />;
    case 'number':
      return <Hash size={14} className="text-gray-400" />;
    case 'select':
      return <List size={14} className="text-gray-400" />;
    case 'multi-select':
      return <ListChecks size={14} className="text-gray-400" />;
    case 'reference':
      return <Link2 size={14} className="text-gray-400" />;
    case 'ai_text':
    case 'ai_select':
      return <Sparkles size={14} className="text-pink-400" />;
    case 'text':
    default:
      return <Circle size={14} className="text-gray-400" />;
  }
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

const FieldEditor: React.FC<FieldEditorProps> = ({ fieldDef, value, onChange, className, nodeId, tagId, onTriggerAI }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [selectOpen, setSelectOpen] = useState(false);
  const [multiSelectOpen, setMultiSelectOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [refSearch, setRefSearch] = useState('');
  const [refPopoverOpen, setRefPopoverOpen] = useState(false);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const selectMenuRef = useRef<HTMLDivElement>(null);
  const nodes = useNodeStore((s) => s.nodes);

  const referenceCandidates = useMemo(() => {
    if (fieldDef.type !== 'reference') return [];
    
    // 如果有 targetTagId，则筛选该标签下的节点；否则显示所有有内容的节点
    let list = Object.values(nodes).filter((n) => {
      if (n.id === nodeId) return false; // 排除自己
      if (!n.content?.trim()) return false; // 排除空节点
      if (fieldDef.targetTagId) {
        return n.supertagId === fieldDef.targetTagId || n.tags?.includes(fieldDef.targetTagId);
      }
      return true; // 没有指定 targetTagId 时显示所有有内容的节点
    });
    
    if (!refSearch.trim()) return list.slice(0, 30);
    const q = refSearch.trim().toLowerCase();
    return list.filter((n) => (n.content || '').toLowerCase().includes(q)).slice(0, 30);
  }, [nodes, fieldDef.type, fieldDef.targetTagId, nodeId, refSearch]);

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

  const handleChange = useCallback((newValue: any) => {
    onChange(newValue);
  }, [onChange]);

  // 处理选择项
  const handleSelectOption = useCallback((option: string) => {
    if (option === '__clear__') {
      handleChange('');
    } else {
      handleChange(option);
    }
    setSelectOpen(false);
  }, [handleChange]);

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
  }, [getOptions, selectedIndex, handleSelectOption]);

  const renderFieldValue = () => {
    switch (fieldDef.type) {
      case 'text':
        if (isEditing) {
          return (
            <input
              type="text"
              autoFocus
              value={value || ''}
              onChange={(e) => handleChange(e.target.value)}
              onBlur={() => setIsEditing(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') {
                  setIsEditing(false);
                }
              }}
              className="w-full bg-transparent border-none outline-none text-sm text-gray-700"
              placeholder="Empty"
            />
          );
        }
        return (
          <span 
            onClick={() => setIsEditing(true)}
            className={cn(
              "cursor-text",
              value ? "text-gray-700" : "text-gray-400"
            )}
          >
            {value || 'Empty'}
          </span>
        );

      case 'number':
        if (isEditing) {
          return (
            <input
              type="number"
              autoFocus
              value={value || ''}
              onChange={(e) => handleChange(e.target.value ? Number(e.target.value) : '')}
              onBlur={() => setIsEditing(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') {
                  setIsEditing(false);
                }
              }}
              className="w-full bg-transparent border-none outline-none text-sm text-gray-700"
              placeholder="Empty"
            />
          );
        }
        // 格式化显示
        const numFormat = fieldDef.format;
        if (numFormat === 'rating' && value !== undefined && value !== '') {
          return (
            <span 
              onClick={() => setIsEditing(true)}
              className="cursor-text inline-flex items-center gap-1"
            >
              <RatingDisplay value={Number(value)} />
            </span>
          );
        }
        return (
          <span 
            onClick={() => setIsEditing(true)}
            className={cn(
              "cursor-text inline-flex items-center gap-1",
              value !== undefined && value !== '' ? "text-gray-700" : "text-gray-400"
            )}
          >
            {numFormat === 'currency' && value !== undefined && value !== '' && (
              <DollarSign size={12} className="text-green-500" />
            )}
            {numFormat === 'percent' && value !== undefined && value !== '' && (
              <Percent size={12} className="text-blue-500" />
            )}
            {value !== undefined && value !== '' ? formatNumber(Number(value), numFormat) : 'Empty'}
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
              onChange={(e) => {
                handleChange(e.target.value);
              }}
              className="absolute opacity-0 w-0 h-0 pointer-events-none"
            />
            <button
              onClick={() => {
                dateInputRef.current?.showPicker();
              }}
              className={cn(
                "flex items-center gap-1.5 hover:bg-gray-100 rounded px-1 -mx-1 py-0.5",
                value ? "text-gray-700" : "text-gray-400",
                dateStatus.className
              )}
            >
              <CalendarDays size={12} />
              <span>{value ? formatDate(value) : 'Empty'}</span>
              {/* 显示相对日期和状态提示 */}
              {value && dateStatus.status !== 'normal' && dateStatus.status !== 'none' && (
                <span className={cn(
                  "text-xs px-1.5 py-0.5 rounded-full ml-1",
                  dateStatus.status === 'overdue' && "bg-red-100 text-red-600",
                  dateStatus.status === 'today' && "bg-orange-100 text-orange-600",
                  dateStatus.status === 'soon' && "bg-yellow-100 text-yellow-600"
                )}>
                  {dateStatus.status === 'overdue' && <AlertCircle size={10} className="inline mr-0.5" />}
                  {dateStatus.label}
                </span>
              )}
            </button>
            {value && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleChange('');
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
                  "text-left rounded px-1.5 py-0.5 -mx-1 transition-colors text-sm",
                  value ? "text-gray-700 hover:bg-gray-100" : "text-gray-400 hover:bg-gray-100"
                )}
              >
                {value || 'Select option'}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1" align="start" ref={selectMenuRef} onKeyDown={handleSelectKeyDown}>
              <div className="space-y-0.5">
                {options.map((option, index) => {
                  const isSelected = index === selectedIndex;
                  const isCurrentValue = value === option;
                  return (
                    <button
                      key={option}
                      onClick={() => handleSelectOption(option)}
                      className={cn(
                        "w-full text-left px-2 py-1.5 text-sm rounded transition-colors flex items-center text-gray-700",
                        isSelected ? "bg-gray-100" : "hover:bg-gray-50"
                      )}
                    >
                      <span className="flex-1">{option}</span>
                      {isCurrentValue && <CheckCircle2 size={14} className="text-green-500 ml-2" />}
                    </button>
                  );
                })}
                {value && (
                  <>
                    <div className="border-t my-1" />
                    <button
                      onClick={() => handleSelectOption('__clear__')}
                      className={cn(
                        "w-full text-left px-2 py-1.5 text-sm rounded transition-colors text-gray-500",
                        selectedIndex === options.length ? "bg-gray-100" : "hover:bg-gray-100"
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
        const refValue = value && typeof value === 'object' && 'nodeId' in value ? value as { nodeId: string; title: string } : null;
        const refValues = fieldDef.multiple && Array.isArray(value) ? value as Array<{ nodeId: string; title: string }> : refValue ? [refValue] : [];
        
        return (
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* 已选择的引用 - 使用 Pill 组件 */}
            {refValues.map((ref, index) => (
              <ReferenceFieldPill
                key={ref.nodeId}
                nodeId={ref.nodeId}
                title={ref.title}
                removable
                onRemove={() => {
                  if (fieldDef.multiple) {
                    const next = refValues.filter((_, i) => i !== index);
                    handleChange(next.length > 0 ? next : []);
                  } else {
                    handleChange(undefined);
                  }
                }}
              />
            ))}
            
            {/* 添加引用按钮 - Popover 方式 */}
            <Popover 
              open={refPopoverOpen} 
              onOpenChange={(open) => {
                setRefPopoverOpen(open);
                if (open) {
                  setRefSearch(''); // 打开时清空搜索
                }
              }}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs cursor-pointer",
                    "border border-dashed transition-colors",
                    refValues.length > 0
                      ? "border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:border-blue-400 hover:text-blue-500"
                      : "border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:bg-gray-50"
                  )}
                >
                  <Plus size={10} />
                  <span>{refValues.length > 0 ? '添加' : '选择节点'}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="start">
                <input
                  type="text"
                  value={refSearch}
                  onChange={(e) => setRefSearch(e.target.value)}
                  placeholder="搜索节点…"
                  className="w-full px-2 py-1.5 text-sm border rounded mb-2"
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
                            handleChange(next);
                          } else {
                            handleChange({ nodeId: n.id, title: (n.content || '').trim() || '(无标题)' });
                            setRefPopoverOpen(false);
                          }
                        }}
                        className={cn(
                          "w-full text-left px-2 py-1.5 text-sm rounded flex items-center gap-2",
                          isSelected ? "bg-blue-100 text-blue-800" : "hover:bg-gray-100"
                        )}
                      >
                        <span className="flex-1 truncate">{n.content || '(无标题)'}</span>
                        {isSelected && <CheckCircle2 size={14} className="text-blue-600" />}
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        );
      }

      // multi-select: 多选下拉
      case 'multi-select': {
        const multiOptions = fieldDef.options || [];
        const selectedValues: string[] = Array.isArray(value) ? value : value ? [value] : [];
        
        return (
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* 已选择的标签 */}
            {selectedValues.map((v, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300"
              >
                {v}
                <button
                  onClick={() => {
                    const next = selectedValues.filter((_, i) => i !== index);
                    handleChange(next);
                  }}
                  className="hover:text-red-500 transition-colors"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
            
            {/* 添加选项按钮 */}
            <Popover open={multiSelectOpen} onOpenChange={setMultiSelectOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs cursor-pointer",
                    "border border-dashed transition-colors",
                    selectedValues.length > 0
                      ? "border-violet-300 dark:border-violet-600 text-violet-400 dark:text-violet-500 hover:border-violet-500 hover:text-violet-600"
                      : "border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:bg-gray-50"
                  )}
                >
                  <Plus size={10} />
                  <span>{selectedValues.length > 0 ? '添加' : '选择选项'}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-1" align="start">
                <div className="space-y-0.5">
                  {multiOptions.map((option) => {
                    const isChecked = selectedValues.includes(option);
                    return (
                      <button
                        key={option}
                        onClick={() => {
                          if (isChecked) {
                            handleChange(selectedValues.filter((v) => v !== option));
                          } else {
                            handleChange([...selectedValues, option]);
                          }
                        }}
                        className={cn(
                          "w-full text-left px-2 py-1.5 text-sm rounded transition-colors flex items-center gap-2",
                          isChecked ? "bg-violet-100 text-violet-800" : "hover:bg-gray-50 text-gray-700"
                        )}
                      >
                        <span className="flex-1">{option}</span>
                        {isChecked && <CheckCircle2 size={14} className="text-violet-600" />}
                      </button>
                    );
                  })}
                  {selectedValues.length > 0 && (
                    <>
                      <div className="border-t my-1" />
                      <button
                        onClick={() => handleChange([])}
                        className="w-full text-left px-2 py-1.5 text-sm rounded transition-colors text-gray-500 hover:bg-gray-100"
                      >
                        <X size={12} className="inline mr-2" />
                        清除所有
                      </button>
                    </>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        );
      }

      // ai_text: AI 文本字段
      case 'ai_text': {
        const handleTriggerAI = async () => {
          if (!onTriggerAI || isAIProcessing) return;
          setIsAIProcessing(true);
          try {
            await onTriggerAI(fieldDef.id);
          } finally {
            setIsAIProcessing(false);
          }
        };

        return (
          <div className="flex items-center gap-2 group/ai">
            {/* 显示值或占位符 */}
            <span className={cn(
              "flex-1 text-sm",
              value ? "text-gray-700" : "text-gray-400 italic"
            )}>
              {value || '等待 AI 生成...'}
            </span>
            
            {/* AI 触发按钮 */}
            <button
              onClick={handleTriggerAI}
              disabled={isAIProcessing || !onTriggerAI}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-all",
                isAIProcessing 
                  ? "bg-pink-100 text-pink-600 cursor-wait"
                  : "bg-pink-50 text-pink-500 hover:bg-pink-100 hover:text-pink-600",
                "opacity-0 group-hover/ai:opacity-100",
                value && "opacity-50 group-hover/ai:opacity-100"
              )}
              title="点击触发 AI 生成"
            >
              {isAIProcessing ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  <span>生成中</span>
                </>
              ) : (
                <>
                  <Sparkles size={12} />
                  <span>{value ? '重新生成' : '生成'}</span>
                </>
              )}
            </button>
          </div>
        );
      }

      // ai_select: AI 选项字段
      case 'ai_select': {
        const aiOptions = fieldDef.aiConfig?.options || fieldDef.options || [];
        
        const handleTriggerAI = async () => {
          if (!onTriggerAI || isAIProcessing) return;
          setIsAIProcessing(true);
          try {
            await onTriggerAI(fieldDef.id);
          } finally {
            setIsAIProcessing(false);
          }
        };

        return (
          <div className="flex items-center gap-2 group/ai">
            {/* 显示当前值 */}
            <span className={cn(
              "px-2 py-0.5 rounded-full text-xs",
              value 
                ? "bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300"
                : "text-gray-400 italic"
            )}>
              {value || '等待 AI 判定...'}
            </span>
            
            {/* 可选值预览 */}
            {aiOptions.length > 0 && !value && (
              <span className="text-[10px] text-gray-400">
                ({aiOptions.join(' / ')})
              </span>
            )}
            
            {/* AI 触发按钮 */}
            <button
              onClick={handleTriggerAI}
              disabled={isAIProcessing || !onTriggerAI}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-all",
                isAIProcessing 
                  ? "bg-pink-100 text-pink-600 cursor-wait"
                  : "bg-pink-50 text-pink-500 hover:bg-pink-100 hover:text-pink-600",
                "opacity-0 group-hover/ai:opacity-100",
                value && "opacity-50 group-hover/ai:opacity-100"
              )}
              title="点击触发 AI 判定"
            >
              {isAIProcessing ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  <span>判定中</span>
                </>
              ) : (
                <>
                  <Sparkles size={12} />
                  <span>{value ? '重新判定' : '判定'}</span>
                </>
              )}
            </button>
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className={cn(
      "grid grid-cols-[160px_auto_1fr] items-center py-1.5 px-3 hover:bg-white/60 rounded group",
      className
    )}>
      {/* 字段图标和名称 */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        {getFieldIcon(fieldDef.type)}
        <span className="font-medium">{fieldDef.name}</span>
      </div>
      
      {/* 分隔符 bullet */}
      <div className="flex items-center justify-center px-3">
        <Circle size={4} className="fill-gray-300 text-gray-300" />
      </div>
      
      {/* 字段值 */}
      <div className="text-sm">
        {renderFieldValue()}
      </div>
    </div>
  );
};

export default FieldEditor;
