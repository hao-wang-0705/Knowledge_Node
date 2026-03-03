'use client';

import React, { useState, useRef, useCallback, useEffect, KeyboardEvent } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNodeStore } from '@/stores/nodeStore';
import { useSupertagStore } from '@/stores/supertagStore';
import UnifiedTagSelector from './UnifiedTagSelector';
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
 * - 支持 # 标签、@ 引用等功能
 * - 按 Enter 创建节点并保留在编辑状态（继续添加下一个）
 * - 按 Escape 或点击外部退出编辑模式
 * - 空内容失焦时自动退出，不创建空节点
 */
const QuickInputNode: React.FC<QuickInputNodeProps> = ({
  parentId,
  placeholder = '点击添加新笔记...',
  className,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState('');
  const [pendingTags, setPendingTags] = useState<string[]>([]);
  const [isComposing, setIsComposing] = useState(false);
  const inputRef = useRef<HTMLDivElement>(null);
  
  // 标签选择器状态
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [tagSelectorPosition, setTagSelectorPosition] = useState({ x: 0, y: 0 });
  const [tagSearchTerm, setTagSearchTerm] = useState('');
  
  // 引用弹窗状态
  const [showMentionPopover, setShowMentionPopover] = useState(false);
  const [mentionPosition, setMentionPosition] = useState({ x: 0, y: 0 });
  
  const addNode = useNodeStore((state) => state.addNode);
  const updateNode = useNodeStore((state) => state.updateNode);
  const supertags = useSupertagStore((state) => state.supertags);
  const getFieldDefinitions = useSupertagStore((state) => state.getFieldDefinitions);
  const trackTagUsage = useSupertagStore((state) => state.trackTagUsage);

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
    
    // 检测 # 触发标签选择器
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const textBeforeCursor = newContent.substring(0, range.startOffset);
      
      // # 触发标签选择器
      const hashMatch = textBeforeCursor.match(/#([^\s#]*)$/);
      if (hashMatch) {
        const rect = range.getBoundingClientRect();
        setTagSelectorPosition({
          x: rect.left - (hashMatch[1]?.length || 0) * 8,
          y: rect.bottom + 4,
        });
        setTagSearchTerm(hashMatch[1] || '');
        setShowTagSelector(true);
      } else if (showTagSelector) {
        setShowTagSelector(false);
        setTagSearchTerm('');
      }
      
      // @ 触发引用选择
      if (textBeforeCursor.endsWith('@')) {
        const mentionRect = range.getBoundingClientRect();
        setMentionPosition({
          x: mentionRect.left,
          y: mentionRect.bottom + 4,
        });
        setShowMentionPopover(true);
      }
    }
  }, [isComposing, showTagSelector]);

  // 创建节点
  const createNode = useCallback(() => {
    const trimmedContent = content.trim();
    // 移除标签前缀（#xxx）如果有的话
    const cleanContent = trimmedContent.replace(/#[^\s#]*$/, '').trim();
    
    if (cleanContent || pendingTags.length > 0) {
      const newNodeId = addNode(parentId);
      if (newNodeId) {
        const updates: { content: string; tags?: string[]; supertagId?: string; fields?: Record<string, any> } = {
          content: cleanContent,
        };
        
        if (pendingTags.length > 0) {
          updates.tags = pendingTags;
          updates.supertagId = pendingTags[0];
          
          // 检查是否需要设置默认状态
          const firstTag = supertags[pendingTags[0]];
          const defs = firstTag ? getFieldDefinitions(firstTag.id) ?? [] : [];
          if (defs.some((f) => f.key === 'status')) {
            updates.fields = { status: '待办' };
          }
        }
        
        updateNode(newNodeId, updates);
      }
    }
    
    // 重置状态，准备下一次输入
    setContent('');
    setPendingTags([]);
    if (inputRef.current) {
      inputRef.current.textContent = '';
    }
  }, [content, pendingTags, parentId, addNode, updateNode, supertags, getFieldDefinitions]);

  // 标记是否正在通过 Enter 键创建节点，防止 blur 重复触发
  const isCreatingRef = useRef(false);

  // 处理键盘事件
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (isComposing) return;
    
    // 标签选择器打开时的键盘处理由 UnifiedTagSelector 负责
    if (showTagSelector || showMentionPopover) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowTagSelector(false);
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
      const trimmedContent = currentContent.trim().replace(/#[^\s#]*$/, '').trim();
      
      if (trimmedContent || pendingTags.length > 0) {
        const newNodeId = addNode(parentId);
        if (newNodeId) {
          const updates: { content: string; tags?: string[]; supertagId?: string; fields?: Record<string, any> } = {
            content: trimmedContent,
          };
          
          if (pendingTags.length > 0) {
            updates.tags = pendingTags;
            updates.supertagId = pendingTags[0];
            
            const firstTag = supertags[pendingTags[0]];
            const defs = firstTag ? getFieldDefinitions(firstTag.id) ?? [] : [];
            if (defs.some((f) => f.key === 'status')) {
              updates.fields = { status: '待办' };
            }
          }
          
          updateNode(newNodeId, updates);
        }
      }
      
      // 重置状态，准备下一次输入
      setContent('');
      setPendingTags([]);
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
      setPendingTags([]);
      if (inputRef.current) {
        inputRef.current.textContent = '';
      }
    }
  }, [isComposing, showTagSelector, showMentionPopover, pendingTags, parentId, addNode, updateNode, supertags, getFieldDefinitions]);

  // 失焦处理
  const handleBlur = useCallback((e: React.FocusEvent) => {
    // 如果正在通过 Enter 创建节点，不处理 blur
    if (isCreatingRef.current) return;
    
    // 如果焦点移到标签选择器或引用弹窗，不退出编辑模式
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (relatedTarget?.closest('.tag-selector-popover') || 
        relatedTarget?.closest('.mention-popover')) {
      return;
    }
    
    // 延迟检查，避免点击标签选择器时误退出
    setTimeout(() => {
      if (isCreatingRef.current) return;
      if (showTagSelector || showMentionPopover) return;
      
      // 从 DOM 读取最新内容
      const currentContent = inputRef.current?.textContent || '';
      const trimmedContent = currentContent.trim();
      
      if (!trimmedContent && pendingTags.length === 0) {
        // 空内容，退出编辑模式
        setIsEditing(false);
      } else {
        // 有内容，创建节点
        createNode();
        setIsEditing(false);
      }
    }, 150);
  }, [pendingTags, showTagSelector, showMentionPopover, createNode]);

  // 标签选择回调
  const handleTagSelect = useCallback((tagId: string) => {
    // 移除内容中的 # 搜索词
    const newContent = content.replace(/#[^\s#]*$/, '').trim();
    setContent(newContent);
    if (inputRef.current) {
      inputRef.current.textContent = newContent;
    }
    
    // 添加到待创建标签列表
    if (!pendingTags.includes(tagId)) {
      setPendingTags([...pendingTags, tagId]);
      trackTagUsage(tagId);
    }
    
    setShowTagSelector(false);
    setTagSearchTerm('');
    
    // 恢复焦点
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [content, pendingTags, trackTagUsage]);

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
            {/* 已选标签显示 */}
            {pendingTags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1">
                {pendingTags.map(tagId => {
                  const tag = supertags[tagId];
                  return tag ? (
                    <span 
                      key={tagId}
                      className="inline-flex items-center px-1.5 py-0.5 text-xs rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                    >
                      {tag.icon} {tag.name}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingTags(pendingTags.filter(id => id !== tagId));
                        }}
                        className="ml-1 hover:text-red-500"
                      >
                        ×
                      </button>
                    </span>
                  ) : null;
                })}
              </div>
            )}
            
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
                <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px]">#</kbd> 标签
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
              <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-500 text-[10px]">#</kbd>
              <span>标签</span>
              <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-500 text-[10px]">@</kbd>
              <span>引用</span>
            </div>
          </>
        )}
      </div>

      {/* 标签选择器 */}
      {showTagSelector && (
        <div className="tag-selector-popover">
          <UnifiedTagSelector
            open={showTagSelector}
            onClose={() => {
              setShowTagSelector(false);
              setTagSearchTerm('');
              setTimeout(() => inputRef.current?.focus(), 50);
            }}
            onSelectTag={(tagId) => handleTagSelect(tagId)}
            onCreateTag={(_name: string, _tagType: 'type') => {
              setShowTagSelector(false);
              setTagSearchTerm('');
            }}
            position={tagSelectorPosition}
            initialSearchTerm={tagSearchTerm}
            excludeTagIds={pendingTags}
          />
        </div>
      )}

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
