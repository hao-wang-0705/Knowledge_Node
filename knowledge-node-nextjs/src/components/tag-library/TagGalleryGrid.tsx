'use client';

/**
 * 标签卡片网格组件 (v3.4)
 * 
 * 参考 Tana 风格的只读标签图鉴展示
 * - 卡片网格布局，响应式列数
 * - 每张卡片展示标签名称、颜色背景、图标
 * - 悬停时轻微放大 + 阴影加深
 * 
 * v3.4: 移除分类系统，改为扁平列表展示
 */

import React, { useState, useMemo } from 'react';
import { Search, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Supertag } from '@/types';
import { useSupertagStore } from '@/stores/supertagStore';

interface TagGalleryGridProps {
  onSelectTag: (tagId: string) => void;
  selectedTagId: string | null;
}

// 单个标签卡片组件
interface TagCardProps {
  tag: Supertag;
  isSelected: boolean;
  onClick: () => void;
}

const TagCard: React.FC<TagCardProps> = ({ tag, isSelected, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group flex items-center gap-3 w-full h-12 px-4",
        "bg-gray-100 dark:bg-gray-800 rounded-lg",
        "transition-all duration-200 ease-out",
        "hover:bg-gray-200 dark:hover:bg-gray-700 hover:scale-[1.02]",
        "focus:outline-none",
        isSelected && "ring-2 ring-indigo-500 bg-gray-200 dark:bg-gray-700"
      )}
    >
      {/* 彩色 # 符号 */}
      <Hash 
        size={18} 
        style={{ color: tag.color }}
        strokeWidth={2.5}
        className="flex-shrink-0"
      />

      {/* 标签名称 */}
      <span
        className="text-sm font-medium truncate"
        style={{ color: tag.color }}
      >
        {tag.name}
      </span>
    </button>
  );
};

const TagGalleryGrid: React.FC<TagGalleryGridProps> = ({
  onSelectTag,
  selectedTagId,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // 从 store 获取数据
  const supertags = useSupertagStore((state) => state.supertags);

  // 排序后的标签列表
  const sortedTags = useMemo(() => {
    return Object.values(supertags).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [supertags]);

  // 搜索过滤
  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) return sortedTags;
    const query = searchQuery.toLowerCase();
    return sortedTags.filter(
      (tag) =>
        tag.name.toLowerCase().includes(query) ||
        tag.description?.toLowerCase().includes(query)
    );
  }, [sortedTags, searchQuery]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      {/* 搜索栏 */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700/50">
        <div className="relative max-w-md">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索标签..."
            className={cn(
              "w-full pl-9 pr-4 py-2",
              "text-sm bg-gray-50 dark:bg-gray-800",
              "border border-gray-200 dark:border-gray-700/50 rounded-lg",
              "text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500",
              "outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50",
              "transition-all"
            )}
          />
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">
          {searchQuery.trim() ? `搜索结果 (${filteredTags.length})` : `全部标签 (${filteredTags.length})`}
        </p>
        
        {filteredTags.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {filteredTags.map((tag) => (
              <TagCard
                key={tag.id}
                tag={tag}
                isSelected={selectedTagId === tag.id}
                onClick={() => onSelectTag(tag.id)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            {searchQuery.trim() ? (
              <>
                <Search size={32} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                <p className="text-gray-500 dark:text-gray-400">
                  未找到匹配的标签
                </p>
              </>
            ) : (
              <>
                <Hash size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">
                  暂无系统标签
                </h3>
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  系统管理员尚未配置预置标签
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TagGalleryGrid;
