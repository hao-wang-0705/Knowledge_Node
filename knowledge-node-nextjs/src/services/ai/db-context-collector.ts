/**
 * 数据库版节点上下文收集器
 * v3.5: 直接从数据库查询子节点，不依赖前端传递
 * 
 * 用于 AI 字段处理时从数据库获取子节点内容作为上下文
 */

import { prisma } from '@/lib/prisma';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 数据库查询选项
 */
export interface DbCollectContextOptions {
  /** 最大遍历深度（默认 1） */
  maxDepth?: number;
  /** 最大内容长度限制（默认 10000 字符） */
  maxLength?: number;
  /** 是否添加层级标识（默认 true） */
  showDepthIndicator?: boolean;
  /** 内容分隔符（默认 '\n'） */
  separator?: string;
}

/**
 * 收集结果
 */
export interface DbCollectContextResult {
  /** 收集到的完整内容 */
  content: string;
  /** 收集的节点数量 */
  nodeCount: number;
  /** 是否被截断 */
  truncated: boolean;
  /** 实际遍历深度 */
  actualDepth: number;
}

/**
 * 简化的节点结构（包含上下文收集所需字段）
 */
interface SimpleNode {
  id: string;
  content: string;
  tags: string[];
  fields: Record<string, unknown>;
  children: SimpleNode[];
}

// ============================================================================
// 默认配置
// ============================================================================

const DEFAULT_OPTIONS: Required<DbCollectContextOptions> = {
  maxDepth: 1,
  maxLength: 10000,
  showDepthIndicator: true,
  separator: '\n',
};

// ============================================================================
// 核心函数
// ============================================================================

/**
 * 从数据库收集子节点上下文
 * 
 * @param nodeId 起始节点 ID（数据库主键 id，非 logicalId）
 * @param userId 用户 ID（用于权限验证）
 * @param options 收集选项
 * @returns 收集结果
 * 
 * @example
 * ```ts
 * const result = await collectChildrenContextFromDb('node-123', 'user-456', {
 *   maxDepth: 2,
 * });
 * console.log(result.content);
 * ```
 */
export async function collectChildrenContextFromDb(
  nodeId: string,
  userId: string,
  options?: DbCollectContextOptions
): Promise<DbCollectContextResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  try {
    // 递归查询子节点
    const nodeWithChildren = await fetchNodeWithChildren(nodeId, userId, opts.maxDepth);

    if (!nodeWithChildren || nodeWithChildren.children.length === 0) {
      return {
        content: '',
        nodeCount: 0,
        truncated: false,
        actualDepth: 0,
      };
    }

    // 广度优先遍历收集内容
    return collectFromTree(nodeWithChildren.children, opts);
  } catch (error) {
    console.error('[DbContextCollector] 查询失败:', error);
    return {
      content: '',
      nodeCount: 0,
      truncated: false,
      actualDepth: 0,
    };
  }
}

/**
 * 递归获取节点及其子节点
 * 使用 Prisma 的嵌套查询实现
 */
async function fetchNodeWithChildren(
  nodeId: string,
  userId: string,
  maxDepth: number
): Promise<SimpleNode | null> {
  // 构建递归 include 对象，始终包含 tags 和 fields
  const buildInclude = (depth: number): object => {
    if (depth <= 0) {
      return {
        children: {
          where: { userId },
          select: { id: true, content: true, tags: true, fields: true },
          orderBy: { sortOrder: 'asc' as const },
        },
      };
    }
    return {
      children: {
        where: { userId },
        select: {
          id: true,
          content: true,
          tags: true,
          fields: true,
          ...buildInclude(depth - 1),
        },
        orderBy: { sortOrder: 'asc' as const },
      },
    };
  };

  const node = await prisma.node.findFirst({
    where: {
      id: nodeId,
      userId,
    },
    select: {
      id: true,
      content: true,
      tags: true,
      fields: true,
      ...buildInclude(maxDepth),
    },
  });

  return node as SimpleNode | null;
}

/**
 * 从树结构中收集内容（广度优先）
 * 包含标签和字段信息的格式化输出
 */
function collectFromTree(
  children: SimpleNode[],
  opts: Required<DbCollectContextOptions>
): DbCollectContextResult {
  const contentParts: string[] = [];
  let nodeCount = 0;
  let actualDepth = 0;
  let currentLength = 0;
  let truncated = false;

  // 广度优先遍历队列：[节点, 深度]
  const queue: Array<[SimpleNode, number]> = children.map(child => [child, 1]);

  while (queue.length > 0) {
    const [node, depth] = queue.shift()!;

    // 深度限制检查
    if (depth > opts.maxDepth) {
      continue;
    }

    // 记录实际遍历深度
    if (depth > actualDepth) {
      actualDepth = depth;
    }

    // 构建内容行，包含标签和字段信息
    const depthPrefix = opts.showDepthIndicator 
      ? '  '.repeat(depth - 1) + '• ' 
      : '';
    
    // 格式化标签
    const tagsStr = node.tags?.length > 0 
      ? `[${node.tags.join(', ')}] ` 
      : '';
    
    // 格式化关键字段（过滤掉空值和内部字段）
    const fieldsObj = node.fields as Record<string, unknown> | undefined;
    const relevantFields = fieldsObj 
      ? Object.entries(fieldsObj)
          .filter(([key, value]) => {
            // 过滤掉空值、null、undefined
            if (value === null || value === undefined || value === '') return false;
            // 过滤掉内部字段（以下划线开头）
            if (key.startsWith('_')) return false;
            return true;
          })
          .slice(0, 5) // 最多显示5个字段，避免上下文过长
      : [];
    
    const fieldsStr = relevantFields.length > 0
      ? `{${relevantFields.map(([k, v]) => `${k}: "${v}"`).join(', ')}} `
      : '';

    const contentLine = depthPrefix + tagsStr + fieldsStr + (node.content || '').trim();

    // 长度限制检查
    if (currentLength + contentLine.length > opts.maxLength) {
      truncated = true;
      break;
    }

    if ((node.content || '').trim() || tagsStr || fieldsStr) {
      contentParts.push(contentLine);
      currentLength += contentLine.length + opts.separator.length;
      nodeCount++;
    }

    // 添加子节点到队列（下一层级）
    if (depth < opts.maxDepth && node.children && node.children.length > 0) {
      for (const child of node.children) {
        queue.push([child, depth + 1]);
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
 * 通过 logicalId 收集子节点上下文
 * 某些场景下前端只有 logicalId，需要先转换
 */
export async function collectChildrenContextByLogicalId(
  logicalId: string,
  userId: string,
  options?: DbCollectContextOptions
): Promise<DbCollectContextResult> {
  // 先查找节点的真实 id
  const node = await prisma.node.findFirst({
    where: {
      logicalId,
      userId,
    },
    select: { id: true },
  });

  if (!node) {
    return {
      content: '',
      nodeCount: 0,
      truncated: false,
      actualDepth: 0,
    };
  }

  return collectChildrenContextFromDb(node.id, userId, options);
}
