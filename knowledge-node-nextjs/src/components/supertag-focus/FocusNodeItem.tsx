'use client';

/**
 * 单个节点行组件 (v3.7)
 * 
 * 展示结构：
 * • [折叠按钮] [节点内容] [字段胶囊...]
 *   └ 子节点1
 *   └ 子节点2
 */

import React, { useCallback } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Node, FieldDefinition } from '@/types';
import { useFocusStore, useIsNodeCollapsed } from '@/stores/focusStore';
import { useNodeStore } from '@/stores/nodeStore';
import FieldPills from './FieldPills';
import { ContentWithReferences } from '@/components/ReferenceChip';

interface FocusNodeItemProps {
  node: Node;
  fieldDefinitions: FieldDefinition[];
  isSelected: boolean;
  isFocused: boolean;
  onSelect: () => void;
  depth: number;
}

const MAX_DEPTH = 3; // 最大展开深度

const FocusNodeItem: React.FC<FocusNodeItemProps> = ({
  node,
  fieldDefinitions,
  isSelected,
  isFocused,
  onSelect,
  depth,
}) => {
  const toggleCollapse = useFocusStore((state) => state.toggleCollapse);
  const isCollapsed = useIsNodeCollapsed(node.id);
  
  // 从主 nodeStore 获取子节点
  const allNodes = useNodeStore((state) => state.nodes);
  
  // 获取子节点
  const childNodes = node.childrenIds
    .map((id) => allNodes[id])
    .filter(Boolean);
  
  const hasChildren = childNodes.length > 0;
  
  // 处理折叠切换
  const handleToggleCollapse = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    toggleCollapse(node.id);
  }, [node.id, toggleCollapse]);
  
  return (
    <div className="select-none">
      {/* 主节点行 */}
      <div
        className={cn(
          'group flex items-start gap-1 px-2 py-1.5 rounded-lg transition-colors cursor-pointer',
          isSelected && 'bg-indigo-50 dark:bg-indigo-900/20',
          isFocused && !isSelected && 'bg-gray-50 dark:bg-gray-800/50',
          !isSelected && !isFocused && 'hover:bg-gray-50 dark:hover:bg-gray-800/30'
        )}
        onClick={onSelect}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {/* 折叠按钮 */}
        <button
          onClick={handleToggleCollapse}
          className={cn(
            'mt-0.5 w-5 h-5 flex items-center justify-center rounded flex-shrink-0',
            hasChildren
              ? 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400'
              : 'invisible'
          )}
        >
          <ChevronRight
            size={14}
            className={cn(
              'transition-transform duration-200',
              !isCollapsed && hasChildren && 'rotate-90'
            )}
          />
        </button>
        
        {/* 节点内容区域 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* 节点文本 */}
            <span
              className={cn(
                'text-sm text-gray-900 dark:text-gray-100',
                'hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors'
              )}
            >
              <ContentWithReferences content={node.content} references={node.references} />
            </span>
            
            {/* 字段胶囊 */}
            {depth === 0 && (
              <FieldPills
                fields={node.fields}
                definitions={fieldDefinitions}
              />
            )}
          </div>
        </div>
      </div>
      
      {/* 子节点（展开时） */}
      {!isCollapsed && hasChildren && depth < MAX_DEPTH && (
        <div className="relative">
          {/* 连接线 */}
          <div
            className="absolute top-0 bottom-2 border-l-2 border-gray-200 dark:border-gray-700"
            style={{ left: `${depth * 16 + 18}px` }}
          />
          
          {/* 子节点列表 */}
          {childNodes.map((child) => (
            <FocusNodeItem
              key={child.id}
              node={child}
              fieldDefinitions={fieldDefinitions}
              isSelected={false}
              isFocused={false}
              onSelect={() => {}} // 子节点点击暂不处理
              depth={depth + 1}
            />
          ))}
        </div>
      )}
      
      {/* 折叠提示 */}
      {!isCollapsed && hasChildren && depth >= MAX_DEPTH && (
        <div
          className="px-2 py-1 text-xs text-gray-400 dark:text-gray-500"
          style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
        >
          还有 {childNodes.length} 个子节点...
        </div>
      )}
    </div>
  );
};

export default FocusNodeItem;
