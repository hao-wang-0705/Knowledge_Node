'use client';

/**
 * AIAggregationBlock - AI 聚合文本块组件
 * v3.6: 支持动态数据源、自定义 Prompt、SSE 流式输出、节点 Backlink 渲染
 */

import React from 'react';
import { Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WidgetBaseProps } from '../../registry/WidgetRegistry';
import type { AIAggregationWidgetProps, StandupSummaryItem } from '@/types/view-config';
import useAIStream from './useAIStream';
import BacklinkRenderer from './BacklinkRenderer';
import SkeletonLoader from './SkeletonLoader';

/**
 * AIAggregationBlock 组件
 */
export function AIAggregationBlock({
  config,
  tagTemplate,
  nodes,
  className,
}: WidgetBaseProps) {
  const props = config.props as AIAggregationWidgetProps;
  const { title, query, prompt, cacheTTL = 900, showBacklinks = true } = props;
  
  // 使用 AI 流式 Hook
  const {
    content,
    nodeRefs,
    standup,
    isLoading,
    error,
    fromCache,
    refresh,
  } = useAIStream({
    tagId: tagTemplate.id,
    query,
    prompt,
    cacheTTL,
    nodes,
  });
  
  return (
    <div
      className={cn(
        'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700',
        'shadow-sm overflow-hidden',
        className
      )}
    >
      {/* 头部 */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-pink-500" />
          <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200">
            {title || 'AI 洞察'}
          </h3>
          {fromCache && (
            <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
              缓存
            </span>
          )}
        </div>
        
        <button
          onClick={refresh}
          disabled={isLoading}
          className={cn(
            'p-1.5 rounded-md transition-colors',
            isLoading
              ? 'text-gray-300 cursor-not-allowed'
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
          )}
          title="刷新"
        >
          <RefreshCw size={14} className={cn(isLoading && 'animate-spin')} />
        </button>
      </div>
      
      {/* 内容区 */}
      <div className="px-4 py-3 min-h-[100px]">
        {/* 加载状态 */}
        {isLoading && !content && <SkeletonLoader />}
        
        {/* 错误状态 */}
        {error && (
          <div className="flex items-start gap-2 text-red-600">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">生成失败</p>
              <p className="text-xs text-red-500">{error}</p>
            </div>
          </div>
        )}
        
        {/* 结构化站会卡片 */}
        {standup && (
          <div className="space-y-3 mb-3">
            <StandupSection
              title="高优预警"
              items={standup.highRisk}
              tone="danger"
            />
            <StandupSection
              title="进展摘要"
              items={standup.progress}
              tone="neutral"
            />
            <StandupSection
              title="阻塞风险"
              items={standup.risks}
              tone="warning"
            />
          </div>
        )}

        {/* 文本内容（兼容模式） */}
        {content && !standup && (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <BacklinkRenderer
              content={content}
              nodeRefs={showBacklinks ? nodeRefs : []}
            />
            
            {/* 流式加载指示器 */}
            {isLoading && (
              <span className="inline-block w-2 h-4 bg-pink-400 animate-pulse ml-0.5" />
            )}
          </div>
        )}
        
        {/* 空状态 */}
        {!isLoading && !error && !content && !standup && (
          <div className="text-center py-4 text-gray-400 text-sm">
            暂无内容
          </div>
        )}
      </div>
      
      {/* 节点引用 */}
      {showBacklinks && nodeRefs.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <p className="text-[10px] text-gray-400 mb-1">
            基于 {standup?.stats?.totalCandidates ?? nodeRefs.length} 个未完成任务生成
          </p>
        </div>
      )}
    </div>
  );
}

interface StandupSectionProps {
  title: string;
  items: StandupSummaryItem[];
  tone: 'danger' | 'warning' | 'neutral';
}

function StandupSection({ title, items, tone }: StandupSectionProps) {
  const toneClassMap: Record<StandupSectionProps['tone'], string> = {
    danger: 'border-red-200 bg-red-50/70 dark:border-red-900/50 dark:bg-red-950/20',
    warning: 'border-amber-200 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/20',
    neutral: 'border-slate-200 bg-slate-50/70 dark:border-slate-700/50 dark:bg-slate-900/30',
  };

  return (
    <div className={cn('rounded-md border p-3', toneClassMap[tone])}>
      <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">{title}</p>
      {items.length === 0 ? (
        <p className="text-xs text-gray-400">暂无需要播报的任务</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={`${title}-${item.nodeId}`} className="text-sm text-gray-700 dark:text-gray-200">
              <span className="mr-1">-</span>
              <span>{formatStandupText(item)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatStandupText(item: StandupSummaryItem): string {
  const summary = (item.summary || '').trim();
  const title = (item.title || '未命名任务').trim();

  if (!summary) {
    return title;
  }

  if (summary.includes(title)) {
    return summary;
  }

  return `${summary}：${title}`;
}

export default AIAggregationBlock;
