'use client';

/**
 * BacklinkRenderer - 节点链接渲染器
 * v3.6: 解析内容中的节点 ID 语法，渲染为可点击的 Backlinks
 */

import React, { useMemo } from 'react';
import { Hash } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BacklinkRendererProps {
  content: string;
  nodeRefs: Array<{ nodeId: string; title: string }>;
  className?: string;
}

/**
 * 节点链接语法正则
 * 匹配 [[nodeId]] 或 [[nodeId|title]] 格式
 */
const NODE_LINK_REGEX = /\[\[([a-zA-Z0-9_-]+)(?:\|([^\]]+))?\]\]/g;

/**
 * BacklinkRenderer 组件
 */
export function BacklinkRenderer({
  content,
  nodeRefs,
  className,
}: BacklinkRendererProps) {
  // 构建节点 ID -> 标题映射
  const nodeMap = useMemo(() => {
    const map = new Map<string, string>();
    nodeRefs.forEach((ref) => {
      map.set(ref.nodeId, ref.title);
    });
    return map;
  }, [nodeRefs]);
  
  // 解析并渲染内容
  const renderedContent = useMemo(() => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let keyIndex = 0;
    
    // 重置正则
    NODE_LINK_REGEX.lastIndex = 0;
    
    while ((match = NODE_LINK_REGEX.exec(content)) !== null) {
      // 添加匹配前的文本
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${keyIndex++}`}>
            {content.slice(lastIndex, match.index)}
          </span>
        );
      }
      
      const nodeId = match[1];
      const explicitTitle = match[2];
      const title = explicitTitle || nodeMap.get(nodeId) || '未命名任务';
      
      // 添加节点链接
      parts.push(
        <NodeLink
          key={`link-${keyIndex++}`}
          nodeId={nodeId}
          title={title}
        />
      );
      
      lastIndex = match.index + match[0].length;
    }
    
    // 添加剩余文本
    if (lastIndex < content.length) {
      parts.push(
        <span key={`text-${keyIndex++}`}>
          {content.slice(lastIndex)}
        </span>
      );
    }
    
    return parts;
  }, [content, nodeMap]);
  
  return <span className={className}>{renderedContent}</span>;
}

/**
 * 节点链接组件
 */
interface NodeLinkProps {
  nodeId: string;
  title: string;
}

function NodeLink({ nodeId, title }: NodeLinkProps) {
  const handleClick = () => {
    // TODO: 实现节点跳转逻辑
    console.log('Navigate to node:', nodeId);
  };
  
  return (
    <button
      onClick={handleClick}
      className={cn(
        'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded',
        'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
        'hover:bg-blue-100 dark:hover:bg-blue-900/50',
        'transition-colors text-sm'
      )}
    >
      <Hash size={12} />
      <span className="max-w-[150px] truncate">{title}</span>
    </button>
  );
}

export default BacklinkRenderer;
