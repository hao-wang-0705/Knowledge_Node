'use client';

import React, { useMemo } from 'react';
import { Hash, Calendar, FileText, Lightbulb, CheckSquare, Clock, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNodeStore } from '@/stores/nodeStore';
import { useSupertagStore } from '@/stores/supertagStore';
import { Node } from '@/types';
import { SYSTEM_TAGS } from '@/utils/date-helpers';
import { getTagStyle } from '@/utils/tag-styles';

interface ReferencePreviewProps {
  nodeId: string;
  onNavigate?: () => void;
  className?: string;
}

/**
 * 引用预览组件 - 显示被引用节点的详细预览信息
 */
export const ReferencePreview: React.FC<ReferencePreviewProps> = ({
  nodeId,
  onNavigate,
  className,
}) => {
  const nodes = useNodeStore((state) => state.nodes);
  const supertags = useSupertagStore((state) => state.supertags);
  
  const targetNode = nodes[nodeId];
  
  // 获取节点图标
  const getNodeIcon = (node: Node) => {
    // 根据标签类型返回不同图标
    if (node.tags.includes(SYSTEM_TAGS.DAY)) return <Calendar size={14} className="text-blue-500" />;
    if (node.tags.includes(SYSTEM_TAGS.WEEK)) return <Calendar size={14} className="text-purple-500" />;
    if (node.tags.includes(SYSTEM_TAGS.MONTH)) return <Calendar size={14} className="text-orange-500" />;
    
    // 检查自定义标签
    const tagNames = node.tags
      .map(id => supertags[id]?.name?.toLowerCase())
      .filter(Boolean);
    
    if (tagNames.some(name => name?.includes('任务') || name?.includes('task'))) {
      return <CheckSquare size={14} className="text-green-500" />;
    }
    if (tagNames.some(name => name?.includes('会议') || name?.includes('meeting'))) {
      return <Clock size={14} className="text-red-500" />;
    }
    if (tagNames.some(name => name?.includes('想法') || name?.includes('idea'))) {
      return <Lightbulb size={14} className="text-yellow-500" />;
    }
    if (tagNames.some(name => name?.includes('文档') || name?.includes('doc'))) {
      return <FileText size={14} className="text-indigo-500" />;
    }
    if (tagNames.some(name => name?.includes('人') || name?.includes('person'))) {
      return <User size={14} className="text-pink-500" />;
    }
    
    return <FileText size={14} className="text-gray-400" />;
  };
  
  // 获取面包屑路径
  const breadcrumb = useMemo(() => {
    if (!targetNode) return [];
    
    const path: string[] = [];
    let currentNode: Node | null = targetNode.parentId ? nodes[targetNode.parentId] : null;
    
    while (currentNode && path.length < 3) {
      path.unshift(currentNode.content.substring(0, 20) + (currentNode.content.length > 20 ? '...' : ''));
      currentNode = currentNode.parentId ? nodes[currentNode.parentId] : null;
    }
    
    if (currentNode) {
      path.unshift('...');
    }
    
    return path;
  }, [targetNode, nodes]);
  
  // 获取节点的标签
  const nodeTags = useMemo(() => {
    if (!targetNode) return [];
    return targetNode.tags
      .map(tagId => supertags[tagId])
      .filter(tag => tag && !Object.values(SYSTEM_TAGS).includes(tag.id as any));
  }, [targetNode, supertags]);
  
  // 获取子节点（最多显示3个）
  const childNodes = useMemo(() => {
    if (!targetNode) return [];
    return targetNode.childrenIds
      .slice(0, 3)
      .map(id => nodes[id])
      .filter(Boolean);
  }, [targetNode, nodes]);
  
  // 获取重要字段值
  const importantFields = useMemo(() => {
    if (!targetNode) return [];
    
    const fields: { label: string; value: string }[] = [];
    
    // 遍历节点的标签，获取字段定义
    for (const tagId of targetNode.tags) {
      const tag = supertags[tagId];
      if (!tag) continue;
      
      for (const fieldDef of tag.fieldDefinitions) {
        const value = targetNode.fields[fieldDef.key];
        if (value && fields.length < 3) {
          let displayValue = String(value);
          if (fieldDef.type === 'date' && value) {
            displayValue = new Date(value as string).toLocaleDateString('zh-CN');
          }
          fields.push({
            label: fieldDef.name,
            value: displayValue.substring(0, 30) + (displayValue.length > 30 ? '...' : ''),
          });
        }
      }
    }
    
    return fields;
  }, [targetNode, supertags]);
  
  if (!targetNode) {
    return (
      <div className={cn("p-3 text-center text-gray-400", className)}>
        <p className="text-sm">节点已删除</p>
      </div>
    );
  }
  
  return (
    <div className={cn("space-y-3", className)}>
      {/* 头部：图标 + 标题 */}
      <div className="flex items-start gap-2">
        <div className="flex-shrink-0 mt-0.5">
          {getNodeIcon(targetNode)}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100 line-clamp-2">
            {targetNode.content || '无标题'}
          </h4>
          
          {/* 面包屑 */}
          {breadcrumb.length > 0 && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">
              {breadcrumb.join(' / ')}
            </p>
          )}
        </div>
      </div>
      
      {/* 标签 */}
      {nodeTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {nodeTags.map((tag) => {
            // 使用统一的标签样式函数
            const tagStyle = getTagStyle(tag);
            return (
              <span
                key={tag.id}
                className={cn(
                  "inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs rounded",
                  tagStyle.gradient,
                  tagStyle.text
                )}
              >
                <span className="text-xs">{tagStyle.icon}</span>
                {tag.name}
              </span>
            );
          })}
        </div>
      )}
      
      {/* 重要字段 */}
      {importantFields.length > 0 && (
        <div className="space-y-1 text-xs">
          {importantFields.map((field, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="text-gray-400 flex-shrink-0">{field.label}:</span>
              <span className="text-gray-600 dark:text-gray-300 truncate">{field.value}</span>
            </div>
          ))}
        </div>
      )}
      
      {/* 子节点预览 */}
      {childNodes.length > 0 && (
        <div className="border-t border-gray-100 dark:border-gray-700 pt-2">
          <p className="text-xs text-gray-400 mb-1">子节点:</p>
          <ul className="space-y-0.5">
            {childNodes.map((child) => (
              <li key={child.id} className="text-xs text-gray-600 dark:text-gray-300 truncate flex items-center gap-1">
                <span className="text-gray-300">•</span>
                {child.content || '无标题'}
              </li>
            ))}
            {targetNode.childrenIds.length > 3 && (
              <li className="text-xs text-gray-400">
                还有 {targetNode.childrenIds.length - 3} 个子节点...
              </li>
            )}
          </ul>
        </div>
      )}
      
      {/* 底部操作提示 */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
        <span className="text-[10px] text-gray-400">
          点击跳转 · <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[9px]">⌘</kbd>+点击 侧栏打开
        </span>
      </div>
    </div>
  );
};

export default ReferencePreview;
