'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { 
  Plus, Sparkles, Loader2, Type, Hash, Calendar, List, Link2, Cpu,
  X, GripVertical, ChevronDown, AlertCircle, Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Supertag, FieldDefinition, FieldType } from '@/types';
import { useSupertagStore } from '@/stores/supertagStore';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SchemaFieldListProps {
  tag: Supertag;
}

// 字段类型配置 (v3.4: 新增 AI 字段类型)
const FIELD_TYPES: { value: FieldType; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'text', label: '文本', icon: <Type size={12} />, color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400' },
  { value: 'number', label: '数字', icon: <Hash size={12} />, color: 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400' },
  { value: 'date', label: '日期', icon: <Calendar size={12} />, color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400' },
  { value: 'select', label: '单选', icon: <List size={12} />, color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400' },
  { value: 'reference', label: '引用', icon: <Link2 size={12} />, color: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400' },
  { value: 'ai_text', label: 'AI 文本', icon: <Cpu size={12} />, color: 'bg-pink-100 text-pink-600 dark:bg-pink-900/40 dark:text-pink-400' },
  { value: 'ai_select', label: 'AI 选项', icon: <Cpu size={12} />, color: 'bg-pink-100 text-pink-600 dark:bg-pink-900/40 dark:text-pink-400' },
];

// 类型选择下拉菜单组件 - 使用 Portal 防止溢出
interface TypeDropdownProps {
  currentType: FieldType;
  onTypeChange: (type: FieldType) => void;
}

const TypeDropdown: React.FC<TypeDropdownProps> = ({ currentType, onTypeChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  const currentTypeConfig = FIELD_TYPES.find(t => t.value === currentType) || FIELD_TYPES[0];
  
  // 计算菜单位置
  const calculatePosition = useCallback(() => {
    if (!buttonRef.current || typeof window === 'undefined') return;
    
    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 128;
    const menuHeight = FIELD_TYPES.length * 30 + 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let top = rect.bottom + 4;
    let left = rect.left;
    
    if (left + menuWidth > viewportWidth - 8) {
      left = rect.right - menuWidth;
    }
    
    if (left < 8) {
      left = 8;
    }
    
    if (top + menuHeight > viewportHeight - 8) {
      top = rect.top - menuHeight - 4;
    }
    
    setMenuPosition({ top, left });
  }, []);
  
  useEffect(() => {
    if (isOpen) {
      calculatePosition();
      window.addEventListener('scroll', calculatePosition, true);
      window.addEventListener('resize', calculatePosition);
      return () => {
        window.removeEventListener('scroll', calculatePosition, true);
        window.removeEventListener('resize', calculatePosition);
      };
    }
  }, [isOpen, calculatePosition]);
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors",
          currentTypeConfig.color,
          "hover:opacity-80 cursor-pointer"
        )}
      >
        {currentTypeConfig.icon}
        <span>{currentTypeConfig.label}</span>
        <ChevronDown size={10} className={cn("ml-auto transition-transform", isOpen && "rotate-180")} />
      </button>
      
      {isOpen && typeof document !== 'undefined' && (
        <div 
          className="fixed w-32 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-[9999]"
          style={{ top: menuPosition.top, left: menuPosition.left }}
        >
          {FIELD_TYPES.map((type) => (
            <button
              key={type.value}
              onClick={() => {
                onTypeChange(type.value);
                setIsOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 text-xs transition-colors",
                currentType === type.value
                  ? cn(type.color)
                  : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              )}
            >
              {type.icon}
              <span>{type.label}</span>
              {currentType === type.value && <Check size={10} className="ml-auto" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// 单选选项编辑器组件
interface SelectOptionsEditorProps {
  options: string[];
  onOptionsChange: (options: string[]) => void;
}

const SelectOptionsEditor: React.FC<SelectOptionsEditorProps> = ({ options, onOptionsChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [editingOptions, setEditingOptions] = useState<string[]>(options);
  const [newOption, setNewOption] = useState('');
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const editorRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const calculatePosition = useCallback(() => {
    if (!buttonRef.current || typeof window === 'undefined') return;
    
    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 256;
    const menuHeight = 250;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let top = rect.bottom + 4;
    let left = rect.left;
    
    if (left + menuWidth > viewportWidth - 8) {
      left = viewportWidth - menuWidth - 8;
    }
    
    if (left < 8) {
      left = 8;
    }
    
    if (top + menuHeight > viewportHeight - 8) {
      top = rect.top - menuHeight - 4;
    }
    
    setMenuPosition({ top, left });
  }, []);
  
  useEffect(() => {
    if (isOpen) {
      calculatePosition();
      window.addEventListener('scroll', calculatePosition, true);
      window.addEventListener('resize', calculatePosition);
      return () => {
        window.removeEventListener('scroll', calculatePosition, true);
        window.removeEventListener('resize', calculatePosition);
      };
    }
  }, [isOpen, calculatePosition]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (editorRef.current && !editorRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        if (JSON.stringify(editingOptions) !== JSON.stringify(options)) {
          onOptionsChange(editingOptions.filter(o => o.trim()));
        }
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, editingOptions, options, onOptionsChange]);

  useEffect(() => {
    if (isOpen) {
      setEditingOptions(options);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, options]);

  const handleAddOption = () => {
    if (newOption.trim() && !editingOptions.includes(newOption.trim())) {
      const updated = [...editingOptions, newOption.trim()];
      setEditingOptions(updated);
      setNewOption('');
      onOptionsChange(updated);
    }
  };

  const handleRemoveOption = (index: number) => {
    const updated = editingOptions.filter((_, i) => i !== index);
    setEditingOptions(updated);
    onOptionsChange(updated);
  };

  const handleUpdateOption = (index: number, value: string) => {
    const updated = [...editingOptions];
    updated[index] = value;
    setEditingOptions(updated);
  };

  const handleBlurOption = (index: number) => {
    const cleaned = editingOptions.filter(o => o.trim());
    if (JSON.stringify(cleaned) !== JSON.stringify(options)) {
      onOptionsChange(cleaned);
    }
  };

  return (
    <div ref={editorRef} className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer truncate max-w-full text-left"
      >
        {options.length} 个选项
      </button>

      {isOpen && typeof document !== 'undefined' && (
        <div 
          className="fixed w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3 z-[9999]"
          style={{ top: menuPosition.top, left: menuPosition.left }}
        >
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            选项列表
          </div>
          
          <div className="space-y-1.5 max-h-40 overflow-auto mb-2">
            {editingOptions.map((opt, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center text-[10px] text-purple-600 dark:text-purple-400">
                  {index + 1}
                </div>
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => handleUpdateOption(index, e.target.value)}
                  onBlur={() => handleBlurOption(index)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleBlurOption(index);
                      inputRef.current?.focus();
                    }
                  }}
                  className="flex-1 px-2 py-1 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded outline-none focus:border-purple-400"
                />
                <button
                  onClick={() => handleRemoveOption(index)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <input
              ref={inputRef}
              type="text"
              value={newOption}
              onChange={(e) => setNewOption(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddOption();
                }
              }}
              placeholder="添加新选项..."
              className="flex-1 px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded outline-none focus:border-purple-400"
            />
            <button
              onClick={handleAddOption}
              disabled={!newOption.trim()}
              className="px-2 py-1.5 text-xs bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400 rounded hover:bg-purple-200 dark:hover:bg-purple-900/60 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// 引用目标选择器组件
interface ReferenceTargetSelectorProps {
  targetTagId: string | undefined;
  multiple: boolean | undefined;
  supertags: Record<string, Supertag>;
  currentTagId: string;
  onTargetChange: (targetTagId: string) => void;
  onMultipleChange: (multiple: boolean) => void;
}

const ReferenceTargetSelector: React.FC<ReferenceTargetSelectorProps> = ({
  targetTagId,
  multiple,
  supertags,
  currentTagId,
  onTargetChange,
  onMultipleChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const selectorRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  const targetTag = targetTagId ? supertags[targetTagId] : null;
  const needsTarget = !targetTagId;

  const calculatePosition = useCallback(() => {
    if (!buttonRef.current || typeof window === 'undefined') return;
    
    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 192;
    const menuHeight = 240;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let top = rect.bottom + 4;
    let left = rect.left;
    
    if (left + menuWidth > viewportWidth - 8) {
      left = viewportWidth - menuWidth - 8;
    }
    
    if (left < 8) {
      left = 8;
    }
    
    if (top + menuHeight > viewportHeight - 8) {
      top = rect.top - menuHeight - 4;
    }
    
    setMenuPosition({ top, left });
  }, []);
  
  useEffect(() => {
    if (isOpen) {
      calculatePosition();
      window.addEventListener('scroll', calculatePosition, true);
      window.addEventListener('resize', calculatePosition);
      return () => {
        window.removeEventListener('scroll', calculatePosition, true);
        window.removeEventListener('resize', calculatePosition);
      };
    }
  }, [isOpen, calculatePosition]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div ref={selectorRef} className="flex items-center gap-2">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors max-w-full truncate",
          needsTarget
            ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 animate-pulse border border-red-300 dark:border-red-700"
            : "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50"
        )}
      >
        <span>→</span>
        <span className="truncate">{targetTag ? `#${targetTag.name}` : '选择目标'}</span>
        {needsTarget && <span className="text-red-500 flex-shrink-0">*</span>}
      </button>

      <button
        onClick={() => onMultipleChange(!multiple)}
        className={cn(
          "flex items-center gap-1 px-1.5 py-1 rounded text-[10px] transition-colors",
          multiple
            ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300"
            : "bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600"
        )}
        title={multiple ? "已启用多选" : "启用多选"}
      >
        <List size={10} />
        <span>多选</span>
      </button>

      {isOpen && typeof document !== 'undefined' && (
        <div 
          className="fixed w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 max-h-60 overflow-auto z-[9999]"
          style={{ top: menuPosition.top, left: menuPosition.left }}
        >
          <div className="text-xs text-gray-500 px-2 py-1 mb-1 border-b border-gray-100 dark:border-gray-700">
            选择引用的目标标签
          </div>
          {Object.values(supertags)
            .filter(t => t.id !== currentTagId && t.status !== 'deprecated')
            .map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  onTargetChange(t.id);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 text-xs transition-colors",
                  targetTagId === t.id
                    ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                    : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                )}
              >
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                <span className="truncate">#{t.name}</span>
                {targetTagId === t.id && <Check size={10} className="ml-auto flex-shrink-0" />}
              </button>
            ))}
        </div>
      )}
    </div>
  );
};

// 可排序的字段行组件 (v3.4: 移除继承相关逻辑)
interface SortableFieldRowProps {
  field: FieldDefinition;
  tag: Supertag;
  supertags: Record<string, Supertag>;
  onTypeChange: (fieldId: string, type: FieldType) => void;
  onTargetTagChange: (fieldId: string, targetTagId: string) => void;
  onMultipleChange: (fieldId: string, multiple: boolean) => void;
  onOptionsChange: (fieldId: string, options: string[]) => void;
  onDelete: (fieldId: string) => void;
  isDragOverlay?: boolean;
}

const SortableFieldRow: React.FC<SortableFieldRowProps> = ({
  field,
  tag,
  supertags,
  onTypeChange,
  onTargetTagChange,
  onMultipleChange,
  onOptionsChange,
  onDelete,
  isDragOverlay = false,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isAIField = field.type === 'ai_text' || field.type === 'ai_select';

  const rowClasses = cn(
    "grid grid-cols-[24px_1fr_90px_1fr_56px] gap-2 px-3 py-2 items-center group transition-all",
    isDragging && "opacity-30",
    isDragOverlay && "bg-white dark:bg-gray-800 shadow-xl rounded-lg border-2 border-blue-400",
    isAIField 
      ? "bg-pink-50/50 dark:bg-pink-900/10" 
      : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
  );

  return (
    <div ref={setNodeRef} style={style} className={rowClasses}>
      {/* 拖拽手柄 */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400"
      >
        <GripVertical size={14} />
      </div>

      {/* 字段名 */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm font-medium truncate text-gray-700 dark:text-gray-300">
          {field.name}
        </span>
        {isAIField && (
          <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] rounded bg-pink-100 dark:bg-pink-900/40 text-pink-600 dark:text-pink-300">
            AI
          </span>
        )}
      </div>

      {/* 类型选择 */}
      <TypeDropdown
        currentType={field.type}
        onTypeChange={(type) => onTypeChange(field.id, type)}
      />

      {/* 配置项 */}
      <div className="min-w-0">
        {field.type === 'reference' && (
          <ReferenceTargetSelector
            targetTagId={field.targetTagId}
            multiple={field.multiple}
            supertags={supertags}
            currentTagId={tag.id}
            onTargetChange={(targetId) => onTargetTagChange(field.id, targetId)}
            onMultipleChange={(multiple) => onMultipleChange(field.id, multiple)}
          />
        )}
        {(field.type === 'select' || field.type === 'ai_select') && (
          <SelectOptionsEditor
            options={field.options || []}
            onOptionsChange={(opts) => onOptionsChange(field.id, opts)}
          />
        )}
        {isAIField && field.aiConfig && (
          <span className="text-xs text-pink-500">
            {field.aiConfig.aiType === 'extraction' ? '信息提取' : 
             field.aiConfig.aiType === 'summarization' ? '内容摘要' : 
             field.aiConfig.aiType === 'classification' ? '分类识别' : '自定义'}
          </span>
        )}
        {field.type !== 'reference' && field.type !== 'select' && field.type !== 'ai_select' && !isAIField && (
          <span className="text-xs text-gray-400">—</span>
        )}
      </div>

      {/* 删除按钮 */}
      <div className="flex justify-end">
        <button
          onClick={() => onDelete(field.id)}
          className="p-1 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
          title="删除字段"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

/**
 * Schema 字段列表组件 (v3.4)
 * 移除继承字段标识，新增 AI 字段类型展示
 */
const SchemaFieldList: React.FC<SchemaFieldListProps> = ({ tag }) => {
  const [isAddingField, setIsAddingField] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const supertags = useSupertagStore((state) => state.supertags);

  // 从 store 获取最新的 tag 数据
  const currentTag = supertags[tag.id] || tag;
  const fields = currentTag.fieldDefinitions || [];

  // 拖拽传感器
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // 行内添加新字段 - 当前为只读模式，此功能已禁用
  const handleAddFieldInline = useCallback(() => {
    console.warn('[SchemaFieldList] 当前为只读模式，无法添加字段');
  }, []);

  // 更新字段类型 - 当前为只读模式，此功能已禁用
  const handleTypeChange = useCallback((_fieldId: string, _type: FieldType) => {
    console.warn('[SchemaFieldList] 当前为只读模式，无法更新字段类型');
  }, []);

  // 更新引用目标 - 当前为只读模式，此功能已禁用
  const handleTargetTagChange = useCallback((_fieldId: string, _targetTagId: string) => {
    console.warn('[SchemaFieldList] 当前为只读模式，无法更新引用目标');
  }, []);

  // 更新引用多选 - 当前为只读模式，此功能已禁用
  const handleMultipleChange = useCallback((_fieldId: string, _multiple: boolean) => {
    console.warn('[SchemaFieldList] 当前为只读模式，无法更新多选设置');
  }, []);

  // 更新选项 - 当前为只读模式，此功能已禁用
  const handleOptionsChange = useCallback((_fieldId: string, _options: string[]) => {
    console.warn('[SchemaFieldList] 当前为只读模式，无法更新选项');
  }, []);

  // 删除字段 - 当前为只读模式，此功能已禁用
  const handleDelete = useCallback((_fieldId: string) => {
    console.warn('[SchemaFieldList] 当前为只读模式，无法删除字段');
  }, []);

  // 拖拽开始
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  // 拖拽结束 - 当前为只读模式，此功能已禁用
  const handleDragEnd = useCallback((_event: DragEndEvent) => {
    setActiveId(null);
    console.warn('[SchemaFieldList] 当前为只读模式，无法调整字段顺序');
  }, []);

  // AI 生成字段 - 当前为只读模式，此功能已禁用
  const handleAIGenerate = useCallback(async () => {
    setIsGenerating(true);
    setGenerationError('当前为只读模式，无法使用 AI 生成字段');
    setTimeout(() => setIsGenerating(false), 500);
  }, []);

  const activeField = activeId ? fields.find(f => f.id === activeId) : null;

  return (
    <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <Type size={14} />
          字段定义 (Schema)
        </h3>
        
        {/* AI 建议入口 */}
        <button
          onClick={handleAIGenerate}
          disabled={isGenerating}
          className={cn(
            "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all",
            isGenerating
              ? "bg-purple-100 dark:bg-purple-900/30 text-purple-400 cursor-not-allowed"
              : "text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
          )}
        >
          {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          <span>AI 建议</span>
        </button>
      </div>

      {/* AI 生成错误提示 */}
      {generationError && (
        <div className="mb-3 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
          <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-red-600 dark:text-red-400">{generationError}</p>
          </div>
          <button
            onClick={() => setGenerationError(null)}
            className="p-0.5 text-red-400 hover:text-red-600 dark:hover:text-red-300"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* 字段表格 */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        {/* 表头 */}
        <div className="grid grid-cols-[24px_1fr_90px_1fr_56px] gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 font-medium border-b border-gray-200 dark:border-gray-700">
          <div></div>
          <div>字段名</div>
          <div>类型</div>
          <div>配置</div>
          <div></div>
        </div>

        {/* 字段列表 */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={fields.map(f => f.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {fields.map((field) => (
                <SortableFieldRow
                  key={field.id}
                  field={field}
                  tag={currentTag}
                  supertags={supertags}
                  onTypeChange={handleTypeChange}
                  onTargetTagChange={handleTargetTagChange}
                  onMultipleChange={handleMultipleChange}
                  onOptionsChange={handleOptionsChange}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </SortableContext>

          {/* 拖拽预览层 */}
          <DragOverlay>
            {activeField && (
              <SortableFieldRow
                field={activeField}
                tag={currentTag}
                supertags={supertags}
                onTypeChange={() => {}}
                onTargetTagChange={() => {}}
                onMultipleChange={() => {}}
                onOptionsChange={() => {}}
                onDelete={() => {}}
                isDragOverlay
              />
            )}
          </DragOverlay>
        </DndContext>

        {/* 添加字段行 */}
        {isAddingField ? (
          <div className="grid grid-cols-[24px_1fr_90px_1fr_56px] gap-2 px-3 py-2 items-center bg-blue-50 dark:bg-blue-900/20 border-t border-blue-200 dark:border-blue-700">
            <div></div>
            <input
              type="text"
              value={newFieldName}
              onChange={(e) => setNewFieldName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newFieldName.trim()) {
                  handleAddFieldInline();
                }
                if (e.key === 'Escape') {
                  setIsAddingField(false);
                  setNewFieldName('');
                }
              }}
              placeholder="输入字段名，回车创建"
              className="text-sm bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-600 rounded px-2 py-1 outline-none focus:border-blue-500"
              autoFocus
            />
            <span className="text-xs text-gray-400">文本</span>
            <span className="text-xs text-gray-400">创建后配置</span>
            <div className="flex items-center gap-1">
              <button
                onClick={handleAddFieldInline}
                disabled={!newFieldName.trim()}
                className={cn(
                  "p-1 rounded transition-colors",
                  newFieldName.trim()
                    ? "text-green-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                    : "text-gray-300 dark:text-gray-600 cursor-not-allowed"
                )}
                title="确认添加"
              >
                <Check size={16} />
              </button>
              <button
                onClick={() => {
                  setIsAddingField(false);
                  setNewFieldName('');
                }}
                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                title="取消"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsAddingField(true)}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors border-t border-dashed border-gray-200 dark:border-gray-700"
          >
            <div className="w-6"></div>
            <Plus size={14} />
            <span>添加字段</span>
          </button>
        )}
      </div>

      {/* 空状态提示 */}
      {fields.length === 0 && !isAddingField && (
        <div className="text-center py-6 text-gray-400">
          <Type size={20} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">暂无字段定义</p>
          <p className="text-xs mt-1">点击"添加字段"或使用 AI 建议</p>
        </div>
      )}
    </div>
  );
};

export default SchemaFieldList;
