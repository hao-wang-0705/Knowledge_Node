/**
 * 日历节点 ID 解析与映射
 * 用于多用户场景下带前缀的日历节点 ID（如 user123_day-2026-02-27）与原始 ID 的互查。
 * 参见 ADR-003（可选）日历节点多用户 ID 前缀策略。
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
  for (const nodeId of Object.keys(nodes)) {
    if (nodeId.endsWith(`_${originalId}`)) {
      calendarNodeIdMap[originalId] = nodeId;
      return nodeId;
    }
  }
  return null;
}

/**
 * 解析日历节点的实际 parentId（处理带前缀的情况）
 * @param originalParentId 原始父节点 ID
 * @param nodes 当前节点字典
 * @returns 实际使用的父节点 ID
 */
export function resolveCalendarParentId(
  originalParentId: string | null,
  nodes: Record<string, Node>
): string | null {
  if (!originalParentId) return null;
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
      nodeId.startsWith('month-') ||
      nodeId.startsWith('week-') ||
      nodeId.startsWith('day-')
    ) {
      calendarNodeIdMap[nodeId] = nodeId;
    } else {
      const prefixMatch = nodeId.match(/^[a-z0-9]+_(year-|month-|week-|day-)(.+)$/);
      if (prefixMatch) {
        const originalId = nodeId.substring(nodeId.indexOf('_') + 1);
        calendarNodeIdMap[originalId] = nodeId;
      }
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
