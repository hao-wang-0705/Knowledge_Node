/**
 * 同步状态指示器组件
 * 
 * 显示当前数据同步状态，支持 5 种状态：
 * - idle: 空闲（灰色云图标）
 * - syncing: 同步中（蓝色旋转图标）
 * - synced: 已同步（绿色勾号）
 * - error: 同步失败（红色警告，可点击重试）
 * - offline: 离线（橙色断网图标）
 */

'use client';

import React, { useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useSyncStore, getSyncStatusDescription } from '@/stores/syncStore';
import { SyncStatus } from '@/types/sync';
import {
  Cloud,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  WifiOff,
  RotateCcw,
} from 'lucide-react';

// =============================================================================
// 类型定义
// =============================================================================

export interface SyncStatusIndicatorProps {
  /** 额外的 CSS 类名 */
  className?: string;
  /** 是否显示文字标签 */
  showLabel?: boolean;
  /** 尺寸大小 */
  size?: 'sm' | 'md' | 'lg';
  /** 是否显示待同步数量徽标 */
  showBadge?: boolean;
  /** 点击时的回调（默认：错误时重试） */
  onClick?: () => void;
}

// =============================================================================
// 状态配置
// =============================================================================

interface StatusConfig {
  icon: React.ElementType;
  color: string;
  bgColor: string;
  label: string;
  tooltip: string;
  animate?: string;
}

const statusConfigs: Record<SyncStatus, StatusConfig> = {
  idle: {
    icon: Cloud,
    color: 'text-gray-400',
    bgColor: 'bg-gray-100 hover:bg-gray-200',
    label: '就绪',
    tooltip: '数据已保存',
  },
  syncing: {
    icon: RefreshCw,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50 hover:bg-blue-100',
    label: '同步中...',
    tooltip: '正在保存数据',
    animate: 'animate-spin',
  },
  synced: {
    icon: CheckCircle2,
    color: 'text-green-500',
    bgColor: 'bg-green-50 hover:bg-green-100',
    label: '已同步',
    tooltip: '数据已安全保存到云端',
  },
  error: {
    icon: AlertCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-50 hover:bg-red-100',
    label: '同步失败',
    tooltip: '点击重试同步',
  },
  offline: {
    icon: WifiOff,
    color: 'text-orange-500',
    bgColor: 'bg-orange-50 hover:bg-orange-100',
    label: '离线',
    tooltip: '网络断开，数据已保存到本地，联网后自动同步',
  },
};

const sizeConfigs = {
  sm: {
    icon: 'w-3.5 h-3.5',
    badge: 'w-4 h-4 text-[10px]',
    padding: 'p-1.5',
    text: 'text-xs',
    gap: 'gap-1',
  },
  md: {
    icon: 'w-4 h-4',
    badge: 'w-5 h-5 text-xs',
    padding: 'p-2',
    text: 'text-sm',
    gap: 'gap-1.5',
  },
  lg: {
    icon: 'w-5 h-5',
    badge: 'w-6 h-6 text-sm',
    padding: 'p-2.5',
    text: 'text-base',
    gap: 'gap-2',
  },
};

// =============================================================================
// 组件实现
// =============================================================================

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
  className,
  showLabel = false,
  size = 'md',
  showBadge = true,
  onClick,
}) => {
  // Store 状态
  const status = useSyncStore((state) => state.status);
  const error = useSyncStore((state) => state.error);
  const pendingCount = useSyncStore((state) => state.pendingOperations.length);
  const retryFailed = useSyncStore((state) => state.retryFailed);
  const lastSyncAt = useSyncStore((state) => state.lastSyncAt);
  
  // 获取配置
  const config = statusConfigs[status];
  const sizeConfig = sizeConfigs[size];
  
  // 格式化时间
  const lastSyncText = useMemo(() => {
    if (!lastSyncAt) return null;
    
    const diff = Date.now() - lastSyncAt;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    return new Date(lastSyncAt).toLocaleDateString();
  }, [lastSyncAt]);
  
  // 点击处理
  const handleClick = useCallback(() => {
    if (onClick) {
      onClick();
      return;
    }
    
    // 默认行为：错误时重试
    if (status === 'error') {
      retryFailed();
    }
  }, [onClick, status, retryFailed]);
  
  // 判断是否可点击
  const isClickable = onClick || status === 'error';
  
  // 构建 tooltip 内容
  const tooltipContent = useMemo(() => {
    let content = config.tooltip;
    
    if (status === 'error' && error) {
      content = `${error}。点击重试`;
    }
    
    if (status === 'offline' && pendingCount > 0) {
      content = `${config.tooltip}（${pendingCount} 个待同步）`;
    }
    
    if (status === 'synced' && lastSyncText) {
      content = `${config.tooltip}（${lastSyncText}）`;
    }
    
    return content;
  }, [config.tooltip, status, error, pendingCount, lastSyncText]);
  
  const IconComponent = config.icon;
  
  return (
    <div
      className={cn(
        'relative inline-flex items-center rounded-lg transition-colors',
        sizeConfig.padding,
        sizeConfig.gap,
        config.bgColor,
        isClickable && 'cursor-pointer',
        className
      )}
      onClick={isClickable ? handleClick : undefined}
      title={tooltipContent}
      role={isClickable ? 'button' : 'status'}
      aria-label={getSyncStatusDescription(status)}
    >
      {/* 图标 */}
      <IconComponent
        className={cn(
          sizeConfig.icon,
          config.color,
          config.animate
        )}
      />
      
      {/* 文字标签 */}
      {showLabel && (
        <span className={cn(sizeConfig.text, config.color, 'font-medium')}>
          {config.label}
        </span>
      )}
      
      {/* 待同步数量徽标 */}
      {showBadge && pendingCount > 0 && status !== 'syncing' && (
        <span
          className={cn(
            'absolute -top-1 -right-1 flex items-center justify-center',
            'rounded-full bg-orange-500 text-white font-medium',
            sizeConfig.badge
          )}
        >
          {pendingCount > 99 ? '99+' : pendingCount}
        </span>
      )}
      
      {/* 错误状态下的重试图标 */}
      {status === 'error' && (
        <RotateCcw
          className={cn(
            'ml-1',
            sizeConfig.icon,
            'text-red-400 hover:text-red-600 transition-colors'
          )}
        />
      )}
    </div>
  );
};

// =============================================================================
// 紧凑版组件（仅图标）
// =============================================================================

export const SyncStatusIcon: React.FC<{
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}> = ({ className, size = 'md' }) => {
  const status = useSyncStore((state) => state.status);
  const config = statusConfigs[status];
  const sizeConfig = sizeConfigs[size];
  
  const IconComponent = config.icon;
  
  return (
    <IconComponent
      className={cn(
        sizeConfig.icon,
        config.color,
        config.animate,
        className
      )}
      title={config.tooltip}
    />
  );
};

// =============================================================================
// 同步状态文本组件
// =============================================================================

export const SyncStatusText: React.FC<{
  className?: string;
}> = ({ className }) => {
  const status = useSyncStore((state) => state.status);
  const pendingCount = useSyncStore((state) => state.pendingOperations.length);
  const config = statusConfigs[status];
  
  let text = config.label;
  if (status === 'offline' && pendingCount > 0) {
    text = `离线（${pendingCount} 待同步）`;
  }
  
  return (
    <span className={cn('text-sm', config.color, className)}>
      {text}
    </span>
  );
};

export default SyncStatusIndicator;
