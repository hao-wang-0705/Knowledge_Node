'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Link2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNodeStore } from '@/stores/nodeStore';
import { useSplitPaneStore } from '@/stores/splitPaneStore';
import { analyzeNavigationTarget } from '@/utils/navigation';
import { getPlainTextWithoutReferences } from '@/utils/reference-helpers';
import CompactBreadcrumb from './CompactBreadcrumb';
import { nodesApi } from '@/services/api/nodes';

interface BacklinksBadgeProps {
  nodeId: string;
  className?: string;
  onNodeClick?: (nodeId: string, e: React.MouseEvent) => void;
}

interface UnifiedBacklink {
  id: string;
  content: string;
  breadcrumbs: string[];
  sourceType: 'mention' | 'field';
  fieldKey?: string;
  createdAt: number;
}

/**
 * 反向链接徽标组件
 * - 显示为极简计数徽标（如 `[链接 3]`）
 * - 点击展开/折叠引用列表
 * - 合并普通反向链接和字段引用
 */
const BacklinksBadge: React.FC<BacklinksBadgeProps> = ({
  nodeId,
  className,
  onNodeClick,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [unifiedBacklinks, setUnifiedBacklinks] = useState<UnifiedBacklink[]>([]);

  const incomingRefCount = useNodeStore((state) => {
    let count = 0;
    for (const n of Object.values(state.nodes)) {
      if (n.references?.some((ref) => ref.targetNodeId === nodeId)) count += 1;
    }
    return count;
  });

  const nodes = useNodeStore((state) => state.nodes);
  const setFocusedNode = useNodeStore((state) => state.setFocusedNode);
  const setHoistedNode = useNodeStore((state) => state.setHoistedNode);
  // 右侧面板状态
  const splitPaneIsOpen = useSplitPaneStore((state) => state.isOpen);
  const openPanel = useSplitPaneStore((state) => state.openPanel);
  const navigateInPanel = useSplitPaneStore((state) => state.navigateInPanel);

  useEffect(() => {
    let cancelled = false;
    nodesApi
      .getMentionedBy(nodeId)
      .then((items) => {
        if (cancelled) return;
        const mapped = items
          .filter((item) => item.node.id !== nodeId)
          .map((item) => {
            const plainContent = getPlainTextWithoutReferences(item.node.content || '');
            const displayContent = plainContent.length > 50 ? `${plainContent.slice(0, 50)}…` : plainContent;
            return {
              id: item.node.id,
              content: displayContent,
              breadcrumbs: item.breadcrumbs.map((crumb) => {
                const content = crumb.title || '未命名';
                return content.length > 12 ? `${content.slice(0, 12)}…` : content;
              }).slice(-2),
              sourceType: item.sourceType,
              fieldKey: item.fieldKey,
              createdAt: item.node.createdAt,
            } as UnifiedBacklink;
          })
          .sort((a, b) => b.createdAt - a.createdAt);
        setUnifiedBacklinks(mapped);
      })
      .catch(() => {
        if (!cancelled) setUnifiedBacklinks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [nodeId, incomingRefCount]);

  const totalCount = unifiedBacklinks.length;

  const handleBadgeClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(prev => !prev);
  }, []);

  // 默认跳转逻辑
  const handleDefaultJump = useCallback((targetNodeId: string) => {
    const targetNode = nodes[targetNodeId];
    if (!targetNode) return;
    const target = analyzeNavigationTarget(targetNode, nodes);
    if (target.hoistNodeId) setHoistedNode(target.hoistNodeId);
    setFocusedNode(target.nodeId);
  }, [nodes, setHoistedNode, setFocusedNode]);

  const handleItemClick = useCallback((targetNodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // 检测修饰键
    const isModifierClick = e.metaKey || e.ctrlKey;
    
    if (isModifierClick) {
      // Cmd/Ctrl + Click: 在右侧面板中打开
      if (splitPaneIsOpen) {
        navigateInPanel(targetNodeId);
      } else {
        openPanel(targetNodeId);
      }
      setIsExpanded(false);
      return;
    }
    
    // 如果有自定义点击处理，使用自定义处理
    if (onNodeClick) {
      onNodeClick(targetNodeId, e);
    } else {
      handleDefaultJump(targetNodeId);
    }
    setIsExpanded(false);
  }, [onNodeClick, handleDefaultJump, splitPaneIsOpen, openPanel, navigateInPanel]);
  
  // 无反向链接时不显示
  if (totalCount === 0) {
    return null;
  }

  return (
    <div className={cn('relative inline-flex flex-col items-start', className)}>
      {/* 计数徽标 */}
      <button
        onClick={handleBadgeClick}
        className={cn(
          'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px]',
          'transition-all duration-150',
          'hover:bg-blue-100 dark:hover:bg-blue-900/30',
          isExpanded 
            ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' 
            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
        )}
      >
        <Link2 size={10} className="flex-shrink-0" />
        <span>{totalCount}</span>
        {isExpanded ? (
          <ChevronUp size={10} className="flex-shrink-0" />
        ) : (
          <ChevronDown size={10} className="flex-shrink-0" />
        )}
      </button>

      {/* 展开的引用列表 */}
      {isExpanded && (
        <div className={cn(
          'absolute top-full left-0 mt-1 z-50 min-w-[280px] max-w-[360px]',
          'bg-white dark:bg-gray-900 rounded-lg shadow-lg',
          'border border-gray-200 dark:border-gray-700',
          'py-1.5 max-h-[300px] overflow-y-auto'
        )}>
          {unifiedBacklinks.map((link) => (
            <button
              key={`${link.id}-${link.fieldKey || 'mention'}`}
              onClick={(e) => handleItemClick(link.id, e)}
              className={cn(
                'w-full text-left px-3 py-2 transition-colors',
                'hover:bg-gray-50 dark:hover:bg-gray-800/50'
              )}
            >
              {/* 面包屑 + 来源类型前缀 - 同行显示 */}
              <div className="flex items-center gap-1.5 mb-0.5">
                {/* 来源类型标记 */}
                <span className={cn(
                  'text-[9px] px-1 py-0.5 rounded flex-shrink-0',
                  link.sourceType === 'field'
                    ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                )}>
                  {link.sourceType === 'field' ? `字段:${link.fieldKey}` : '提及'}
                </span>
                
                {/* 紧凑面包屑 */}
                {link.breadcrumbs.length > 0 && (
                  <CompactBreadcrumb breadcrumbs={link.breadcrumbs} />
                )}
              </div>
              
              {/* 节点内容 */}
              <div className="text-sm text-gray-700 dark:text-gray-300 leading-snug truncate">
                {link.content || '(空内容)'}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default BacklinksBadge;
