'use client';

import React, { memo, useCallback, useMemo } from 'react';
import { FileText, Calendar } from 'lucide-react';
import { UserMenu } from '@/components/UserMenu';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useNodeStore } from '@/stores/nodeStore';
import { BRAND } from '@/lib/brand';
import { SyncStatusIndicator } from '@/components/SyncStatusIndicator';

/**
 * 全局顶部导航组件
 * 从 OutlineEditor 中提取，作为全局布局的一部分
 */
const TopNavigation: React.FC = memo(() => {
  const hoistedNodeId = useNodeStore((state) => state.hoistedNodeId);
  const goToToday = useNodeStore((state) => state.goToToday);
  const isInDailyTree = useNodeStore((state) => state.isInDailyTree);

  const isCalendarView = useMemo(
    () => (hoistedNodeId ? isInDailyTree(hoistedNodeId) : false),
    [hoistedNodeId, isInDailyTree]
  );

  const handleGoToToday = useCallback(() => {
    void goToToday().catch((error) => {
      console.error('[TopNavigation] 跳转今日笔记失败:', error);
    });
  }, [goToToday]);

  return (
    <header className="h-14 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-800/50 flex-shrink-0 z-30">
      <div className="h-full px-6 flex items-center justify-between">
        {/* 左侧：Logo 和标题 */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <FileText size={18} className="text-white" />
          </div>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            {BRAND.name}
          </h1>
        </div>

        {/* 右侧：操作按钮和用户菜单 */}
        <div className="flex items-center gap-2">
          {/* 今日按钮 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className={cn(
                  "hover:bg-green-50",
                  isCalendarView ? "text-green-600" : "text-gray-500 hover:text-green-600"
                )}
                onClick={handleGoToToday}
              >
                <Calendar size={18} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>今日日记</TooltipContent>
          </Tooltip>

          {/* 同步状态指示器 */}
          <SyncStatusIndicator />

          {/* 分隔线 */}
          <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1" />

          {/* 用户菜单 */}
          <UserMenu />
        </div>
      </div>
    </header>
  );
});

TopNavigation.displayName = 'TopNavigation';

export default TopNavigation;
