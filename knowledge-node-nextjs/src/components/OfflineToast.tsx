/**
 * 离线提示组件
 * 
 * 当网络状态变化时显示友好的提示信息，
 * 包括网络断开提醒和恢复通知。
 */

'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useSyncStore } from '@/stores/syncStore';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { WifiOff, Wifi, X, RefreshCw, Cloud } from 'lucide-react';

// =============================================================================
// 类型定义
// =============================================================================

export interface OfflineToastProps {
  /** 额外的 CSS 类名 */
  className?: string;
  /** 提示显示时长（毫秒），0 表示不自动关闭 */
  duration?: number;
  /** 位置 */
  position?: 'top' | 'bottom';
}

type ToastState = 'hidden' | 'offline' | 'online' | 'syncing' | 'synced';

// =============================================================================
// 组件实现
// =============================================================================

export const OfflineToast: React.FC<OfflineToastProps> = ({
  className,
  duration = 5000,
  position = 'bottom',
}) => {
  const [toastState, setToastState] = useState<ToastState>('hidden');
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevOnlineRef = useRef<boolean | null>(null);
  
  // Store 和 Hook
  const pendingCount = useSyncStore((state) => state.pendingOperations.length);
  const syncStatus = useSyncStore((state) => state.status);
  
  // 网络状态变化处理
  const handleNetworkChange = useCallback((online: boolean) => {
    // 跳过首次初始化
    if (prevOnlineRef.current === null) {
      prevOnlineRef.current = online;
      return;
    }
    
    // 状态未变化
    if (prevOnlineRef.current === online) {
      return;
    }
    
    prevOnlineRef.current = online;
    
    // 清除之前的定时器
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    if (online) {
      // 网络恢复
      setToastState('online');
      setIsVisible(true);
      
      // 如果有待同步数据，延迟后显示同步状态
      if (pendingCount > 0) {
        timeoutRef.current = setTimeout(() => {
          setToastState('syncing');
        }, 1500);
      } else if (duration > 0) {
        timeoutRef.current = setTimeout(() => {
          setIsVisible(false);
        }, duration);
      }
    } else {
      // 网络断开
      setToastState('offline');
      setIsVisible(true);
      
      // 离线状态不自动关闭
    }
  }, [duration, pendingCount]);
  
  // 使用网络状态 Hook
  useNetworkStatus({
    onStatusChange: handleNetworkChange,
    autoProcessQueue: true,
  });
  
  // 监听同步状态变化
  useEffect(() => {
    if (toastState === 'syncing' && syncStatus === 'synced') {
      setToastState('synced');
      
      if (duration > 0) {
        timeoutRef.current = setTimeout(() => {
          setIsVisible(false);
        }, duration);
      }
    }
  }, [syncStatus, toastState, duration]);
  
  // 清理
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  // 关闭处理
  const handleClose = useCallback(() => {
    setIsVisible(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);
  
  // 不显示时返回 null
  if (!isVisible) {
    return null;
  }
  
  // 获取配置
  const config = getToastConfig(toastState, pendingCount);
  
  return (
    <div
      className={cn(
        'fixed left-1/2 -translate-x-1/2 z-50',
        'flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg',
        'transform transition-all duration-300 ease-out',
        position === 'top' ? 'top-4' : 'bottom-4',
        isVisible ? 'translate-y-0 opacity-100' : 
          position === 'top' ? '-translate-y-2 opacity-0' : 'translate-y-2 opacity-0',
        config.bgColor,
        config.borderColor,
        'border',
        className
      )}
      role="alert"
      aria-live="polite"
    >
      {/* 图标 */}
      <config.icon
        className={cn(
          'w-5 h-5 flex-shrink-0',
          config.iconColor,
          config.animate
        )}
      />
      
      {/* 内容 */}
      <div className="flex flex-col min-w-0">
        <span className={cn('font-medium text-sm', config.textColor)}>
          {config.title}
        </span>
        <span className="text-xs text-gray-500 truncate">
          {config.description}
        </span>
      </div>
      
      {/* 关闭按钮（离线状态不显示） */}
      {toastState !== 'offline' && (
        <button
          onClick={handleClose}
          className={cn(
            'ml-2 p-1 rounded-full transition-colors',
            'hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-offset-2',
            config.closeButtonColor
          )}
          aria-label="关闭"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

// =============================================================================
// 配置获取
// =============================================================================

interface ToastConfig {
  icon: React.ElementType;
  iconColor: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  closeButtonColor: string;
  title: string;
  description: string;
  animate?: string;
}

function getToastConfig(state: ToastState, pendingCount: number): ToastConfig {
  switch (state) {
    case 'offline':
      return {
        icon: WifiOff,
        iconColor: 'text-orange-500',
        textColor: 'text-orange-700',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200',
        closeButtonColor: 'text-orange-400 focus:ring-orange-500',
        title: '网络已断开',
        description: pendingCount > 0
          ? `${pendingCount} 个更改待同步，联网后自动同步`
          : '您的更改将在联网后自动同步',
      };
    
    case 'online':
      return {
        icon: Wifi,
        iconColor: 'text-green-500',
        textColor: 'text-green-700',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        closeButtonColor: 'text-green-400 focus:ring-green-500',
        title: '网络已恢复',
        description: pendingCount > 0
          ? '正在同步离线期间的更改...'
          : '连接已恢复',
      };
    
    case 'syncing':
      return {
        icon: RefreshCw,
        iconColor: 'text-blue-500',
        textColor: 'text-blue-700',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        closeButtonColor: 'text-blue-400 focus:ring-blue-500',
        title: '正在同步',
        description: `同步 ${pendingCount} 个离线更改...`,
        animate: 'animate-spin',
      };
    
    case 'synced':
      return {
        icon: Cloud,
        iconColor: 'text-green-500',
        textColor: 'text-green-700',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        closeButtonColor: 'text-green-400 focus:ring-green-500',
        title: '同步完成',
        description: '所有更改已保存到云端',
      };
    
    default:
      return {
        icon: Cloud,
        iconColor: 'text-gray-400',
        textColor: 'text-gray-600',
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-200',
        closeButtonColor: 'text-gray-400 focus:ring-gray-500',
        title: '',
        description: '',
      };
  }
}

// =============================================================================
// 简化版离线横幅
// =============================================================================

export const OfflineBanner: React.FC<{ className?: string }> = ({ className }) => {
  const { isOnline } = useNetworkStatus({ autoProcessQueue: false });
  const pendingCount = useSyncStore((state) => state.pendingOperations.length);
  
  if (isOnline) {
    return null;
  }
  
  return (
    <div
      className={cn(
        'w-full px-4 py-2 bg-orange-50 border-b border-orange-200',
        'flex items-center justify-center gap-2 text-sm text-orange-700',
        className
      )}
    >
      <WifiOff className="w-4 h-4" />
      <span>
        离线模式
        {pendingCount > 0 && `（${pendingCount} 个待同步）`}
      </span>
    </div>
  );
};

export default OfflineToast;
