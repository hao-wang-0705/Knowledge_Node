'use client';

/**
 * 标签库页面组件 (v3.3)
 * 
 * 重构为只读"系统预置标签图鉴"
 * - 参考 Tana 风格：卡片网格布局 + 详情折叠面板
 * - 预留 Disabled 状态的"Browse templates"按钮
 * - 移除所有编辑功能
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Hash, Library } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSupertagStore } from '@/stores/supertagStore';
import TagGalleryGrid from './TagGalleryGrid';
import TagDetailPanel from './TagDetailPanel';

const TagLibraryPage: React.FC = () => {
  // 选中的标签 ID
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  
  // 从 store 获取数据（数据加载由路由层负责）
  const supertags = useSupertagStore((state) => state.supertags);
  
  // 选中的标签
  const selectedTag = selectedTagId ? supertags[selectedTagId] : null;
  
  // 客户端初始化时读取 URL 参数
  useEffect(() => {
    if (typeof window !== 'undefined' && !isInitialized) {
      const urlParams = new URLSearchParams(window.location.search);
      const idFromUrl = urlParams.get('id');
      if (idFromUrl && supertags[idFromUrl]) {
        setSelectedTagId(idFromUrl);
        setShowDetailPanel(true);
      }
      setIsInitialized(true);
    }
  }, [supertags, isInitialized]);
  
  // 更新 URL 参数
  useEffect(() => {
    if (typeof window !== 'undefined' && selectedTagId) {
      const url = new URL(window.location.href);
      url.searchParams.set('id', selectedTagId);
      window.history.replaceState({}, '', url.toString());
    }
  }, [selectedTagId]);
  
  // 处理选择标签
  const handleSelectTag = useCallback((tagId: string) => {
    setSelectedTagId(tagId);
    setShowDetailPanel(true);
  }, []);
  
  // 关闭详情面板
  const handleCloseDetail = useCallback(() => {
    setShowDetailPanel(false);
  }, []);

  return (
    <div className="flex h-full flex-1 bg-white dark:bg-slate-900 rounded-tl-xl overflow-hidden">
      {/* 主内容区域 */}
      <div className={cn(
        "flex-1 flex flex-col overflow-hidden transition-all duration-300",
        showDetailPanel && selectedTag && "mr-0 lg:mr-[400px]"
      )}>
        {/* 顶部标题栏 */}
        <div className="flex-shrink-0 px-6 py-5 border-b border-gray-200 dark:border-gray-700/50">
          <div className="flex items-center justify-between">
            {/* 左侧：标题 */}
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
                style={{
                  background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                }}
              >
                <Hash size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  超级标签
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  系统预置标签库
                </p>
              </div>
            </div>
            
            {/* 右侧：Browse templates 按钮（预留） */}
            <button
              disabled
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg",
                "bg-gray-800/50",
                "text-gray-500",
                "cursor-not-allowed",
                "border border-gray-700/50"
              )}
              title="模版市场即将上线"
            >
              <Library size={16} />
              <span className="text-sm font-medium">Browse templates</span>
            </button>
          </div>
        </div>
        
        {/* 标签网格 */}
        <div className="flex-1 overflow-hidden">
          <TagGalleryGrid
            onSelectTag={handleSelectTag}
            selectedTagId={selectedTagId}
          />
        </div>
      </div>
      
      {/* 右侧详情面板 */}
      {showDetailPanel && selectedTag && (
        <>
          {/* 遮罩层（移动端） */}
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
            onClick={handleCloseDetail}
          />
          
          {/* 详情面板 */}
          <div
            className={cn(
              "fixed right-0 top-0 bottom-0 w-full sm:w-[400px]",
              "bg-white dark:bg-slate-900",
              "border-l border-gray-200 dark:border-gray-700/50",
              "shadow-2xl z-50",
              "transform transition-transform duration-300",
              showDetailPanel ? "translate-x-0" : "translate-x-full"
            )}
          >
            <TagDetailPanel tag={selectedTag} onClose={handleCloseDetail} />
          </div>
        </>
      )}
    </div>
  );
};

export default TagLibraryPage;
