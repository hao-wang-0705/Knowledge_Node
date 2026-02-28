'use client';

/**
 * UnifiedTagSelector - 统一标签选择器
 * 
 * 功能：
 * 1. 统一入口 - 用户只用 # 作为触发器
 * 2. 分组结构 - AI 推荐 → 最近使用 → 功能标签
 * 3. 模糊搜索 - 支持快速过滤
 * 4. 快速创建 - 支持创建新的功能标签
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Check, Hash, Sparkles, Clock, Tag, Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BRAND } from '@/lib/brand';
import { useSupertagStore } from '@/stores/supertagStore';
import { TYPE_TAG_ICONS, PRESET_CATEGORY_IDS } from '@/types';

// ============================================
// 类型定义
// ============================================

export interface UnifiedTagSelectorProps {
  /** 是否显示 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 选择标签回调 */
  onSelectTag: (tagId: string, tagType: 'type') => void;
  /** 创建新标签回调 */
  onCreateTag: (name: string, tagType: 'type') => void;
  /** 弹窗位置 */
  position: { x: number; y: number };
  /** AI 推荐的标签列表 */
  aiRecommendations?: Array<{ 
    tagId: string; 
    tagType: 'type';
    confidence: number;
    reason?: string;
  }>;
  /** 最近使用的标签 ID 列表 */
  recentTags?: string[];
  /** 已选中的标签（用于排除） */
  excludeTagIds?: string[];
  /** 输入的搜索关键词（从外部传入） */
  initialSearchTerm?: string;
}

// 标签项的统一数据结构
interface TagItem {
  id: string;
  name: string;
  color: string;
  type: 'type';
  icon?: string;
  isNew?: boolean;
  categoryId?: string;
  categoryName?: string;
  parentId?: string | null;  // v2.1 继承用
  depth?: number;            // v2.1 树形缩进
}

// ============================================
// 组件实现
// ============================================

