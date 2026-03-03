'use client';

import React, { memo, useState, useRef, useEffect } from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface QueryBlockHeaderProps {
  /** 查询文本 */
  queryText: string;
  /** 查询文本变化回调 */
  onQueryChange: (text: string) => void;
  /** 刷新/重新查询回调 */
  onRefresh: () => void;
  /** 删除查询块回调 */
  onDelete: () => void;
  /** 是否正在加载 */
  isLoading?: boolean;
  /** 是否为新建的空查询块 */
  isNew?: boolean;
}

/**
 * 查询块头部组件
 * 包含多行文本输入框和操作按钮组
 */
const QueryBlockHeader: React.FC<QueryBlockHeaderProps> = memo(({
  queryText,
  onQueryChange,
  onRefresh,
  onDelete,
  isLoading = false,
  isNew = false,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 自动聚焦新建的查询块
  useEffect(() => {
    if (isNew && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isNew]);

  // 自动调整文本框高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 80)}px`;
    }
  }, [queryText]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter 键触发查询（Shift+Enter 换行）
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (queryText.trim()) {
        onRefresh();
      }
    }
  };

  return (
    <div className="flex items-start gap-2 p-3 border-b border-gray-100 dark:border-gray-800">
      {/* 文本输入区域 */}
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={queryText}
          onChange={(e) => onQueryChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder="输入自然语言查询，如：找出本周未完成的 P0 任务"
          rows={1}
          className={cn(
            'w-full resize-none bg-transparent text-sm text-gray-700 dark:text-gray-200',
            'placeholder:text-gray-400 dark:placeholder:text-gray-500',
            'outline-none border-none',
            'min-h-[24px] max-h-[80px]',
            'leading-relaxed'
          )}
        />
        {/* 聚焦指示线 */}
        <div 
          className={cn(
            'absolute bottom-0 left-0 right-0 h-0.5 rounded-full transition-all duration-200',
            isFocused 
              ? 'bg-blue-500 opacity-100' 
              : 'bg-gray-200 dark:bg-gray-700 opacity-0'
          )}
        />
      </div>

      {/* 操作按钮组 */}
      <div className="flex items-center gap-0.5 flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity">
        {/* 刷新按钮 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onRefresh}
              disabled={isLoading || !queryText.trim()}
              className={cn(
                'text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/50',
                isLoading && 'animate-spin'
              )}
            >
              <RefreshCw size={14} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">重新查询</TooltipContent>
        </Tooltip>

        {/* 删除按钮 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onDelete}
              className="text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50"
            >
              <Trash2 size={14} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">删除查询块</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
});

QueryBlockHeader.displayName = 'QueryBlockHeader';

export default QueryBlockHeader;
