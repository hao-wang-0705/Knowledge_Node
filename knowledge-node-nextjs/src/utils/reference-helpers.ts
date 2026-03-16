/**
 * 引用相关工具函数
 * 说明：
 * - 行内渲染已升级为实体引用模型（references + anchorOffset）
 * - 仍保留少量 @{} / [[]] 文本兼容函数，仅用于纯文本展示与反向链接统计
 */

import type { Node, NodeReference } from '@/types';

// 原有引用格式的正则表达式: @{nodeId:title}
export const REFERENCE_REGEX = /@\{([^:]+):([^}]+)\}/g;

// 双链格式的正则表达式: [[title]]
export const DOUBLE_BRACKET_REGEX = /\[\[([^\]]+)\]\]/g;


/** 是否为日历结构节点 id（年/周/日），用于兜底：API 未返回 type/tags 时的兼容 */
function isCalendarStructureId(nodeId: string): boolean {
  const suffix = nodeId.includes('_') ? nodeId.split('_').pop() ?? nodeId : nodeId;
  return (
    suffix.startsWith('year-') ||
    suffix.startsWith('week-') ||
    suffix.startsWith('day-')
  );
}

/**
 * 判断节点是否可作为引用目标（统一屏蔽规则）。
 * 规则：排除自身 → 无内容 → 结构根 → 日历结构节点 → 可选笔记本 → 通过。
 * 日历节点判定：优先 type/tags（后端语义），兜底 payload.level 与 id 格式（兼容历史数据或未同步字段）。
 */
export function isReferenceableNode(
  node: Node,
  options?: { excludeNodeId?: string }
): boolean {
  if (options?.excludeNodeId && node.id === options.excludeNodeId) return false;
  if (!node.content?.trim()) return false;
  if (node.nodeRole && node.nodeRole !== 'normal') return false;
  // 日历结构节点：主判据（后端返回的语义字段）
  if (node.type === 'daily') return false;
  if (node.tags?.some((t) => String(t).startsWith('sys:calendar:'))) return false;
  // 兜底：payload.level（后端日历节点必有）与 id 格式（兼容未同步 type/tags 的节点）
  const level = (node.payload as { level?: string } | undefined)?.level;
  if (level === 'year' || level === 'week' || level === 'day') return false;
  if (isCalendarStructureId(node.id)) return false;
  const scope = (node as { scope?: string }).scope;
  const notebookId = (node as { notebookId?: string }).notebookId;
  if (scope === 'notebook' || notebookId) return false;
  return true;
}



/**
 * 获取纯文本（移除引用标记，只保留标题）
 */
export function getPlainTextWithoutReferences(text: string): string {
  // 先处理 @{} 格式
  let result = text.replace(REFERENCE_REGEX, '@$2');
  // 再处理 [[]] 格式
  result = result.replace(DOUBLE_BRACKET_REGEX, '$1');
  return result;
}


/**
 * 基于实体引用（NodeReference.anchorOffset）将纯文本 content 拆分为文本段和引用段
 * 实体化引用模型下，行内胶囊应优先使用此函数，而不是基于 @{} 文本解析
 */
export function splitContentWithInlineReferences(
  content: string,
  references: NodeReference[] | undefined,
): Array<{ type: 'text'; text: string } | { type: 'reference'; ref: NodeReference }> {
  if (!references || references.length === 0) {
    return content ? [{ type: 'text', text: content }] : [];
  }

  const sorted = [...references].sort((a, b) => (a.anchorOffset ?? 0) - (b.anchorOffset ?? 0));
  const segments: Array<{ type: 'text'; text: string } | { type: 'reference'; ref: NodeReference }> = [];
  let cursor = 0;

  for (const ref of sorted) {
    const offset = Math.max(0, Math.min(ref.anchorOffset ?? 0, content.length));
    if (offset > cursor) {
      segments.push({ type: 'text', text: content.slice(cursor, offset) });
    }
    segments.push({ type: 'reference', ref });
    cursor = offset;
  }

  if (cursor < content.length) {
    segments.push({ type: 'text', text: content.slice(cursor) });
  }

  return segments;
}

