/**
 * 日历节点 ID 解析与映射
 * 严格模式：日历节点仅使用标准 logicalId（year/week/day），不再兼容旧前缀 ID。
 */

import type { Node } from '@/types';
import { getCalendarNodeType } from '@/utils/date-helpers';

let calendarNodeIdMap: Record<string, string> = {};

/**
 * 查找日历节点的实际 ID（处理带前缀的情况）
 * @param originalId 原始日历节点 ID（如 day-2026-02-27）
 * @param nodes 当前节点字典
 * @returns 实际使用的节点 ID，不存在则返回 null
 */
export function findCalendarNodeActualId(
  originalId: string,
  nodes: Record<string, Node>
): string | null {
  if (calendarNodeIdMap[originalId] && nodes[calendarNodeIdMap[originalId]]) {
    return calendarNodeIdMap[originalId];
  }
  if (nodes[originalId]) {
    calendarNodeIdMap[originalId] = originalId;
    return originalId;
  }
  return null;
}

/**
 * 解析日历节点的实际 parentId（处理带前缀的情况）
 * @param originalParentId 原始父节点 ID
 * @param nodes 当前节点字典
 * @returns 实际使用的父节点 ID，或 undefined 表示非法输入
 *
 * 返回值语义：
 * - string: 解析成功，返回实际的父节点 ID
 * - null: 明确表示根节点（仅显式根插入允许）
 * - undefined: 非法输入（调用方未提供 parentId）
 */
export function resolveCalendarParentId(
  originalParentId: string | null | undefined,
  nodes: Record<string, Node>
): string | null | undefined {
  if (originalParentId === null) {
    return null;
  }
  if (originalParentId === undefined) {
    return undefined;
  }
  const calendarType = getCalendarNodeType(originalParentId);
  if (calendarType) {
    const actualId = findCalendarNodeActualId(originalParentId, nodes);
    if (actualId) return actualId;
  }
  return originalParentId;
}

/**
 * 初始化日历节点 ID 映射（从已加载的节点中构建）
 * @param nodes 节点字典
 */
export function initCalendarNodeIdMap(nodes: Record<string, Node>): void {
  calendarNodeIdMap = {};
  for (const nodeId of Object.keys(nodes)) {
    if (
      nodeId.startsWith('year-') ||
      nodeId.startsWith('week-') ||
      nodeId.startsWith('day-')
    ) {
      calendarNodeIdMap[nodeId] = nodeId;
    }
  }
  if (typeof console !== 'undefined' && console.log) {
    console.log('[calendarNodeId] 映射已初始化:', Object.keys(calendarNodeIdMap).length, '个');
  }
}

/**
 * 设置一条映射（由 nodeStore 在创建/发现日历节点时调用）
 */
export function setCalendarNodeIdMapping(originalId: string, actualId: string): void {
  calendarNodeIdMap[originalId] = actualId;
}
