/**
 * 引用相关的工具函数
 * 
 * 支持两种引用格式:
 * 1. @{node_id:节点标题} - 原有格式，用于程序化引用
 * 2. [[节点标题]] - 双链格式，类似 Roam/Obsidian 风格
 * 
 * 例如: 
 * - @{abc123:2026年规划}
 * - [[2026年规划]]
 */

// 原有引用格式的正则表达式: @{nodeId:title}
export const REFERENCE_REGEX = /@\{([^:]+):([^}]+)\}/g;

// 双链格式的正则表达式: [[title]]
export const DOUBLE_BRACKET_REGEX = /\[\[([^\]]+)\]\]/g;

// 组合正则：匹配两种格式
export const COMBINED_REFERENCE_REGEX = /(@\{([^:]+):([^}]+)\}|\[\[([^\]]+)\]\])/g;

// 检测双链触发器: [[
export const DOUBLE_BRACKET_TRIGGER = '[[';

// 解析后的引用对象
export interface ParsedReference {
  fullMatch: string;    // 完整匹配文本
  nodeId: string;       // 节点 ID（双链格式时为空，需要通过标题查找）
  title: string;        // 节点标题
  startIndex: number;   // 在原文中的起始位置
  endIndex: number;     // 在原文中的结束位置
  format: 'at' | 'bracket'; // 引用格式类型
}

/**
 * 解析文本中的所有引用（支持两种格式）
 */
export function parseReferences(text: string): ParsedReference[] {
  const references: ParsedReference[] = [];
  
  // 解析 @{nodeId:title} 格式
  const atRegex = new RegExp(REFERENCE_REGEX.source, 'g');
  let match;
  
  while ((match = atRegex.exec(text)) !== null) {
    references.push({
      fullMatch: match[0],
      nodeId: match[1],
      title: match[2],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      format: 'at',
    });
  }
  
  // 解析 [[title]] 格式
  const bracketRegex = new RegExp(DOUBLE_BRACKET_REGEX.source, 'g');
  
  while ((match = bracketRegex.exec(text)) !== null) {
    references.push({
      fullMatch: match[0],
      nodeId: '', // 双链格式需要通过标题查找 nodeId
      title: match[1],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      format: 'bracket',
    });
  }
  
  // 按位置排序
  return references.sort((a, b) => a.startIndex - b.startIndex);
}

/**
 * 仅解析原有 @{} 格式的引用
 */
export function parseAtReferences(text: string): ParsedReference[] {
  const references: ParsedReference[] = [];
  const regex = new RegExp(REFERENCE_REGEX.source, 'g');
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    references.push({
      fullMatch: match[0],
      nodeId: match[1],
      title: match[2],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      format: 'at',
    });
  }
  
  return references;
}

/**
 * 仅解析双链 [[]] 格式的引用
 */
export function parseBracketReferences(text: string): ParsedReference[] {
  const references: ParsedReference[] = [];
  const regex = new RegExp(DOUBLE_BRACKET_REGEX.source, 'g');
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    references.push({
      fullMatch: match[0],
      nodeId: '',
      title: match[1],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      format: 'bracket',
    });
  }
  
  return references;
}

/**
 * 检查文本是否包含引用（任意格式）
 */
export function hasReferences(text: string): boolean {
  const atRegex = new RegExp(REFERENCE_REGEX.source);
  const bracketRegex = new RegExp(DOUBLE_BRACKET_REGEX.source);
  return atRegex.test(text) || bracketRegex.test(text);
}

/**
 * 检查文本是否包含双链触发器 [[
 */
export function hasDoubleBracketTrigger(text: string, cursorPosition: number): boolean {
  // 检查光标前两个字符是否是 [[
  if (cursorPosition < 2) return false;
  const beforeCursor = text.slice(0, cursorPosition);
  return beforeCursor.endsWith(DOUBLE_BRACKET_TRIGGER);
}

/**
 * 获取双链输入状态（用于触发搜索弹窗）
 */
export function getDoubleBracketState(text: string, cursorPosition: number): {
  isActive: boolean;
  searchQuery: string;
  triggerStart: number;
} {
  // 查找最近的 [[ 位置
  const beforeCursor = text.slice(0, cursorPosition);
  const lastTriggerIndex = beforeCursor.lastIndexOf(DOUBLE_BRACKET_TRIGGER);
  
  if (lastTriggerIndex === -1) {
    return { isActive: false, searchQuery: '', triggerStart: -1 };
  }
  
  // 检查 [[ 之后是否有 ]]（说明已完成引用）
  const afterTrigger = text.slice(lastTriggerIndex + 2, cursorPosition);
  if (afterTrigger.includes(']]')) {
    return { isActive: false, searchQuery: '', triggerStart: -1 };
  }
  
  // 检查是否在同一行（不允许跨行）
  if (afterTrigger.includes('\n')) {
    return { isActive: false, searchQuery: '', triggerStart: -1 };
  }
  
  return {
    isActive: true,
    searchQuery: afterTrigger,
    triggerStart: lastTriggerIndex,
  };
}

/**
 * 创建引用文本（原有 @{} 格式）
 */
export function createReferenceText(nodeId: string, title: string): string {
  // 清理标题中的特殊字符，避免破坏格式
  const cleanTitle = title.replace(/[{}:]/g, '').trim() || '未命名节点';
  return `@{${nodeId}:${cleanTitle}}`;
}

/**
 * 创建双链引用文本
 */
export function createBracketReferenceText(title: string): string {
  // 清理标题中的方括号
  const cleanTitle = title.replace(/[\[\]]/g, '').trim() || '未命名节点';
  return `[[${cleanTitle}]]`;
}

/**
 * 将双链格式转换为原有 @{} 格式
 * 需要提供节点查找函数
 */
export function convertBracketToAtFormat(
  text: string,
  findNodeByTitle: (title: string) => { id: string; content: string } | undefined
): string {
  return text.replace(DOUBLE_BRACKET_REGEX, (match, title) => {
    const node = findNodeByTitle(title);
    if (node) {
      return createReferenceText(node.id, title);
    }
    // 如果找不到节点，保留原格式
    return match;
  });
}

/**
 * 替换双链触发器为完整引用
 */
export function replaceDoubleBracketTrigger(
  text: string,
  triggerStart: number,
  cursorPosition: number,
  nodeId: string,
  title: string
): string {
  const before = text.slice(0, triggerStart);
  const after = text.slice(cursorPosition);
  const reference = createReferenceText(nodeId, title);
  return before + reference + after;
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
 * 将文本分割为普通文本和引用块
 */
export interface TextSegment {
  type: 'text' | 'reference';
  content: string;
  nodeId?: string;
  title?: string;
  format?: 'at' | 'bracket';
}

export function splitTextWithReferences(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const references = parseReferences(text);
  let lastIndex = 0;
  
  for (const ref of references) {
    // 添加引用前的普通文本
    if (ref.startIndex > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, ref.startIndex),
      });
    }
    
    // 添加引用
    segments.push({
      type: 'reference',
      content: ref.fullMatch,
      nodeId: ref.nodeId,
      title: ref.title,
      format: ref.format,
    });
    
    lastIndex = ref.endIndex;
  }
  
  // 添加最后的普通文本
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex),
    });
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
