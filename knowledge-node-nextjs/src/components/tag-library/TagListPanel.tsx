'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  Check, 
  GripVertical, 
  ChevronDown, 
  ChevronRight,
  FolderPlus,
  MoreHorizontal,
  Edit2,
  Trash2,
  Tag,
  FolderOpen
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Supertag, TagCategoryGroup, PRESET_CATEGORY_IDS } from '@/types';
import { useSupertagStore } from '@/stores/supertagStore';
import { TAG_COLORS } from '@/utils/mockData';
import { useAuthErrorHandler } from '@/hooks/useAuthErrorHandler';
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
  DragOverEvent,
  useDroppable,
  pointerWithin,
  rectIntersection,
  MeasuringStrategy,
  UniqueIdentifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface TagListPanelProps {
  tags: Supertag[];
  selectedTagId: string | null;
  onSelectTag: (tagId: string) => void;
  onTagCreated: (tagId: string) => void;
}

// 可排序的标签项组件
interface SortableTagItemProps {
  tag: Supertag;
  isSelected: boolean;
  onSelect: () => void;
  isDragOverlay?: boolean;
  depth?: number;
  totalFieldCount?: number; // 包含继承字段的总数
}

const SortableTagItem: React.FC<SortableTagItemProps> = ({ tag, isSelected, onSelect, isDragOverlay = false, depth = 0, totalFieldCount }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: tag.id,
    data: {
      type: 'tag',
      tag,
      categoryId: tag.categoryId,
    }
  });

  const baseStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const style = isDragOverlay
    ? baseStyle
    : { ...baseStyle, paddingLeft: 12 + depth * 12 };

  // 使用传入的总数或默认自有字段数
  const fieldCount = totalFieldCount ?? tag.fieldDefinitions.length;

  // 拖拽预览层的样式
  if (isDragOverlay) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 shadow-xl border-2 border-blue-400 dark:border-blue-500",
          "cursor-grabbing transform scale-105"
        )}
      >
        <GripVertical size={12} className="text-blue-400" />
        {tag.icon ? (
          <span className="text-base flex-shrink-0">{tag.icon}</span>
        ) : (
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: tag.color }}
          />
        )}
        <span className="flex-1 text-sm truncate text-gray-900 dark:text-gray-100 font-medium">
          #{tag.name}
        </span>
        <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-800/50 text-blue-600 dark:text-blue-300">
          {fieldCount}
        </span>
      </div>
    );
  }

  // 处理点击事件 - 区分点击和拖拽
  const handleClick = (e: React.MouseEvent) => {
    // 只有在非拖拽时触发选中
    if (!isDragging) {
      onSelect();
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={cn(
        "group flex items-center gap-2 px-3 py-2 rounded-lg cursor-grab active:cursor-grabbing transition-all",
        isSelected
          ? "bg-blue-50 dark:bg-blue-900/30 border-l-2 border-l-blue-500"
          : "hover:bg-gray-50 dark:hover:bg-gray-700/50",
        isDragging && "bg-blue-50/50 dark:bg-blue-900/20 border border-dashed border-blue-300 dark:border-blue-600"
      )}
    >
      {/* 拖拽手柄图标 - 作为视觉提示 */}
      <div
        className={cn(
          "p-0.5 text-gray-300 dark:text-gray-600",
          "transition-opacity",
          isDragging ? "opacity-100 text-blue-400" : "opacity-0 group-hover:opacity-100"
        )}
      >
        <GripVertical size={12} />
      </div>
      
      {/* 图标或颜色指示器 */}
      {tag.icon ? (
        <span className="text-base flex-shrink-0">{tag.icon}</span>
      ) : (
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: tag.color }}
        />
      )}
      
      {/* 标签名称 */}
      <span className={cn(
        "flex-1 text-sm truncate",
        isSelected 
          ? "text-blue-700 dark:text-blue-300 font-medium" 
          : "text-gray-700 dark:text-gray-300"
      )}>
        #{tag.name}
      </span>
      
      {/* 字段数量徽章 - 显示总字段数 */}
      <span className={cn(
        "text-xs px-1.5 py-0.5 rounded-full",
        isSelected
          ? "bg-blue-100 dark:bg-blue-800/50 text-blue-600 dark:text-blue-300"
          : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
      )}>
        {fieldCount}
      </span>
    </div>
  );
};

