import { AlertCircle, CheckCircle2, Circle, Loader2, Play, Settings2 } from 'lucide-react';
import type { MouseEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface NodeCommandProps {
  icon?: string;
  name?: string;
  isExecuting: boolean;
  lastExecutionStatus?: 'success' | 'error' | 'pending';
  prompt?: string;
  lastError?: string;
  isCollapsed: boolean;
  onExecute: (e: MouseEvent) => void;
  onOpenConfig: (e: MouseEvent) => void;
}

export default function NodeCommand({
  icon,
  name,
  isExecuting,
  lastExecutionStatus,
  prompt,
  lastError,
  isCollapsed,
  onExecute,
  onOpenConfig,
}: NodeCommandProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-medium text-purple-700 dark:text-purple-300">
          {icon || '🤖'} {name || '自定义指令'}
        </span>
        <div className="flex items-center gap-1">
          {isExecuting && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 animate-pulse">
              <Loader2 size={12} className="animate-spin" />
              执行中...
            </span>
          )}
          {!isExecuting && lastExecutionStatus === 'pending' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
              <Circle size={8} className="fill-gray-400" />
              待执行
            </span>
          )}
          {!isExecuting && lastExecutionStatus === 'success' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              <CheckCircle2 size={12} />
              已完成
            </span>
          )}
          {!isExecuting && lastExecutionStatus === 'error' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
              <AlertCircle size={12} />
              执行失败
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-6 px-2',
              isExecuting
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-purple-600 hover:text-purple-700 hover:bg-purple-100 dark:text-purple-400 dark:hover:bg-purple-900/30'
            )}
            title={isExecuting ? '执行中...' : '执行指令'}
            onClick={onExecute}
            disabled={isExecuting}
          >
            {isExecuting ? (
              <Loader2 size={12} className="mr-1 animate-spin" />
            ) : (
              <Play size={12} className="mr-1" />
            )}
            {isExecuting ? '执行中' : '执行'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
            title="设置指令"
            onClick={onOpenConfig}
          >
            <Settings2 size={14} />
          </Button>
        </div>
      </div>

      {prompt && !isCollapsed && (
        <div className="text-sm text-gray-600 dark:text-gray-400 bg-white/50 dark:bg-gray-800/50 rounded-md px-3 py-2 border border-purple-200/50 dark:border-purple-700/30">
          <div className="text-xs text-purple-500 dark:text-purple-400 mb-1 font-medium">📝 指令内容</div>
          <div className="line-clamp-2">{prompt}</div>
        </div>
      )}

      {lastExecutionStatus === 'error' && lastError && !isCollapsed && (
        <div className="text-sm bg-red-50 dark:bg-red-900/20 rounded-md px-3 py-2 border border-red-200 dark:border-red-800">
          <div className="text-xs text-red-600 dark:text-red-400 mb-1 font-medium flex items-center gap-1">
            <AlertCircle size={12} />
            执行失败
          </div>
          <div className="text-red-700 dark:text-red-300 text-xs whitespace-pre-wrap">{lastError}</div>
        </div>
      )}

      {!prompt && !isCollapsed && (
        <div className="text-sm bg-amber-50 dark:bg-amber-900/20 rounded-md px-3 py-2 border border-amber-200 dark:border-amber-800">
          <div className="text-amber-700 dark:text-amber-300 text-xs">
            ⚠️ 请点击设置按钮配置指令内容或选择模板
          </div>
        </div>
      )}

      {/* AI 执行中 Skeleton 占位 */}
      {isExecuting && !isCollapsed && (
        <div className="space-y-2 pt-1">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      )}
    </div>
  );
}
