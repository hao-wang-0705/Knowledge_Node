/**
 * 语音识别工具
 * 将音频内容转写为文本（占位实现，预留接口）
 *
 * 后续扩展：接入 Whisper API / Gemini Audio，支持多 Provider 降级
 */

import { BaseTool } from './base.tool';
import { ToolInput, ToolOutput, ToolCategory, ExecutionContext } from '../interfaces';

// ============================================================================
// 类型定义
// ============================================================================

export interface VoiceRecognizeInput extends ToolInput {
  /** 音频数据（Base64 编码） */
  audioBase64: string;
  /** 音频格式（如 webm, wav, mp3） */
  format?: string;
  /** 语言提示（如 zh, en） */
  language?: string;
}

export interface VoiceRecognizeResult {
  /** 转写文本 */
  text: string;
  /** 检测到的语言 */
  language?: string;
  /** 音频时长（秒） */
  duration?: number;
}

// ============================================================================
// 工具实现
// ============================================================================

export class VoiceRecognizeTool extends BaseTool<VoiceRecognizeInput, ToolOutput> {
  readonly name = 'voice_recognize';
  readonly description = '语音识别工具，将音频内容转写为文字';
  readonly category: ToolCategory = 'transform';
  readonly requiresContext = false;

  readonly inputSchema = {
    type: 'object',
    properties: {
      audioBase64: {
        type: 'string',
        description: '音频数据（Base64 编码）',
      },
      format: {
        type: 'string',
        description: '音频格式（如 webm, wav, mp3）',
        default: 'webm',
      },
      language: {
        type: 'string',
        description: '语言提示（如 zh, en）',
        default: 'zh',
      },
    },
    required: ['audioBase64'],
  };

  async *execute(input: VoiceRecognizeInput, _context: ExecutionContext): AsyncGenerator<ToolOutput> {
    if (!input.audioBase64) {
      yield this.createError('请提供音频数据');
      return;
    }

    try {
      yield this.createMetadata({
        format: input.format || 'webm',
        language: input.language || 'zh',
        startTime: Date.now(),
      });

      // TODO: 接入真实的 ASR 服务（Whisper API / Gemini Audio）
      const placeholderResult: VoiceRecognizeResult = {
        text: `[语音识别功能开发中] 音频格式: ${input.format || 'webm'}, 语言: ${input.language || 'zh'}`,
        language: input.language || 'zh',
        duration: 0,
      };

      yield this.createChunk(placeholderResult.text);
      yield this.createComplete(JSON.stringify(placeholderResult), {
        model: 'placeholder',
        duration: 0,
      });
    } catch (error) {
      yield this.createError(
        error instanceof Error ? error.message : '语音识别失败',
      );
    }
  }
}
