'use client';

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * 标签库加载占位 - 复用 Design Token 实现 Skeleton 动效
 */
export function TagLibrarySkeleton() {
  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
      {/* 顶部导航 */}
      <header className="flex items-center gap-4 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <Skeleton className="h-6 w-24" />
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* 左侧标签列表 */}
        <aside className="w-64 border-r border-slate-200 dark:border-slate-800 p-4 space-y-3">
          <Skeleton className="h-8 w-32" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </aside>

        {/* 右侧编辑区域 */}
        <main className="flex-1 p-6 space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-24 w-full" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-10 w-20" />
          </div>
        </main>
      </div>
    </div>
  );
}
