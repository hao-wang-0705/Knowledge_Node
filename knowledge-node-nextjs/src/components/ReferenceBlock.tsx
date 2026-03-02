'use client';

import React, { useCallback, useState } from 'react';
import { AtSign, ExternalLink, X, Link2, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNodeStore } from '@/stores/nodeStore';
import { Node, NodeReference } from '@/types';
import { analyzeNavigationTarget } from '@/utils/navigation';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import ReferencePreview from './ReferencePreview';

interface ReferenceItemProps {
  reference: NodeReference;
  nodeId: string;
  onRemove?: (refId: string) => void;
  readOnly?: boolean;
}

/**
 * 单个引用项组件 - 显示为蓝色胶囊按钮，支持悬停预览和删除
 */
const ReferenceItem: React.FC<ReferenceItemProps> = ({ 
  reference, 
  nodeId,
  onRemove,
  readOnly = false,
}) => {
  const nodes = useNodeStore((state) => state.nodes);
  const setFocusedNode = useNodeStore((state) => state.setFocusedNode);
  const setHoistedNode = useNodeStore((state) => state.setHoistedNode);
  const [isHoverOpen, setIsHoverOpen] = useState(false);
  
  // 检查目标节点是否存在
  const targetNode = nodes[reference.targetNodeId];
  const displayTitle = targetNode ? targetNode.content : reference.title;
  const isValidReference = !!targetNode;
  
  // 跳转到目标节点
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (!targetNode) {
      console.warn('Referenced node not found:', reference.targetNodeId);
      return;
    }
    
    
    const target = analyzeNavigationTarget(targetNode, nodes);
    if (target.hoistNodeId) setHoistedNode(target.hoistNodeId);
    setFocusedNode(target.nodeId);
  }, [reference.targetNodeId, targetNode, nodes, setHoistedNode, setFocusedNode]);
  
  // 删除引用
  const handleRemove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onRemove?.(reference.id);
  }, [reference.id, onRemove]);
  
  // 截断过长的标题
  const cleanTitle = displayTitle.slice(0, 100).replace(/@\{[^}]+\}/g, '').trim() || reference.title;
  const truncatedTitle = cleanTitle.length > 40 ? cleanTitle.slice(0, 40) + '...' : cleanTitle;
  
  // 引用块按钮
  const chipButton = (
    <div className="group/ref inline-flex items-center relative">
      <button
        onClick={handleClick}
        data-reference-chip="true"
        className={cn(
          "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-medium transition-all cursor-pointer",
          "select-none border",
          isValidReference
            ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm"
            : "bg-gray-100 dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700 line-through cursor-not-allowed"
        )}
        title={isValidReference ? `跳转到: ${cleanTitle}` : '引用的节点已删除'}
      >
        <Link2 size={14} className="flex-shrink-0 opacity-70" />
        <span className="truncate max-w-[200px]">{truncatedTitle}</span>
        {isValidReference && (
          <ExternalLink size={12} className="flex-shrink-0 opacity-50" />
        )}
      </button>
      
      {/* 删除按钮 */}
      {!readOnly && (
        <button
          onClick={handleRemove}
          className="absolute -right-1.5 -top-1.5 w-4 h-4 flex items-center justify-center rounded-full bg-gray-400 hover:bg-red-500 text-white opacity-0 group-hover/ref:opacity-100 transition-all shadow-sm"
          title="移除引用"
        >
          <X size={10} />
        </button>
      )}
    </div>
  );
  
  // 如果节点不存在，直接返回按钮
  if (!isValidReference) {
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
          nodeId={reference.targetNodeId} 
          onNavigate={() => {
            setIsHoverOpen(false);
            handleClick({ stopPropagation: () => {}, preventDefault: () => {} } as React.MouseEvent);
          }} 
        />
      </HoverCardContent>
    </HoverCard>
  );
};

interface ReferenceBlockProps {
  nodeId: string;
  references: NodeReference[];
  onRemove?: (refId: string) => void;
  onAdd?: () => void;
  readOnly?: boolean;
  className?: string;
  isEditing?: boolean;
  maxDisplay?: number;
}

/**
 * 引用区块组件 - 独立展示所有引用，与正文分离
 * 作为独立实体换行显示，编辑时不会与正文互相干扰
 */
export const ReferenceBlock: React.FC<ReferenceBlockProps> = ({
  nodeId,
  references,
  onRemove,
  onAdd,
  readOnly = false,
  className,
  isEditing = false,
  maxDisplay = 3,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!references || references.length === 0) {
    return null;
  }
  
  const hasMore = references.length > maxDisplay;
  const displayRefs = isExpanded ? references : references.slice(0, maxDisplay);
  const hiddenCount = references.length - maxDisplay;
  
  return (
    <div 
      className={cn(
        "reference-block mt-1.5 pt-1.5 flex items-start gap-1.5 flex-wrap",
        // 视觉分隔：添加轻微的上边框
        "border-t border-dashed border-gray-200 dark:border-gray-700",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 引用标识图标 */}
      <div className="flex items-center gap-1 text-gray-400 text-xs py-1 flex-shrink-0">
        <Link2 size={12} />
        <span>引用</span>
      </div>
      
      {/* 引用列表 */}
      <div className="flex items-center gap-1.5 flex-wrap flex-1">
        {displayRefs.map((ref) => (
          <ReferenceItem
            key={ref.id}
            reference={ref}
            nodeId={nodeId}
            onRemove={onRemove}
            readOnly={readOnly}
          />
        ))}
        
        {/* 展开/收起按钮 */}
        {hasMore && !isExpanded && (
          <button
            onClick={() => setIsExpanded(true)}
            className="inline-flex items-center gap-0.5 px-2 py-1 text-xs text-blue-500 hover:text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
          >
            <span>+{hiddenCount}</span>
            <ChevronDown size={12} />
          </button>
        )}
        
        {isExpanded && hasMore && (
          <button
            onClick={() => setIsExpanded(false)}
            className="inline-flex items-center gap-0.5 px-2 py-1 text-xs text-gray-500 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <span>收起</span>
            <ChevronUp size={12} />
          </button>
        )}
        
        {/* 添加引用按钮 - 仅在编辑模式显示 */}
        {isEditing && !readOnly && onAdd && (
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-0.5 px-2 py-1 text-xs text-gray-400 hover:text-blue-500 bg-gray-50 hover:bg-blue-50 border border-dashed border-gray-300 hover:border-blue-300 rounded-lg transition-all"
            title="添加引用 (@)"
          >
            <AtSign size={12} />
            <span>添加</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default ReferenceBlock;
