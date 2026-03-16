'use client';

import React, { useMemo } from 'react';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNodeStore } from '@/stores/nodeStore';
import { getPlainTextWithoutReferences } from '@/utils/reference-helpers';

interface ReferencePreviewProps {
  nodeId: string;
  onNavigate?: () => void;
  className?: string;
}

const NOTE_PREVIEW_MAX_LEN = 120;

/**
 * 引用预览组件 - 仅展示笔记内容 + 跳转笔记页按钮
 */
export const ReferencePreview: React.FC<ReferencePreviewProps> = ({
  nodeId,
  onNavigate,
  className,
}) => {
  const nodes = useNodeStore((state) => state.nodes);
  const targetNode = nodes[nodeId];

  const noteContent = useMemo(() => {
    if (!targetNode) return '';
    const plain = getPlainTextWithoutReferences(targetNode.content);
    return plain.length > NOTE_PREVIEW_MAX_LEN
      ? plain.slice(0, NOTE_PREVIEW_MAX_LEN) + '…'
      : plain;
  }, [targetNode]);

  if (!targetNode) {
    return (
      <div className={cn('p-3 text-center text-gray-400', className)}>
        <p className="text-sm">节点已删除</p>
      </div>
    );
  }

  return (
    <div className={cn('p-3 min-w-0', className)}>
      <div className="flex items-start gap-2">
        <p className="flex-1 text-sm text-gray-700 dark:text-gray-300 leading-relaxed line-clamp-3 break-words">
          {noteContent || '(无内容)'}
        </p>
        {onNavigate && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate();
            }}
            className="flex-shrink-0 p-1.5 rounded-md text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
            title="跳转到笔记页"
          >
            <ExternalLink size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

export default ReferencePreview;
