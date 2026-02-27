'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { 
  Plus, Sparkles, Loader2, Type, Hash, Calendar, List, Link2, 
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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SchemaFieldListProps {
  tag: Supertag;
}

// 字段类型配置
const FIELD_TYPES: { value: FieldType; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'text', label: '文本', icon: <Type size={12} />, color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400' },
  { value: 'number', label: '数字', icon: <Hash size={12} />, color: 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400' },
  { value: 'date', label: '日期', icon: <Calendar size={12} />, color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400' },
  { value: 'select', label: '单选', icon: <List size={12} />, color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400' },
  { value: 'reference', label: '引用', icon: <Link2 size={12} />, color: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400' },
];

// 类型选择下拉菜单组件 - 使用 Portal 防止溢出
interface TypeDropdownProps {
  currentType: FieldType;
  isInherited: boolean;
  onTypeChange: (type: FieldType) => void;
}

const TypeDropdown: React.FC<TypeDropdownProps> = ({ currentType, isInherited, onTypeChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  const currentTypeConfig = FIELD_TYPES.find(t => t.value === currentType) || FIELD_TYPES[0];
  
  // 计算菜单位置
  const calculatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    
    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 128; // w-32 = 8rem = 128px
    const menuHeight = FIELD_TYPES.length * 30 + 8; // 估算菜单高度
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let top = rect.bottom + 4; // mt-1 = 4px
    let left = rect.left;
    
    // 检查右边界
    if (left + menuWidth > viewportWidth - 8) {
      left = rect.right - menuWidth;
    }
    
    // 检查左边界
    if (left < 8) {
      left = 8;
    }
    
    // 检查底部边界，如果超出则向上弹出
    if (top + menuHeight > viewportHeight - 8) {
      top = rect.top - menuHeight - 4;
    }
    
    setMenuPosition({ top, left });
  }, []);
  
  // 打开时计算位置
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
  
  // 点击外部关闭
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

  if (isInherited) {
    return (
      <div className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium",
        "bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
      )}>
        {currentTypeConfig.icon}
        <span>{currentTypeConfig.label}</span>
      </div>
    );
  }

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

// 单选选项编辑器组件 - 表单模式，使用 fixed 定位防止溢出
interface SelectOptionsEditorProps {
  options: string[];
  isInherited: boolean;
  onOptionsChange: (options: string[]) => void;
}

const SelectOptionsEditor: React.FC<SelectOptionsEditorProps> = ({ options, isInherited, onOptionsChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [editingOptions, setEditingOptions] = useState<string[]>(options);
  const [newOption, setNewOption] = useState('');
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const editorRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 计算菜单位置
  const calculatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    
    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 256; // w-64 = 16rem = 256px
    const menuHeight = 250; // 估算高度
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let top = rect.bottom + 4;
    let left = rect.left;
    
    // 检查右边界
    if (left + menuWidth > viewportWidth - 8) {
      left = viewportWidth - menuWidth - 8;
    }
    
    // 检查左边界
    if (left < 8) {
      left = 8;
    }
    
    // 检查底部边界
    if (top + menuHeight > viewportHeight - 8) {
      top = rect.top - menuHeight - 4;
    }
    
    setMenuPosition({ top, left });
  }, []);
  
  // 打开时计算位置
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

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (editorRef.current && !editorRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        // 关闭时保存
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

  // 打开时同步选项
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
    // 保存更新
    const cleaned = editingOptions.filter(o => o.trim());
    if (JSON.stringify(cleaned) !== JSON.stringify(options)) {
      onOptionsChange(cleaned);
    }
  };

  if (isInherited) {
    return (
      <span className="text-xs text-gray-400 truncate">
        {options.length} 个选项
      </span>
    );
  }

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
          
          {/* 选项列表 */}
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

          {/* 添加新选项 */}
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

// 引用目标选择器组件 - 使用 fixed 定位防止溢出
interface ReferenceTargetSelectorProps {
  targetTagId: string | undefined;
  multiple: boolean | undefined;
  supertags: Record<string, Supertag>;
  currentTagId: string;
  isInherited: boolean;
  onTargetChange: (targetTagId: string) => void;
  onMultipleChange: (multiple: boolean) => void;
}

const ReferenceTargetSelector: React.FC<ReferenceTargetSelectorProps> = ({
  targetTagId,
  multiple,
  supertags,
  currentTagId,
  isInherited,
  onTargetChange,
  onMultipleChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const selectorRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  const targetTag = targetTagId ? supertags[targetTagId] : null;
  const needsTarget = !targetTagId;

  // 计算菜单位置
  const calculatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    
    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 192; // w-48 = 12rem = 192px
    const menuHeight = 240; // max-h-60 = 15rem = 240px
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let top = rect.bottom + 4;
    let left = rect.left;
    
    // 检查右边界
    if (left + menuWidth > viewportWidth - 8) {
      left = viewportWidth - menuWidth - 8;
    }
    
    // 检查左边界
    if (left < 8) {
      left = 8;
    }
    
    // 检查底部边界
    if (top + menuHeight > viewportHeight - 8) {
      top = rect.top - menuHeight - 4;
    }
    
    setMenuPosition({ top, left });
  }, []);
  
  // 打开时计算位置
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

  // 点击外部关闭
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

  if (isInherited) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-400 truncate">
          <span>→</span>
          <span className="truncate">{targetTag ? `#${targetTag.name}` : '—'}</span>
        </div>
        {multiple && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300">
            多选
          </span>
        )}
      </div>
    );
  }

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

      {/* 多选开关 */}
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
            .filter(t => t.id !== currentTagId && !t.isSystem)
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