const UnifiedTagSelector: React.FC<UnifiedTagSelectorProps> = ({
  open,
  onClose,
  onSelectTag,
  onCreateTag,
  position,
  aiRecommendations = [],
  recentTags = [],
  excludeTagIds = [],
  initialSearchTerm = '',
}) => {
  // 状态
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Store
  const supertags = useSupertagStore((state) => state.supertags);
  const storeCategories = useSupertagStore((state) => state.categories);
  const getCategory = useSupertagStore((state) => state.getCategory);
  
  // 获取所有分类（按顺序排列）
  const categories = useMemo(() => {
    return Object.values(storeCategories).sort((a, b) => a.order - b.order);
  }, [storeCategories]);
  
  // 初始化搜索词
  useEffect(() => {
    if (open && initialSearchTerm) {
      setSearchTerm(initialSearchTerm);
    }
  }, [open, initialSearchTerm]);
  
  // 聚焦输入框
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);
  
  // 关闭时重置状态
  useEffect(() => {
    if (!open) {
      setSearchTerm('');
      setSelectedIndex(0);
    }
  }, [open]);
  
  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, onClose]);
  
  // 构建标签列表 (仅功能标签，含 parentId 用于树形)
  const allTags = useMemo((): TagItem[] => {
    return Object.values(supertags)
      .filter((tag) => !tag.isSystem && !excludeTagIds.includes(tag.id))
      .map((tag) => {
        const category = getCategory(tag.categoryId);
        return {
          id: tag.id,
          name: tag.name,
          color: tag.color,
          type: 'type' as const,
          icon: tag.icon || TYPE_TAG_ICONS[tag.id],
          categoryId: tag.categoryId,
          categoryName: category?.name,
          parentId: tag.parentId ?? undefined,
        };
      });
  }, [supertags, excludeTagIds, getCategory]);
  
  // 过滤后的标签列表
  const filteredTags = useMemo(() => {
    if (!searchTerm.trim()) return allTags;
    
    const term = searchTerm.toLowerCase().trim();
    return allTags.filter(
      (tag) =>
        tag.name.toLowerCase().includes(term) ||
        (tag.icon && tag.icon.includes(term))
    );
  }, [allTags, searchTerm]);
  
  // 分组显示的标签 (按分类分组)
  const groupedTags = useMemo(() => {
    // 如果有搜索词，只显示搜索结果
    if (searchTerm.trim()) {
      return {
        search: filteredTags,
        aiRecommended: [],
        recent: [],
        byCategory: {} as Record<string, TagItem[]>,
        canCreate: filteredTags.length === 0,
      };
    }
    
    // AI 推荐
    const aiRecommended = aiRecommendations
      .map((rec) => allTags.find((t) => t.id === rec.tagId))
      .filter(Boolean) as TagItem[];
    
    // 最近使用
    const recent = recentTags
      .map((id) => allTags.find((t) => t.id === id))
      .filter(Boolean)
      .slice(0, 5) as TagItem[];
    
    // 按分类分组，且每分类内按继承树排序（父在前、子缩进）
    const byCategory: Record<string, TagItem[]> = {};
    allTags.forEach((tag) => {
      const catId = tag.categoryId || PRESET_CATEGORY_IDS.UNCATEGORIZED;
      if (!byCategory[catId]) byCategory[catId] = [];
      byCategory[catId].push(tag);
    });
    const sortWithDepth = (items: TagItem[]): TagItem[] => {
      const withDepth: TagItem[] = [];
      const byParent = new Map<string | null, TagItem[]>();
      items.forEach((t) => {
        const p = t.parentId ?? null;
        if (!byParent.has(p)) byParent.set(p, []);
        byParent.get(p)!.push(t);
      });
      const walk = (parentId: string | null, d: number) => {
        (byParent.get(parentId) || []).forEach((t) => {
          withDepth.push({ ...t, depth: d });
          walk(t.id, d + 1);
        });
      };
      walk(null, 0);
      return withDepth;
    };
    Object.keys(byCategory).forEach((catId) => {
      byCategory[catId] = sortWithDepth(byCategory[catId]);
    });
    
    return {
      search: [],
      aiRecommended,
      recent,
      byCategory,
      canCreate: false,
    };
  }, [searchTerm, filteredTags, allTags, aiRecommendations, recentTags]);
  
  // 平铺的列表（用于键盘导航）
  const flatList = useMemo(() => {
    const list: TagItem[] = [];
    
    if (searchTerm.trim()) {
      list.push(...groupedTags.search);
      // 添加创建新标签选项
      if (groupedTags.canCreate) {
        list.push({
          id: '__create__',
          name: searchTerm.trim(),
          color: BRAND.primaryHex,
          type: 'type',
          isNew: true,
        });
      }
    } else {
      list.push(...groupedTags.aiRecommended);
      list.push(...groupedTags.recent);
      // 按分类添加
      categories.forEach((cat) => {
        const catTags = groupedTags.byCategory[cat.id] || [];
        list.push(...catTags);
      });
    }
    
    return list;
  }, [searchTerm, groupedTags, categories]);
  
  // 选中索引边界检查
  useEffect(() => {
    if (selectedIndex >= flatList.length) {
      setSelectedIndex(Math.max(0, flatList.length - 1));
    }
  }, [flatList.length, selectedIndex]);
  
  // 处理标签选择
  const handleSelect = useCallback((item: TagItem) => {
    if (item.isNew) {
      // 新建标签 - 直接创建功能标签
      onCreateTag(item.name, 'type');
      onClose();
    } else {
      onSelectTag(item.id, item.type);
      onClose();
    }
  }, [onSelectTag, onCreateTag, onClose]);
  
  // 键盘导航
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, flatList.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (flatList[selectedIndex]) {
          handleSelect(flatList[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
      case 'Tab':
        e.preventDefault();
        // Tab 也可以选择
        if (flatList[selectedIndex]) {
          handleSelect(flatList[selectedIndex]);
        }
        break;
    }
  }, [flatList, selectedIndex, handleSelect, onClose]);
  
  if (!open) return null;
  
  return (
    <div
      ref={containerRef}
      className="fixed z-50 min-w-[280px] max-w-[320px] bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
      style={{
        left: Math.min(position.x, window.innerWidth - 340),
        top: Math.min(position.y, window.innerHeight - 400),
      }}
      onKeyDown={handleKeyDown}
    >
      {/* 搜索输入框 */}
      <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <div className="relative">
              <Hash size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="搜索或创建标签..."
                className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 rounded-md outline-none focus:ring-2 focus:ring-indigo-400 transition-shadow"
              />
            </div>
          </div>
          
          {/* 标签列表 */}
          <div className="max-h-[300px] overflow-y-auto p-1">
            {/* 搜索结果模式 */}
            {searchTerm.trim() ? (
              <>
                {groupedTags.search.length > 0 ? (
                  <div className="space-y-0.5">
                    {groupedTags.search.map((tag, idx) => (
                      <TagListItem
                        key={tag.id}
                        item={tag}
                        isSelected={selectedIndex === idx}
                        onClick={() => handleSelect(tag)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="py-4 text-center text-sm text-gray-500">
                    没有找到匹配的标签
                  </div>
                )}
                
                {/* 创建新标签选项 */}
                <div className="mt-1 pt-1 border-t border-gray-100 dark:border-gray-700">
                  <button
                    onClick={() => {
                      onCreateTag(searchTerm.trim(), 'type');
                      onClose();
                    }}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                      selectedIndex === groupedTags.search.length
                        ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-200"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
                    )}
                  >
                    <Plus size={14} className="text-indigo-500" />
                    <span>创建标签</span>
                    <span className="font-medium text-indigo-600 dark:text-indigo-400">
                      #{searchTerm.trim()}
                    </span>
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* AI 推荐 */}
                {groupedTags.aiRecommended.length > 0 && (
                  <TagGroup
                    title="AI 推荐"
                    icon={<Sparkles size={12} className="text-indigo-500" />}
                    items={groupedTags.aiRecommended}
                    selectedIndex={selectedIndex}
                    startIndex={0}
                    onSelect={handleSelect}
                  />
                )}
                
                {/* 最近使用 */}
                {groupedTags.recent.length > 0 && (
                  <TagGroup
                    title="最近使用"
                    icon={<Clock size={12} className="text-gray-400" />}
                    items={groupedTags.recent}
                    selectedIndex={selectedIndex}
                    startIndex={groupedTags.aiRecommended.length}
                    onSelect={handleSelect}
                  />
                )}
                
                {/* 按分类显示标签 */}
                {categories.map((category) => {
                  const catTags = groupedTags.byCategory[category.id] || [];
                  if (catTags.length === 0) return null;
                  
                  // 计算起始索引
                  let startIdx = groupedTags.aiRecommended.length + groupedTags.recent.length;
                  categories.forEach((c) => {
                    if (c.order < category.order) {
                      startIdx += (groupedTags.byCategory[c.id] || []).length;
                    }
                  });
                  
                  return (
                    <TagGroup
                      key={category.id}
                      title={category.name}
                      icon={<span className="text-xs">{category.icon}</span>}
                      items={catTags}
                      selectedIndex={selectedIndex}
                      startIndex={startIdx}
                      onSelect={handleSelect}
                    />
                  );
                })}
                
                {/* 空状态 */}
                {flatList.length === 0 && (
                  <div className="py-8 text-center text-sm text-gray-400">
                    输入标签名称开始创建
                  </div>
                )}
              </>
            )}
          </div>
          
          {/* 底部快捷键提示 */}
          <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-xs text-gray-400">
            <span>↑↓ 导航</span>
            <span>↵ 选择</span>
            <span>esc 关闭</span>
          </div>
    </div>
  );
};

