/**
 * 图像识别工具
 * 将图片内容识别为结构化文本描述（占位实现，预留接口）
 *
 * 后续扩展：接入 Gemini Vision / GPT-4V 多模态 API
 */

import { BaseTool } from './base.tool';
import { ToolInput, ToolOutput, ToolCategory, ExecutionContext } from '../interfaces';

// ============================================================================
// 类型定义
// ============================================================================

export interface ImageRecognizeInput extends ToolInput {
  /** 图片列表 */
  images: Array<{
    /** Base64 编码的图片数据 */
    base64: string;
    /** MIME 类型，如 image/jpeg, image/png */
    mimeType: string;
  }>;
  /** 提取提示（引导模型聚焦于特定内容，如 "提取文字" / "描述场景"） */
  extractionHint?: string;
}

export interface ImageRecognizeResult {
  /** 图片内容的综合文本描述 */
  description: string;
  /** 从图片中提取的文字（OCR） */
  extractedTexts?: string[];
  /** 识别到的关键对象 */
  detectedObjects?: string[];
}

// ============================================================================
// 工具实现
// ============================================================================

export class ImageRecognizeTool extends BaseTool<ImageRecognizeInput, ToolOutput> {
  readonly name = 'image_recognize';
  readonly description = '图像识别工具，将图片内容识别为结构化文本描述，支持 OCR 和场景描述';
  readonly category: ToolCategory = 'extraction';
  readonly requiresContext = false;

  readonly inputSchema = {
    type: 'object',
    properties: {
      images: {
        type: 'array',
        description: '图片列表',
        items: {
          type: 'object',
          properties: {
            base64: { type: 'string', description: 'Base64 编码的图片数据' },
            mimeType: { type: 'string', description: 'MIME 类型' },
          },
          required: ['base64', 'mimeType'],
        },
      },
      extractionHint: {
        type: 'string',
        description: '提取提示，引导识别方向',
      },
    },
    required: ['images'],
  };

  async *execute(input: ImageRecognizeInput, _context: ExecutionContext): AsyncGenerator<ToolOutput> {
    if (!input.images || input.images.length === 0) {
      yield this.createError('请提供至少一张图片');
      return;
    }

    try {
      yield this.createMetadata({
        imageCount: input.images.length,
        extractionHint: input.extractionHint,
        startTime: Date.now(),
      });

      // TODO: 接入真实的多模态 AI 服务（Gemini Vision / GPT-4V）
      const placeholderResult: ImageRecognizeResult = {
        description: `[图像识别功能开发中] 收到 ${input.images.length} 张图片`,
        extractedTexts: [],
        detectedObjects: [],
      };

      yield this.createComplete(JSON.stringify(placeholderResult), {
        model: 'placeholder',
        imageCount: input.images.length,
      });
    } catch (error) {
      yield this.createError(
        error instanceof Error ? error.message : '图像识别处理失败',
      );
    }
  }
}
