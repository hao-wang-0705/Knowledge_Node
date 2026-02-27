'use client';

import { useMemo } from 'react';
import { estimateTokenCount, MODEL_TOKEN_LIMITS, DEFAULT_MAX_TOKENS } from '@/utils/command-templates';
import { cn } from '@/lib/utils';

interface TokenBudgetIndicatorProps {
  /** Prompt 文本 */
  promptText: string;
  /** 上下文文本 */
  contextText?: string;
  /** Token 预算上限 */
  maxTokens?: number;
  /** 选择的模型 */
  model?: string;
  /** 是否显示详细信息 */
  showDetails?: boolean;
  /** 自定义类名 */
  className?: string;
}

/**
 * Token 预算指示器组件
 * 实时显示当前 Prompt 的 Token 用量和剩余预算
 */
export function TokenBudgetIndicator({
  promptText,
  contextText = '',
  maxTokens = DEFAULT_MAX_TOKENS,
  model = 'gpt-4',
  showDetails = false,
  className,
}: TokenBudgetIndicatorProps) {
  // 计算各部分 Token 数量
  const tokenStats = useMemo(() => {
    const promptTokens = estimateTokenCount(promptText);
    const contextTokens = estimateTokenCount(contextText);
    const totalTokens = promptTokens + contextTokens;
    const modelLimit = MODEL_TOKEN_LIMITS[model] || DEFAULT_MAX_TOKENS;
    const effectiveLimit = Math.min(maxTokens, modelLimit);
    const remaining = effectiveLimit - totalTokens;
    const usagePercent = Math.min((totalTokens / effectiveLimit) * 100, 100);
    
    return {
      promptTokens,
      contextTokens,
      totalTokens,
      modelLimit,
      effectiveLimit,
      remaining,
      usagePercent,
      isOverBudget: remaining < 0,
      isNearLimit: usagePercent > 80,
    };
  }, [promptText, contextText, maxTokens, model]);

  // 确定状态颜色
  const statusColor = useMemo(() => {
    if (tokenStats.isOverBudget) return 'text-red-500 bg-red-50 dark:bg-red-950';
    if (tokenStats.isNearLimit) return 'text-amber-500 bg-amber-50 dark:bg-amber-950';
    return 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950';
  }, [tokenStats.isOverBudget, tokenStats.isNearLimit]);

  // 进度条颜色
  const barColor = useMemo(() => {
    if (tokenStats.isOverBudget) return 'bg-red-500';
    if (tokenStats.isNearLimit) return 'bg-amber-500';
    return 'bg-emerald-500';
  }, [tokenStats.isOverBudget, tokenStats.isNearLimit]);

  return (
    <div className={cn('rounded-lg p-3', statusColor, className)}>
      {/* 主要显示 */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">Token 用量</span>
        <span className="text-sm font-mono">
          {tokenStats.totalTokens.toLocaleString()} / {tokenStats.effectiveLimit.toLocaleString()}
        </span>
      </div>

      {/* 进度条 */}
      <div className="h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
        <div
          className={cn('h-full transition-all duration-300', barColor)}
          style={{ width: `${Math.min(tokenStats.usagePercent, 100)}%` }}
        />
      </div>

      {/* 详细信息 */}
      {showDetails && (
        <div className="mt-3 space-y-1 text-xs opacity-80">
          <div className="flex justify-between">
            <span>Prompt</span>
            <span className="font-mono">{tokenStats.promptTokens.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>上下文</span>
            <span className="font-mono">{tokenStats.contextTokens.toLocaleString()}</span>
          </div>
          <div className="flex justify-between pt-1 border-t border-current/20">
            <span>剩余</span>
            <span className={cn('font-mono', tokenStats.isOverBudget && 'text-red-600')}>
              {tokenStats.remaining.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* 警告提示 */}
      {tokenStats.isOverBudget && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">
          ⚠️ 超出 Token 预算，请减少上下文内容
        </p>
      )}
    </div>
  );
}

/**
 * 紧凑版 Token 指示器（用于内联显示）
 */
export function TokenBadge({
  tokens,
  maxTokens = DEFAULT_MAX_TOKENS,
  className,
}: {
  tokens: number;
  maxTokens?: number;
  className?: string;
}) {
  const isOverBudget = tokens > maxTokens;
  const isNearLimit = tokens > maxTokens * 0.8;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono',
        isOverBudget
          ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
          : isNearLimit
          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
          : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
        className
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {tokens.toLocaleString()} tokens
    </span>
  );
}
