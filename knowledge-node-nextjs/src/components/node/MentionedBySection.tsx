'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNodeStore } from '@/stores/nodeStore';
import { nodesApi, type MentionedByItem } from '@/services/api/nodes';
import NodeComponent from '@/components/NodeComponent';
import CompactBreadcrumb from '@/components/CompactBreadcrumb';

interface MentionedBySectionProps {
  targetNodeId: string;
  className?: string;
}

const MentionedBySection: React.FC<MentionedBySectionProps> = ({ targetNodeId, className }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [mentionItems, setMentionItems] = useState<MentionedByItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const mergeNodeFromServer = useNodeStore((state) => state.mergeNodeFromServer);

  const visibleItems = useMemo(
    () => mentionItems.filter((item) => item.node?.id && item.node.id !== targetNodeId),
    [mentionItems, targetNodeId],
  );

  useEffect(() => {
    let cancelled = false;
    setIsExpanded(false);
    setIsLoading(true);
    nodesApi
      .getMentionedBy(targetNodeId)
      .then((items) => {
        if (cancelled) return;
        setMentionItems(items);
        items.forEach((item) => {
          if (item.node) {
            mergeNodeFromServer(item.node);
          }
        });
      })
      .catch(() => {
        if (cancelled) return;
        setMentionItems([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [targetNodeId, mergeNodeFromServer]);

  if (!isLoading && visibleItems.length === 0) {
    return null;
  }

  return (
    <section className={cn('rounded-xl border border-gray-200/70 dark:border-gray-700/70 bg-white/70 dark:bg-gray-900/40', className)}>
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50/80 dark:hover:bg-gray-800/40 rounded-xl transition-colors"
      >
        <Link2 size={14} className="text-gray-500 dark:text-gray-400" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
          被提及于 {isLoading ? '...' : visibleItems.length} 个节点
        </span>
        <span className="ml-auto text-gray-500 dark:text-gray-400">
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {isExpanded && (
        <div className="px-3 pb-3">
          <div className="max-h-[360px] overflow-y-auto pr-1 space-y-3">
            {isLoading && (
              <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">加载中...</div>
            )}
            {!isLoading && visibleItems.map((item) => (
              <div
                key={`${item.node.id}-${item.fieldKey ?? 'mention'}`}
                className="rounded-lg border border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/40"
              >
                <div className="px-3 pt-2 pb-1 min-h-[20px]">
                  {item.breadcrumbs.length > 0 ? (
                    <CompactBreadcrumb
                      breadcrumbs={item.breadcrumbs.map((crumb) => crumb.title)}
                      maxItems={3}
                      className="max-w-full"
                    />
                  ) : (
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">根节点</span>
                  )}
                </div>
                <div className="px-1 pb-1">
                  <NodeComponent nodeId={item.node.id} depth={0} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default MentionedBySection;
