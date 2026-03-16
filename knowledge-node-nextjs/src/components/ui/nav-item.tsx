'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * NavItem 变体定义
 * 统一管理导航项的状态样式
 */
const navItemVariants = cva(
  'group w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-all duration-150 cursor-pointer',
  {
    variants: {
      variant: {
        default: 'text-[#666] dark:text-gray-400 hover:bg-black/5 dark:hover:bg-gray-800 hover:text-[#111] dark:hover:text-gray-100',
        active: 'bg-black/5 dark:bg-gray-800 text-[#111] dark:text-gray-100 font-medium',
        disabled: 'text-gray-400 dark:text-gray-500 opacity-50 cursor-not-allowed',
      },
      size: {
        default: 'text-sm',
        sm: 'text-[13px] py-1',
        lg: 'text-base py-2',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

/**
 * NavItem 图标变体
 */
const navIconVariants = cva(
  'flex items-center justify-center w-5 h-5 flex-shrink-0 transition-colors duration-150',
  {
    variants: {
      variant: {
        default: 'text-[#666] dark:text-gray-400',
        active: 'text-[var(--brand-primary)]',
        disabled: 'text-gray-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface NavItemProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'>,
    VariantProps<typeof navItemVariants> {
  /** 左侧图标 */
  icon?: React.ReactNode;
  /** 导航项标签文本 */
  label: string;
  /** 右侧徽章/附加内容 */
  badge?: React.ReactNode;
  /** 是否激活状态（会覆盖 variant） */
  isActive?: boolean;
  /** 渲染为其他元素 */
  asChild?: boolean;
}

/**
 * 通用导航项组件
 * 用于侧边栏、导航菜单等场景
 * 支持 default/active/disabled 三种状态
 */
const NavItem = React.forwardRef<HTMLButtonElement, NavItemProps>(
  (
    {
      className,
      variant,
      size,
      icon,
      label,
      badge,
      isActive,
      disabled,
      ...props
    },
    ref
  ) => {
    // 如果传入 isActive，则覆盖 variant
    const computedVariant = disabled ? 'disabled' : isActive ? 'active' : variant;

    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        className={cn(navItemVariants({ variant: computedVariant, size, className }))}
        {...props}
      >
        {/* 图标 */}
        {icon && (
          <span className={cn(navIconVariants({ variant: computedVariant }))}>
            {icon}
          </span>
        )}
        
        {/* 标签 */}
        <span className="flex-1 font-medium text-left truncate">{label}</span>
        
        {/* 徽章/附加内容 */}
        {badge && <span className="flex-shrink-0">{badge}</span>}
      </button>
    );
  }
);

NavItem.displayName = 'NavItem';

export { NavItem, navItemVariants, navIconVariants };
