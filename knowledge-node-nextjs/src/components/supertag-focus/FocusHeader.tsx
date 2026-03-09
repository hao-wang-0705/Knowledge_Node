'use client';

/**
 * 聚焦页面顶部导航栏 (v3.7)
 * 
 * 包含：
 * - 返回按钮
 * - 面包屑导航
 * - 标签信息
 * - 设置按钮（预留）
 */

import React from 'react';
import { ArrowLeft, Hash, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TagTemplate } from '@/types';

interface FocusHeaderProps {
  tag: TagTemplate;
  onBack: () => void;
}

const FocusHeader: React.FC<FocusHeaderProps> = ({ tag, onBack }) => {
  return (
    <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700/50">
      {/* 主标题栏 */}
      <div className="px-4 py-3 flex items-center justify-between">
        {/* 左侧：返回 + 面包屑 */}
        <div className="flex items-center gap-3">
          {/* 返回按钮 */}
          <button
            onClick={onBack}
            className={cn(
              'p-2 -ml-2 rounded-lg transition-colors',
              'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
              'hover:bg-gray-100 dark:hover:bg-gray-800'
            )}
            title="返回标签库 (Esc)"
          >
            <ArrowLeft size={20} />
          </button>
          
          {/* 面包屑 */}
          <nav className="flex items-center gap-2 text-sm">
            <button
              onClick={onBack}
              className="text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 transition-colors"
            >
              超级标签
            </button>
            <span className="text-gray-300 dark:text-gray-600">/</span>
            <span className="flex items-center gap-1.5 font-medium text-gray-900 dark:text-gray-100">
              <Hash
                size={14}
                style={{ color: tag.color }}
                strokeWidth={2.5}
              />
              <span style={{ color: tag.color }}>{tag.name}</span>
            </span>
          </nav>
        </div>
        
        {/* 右侧：设置按钮（预留） */}
        <div className="flex items-center gap-2">
          <button
            disabled
            className={cn(
              'p-2 rounded-lg transition-colors',
              'text-gray-300 dark:text-gray-600',
              'cursor-not-allowed'
            )}
            title="设置（即将推出）"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>
      
      {/* 标签描述（可选） */}
      {tag.description && (
        <div className="px-4 pb-3">
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
            {tag.description}
          </p>
        </div>
      )}
    </div>
  );
};

export default FocusHeader;
