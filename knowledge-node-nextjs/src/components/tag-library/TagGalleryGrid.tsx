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
import { Search, Hash, Sparkles } from 'lucide-react';
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
  nodeCount?: number;
}

const TagCard: React.FC<TagCardProps> = ({ tag, isSelected, onClick, nodeCount }) => {
  // 计算标签颜色的浅色背景
  const getBgColor = (color: string) => {
    // 转换为带透明度的背景色
    return `${color}15`; // 约 8% 透明度
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex flex-col items-center justify-center",
        "w-full aspect-square rounded-xl p-4",
        "transition-all duration-200 ease-out",
        "hover:scale-105 hover:shadow-lg",
        "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500",
        isSelected
          ? "ring-2 ring-indigo-500 shadow-lg scale-105"
          : "hover:shadow-md"
      )}
      style={{
        backgroundColor: getBgColor(tag.color),
        borderColor: tag.color,
        borderWidth: isSelected ? '2px' : '1px',
        borderStyle: 'solid',
      }}
    >
      {/* 图标或 # 符号 */}
      <div
        className="text-3xl mb-2 transition-transform duration-200 group-hover:scale-110"
      >
        {tag.icon || (
          <Hash 
            size={32} 
            style={{ color: tag.color }}
            strokeWidth={2.5}
          />
        )}
      </div>

      {/* 标签名称 */}
      <span
        className={cn(
          "text-sm font-semibold text-center truncate w-full px-1",
          "transition-colors duration-200"
        )}
        style={{ color: tag.color }}
      >
        #{tag.name}
      </span>

      {/* 使用次数徽章 */}
      {nodeCount !== undefined && nodeCount > 0 && (
        <span
          className={cn(
            "absolute top-2 right-2 px-1.5 py-0.5",
            "text-[10px] font-medium rounded-full",
            "bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm",
            "text-gray-500 dark:text-gray-400"
          )}
        >
          {nodeCount}
        </span>
      )}

      {/* 系统标签标记 */}
      {tag.isGlobalDefault && (
        <span
          className={cn(
            "absolute bottom-2 right-2",
            "text-[10px] px-1.5 py-0.5 rounded-full",
            "bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm",
            "text-indigo-600 dark:text-indigo-400"
          )}
        >
          <Sparkles size={10} className="inline mr-0.5" />
          系统
        </span>
      )}
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
    <div className="flex flex-col h-full">
      {/* 搜索栏 */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="relative max-w-md">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索标签..."
            className={cn(
              "w-full pl-10 pr-4 py-2.5",
              "text-sm bg-gray-50 dark:bg-gray-800",
              "border border-gray-200 dark:border-gray-700 rounded-xl",
              "outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/30",
              "transition-all"
            )}
          />
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4 px-2">
          {searchQuery.trim() ? `搜索结果 (${filteredTags.length})` : `全部标签 (${filteredTags.length})`}
        </h3>
        
        {filteredTags.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 px-2">
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
