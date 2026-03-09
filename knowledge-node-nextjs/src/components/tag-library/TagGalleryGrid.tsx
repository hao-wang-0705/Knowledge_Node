'use client';

/**
 * 标签卡片网格组件 (v3.7)
 * 
 * 参考 Tana 风格的只读标签图鉴展示
 * - 卡片网格布局，响应式列数
 * - 每张卡片展示标签名称、颜色背景、图标
 * - 悬停时轻微放大 + 阴影加深
 * 
 * v3.4: 移除分类系统，改为扁平列表展示
 * v3.7: 点击跳转聚焦页面，右键打开详情面板
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Hash, Eye, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Supertag } from '@/types';
import { useSupertagStore } from '@/stores/supertagStore';

interface TagGalleryGridProps {
  onSelectTag: (tagId: string) => void;
  selectedTagId: string | null;
}

// 右键菜单组件
interface ContextMenuProps {
  x: number;
  y: number;
  tagId: string;
  tagName: string;
  onViewDetails: () => void;
  onCopyId: () => void;
  onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  tagId,
  tagName,
  onViewDetails,
  onCopyId,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopyId = useCallback(() => {
    navigator.clipboard.writeText(tagId);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      onClose();
    }, 1000);
  }, [tagId, onClose]);
  
  return (
    <>
      {/* 遮罩层 */}
      <div
        className="fixed inset-0 z-50"
        onClick={onClose}
      />
      
      {/* 菜单 */}
      <div
        className={cn(
          'fixed z-50 min-w-[160px]',
          'bg-white dark:bg-gray-800',
          'border border-gray-200 dark:border-gray-700',
          'rounded-lg shadow-lg py-1',
          'animate-in fade-in-0 zoom-in-95 duration-100'
        )}
        style={{
          left: `${x}px`,
          top: `${y}px`,
        }}
      >
        <button
          onClick={() => { onViewDetails(); onClose(); }}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 text-sm',
            'text-gray-700 dark:text-gray-200',
            'hover:bg-gray-100 dark:hover:bg-gray-700',
            'transition-colors'
          )}
        >
          <Eye size={14} />
          <span>查看详情</span>
        </button>
        <button
          onClick={handleCopyId}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 text-sm',
            'text-gray-700 dark:text-gray-200',
            'hover:bg-gray-100 dark:hover:bg-gray-700',
            'transition-colors'
          )}
        >
          {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
          <span>{copied ? '已复制' : '复制标签 ID'}</span>
        </button>
      </div>
    </>
  );
};

// 单个标签卡片组件
interface TagCardProps {
  tag: Supertag;
  isSelected: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

const TagCard: React.FC<TagCardProps> = ({ tag, isSelected, onClick, onContextMenu }) => {
  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
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
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  
  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tagId: string;
    tagName: string;
  } | null>(null);

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
  
  // 处理卡片点击 - 跳转到聚焦页面
  const handleCardClick = useCallback((tagId: string) => {
    router.push(`/library/tags/${tagId}/focus`);
  }, [router]);
  
  // 处理右键菜单
  const handleContextMenu = useCallback((e: React.MouseEvent, tagId: string, tagName: string) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      tagId,
      tagName,
    });
  }, []);
  
  // 关闭右键菜单
  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);
  
  // 查看详情（通过右键菜单）
  const handleViewDetails = useCallback(() => {
    if (contextMenu) {
      onSelectTag(contextMenu.tagId);
    }
  }, [contextMenu, onSelectTag]);
  
  // 复制标签 ID
  const handleCopyId = useCallback(() => {
    // 由 ContextMenu 组件处理
  }, []);

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
          <span className="ml-2 text-gray-400 dark:text-gray-500">
            点击进入聚焦视图
          </span>
        </p>
        
        {filteredTags.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {filteredTags.map((tag) => (
              <TagCard
                key={tag.id}
                tag={tag}
                isSelected={selectedTagId === tag.id}
                onClick={() => handleCardClick(tag.id)}
                onContextMenu={(e) => handleContextMenu(e, tag.id, tag.name)}
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
      
      {/* 右键菜单 */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          tagId={contextMenu.tagId}
          tagName={contextMenu.tagName}
          onViewDetails={handleViewDetails}
          onCopyId={handleCopyId}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
};

export default TagGalleryGrid;
