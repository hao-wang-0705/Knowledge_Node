'use client';

import React, { memo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import Sidebar from '@/components/Sidebar';
import CommandCenter from '@/components/CommandCenter';
import TopNavigation from './TopNavigation';
import MainContentWrapper from './MainContentWrapper';
import { SplitPaneProvider } from '@/components/split-pane';

interface GlobalLayoutProps {
  /** 页面子内容 */
  children: React.ReactNode;
}

/**
 * 全局布局组件
 * 作为所有页面的外层框架，包含顶部导航和侧边栏
 * 根据路由判断是否显示查询面板
 */
const GlobalLayout: React.FC<GlobalLayoutProps> = memo(({ children }) => {
  const pathname = usePathname();
  const [showCommandCenter, setShowCommandCenter] = useState(false);

  // 根据路由判断是否显示查询面板
  // 只在笔记主页面（/）显示查询面板
  const showQueryPanel = pathname === '/';

  return (
    <TooltipProvider>
      <div className="h-screen flex flex-col bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
        {/* 全局顶部导航 */}
        <TopNavigation />

        {/* 主体区域：侧边栏 + 内容区 */}
        <div className="flex-1 flex min-h-0">
          {/* 左侧侧边栏 - 全局显示 */}
          <Sidebar 
            className="w-64 flex-shrink-0" 
            onOpenCommandCenter={() => setShowCommandCenter(true)}
          />

          {/* 右侧内容区域 */}
          <SplitPaneProvider>
            <MainContentWrapper showQueryPanel={showQueryPanel}>
              {children}
            </MainContentWrapper>
          </SplitPaneProvider>
        </div>

        {/* 全局指令中心 */}
        <CommandCenter
          open={showCommandCenter}
          onOpenChange={setShowCommandCenter}
        />
      </div>
    </TooltipProvider>
  );
});

GlobalLayout.displayName = 'GlobalLayout';

export default GlobalLayout;
