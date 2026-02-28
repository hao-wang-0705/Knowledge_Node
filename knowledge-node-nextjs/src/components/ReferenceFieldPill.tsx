'use client';

import React, { useState, useCallback } from 'react';
import { ExternalLink, X, PanelRightOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNodeStore } from '@/stores/nodeStore';
import { useNotebookStore } from '@/stores/notebookStore';
import { useSplitPaneStore } from '@/stores/splitPaneStore';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { SYSTEM_TAGS } from '@/utils/date-helpers';
import { getPlainTextWithoutReferences } from '@/utils/reference-helpers';
import { Node } from '@/types';

interface ReferenceFieldPillProps {
  nodeId: string;
  title: string;
  onRemove?: () => void;
  removable?: boolean;
  className?: string;
  /** 点击节点的回调，用于支持右侧面板打开 */
  onNodeClick?: (nodeId: string, e: React.MouseEvent) => void;
}

/**
 * 引用字段胶囊组件 v2.2
 * - 浅色背景胶囊样式
 * - 悬停显示元数据摘要（预览卡片）
 * - 支持 Cmd/Ctrl + Click 打开右侧面板
 * - 支持删除操作
 */
const ReferenceFieldPill: React.FC<ReferenceFieldPillProps> = ({
  nodeId,
  title,
  onRemove,
  removable = true,
  className,
  onNodeClick,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const nodes = useNodeStore((state) => state.nodes);
  const setFocusedNode = useNodeStore((state) => state.setFocusedNode);
  const setHoistedNode = useNodeStore((state) => state.setHoistedNode);
  const getNodePath = useNodeStore((state) => state.getNodePath);
  const notebooks = useNotebookStore((state) => state.notebooks);
  const setActiveNotebook = useNotebookStore((state) => state.setActiveNotebook);
  const setNavigationMode = useNotebookStore((state) => state.setNavigationMode);
  // 右侧面板状态
  const splitPaneIsOpen = useSplitPaneStore((state) => state.isOpen);
  const openPanel = useSplitPaneStore((state) => state.openPanel);
  const navigateInPanel = useSplitPaneStore((state) => state.navigateInPanel);
  
  const targetNode = nodes[nodeId];
  const isValidReference = !!targetNode;

  // 获取预览信息
  const previewInfo = React.useMemo(() => {
    if (!targetNode) return null;
    
    const path = getNodePath(nodeId);
    const breadcrumbs = path.slice(0, -1).map((n) => {
      const content = n.content || '未命名';
      return content.length > 15 ? content.slice(0, 15) + '…' : content;
    }).slice(-2);
    
    const plainContent = getPlainTextWithoutReferences(targetNode.content);
    const childCount = targetNode.childrenIds?.length || 0;
    const fieldCount = Object.keys(targetNode.fields || {}).filter(
      k => targetNode.fields[k] !== undefined && targetNode.fields[k] !== ''
    ).length;
    
    return {
      content: plainContent.length > 100 ? plainContent.slice(0, 100) + '…' : plainContent,
      breadcrumbs,
      childCount,
      fieldCount,
      createdAt: targetNode.createdAt,
    };
  }, [targetNode, nodeId, getNodePath]);

  // 默认跳转逻辑
  const handleDefaultJump = useCallback(() => {
    if (!targetNode) return;
    
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
  }, [targetNode, nodes, nodeId, notebooks, setNavigationMode, setActiveNotebook, setHoistedNode, setFocusedNode]);

  // 处理点击
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (!isValidReference) return;
    
    // 检测修饰键（Cmd on Mac, Ctrl on Windows/Linux）
    const isModifierClick = e.metaKey || e.ctrlKey;
    
    if (isModifierClick) {
      // Cmd/Ctrl + Click: 在右侧面板中打开
      if (splitPaneIsOpen) {
        navigateInPanel(nodeId);
      } else {
        openPanel(nodeId);
      }
      return;
    }
    
    // 如果有自定义点击处理，优先使用
    if (onNodeClick) {
      onNodeClick(nodeId, e);
    } else {
      handleDefaultJump();
    }
  }, [isValidReference, onNodeClick, nodeId, handleDefaultJump, splitPaneIsOpen, openPanel, navigateInPanel]);

  // 处理删除
  const handleRemove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onRemove?.();
  }, [onRemove]);

  // 格式化时间
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('zh-CN', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isValidReference) {
    // 无效引用：灰色样式 + 删除线
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs',
          'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500',
          'line-through opacity-60',
          className
        )}
      >
        <span className="truncate max-w-[120px]">{title || '已删除'}</span>
        {removable && onRemove && (
          <span
            role="button"
            tabIndex={0}
            onClick={handleRemove}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleRemove(e as unknown as React.MouseEvent);
              }
            }}
            className="ml-0.5 hover:text-red-400 cursor-pointer"
          >
            <X size={10} />
          </span>
        )}
      </span>
    );
  }

  return (
    <HoverCard openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          onClick={handleClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleClick(e as unknown as React.MouseEvent);
            }
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs',
            'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
            'border border-blue-200 dark:border-blue-700/50',
            'hover:bg-blue-100 dark:hover:bg-blue-900/50',
            'transition-all duration-150 cursor-pointer',
            'group/pill',
            'focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1',
            className
          )}
        >
          <span className="truncate max-w-[150px]">
            {title || previewInfo?.content?.slice(0, 20) || '未命名'}
          </span>
          
          {/* 在侧板打开按钮 */}
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (splitPaneIsOpen) {
                navigateInPanel(nodeId);
              } else {
                openPanel(nodeId);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                if (splitPaneIsOpen) {
                  navigateInPanel(nodeId);
                } else {
                  openPanel(nodeId);
                }
              }
            }}
            className={cn(
              'flex-shrink-0 transition-all p-0.5 rounded hover:bg-blue-200 dark:hover:bg-blue-800',
              isHovered ? 'opacity-100' : 'opacity-50'
            )}
            title="在侧板打开"
          >
            <PanelRightOpen size={10} />
          </span>
          
          {removable && onRemove && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleRemove}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleRemove(e as unknown as React.MouseEvent);
                }
              }}
              className="ml-0.5 opacity-0 group-hover/pill:opacity-100 hover:text-red-500 transition-opacity cursor-pointer"
            >
              <X size={10} />
            </span>
          )}
        </span>
      </HoverCardTrigger>
      
      <HoverCardContent 
        side="top" 
        align="start" 
        className="w-72 p-3"
      >
        {previewInfo && (
          <div className="space-y-2">
            {/* 面包屑路径 */}
            {previewInfo.breadcrumbs.length > 0 && (
              <div className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
                {previewInfo.breadcrumbs.map((crumb, idx) => (
                  <React.Fragment key={idx}>
                    {idx > 0 && <span>›</span>}
                    <span>{crumb}</span>
                  </React.Fragment>
                ))}
              </div>
            )}
            
            {/* 内容预览 */}
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              {previewInfo.content || '(空内容)'}
            </p>
            
            {/* 元数据 */}
            <div className="flex items-center gap-3 text-[10px] text-gray-400 dark:text-gray-500 pt-1 border-t border-gray-100 dark:border-gray-800">
              {previewInfo.childCount > 0 && (
                <span>{previewInfo.childCount} 子节点</span>
              )}
              {previewInfo.fieldCount > 0 && (
                <span>{previewInfo.fieldCount} 字段</span>
              )}
              <span className="ml-auto">{formatTime(previewInfo.createdAt)}</span>
            </div>
            
            {/* 操作提示 */}
            <div className="text-[10px] text-gray-400 dark:text-gray-500 pt-1">
              点击跳转 · <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[9px]">⌘</kbd>+点击 侧栏打开
            </div>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
};

export default ReferenceFieldPill;
