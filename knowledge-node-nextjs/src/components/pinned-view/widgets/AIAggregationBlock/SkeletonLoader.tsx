'use client';

/**
 * SkeletonLoader - 骨架屏加载器
 * v3.6: AI 聚合组件的加载状态占位符
 */

import React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonLoaderProps {
  className?: string;
  lines?: number;
}

/**
 * SkeletonLoader 组件
 */
export function SkeletonLoader({ className, lines = 4 }: SkeletonLoaderProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className={cn(
            'h-4 bg-gray-100 dark:bg-gray-700 rounded animate-pulse',
            // 最后一行短一点
            index === lines - 1 && 'w-3/4'
          )}
          style={{
            animationDelay: `${index * 100}ms`,
          }}
        />
      ))}
    </div>
  );
}

export default SkeletonLoader;
