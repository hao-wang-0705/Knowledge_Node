'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Hash } from 'lucide-react';
import { useSupertagStore } from '@/stores/supertagStore';
import TagListPanel from './TagListPanel';
import TagEditorCanvas from './TagEditorCanvas';

/**
 * 标签库页面组件
 * 已适配全局布局框架，移除独立的全屏布局
 */
const TagLibraryPage: React.FC = () => {
  const router = useRouter();
  
  // 从 URL 获取初始选中的标签 ID（客户端安全方式）
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const supertags = useSupertagStore((state) => state.supertags);
  
  // 获取非系统标签列表
  const userTags = useMemo(() => {
    return Object.values(supertags).filter(tag => !tag.isSystem);
  }, [supertags]);
  
  // 选中的标签
  const selectedTag = selectedTagId ? supertags[selectedTagId] : null;
  
  // 客户端初始化时读取 URL 参数
  useEffect(() => {
    if (typeof window !== 'undefined' && !isInitialized) {
      const urlParams = new URLSearchParams(window.location.search);
      const idFromUrl = urlParams.get('id');
      if (idFromUrl && supertags[idFromUrl]) {
        setSelectedTagId(idFromUrl);
      }
      setIsInitialized(true);
    }
  }, [supertags, isInitialized]);
  
  // 如果没有选中标签但有可用标签，自动选中第一个
  useEffect(() => {
    if (isInitialized && !selectedTagId && userTags.length > 0) {
      setSelectedTagId(userTags[0].id);
    }
  }, [isInitialized, selectedTagId, userTags]);
  
  // 更新 URL 参数
  useEffect(() => {
    if (typeof window !== 'undefined' && selectedTagId) {
      const url = new URL(window.location.href);
      url.searchParams.set('id', selectedTagId);
      window.history.replaceState({}, '', url.toString());
    }
  }, [selectedTagId]);
  
  // 处理返回
  const handleBack = useCallback(() => {
    router.push('/');
  }, [router]);
  
  // 处理选择标签
  const handleSelectTag = useCallback((tagId: string) => {
    setSelectedTagId(tagId);
  }, []);
  
  // 处理新建标签后的回调
  const handleTagCreated = useCallback((tagId: string) => {
    setSelectedTagId(tagId);
  }, []);

  return (
    <div className="flex h-full flex-1 bg-white dark:bg-slate-900 rounded-tl-xl overflow-hidden">
      {/* 左侧列表栏 */}
      <div className="w-64 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-800/50 flex flex-col">
        {/* 标题区域 */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="flex items-center justify-center w-10 h-10 rounded-lg text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="返回笔记"
            >
              <ArrowLeft size={20} />
            </button>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
              style={{
                background: 'linear-gradient(135deg, var(--brand-primary) 0%, oklch(0.45 0.2 265) 100%)',
              }}
            >
              <Hash size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                标签库
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                管理超级标签
              </p>
            </div>
          </div>
        </div>
        
        {/* 标签列表 */}
        <TagListPanel
          tags={userTags}
          selectedTagId={selectedTagId}
          onSelectTag={handleSelectTag}
          onTagCreated={handleTagCreated}
        />
      </div>
      
      {/* 右侧编辑区 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedTag ? (
          <TagEditorCanvas tag={selectedTag} />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <Hash size={32} className="text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400">
                选择一个标签开始配置
              </h3>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                在左侧列表中选择或创建新标签
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TagLibraryPage;
