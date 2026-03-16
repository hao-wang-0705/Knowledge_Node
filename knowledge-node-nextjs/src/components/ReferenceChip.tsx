'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNodeStore } from '@/stores/nodeStore';
import { useSplitPaneStore } from '@/stores/splitPaneStore';
import { Node, NodeReference } from '@/types';
import { analyzeNavigationTarget } from '@/utils/navigation';
import { splitContentWithInlineReferences } from '@/utils/reference-helpers';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import ReferencePreview from './ReferencePreview';

interface ReferenceChipProps {
  nodeId: string;
  title: string;
  onClick?: () => void;
  showPreview?: boolean;  // 是否显示悬停预览
  interactive?: boolean;
}

/**
 * 引用组件 - 行内蓝色高亮，支持悬停预览与点击跳转
 */
export const ReferenceChip: React.FC<ReferenceChipProps> = ({ 
  nodeId, 
  title, 
  onClick,
  showPreview = true,
  interactive = true,
}) => {
  const nodes = useNodeStore((state) => state.nodes);
  const setFocusedNode = useNodeStore((state) => state.setFocusedNode);
  const setHoistedNode = useNodeStore((state) => state.setHoistedNode);
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
    
    const target = analyzeNavigationTarget(targetNode, nodes);
    if (target.hoistNodeId) setHoistedNode(target.hoistNodeId);
    setFocusedNode(target.nodeId);
    onClick?.();
  }, [nodeId, targetNode, nodes, setHoistedNode, setFocusedNode, onClick, splitPaneIsOpen, openPanel, navigateInPanel]);
  
  // 截断过长的标题（提取引用中实际的标题部分，去除引用标记）
  const getCleanTitle = (text: string) => {
    // 如果内容本身包含引用标记，只提取标题部分
    const match = text.match(/@\{[^:]+:([^}]+)\}/);
    if (match) return match[1];
    return text;
  };
  
  const cleanTitle = getCleanTitle(displayTitle);
  const truncatedTitle = cleanTitle.length > 30 ? cleanTitle.slice(0, 30) + '…' : cleanTitle;

  // 行内胶囊触发器
  const inlineClassName = cn(
    'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap select-none border transition-colors',
    isValidReference
      ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 border-blue-100 dark:border-blue-800'
      : 'bg-gray-100 dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700 line-through',
    interactive && isValidReference
      ? 'hover:bg-blue-100 dark:hover:bg-blue-900/60 cursor-pointer'
      : 'cursor-default'
  );

  const inlineContent = (
    <>
      {isValidReference && (
        <span className="flex-shrink-0 text-blue-500/70 dark:text-blue-300/70">
          <Link2 size={10} />
        </span>
      )}
      <span className="truncate max-w-[160px]">{truncatedTitle}</span>
    </>
  );

  const inlineTrigger = interactive ? (
    <button
      type="button"
      onClick={handleClick}
      data-reference-chip="true"
      className={inlineClassName}
      title={isValidReference ? `跳转到: ${cleanTitle}` : '引用的节点已删除'}
    >
      {inlineContent}
    </button>
  ) : (
    <span
      data-reference-chip="true"
      contentEditable={false}
      className={inlineClassName}
      title={isValidReference ? `引用: ${cleanTitle}` : '引用的节点已删除'}
    >
      {inlineContent}
    </span>
  );
  
  if (!showPreview || !isValidReference) {
    return inlineTrigger;
  }

  return (
    <HoverCard open={isHoverOpen} onOpenChange={setIsHoverOpen} openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild>
        {inlineTrigger}
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
  references?: NodeReference[];
  className?: string;
  /** 只读模式下设为 false，点击芯片不跳转，由行点击统一进入编辑 */
  interactive?: boolean;
}

/**
 * 带引用渲染的内容组件
 * 实体化引用模型：优先使用 references + anchorOffset 渲染行内胶囊
 */
export const ContentWithReferences: React.FC<ContentWithReferencesProps> = ({
  content,
  references,
  className,
  interactive = true,
}) => {
  const segments = useMemo(
    () => splitContentWithInlineReferences(content, references),
    [content, references],
  );

  if (segments.length === 0) {
    return <span className={className}>{content}</span>;
  }

  return (
    <span className={className}>
      {segments.map((segment, index) => {
        if ('ref' in segment) {
          return (
            <ReferenceChip
              key={segment.ref.id ?? index}
              nodeId={segment.ref.targetNodeId}
              title={segment.ref.title}
              interactive={interactive}
            />
          );
        }
        return <span key={index}>{segment.text}</span>;
      })}
    </span>
  );
};

export default ContentWithReferences;
