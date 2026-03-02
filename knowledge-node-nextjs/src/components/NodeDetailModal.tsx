'use client';

import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { X, Hash, ExternalLink, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Node } from '@/types';
import { useNodeStore } from '@/stores/nodeStore';
import { useSupertagStore } from '@/stores/supertagStore';
import FieldEditor from './FieldEditor';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getTagStyle } from '@/utils/tag-styles';

interface NodeDetailModalProps {
  nodeId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * 节点详情编辑弹窗
 * 用于快速编辑节点表单内容
 */
const NodeDetailModal: React.FC<NodeDetailModalProps> = ({
  nodeId,
  open,
  onOpenChange,
}) => {
  const nodes = useNodeStore((state) => state.nodes);
  const updateNode = useNodeStore((state) => state.updateNode);
  const setHoistedNode = useNodeStore((state) => state.setHoistedNode);
  const supertags = useSupertagStore((state) => state.supertags);
  const getResolvedFieldDefinitions = useSupertagStore((state) => state.getResolvedFieldDefinitions);
  const [editingContent, setEditingContent] = useState('');
  
  // 获取当前节点
  const node = useMemo(() => {
    return nodeId ? nodes[nodeId] : null;
  }, [nodeId, nodes]);
  
  // 获取节点的标签
  const nodeTags = useMemo(() => {
    if (!node) return [];
    return node.tags.map(tagId => supertags[tagId]).filter(Boolean);
  }, [node, supertags]);
  
  // 初始化编辑内容
  useEffect(() => {
    if (node) {
      setEditingContent(node.content);
    }
  }, [node]);
  
  // 处理内容变更
  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditingContent(e.target.value);
  }, []);
  
  // 保存内容
  const handleContentBlur = useCallback(() => {
    if (nodeId && editingContent !== node?.content) {
      updateNode(nodeId, { content: editingContent });
    }
  }, [nodeId, editingContent, node?.content, updateNode]);
  
  // 处理字段变更
  const handleFieldChange = useCallback((fieldKey: string, value: any) => {
    if (!nodeId || !node) return;
    
    const newFields = { ...node.fields };
    if (value === '' || value === null || value === undefined) {
      delete newFields[fieldKey];
    } else {
      newFields[fieldKey] = value;
    }
    updateNode(nodeId, { fields: newFields });
  }, [nodeId, node, updateNode]);
  
  // 移除标签
  const handleRemoveTag = useCallback((tagId: string) => {
    if (!nodeId || !node) return;
    const tag = supertags[tagId];
    updateNode(nodeId, {
      tags: node.tags.filter(id => id !== tagId),
      fields: Object.fromEntries(
        Object.entries(node.fields).filter(([key]) => {
          const defs = tag ? getResolvedFieldDefinitions(tag.id) ?? [] : [];
          return !defs.some(field => field.key === key);
        })
      )
    });
  }, [nodeId, node, supertags, updateNode, getResolvedFieldDefinitions]);
  
  // 跳转到节点详情（聚焦模式）
  const handleNavigateToNode = useCallback(() => {
    if (!nodeId) return;
    onOpenChange(false);
    setHoistedNode(nodeId);
  }, [nodeId, onOpenChange, setHoistedNode]);
  
  if (!node) return null;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0 pb-2 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold text-gray-800">
              编辑节点
            </DialogTitle>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-500 hover:text-blue-600"
                  onClick={handleNavigateToNode}
                >
                  <ExternalLink size={16} className="mr-1" />
                  查看详情
                </Button>
              </TooltipTrigger>
              <TooltipContent>跳转到节点聚焦视图</TooltipContent>
            </Tooltip>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* 节点内容编辑 */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">
              内容
            </label>
            <textarea
              value={editingContent}
              onChange={handleContentChange}
              onBlur={handleContentBlur}
              className="w-full min-h-[80px] px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="输入节点内容..."
            />
          </div>
          
          {/* 标签列表 */}
          {nodeTags.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                标签
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {nodeTags.map((tag) => {
                  // 使用统一的标签样式函数
                  const tagStyle = getTagStyle(tag);
                  return (
                    <div
                      key={tag.id}
                      className="group/tag relative inline-flex items-center"
                    >
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-1 text-sm font-medium rounded-md cursor-default select-none",
                          tagStyle.gradient,
                          tagStyle.text
                        )}
                      >
                        <span className="text-base">{tagStyle.icon}</span>
                        {tag.name}
                      </span>
                      <button
                        onClick={() => handleRemoveTag(tag.id)}
                        className="absolute -right-1 -top-1 w-4 h-4 flex items-center justify-center rounded-full bg-gray-400 hover:bg-red-500 text-white opacity-0 group-hover/tag:opacity-100 transition-opacity shadow-sm"
                        title={`移除 #${tag.name}`}
                      >
                        <X size={10} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* 字段编辑区 */}
          {nodeTags.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                字段
              </label>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
                {nodeTags.map((tag) =>
                  (getResolvedFieldDefinitions(tag.id) ?? []).map((fieldDef) => (
                    <FieldEditor
                      key={fieldDef.id}
                      fieldDef={fieldDef}
                      value={node.fields[fieldDef.key]}
                      onChange={(value) => handleFieldChange(fieldDef.key, value)}
                      nodeId={nodeId || undefined}
                      tagId={tag.id}
                    />
                  ))
                )}
              </div>
            </div>
          )}
          
          {/* 空状态提示 */}
          {nodeTags.length === 0 && (
            <div className="text-center py-6 text-gray-400">
              <Hash size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">此节点没有标签</p>
              <p className="text-xs mt-1">添加标签后可编辑表单字段</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NodeDetailModal;
