'use client';

import { Suspense, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { useSupertagStore } from '@/stores/supertagStore';
import { useFocusStore } from '@/stores/focusStore';
import { useAuthErrorHandler } from '@/hooks/useAuthErrorHandler';
import SupertagFocusPage from '@/components/supertag-focus/SupertagFocusPage';

// 加载状态组件
function LoadingState() {
  return (
    <div className="flex h-full items-center justify-center bg-white dark:bg-slate-900">
      <div className="text-center">
        <div
          className="w-12 h-12 mx-auto mb-4 rounded-xl flex items-center justify-center animate-pulse"
          style={{
            background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
          }}
        >
          <span className="text-white text-xl">#</span>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">加载聚焦视图...</p>
      </div>
    </div>
  );
}

// 错误状态组件
function ErrorState({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div className="flex h-full items-center justify-center bg-white dark:bg-slate-900">
      <div className="text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <span className="text-red-500 text-xl">!</span>
        </div>
        <p className="text-sm text-red-500 dark:text-red-400 mb-4">{message}</p>
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          返回标签库
        </button>
      </div>
    </div>
  );
}

// 404 状态组件
function NotFoundState({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex h-full items-center justify-center bg-white dark:bg-slate-900">
      <div className="text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <span className="text-gray-400 text-xl">#</span>
        </div>
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          标签不存在
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          请检查标签 ID 是否正确
        </p>
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition-colors"
        >
          返回标签库
        </button>
      </div>
    </div>
  );
}

// 聚焦页面内容组件
function FocusPageContent({ tagId }: { tagId: string }) {
  const router = useRouter();
  const { withAuthErrorHandler } = useAuthErrorHandler();
  
  // Supertag Store
  const loadSupertags = useSupertagStore((state) => state.loadFromAPI);
  const isSupertageInitialized = useSupertagStore((state) => state.isInitialized);
  const isSupertageLoading = useSupertagStore((state) => state.isLoading);
  const supertags = useSupertagStore((state) => state.supertags);
  
  // Focus Store
  const enterFocus = useFocusStore((state) => state.enterFocus);
  const exitFocus = useFocusStore((state) => state.exitFocus);
  const isLoading = useFocusStore((state) => state.isLoading);
  const isInitialized = useFocusStore((state) => state.isInitialized);
  const error = useFocusStore((state) => state.error);
  const focusedTagId = useFocusStore((state) => state.focusedTagId);
  
  // 当前标签
  const currentTag = supertags[tagId];
  
  // 返回标签库
  const handleBack = useCallback(() => {
    exitFocus();
    router.push('/library/tags');
  }, [exitFocus, router]);
  
  // 初始化 Supertag 数据
  useEffect(() => {
    if (!isSupertageInitialized && !isSupertageLoading) {
      withAuthErrorHandler(async () => {
        await loadSupertags();
      });
    }
  }, [isSupertageInitialized, isSupertageLoading, loadSupertags, withAuthErrorHandler]);
  
  // 进入聚焦模式
  useEffect(() => {
    if (isSupertageInitialized && currentTag && focusedTagId !== tagId) {
      withAuthErrorHandler(async () => {
        await enterFocus(tagId, currentTag);
      });
    }
  }, [isSupertageInitialized, currentTag, tagId, focusedTagId, enterFocus, withAuthErrorHandler]);
  
  // 清理：离开页面时退出聚焦模式
  useEffect(() => {
    return () => {
      // 注意：这里不调用 exitFocus，因为用户可能只是刷新页面
      // exitFocus 应该在用户主动返回时调用
    };
  }, []);
  
  // 处理 ESC 键返回
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleBack();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleBack]);
  
  // Supertag 加载中
  if (!isSupertageInitialized || isSupertageLoading) {
    return <LoadingState />;
  }
  
  // 标签不存在
  if (!currentTag) {
    return <NotFoundState onBack={handleBack} />;
  }
  
  // Focus 加载中
  if (isLoading && !isInitialized) {
    return <LoadingState />;
  }
  
  // 加载错误
  if (error) {
    return <ErrorState message={error} onBack={handleBack} />;
  }
  
  return <SupertagFocusPage tagId={tagId} onBack={handleBack} />;
}

// 页面入口
export default function SupertagFocusRoute({
  params,
}: {
  params: Promise<{ tagId: string }>;
}) {
  const { tagId } = use(params);
  
  return (
    <Suspense fallback={<LoadingState />}>
      <FocusPageContent tagId={tagId} />
    </Suspense>
  );
}
