'use client';

import { Suspense, useEffect, useCallback } from 'react';
import { useSupertagStore } from '@/stores/supertagStore';
import { useAuthErrorHandler } from '@/hooks/useAuthErrorHandler';
import TagLibraryPage from '@/components/tag-library/TagLibraryPage';
import { TagLibrarySkeleton } from '@/components/tag-library/TagLibrarySkeleton';

// 错误状态组件
function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
      <div className="text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <span className="text-red-500 text-xl">!</span>
        </div>
        <p className="text-sm text-red-500 dark:text-red-400">{message}</p>
      </div>
    </div>
  );
}

// 标签库内容组件
function TagLibraryContent() {
  const loadSupertags = useSupertagStore((state) => state.loadFromAPI);
  const isInitialized = useSupertagStore((state) => state.isInitialized);
  const isLoading = useSupertagStore((state) => state.isLoading);
  const error = useSupertagStore((state) => state.error);
  
  const { withAuthErrorHandler } = useAuthErrorHandler();

  // 初始化数据
  const initializeData = useCallback(async () => {
    await withAuthErrorHandler(async () => {
      await loadSupertags();
    });
  }, [loadSupertags, withAuthErrorHandler]);

  useEffect(() => {
    if (!isInitialized && !isLoading) {
      initializeData();
    }
  }, [isInitialized, isLoading, initializeData]);

  if (error) {
    return <ErrorState message={error} />;
  }

  if (!isInitialized || isLoading) {
    return <TagLibrarySkeleton />;
  }

  return <TagLibraryPage />;
}

export default function TagLibraryRoute() {
  return (
    <Suspense fallback={<TagLibrarySkeleton />}>
      <TagLibraryContent />
    </Suspense>
  );
}
