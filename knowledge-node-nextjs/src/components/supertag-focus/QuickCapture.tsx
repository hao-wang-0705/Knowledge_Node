'use client';

/**
 * 快捷录入区组件 (v3.7)
 * 
 * 功能：
 * - 常驻输入框，按 Enter 快速创建节点
 * - 新节点自动带上当前超级标签
 * - 支持 Shift+Enter 创建并打开焦点面板
 */

import React, { useState, useRef, useCallback } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFocusStore } from '@/stores/focusStore';

interface QuickCaptureProps {
  tagName: string;
}

const QuickCapture: React.FC<QuickCaptureProps> = ({ tagName }) => {
  const [inputValue, setInputValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const quickCreate = useFocusStore((state) => state.quickCreate);
  const selectNode = useFocusStore((state) => state.selectNode);
  
  // 处理提交
  const handleSubmit = useCallback(async (openPanel: boolean = false) => {
    const content = inputValue.trim();
    if (!content || isSubmitting) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const newNode = await quickCreate(content);
      
      // 清空输入
      setInputValue('');
      
      // 保持输入框聚焦
      inputRef.current?.focus();
      
      // 如果需要打开焦点面板
      if (openPanel && newNode) {
        selectNode(newNode.id);
      }
    } catch (error) {
      console.error('[QuickCapture] 创建失败:', error);
      // 可以添加 toast 提示
    } finally {
      setIsSubmitting(false);
    }
  }, [inputValue, isSubmitting, quickCreate, selectNode]);
  
  // 处理键盘事件
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      const openPanel = e.shiftKey;
      handleSubmit(openPanel);
    }
  }, [handleSubmit]);
  
  return (
    <div className="flex-shrink-0 sticky top-0 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-gray-700/50 px-4 py-3 z-10">
      <div className="flex items-center gap-3 max-w-2xl mx-auto">
        {/* 图标 */}
        <div className="flex-shrink-0 text-gray-400">
          {isSubmitting ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <Plus size={20} />
          )}
        </div>
        
        {/* 输入框 */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`快速添加${tagName}...`}
          disabled={isSubmitting}
          className={cn(
            'flex-1 bg-transparent outline-none text-base',
            'text-gray-900 dark:text-gray-100',
            'placeholder-gray-400 dark:placeholder-gray-500',
            'disabled:opacity-50'
          )}
        />
        
        {/* 快捷键提示 */}
        <div className="flex-shrink-0 flex items-center gap-2 text-xs text-gray-400">
          <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">
            Enter
          </kbd>
          <span className="hidden sm:inline text-gray-300 dark:text-gray-600">
            创建
          </span>
        </div>
      </div>
    </div>
  );
};

export default QuickCapture;
