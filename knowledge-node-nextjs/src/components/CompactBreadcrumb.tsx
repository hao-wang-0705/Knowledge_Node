'use client';

import React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CompactBreadcrumbProps {
  breadcrumbs: string[];
  className?: string;
  maxItems?: number;
}

/**
 * 紧凑面包屑组件
 * - 字号缩小、颜色置灰
 * - 与内容同行显示
 * - 超长路径单行截断
 * - 移除冗余图标
 */
const CompactBreadcrumb: React.FC<CompactBreadcrumbProps> = ({
  breadcrumbs,
  className,
  maxItems = 2,
}) => {
  if (breadcrumbs.length === 0) return null;

  // 只显示最后 maxItems 个面包屑，如果超过则显示省略号
  const displayCrumbs = breadcrumbs.slice(-maxItems);
  const hasEllipsis = breadcrumbs.length > maxItems;

  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-[10px] text-gray-400 dark:text-gray-500',
      'leading-none flex-shrink-0 max-w-[120px]',
      className
    )}>
      {hasEllipsis && (
        <>
          <span className="opacity-60">...</span>
          <ChevronRight size={8} className="opacity-40 flex-shrink-0" />
        </>
      )}
      {displayCrumbs.map((crumb, idx) => (
        <React.Fragment key={idx}>
          {idx > 0 && (
            <ChevronRight size={8} className="opacity-40 flex-shrink-0" />
          )}
          <span className="truncate max-w-[50px]" title={crumb}>
            {crumb}
          </span>
        </React.Fragment>
      ))}
    </span>
  );
};

export default CompactBreadcrumb;
