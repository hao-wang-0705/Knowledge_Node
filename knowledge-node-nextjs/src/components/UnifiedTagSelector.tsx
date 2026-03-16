'use client';

/**
 * UnifiedTagSelector - 统一标签选择器
 * 
 * 功能：
 * 1. 统一入口 - 用户只用 # 作为触发器
 * 2. 分组结构 - AI 推荐 → 最近使用 → 功能标签
 * 3. 模糊搜索 - 支持快速过滤
 * 
 * v3.4: 移除分类系统，简化为扁平列表
 * v3.5: 移除用户创建标签功能（已废弃）
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Check, Hash, Sparkles, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSupertagStore } from '@/stores/supertagStore';

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
  category?: 'entity' | 'action';
}

// ============================================
// 组件实现
// ============================================

const UnifiedTagSelector: React.FC<UnifiedTagSelectorProps> = ({
  open,
  onClose,
  onSelectTag,
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

  // Viewport 尺寸（SSR 安全）
  const [viewport, setViewport] = useState({ width: 1920, height: 1080 });
  useEffect(() => {
    setViewport({ width: window.innerWidth, height: window.innerHeight });
  }, [open]);
  
  // Store (v3.4: 移除分类相关)
  const supertags = useSupertagStore((state) => state.supertags);
  
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
  
  // 构建标签列表（v4.2: 含 category 用于实体/行动分组）
  const allTags = useMemo((): TagItem[] => {
    return Object.values(supertags)
      .filter((tag) => !excludeTagIds.includes(tag.id))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((tag) => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
        type: 'type' as const,
        icon: tag.icon,
        category: tag.category,
      }));
  }, [supertags, excludeTagIds]);
  
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
  
  // 分组显示的标签 (v3.4: 简化为 AI推荐 + 最近使用 + 全部标签)
  const groupedTags = useMemo(() => {
    // 如果有搜索词，只显示搜索结果
    if (searchTerm.trim()) {
      return {
        search: filteredTags,
        aiRecommended: [],
        recent: [],
        entityTags: [],
        actionTags: [],
        otherTags: [],
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
    
    // 排除 AI 推荐和最近使用的标签后，按实体/行动分组
    const excludeIds = new Set([
      ...aiRecommended.map((t) => t.id),
      ...recent.map((t) => t.id),
    ]);
    const remaining = allTags.filter((t) => !excludeIds.has(t.id));
    const entityTags = remaining.filter((t) => t.category === 'entity');
    const actionTags = remaining.filter((t) => t.category === 'action');
    const otherTags = remaining.filter((t) => t.category !== 'entity' && t.category !== 'action');
    
    return {
      search: [],
      aiRecommended,
      recent,
      entityTags,
      actionTags,
      otherTags,
    };
  }, [searchTerm, filteredTags, allTags, aiRecommendations, recentTags]);
  
  // 平铺的列表（用于键盘导航）(v4.2: 实体 → 行动 → 其他）
  const flatList = useMemo(() => {
    const list: TagItem[] = [];
    
    if (searchTerm.trim()) {
      list.push(...groupedTags.search);
    } else {
      list.push(...groupedTags.aiRecommended);
      list.push(...groupedTags.recent);
      list.push(...groupedTags.entityTags);
      list.push(...groupedTags.actionTags);
      list.push(...groupedTags.otherTags);
    }
    
    return list;
  }, [searchTerm, groupedTags]);
  
  // 选中索引边界检查
  useEffect(() => {
    if (selectedIndex >= flatList.length) {
      setSelectedIndex(Math.max(0, flatList.length - 1));
    }
  }, [flatList.length, selectedIndex]);
  
  // 处理标签选择
  const handleSelect = useCallback((item: TagItem) => {
    onSelectTag(item.id, item.type);
    onClose();
  }, [onSelectTag, onClose]);
  
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
      data-editing-popover
      className="fixed z-50 min-w-[280px] max-w-[320px] bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
      style={{
        left: Math.min(position.x, viewport.width - 340),
        top: Math.min(position.y, viewport.height - 400),
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
                placeholder="搜索超级标签"
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
                
                {/* 实体 (v4.2: 显式分类展示) */}
                {groupedTags.entityTags.length > 0 && (
                  <TagGroup
                    title="实体"
                    icon={<Hash size={12} className="text-blue-500" />}
                    items={groupedTags.entityTags}
                    selectedIndex={selectedIndex}
                    startIndex={
                      groupedTags.aiRecommended.length +
                      groupedTags.recent.length
                    }
                    onSelect={handleSelect}
                  />
                )}
                
                {/* 行动 */}
                {groupedTags.actionTags.length > 0 && (
                  <TagGroup
                    title="行动"
                    icon={<Hash size={12} className="text-amber-500" />}
                    items={groupedTags.actionTags}
                    selectedIndex={selectedIndex}
                    startIndex={
                      groupedTags.aiRecommended.length +
                      groupedTags.recent.length +
                      groupedTags.entityTags.length
                    }
                    onSelect={handleSelect}
                  />
                )}
                
                {/* 其他（无 category 的标签） */}
                {groupedTags.otherTags.length > 0 && (
                  <TagGroup
                    title="其他"
                    icon={<Hash size={12} className="text-gray-400" />}
                    items={groupedTags.otherTags}
                    selectedIndex={selectedIndex}
                    startIndex={
                      groupedTags.aiRecommended.length +
                      groupedTags.recent.length +
                      groupedTags.entityTags.length +
                      groupedTags.actionTags.length
                    }
                    onSelect={handleSelect}
                  />
                )}
                
                {/* 空状态 */}
                {flatList.length === 0 && (
                  <div className="py-8 text-center text-sm text-gray-400">
                    暂无可用标签
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
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
        isSelected
          ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-200"
          : "hover:bg-gray-50 dark:hover:bg-gray-800"
      )}
    >
      {/* 标签图标 */}
      <span className="flex items-center justify-center w-5 h-5 rounded bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 text-xs">
        {item.icon || '#'}
      </span>
      
      {/* 标签名称 */}
      <span className="flex-1 text-left truncate">
        #{item.name}
      </span>
      
      {/* 选中指示 */}
      {isSelected && (
        <Check size={14} className="text-indigo-500 flex-shrink-0" />
      )}
    </button>
  );
};

export default UnifiedTagSelector;
