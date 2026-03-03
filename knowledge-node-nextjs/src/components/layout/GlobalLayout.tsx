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

// 认证页面路径列表 - 这些页面不需要显示侧边栏和顶导航
const AUTH_ROUTES = ['/login', '/register'];

/**
 * 全局布局组件
 * 作为所有页面的外层框架，包含顶部导航和侧边栏
 * 根据路由判断是否显示查询面板
 * 认证页面（登录/注册）不显示侧边栏和顶导航
 */
const GlobalLayout: React.FC<GlobalLayoutProps> = memo(({ children }) => {
  const pathname = usePathname();
  const [showCommandCenter, setShowCommandCenter] = useState(false);

  // 检测是否为认证页面
  const isAuthPage = AUTH_ROUTES.includes(pathname);

  // 根据路由判断是否显示查询面板
  // 只在笔记主页面（/）显示查询面板
  const showQueryPanel = pathname === '/';

  // 认证页面直接返回 children，不渲染侧边栏和顶导航
  if (isAuthPage) {
    return <>{children}</>;
  }

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