/**
 * 查找所有引用了指定节点的节点（反向链接）
 * 支持四种引用方式：
 * 1. 旧方式：嵌入在 content 中的 @{nodeId:title} 格式
 * 2. 新方式：独立的 references 数组
 * 3. 双链方式：[[title]] 格式（需要通过标题匹配）
 * 4. v2.1：Supertag 引用字段 (fields[key] === { nodeId } 或数组)
 */
export function findBacklinks(
  targetNodeId: string,
  allNodes: Record<string, { id: string; content: string; parentId: string | null; references?: Array<{ targetNodeId: string }>; fields?: Record<string, unknown> }>,
  targetTitle?: string
): string[] {
  const pattern = `@{${targetNodeId}:`;
  const bracketPattern = targetTitle ? `[[${targetTitle}]]` : null;

  return Object.values(allNodes)
    .filter((node) => {
      const hasContentRef = node.content.includes(pattern);
      const hasIndependentRef = node.references?.some((ref) => ref.targetNodeId === targetNodeId) || false;
      const hasBracketRef = bracketPattern ? node.content.includes(bracketPattern) : false;
      const hasFieldRef = node.fields && isReferencedInFields(targetNodeId, node.fields);
      return hasContentRef || hasIndependentRef || hasBracketRef || hasFieldRef;
    })
    .map((node) => node.id);
}

/** 判断 targetNodeId 是否出现在某节点的 fields 的引用类型值中 */
function isReferencedInFields(targetNodeId: string, fields: Record<string, unknown>): boolean {
  for (const v of Object.values(fields)) {
    if (!v) continue;
    if (typeof v === 'object' && 'nodeId' in v && (v as { nodeId: string }).nodeId === targetNodeId) return true;
    if (Array.isArray(v) && v.some((item) => typeof item === 'object' && item && 'nodeId' in item && (item as { nodeId: string }).nodeId === targetNodeId)) return true;
  }
  return false;
}

/**
 * v2.1: 查找通过「引用字段」引用指定节点的节点列表，返回节点 ID 及字段 key
 */
export function findBacklinksFromFields(
  targetNodeId: string,
  allNodes: Record<string, { id: string; fields?: Record<string, unknown> }>
): Array<{ nodeId: string; fieldKey: string }> {
  const result: Array<{ nodeId: string; fieldKey: string }> = [];
  for (const node of Object.values(allNodes)) {
    if (!node.fields) continue;
    for (const [fieldKey, v] of Object.entries(node.fields)) {
      if (!v) continue;
      if (typeof v === 'object' && 'nodeId' in v && (v as { nodeId: string }).nodeId === targetNodeId) {
        result.push({ nodeId: node.id, fieldKey });
      }
      if (Array.isArray(v)) {
        for (const item of v) {
          if (typeof item === 'object' && item && 'nodeId' in item && (item as { nodeId: string }).nodeId === targetNodeId) {
            result.push({ nodeId: node.id, fieldKey });
            break;
          }
        }
      }
    }
  }
  return result;
}

/**
 * 同步更新所有引用的标题快照
 * 当源节点标题变更时，更新所有引用它的节点
 */
export function updateReferenceTitles(
  nodeId: string,
  oldTitle: string,
  newTitle: string,
  allNodes: Record<string, { id: string; content: string }>
): Array<{ nodeId: string; newContent: string }> {
  const updates: Array<{ nodeId: string; newContent: string }> = [];
  
  const oldAtPattern = `@{${nodeId}:${oldTitle}}`;
  const newAtPattern = `@{${nodeId}:${newTitle}}`;
  const oldBracketPattern = `[[${oldTitle}]]`;
  const newBracketPattern = `[[${newTitle}]]`;
  
  for (const node of Object.values(allNodes)) {
    if (node.id === nodeId) continue; // 跳过源节点
    
    let newContent = node.content;
    let hasChanges = false;
    
    // 更新 @{} 格式
    if (newContent.includes(oldAtPattern)) {
      newContent = newContent.split(oldAtPattern).join(newAtPattern);
      hasChanges = true;
    }
    
    // 更新 [[]] 格式
    if (newContent.includes(oldBracketPattern)) {
      newContent = newContent.split(oldBracketPattern).join(newBracketPattern);
      hasChanges = true;
    }
    
    if (hasChanges) {
      updates.push({ nodeId: node.id, newContent });
    }
  }
  
  return updates;
}
