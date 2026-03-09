'use client';

/**
 * FocusPanel - 焦点面板组件
 * v3.6: 从 supertag-focus 迁移，保持原有功能
 */

import React, { useCallback, useEffect, useMemo } from 'react';
import { X, Hash, ChevronRight, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFocusStore, useFieldDefinitions } from '@/stores/focusStore';
import { useNodeStore } from '@/stores/nodeStore';
import { ContentWithReferences } from '@/components/ReferenceChip';
import FieldEditor from '@/components/FieldEditor';

interface FocusPanelProps {
  nodeId: string;
  onClose: () => void;
}

export function FocusPanel({ nodeId, onClose }: FocusPanelProps) {
  const focusedTag = useFocusStore((state) => state.focusedTag);
  const nodes = useFocusStore((state) => state.nodes);
  const updateNodeFields = useFocusStore((state) => state.updateNodeFields);
  const fieldDefinitions = useFieldDefinitions();
  
  // 从 focusStore 获取节点
  const node = useMemo(() => {
    return nodes.find((n) => n.id === nodeId);
  }, [nodes, nodeId]);
  
  // 从主 nodeStore 获取子节点
  const allNodes = useNodeStore((state) => state.nodes);
  const childNodes = useMemo(() => {
    if (!node) return [];
    return node.childrenIds
      .map((id) => allNodes[id])
      .filter(Boolean);
  }, [node, allNodes]);
  
  // 处理字段变更
  const handleFieldChange = useCallback((fieldKey: string, value: unknown) => {
    if (!nodeId) return;
    updateNodeFields(nodeId, { [fieldKey]: value });
  }, [nodeId, updateNodeFields]);
  
  // 处理 ESC 关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);
  
  if (!node || !focusedTag) {
    return null;
  }
  
  return (
    <div className="flex flex-col h-full">
      {/* 面板头部 */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          {/* 标签标识 */}
          <div className="flex items-center gap-2">
            <Hash
              size={16}
              style={{ color: focusedTag.color }}
              strokeWidth={2.5}
            />
            <span
              className="text-sm font-medium"
              style={{ color: focusedTag.color }}
            >
              {focusedTag.name}详情
            </span>
          </div>
          
          {/* 关闭按钮 */}
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
            title="关闭面板 (Esc)"
          >
            <X size={16} />
          </button>
        </div>
        
        {/* 节点标题 */}
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 leading-snug">
          <ContentWithReferences content={node.content} />
        </h2>
      </div>
      
      {/* 面板内容 - 可滚动 */}
      <div className="flex-1 overflow-y-auto">
        {/* 结构化数据区 - 字段表单 */}
        {fieldDefinitions.length > 0 && (
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-1.5">
              <span>📋</span>
              <span>字段</span>
            </h3>
            <div className="space-y-2">
              {fieldDefinitions.map((fieldDef) => (
                <FieldEditor
                  key={fieldDef.id}
                  fieldDef={fieldDef}
                  value={node.fields[fieldDef.key]}
                  onChange={(value) => handleFieldChange(fieldDef.key, value)}
                  nodeId={nodeId}
                  tagId={focusedTag.id}
                  className="!py-1.5"
                />
              ))}
            </div>
          </div>
        )}
        
        {/* 非结构化数据区 - 子节点 */}
        <div className="px-4 py-3">
          <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-1.5">
            <span>📝</span>
            <span>子节点</span>
            {childNodes.length > 0 && (
              <span className="text-gray-400">({childNodes.length})</span>
            )}
          </h3>
          
          {childNodes.length > 0 ? (
            <div className="space-y-1">
              {childNodes.map((child) => (
                <ChildNodeRow key={child.id} node={child} depth={0} allNodes={allNodes} />
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-gray-400 dark:text-gray-500">
                暂无子节点
              </p>
            </div>
          )}
          
          {/* 添加子节点按钮（预留） */}
          <button
            disabled
            className={cn(
              'mt-3 w-full flex items-center justify-center gap-2 py-2',
              'text-sm text-gray-400 dark:text-gray-500',
              'border border-dashed border-gray-200 dark:border-gray-700 rounded-lg',
              'cursor-not-allowed'
            )}
          >
            <Plus size={14} />
            <span>添加子节点（即将推出）</span>
          </button>
        </div>
      </div>
      
      {/* 面板底部 - 快捷键提示 */}
      <div className="flex-shrink-0 border-t border-gray-100 dark:border-gray-800 px-4 py-2">
        <div className="flex items-center gap-4 text-[10px] text-gray-400">
          <span>
            <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">Esc</kbd> 关闭
          </span>
        </div>
      </div>
    </div>
  );
}

// 子节点行组件
interface ChildNodeRowProps {
  node: any;
  depth: number;
  allNodes: Record<string, any>;
}

const MAX_CHILD_DEPTH = 3;

function ChildNodeRow({ node, depth, allNodes }: ChildNodeRowProps) {
  const childNodes = (node.childrenIds || [])
    .map((id: string) => allNodes[id])
    .filter(Boolean);
  
  return (
    <div>
      <div
        className={cn(
          'flex items-start gap-2 py-1.5 px-2 rounded-md',
          'hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors'
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <ChevronRight size={12} className="mt-1 text-gray-400 flex-shrink-0" />
        <span className="text-sm text-gray-700 dark:text-gray-300">
          <ContentWithReferences content={node.content} />
        </span>
      </div>
      
      {/* 递归渲染子节点 */}
      {depth < MAX_CHILD_DEPTH && childNodes.length > 0 && (
        <div>
          {childNodes.map((child: any) => (
            <ChildNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              allNodes={allNodes}
            />
          ))}
        </div>
      )}
      
      {depth >= MAX_CHILD_DEPTH && childNodes.length > 0 && (
        <div
          className="text-xs text-gray-400 py-1"
          style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
        >
          还有 {childNodes.length} 个子节点...
        </div>
      )}
    </div>
  );
}

export default FocusPanel;
