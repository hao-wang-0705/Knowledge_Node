/**
 * 网络状态检测 Hook
 * 
 * 监听浏览器 online/offline 事件，自动更新 syncStore 状态，
 * 并在网络恢复时触发离线队列处理。
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSyncStore } from '@/stores/syncStore';

// =============================================================================
// 类型定义
// =============================================================================

export interface NetworkStatusOptions {
  /** 网络恢复后是否自动处理队列 */
  autoProcessQueue?: boolean;
  /** 网络恢复后处理队列的延迟（毫秒） */
  processDelay?: number;
  /** 网络状态变化回调 */
  onStatusChange?: (isOnline: boolean) => void;
}

export interface NetworkStatusResult {
  /** 当前是否在线 */
  isOnline: boolean;
  /** 上次离线时间 */
  lastOfflineAt: number | null;
  /** 上次恢复在线时间 */
  lastOnlineAt: number | null;
  /** 离线持续时间（毫秒），如果当前在线则为 null */
  offlineDuration: number | null;
  /** 手动检查网络状态 */
  checkConnection: () => Promise<boolean>;
}

// =============================================================================
// 常量
// =============================================================================

const DEFAULT_OPTIONS: Required<NetworkStatusOptions> = {
  autoProcessQueue: true,
  processDelay: 1000,
  onStatusChange: () => {},
};

// =============================================================================
// Hook 实现
// =============================================================================

/**
 * 网络状态检测 Hook
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isOnline, offlineDuration } = useNetworkStatus({
 *     autoProcessQueue: true,
 *     onStatusChange: (online) => {
 *       if (online) {
 *         toast.success('网络已恢复');
 *       } else {
 *         toast.warning('网络已断开');
 *       }
 *     },
 *   });
 *   
 *   return <div>{isOnline ? '在线' : '离线'}</div>;
 * }
 * ```
 */
export function useNetworkStatus(
  options: NetworkStatusOptions = {}
): NetworkStatusResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Store 状态
  const setOnline = useSyncStore((state) => state.setOnline);
  const processQueue = useSyncStore((state) => state.processQueue);
  const pendingCount = useSyncStore((state) => state.pendingOperations.length);
  
  // 本地状态
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator !== 'undefined') {
      return navigator.onLine;
    }
    return true;
  });
  
  const [lastOfflineAt, setLastOfflineAt] = useState<number | null>(null);
  const [lastOnlineAt, setLastOnlineAt] = useState<number | null>(null);
  
  // 使用 ref 避免闭包问题
  const processTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);
  
  // 计算离线持续时间
  const offlineDuration = !isOnline && lastOfflineAt
    ? Date.now() - lastOfflineAt
    : null;
  
  // 处理网络恢复
  const handleOnline = useCallback(() => {
    console.log('[useNetworkStatus] 网络已恢复');
    
    const now = Date.now();
    setIsOnline(true);
    setLastOnlineAt(now);
    setOnline(true);
    
    opts.onStatusChange?.(true);
    
    // 自动处理离线队列
    if (opts.autoProcessQueue && pendingCount > 0) {
      // 清除之前的定时器
      if (processTimeoutRef.current) {
        clearTimeout(processTimeoutRef.current);
      }
      
      // 延迟处理，确保网络稳定
      processTimeoutRef.current = setTimeout(() => {
        console.log('[useNetworkStatus] 开始处理离线队列');
        processQueue();
      }, opts.processDelay);
    }
  }, [setOnline, processQueue, pendingCount, opts]);
  
  // 处理网络断开
  const handleOffline = useCallback(() => {
    console.log('[useNetworkStatus] 网络已断开');
    
    const now = Date.now();
    setIsOnline(false);
    setLastOfflineAt(now);
    setOnline(false);
    
    opts.onStatusChange?.(false);
    
    // 清除待处理的队列处理
    if (processTimeoutRef.current) {
      clearTimeout(processTimeoutRef.current);
      processTimeoutRef.current = null;
    }
  }, [setOnline, opts]);
  
  // 手动检查网络连接
  const checkConnection = useCallback(async (): Promise<boolean> => {
    try {
      // 尝试请求一个小资源来验证网络
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch('/api/health', {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-store',
      });
      
      clearTimeout(timeoutId);
      
      const online = response.ok;
      
      if (online !== isOnline) {
        if (online) {
          handleOnline();
        } else {
          handleOffline();
        }
      }
      
      return online;
    } catch {
      // 请求失败，可能是离线
      if (isOnline) {
        handleOffline();
      }
      return false;
    }
  }, [isOnline, handleOnline, handleOffline]);
  
  // 设置事件监听
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    
    // 初始化
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      
      // 设置初始状态
      const online = navigator.onLine;
      setIsOnline(online);
      setOnline(online);
      
      if (!online) {
        setLastOfflineAt(Date.now());
      }
    }
    
    // 添加事件监听
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // 清理
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      
      if (processTimeoutRef.current) {
        clearTimeout(processTimeoutRef.current);
      }
    };
  }, [handleOnline, handleOffline, setOnline]);
  
  return {
    isOnline,
    lastOfflineAt,
    lastOnlineAt,
    offlineDuration,
    checkConnection,
  };
}

// =============================================================================
// 辅助 Hook
// =============================================================================

/**
 * 简化版网络状态 Hook（只返回在线状态）
 */
export function useIsOnline(): boolean {
  const { isOnline } = useNetworkStatus({ autoProcessQueue: false });
  return isOnline;
}

/**
 * 网络状态变化监听 Hook
 */
export function useNetworkStatusChange(
  callback: (isOnline: boolean) => void
): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  
  useNetworkStatus({
    onStatusChange: (online) => callbackRef.current(online),
  });
}

export default useNetworkStatus;
