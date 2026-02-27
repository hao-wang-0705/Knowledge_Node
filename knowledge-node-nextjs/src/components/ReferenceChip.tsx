'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { AtSign, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNodeStore } from '@/stores/nodeStore';
import { useNotebookStore } from '@/stores/notebookStore';
import { usePerspectiveStore } from '@/stores/perspectiveStore';
import { useSplitPaneStore } from '@/stores/splitPaneStore';
import { Node } from '@/types';
import { SYSTEM_TAGS } from '@/utils/date-helpers';
import { splitTextWithReferences, TextSegment } from '@/utils/reference-helpers';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import ReferencePreview from './ReferencePreview';

interface ReferenceChipProps {
  nodeId: string;
  title: string;
  onClick?: () => void;
  showPreview?: boolean;  // 是否显示悬停预览
}

/**
 * 引用块组件 - 显示为蓝色胶囊按钮，支持悬停预览
 */
export const ReferenceChip: React.FC<ReferenceChipProps> = ({ 
  nodeId, 
  title, 
  onClick,
  showPreview = true 
}) => {
  const nodes = useNodeStore((state) => state.nodes);
  const setFocusedNode = useNodeStore((state) => state.setFocusedNode);
  const setHoistedNode = useNodeStore((state) => state.setHoistedNode);
  const notebooks = useNotebookStore((state) => state.notebooks);
  const setActiveNotebook = useNotebookStore((state) => state.setActiveNotebook);
  const setNavigationMode = useNotebookStore((state) => state.setNavigationMode);
  const setActiveTag = usePerspectiveStore((state) => state.setActiveTag);
  
  // 右侧面板状态
  const splitPaneIsOpen = useSplitPaneStore((state) => state.isOpen);
  const openPanel = useSplitPaneStore((state) => state.openPanel);
  const navigateInPanel = useSplitPaneStore((state) => state.navigateInPanel);
  
  // 控制 HoverCard 的打开状态
  const [isHoverOpen, setIsHoverOpen] = useState(false);
  
  // 检查目标节点是否存在
  const targetNode = nodes[nodeId];
  const displayTitle = targetNode ? targetNode.content : title;
  const isValidReference = !!targetNode;
  
  // 跳转到目标节点
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (!targetNode) {
      // 节点不存在，显示提示
      console.warn('Referenced node not found:', nodeId);
      return;
    }
    
    // 检测修饰键（Cmd on Mac, Ctrl on Windows/Linux）
    const isModifierClick = e.metaKey || e.ctrlKey;
    
    if (isModifierClick) {
      // Cmd/Ctrl + Click: 在右侧面板中打开
      if (splitPaneIsOpen) {
        navigateInPanel(nodeId);
      } else {
        openPanel(nodeId);
      }
      onClick?.();
      return;
    }
    
    // 普通点击：跳转到节点
    // 清除透视状态
    setActiveTag(null);
    
    // 判断节点类型
    const isCalendarNode = targetNode.tags.some(tagId => 
      [SYSTEM_TAGS.YEAR, SYSTEM_TAGS.MONTH, SYSTEM_TAGS.WEEK, SYSTEM_TAGS.DAY].includes(tagId as any)
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
    
    // 查找节点所属的日历父节点（日节点）
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
      setHoistedNode(nodeId);
      setFocusedNode(nodeId);
    } else if (belongsToNotebook) {
      setActiveNotebook(belongsToNotebook.id);
      setNavigationMode('notebook');
      setHoistedNode(belongsToNotebook.rootNodeId);
      setFocusedNode(nodeId);
    } else {
      const calendarParent = findCalendarParent();
      setNavigationMode('calendar');
      if (calendarParent) {
        setHoistedNode(calendarParent);
      }
      setFocusedNode(nodeId);
    }
    
    onClick?.();
  }, [nodeId, targetNode, nodes, notebooks, setActiveTag, setNavigationMode, setActiveNotebook, setHoistedNode, setFocusedNode, onClick, splitPaneIsOpen, openPanel, navigateInPanel]);
  
  // 截断过长的标题（提取引用中实际的标题部分，去除引用标记）
  const getCleanTitle = (text: string) => {
    // 如果内容本身包含引用标记，只提取标题部分
    const match = text.match(/@\{[^:]+:([^}]+)\}/);
    if (match) return match[1];
    return text;
  };
  
  const cleanTitle = getCleanTitle(displayTitle);
  const truncatedTitle = cleanTitle.length > 30 ? cleanTitle.slice(0, 30) + '...' : cleanTitle;
  
  // 引用块按钮
  const chipButton = (
    <button
      onClick={handleClick}
      data-reference-chip="true"
      className={cn(
        "inline-flex items-center gap-0.5 px-2 py-0.5 mx-0.5 rounded-full text-sm font-medium transition-all cursor-pointer",
        "select-none whitespace-nowrap border",
        isValidReference
          ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm"
          : "bg-gray-100 dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700 line-through cursor-not-allowed"
      )}
      title={isValidReference ? `点击跳转 · ⌘+点击侧栏打开: ${cleanTitle}` : '引用的节点已删除'}
    >
      <AtSign size={12} className="flex-shrink-0 opacity-70" />
      <span>{truncatedTitle}</span>
      {isValidReference && (
        <ExternalLink size={10} className="flex-shrink-0 opacity-50 ml-0.5" />
      )}
    </button>
  );
  
  // 如果不显示预览或节点不存在，直接返回按钮
  if (!showPreview || !isValidReference) {
    return chipButton;
  }
  
  // 带悬停预览的引用块
  return (
    <HoverCard open={isHoverOpen} onOpenChange={setIsHoverOpen} openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild>
        {chipButton}
      </HoverCardTrigger>
      <HoverCardContent 
        className="w-80 p-3" 
        side="top" 
        align="start"
        sideOffset={8}
      >
        <ReferencePreview 
          nodeId={nodeId} 
          onNavigate={() => {
            setIsHoverOpen(false);
            handleClick({ stopPropagation: () => {}, preventDefault: () => {} } as React.MouseEvent);
          }} 
        />
      </HoverCardContent>
    </HoverCard>
  );
};

interface ContentWithReferencesProps {
  content: string;
  className?: string;
}

/**
 * 带引用渲染的内容组件
 * 将文本中的引用标记渲染为可点击的引用块
 */
export const ContentWithReferences: React.FC<ContentWithReferencesProps> = ({ content, className }) => {
  const segments = useMemo(() => splitTextWithReferences(content), [content]);
  
  if (segments.length === 0) {
    return <span className={className}>{content}</span>;
  }
  
  return (
    <span className={className}>
      {segments.map((segment, index) => {
        if (segment.type === 'reference' && segment.nodeId && segment.title) {
          return (
            <ReferenceChip 
              key={index} 
              nodeId={segment.nodeId} 
              title={segment.title} 
            />
          );
        }
        return <span key={index}>{segment.content}</span>;
      })}
    </span>
  );
};

export default ContentWithReferences;
