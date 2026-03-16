'use client';

import React, { useState, useRef, useCallback, useEffect, KeyboardEvent } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FEATURE_FLAGS } from '@/lib/feature-flags';
import { useNodeStore } from '@/stores/nodeStore';
import MentionPopover from './MentionPopover';
import UnifiedNodeEditor from './editor/UnifiedNodeEditor';
import type { NodeReference } from '@/types';
import type { UnifiedNodeEditorHandle } from './editor/UnifiedNodeEditor';

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
  const [draftReferences, setDraftReferences] = useState<NodeReference[]>([]);
  const [isComposing, setIsComposing] = useState(false);
  const inputRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<UnifiedNodeEditorHandle | null>(null);
  
  // 引用弹窗状态
  const [showMentionPopover, setShowMentionPopover] = useState(false);
  const [mentionPosition, setMentionPosition] = useState({ x: 0, y: 0 });
  
  const addNode = useNodeStore((state) => state.addNode);
  const updateNode = useNodeStore((state) => state.updateNode);

  const getCaretOffsetInEditor = useCallback(() => {
    if (!inputRef.current) return 0;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return 0;
    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(inputRef.current);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    return preCaretRange.toString().length;
  }, []);

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

  const syncReferenceOffsets = useCallback((prevText: string, nextText: string, refs: NodeReference[]) => {
    if (prevText === nextText || refs.length === 0) return refs;

    let start = 0;
    while (
      start < prevText.length &&
      start < nextText.length &&
      prevText[start] === nextText[start]
    ) {
      start++;
    }

    let prevEnd = prevText.length;
    let nextEnd = nextText.length;
    while (
      prevEnd > start &&
      nextEnd > start &&
      prevText[prevEnd - 1] === nextText[nextEnd - 1]
    ) {
      prevEnd--;
      nextEnd--;
    }

    const removedCount = prevEnd - start;
    const addedCount = nextEnd - start;
    const delta = addedCount - removedCount;

    return refs
      .filter((ref) => {
        const anchor = ref.anchorOffset ?? 0;
        if (removedCount <= 0) return true;
        // 删除范围覆盖锚点时，认为用户删除了该引用
        return !(anchor >= start && anchor <= prevEnd);
      })
      .map((ref) => {
        const anchor = ref.anchorOffset ?? 0;
        if (anchor >= prevEnd) {
          return { ...ref, anchorOffset: Math.max(0, anchor + delta) };
        }
        return ref;
      });
  }, []);

  // 处理内容变化
  const handleInput = useCallback(() => {
    if (isComposing) return;
    
    const prevContent = content;
    const newContent = inputRef.current?.textContent || '';
    setContent(newContent);
    setDraftReferences((prev) => syncReferenceOffsets(prevContent, newContent, prev));
    
    // @ 触发引用选择
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const caretOffset = getCaretOffsetInEditor();
      const textBeforeCursor = newContent.substring(0, caretOffset);
      
      if (!FEATURE_FLAGS.UNIFIED_INPUT_KERNEL && textBeforeCursor.endsWith('@')) {
        const mentionRect = range.getBoundingClientRect();
        setMentionPosition({
          x: mentionRect.left,
          y: mentionRect.bottom + 4,
        });
        setShowMentionPopover(true);
      }
    }
  }, [isComposing, content, syncReferenceOffsets, getCaretOffsetInEditor]);

  // 创建节点（纯实体引用模型：content + references）
  const createNode = useCallback((rawText: string) => {
    const hasPlainContent = rawText.trim().length > 0;
    const hasReferences = draftReferences.length > 0;

    if (hasPlainContent || hasReferences) {
      const newNodeId = addNode(parentId);
      if (newNodeId) {
        updateNode(newNodeId, {
          content: rawText,
          references: draftReferences.length > 0 ? draftReferences : undefined,
        });
      }
    }

    // 重置状态，准备下一次输入
    setContent('');
    setDraftReferences([]);
    if (inputRef.current) {
      inputRef.current.textContent = '';
    }
  }, [parentId, addNode, updateNode, draftReferences]);

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
    
    if ((e.key === 'Backspace' || e.key === 'Delete') && draftReferences.length > 0) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const offset = getCaretOffsetInEditor();
        const targetRef = draftReferences.find((ref) => {
          const anchor = ref.anchorOffset ?? 0;
          return e.key === 'Backspace'
            ? offset === anchor + 1 || offset === anchor
            : offset === anchor;
        });
        if (targetRef) {
          e.preventDefault();
          setDraftReferences((prev) => prev.filter((r) => r.id !== targetRef.id));
          return;
        }
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // 标记正在创建，防止 blur 重复触发
      isCreatingRef.current = true;
      
      // 直接从 DOM 读取最新内容（解决状态同步问题）
      const currentContent = inputRef.current?.textContent || '';
      createNode(currentContent);
      
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
  }, [isComposing, showMentionPopover, createNode, draftReferences, getCaretOffsetInEditor]);

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
      const hasAnyContent = currentContent.trim().length > 0 || draftReferences.length > 0;
      
      if (!hasAnyContent) {
        // 空内容，退出编辑模式
        setIsEditing(false);
      } else {
        // 有内容，创建节点
        createNode(currentContent);
        setIsEditing(false);
      }
    }, 150);
  }, [showMentionPopover, createNode, draftReferences]);

  // 引用选择回调：纯实体模型，写入 references 并删除触发字符 @
  const handleMentionSelect = useCallback((nodeId: string, nodeTitle: string) => {
    if (FEATURE_FLAGS.UNIFIED_INPUT_KERNEL) {
      editorRef.current?.insertReference(nodeId, nodeTitle);
      editorRef.current?.focus();
    }

    setShowMentionPopover(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleUnifiedEditorChange = useCallback((next: { content: string; references: NodeReference[] }) => {
    setContent(next.content);
    setDraftReferences(next.references);
  }, []);

  const handleUnifiedMentionTrigger = useCallback((position: { x: number; y: number }) => {
    setMentionPosition(position);
    setShowMentionPopover(true);
  }, []);

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
            {FEATURE_FLAGS.UNIFIED_INPUT_KERNEL ? (
              <UnifiedNodeEditor
                ref={editorRef}
                value={content}
                references={draftReferences}
                contentRef={inputRef}
                onChange={handleUnifiedEditorChange}
                onMentionTrigger={handleUnifiedMentionTrigger}
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
                className={cn(
                  'min-h-[24px] outline-none text-sm leading-relaxed',
                  'text-gray-700 dark:text-gray-300 bg-transparent'
                )}
                placeholder="输入内容，按 Enter 创建..."
              />
            ) : (
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
                  'min-h-[24px] outline-none text-sm leading-relaxed',
                  'text-gray-700 dark:text-gray-300 bg-transparent'
                )}
                data-placeholder="输入内容，按 Enter 创建..."
              >
                {content}
              </div>
            )}
            
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
