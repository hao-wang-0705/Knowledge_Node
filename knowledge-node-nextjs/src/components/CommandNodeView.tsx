'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Play,
  Loader2,
  Sparkles,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FEATURE_FLAGS, getDisabledMessage } from '@/lib/feature-flags';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { CommandConfig } from '@/types';

interface CommandNodeViewProps {
  /** 节点 ID */
  nodeId: string;
  /** 指令配置 */
  config: CommandConfig;
  /** 配置变更回调 */
  onConfigChange: (config: CommandConfig) => void;
  /** 执行指令回调 */
  onExecute: (prompt: string, context: string) => Promise<void>;
  /** 执行结果（流式） */
  result?: string;
  /** 是否正在执行 */
  isExecuting?: boolean;
  /** 自定义类名 */
  className?: string;
}

/**
 * v4.0 简化版指令节点视图组件
 * 使用新的 surface/coreConfig 结构
 */
export function CommandNodeView({
  nodeId: _nodeId,
  config,
  onConfigChange,
  onExecute,
  result,
  isExecuting = false,
  className,
}: CommandNodeViewProps) {
  const [copied, setCopied] = useState(false);
  const [localPrompt, setLocalPrompt] = useState(config.surface?.userPrompt || '');

  // 处理 Prompt 变更
  const handlePromptChange = useCallback((value: string) => {
    setLocalPrompt(value);
    onConfigChange({
      ...config,
      surface: {
        ...config.surface,
        userPrompt: value,
      },
    });
  }, [config, onConfigChange]);

  // 执行指令
  const handleExecute = useCallback(async () => {
    await onExecute(localPrompt, '');
  }, [onExecute, localPrompt]);

  // 复制结果
  const handleCopyResult = useCallback(() => {
    if (result) {
      navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [result]);

  // 获取执行状态显示
  const statusDisplay = useMemo(() => {
    if (config.lastExecutionStatus === 'pending') return { text: '执行中...', color: 'text-blue-500' };
    if (config.lastExecutionStatus === 'success') return { text: '已完成', color: 'text-green-500' };
    if (config.lastExecutionStatus === 'error') return { text: '执行失败', color: 'text-red-500' };
    return null;
  }, [config.lastExecutionStatus]);

  return (
    <div className={cn('bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden', className)}>
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-500" />
          <span className="font-medium text-sm">{config.surface?.name || 'AI 指令'}</span>
          {statusDisplay && (
            <span className={cn('text-xs', statusDisplay.color)}>
              {statusDisplay.text}
            </span>
          )}
        </div>
        {config.coreConfig?.commandCategory && (
          <span className="px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400 text-xs">
            {config.coreConfig.commandCategory}
          </span>
        )}
      </div>

      {/* Prompt 编辑器 */}
      <div className="p-4">
        <textarea
          value={localPrompt}
          onChange={(e) => handlePromptChange(e.target.value)}
          placeholder="描述你想让 AI 做什么..."
          className="w-full min-h-[100px] px-4 py-3 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-zinc-400"
        />
      </div>

      {/* 执行按钮 */}
      <div className="px-4 pb-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleExecute}
              disabled={!FEATURE_FLAGS.AI_COMMAND_NODE || isExecuting || !localPrompt.trim()}
              className={cn(
                'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all',
                !FEATURE_FLAGS.AI_COMMAND_NODE
                  ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-400 cursor-not-allowed opacity-50'
                  : isExecuting
                  ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500 cursor-wait'
                  : !localPrompt.trim()
                  ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-400 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/25'
              )}
            >
              {isExecuting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  执行中...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  运行指令
                </>
              )}
            </button>
          </TooltipTrigger>
          {!FEATURE_FLAGS.AI_COMMAND_NODE && (
            <TooltipContent>{getDisabledMessage('AI_COMMAND_NODE')}</TooltipContent>
          )}
        </Tooltip>
      </div>

      {/* 执行错误提示 */}
      {config.lastError && (
        <div className="px-4 pb-4">
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm">
            {config.lastError}
          </div>
        </div>
      )}

      {/* 执行结果 */}
      {result && (
        <div className="border-t border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between px-4 py-2 bg-zinc-50 dark:bg-zinc-800/50">
            <span className="text-xs font-medium text-zinc-500">执行结果</span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyResult}
                className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500"
                title="复制结果"
              >
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
              <button
                onClick={handleExecute}
                disabled={isExecuting}
                className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500"
                title="重新执行"
              >
                <RefreshCw className={cn('w-4 h-4', isExecuting && 'animate-spin')} />
              </button>
            </div>
          </div>
          <div className="p-4 prose prose-sm dark:prose-invert max-w-none">
            <pre className="whitespace-pre-wrap text-sm bg-zinc-100 dark:bg-zinc-800 rounded-lg p-4 overflow-x-auto">
              {result}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 紧凑版指令节点（用于大纲视图内联显示）
 */
export function CommandNodeCompact({
  config,
  isExecuting,
  onExecute,
  className,
}: {
  config: CommandConfig;
  isExecuting?: boolean;
  onExecute: () => void;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-50 dark:bg-purple-950/30', className)}>
      <Sparkles className="w-4 h-4 text-purple-500" />
      <span className="text-sm text-purple-600 dark:text-purple-400 flex-1 truncate">
        {config.surface?.name || '自定义指令'}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onExecute}
            disabled={!FEATURE_FLAGS.AI_COMMAND_NODE || isExecuting}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              !FEATURE_FLAGS.AI_COMMAND_NODE
                ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-400 opacity-50 cursor-not-allowed'
                : isExecuting
                ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-400'
                : 'bg-purple-600 text-white hover:bg-purple-700'
            )}
          >
            {isExecuting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </button>
        </TooltipTrigger>
        {!FEATURE_FLAGS.AI_COMMAND_NODE && (
          <TooltipContent>{getDisabledMessage('AI_COMMAND_NODE')}</TooltipContent>
        )}
      </Tooltip>
    </div>
  );
}
