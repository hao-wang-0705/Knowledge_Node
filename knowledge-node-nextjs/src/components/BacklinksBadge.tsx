'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { Link2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNodeStore } from '@/stores/nodeStore';
import { useNotebookStore } from '@/stores/notebookStore';
import { useSplitPaneStore } from '@/stores/splitPaneStore';
import { Node } from '@/types';
import { SYSTEM_TAGS } from '@/utils/date-helpers';
import { findBacklinks, findBacklinksFromFields, getPlainTextWithoutReferences } from '@/utils/reference-helpers';
import CompactBreadcrumb from './CompactBreadcrumb';

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
  
  const nodes = useNodeStore((state) => state.nodes);
  const getNodePath = useNodeStore((state) => state.getNodePath);
  const setFocusedNode = useNodeStore((state) => state.setFocusedNode);
  const setHoistedNode = useNodeStore((state) => state.setHoistedNode);
  const notebooks = useNotebookStore((state) => state.notebooks);
  const setActiveNotebook = useNotebookStore((state) => state.setActiveNotebook);
  const setNavigationMode = useNotebookStore((state) => state.setNavigationMode);
  // 右侧面板状态
  const splitPaneIsOpen = useSplitPaneStore((state) => state.isOpen);
  const openPanel = useSplitPaneStore((state) => state.openPanel);
  const navigateInPanel = useSplitPaneStore((state) => state.navigateInPanel);
  
  const currentNode = nodes[nodeId];
  const targetTitle = currentNode?.content?.trim().slice(0, 50);

  // 查找所有反向链接（正文/独立引用/双链）
  const backlinkNodeIds = useMemo(() => {
    return findBacklinks(nodeId, nodes, targetTitle);
  }, [nodeId, nodes, targetTitle]);

  // v2.1: 通过引用字段引用此节点的节点
  const fieldBacklinks = useMemo(() => {
    return findBacklinksFromFields(nodeId, nodes);
  }, [nodeId, nodes]);

  // 合并所有反向链接为统一数据结构
  const unifiedBacklinks: UnifiedBacklink[] = useMemo(() => {
    const result: UnifiedBacklink[] = [];
    
    // 处理普通反向链接（去重：排除已在字段引用中的节点）
    const fieldNodeIds = new Set(fieldBacklinks.map(fb => fb.nodeId));
    
    backlinkNodeIds.forEach((id) => {
      // 如果这个节点已经在字段引用中，跳过（避免重复显示）
      if (fieldNodeIds.has(id)) return;
      
      const node = nodes[id];
      if (!node) return;
      
      const path = getNodePath(id);
      const breadcrumbs = path.slice(0, -1).map((n) => {
        const content = n.content || '未命名';
        return content.length > 12 ? content.slice(0, 12) + '…' : content;
      }).slice(-2);
      
      const plainContent = getPlainTextWithoutReferences(node.content);
      const displayContent = plainContent.length > 50 ? plainContent.slice(0, 50) + '…' : plainContent;
      
      result.push({
        id: node.id,
        content: displayContent,
        breadcrumbs,
        sourceType: 'mention',
        createdAt: node.createdAt,
      });
    });
    
    // 处理字段引用
    fieldBacklinks.forEach(({ nodeId: id, fieldKey }) => {
      const node = nodes[id];
      if (!node) return;
      
      const path = getNodePath(id);
      const breadcrumbs = path.slice(0, -1).map((n) => {
        const content = n.content || '未命名';
        return content.length > 12 ? content.slice(0, 12) + '…' : content;
      }).slice(-2);
      
      const plainContent = getPlainTextWithoutReferences(node.content);
      const displayContent = plainContent.length > 50 ? plainContent.slice(0, 50) + '…' : plainContent;
      
      result.push({
        id,
        content: displayContent,
        breadcrumbs,
        sourceType: 'field',
        fieldKey,
        createdAt: node.createdAt,
      });
    });
    
    // 按创建时间倒序排列
    return result.sort((a, b) => b.createdAt - a.createdAt);
  }, [backlinkNodeIds, fieldBacklinks, nodes, getNodePath]);

  const totalCount = unifiedBacklinks.length;

  const handleBadgeClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(prev => !prev);
  }, []);

  // 默认跳转逻辑
  const handleDefaultJump = useCallback((targetNodeId: string) => {
    const targetNode = nodes[targetNodeId];
    if (!targetNode) return;
    
    const isCalendarNode = targetNode.tags.some(tagId => 
      [SYSTEM_TAGS.YEAR, SYSTEM_TAGS.MONTH, SYSTEM_TAGS.WEEK, SYSTEM_TAGS.DAY].includes(tagId as typeof SYSTEM_TAGS.YEAR)
    );
    
    const belongsToNotebook = Object.values(notebooks).find(nb => {
      let currentNode: Node | null = targetNode;
      while (currentNode) {
        if (currentNode.id === nb.rootNodeId) return true;
        currentNode = currentNode.parentId ? nodes[currentNode.parentId] : null;
      }
      return false;
    });
    
    const findCalendarParent = (): string | null => {
      let currentNode: Node | null = targetNode;
      while (currentNode) {
        if (currentNode.tags.includes(SYSTEM_TAGS.DAY)) {
          return currentNode.id;
        }
        currentNode = currentNode.parentId ? nodes[currentNode.parentId] : null;
      }
      return null;
    };
    
    if (isCalendarNode) {
      setNavigationMode('calendar');
      setHoistedNode(targetNodeId);
      setFocusedNode(targetNodeId);
    } else if (belongsToNotebook) {
      setActiveNotebook(belongsToNotebook.id);
      setNavigationMode('notebook');
      setHoistedNode(belongsToNotebook.rootNodeId);
      setFocusedNode(targetNodeId);
    } else {
      const calendarParent = findCalendarParent();
      setNavigationMode('calendar');
      if (calendarParent) {
        setHoistedNode(calendarParent);
      }
      setFocusedNode(targetNodeId);
    }
  }, [nodes, notebooks, setNavigationMode, setActiveNotebook, setHoistedNode, setFocusedNode]);

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
