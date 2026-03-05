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
import { logoStyles, topNavStyles, buttonStyles } from '@/styles/visual-tokens';

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
    <header className="top-nav">
      <div className="top-nav-inner">
        {/* 左侧：Logo 和标题 */}
        <div className="top-nav-brand">
          <div className={cn(logoStyles.container, logoStyles.gradient)}>
            <FileText size={18} className={logoStyles.icon} />
          </div>
          <h1 className="top-nav-title">
            {BRAND.name}
          </h1>
        </div>

        {/* 右侧：操作按钮和用户菜单 */}
        <div className={topNavStyles.actions}>
          {/* 今日按钮 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className={cn(
                  isCalendarView 
                    ? buttonStyles.brandHighlight
                    : 'text-gray-500 hover:text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/10'
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
          <div className={topNavStyles.divider} />

          {/* 用户菜单 */}
          <UserMenu />
        </div>
      </div>
    </header>
  );
});

TopNavigation.displayName = 'TopNavigation';

export default TopNavigation;
