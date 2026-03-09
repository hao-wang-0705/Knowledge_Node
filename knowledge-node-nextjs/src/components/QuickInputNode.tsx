'use client';

import React, { useState, useRef, useCallback, useEffect, KeyboardEvent } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNodeStore } from '@/stores/nodeStore';
import MentionPopover from './MentionPopover';

interface QuickInputNodeProps {
  parentId: string | null;
  placeholder?: string;
  className?: string;
}

/**
 * 末尾常驻的快速创建节点组件
 * 
 * 优化后的交互逻辑：
 * - 点击后在原地进入编辑模式，不会跳转到上方
 * - 支持 @ 引用功能
 * - 按 Enter 创建节点并保留在编辑状态（继续添加下一个）
 * - 按 Escape 或点击外部退出编辑模式
 * - 空内容失焦时自动退出，不创建空节点
 * 
 * v3.5: 移除 # 标签选择功能
 */
const QuickInputNode: React.FC<QuickInputNodeProps> = ({
  parentId,
  placeholder = '点击添加新笔记...',
  className,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const inputRef = useRef<HTMLDivElement>(null);
  
  // 引用弹窗状态
  const [showMentionPopover, setShowMentionPopover] = useState(false);
  const [mentionPosition, setMentionPosition] = useState({ x: 0, y: 0 });
  
  const addNode = useNodeStore((state) => state.addNode);
  const updateNode = useNodeStore((state) => state.updateNode);

  // 进入编辑模式时自动聚焦
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      // 光标移到末尾
      const range = document.createRange();
      const selection = window.getSelection();
      range.selectNodeContents(inputRef.current);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  }, [isEditing]);

  // 点击进入编辑模式
  const handleContainerClick = useCallback(() => {
    if (!isEditing) {
      setIsEditing(true);
    }
  }, [isEditing]);

  // 处理内容变化
  const handleInput = useCallback(() => {
    if (isComposing) return;
    
    const newContent = inputRef.current?.textContent || '';
    setContent(newContent);
    
    // @ 触发引用选择
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const textBeforeCursor = newContent.substring(0, range.startOffset);
      
      if (textBeforeCursor.endsWith('@')) {
        const mentionRect = range.getBoundingClientRect();
        setMentionPosition({
          x: mentionRect.left,
          y: mentionRect.bottom + 4,
        });
        setShowMentionPopover(true);
      }
    }
  }, [isComposing]);

  // 创建节点
  const createNode = useCallback(() => {
    const trimmedContent = content.trim();
    
    if (trimmedContent) {
      const newNodeId = addNode(parentId);
      if (newNodeId) {
        updateNode(newNodeId, { content: trimmedContent });
      }
    }
    
    // 重置状态，准备下一次输入
    setContent('');
    if (inputRef.current) {
      inputRef.current.textContent = '';
    }
  }, [content, parentId, addNode, updateNode]);

  // 标记是否正在通过 Enter 键创建节点，防止 blur 重复触发
  const isCreatingRef = useRef(false);

  // 处理键盘事件
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (isComposing) return;
    
    // 引用弹窗打开时的键盘处理
    if (showMentionPopover) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowMentionPopover(false);
      }
      return;
    }
    
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // 标记正在创建，防止 blur 重复触发
      isCreatingRef.current = true;
      
      // 直接从 DOM 读取最新内容（解决状态同步问题）
      const currentContent = inputRef.current?.textContent || '';
      const trimmedContent = currentContent.trim();
      
      if (trimmedContent) {
        const newNodeId = addNode(parentId);
        if (newNodeId) {
          updateNode(newNodeId, { content: trimmedContent });
        }
      }
      
      // 重置状态，准备下一次输入
      setContent('');
      if (inputRef.current) {
        inputRef.current.textContent = '';
      }
      
      // 延迟重置标记
      setTimeout(() => {
        isCreatingRef.current = false;
      }, 50);
      
      // 保持编辑状态和焦点
      setTimeout(() => inputRef.current?.focus(), 10);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      // 退出编辑模式
      setIsEditing(false);
      setContent('');
      if (inputRef.current) {
        inputRef.current.textContent = '';
      }
    }
  }, [isComposing, showMentionPopover, parentId, addNode, updateNode]);

  // 失焦处理
  const handleBlur = useCallback((e: React.FocusEvent) => {
    // 如果正在通过 Enter 创建节点，不处理 blur
    if (isCreatingRef.current) return;
    
    // 如果焦点移到引用弹窗，不退出编辑模式
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (relatedTarget?.closest('.mention-popover')) {
      return;
    }
    
    // 延迟检查，避免点击弹窗时误退出
    setTimeout(() => {
      if (isCreatingRef.current) return;
      if (showMentionPopover) return;
      
      // 从 DOM 读取最新内容
      const currentContent = inputRef.current?.textContent || '';
      const trimmedContent = currentContent.trim();
      
      if (!trimmedContent) {
        // 空内容，退出编辑模式
        setIsEditing(false);
      } else {
        // 有内容，创建节点
        createNode();
        setIsEditing(false);
      }
    }, 150);
  }, [showMentionPopover, createNode]);

  // 引用选择回调
  const handleMentionSelect = useCallback((nodeId: string, nodeTitle: string) => {
    // 在当前位置插入引用文本（使用 @提及 格式）
    const refText = `@${nodeTitle}`;
    
    // 替换 @ 符号为引用文本
    let newContent = content;
    if (content.endsWith('@')) {
      newContent = content.slice(0, -1) + refText + ' ';
    } else {
      newContent = content + refText + ' ';
    }
    
    setContent(newContent);
    if (inputRef.current) {
      inputRef.current.textContent = newContent;
      // 光标移到末尾
      const range = document.createRange();
      const selection = window.getSelection();
      range.selectNodeContents(inputRef.current);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
    
    setShowMentionPopover(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [content]);

  // 中文输入法处理
  const handleCompositionStart = useCallback(() => setIsComposing(true), []);
  const handleCompositionEnd = useCallback(() => {
    setIsComposing(false);
    handleInput();
  }, [handleInput]);

  return (
    <div 
      className={cn(
        "mt-4 group",
        className
      )}
    >
      <div 
        role="button"
        tabIndex={isEditing ? -1 : 0}
        onClick={handleContainerClick}
        onKeyDown={!isEditing ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleContainerClick();
          }
        } : undefined}
        className={cn(
          "flex items-start gap-2 px-2 py-2 rounded-lg transition-all duration-200",
          isEditing 
            ? "bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 cursor-text" 
            : "hover:bg-gray-50 dark:hover:bg-gray-800/50 border border-transparent hover:border-gray-200 dark:hover:border-gray-700 cursor-pointer",
          "focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        )}
      >
        {/* 加号图标 */}
        <div className="flex items-center justify-center w-5 h-5 mt-0.5 flex-shrink-0">
          <Plus 
            size={16} 
            className={cn(
              "transition-colors",
              isEditing ? "text-blue-500" : "text-gray-400 group-hover:text-blue-500"
            )} 
          />
        </div>

        {/* 输入区域 */}
        {isEditing ? (
          <div className="flex-1 min-w-0">
            {/* 可编辑输入框 */}
            <div
              ref={inputRef}
              contentEditable
              suppressContentEditableWarning
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              className={cn(
                "min-h-[24px] outline-none text-sm leading-relaxed",
                "text-gray-700 dark:text-gray-300",
                "empty:before:content-['输入内容，按_Enter_创建...'] empty:before:text-gray-400"
              )}
              data-placeholder="输入内容，按 Enter 创建..."
            />
            
            {/* 快捷键提示 */}
            <div className="mt-1 text-xs text-gray-400 flex items-center gap-2">
              <span>
                <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px]">Enter</kbd> 创建
              </span>
              <span>
                <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px]">@</kbd> 引用
              </span>
              <span>
                <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px]">Esc</kbd> 取消
              </span>
            </div>
          </div>
        ) : (
          <>
            {/* 提示文本 */}
            <span className="flex-1 text-sm text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-400 select-none">
              {placeholder}
            </span>

            {/* 快捷键提示（非编辑状态） */}
            <div className="hidden group-hover:flex items-center gap-1 text-xs text-gray-400">
              <span>支持</span>
              <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-500 text-[10px]">@</kbd>
              <span>引用</span>
            </div>
          </>
        )}
      </div>

      {/* 引用弹窗 */}
      {showMentionPopover && (
        <div className="mention-popover">
          <MentionPopover
            open={showMentionPopover}
            onClose={() => {
              setShowMentionPopover(false);
              setTimeout(() => inputRef.current?.focus(), 50);
            }}
            onSelect={handleMentionSelect}
            position={mentionPosition}
          />
        </div>
      )}
    </div>
  );
};

export default QuickInputNode;
