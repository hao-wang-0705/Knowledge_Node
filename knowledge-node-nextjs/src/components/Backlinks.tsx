'use client';

import React, { useMemo, useCallback, useState } from 'react';
import { Link2, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNodeStore } from '@/stores/nodeStore';
import { useNotebookStore } from '@/stores/notebookStore';
import { usePerspectiveStore } from '@/stores/perspectiveStore';
import { Node } from '@/types';
import { SYSTEM_TAGS } from '@/utils/date-helpers';
import { findBacklinks, findBacklinksFromFields, getPlainTextWithoutReferences } from '@/utils/reference-helpers';
import CompactBreadcrumb from './CompactBreadcrumb';

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
  
  const nodes = useNodeStore((state) => state.nodes);
  const getNodePath = useNodeStore((state) => state.getNodePath);
  const setFocusedNode = useNodeStore((state) => state.setFocusedNode);
  const setHoistedNode = useNodeStore((state) => state.setHoistedNode);
  const notebooks = useNotebookStore((state) => state.notebooks);
  const setActiveNotebook = useNotebookStore((state) => state.setActiveNotebook);
  const setNavigationMode = useNotebookStore((state) => state.setNavigationMode);
  const setActiveTag = usePerspectiveStore((state) => state.setActiveTag);
  
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

  // 默认跳转逻辑
  const handleDefaultJump = useCallback((targetNodeId: string) => {
    const targetNode = nodes[targetNodeId];
    if (!targetNode) return;
    
    // 清除透视状态
    setActiveTag(null);
    
    // 判断节点类型
    const isCalendarNode = targetNode.tags.some(tagId => 
      [SYSTEM_TAGS.YEAR, SYSTEM_TAGS.MONTH, SYSTEM_TAGS.WEEK, SYSTEM_TAGS.DAY].includes(tagId as typeof SYSTEM_TAGS.YEAR)
    );
    
    // 查找节点所属的笔记本
    const belongsToNotebook = Object.values(notebooks).find(nb => {
      let currentNode: Node | null = targetNode;
      while (currentNode) {
        if (currentNode.id === nb.rootNodeId) return true;
        currentNode = currentNode.parentId ? nodes[currentNode.parentId] : null;
      }
      return false;
    });
    
    // 查找节点所属的日历父节点
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
  }, [nodes, notebooks, setActiveTag, setNavigationMode, setActiveNotebook, setHoistedNode, setFocusedNode]);

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
