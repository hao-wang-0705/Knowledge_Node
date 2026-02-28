'use client';

import React, { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { 
  User, 
  LogOut, 
  Settings, 
  ChevronDown,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface UserMenuProps {
  className?: string;
}

/**
 * 用户菜单组件
 * 
 * 功能：
 * 1. 显示当前登录用户的头像、名称和邮箱
 * 2. 提供下拉菜单包含账户设置和登出功能
 * 3. 加载中和未登录状态的友好展示
 */
export function UserMenu({ className }: UserMenuProps) {
  const { data: session, status } = useSession();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // 处理登出
  const handleSignOut = async () => {
    setIsLoggingOut(true);
    try {
      await signOut({ 
        callbackUrl: '/login',
        redirect: true,
      });
    } catch (error) {
      console.error('登出失败:', error);
      setIsLoggingOut(false);
    }
  };

  // 加载中状态
  if (status === 'loading') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div className="hidden sm:block">
          <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  // 未登录状态（理论上不会出现，因为中间件会重定向）
  if (status === 'unauthenticated' || !session?.user) {
    return (
      <Button 
        variant="ghost" 
        size="sm"
        className={cn('gap-2', className)}
        onClick={() => window.location.href = '/login'}
      >
        <User size={16} />
        <span className="hidden sm:inline">登录</span>
      </Button>
    );
  }

  const { user } = session;
  
  // 获取用户头像显示内容（首字母或默认图标）
  const avatarContent = user.name 
    ? user.name.charAt(0).toUpperCase() 
    : user.email.charAt(0).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm"
          className={cn(
            'gap-2 px-2 hover:bg-gray-100 dark:hover:bg-gray-800',
            className
          )}
          disabled={isLoggingOut}
        >
          {/* 用户头像 */}
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-sm font-medium shadow-sm"
            style={{
              background: 'linear-gradient(135deg, var(--brand-primary) 0%, oklch(0.45 0.2 265) 100%)',
            }}
          >
            {avatarContent}
          </div>
          
          {/* 用户名称（桌面端显示） */}
          <span className="hidden sm:inline text-sm font-medium text-gray-700 dark:text-gray-200 max-w-[120px] truncate">
            {user.name || user.email.split('@')[0]}
          </span>
          
          <ChevronDown size={14} className="text-gray-500" />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-56">
        {/* 用户信息区域 */}
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {user.name || '用户'}
            </p>
            <p className="text-xs leading-none text-gray-500 dark:text-gray-400">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />
        
        {/* 账户设置 */}
        <DropdownMenuItem 
          className="cursor-pointer"
          disabled
        >
          <Settings size={16} className="mr-2" />
          <span>账户设置</span>
          <span className="ml-auto text-xs text-gray-400">即将上线</span>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {/* 登出按钮 */}
        <DropdownMenuItem 
          className="cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400 focus:bg-red-50 dark:focus:bg-red-950/50"
          onClick={handleSignOut}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? (
            <>
              <Loader2 size={16} className="mr-2 animate-spin" />
              <span>正在登出...</span>
            </>
          ) : (
            <>
              <LogOut size={16} className="mr-2" />
              <span>退出登录</span>
            </>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default UserMenu;
