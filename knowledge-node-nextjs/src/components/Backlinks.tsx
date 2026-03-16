'use client';

import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { Link2, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNodeStore } from '@/stores/nodeStore';
import { analyzeNavigationTarget } from '@/utils/navigation';
import { getPlainTextWithoutReferences } from '@/utils/reference-helpers';
import CompactBreadcrumb from './CompactBreadcrumb';
import { nodesApi } from '@/services/api/nodes';

interface BacklinksProps {
  nodeId: string;
  className?: string;
  /** 默认是否展开，默认 false */
  defaultExpanded?: boolean;
  /** 是否显示折叠控制，默认 true */
  collapsible?: boolean;
  /** 点击节点的回调，用于支持右侧面板打开 */
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
 * 反向链接组件 v2.2
 * - 合并"普通反向链接"与"通过字段引用"为单一列表
 * - 使用轻量级前缀区分来源类别
 * - 支持折叠/展开
 * - 紧凑面包屑与标题同行显示
 */
const Backlinks: React.FC<BacklinksProps> = ({
  nodeId,
  className,
  defaultExpanded = false,
  collapsible = true,
  onNodeClick,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [unifiedBacklinks, setUnifiedBacklinks] = useState<UnifiedBacklink[]>([]);
  
  const nodes = useNodeStore((state) => state.nodes);
  const setFocusedNode = useNodeStore((state) => state.setFocusedNode);
  const setHoistedNode = useNodeStore((state) => state.setHoistedNode);

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
  }, [nodeId]);

  const totalCount = unifiedBacklinks.length;

  const handleDefaultJump = useCallback((targetNodeId: string) => {
    const targetNode = nodes[targetNodeId];
    if (!targetNode) return;
    const target = analyzeNavigationTarget(targetNode, nodes);
    if (target.hoistNodeId) setHoistedNode(target.hoistNodeId);
    setFocusedNode(target.nodeId);
  }, [nodes, setHoistedNode, setFocusedNode]);

  // 点击处理
  const handleItemClick = useCallback((targetNodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // 如果有自定义点击处理，优先使用
    if (onNodeClick) {
      onNodeClick(targetNodeId, e);
    } else {
      handleDefaultJump(targetNodeId);
    }
  }, [onNodeClick, handleDefaultJump]);

  // 无反向链接时不显示
  if (totalCount === 0) {
    return null;
  }

  return (
    <div className={cn('pt-2', className)}>
      {/* 标题区域 - 可点击折叠 */}
      <button
        onClick={() => collapsible && setIsExpanded(prev => !prev)}
        className={cn(
          'flex items-center gap-1.5 w-full text-left mb-2',
          collapsible && 'cursor-pointer hover:opacity-80',
          !collapsible && 'cursor-default'
        )}
      >
        <Link2 size={12} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
        <span className="text-xs text-gray-500 dark:text-gray-400">
          链接
        </span>
        <span className={cn(
          'px-1.5 py-0.5 text-[10px] rounded-full',
          'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
        )}>
          {totalCount}
        </span>
        
        {collapsible && (
          <span className="ml-auto">
            {isExpanded ? (
              <ChevronUp size={12} className="text-gray-400" />
            ) : (
              <ChevronDown size={12} className="text-gray-400" />
            )}
          </span>
        )}
      </button>

      {/* 合并后的引用列表 */}
      {(isExpanded || !collapsible) && (
        <div className="space-y-1">
          {unifiedBacklinks.map((link) => (
            <button
              key={`${link.id}-${link.fieldKey || 'mention'}`}
              onClick={(e) => handleItemClick(link.id, e)}
              className={cn(
                'w-full text-left px-2 py-1.5 rounded-md transition-colors',
                'hover:bg-gray-50 dark:hover:bg-gray-800/50',
                'group'
              )}
            >
              {/* 来源类型前缀 + 面包屑 + 内容 - 紧凑布局 */}
              <div className="flex items-center gap-1.5 min-w-0">
                {/* 来源类型标记 */}
                <span className={cn(
                  'text-[9px] px-1 py-0.5 rounded flex-shrink-0',
                  link.sourceType === 'field'
                    ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-500 dark:text-purple-400'
                    : 'bg-gray-50 dark:bg-gray-800/50 text-gray-400 dark:text-gray-500'
                )}>
                  {link.sourceType === 'field' ? link.fieldKey : '提及'}
                </span>
                
                {/* 紧凑面包屑 - 与内容同行 */}
                {link.breadcrumbs.length > 0 && (
                  <CompactBreadcrumb breadcrumbs={link.breadcrumbs} />
                )}
                
                {/* 分隔符 */}
                {link.breadcrumbs.length > 0 && (
                  <ChevronRight size={8} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />
                )}
                
                {/* 节点内容 */}
                <span className="text-xs text-gray-600 dark:text-gray-300 truncate flex-1 min-w-0">
                  {link.content || '(空)'}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Backlinks;
