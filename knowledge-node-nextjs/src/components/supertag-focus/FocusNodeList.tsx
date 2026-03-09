'use client';

/**
 * 节点列表容器组件 (v3.7)
 * 
 * 功能：
 * - 展示所有带当前超级标签的节点
 * - 支持折叠/展开子节点
 * - 支持键盘导航
 * - 空状态提示
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Hash, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFocusStore, useFieldDefinitions } from '@/stores/focusStore';
import FocusNodeItem from './FocusNodeItem';

const FocusNodeList: React.FC = () => {
  const nodes = useFocusStore((state) => state.nodes);
  const focusedTag = useFocusStore((state) => state.focusedTag);
  const isLoading = useFocusStore((state) => state.isLoading);
  const selectedNodeId = useFocusStore((state) => state.selectedNodeId);
  const selectNode = useFocusStore((state) => state.selectNode);
  const fieldDefinitions = useFieldDefinitions();
  
  // 键盘导航：当前聚焦的索引
  const [focusedIndex, setFocusedIndex] = useState(-1);
  
  // 只展示顶级节点（supertagId 匹配的节点）
  const topLevelNodes = nodes.filter((node) => node.supertagId === focusedTag?.id);
  
  // 处理节点选择
  const handleSelectNode = useCallback((nodeId: string) => {
    selectNode(nodeId);
  }, [selectNode]);
  
  // 键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果在输入框中，不处理
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable) {
        return;
      }
      
      if (topLevelNodes.length === 0) return;
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex((prev) => {
            const next = prev < topLevelNodes.length - 1 ? prev + 1 : prev;
            return next;
          });
          break;
          
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex((prev) => {
            const next = prev > 0 ? prev - 1 : 0;
            return next;
          });
          break;
          
        case 'Enter':
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < topLevelNodes.length) {
            handleSelectNode(topLevelNodes[focusedIndex].id);
          }
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [topLevelNodes, focusedIndex, handleSelectNode]);
  
  // 同步选中状态到键盘聚焦
  useEffect(() => {
    if (selectedNodeId) {
      const index = topLevelNodes.findIndex((n) => n.id === selectedNodeId);
      if (index >= 0) {
        setFocusedIndex(index);
      }
    }
  }, [selectedNodeId, topLevelNodes]);
  
  // 加载状态
  if (isLoading && topLevelNodes.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-12 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }
  
  // 空状态
  if (topLevelNodes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <Inbox size={32} className="text-gray-300 dark:text-gray-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            还没有任何{' '}
            <span className="inline-flex items-center gap-1" style={{ color: focusedTag?.color }}>
              <Hash size={16} strokeWidth={2.5} />
              {focusedTag?.name}
            </span>
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            在上方输入框中输入内容，按回车快速创建第一个{focusedTag?.name}。
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex-1 overflow-y-auto">
      {/* 列表统计 */}
      <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          共 {topLevelNodes.length} 个{focusedTag?.name}
        </p>
      </div>
      
      {/* 节点列表 */}
      <div className="px-2 py-2">
        {topLevelNodes.map((node, index) => (
          <FocusNodeItem
            key={node.id}
            node={node}
            fieldDefinitions={fieldDefinitions}
            isSelected={selectedNodeId === node.id}
            isFocused={focusedIndex === index}
            onSelect={() => handleSelectNode(node.id)}
            depth={0}
          />
        ))}
      </div>
    </div>
  );
};

export default FocusNodeList;
