'use client';

import React, { memo } from 'react';
import { Search, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { QUERY_PANEL_CONSTANTS } from '@/stores/queryPanelStore';

interface QueryPanelHeaderProps {
  /** 当前查询块数量 */
  queryCount: number;
  /** 新建查询回调 */
  onAddQuery: () => void;
  /** 是否显示上限提示 */
  showLimitWarning?: boolean;
}

/**
 * 查询面板头部组件（常驻模式）
 * 包含标题、新建查询按钮，移除收起面板按钮
 */
const QueryPanelHeader: React.FC<QueryPanelHeaderProps> = memo(({
  queryCount,
  onAddQuery,
  showLimitWarning = false,
}) => {
  const isAtLimit = queryCount >= QUERY_PANEL_CONSTANTS.MAX_QUERY_BLOCKS;

  return (
    <header className="h-14 flex-shrink-0 border-b border-gray-200/60 dark:border-gray-700/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
      <div className="h-full px-4 flex items-center justify-between">
        {/* 左侧：标题和图标 */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
            <Search size={14} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              智能查询
            </h2>
            <p className="text-[10px] text-gray-400 dark:text-gray-500">
              {queryCount}/{QUERY_PANEL_CONSTANTS.MAX_QUERY_BLOCKS} 个查询块
            </p>
          </div>
        </div>

        {/* 右侧：新建查询按钮 */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onAddQuery}
                disabled={isAtLimit}
                className={cn(
                  'transition-all duration-150',
                  isAtLimit
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/50'
                )}
              >
                <Plus size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {isAtLimit
                ? `已达上限（最多 ${QUERY_PANEL_CONSTANTS.MAX_QUERY_BLOCKS} 个）`
                : '新建查询块'}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* 上限提示条 */}
      {showLimitWarning && (
        <div className="px-4 py-1.5 bg-amber-50 dark:bg-amber-950/30 border-t border-amber-200/50 dark:border-amber-800/50">
          <p className="text-xs text-amber-600 dark:text-amber-400">
            ⚠️ 已达到查询块上限，请删除现有查询块后再新建
          </p>
        </div>
      )}
    </header>
  );
});

QueryPanelHeader.displayName = 'QueryPanelHeader';

export default QueryPanelHeader;