// 可排序的字段行组件
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

  const isInherited = field.inherited;

  const rowClasses = cn(
    "grid grid-cols-[24px_1fr_90px_1fr_56px] gap-2 px-3 py-2 items-center group transition-all",
    isDragging && "opacity-30",
    isDragOverlay && "bg-white dark:bg-gray-800 shadow-xl rounded-lg border-2 border-blue-400",
    isInherited 
      ? "bg-purple-50/50 dark:bg-purple-900/10" 
      : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
  );

  return (
    <div ref={setNodeRef} style={style} className={rowClasses}>
      {/* 拖拽手柄 */}
      <div
        {...attributes}
        {...listeners}
        className={cn(
          "cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400",
          isInherited && "opacity-30 cursor-not-allowed"
        )}
      >
        <GripVertical size={14} />
      </div>

      {/* 字段名 */}
      <div className="flex items-center gap-2 min-w-0">
        <span className={cn(
          "text-sm font-medium truncate",
          isInherited ? "text-purple-700 dark:text-purple-300" : "text-gray-700 dark:text-gray-300"
        )}>
          {field.name}
        </span>
        {isInherited && (
          <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] rounded bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300">
            继承
          </span>
        )}
      </div>

      {/* 类型选择 - 使用自定义下拉组件 */}
      <TypeDropdown
        currentType={field.type}
        isInherited={isInherited || false}
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
            isInherited={isInherited || false}
            onTargetChange={(targetId) => onTargetTagChange(field.id, targetId)}
            onMultipleChange={(multiple) => onMultipleChange(field.id, multiple)}
          />
        )}
        {field.type === 'select' && (
          <SelectOptionsEditor
            options={field.options || []}
            isInherited={isInherited || false}
            onOptionsChange={(opts) => onOptionsChange(field.id, opts)}
          />
        )}
        {field.type !== 'reference' && field.type !== 'select' && (
          <span className="text-xs text-gray-400">—</span>
        )}
      </div>

      {/* 删除按钮 */}
      <div className="flex justify-end">
        {!isInherited && (
          <button
            onClick={() => onDelete(field.id)}
            className="p-1 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
            title="删除字段"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
};

const SchemaFieldList: React.FC<SchemaFieldListProps> = ({ tag }) => {
  const [isAddingField, setIsAddingField] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const supertags = useSupertagStore((state) => state.supertags);
  const addFieldDefinition = useSupertagStore((state) => state.addFieldDefinition);
  const updateFieldDefinition = useSupertagStore((state) => state.updateFieldDefinition);
  const removeFieldDefinition = useSupertagStore((state) => state.removeFieldDefinition);
  const updateSupertag = useSupertagStore((state) => state.updateSupertag);
  const getResolvedFieldDefinitions = useSupertagStore((state) => state.getResolvedFieldDefinitions);

  // 从 store 获取最新的 tag 数据，确保响应式更新
  const currentTag = supertags[tag.id] || tag;
  
  // 获取父标签的字段定义（用于触发继承字段的更新）
  const parentFieldDefinitions = useMemo(() => {
    if (!currentTag.parentId) return [];
    const parentTag = supertags[currentTag.parentId];
    return parentTag?.fieldDefinitions || [];
  }, [currentTag.parentId, supertags]);

  // 获取合并后的字段（包括继承的）- 依赖于实际的字段数据以实现实时更新
  const resolvedFields = useMemo(() => {
    return getResolvedFieldDefinitions(tag.id) || [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tag.id, getResolvedFieldDefinitions, currentTag.fieldDefinitions, parentFieldDefinitions]);

  // 拖拽传感器
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // 行内添加新字段
  const handleAddFieldInline = useCallback(() => {
    if (!newFieldName.trim()) return;
    const fieldKey = newFieldName.trim().toLowerCase().replace(/\s+/g, '_');
    addFieldDefinition(tag.id, {
      key: fieldKey,
      name: newFieldName.trim(),
      type: 'text',
    });
    setNewFieldName('');
    setIsAddingField(false);
  }, [tag.id, newFieldName, addFieldDefinition]);

  // 更新字段类型
  const handleTypeChange = useCallback((fieldId: string, type: FieldType) => {
    const updates: Partial<FieldDefinition> = { type };
    if (type === 'select') {
      updates.options = ['选项1', '选项2', '选项3'];
    } else {
      updates.options = undefined;
    }
    if (type !== 'reference') {
      updates.targetTagId = undefined;
    }
    updateFieldDefinition(tag.id, fieldId, updates);
  }, [tag.id, updateFieldDefinition]);

  // 更新引用目标
  const handleTargetTagChange = useCallback((fieldId: string, targetTagId: string) => {
    updateFieldDefinition(tag.id, fieldId, { targetTagId });
  }, [tag.id, updateFieldDefinition]);

  // 更新引用多选
  const handleMultipleChange = useCallback((fieldId: string, multiple: boolean) => {
    updateFieldDefinition(tag.id, fieldId, { multiple });
  }, [tag.id, updateFieldDefinition]);

  // 更新选项
  const handleOptionsChange = useCallback((fieldId: string, options: string[]) => {
    updateFieldDefinition(tag.id, fieldId, { options });
  }, [tag.id, updateFieldDefinition]);

  // 删除字段
  const handleDelete = useCallback((fieldId: string) => {
    removeFieldDefinition(tag.id, fieldId);
  }, [tag.id, removeFieldDefinition]);

  // 拖拽开始
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  // 拖拽结束
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    
    if (over && active.id !== over.id) {
      // 只能排序自有字段
      const ownFields = currentTag.fieldDefinitions;
      const oldIndex = ownFields.findIndex(f => f.id === active.id);
      const newIndex = ownFields.findIndex(f => f.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newFieldDefinitions = arrayMove(ownFields, oldIndex, newIndex);
        updateSupertag(tag.id, { fieldDefinitions: newFieldDefinitions });
      }
    }
  }, [currentTag.fieldDefinitions, tag.id, updateSupertag]);

  // AI 生成字段（通过 Store 统一调用）
  const handleAIGenerate = useCallback(async () => {
    setIsGenerating(true);
    setGenerationError(null);

    try {
      // 通过 Store 的 generateSchemaFields 方法调用 AI
      const fields = await useSupertagStore.getState().generateSchemaFields(tag.id);

      if (fields && Array.isArray(fields)) {
        for (const field of fields) {
          const fieldDef: Omit<FieldDefinition, 'id'> = {
            key: field.key || field.name.toLowerCase().replace(/\s+/g, '_'),
            name: field.name,
            type: field.type as FieldType,
          };
          if (field.type === 'select' && field.options) {
            fieldDef.options = field.options;
          }
          addFieldDefinition(tag.id, fieldDef);
        }
      } else {
        setGenerationError('AI 返回的数据格式不正确');
      }
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : '生成字段时发生错误');
    } finally {
      setIsGenerating(false);
    }
  }, [tag.id, addFieldDefinition]);

  const activeField = activeId ? resolvedFields.find(f => f.id === activeId) : null;

  return (
    <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <Type size={14} />
          字段定义 (Schema)
        </h3>
        
        {/* AI 建议入口 - 非阻断式 */}
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
            items={currentTag.fieldDefinitions.map(f => f.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {resolvedFields.map((field) => (
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

        {/* 添加字段行 - 行内添加 */}
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
              {/* 确认按钮 */}
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
              {/* 取消按钮 */}
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
      {resolvedFields.length === 0 && !isAddingField && (
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
