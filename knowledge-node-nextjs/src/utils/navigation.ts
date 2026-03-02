/**
 * 节点导航工具函数（统一树：仅基于 nodes 做子树/视口解析）
 */

import { Node } from '@/types';
import { SYSTEM_TAGS } from '@/utils/date-helpers';

export interface NavigationTarget {
  nodeId: string;
  hoistNodeId?: string;
}

function findUserRootId(nodes: Record<string, Node>): string | null {
  return Object.values(nodes).find((n) => n.nodeRole === 'user_root')?.id ?? null;
}

/** 从节点向上找到 user_root 的一级子节点（即所在“笔记本”根或 daily_root） */
function findFirstLevelRootId(nodeId: string, nodes: Record<string, Node>): string | null {
  const userRootId = findUserRootId(nodes);
  if (!userRootId) return null;
  let cur: Node | undefined = nodes[nodeId];
  while (cur?.parentId && cur.parentId !== userRootId) {
    cur = nodes[cur.parentId];
  }
  if (cur?.parentId === userRootId) return cur.id;
  return null;
}

/**
 * 分析目标节点的导航信息（统一树：无 Notebook，仅 hoist 根）
 */
export function analyzeNavigationTarget(
  targetNode: Node,
  nodes: Record<string, Node>
): NavigationTarget {
  const nodeId = targetNode.id;

  const isCalendarSystemNode = targetNode.tags.some((tagId) =>
    [SYSTEM_TAGS.YEAR, SYSTEM_TAGS.MONTH, SYSTEM_TAGS.WEEK, SYSTEM_TAGS.DAY].includes(tagId as never)
  );

  if (isCalendarSystemNode) {
    return { nodeId, hoistNodeId: nodeId };
  }

  const firstLevelRootId = findFirstLevelRootId(nodeId, nodes);
  if (firstLevelRootId) {
    const rootNode = nodes[firstLevelRootId];
    if (rootNode?.nodeRole === 'daily_root') {
      const findDay = (): string | null => {
        let cur: Node | null = targetNode;
        while (cur) {
          if (cur.tags?.includes(SYSTEM_TAGS.DAY)) return cur.id;
          cur = cur.parentId ? nodes[cur.parentId] : null;
        }
        return null;
      };
      const dayId = findDay();
      return { nodeId, hoistNodeId: dayId ?? firstLevelRootId };
    }
    return { nodeId, hoistNodeId: firstLevelRootId };
  }

  const findCalendarParent = (): string | null => {
    let cur: Node | null = targetNode;
    while (cur) {
      if (cur.tags?.includes(SYSTEM_TAGS.DAY)) return cur.id;
      cur = cur.parentId ? nodes[cur.parentId] : null;
    }
    return null;
  };
  const calendarParent = findCalendarParent();
  return { nodeId, hoistNodeId: calendarParent ?? undefined };
}

export function getNodeBreadcrumb(
  nodeId: string,
  nodes: Record<string, Node>,
  maxDepth: number = 3
): Array<{ id: string; title: string }> {
  const breadcrumb: Array<{ id: string; title: string }> = [];
  let currentNode = nodes[nodeId];
  let depth = 0;

  while (currentNode && depth < maxDepth) {
    const isCalendarNode = currentNode.tags?.some((tagId) =>
      [SYSTEM_TAGS.YEAR, SYSTEM_TAGS.MONTH, SYSTEM_TAGS.WEEK, SYSTEM_TAGS.DAY].includes(tagId as never)
    );
    if (!isCalendarNode) {
      breadcrumb.unshift({
        id: currentNode.id,
        title: (currentNode.content || '').slice(0, 30).replace(/\n/g, ' ') + (currentNode.content && currentNode.content.length > 30 ? '...' : ''),
      });
      depth++;
    }
    currentNode = currentNode.parentId ? nodes[currentNode.parentId] : null!;
  }
  return breadcrumb;
}

export function getNodeDateInfo(nodeId: string, nodes: Record<string, Node>): string | null {
  let currentNode = nodes[nodeId];
  while (currentNode) {
    if (currentNode.tags?.includes(SYSTEM_TAGS.DAY)) {
      const match = currentNode.id.match(/day-(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const [, y, m, d] = match;
        return `${y}年${parseInt(m, 10)}月${parseInt(d, 10)}日`;
      }
      return currentNode.content || null;
    }
    currentNode = currentNode.parentId ? nodes[currentNode.parentId] : null!;
  }
  return null;
}
