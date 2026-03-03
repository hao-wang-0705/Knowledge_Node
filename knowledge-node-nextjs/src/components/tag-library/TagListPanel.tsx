'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  Check, 
  GripVertical, 
  Tag
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Supertag } from '@/types';
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
}

const SortableTagItem: React.FC<SortableTagItemProps> = ({ tag, isSelected, onSelect, isDragOverlay = false }) => {
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
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const fieldCount = tag.fieldDefinitions.length;

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
      
      {/* 字段数量徽章 */}
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

/**
 * 标签列表面板 (v3.4)
 * 简化为扁平列表展示，移除分类和继承功能
 */
const TagListPanel: React.FC<TagListPanelProps> = ({
  tags,
  selectedTagId,
  onSelectTag,
  onTagCreated,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  
  // 拖拽状态
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  
  const newTagInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // 直接订阅 supertags 状态
  const storeSupertags = useSupertagStore((state) => state.supertags);
  
  // 获取所有标签（按顺序排列）
  const sortedTags = useMemo(() => {
    return Object.values(storeSupertags).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [storeSupertags]);
  
  // 获取当前拖拽的标签
  const activeTag = useMemo(() => {
    if (!activeTagId) return null;
    return storeSupertags[activeTagId] || null;
  }, [activeTagId, storeSupertags]);
  
  // 拖拽传感器配置
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  // 搜索过滤
  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) return sortedTags;
    const query = searchQuery.toLowerCase();
    return sortedTags.filter(tag =>
      tag.name.toLowerCase().includes(query) ||
      tag.description?.toLowerCase().includes(query)
    );
  }, [sortedTags, searchQuery]);

  // 聚焦新标签输入框
  useEffect(() => {
    if (isAddingTag && newTagInputRef.current) {
      newTagInputRef.current.focus();
    }
  }, [isAddingTag]);
  
  // 创建新标签 - 当前为只读模式，此功能已禁用
  const handleCreateTag = useCallback(async () => {
    console.warn('[TagListPanel] 当前为只读模式，无法创建标签');
  }, []);
  
  // ============================================
  // 拖拽事件处理
  // ============================================
  
  // 拖拽开始
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveTagId(event.active.id as string);
  }, []);
  
  // 拖拽结束 - 当前为只读模式，此功能已禁用
  const handleDragEnd = useCallback((_event: DragEndEvent) => {
    setActiveTagId(null);
    console.warn('[TagListPanel] 当前为只读模式，无法拖拽调整顺序');
  }, []);
  
  // 拖拽取消
  const handleDragCancel = useCallback(() => {
    setActiveTagId(null);
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
            <span>拖拽标签调整顺序</span>
          </div>
        </div>
      )}
      
      {/* 标签列表 */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-2 scroll-smooth"
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="space-y-0.5">
            {/* 搜索结果数量提示 */}
            {searchQuery && (
              <div className="px-2 py-1 text-xs text-gray-400 font-medium">
                搜索结果 ({filteredTags.length})
              </div>
            )}
            
            <SortableContext
              items={filteredTags.map(tag => tag.id)}
              strategy={verticalListSortingStrategy}
            >
              {filteredTags.map((tag) => (
                <SortableTagItem
                  key={tag.id}
                  tag={tag}
                  isSelected={selectedTagId === tag.id}
                  onSelect={() => onSelectTag(tag.id)}
                />
              ))}
            </SortableContext>
            
            {filteredTags.length === 0 && (
              <div className="text-center py-8">
                <Search size={20} className="mx-auto mb-2 text-gray-300" />
                <p className="text-sm text-gray-400">
                  {searchQuery ? '未找到匹配的标签' : '暂无标签'}
                </p>
              </div>
            )}
          </div>
          
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
      <div className="p-3 border-t border-gray-200 dark:border-gray-700">
        {/* 新建标签输入框 */}
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
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateTag();
                if (e.key === 'Escape') {
                  setIsAddingTag(false);
                  setNewTagName('');
                }
              }}
              placeholder="输入标签名称"
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
          <button
            onClick={() => setIsAddingTag(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 border border-dashed border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 rounded-lg transition-all"
          >
            <Plus size={16} />
            <span>新建标签</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default TagListPanel;
