'use client';

/**
 * SupertagBadge 组件
 * 
 * 超级标签的视觉展示组件，支持：
 * - Spring 弹入入场动画
 * - 光晕呼吸效果
 * - 边框流光效果
 * - 图标微动动画
 * - 无障碍支持
 * 
 * @version 4.0 - UI 视觉优化
 */

import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTagStyle } from '@/utils/tag-styles';
import type { Supertag } from '@/types';

export interface SupertagBadgeProps {
  /** 超级标签对象 */
  tag: Supertag;
  /** 是否为新添加的标签，触发入场动画 */
  isNew?: boolean;
  /** 移除标签回调 */
  onRemove?: () => void;
  /** 点击标签回调 */
  onClick?: () => void;
  /** 自定义类名 */
  className?: string;
  /** 是否显示边框流光效果 */
  showBorderGlow?: boolean;
  /** 是否显示移除按钮 */
  showRemoveButton?: boolean;
  /** 尺寸变体 */
  size?: 'sm' | 'md' | 'lg';
  /** 是否禁用动画 */
  disableAnimation?: boolean;
  /** 入场动画延迟 (ms) */
  animationDelay?: number;
}

/**
 * 尺寸配置映射
 */
const SIZE_CLASSES = {
  sm: 'px-2 py-0.5 text-xs gap-0.5',
  md: 'px-2.5 py-0.5 text-xs gap-1',
  lg: 'px-3 py-1 text-sm gap-1.5',
} as const;

const ICON_SIZE_CLASSES = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
} as const;

const REMOVE_BUTTON_CLASSES = {
  sm: 'w-3 h-3 -right-0.5 -top-0.5',
  md: 'w-4 h-4 -right-1 -top-1',
  lg: 'w-5 h-5 -right-1.5 -top-1.5',
} as const;

const REMOVE_ICON_SIZE = {
  sm: 8,
  md: 10,
  lg: 12,
} as const;

export function SupertagBadge({
  tag,
  isNew = false,
  onRemove,
  onClick,
  className,
  showBorderGlow = true,
  showRemoveButton = true,
  size = 'md',
  disableAnimation = false,
  animationDelay = 0,
}: SupertagBadgeProps) {
  const [shouldAnimate, setShouldAnimate] = useState(isNew && !disableAnimation);
  const [showGlow, setShowGlow] = useState(false);
  const typeStyle = getTagStyle(tag);

  useEffect(() => {
    if (isNew && !disableAnimation) {
      // 入场动画完成后开启光晕呼吸
      const timer = setTimeout(() => {
        setShouldAnimate(false);
        setShowGlow(true);

        // 光晕呼吸持续 5 秒后停止，避免持续消耗性能
        setTimeout(() => setShowGlow(false), 5000);
      }, 500 + animationDelay);
      return () => clearTimeout(timer);
    }
  }, [isNew, disableAnimation, animationDelay]);

  const handleRemove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onRemove?.();
  }, [onRemove]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (onClick) {
      e.stopPropagation();
      onClick();
    }
  }, [onClick]);

  // 动画延迟样式
  const animationStyle = animationDelay > 0 ? {
    animationDelay: `${animationDelay}ms`,
  } : undefined;

  return (
    <div 
      className="group/tag relative inline-flex items-center"
      role="listitem"
    >
      <span
        className={cn(
          // 基础样式
          'inline-flex items-center font-medium rounded-full',
          'cursor-default select-none',
          SIZE_CLASSES[size],
          // 阴影与过渡
          'shadow-sm transition-all duration-200',
          // 悬停效果
          'hover:shadow-md hover:scale-105 hover:-translate-y-0.5',
          // 可点击样式
          onClick && 'cursor-pointer active:scale-100',
          // 颜色
          typeStyle.gradient,
          typeStyle.text,
          // 边框流光效果
          showBorderGlow && !disableAnimation && 'supertag-border-glow',
          // 入场动画
          shouldAnimate && 'animate-supertag-in',
          // 光晕呼吸（入场动画结束后）
          showGlow && 'animate-supertag-glow',
          className
        )}
        style={{
          '--tag-glow-color': typeStyle.bgColor,
          ...animationStyle,
        } as React.CSSProperties}
        onClick={handleClick}
        title={tag.description || tag.name}
        aria-label={`标签: ${tag.name}`}
      >
        {/* 图标 - 入场时有微动 */}
        <span
          className={cn(
            'transition-transform',
            ICON_SIZE_CLASSES[size],
            shouldAnimate && !disableAnimation && 'animate-supertag-icon'
          )}
          aria-hidden="true"
        >
          {typeStyle.icon}
        </span>
        {/* 名称 */}
        <span>{tag.name}</span>
      </span>

      {/* 删除按钮 */}
      {onRemove && showRemoveButton && (
        <button
          type="button"
          onClick={handleRemove}
          className={cn(
            'absolute flex items-center justify-center rounded-full',
            'bg-gray-500/80 hover:bg-red-500 text-white',
            'opacity-0 group-hover/tag:opacity-100',
            'transition-all duration-150 shadow-sm',
            'focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-red-400/50',
            'btn-press-sm',
            REMOVE_BUTTON_CLASSES[size]
          )}
          title={`移除 #${tag.name}`}
          aria-label={`移除标签 ${tag.name}`}
        >
          <X size={REMOVE_ICON_SIZE[size]} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}

/**
 * 超级标签列表组件
 * 用于展示多个标签，支持 stagger 入场动画
 */
export interface SupertagBadgeListProps {
  tags: Supertag[];
  /** 新添加的标签 ID 列表 */
  newTagIds?: string[];
  onRemove?: (tagId: string) => void;
  onClick?: (tag: Supertag) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  /** stagger 动画间隔 (ms) */
  staggerDelay?: number;
}

export function SupertagBadgeList({
  tags,
  newTagIds = [],
  onRemove,
  onClick,
  className,
  size = 'md',
  staggerDelay = 50,
}: SupertagBadgeListProps) {
  if (tags.length === 0) return null;

  return (
    <div 
      className={cn('flex items-center gap-1.5 flex-wrap', className)}
      role="list"
      aria-label="标签列表"
    >
      {tags.map((tag, index) => (
        <SupertagBadge
          key={tag.id}
          tag={tag}
          isNew={newTagIds.includes(tag.id)}
          onRemove={onRemove ? () => onRemove(tag.id) : undefined}
          onClick={onClick ? () => onClick(tag) : undefined}
          size={size}
          animationDelay={newTagIds.includes(tag.id) ? index * staggerDelay : 0}
        />
      ))}
    </div>
  );
}

export default SupertagBadge;