// ============================================
// 子组件
// ============================================

interface TagGroupProps {
  title: string;
  icon: React.ReactNode;
  items: TagItem[];
  selectedIndex: number;
  startIndex: number;
  onSelect: (item: TagItem) => void;
}

const TagGroup: React.FC<TagGroupProps> = ({
  title,
  icon,
  items,
  selectedIndex,
  startIndex,
  onSelect,
}) => {
  return (
    <div className="py-1">
      <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400">
        {icon}
        {title}
      </div>
      <div className="space-y-0.5">
        {items.map((item, idx) => (
          <TagListItem
            key={item.id}
            item={item}
            isSelected={selectedIndex === startIndex + idx}
            onClick={() => onSelect(item)}
          />
        ))}
      </div>
    </div>
  );
};

interface TagListItemProps {
  item: TagItem;
  isSelected: boolean;
  onClick: () => void;
}

const TagListItem: React.FC<TagListItemProps> = ({ item, isSelected, onClick }) => {
  const depth = item.depth ?? 0;
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
        isSelected
          ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-200"
          : "hover:bg-gray-50 dark:hover:bg-gray-800"
      )}
      style={depth > 0 ? { paddingLeft: 8 + depth * 12 } : undefined}
    >
      {/* 标签图标 */}
      <span className="flex items-center justify-center w-5 h-5 rounded bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 text-xs">
        {item.icon || '#'}
      </span>
      
      {/* 标签名称 */}
      <span className="flex-1 text-left truncate">
        #{item.name}
      </span>
      
      {/* 分类标识 */}
      {item.categoryName && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300">
          {item.categoryName}
        </span>
      )}
      
      {/* 选中指示 */}
      {isSelected && (
        <Check size={14} className="text-indigo-500 flex-shrink-0" />
      )}
    </button>
  );
};

export default UnifiedTagSelector;
