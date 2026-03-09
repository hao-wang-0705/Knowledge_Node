'use client';

/**
 * InlineEditor - 内联编辑器组件
 * v3.6: 支持文本、数字、日期、选择等字段类型的内联编辑
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { CalendarDays, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FieldDefinition } from '@/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface InlineEditorProps {
  value: unknown;
  onChange: (value: unknown) => void;
  fieldDef?: FieldDefinition;
  nodeId?: string;
  placeholder?: string;
  className?: string;
}

/**
 * 格式化日期显示
 */
function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * 内联编辑器组件
 */
export function InlineEditor({
  value,
  onChange,
  fieldDef,
  nodeId,
  placeholder = '空',
  className,
}: InlineEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<string>('');
  const [selectOpen, setSelectOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  
  // 开始编辑
  const startEdit = useCallback(() => {
    setEditValue(value !== undefined && value !== null ? String(value) : '');
    setIsEditing(true);
  }, [value]);
  
  // 确认编辑
  const confirmEdit = useCallback(() => {
    const type = fieldDef?.type || 'text';
    
    if (type === 'number') {
      const num = parseFloat(editValue);
      onChange(isNaN(num) ? '' : num);
    } else {
      onChange(editValue);
    }
    
    setIsEditing(false);
  }, [editValue, fieldDef?.type, onChange]);
  
  // 取消编辑
  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditValue('');
  }, []);
  
  // 聚焦输入框
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);
  
  // 处理键盘事件
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      confirmEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  }, [confirmEdit, cancelEdit]);
  
  // 渲染不同类型的编辑器
  const type = fieldDef?.type || 'text';
  
  // 文本类型
  if (type === 'text' || !fieldDef) {
    if (isEditing) {
      return (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={confirmEdit}
          onKeyDown={handleKeyDown}
          className={cn(
            'w-full bg-transparent border-none outline-none text-sm',
            'focus:ring-1 focus:ring-blue-500 rounded px-1 -mx-1',
            className
          )}
          placeholder={placeholder}
          onClick={(e) => e.stopPropagation()}
        />
      );
    }
    
    return (
      <span
        onClick={(e) => {
          e.stopPropagation();
          startEdit();
        }}
        className={cn(
          'cursor-text hover:bg-gray-100 dark:hover:bg-gray-800 rounded px-1 -mx-1 py-0.5',
          value ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400',
          className
        )}
      >
        {value ? String(value) : placeholder}
      </span>
    );
  }
  
  // 数字类型
  if (type === 'number') {
    if (isEditing) {
      return (
        <input
          ref={inputRef}
          type="number"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={confirmEdit}
          onKeyDown={handleKeyDown}
          className={cn(
            'w-full bg-transparent border-none outline-none text-sm',
            'focus:ring-1 focus:ring-blue-500 rounded px-1 -mx-1',
            className
          )}
          placeholder={placeholder}
          onClick={(e) => e.stopPropagation()}
        />
      );
    }
    
    return (
      <span
        onClick={(e) => {
          e.stopPropagation();
          startEdit();
        }}
        className={cn(
          'cursor-text hover:bg-gray-100 dark:hover:bg-gray-800 rounded px-1 -mx-1 py-0.5',
          value !== undefined && value !== '' ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400',
          className
        )}
      >
        {value !== undefined && value !== '' ? String(value) : placeholder}
      </span>
    );
  }
  
  // 日期类型
  if (type === 'date') {
    const dateValue = value as string | undefined;
    
    return (
      <div className={cn('flex items-center gap-1', className)} onClick={(e) => e.stopPropagation()}>
        <input
          ref={dateInputRef}
          type="date"
          value={dateValue || ''}
          onChange={(e) => onChange(e.target.value)}
          className="absolute opacity-0 w-0 h-0 pointer-events-none"
        />
        <button
          onClick={() => dateInputRef.current?.showPicker()}
          className={cn(
            'flex items-center gap-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded px-1 -mx-1 py-0.5',
            dateValue ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400'
          )}
        >
          <CalendarDays size={12} />
          <span>{dateValue ? formatDate(dateValue) : placeholder}</span>
        </button>
        {dateValue && (
          <button
            onClick={() => onChange('')}
            className="p-0.5 text-gray-400 hover:text-red-500"
          >
            <X size={12} />
          </button>
        )}
      </div>
    );
  }
  
  // 选择类型
  if (type === 'select') {
    const options = fieldDef.options || [];
    const selectValue = value as string | undefined;
    
    return (
      <Popover open={selectOpen} onOpenChange={setSelectOpen}>
        <PopoverTrigger asChild>
          <button
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'text-left rounded px-1.5 py-0.5 -mx-1 text-sm',
              'hover:bg-gray-100 dark:hover:bg-gray-800',
              selectValue ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400',
              className
            )}
          >
            {selectValue || placeholder}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-1" align="start" onClick={(e) => e.stopPropagation()}>
          <div className="space-y-0.5">
            {options.map((option) => (
              <button
                key={option}
                onClick={() => {
                  onChange(option);
                  setSelectOpen(false);
                }}
                className={cn(
                  'w-full text-left px-2 py-1.5 text-sm rounded flex items-center',
                  'hover:bg-gray-100 dark:hover:bg-gray-800',
                  selectValue === option && 'bg-blue-50 dark:bg-blue-900/30'
                )}
              >
                <span className="flex-1">{option}</span>
                {selectValue === option && <Check size={14} className="text-blue-500" />}
              </button>
            ))}
            {selectValue && (
              <>
                <div className="border-t my-1" />
                <button
                  onClick={() => {
                    onChange('');
                    setSelectOpen(false);
                  }}
                  className="w-full text-left px-2 py-1.5 text-sm rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
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
  }
  
  // 多选类型
  if (type === 'multi-select') {
    const options = fieldDef.options || [];
    const selectedValues: string[] = Array.isArray(value) ? value : [];
    
    return (
      <div className={cn('flex items-center gap-1 flex-wrap', className)} onClick={(e) => e.stopPropagation()}>
        {selectedValues.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300"
          >
            {v}
            <button
              onClick={() => onChange(selectedValues.filter((sv) => sv !== v))}
              className="hover:text-red-500"
            >
              <X size={10} />
            </button>
          </span>
        ))}
        <Popover open={selectOpen} onOpenChange={setSelectOpen}>
          <PopoverTrigger asChild>
            <button className="text-xs text-gray-400 hover:text-gray-600 px-1">
              + 添加
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1" align="start">
            <div className="space-y-0.5">
              {options.filter((o) => !selectedValues.includes(o)).map((option) => (
                <button
                  key={option}
                  onClick={() => {
                    onChange([...selectedValues, option]);
                  }}
                  className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  {option}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  }
  
  // 其他类型回退为文本显示
  return (
    <span className={cn('text-gray-500', className)}>
      {value !== undefined && value !== null ? String(value) : placeholder}
    </span>
  );
}

export default InlineEditor;
