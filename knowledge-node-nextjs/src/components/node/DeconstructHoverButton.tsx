'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { ListTree, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isDeconstructCandidate } from '@/utils/deconstructSniffer';
import { useQuickAction } from '@/hooks/useQuickAction';

/** 符合条件时按钮展示时长（毫秒），超时未点击则消失 */
const SHOW_DURATION_MS = 15000;

interface DeconstructHoverButtonProps {
  nodeId: string;
  content: string;
  className?: string;
}

/**
 * 智能解构入口：仅用规则预筛，规则通过即显示「解构」按钮；
 * 以呼吸态展示一段时间，用户不点击则自动消失。
 * 点击后与快捷菜单一致：显示处理态（加载图标 + 正在智能解构... / 已生成 N 个节点）。
 */
export default function DeconstructHoverButton({ nodeId, content, className }: DeconstructHoverButtonProps) {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const {
    isExecuting,
    actionType: executingActionType,
    generatedNodeCount,
    executeAction,
  } = useQuickAction(nodeId);

  const trimmed = (content ?? '').trim();
  const isCandidate = !!trimmed && isDeconstructCandidate(content);
  const isDeconstructing = isExecuting && executingActionType === 'deconstruct';

  useEffect(() => {
    if (!isCandidate) return;
    if (isDeconstructing) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setVisible(true);
      return;
    }
    setVisible(true);
    timerRef.current = setTimeout(() => {
      setVisible(false);
      timerRef.current = null;
    }, SHOW_DURATION_MS);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isCandidate, nodeId, trimmed, isDeconstructing]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      executeAction('deconstruct');
    },
    [executeAction]
  );

  if (!isCandidate || !visible) {
    return null;
  }

  return (
    <div className={cn('flex items-center flex-shrink-0 ml-1 min-w-[28px]', className)}>
      <button
        type="button"
        onClick={handleClick}
        disabled={isDeconstructing}
        className={cn(
          'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium',
          'text-purple-600 dark:text-purple-400',
          'bg-purple-50 dark:bg-purple-950/40',
          'border border-dashed border-purple-200 dark:border-purple-700',
          'shadow-sm ring-1 ring-purple-200/50 dark:ring-purple-800/50',
          !isDeconstructing && 'hover:bg-purple-100 dark:hover:bg-purple-900/50 animate-pulse-soft',
          isDeconstructing && 'cursor-wait'
        )}
        title={isDeconstructing ? undefined : '解构'}
      >
        {isDeconstructing ? (
          <>
            <Loader2 size={12} className="animate-spin flex-shrink-0" />
            <span>正在智能解构...</span>
            {generatedNodeCount > 0 && (
              <span className="text-[10px] opacity-75">已生成 {generatedNodeCount} 个</span>
            )}
          </>
        ) : (
          <>
            <ListTree size={12} />
            解构
          </>
        )}
      </button>
    </div>
  );
}
