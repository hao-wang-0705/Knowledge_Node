'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, CheckSquare, ListTree, Wand2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuickAction } from '@/hooks/useQuickAction';
import { QUICK_ACTIONS, type QuickActionType } from '@/types/quick-action';

interface QuickActionButtonProps {
  nodeId: string;
  /** 节点类型，仅非 command 节点显示快捷动作 */
  nodeType?: string;
  /** 节点是否有内容 */
  hasContent?: boolean;
  /** 额外的样式类名 */
  className?: string;
}

// 图标映射
const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  CheckSquare,
  ListTree,
  Wand2,
};

/**
 * v4.1: 快捷动作按钮组件
 * 悬浮在节点左侧，点击展开下拉菜单显示 AI 快捷动作
 */
export default function QuickActionButton({
  nodeId,
  nodeType = 'text',
  hasContent = false,
  className,
}: QuickActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const {
    isExecuting,
    actionType: executingActionType,
    generatedNodeCount,
    error,
    executeAction,
    cancelAction,
  } = useQuickAction(nodeId);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // 执行动作
  const handleActionClick = useCallback(async (actionType: QuickActionType) => {
    setIsOpen(false);
    
    const result = await executeAction(actionType);
    
    if (!result.success && result.error) {
      console.error('[QuickActionButton] Action failed:', result.error);
      // 可以在这里添加 toast 提示
    }
  }, [executeAction]);

  // 指令节点不显示快捷动作
  if (nodeType === 'command') {
    return null;
  }

  // 没有内容的节点不显示（或显示禁用状态）
  if (!hasContent) {
    return null;
  }

  return (
    <div className={cn('relative', className)}>
      {/* 触发按钮 */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExecuting}
        className={cn(
          'flex items-center justify-center w-6 h-6 rounded transition-all',
          'text-gray-400 hover:text-purple-500 hover:bg-purple-50',
          'dark:text-gray-500 dark:hover:text-purple-400 dark:hover:bg-purple-900/30',
          'opacity-0 group-hover:opacity-100',
          isExecuting && 'opacity-100 cursor-wait',
          isOpen && 'opacity-100 text-purple-500 bg-purple-50 dark:text-purple-400 dark:bg-purple-900/30'
        )}
        title="AI 快捷动作"
      >
        {isExecuting ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Sparkles size={14} />
        )}
      </button>

      {/* 下拉菜单 */}
      {isOpen && !isExecuting && (
        <div
          ref={menuRef}
          className={cn(
            'absolute left-0 top-full mt-1 z-50',
            'min-w-[200px] py-1 rounded-lg shadow-lg',
            'bg-white dark:bg-gray-800',
            'border border-gray-200 dark:border-gray-700',
            'animate-in fade-in-0 zoom-in-95 duration-100'
          )}
        >
          <div className="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
            ✨ AI 快捷动作
          </div>
          
          {QUICK_ACTIONS.map((action) => {
            const IconComponent = ICON_MAP[action.icon];
            
            return (
              <button
                key={action.type}
                onClick={() => handleActionClick(action.type)}
                className={cn(
                  'flex items-center gap-3 w-full px-3 py-2 text-left',
                  'text-sm text-gray-700 dark:text-gray-200',
                  'hover:bg-gray-50 dark:hover:bg-gray-700/50',
                  'transition-colors'
                )}
              >
                {IconComponent && (
                  <IconComponent 
                    size={16} 
                    className={cn(
                      'flex-shrink-0',
                      action.isDestructive 
                        ? 'text-amber-500' 
                        : 'text-purple-500 dark:text-purple-400'
                    )} 
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{action.label}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {action.description}
                  </div>
                </div>
                {action.isDestructive && (
                  <span className="text-xs text-amber-500 flex-shrink-0">替换</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* 执行状态提示 */}
      {isExecuting && (
        <div
          className={cn(
            'absolute left-0 top-full mt-1 z-50',
            'px-3 py-2 rounded-lg shadow-lg',
            'bg-white dark:bg-gray-800',
            'border border-purple-200 dark:border-purple-700',
            'text-sm text-purple-600 dark:text-purple-400',
            'animate-pulse'
          )}
        >
          <div className="flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" />
            <span>
              {executingActionType === 'extract_tasks' && '正在提取任务...'}
              {executingActionType === 'structured_summary' && '正在结构化提炼...'}
              {executingActionType === 'inline_rewrite' && '正在扩写润色...'}
            </span>
            {generatedNodeCount > 0 && (
              <span className="text-xs opacity-75">
                已生成 {generatedNodeCount} 个节点
              </span>
            )}
          </div>
          <button
            onClick={cancelAction}
            className="mt-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            取消
          </button>
        </div>
      )}

      {/* 错误提示 */}
      {error && !isExecuting && (
        <div
          className={cn(
            'absolute left-0 top-full mt-1 z-50',
            'px-3 py-2 rounded-lg shadow-lg',
            'bg-red-50 dark:bg-red-900/30',
            'border border-red-200 dark:border-red-700',
            'text-sm text-red-600 dark:text-red-400',
            'animate-in fade-in-0 duration-200'
          )}
        >
          {error}
        </div>
      )}
    </div>
  );
}
