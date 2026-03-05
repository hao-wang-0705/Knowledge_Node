/**
 * 节点上下文收集器
 * v3.5: 支持深度控制的子节点内容递归收集
 * 
 * 用于 AI 字段处理时收集节点及其子节点的内容作为上下文
 */

import type { Node } from '@/types';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 上下文收集选项
 */
export interface CollectContextOptions {
  /** 最大遍历深度（默认 1） */
  maxDepth?: number;
  /** 是否包含当前节点内容（默认 true） */
  includeCurrentNode?: boolean;
  /** 内容分隔符（默认 '\n'） */
  separator?: string;
  /** 是否添加层级标识（默认 true） */
  showDepthIndicator?: boolean;
  /** 最大内容长度限制（默认 10000 字符） */
  maxLength?: number;
}

/**
 * 收集结果
 */
export interface CollectContextResult {
  /** 收集到的完整内容 */
  content: string;
  /** 收集的节点数量 */
  nodeCount: number;
  /** 是否被截断 */
  truncated: boolean;
  /** 实际遍历深度 */
  actualDepth: number;
}

// ============================================================================
// 默认配置
// ============================================================================

const DEFAULT_OPTIONS: Required<CollectContextOptions> = {
  maxDepth: 1,
  includeCurrentNode: true,
  separator: '\n',
  showDepthIndicator: true,
  maxLength: 10000,
};

// ============================================================================
// 核心函数
// ============================================================================

/**
 * 收集节点上下文（广度优先遍历）
 * 
 * @param nodeId 起始节点 ID
 * @param nodes 所有节点的映射表
 * @param options 收集选项
 * @returns 收集结果
 * 
 * @example
 * ```ts
 * const result = collectNodeContext('node-123', nodeStore.nodes, {
 *   maxDepth: 2,
 *   includeCurrentNode: true,
 * });
 * console.log(result.content);
 * ```
 */
export function collectNodeContext(
  nodeId: string,
  nodes: Record<string, Node>,
  options?: CollectContextOptions
): CollectContextResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startNode = nodes[nodeId];

  if (!startNode) {
    return {
      content: '',
      nodeCount: 0,
      truncated: false,
      actualDepth: 0,
    };
  }

  const contentParts: string[] = [];
  let nodeCount = 0;
  let actualDepth = 0;
  let currentLength = 0;
  let truncated = false;

  // 广度优先遍历队列：[节点ID, 深度]
  const queue: Array<[string, number]> = [];

  // 初始化队列
  if (opts.includeCurrentNode) {
    queue.push([nodeId, 0]);
  } else {
    // 不包含当前节点时，直接添加子节点
    for (const childId of startNode.childrenIds) {
      queue.push([childId, 1]);
    }
  }

  // 广度优先遍历
  while (queue.length > 0) {
    const [currentId, depth] = queue.shift()!;

    // 深度限制检查
    if (depth > opts.maxDepth) {
      continue;
    }

    const node = nodes[currentId];
    if (!node) continue;

    // 记录实际遍历深度
    if (depth > actualDepth) {
      actualDepth = depth;
    }

    // 构建内容行
    const depthPrefix = opts.showDepthIndicator ? '  '.repeat(depth) + (depth > 0 ? '• ' : '') : '';
    const contentLine = depthPrefix + node.content.trim();

    // 长度限制检查
    if (currentLength + contentLine.length > opts.maxLength) {
      truncated = true;
      break;
    }

    if (node.content.trim()) {
      contentParts.push(contentLine);
      currentLength += contentLine.length + opts.separator.length;
      nodeCount++;
    }

    // 添加子节点到队列（下一层级）
    if (depth < opts.maxDepth && node.childrenIds.length > 0) {
      for (const childId of node.childrenIds) {
        queue.push([childId, depth + 1]);
      }
    }
  }

  return {
    content: contentParts.join(opts.separator),
    nodeCount,
    truncated,
    actualDepth,
  };
}

