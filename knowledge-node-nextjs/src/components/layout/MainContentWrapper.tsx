'use client';

import React, { memo } from 'react';
import { cn } from '@/lib/utils';

interface MainContentWrapperProps {
  /** 子内容（各页面的主内容） */
  children: React.ReactNode;
  /** 自定义类名 */
  className?: string;
}

/**
 * 主内容区包裹器
 */
const MainContentWrapper: React.FC<MainContentWrapperProps> = memo(({
  children,
  className,
}) => {
  return (
    <div className={cn('flex-1 flex min-h-0 min-w-0 overflow-hidden pl-1 pr-1 pb-1', className)}>
      <div
        className={cn(
          'flex-1 flex min-h-0 min-w-0',
          'bg-white dark:bg-slate-900',
          'rounded-xl border border-gray-200 dark:border-gray-800',
          'shadow-[0_4px_24px_rgba(0,0,0,0.02)] dark:shadow-none',
          'transition-shadow duration-200 ease-out',
          'hover:shadow-[0_6px_28px_rgba(0,0,0,0.04)] dark:hover:shadow-none',
          'overflow-hidden'
        )}
      >
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
});

MainContentWrapper.displayName = 'MainContentWrapper';

export default MainContentWrapper;