// 分类组组件
interface CategoryGroupProps {
  category: TagCategoryGroup;
  tags: Supertag[];
  isExpanded: boolean;
  selectedTagId: string | null;
  onToggleExpand: () => void;
  onSelectTag: (tagId: string) => void;
  onEditCategory: () => void;
  onDeleteCategory: () => void;
  onAddTagToCategory: () => void;
  isDragOver?: boolean;
  isDropTarget?: boolean;
}

const CategoryGroup: React.FC<CategoryGroupProps> = ({
  category,
  tags,
  isExpanded,
  selectedTagId,
  onToggleExpand,
  onSelectTag,
  onEditCategory,
  onDeleteCategory,
  onAddTagToCategory,
  isDragOver = false,
  isDropTarget = false,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState(category.name);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // 获取字段总数的函数（包含继承字段）
  const getResolvedFieldDefinitions = useSupertagStore((state) => state.getResolvedFieldDefinitions);
  const updateCategory = useSupertagStore((state) => state.updateCategory);
  
  // 双击编辑分类名称
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // 系统分类不允许编辑
    if (category.isSystem) return;
    setEditingName(category.name);
    setIsEditingName(true);
  }, [category.isSystem, category.name]);
  
  // 保存分类名称
  const handleSaveName = useCallback(() => {
    const trimmedName = editingName.trim();
    if (trimmedName && trimmedName !== category.name) {
      updateCategory(category.id, { name: trimmedName });
    }
    setIsEditingName(false);
  }, [editingName, category.id, category.name, updateCategory]);
  
  // 取消编辑
  const handleCancelEdit = useCallback(() => {
    setEditingName(category.name);
    setIsEditingName(false);
  }, [category.name]);
  
  // 聚焦输入框
  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingName]);
  
  // 使用 useDroppable 让分类成为放置目标
  const { setNodeRef, isOver } = useDroppable({
    id: `category-${category.id}`,
    data: {
      type: 'category',
      categoryId: category.id,
      accepts: ['tag'],
    }
  });

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  const isHighlighted = isDragOver || isOver || isDropTarget;
  const sortedTagsWithDepth = useMemo(() => {
    const tagsById = new Map(tags.map((item) => [item.id, item]));
    const byParent = new Map<string | null, Supertag[]>();
    const result: Array<{ tag: Supertag; depth: number }> = [];
    const visited = new Set<string>();

    const pushByParent = (parentId: string | null, item: Supertag) => {
      const list = byParent.get(parentId) ?? [];
      list.push(item);
      byParent.set(parentId, list);
    };

    tags.forEach((item) => {
      const parentId = item.parentId && tagsById.has(item.parentId) ? item.parentId : null;
      pushByParent(parentId, item);
    });

    byParent.forEach((list) => {
      list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
    });

    const walk = (parentId: string | null, depth: number) => {
      const children = byParent.get(parentId) ?? [];
      children.forEach((child) => {
        if (visited.has(child.id)) return;
        visited.add(child.id);
        result.push({ tag: child, depth });
        walk(child.id, depth + 1);
      });
    };

    walk(null, 0);

    tags.forEach((item) => {
      if (!visited.has(item.id)) {
        result.push({ tag: item, depth: 0 });
      }
    });

    return result;
  }, [tags]);

  return (
    <div 
      ref={setNodeRef}
      className={cn(
        "mb-2 rounded-lg transition-all duration-200",
        isHighlighted && "bg-blue-50/70 dark:bg-blue-900/30 ring-2 ring-blue-400/50 dark:ring-blue-500/50 ring-offset-1"
      )}
    >
      {/* 分类头部 */}
      <div className={cn(
        "group flex items-center gap-1 px-2 py-1.5 rounded-lg transition-colors",
        isHighlighted 
          ? "bg-blue-100/80 dark:bg-blue-800/40" 
          : "hover:bg-gray-100 dark:hover:bg-gray-700/50"
      )}>
        <button
          onClick={onToggleExpand}
          className="flex items-center gap-2 flex-1 text-left"
        >
          {isExpanded ? (
            <ChevronDown size={14} className={cn("text-gray-400", isHighlighted && "text-blue-500")} />
          ) : (
            <ChevronRight size={14} className={cn("text-gray-400", isHighlighted && "text-blue-500")} />
          )}
          <span className="text-base">{category.icon}</span>
          
          {/* 分类名称 - 支持双击编辑 */}
          {isEditingName ? (
            <input
              ref={inputRef}
              type="text"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSaveName();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  handleCancelEdit();
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="text-sm font-medium px-1 py-0.5 border border-blue-400 rounded bg-white dark:bg-gray-800 outline-none focus:ring-2 focus:ring-blue-400"
              style={{ minWidth: '60px', maxWidth: '150px' }}
            />
          ) : (
            <span 
              className={cn(
                "text-sm font-medium truncate",
                isHighlighted 
                  ? "text-blue-700 dark:text-blue-300" 
                  : "text-gray-700 dark:text-gray-300",
                !category.isSystem && "cursor-text hover:bg-gray-200/50 dark:hover:bg-gray-600/50 px-1 rounded"
              )}
              onDoubleClick={handleDoubleClick}
              title={category.isSystem ? category.name : "双击编辑分类名称"}
            >
              {category.name}
            </span>
          )}
          
          <span className={cn(
            "text-xs ml-1",
            isHighlighted ? "text-blue-500" : "text-gray-400"
          )}>
            {tags.length}
          </span>
          {/* 拖拽放置提示 */}
          {isHighlighted && (
            <span className="ml-2 text-xs text-blue-500 font-medium animate-pulse">
              松开放置
            </span>
          )}
        </button>
        
        {/* 操作按钮 */}
        <div className={cn(
          "flex items-center gap-0.5 transition-opacity",
          isHighlighted ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddTagToCategory();
            }}
            className="p-1 text-gray-400 hover:text-blue-500 rounded transition-colors"
            title="添加标签到此分类"
          >
            <Plus size={14} />
          </button>
          {!category.isSystem && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }}
                className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
              >
                <MoreHorizontal size={14} />
              </button>
              
              {showMenu && (
                <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onEditCategory();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <Edit2 size={14} />
                    编辑分类
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onDeleteCategory();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 size={14} />
                    删除分类
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* 标签列表 */}
      {isExpanded && (
        <div className="mt-1 space-y-0.5">
          <SortableContext
            items={sortedTagsWithDepth.map(({ tag: item }) => item.id)}
            strategy={verticalListSortingStrategy}
          >
            {sortedTagsWithDepth.map(({ tag: item, depth }) => (
              <SortableTagItem
                key={item.id}
                tag={item}
                depth={depth}
                isSelected={selectedTagId === item.id}
                onSelect={() => onSelectTag(item.id)}
                totalFieldCount={getResolvedFieldDefinitions(item.id)?.length || item.fieldDefinitions.length}
              />
            ))}
          </SortableContext>
          
          {sortedTagsWithDepth.length === 0 && (
            <div className={cn(
              "ml-4 px-3 py-3 text-xs italic rounded-lg border-2 border-dashed transition-all",
              isHighlighted 
                ? "text-blue-500 bg-blue-50/50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600" 
                : "text-gray-400 border-transparent"
            )}>
              {isHighlighted ? (
                <span className="flex items-center gap-1.5">
                  <FolderOpen size={14} />
                  放置标签到这里
                </span>
              ) : '暂无标签'}
            </div>
          )}
        </div>
      )}
      
      {/* 折叠状态下的放置提示 */}
      {!isExpanded && isHighlighted && (
        <div className="ml-4 px-3 py-2 text-xs text-blue-500 bg-blue-50/50 dark:bg-blue-900/20 rounded-lg border-2 border-dashed border-blue-300 dark:border-blue-600 animate-pulse">
          <span className="flex items-center gap-1.5">
            <FolderOpen size={14} />
            松开将标签移入此分类
          </span>
        </div>
      )}
    </div>
  );
};

