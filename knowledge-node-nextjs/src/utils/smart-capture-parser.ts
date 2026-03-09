/**
 * 智能捕获流式 JSON 解析工具
 * v3.5: 支持解析带标签和字段的节点数据
 */

import { z } from 'zod';
import type { SmartCaptureNode } from '@/types';

// ============================================================================
// Schema 定义
// ============================================================================

/**
 * 智能捕获节点 Schema（AI 返回格式）
 */
export const SmartCaptureNodeSchema = z.object({
  tempId: z.string(),
  content: z.string().min(1),
  parentTempId: z.string().nullable(),
  supertagId: z.string().nullable(),
  fields: z.record(z.string(), z.unknown()).default({}),
  confidence: z.number().min(0).max(1).default(0.8),
  isAIExtracted: z.boolean().default(true),
});

// ============================================================================
// 流式 JSON 解析器
// ============================================================================

/**
 * 增量 JSON 数组解析器（智能捕获增强版）
 * 用于边接收 AI 响应边解析出完整的 JSON 对象
 */
export class SmartCaptureParser {
  private buffer: string = '';
  private bracketDepth: number = 0;
  private inString: boolean = false;
  private escapeNext: boolean = false;
  private objectStart: number = -1;
  private parsedNodes: SmartCaptureNode[] = [];

  /**
   * 添加新的文本块并尝试解析
   * @param chunk 新接收的文本块
   * @returns 新解析出的完整节点数组
   */
  addChunk(chunk: string): SmartCaptureNode[] {
    const newNodes: SmartCaptureNode[] = [];
    
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
            this.parsedNodes.push(node);
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
  private tryParseNode(jsonStr: string): SmartCaptureNode | null {
    try {
      const obj = JSON.parse(jsonStr);
      const result = SmartCaptureNodeSchema.safeParse(obj);
      
      if (result.success) {
        return result.data;
      }
      
      console.warn('[SmartCaptureParser] Invalid node structure:', result.error.issues);
      return null;
    } catch (e) {
      console.warn('[SmartCaptureParser] JSON parse error:', e);
      return null;
    }
  }

  /**
   * 获取已解析的所有节点
   */
  getParsedNodes(): SmartCaptureNode[] {
    return [...this.parsedNodes];
  }

  /**
   * 获取解析统计
   */
  getStats(): { total: number; withTag: number; withoutTag: number } {
    const withTag = this.parsedNodes.filter((n) => n.supertagId !== null).length;
    return {
      total: this.parsedNodes.length,
      withTag,
      withoutTag: this.parsedNodes.length - withTag,
    };
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
    this.parsedNodes = [];
  }
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 校验单个智能捕获节点
 */
export function validateSmartCaptureNode(obj: unknown): SmartCaptureNode | null {
  const result = SmartCaptureNodeSchema.safeParse(obj);
  return result.success ? result.data : null;
}

/**
 * 批量解析智能捕获节点数组
 * 用于非流式场景的完整 JSON 解析
 */
export function parseSmartCaptureNodes(jsonStr: string): SmartCaptureNode[] {
  // 清理可能的 markdown 代码块标记
  let cleaned = jsonStr.trim();
  
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  
  try {
    const arr = JSON.parse(cleaned);
    
    if (!Array.isArray(arr)) {
      console.warn('[SmartCaptureParser] Expected array, got:', typeof arr);
      return [];
    }
    
    return arr
      .map((item) => validateSmartCaptureNode(item))
      .filter((node): node is SmartCaptureNode => node !== null);
  } catch (e) {
    console.error('[SmartCaptureParser] Failed to parse JSON:', e);
    return [];
  }
}

/**
 * 获取节点的真实父节点 ID
 */
export function getSmartCaptureRealParentId(
  node: SmartCaptureNode,
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
    console.warn(`[SmartCaptureParser] Parent ${node.parentTempId} not found, using fallback`);
    return fallbackParentId;
  }
  
  return realParentId;
}

/**
 * 根据置信度阈值过滤标签
 * 低于阈值的节点将清除 supertagId 和 fields
 */
export function applyConfidenceThreshold(
  nodes: SmartCaptureNode[],
  threshold: number = 0.8
): SmartCaptureNode[] {
  return nodes.map((node) => {
    if (node.supertagId && node.confidence < threshold) {
      return {
        ...node,
        supertagId: null,
        fields: {},
        // 保留原始 confidence 用于调试
      };
    }
    return node;
  });
}