/**
 * 仅收集子节点内容（不包含当前节点）
 * 
 * @param nodeId 起始节点 ID
 * @param nodes 所有节点的映射表
 * @param options 收集选项
 * @returns 收集结果
 */
export function collectChildrenContext(
  nodeId: string,
  nodes: Record<string, Node>,
  options?: Omit<CollectContextOptions, 'includeCurrentNode'>
): CollectContextResult {
  return collectNodeContext(nodeId, nodes, {
    ...options,
    includeCurrentNode: false,
  });
}

/**
 * 收集节点路径上下文（向上遍历到根节点）
 * 
 * @param nodeId 起始节点 ID
 * @param nodes 所有节点的映射表
 * @param maxAncestors 最大祖先节点数量（默认 3）
 * @returns 祖先节点内容数组（从根到当前的顺序）
 */
export function collectAncestorContext(
  nodeId: string,
  nodes: Record<string, Node>,
  maxAncestors = 3
): string[] {
  const ancestors: string[] = [];
  let currentId: string | null = nodeId;
  let count = 0;

  while (currentId && count < maxAncestors) {
    const node: Node | undefined = nodes[currentId];
    if (!node) break;

    if (node.content.trim()) {
      ancestors.unshift(node.content.trim());
    }
    currentId = node.parentId;
    count++;
  }

  return ancestors;
}

/**
 * 构建完整的节点上下文（包含祖先和子节点）
 * 
 * @param nodeId 节点 ID
 * @param nodes 所有节点的映射表
 * @param options 选项
 * @returns 格式化的上下文字符串
 */
export function buildFullNodeContext(
  nodeId: string,
  nodes: Record<string, Node>,
  options?: {
    maxAncestors?: number;
    maxChildrenDepth?: number;
  }
): string {
  const { maxAncestors = 2, maxChildrenDepth = 2 } = options || {};

  const node = nodes[nodeId];
  if (!node) return '';

  const parts: string[] = [];

  // 收集祖先上下文
  const ancestors = collectAncestorContext(nodeId, nodes, maxAncestors);
  if (ancestors.length > 1) {
    parts.push('## 上下文路径');
    parts.push(ancestors.slice(0, -1).map((a, i) => '  '.repeat(i) + '→ ' + a).join('\n'));
    parts.push('');
  }

  // 当前节点
  parts.push('## 当前节点');
  parts.push(node.content);
  parts.push('');

  // 收集子节点上下文
  const childrenResult = collectChildrenContext(nodeId, nodes, {
    maxDepth: maxChildrenDepth,
    showDepthIndicator: true,
  });

  if (childrenResult.nodeCount > 0) {
    parts.push('## 子节点内容');
    parts.push(childrenResult.content);
    if (childrenResult.truncated) {
      parts.push('... (内容已截断)');
    }
  }

  return parts.join('\n');
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 估算内容的 Token 数量
 * 粗略估算：中文约 2 字符/token，英文约 4 字符/token
 */
export function estimateTokens(content: string): number {
  const chineseChars = (content.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = content.length - chineseChars;
  return Math.ceil(chineseChars / 2 + otherChars / 4);
}

/**
 * 根据 Token 预算调整收集深度
 * 
 * @param nodeId 节点 ID
 * @param nodes 所有节点的映射表
 * @param maxTokens 最大 Token 预算
 * @returns 推荐的收集深度
 */
export function suggestContextDepth(
  nodeId: string,
  nodes: Record<string, Node>,
  maxTokens = 2000
): number {
  // 尝试不同深度，找到最大不超过预算的深度
  for (let depth = 5; depth >= 1; depth--) {
    const result = collectNodeContext(nodeId, nodes, {
      maxDepth: depth,
      includeCurrentNode: true,
    });
    if (estimateTokens(result.content) <= maxTokens) {
      return depth;
    }
  }
  return 1;
}
