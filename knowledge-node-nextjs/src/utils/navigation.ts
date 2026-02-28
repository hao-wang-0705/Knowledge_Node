/**
 * 节点导航工具函数
 * 
 * 提供统一的节点导航能力，支持跨笔记本、跨视图的导航
 * 
 * @author Knowledge Node Team
 * @version 1.0.0
 */

import { Node, Notebook, NavigationMode } from '@/types';
import { SYSTEM_TAGS } from '@/utils/date-helpers';

/**
 * 导航目标信息
 */
export interface NavigationTarget {
  /** 目标节点 ID */
  nodeId: string;
  /** 需要设置的 hoist 节点 ID */
  hoistNodeId?: string;
  /** 导航模式 */
  navigationMode: NavigationMode;
  /** 笔记本 ID（如果是笔记本节点） */
  notebookId?: string;
}

/**
 * 分析目标节点的导航信息
 * 
 * @param targetNode - 目标节点
 * @param nodes - 所有节点
 * @param notebooks - 所有笔记本
 * @returns 导航目标信息
 */
export function analyzeNavigationTarget(
  targetNode: Node,
  nodes: Record<string, Node>,
  notebooks: Record<string, Notebook>
): NavigationTarget {
  const nodeId = targetNode.id;
  
  // 判断是否是日历系统节点
  const isCalendarSystemNode = targetNode.tags.some(tagId => 
    [SYSTEM_TAGS.YEAR, SYSTEM_TAGS.MONTH, SYSTEM_TAGS.WEEK, SYSTEM_TAGS.DAY].includes(tagId as any)
  );
  
  if (isCalendarSystemNode) {
    return {
      nodeId,
      hoistNodeId: nodeId,
      navigationMode: 'calendar',
    };
  }
  
  // 查找节点所属的笔记本
  const belongsToNotebook = Object.values(notebooks).find(nb => {
    let currentNode: Node | null = targetNode;
    while (currentNode) {
      if (currentNode.id === nb.rootNodeId) return true;
      currentNode = currentNode.parentId ? nodes[currentNode.parentId] : null;
    }
    return false;
  });
  
  if (belongsToNotebook) {
    return {
      nodeId,
      hoistNodeId: belongsToNotebook.rootNodeId,
      navigationMode: 'notebook',
      notebookId: belongsToNotebook.id,
    };
  }
  
  // 查找日历父节点（日节点）
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
  
  const calendarParent = findCalendarParent();
  
  return {
    nodeId,
    hoistNodeId: calendarParent || undefined,
    navigationMode: 'calendar',
  };
}

/**
 * 获取节点的面包屑路径
 * 
 * @param nodeId - 节点 ID
 * @param nodes - 所有节点
 * @param maxDepth - 最大深度（默认 3）
 * @returns 面包屑数组
 */
export function getNodeBreadcrumb(
  nodeId: string,
  nodes: Record<string, Node>,
  maxDepth: number = 3
): Array<{ id: string; title: string }> {
  const breadcrumb: Array<{ id: string; title: string }> = [];
  let currentNode = nodes[nodeId];
  let depth = 0;
  
  while (currentNode && depth < maxDepth) {
    // 跳过日历系统节点
    const isCalendarNode = currentNode.tags.some(tagId =>
      [SYSTEM_TAGS.YEAR, SYSTEM_TAGS.MONTH, SYSTEM_TAGS.WEEK, SYSTEM_TAGS.DAY].includes(tagId as any)
    );
    
    if (!isCalendarNode) {
      breadcrumb.unshift({
        id: currentNode.id,
        title: currentNode.content.slice(0, 30).replace(/\n/g, ' ') + 
               (currentNode.content.length > 30 ? '...' : ''),
      });
      depth++;
    }
    
    currentNode = currentNode.parentId ? nodes[currentNode.parentId] : null!;
  }
  
  return breadcrumb;
}

/**
 * 格式化节点的日期信息
 * 
 * @param nodeId - 节点 ID
 * @param nodes - 所有节点
 * @returns 日期字符串或 null
 */
export function getNodeDateInfo(
  nodeId: string,
  nodes: Record<string, Node>
): string | null {
  let currentNode = nodes[nodeId];
  
  while (currentNode) {
    // 检查是否是日节点
    if (currentNode.tags.includes(SYSTEM_TAGS.DAY)) {
      // 从节点 ID 解析日期（格式：day-YYYY-MM-DD）
      const match = currentNode.id.match(/day-(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const [, year, month, day] = match;
        return `${year}年${parseInt(month)}月${parseInt(day)}日`;
      }
      // 从内容解析日期
      return currentNode.content;
    }
    
    currentNode = currentNode.parentId ? nodes[currentNode.parentId] : null!;
  }
  
  return null;
}
