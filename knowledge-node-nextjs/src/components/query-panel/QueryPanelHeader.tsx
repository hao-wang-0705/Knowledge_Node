'use client';

import React, { memo } from 'react';
import { Search, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { QUERY_PANEL_CONSTANTS } from '@/stores/queryPanelStore';
import { AlertBanner } from '@/components/ui/alert-banner';
import { logoStyles } from '@/styles/visual-tokens';

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
    <header className="flex-shrink-0 border-b border-gray-200/60 dark:border-gray-700/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
      <div className="h-14 px-4 flex items-center justify-between">
        {/* 左侧：标题和图标 */}
        <div className="flex items-center gap-2">
          <div className={cn(logoStyles.container, logoStyles.gradient, 'w-7 h-7')}>
            <Search size={14} className={logoStyles.icon} />
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
                    : 'hover:bg-[var(--brand-primary)]/10 hover:text-[var(--brand-primary)]'
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
        <AlertBanner variant="warning" className="mx-4 mb-2 animate-fade-in-scale">
          已达到查询块上限，请删除现有查询块后再新建
        </AlertBanner>
      )}
    </header>
  );
});

QueryPanelHeader.displayName = 'QueryPanelHeader';

export default QueryPanelHeader;
