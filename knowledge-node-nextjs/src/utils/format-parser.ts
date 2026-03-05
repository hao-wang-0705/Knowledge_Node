/**
 * 流式 JSON 解析工具
 * 用于 AI 格式化笔记的增量解析
 */

import { z } from 'zod';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 格式化节点 Schema（AI 返回格式）
 */
export const FormatNodeSchema = z.object({
  tempId: z.string(),
  content: z.string().min(1),
  parentTempId: z.string().nullable(),
});

export type FormatNode = z.infer<typeof FormatNodeSchema>;

/**
 * 格式化进度状态
 */
export interface FormattingProgress {
  /** 已创建节点数 */
  nodeCount: number;
  /** tempId → realId 映射 */
  tempIdMap: Map<string, string>;
  /** 目标父节点 ID */
  targetParentId: string;
  /** 是否正在进行 */
  isActive: boolean;
}

// ============================================================================
// 流式 JSON 解析器
// ============================================================================

/**
 * 增量 JSON 数组解析器
 * 用于边接收 AI 响应边解析出完整的 JSON 对象
 */
export class StreamingJsonParser {
  private buffer: string = '';
  private bracketDepth: number = 0;
  private inString: boolean = false;
  private escapeNext: boolean = false;
  private objectStart: number = -1;
  private parsedObjects: FormatNode[] = [];

  /**
   * 添加新的文本块并尝试解析
   * @param chunk 新接收的文本块
   * @returns 新解析出的完整节点数组
   */
  addChunk(chunk: string): FormatNode[] {
    const newNodes: FormatNode[] = [];
    
    for (const char of chunk) {
      this.buffer += char;
      
      // 处理转义字符
      if (this.escapeNext) {
        this.escapeNext = false;
        continue;
      }
      
      if (char === '\\' && this.inString) {
        this.escapeNext = true;
        continue;
      }
      
      // 处理字符串边界
      if (char === '"') {
        this.inString = !this.inString;
        continue;
      }
      
      // 在字符串内部，跳过括号检测
      if (this.inString) continue;
      
      // 检测对象边界
      if (char === '{') {
        if (this.bracketDepth === 0) {
          this.objectStart = this.buffer.length - 1;
        }
        this.bracketDepth++;
      } else if (char === '}') {
        this.bracketDepth--;
        
        // 找到完整的对象
        if (this.bracketDepth === 0 && this.objectStart !== -1) {
          const objectStr = this.buffer.slice(this.objectStart);
          const node = this.tryParseNode(objectStr);
          
          if (node) {
            newNodes.push(node);
            this.parsedObjects.push(node);
          }
          
          this.objectStart = -1;
        }
      }
    }
    
    return newNodes;
  }

  /**
   * 尝试解析单个节点
   */
  private tryParseNode(jsonStr: string): FormatNode | null {
    try {
      const obj = JSON.parse(jsonStr);
      const result = FormatNodeSchema.safeParse(obj);
      
      if (result.success) {
        return result.data;
      }
      
      console.warn('[FormatParser] Invalid node structure:', result.error);
      return null;
    } catch (e) {
      console.warn('[FormatParser] JSON parse error:', e);
      return null;
    }
  }

  /**
   * 获取已解析的所有节点
   */
  getParsedNodes(): FormatNode[] {
    return [...this.parsedObjects];
  }

  /**
   * 重置解析器状态
   */
  reset(): void {
    this.buffer = '';
    this.bracketDepth = 0;
    this.inString = false;
    this.escapeNext = false;
    this.objectStart = -1;
    this.parsedObjects = [];
  }
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 校验单个格式化节点
 */
export function validateFormatNode(obj: unknown): FormatNode | null {
  const result = FormatNodeSchema.safeParse(obj);
  return result.success ? result.data : null;
}

/**
 * 批量解析格式化节点数组
 * 用于非流式场景的完整 JSON 解析
 */
export function parseFormatNodes(jsonStr: string): FormatNode[] {
  // 清理可能的 markdown 代码块标记
  let cleaned = jsonStr.trim();
  
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  
  try {
    const arr = JSON.parse(cleaned);
    
    if (!Array.isArray(arr)) {
      console.warn('[FormatParser] Expected array, got:', typeof arr);
      return [];
    }
    
    return arr
      .map((item) => validateFormatNode(item))
      .filter((node): node is FormatNode => node !== null);
  } catch (e) {
    console.error('[FormatParser] Failed to parse JSON:', e);
    return [];
  }
}

/**
 * 修复孤儿节点（父节点不存在时挂载到根节点）
 */
export function fixOrphanNodes(
  nodes: FormatNode[],
  tempIdMap: Map<string, string>,
  fallbackParentId: string
): Map<string, string> {
  const fixedMap = new Map(tempIdMap);
  
  for (const node of nodes) {
    if (node.parentTempId && !fixedMap.has(node.parentTempId)) {
      // 父节点不存在，使用 fallback
      console.warn(`[FormatParser] Orphan node ${node.tempId}, fallback to root`);
    }
  }
  
  return fixedMap;
}

/**
 * 获取节点的真实父节点 ID
 */
export function getRealParentId(
  node: FormatNode,
  tempIdMap: Map<string, string>,
  fallbackParentId: string
): string {
  if (!node.parentTempId) {
    // 根节点，使用 fallback
    return fallbackParentId;
  }
  
  const realParentId = tempIdMap.get(node.parentTempId);
  
  if (!realParentId) {
    // 父节点尚未创建或不存在，使用 fallback
    console.warn(`[FormatParser] Parent ${node.parentTempId} not found, using fallback`);
    return fallbackParentId;
  }
  
  return realParentId;
}
