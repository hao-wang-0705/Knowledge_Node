'use client';

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDate } from '@/utils/helpers';
import {
  AlertTriangle,
  Server,
  Laptop,
  GitMerge,
  Check,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { ConflictType, ConflictResolution } from '@/types';

/**
 * 冲突数据接口
 */
export interface ConflictData {
  /** 实体类型 */
  entityType: 'node' | 'notebook' | 'supertag';
  /** 实体 ID */
  entityId: string;
  /** 冲突类型 */
  conflictType: ConflictType;
  /** 本地版本数据 */
  localData: Record<string, unknown>;
  /** 服务器版本数据 */
  serverData: Record<string, unknown>;
  /** 本地版本号 */
  localVersion: number;
  /** 服务器版本号 */
  serverVersion: number;
  /** 本地修改时间 */
  localTimestamp: number;
  /** 服务器修改时间 */
  serverTimestamp: number;
}

/**
 * 冲突对话框属性
 */
interface ConflictDialogProps {
  /** 是否打开对话框 */
  open: boolean;
  /** 关闭对话框回调 */
  onOpenChange: (open: boolean) => void;
  /** 冲突数据 */
  conflict: ConflictData | null;
  /** 解决冲突回调 */
  onResolve: (resolution: ConflictResolution, mergedData?: Record<string, unknown>) => void;
}

/**
 * 字段差异对比组件
 */
const FieldDiff: React.FC<{
  fieldKey: string;
  localValue: unknown;
  serverValue: unknown;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ fieldKey, localValue, serverValue, isExpanded, onToggle }) => {
  const isDifferent = JSON.stringify(localValue) !== JSON.stringify(serverValue);
  
  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '(空)';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  if (!isDifferent) {
    return (
      <div className="flex items-center gap-2 py-1 text-sm text-gray-500">
        <Check size={14} className="text-green-500" />
        <span className="font-medium">{fieldKey}:</span>
        <span className="text-gray-600">{formatValue(localValue)}</span>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden mb-2">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 text-left hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown size={14} className="text-amber-600" />
        ) : (
          <ChevronRight size={14} className="text-amber-600" />
        )}
        <AlertTriangle size={14} className="text-amber-500" />
        <span className="font-medium text-amber-800 dark:text-amber-200">{fieldKey}</span>
        <Badge variant="secondary" className="ml-auto text-xs">
          有差异
        </Badge>
      </button>
      {isExpanded && (
        <div className="grid grid-cols-2 divide-x">
          <div className="p-3 bg-blue-50/50 dark:bg-blue-900/10">
            <div className="flex items-center gap-1 text-xs text-blue-600 mb-1">
              <Laptop size={12} />
              <span>本地版本</span>
            </div>
            <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
              {formatValue(localValue)}
            </pre>
          </div>
          <div className="p-3 bg-green-50/50 dark:bg-green-900/10">
            <div className="flex items-center gap-1 text-xs text-green-600 mb-1">
              <Server size={12} />
              <span>服务器版本</span>
            </div>
            <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
              {formatValue(serverValue)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * 冲突解决对话框组件
 * 
 * 当检测到本地数据与服务器数据版本冲突时显示此对话框，
 * 让用户选择保留哪个版本或进行智能合并。
 */
export const ConflictDialog: React.FC<ConflictDialogProps> = ({
  open,
  onOpenChange,
  conflict,
  onResolve,
}) => {
  const [selectedResolution, setSelectedResolution] = useState<ConflictResolution | null>(null);
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());

  // 获取所有字段的键
  const allFieldKeys = useMemo(() => {
    if (!conflict) return [];
    const localKeys = Object.keys(conflict.localData);
    const serverKeys = Object.keys(conflict.serverData);
    return Array.from(new Set([...localKeys, ...serverKeys]));
  }, [conflict]);

  // 统计差异字段数量
  const diffCount = useMemo(() => {
    if (!conflict) return 0;
    return allFieldKeys.filter(
      key => JSON.stringify(conflict.localData[key]) !== JSON.stringify(conflict.serverData[key])
    ).length;
  }, [conflict, allFieldKeys]);

  // 获取冲突类型显示文本
  const getConflictTypeText = (type: ConflictType): string => {
    switch (type) {
      case 'real':
        return '版本冲突';
      case 'safe-update':
        return '安全更新';
      case 'local-ahead':
        return '本地版本领先';
      case 'none':
        return '无冲突';
      default:
        return '数据冲突';
    }
  };

  // 获取实体类型显示文本
  const getEntityTypeText = (type: string): string => {
    switch (type) {
      case 'node':
        return '节点';
      case 'notebook':
        return '笔记本';
      case 'supertag':
        return '超级标签';
      default:
        return '项目';
    }
  };

  // 切换字段展开状态
  const toggleFieldExpanded = (key: string) => {
    setExpandedFields(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // 展开所有差异字段
  const expandAllDiffs = () => {
    const diffKeys = allFieldKeys.filter(
      key => conflict && JSON.stringify(conflict.localData[key]) !== JSON.stringify(conflict.serverData[key])
    );
    setExpandedFields(new Set(diffKeys));
  };

  // 处理解决冲突
  const handleResolve = () => {
    if (!selectedResolution || !conflict) return;
    
    // 如果选择智能合并，需要生成合并后的数据
    if (selectedResolution === 'merge') {
      const mergedData = smartMerge(conflict.localData, conflict.serverData);
      onResolve(selectedResolution, mergedData);
    } else {
      onResolve(selectedResolution);
    }
    
    // 重置状态
    setSelectedResolution(null);
    setExpandedFields(new Set());
  };

  // 智能合并逻辑
  const smartMerge = (
    local: Record<string, unknown>,
    server: Record<string, unknown>
  ): Record<string, unknown> => {
    const result: Record<string, unknown> = { ...server };
    
    // 合并策略：
    // 1. 如果服务器有值而本地为空，保留服务器值
    // 2. 如果本地有值而服务器为空，保留本地值
    // 3. 如果两者都有值且不同，优先保留较新的修改（这里简化为保留本地修改）
    for (const key of Object.keys(local)) {
      const localVal = local[key];
      const serverVal = server[key];
      
      if (serverVal === null || serverVal === undefined || serverVal === '') {
        result[key] = localVal;
      } else if (localVal !== null && localVal !== undefined && localVal !== '') {
        // 两者都有值，保留本地修改（假设本地是用户最新的意图）
        result[key] = localVal;
      }
    }
    
    return result;
  };

  if (!conflict) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="text-amber-500" size={20} />
            检测到数据冲突
          </DialogTitle>
          <DialogDescription>
            {getEntityTypeText(conflict.entityType)}「
            {String(conflict.localData?.content || '').substring(0, 20) || conflict.entityId}
            」存在{getConflictTypeText(conflict.conflictType)}，请选择如何处理。
          </DialogDescription>
        </DialogHeader>

        {/* 版本信息 */}
        <div className="grid grid-cols-2 gap-4 my-4">
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-medium mb-2">
              <Laptop size={16} />
              本地版本
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <div>版本号: v{conflict.localVersion}</div>
              <div>修改时间: {formatDate(conflict.localTimestamp)}</div>
            </div>
          </div>
          <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-300 font-medium mb-2">
              <Server size={16} />
              服务器版本
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <div>版本号: v{conflict.serverVersion}</div>
              <div>修改时间: {formatDate(conflict.serverTimestamp)}</div>
            </div>
          </div>
        </div>

        {/* 差异对比 */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              字段对比 ({diffCount} 处差异)
            </h4>
            {diffCount > 0 && (
              <Button variant="ghost" size="sm" onClick={expandAllDiffs}>
                展开所有差异
              </Button>
            )}
          </div>
          <div className="space-y-1">
            {allFieldKeys.map(key => (
              <FieldDiff
                key={key}
                fieldKey={key}
                localValue={conflict.localData[key]}
                serverValue={conflict.serverData[key]}
                isExpanded={expandedFields.has(key)}
                onToggle={() => toggleFieldExpanded(key)}
              />
            ))}
          </div>
        </div>

        {/* 解决方案选择 */}
        <div className="mt-4 pt-4 border-t">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            选择解决方案
          </h4>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setSelectedResolution('server-wins')}
              className={cn(
                "p-3 rounded-lg border-2 text-left transition-all",
                selectedResolution === 'server-wins'
                  ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
              )}
            >
              <div className="flex items-center gap-2 text-green-700 dark:text-green-300 font-medium mb-1">
                <Server size={16} />
                使用服务器版本
              </div>
              <p className="text-xs text-gray-500">
                放弃本地修改，使用服务器上的最新版本
              </p>
            </button>
            
            <button
              onClick={() => setSelectedResolution('local-wins')}
              className={cn(
                "p-3 rounded-lg border-2 text-left transition-all",
                selectedResolution === 'local-wins'
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
              )}
            >
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-medium mb-1">
                <Laptop size={16} />
                使用本地版本
              </div>
              <p className="text-xs text-gray-500">
                覆盖服务器数据，保留本地的修改
              </p>
            </button>
            
            <button
              onClick={() => setSelectedResolution('merge')}
              className={cn(
                "p-3 rounded-lg border-2 text-left transition-all",
                selectedResolution === 'merge'
                  ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
              )}
            >
              <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300 font-medium mb-1">
                <GitMerge size={16} />
                智能合并
              </div>
              <p className="text-xs text-gray-500">
                尝试合并两个版本的更改
              </p>
            </button>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            稍后处理
          </Button>
          <Button
            onClick={handleResolve}
            disabled={!selectedResolution}
            className={cn(
              selectedResolution === 'server-wins' && "bg-green-600 hover:bg-green-700",
              selectedResolution === 'local-wins' && "bg-blue-600 hover:bg-blue-700",
              selectedResolution === 'merge' && "bg-purple-600 hover:bg-purple-700"
            )}
          >
            <Check size={16} className="mr-2" />
            确认解决
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConflictDialog;