// 分类编辑弹窗
interface CategoryEditModalProps {
  category?: TagCategoryGroup;
  onSave: (name: string, icon: string, color: string) => void;
  onClose: () => void;
}

const CategoryEditModal: React.FC<CategoryEditModalProps> = ({ category, onSave, onClose }) => {
  const [name, setName] = useState(category?.name || '');
  const [icon, setIcon] = useState(category?.icon || '📁');
  const [color, setColor] = useState(category?.color || '#6B7280');
  
  const iconOptions = ['📁', '💼', '🏠', '🎯', '📚', '🎨', '🔧', '💡', '🌟', '📝', '🎮', '🎵', '📷', '✈️', '🍽️', '💰'];
  const colorOptions = ['#6366F1', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6', '#06B6D4', '#6B7280'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(name.trim(), icon, color);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {category ? '编辑分类' : '新建分类'}
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 分类名称 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              分类名称
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入分类名称"
              autoFocus
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 outline-none focus:border-blue-400 dark:focus:border-blue-500"
            />
          </div>
          
          {/* 图标选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              选择图标
            </label>
            <div className="flex flex-wrap gap-2">
              {iconOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setIcon(opt)}
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center text-lg transition-all",
                    icon === opt
                      ? "bg-blue-100 dark:bg-blue-900/50 ring-2 ring-blue-500"
                      : "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
          
          {/* 颜色选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              选择颜色
            </label>
            <div className="flex flex-wrap gap-2">
              {colorOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setColor(opt)}
                  className={cn(
                    "w-8 h-8 rounded-full transition-all",
                    color === opt && "ring-2 ring-offset-2 ring-gray-400"
                  )}
                  style={{ backgroundColor: opt }}
                />
              ))}
            </div>
          </div>
          
          {/* 按钮 */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {category ? '保存' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const TagListPanel: React.FC<TagListPanelProps> = ({
  tags,
  selectedTagId,
  onSelectTag,
  onTagCreated,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newParentTagId, setNewParentTagId] = useState('');
  const [addingToCategoryId, setAddingToCategoryId] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set([PRESET_CATEGORY_IDS.UNCATEGORIZED])
  );
  const [editingCategory, setEditingCategory] = useState<TagCategoryGroup | null>(null);
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false);
  
  // 拖拽状态
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const [overCategoryId, setOverCategoryId] = useState<string | null>(null);
  const [autoExpandTimeoutId, setAutoExpandTimeoutId] = useState<NodeJS.Timeout | null>(null);
  
  const newTagInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // 直接订阅 categories 状态，确保删除后会触发重新渲染
  const storeCategories = useSupertagStore((state) => state.categories);
  const storeSupertags = useSupertagStore((state) => state.supertags);
  const addSupertag = useSupertagStore((state) => state.addSupertag);
  const updateSupertag = useSupertagStore((state) => state.updateSupertag);
  const addCategory = useSupertagStore((state) => state.addCategory);
  const updateCategory = useSupertagStore((state) => state.updateCategory);
  const deleteCategory = useSupertagStore((state) => state.deleteCategory);
  const getTagsByCategory = useSupertagStore((state) => state.getTagsByCategory);
  const moveTagToCategory = useSupertagStore((state) => state.moveTagToCategory);
  const reorderTagsInCategory = useSupertagStore((state) => state.reorderTagsInCategory);
  
  // 认证错误处理
  const { handleAuthError } = useAuthErrorHandler();
  
  // 获取所有分类（按顺序排列）
  const categories = useMemo(() => {
    return Object.values(storeCategories).sort((a, b) => a.order - b.order);
  }, [storeCategories]);
  
  // 获取当前拖拽的标签
  const activeTag = useMemo(() => {
    if (!activeTagId) return null;
    return storeSupertags[activeTagId] || null;
  }, [activeTagId, storeSupertags]);
  
  // 拖拽传感器配置 - 减小激活距离使拖拽更容易触发
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 减小拖拽激活距离，使拖拽更容易触发
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  // 搜索过滤
  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const query = searchQuery.toLowerCase();
    return tags.filter(tag =>
      tag.name.toLowerCase().includes(query) ||
      tag.description?.toLowerCase().includes(query)
    );
  }, [tags, searchQuery]);

  const targetCategoryId = addingToCategoryId || PRESET_CATEGORY_IDS.UNCATEGORIZED;
  
  // 聚焦新标签输入框
  useEffect(() => {
    if (isAddingTag && newTagInputRef.current) {
      newTagInputRef.current.focus();
    }
  }, [isAddingTag]);
  
  // 清理自动展开定时器
  useEffect(() => {
    return () => {
      if (autoExpandTimeoutId) {
        clearTimeout(autoExpandTimeoutId);
      }
    };
  }, [autoExpandTimeoutId]);
  
  // 切换分类展开
  const toggleCategoryExpand = useCallback((categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }, []);
  
  // 创建新标签 - 简化版，不需要选择父标签
  const handleCreateTag = useCallback(async () => {
    if (!newTagName.trim()) return;
    
    const colorIndex = tags.length % TAG_COLORS.length;
    const categoryId = targetCategoryId;
    
    try {
      const newId = await addSupertag(
        newTagName.trim(),
        TAG_COLORS[colorIndex],
        categoryId,
        null // 不再在新建时设置父标签，用户可以在详情页设置继承关系
      );
      
      setNewTagName('');
      setIsAddingTag(false);
      setAddingToCategoryId(null);
      if (newId) {
        onTagCreated(newId);
      }
      
      // 确保分类展开
      setExpandedCategories(prev => new Set([...prev, categoryId]));
    } catch (error) {
      // 处理认证错误（会重定向到登录页）
      await handleAuthError(error);
    }
  }, [newTagName, tags.length, addSupertag, onTagCreated, targetCategoryId, handleAuthError]);
  
  // 添加标签到指定分类
  const handleAddTagToCategory = useCallback((categoryId: string) => {
    setAddingToCategoryId(categoryId);
    setNewParentTagId('');
    setIsAddingTag(true);
    setExpandedCategories(prev => new Set([...prev, categoryId]));
  }, []);
  
  // 创建新分类
  const handleCreateCategory = useCallback((name: string, icon: string, color: string) => {
    addCategory(name, icon, color);
    setShowNewCategoryModal(false);
  }, [addCategory]);
  
  // 更新分类
  const handleUpdateCategory = useCallback((name: string, icon: string, color: string) => {
    if (editingCategory) {
      updateCategory(editingCategory.id, { name, icon, color });
      setEditingCategory(null);
    }
  }, [editingCategory, updateCategory]);
  
  // 删除分类
  const handleDeleteCategory = useCallback((categoryId: string) => {
    if (confirm('删除分类后，该分类下的标签将移动到"未分类"。确定要删除吗？')) {
      deleteCategory(categoryId);
    }
  }, [deleteCategory]);
  
  // ============================================
  // 拖拽事件处理
  // ============================================
  
  // 拖拽开始
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    setActiveTagId(active.id as string);
    
    // 清除之前的自动展开定时器
    if (autoExpandTimeoutId) {
      clearTimeout(autoExpandTimeoutId);
      setAutoExpandTimeoutId(null);
    }
  }, [autoExpandTimeoutId]);
  
  // 拖拽经过 - 检测目标分类并处理自动展开
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over, active } = event;
    
    if (!over) {
      setOverCategoryId(null);
      return;
    }
    
    const overId = over.id as string;
    let targetCategoryId: string | null = null;
    
    // 判断悬浮目标类型
    if (overId.startsWith('category-')) {
      // 直接悬浮在分类上
      targetCategoryId = overId.replace('category-', '');
    } else {
      // 悬浮在标签上，获取标签所属分类
      const overData = over.data.current;
      if (overData?.type === 'tag' && overData?.categoryId) {
        targetCategoryId = overData.categoryId;
      }
    }
    
    // 更新悬浮分类
    if (targetCategoryId !== overCategoryId) {
      setOverCategoryId(targetCategoryId);
      
      // 自动展开折叠的分类（延迟 500ms）
      if (targetCategoryId && !expandedCategories.has(targetCategoryId)) {
        // 清除之前的定时器
        if (autoExpandTimeoutId) {
          clearTimeout(autoExpandTimeoutId);
        }
        
        // 设置新的自动展开定时器
        const timeoutId = setTimeout(() => {
          setExpandedCategories(prev => new Set([...prev, targetCategoryId]));
        }, 500);
        
        setAutoExpandTimeoutId(timeoutId);
      }
    }
  }, [overCategoryId, expandedCategories, autoExpandTimeoutId]);
  
  // 拖拽结束
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    
    // 清理状态
    setActiveTagId(null);
    setOverCategoryId(null);
    
    if (autoExpandTimeoutId) {
      clearTimeout(autoExpandTimeoutId);
      setAutoExpandTimeoutId(null);
    }
    
    if (!over) return;
    
    const activeId = active.id as string;
    const overId = over.id as string;
    
    // 获取拖拽的标签
    const draggedTag = storeSupertags[activeId];
    if (!draggedTag) return;
    
    // 判断放置目标
    let targetCategoryId: string | null = null;
    let targetTagId: string | null = null;
    
    if (overId.startsWith('category-')) {
      // 放置到分类
      targetCategoryId = overId.replace('category-', '');
    } else {
      // 放置到标签
      const overData = over.data.current;
      if (overData?.type === 'tag') {
        targetCategoryId = overData.categoryId;
        targetTagId = overId;
      }
    }
    
    if (!targetCategoryId) return;
    
    // 跨分类移动
    if (draggedTag.categoryId !== targetCategoryId) {
      moveTagToCategory(activeId, targetCategoryId);
      // 确保目标分类展开
      setExpandedCategories(prev => new Set([...prev, targetCategoryId]));
      return;
    }
    
    // 同分类内排序
    if (targetTagId && activeId !== targetTagId) {
      const categoryTags = getTagsByCategory(targetCategoryId);
      const oldIndex = categoryTags.findIndex(t => t.id === activeId);
      const newIndex = categoryTags.findIndex(t => t.id === targetTagId);
      
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        // 重新排序
        const newOrder = arrayMove(categoryTags, oldIndex, newIndex);
        const newTagIds = newOrder.map(tag => tag.id);
        reorderTagsInCategory(targetCategoryId, newTagIds);
      }
    }
  }, [storeSupertags, moveTagToCategory, getTagsByCategory, reorderTagsInCategory, autoExpandTimeoutId]);
  
  // 拖拽取消
  const handleDragCancel = useCallback(() => {
    setActiveTagId(null);
    setOverCategoryId(null);
    
    if (autoExpandTimeoutId) {
      clearTimeout(autoExpandTimeoutId);
      setAutoExpandTimeoutId(null);
    }
  }, [autoExpandTimeoutId]);
  
  // 自定义碰撞检测 - 优化分类检测
  const customCollisionDetection = useCallback((args: Parameters<typeof closestCenter>[0]) => {
    // 首先检查是否悬浮在分类上
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
      // 优先返回分类碰撞
      const categoryCollision = pointerCollisions.find(c => 
        typeof c.id === 'string' && c.id.startsWith('category-')
      );
      if (categoryCollision) {
        return [categoryCollision];
      }
      return pointerCollisions;
    }
    
    // 回退到最近中心检测
    return closestCenter(args);
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 搜索框 */}
      <div className="p-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索标签..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-all"
          />
        </div>
      </div>
      
      {/* 拖拽提示条 */}
      {activeTagId && (
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg text-xs text-blue-600 dark:text-blue-400">
            <GripVertical size={12} />
            <span>拖拽标签到其他分类进行移动，或在同一分类内调整顺序</span>
          </div>
        </div>
      )}
      
      {/* 分类和标签列表 */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-2 scroll-smooth"
      >
        <DndContext
          sensors={sensors}
          collisionDetection={customCollisionDetection}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
          measuring={{
            droppable: {
              strategy: MeasuringStrategy.Always,
            }
          }}
        >
          {/* 搜索结果 */}
          {filteredTags ? (
            <div className="space-y-0.5">
              <div className="px-2 py-1 text-xs text-gray-400 font-medium">
                搜索结果 ({filteredTags.length})
              </div>
              {filteredTags.map((tag) => (
                <SortableTagItem
                  key={tag.id}
                  tag={tag}
                  isSelected={selectedTagId === tag.id}
                  onSelect={() => onSelectTag(tag.id)}
                />
              ))}
              {filteredTags.length === 0 && (
                <div className="text-center py-8">
                  <Search size={20} className="mx-auto mb-2 text-gray-300" />
                  <p className="text-sm text-gray-400">未找到匹配的标签</p>
                </div>
              )}
            </div>
          ) : (
            /* 按分类分组显示 */
            categories.map((category) => {
              const categoryTags = getTagsByCategory(category.id);
              return (
                <CategoryGroup
                  key={category.id}
                  category={category}
                  tags={categoryTags}
                  isExpanded={expandedCategories.has(category.id)}
                  selectedTagId={selectedTagId}
                  onToggleExpand={() => toggleCategoryExpand(category.id)}
                  onSelectTag={onSelectTag}
                  onEditCategory={() => setEditingCategory(category)}
                  onDeleteCategory={() => handleDeleteCategory(category.id)}
                  onAddTagToCategory={() => handleAddTagToCategory(category.id)}
                  isDragOver={overCategoryId === category.id}
                  isDropTarget={activeTagId !== null && overCategoryId === category.id}
                />
              );
            })
          )}
          
          {/* 拖拽预览层 */}
          <DragOverlay dropAnimation={{
            duration: 200,
            easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
          }}>
            {activeTag ? (
              <SortableTagItem
                tag={activeTag}
                isSelected={false}
                onSelect={() => {}}
                isDragOverlay
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
      
      {/* 底部操作区域 */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
        {/* 新建标签输入框 - 简洁模式，不需要选择父标签 */}
        {isAddingTag ? (
          <div className="flex items-center gap-2">
            <Tag size={14} className="text-gray-400 flex-shrink-0" />
            <input
              ref={newTagInputRef}
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onBlur={() => {
                if (!newTagName.trim()) {
                  setIsAddingTag(false);
                  setAddingToCategoryId(null);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateTag();
                if (e.key === 'Escape') {
                  setIsAddingTag(false);
                  setNewTagName('');
                  setAddingToCategoryId(null);
                }
              }}
              placeholder={addingToCategoryId ? `添加标签到分类` : '输入标签名称'}
              className="flex-1 min-w-0 px-2 py-1.5 text-sm bg-white dark:bg-gray-700 border border-blue-300 dark:border-blue-500 rounded-lg outline-none"
            />
            <button
              onClick={handleCreateTag}
              disabled={!newTagName.trim()}
              className="p-1.5 text-green-500 hover:text-green-600 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              <Check size={18} />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setNewParentTagId('');
                setIsAddingTag(true);
              }}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 border border-dashed border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 rounded-lg transition-all"
            >
              <Plus size={16} />
              <span>新建标签</span>
            </button>
            <button
              onClick={() => setShowNewCategoryModal(true)}
              className="flex items-center justify-center gap-1 px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 border border-dashed border-gray-200 dark:border-gray-600 hover:border-purple-300 dark:hover:border-purple-500 rounded-lg transition-all"
              title="新建分类"
            >
              <FolderPlus size={16} />
            </button>
          </div>
        )}
      </div>
      
      {/* 分类编辑弹窗 */}
      {(showNewCategoryModal || editingCategory) && (
        <CategoryEditModal
          category={editingCategory || undefined}
          onSave={editingCategory ? handleUpdateCategory : handleCreateCategory}
          onClose={() => {
            setShowNewCategoryModal(false);
            setEditingCategory(null);
          }}
        />
      )}
    </div>
  );
};

export default TagListPanel;
