'use client';

/**
 * FormattingIndicator - AI 格式化进度指示器
 * 
 * 在 CaptureBar 格式化过程中显示精美的动效和实时进度
 */

import React from 'react';
import { Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface FormattingIndicatorProps {
  /** 已创建节点数量 */
  nodeCount: number;
  /** 取消回调 */
  onCancel?: () => void;
  /** 自定义类名 */
  className?: string;
}

const FormattingIndicator: React.FC<FormattingIndicatorProps> = ({
  nodeCount,
  onCancel,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex items-center justify-between',
        'px-4 py-3 rounded-xl',
        'bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-blue-500/10',
        'border border-indigo-200/50 dark:border-indigo-500/30',
        'animate-gradient-x',
        className
      )}
    >
      {/* 左侧：动态图标 + 提示文案 */}
      <div className="flex items-center gap-3">
        {/* Sparkles 动画图标 */}
        <div className="relative">
          {/* 外层光晕 */}
          <div className="absolute inset-0 animate-ping-slow">
            <Sparkles className="w-5 h-5 text-indigo-400/50" />
          </div>
          {/* 主图标 - 旋转 + 脉冲 */}
          <Sparkles 
            className={cn(
              'w-5 h-5 text-indigo-500 dark:text-indigo-400',
              'animate-sparkle'
            )} 
          />
        </div>
        
        {/* 文案 */}
        <span className="text-gray-600 dark:text-gray-300 text-sm font-medium">
          AI 正在整理笔记
          <span className="inline-flex ml-1">
            <span className="animate-dot-1">.</span>
            <span className="animate-dot-2">.</span>
            <span className="animate-dot-3">.</span>
          </span>
        </span>
      </div>
      
      {/* 中间：节点计数器 */}
      <div className="flex items-center gap-2">
        {nodeCount > 0 && (
          <div 
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 rounded-full',
              'bg-white/80 dark:bg-gray-800/80',
              'border border-indigo-200/50 dark:border-indigo-500/30',
              'shadow-sm',
              'animate-count-pop'
            )}
          >
            <span className="text-indigo-600 dark:text-indigo-400 font-semibold text-sm">
              {nodeCount}
            </span>
            <span className="text-gray-500 dark:text-gray-400 text-xs">
              个节点
            </span>
          </div>
        )}
      </div>
      
      {/* 右侧：取消按钮 */}
      {onCancel && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className={cn(
            'h-8 w-8 p-0 rounded-full',
            'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300',
            'hover:bg-white/50 dark:hover:bg-gray-700/50',
            'transition-colors'
          )}
        >
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
};

export default FormattingIndicator;
