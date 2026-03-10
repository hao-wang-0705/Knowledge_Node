/**
 * 搜索节点紧凑展示组件
 * v4.0: 参考 NodeCommand 的设计，提供搜索节点父行的紧凑展示
 * 显示：图标 + 名称 + 结果数 + 状态 + 操作按钮
 */

import React from 'react';
import type { MouseEvent } from 'react';
import { Search, RefreshCw, Settings2, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface NodeSearchProps {
  /** 搜索名称 */
  name?: string;
  /** 搜索结果数量 */
  resultCount: number;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 是否有错误 */
  hasError?: boolean;
  /** 错误信息 */
  errorMessage?: string;
  /** 是否已配置条件 */
  hasConditions: boolean;
  /** 是否折叠 */
  isCollapsed: boolean;
  /** 执行刷新搜索 */
  onRefresh: (e: MouseEvent) => void;
  /** 打开配置弹窗 */
  onOpenConfig: (e: MouseEvent) => void;
}

export default function NodeSearch({
  name,
  resultCount,
  isLoading,
  hasError,
  errorMessage,
  hasConditions,
  isCollapsed,
  onRefresh,
  onOpenConfig,
}: NodeSearchProps) {
  return (
    <div className="flex flex-col gap-2">
      {/* 标题行 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-medium text-teal-700 dark:text-teal-300">
          🔎 {name || '搜索节点'}
        </span>

        {/* 状态标签 */}
        <div className="flex items-center gap-1">
          {isLoading && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 animate-pulse">
              <Loader2 size={12} className="animate-spin" />
              搜索中...
            </span>
          )}
          {!isLoading && hasError && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
              <AlertCircle size={12} />
              搜索失败
            </span>
          )}
          {!isLoading && !hasError && hasConditions && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">
              <CheckCircle2 size={12} />
              {resultCount} 条结果
            </span>
          )}
          {!isLoading && !hasError && !hasConditions && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              待配置
            </span>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-6 px-2',
                  isLoading || !hasConditions
                    ? 'text-gray-400 cursor-not-allowed opacity-50'
                    : 'text-teal-600 hover:text-teal-700 hover:bg-teal-100 dark:text-teal-400 dark:hover:bg-teal-900/30'
                )}
                onClick={onRefresh}
                disabled={isLoading || !hasConditions}
              >
                {isLoading ? (
                  <Loader2 size={12} className="mr-1 animate-spin" />
                ) : (
                  <RefreshCw size={12} className="mr-1" />
                )}
                {isLoading ? '搜索中' : '刷新'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>刷新搜索结果</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-6 w-6 p-0',
                  'text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                )}
                onClick={onOpenConfig}
              >
                <Settings2 size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>配置搜索条件</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* 错误信息（展开时显示） */}
      {hasError && errorMessage && !isCollapsed && (
        <div className="text-sm bg-red-50 dark:bg-red-900/20 rounded-md px-3 py-2 border border-red-200 dark:border-red-800">
          <div className="text-xs text-red-600 dark:text-red-400 mb-1 font-medium flex items-center gap-1">
            <AlertCircle size={12} />
            搜索失败
          </div>
          <div className="text-red-700 dark:text-red-300 text-xs whitespace-pre-wrap">{errorMessage}</div>
        </div>
      )}

      {/* 未配置提示（展开时显示） */}
      {!hasConditions && !isCollapsed && (
        <div className="text-sm bg-amber-50 dark:bg-amber-900/20 rounded-md px-3 py-2 border border-amber-200 dark:border-amber-800">
          <div className="text-amber-700 dark:text-amber-300 text-xs">
            ⚠️ 请点击设置按钮配置搜索条件
          </div>
        </div>
      )}
    </div>
  );
}
