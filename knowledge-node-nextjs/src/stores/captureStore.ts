/**
 * 快速捕获状态管理 (Capture Store)
 * 管理多模态输入、AI 结构化预览和确认流程
 */

import { create } from 'zustand';
import type { Node, Supertag, FieldDefinition } from '@/types';
import { generateId } from '@/utils/helpers';

// ============================================================================
// 类型定义
// ============================================================================

/** 捕获内容类型 */
export type CaptureInputType = 'text' | 'image' | 'voice';

/** 捕获状态 */
export type CaptureStatus = 
  | 'idle'           // 空闲
  | 'recording'      // 录音中
  | 'processing'     // AI 处理中
  | 'preview'        // 预览确认
  | 'submitting';    // 提交中

/** 图片附件 */
export interface CaptureImage {
  id: string;
  file?: File;
  base64: string;
  preview: string;      // 缩略图 URL
  name: string;
  size: number;
}

/** 语音附件 */
export interface CaptureVoice {
  id: string;
  blob?: Blob;
  base64: string;
  duration: number;     // 秒
  transcription?: string; // 转写结果
}

/** AI 结构化预览结果 */
export interface CapturePreview {
  /** 节点正文内容 */
  content: string;
  /** 匹配的 Supertag ID */
  supertagId: string | null;
  /** 匹配的 Supertag 信息 */
  supertag?: Supertag;
  /** 提取的字段值 */
  fields: Record<string, any>;
  /** AI 置信度 (0-1) */
  confidence: number;
  /** AI 建议的替代标签 */
  alternativeTags?: string[];
  /** 原始输入内容 */
  originalInput: string;
  /** 是否为 AI 自动提取 */
  isAutoExtracted: boolean;
}

/** 捕获 Store 状态 */
interface CaptureStoreState {
  /** 当前状态 */
  status: CaptureStatus;
  /** 文本输入内容 */
  textInput: string;
  /** 图片列表 */
  images: CaptureImage[];
  /** 语音录制 */
  voice: CaptureVoice | null;
  /** AI 预览结果 */
  preview: CapturePreview | null;
  /** 用户手动指定的标签 ID */
  manualTagId: string | null;
  /** 错误信息 */
  error: string | null;
  /** 输入框是否聚焦 */
  isFocused: boolean;
  /** 目标父节点 ID (默认写入今日笔记) */
  targetParentId: string | null;
}

/** 捕获 Store 操作 */
interface CaptureStoreActions {
  // 输入操作
  setTextInput: (text: string) => void;
  appendTextInput: (text: string) => void;
  clearTextInput: () => void;
  
  // 图片操作
  addImage: (image: CaptureImage) => void;
  removeImage: (id: string) => void;
  clearImages: () => void;
  
  // 语音操作
  setVoice: (voice: CaptureVoice | null) => void;
  startRecording: () => void;
  stopRecording: () => void;
  
  // 预览操作
  setPreview: (preview: CapturePreview | null) => void;
  updatePreviewField: (key: string, value: any) => void;
  updatePreviewTag: (tagId: string | null, supertag?: Supertag) => void;
  confirmPreview: () => Node | null;
  cancelPreview: () => void;
  
  // 手动标签
  setManualTagId: (tagId: string | null) => void;
  
  // 状态管理
  setStatus: (status: CaptureStatus) => void;
  setError: (error: string | null) => void;
  setFocused: (focused: boolean) => void;
  setTargetParentId: (parentId: string | null) => void;
  
  // 重置
  reset: () => void;
  
  // AI 处理
  processCapture: (supertags: Record<string, Supertag>) => Promise<void>;
  
  // AI 语音转写（新增）
  transcribeAudio: (audio: string, format?: string, language?: string) => Promise<string>;
}

type CaptureStore = CaptureStoreState & CaptureStoreActions;

// ============================================================================
// 初始状态
// ============================================================================

const initialState: CaptureStoreState = {
  status: 'idle',
  textInput: '',
  images: [],
  voice: null,
  preview: null,
  manualTagId: null,
  error: null,
  isFocused: false,
  targetParentId: null,
};

// ============================================================================
// Store 实现
// ============================================================================

export const useCaptureStore = create<CaptureStore>((set, get) => ({
  ...initialState,

  // ============================================
  // 文本输入操作
  // ============================================
  
  setTextInput: (text) => set({ textInput: text, error: null }),
  
  appendTextInput: (text) => set((state) => ({ 
    textInput: state.textInput + text,
    error: null,
  })),
  
  clearTextInput: () => set({ textInput: '' }),

  // ============================================
  // 图片操作
  // ============================================
  
  addImage: (image) => set((state) => ({
    images: [...state.images, image],
    error: null,
  })),
  
  removeImage: (id) => set((state) => ({
    images: state.images.filter((img) => img.id !== id),
  })),
  
  clearImages: () => set({ images: [] }),

  // ============================================
  // 语音操作
  // ============================================
  
  setVoice: (voice) => set({ voice, error: null }),
  
  startRecording: () => set({ status: 'recording', error: null }),
  
  stopRecording: () => set({ status: 'idle' }),

  // ============================================
  // 预览操作
  // ============================================
  
  setPreview: (preview) => set({ 
    preview,
    status: preview ? 'preview' : 'idle',
  }),
  
  updatePreviewField: (key, value) => set((state) => {
    if (!state.preview) return state;
    return {
      preview: {
        ...state.preview,
        fields: { ...state.preview.fields, [key]: value },
      },
    };
  }),
  
  updatePreviewTag: (tagId, supertag) => set((state) => {
    if (!state.preview) return state;
    return {
      preview: {
        ...state.preview,
        supertagId: tagId,
        supertag,
        // 切换标签时清空字段值
        fields: {},
      },
    };
  }),
  
  confirmPreview: () => {
    const state = get();
    if (!state.preview) return null;
    
    // 创建新节点对象
    const newNode: Node = {
      id: generateId(),
      content: state.preview.content,
      parentId: state.targetParentId,
      childrenIds: [],
      isCollapsed: false,
      tags: state.preview.supertagId ? [state.preview.supertagId] : [],
      supertagId: state.preview.supertagId,
      fields: state.preview.fields,
      createdAt: Date.now(),
    };
    
    // 重置状态
    set({ ...initialState });
    
    return newNode;
  },
  
  cancelPreview: () => set({
    preview: null,
    status: 'idle',
  }),

  // ============================================
  // 手动标签
  // ============================================
  
  setManualTagId: (tagId) => set({ manualTagId: tagId }),

  // ============================================
  // 状态管理
  // ============================================
  
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error, status: error ? 'idle' : get().status }),
  setFocused: (focused) => set({ isFocused: focused }),
  setTargetParentId: (parentId) => set({ targetParentId: parentId }),

  // ============================================
  // 重置
  // ============================================
  
  reset: () => set(initialState),

  // ============================================
  // AI 处理
  // ============================================
  
  processCapture: async (supertags) => {
    const state = get();
    
    // 检查是否有内容需要处理
    if (!state.textInput.trim() && state.images.length === 0 && !state.voice?.transcription) {
      set({ error: '请输入内容' });
      return;
    }
    
    set({ status: 'processing', error: null });
    
    try {
      const resolveFields = (tagId: string): FieldDefinition[] => {
        const tag = supertags[tagId];
        return (tag?.fieldDefinitions ?? []) as FieldDefinition[];
      };

      // 准备请求数据
      const requestData: any = {
        text: state.textInput.trim(),
        images: state.images.map((img) => ({
          base64: img.base64,
          name: img.name,
        })),
        voiceTranscription: state.voice?.transcription,
        manualTagId: state.manualTagId,
        // 发送精简版 Supertag Schema
        supertags: Object.values(supertags)
          .filter((tag) => tag.status !== 'deprecated')
          .map((tag) => ({
            id: tag.id,
            name: tag.name,
            icon: tag.icon,
            description: tag.description,
            fields: resolveFields(tag.id).map((f) => ({
              key: f.key,
              name: f.name,
              type: f.type,
              options: f.options,
            })),
          })),
      };
      
      // 调用 AI 结构化 API
      const response = await fetch('/api/ai/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });
      
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || '处理失败');
      }
      
      // 设置预览
      const matchedTag = result.data.supertagId ? supertags[result.data.supertagId] : undefined;
      
      set({
        preview: {
          content: result.data.content,
          supertagId: result.data.supertagId,
          supertag: matchedTag,
          fields: result.data.fields || {},
          confidence: result.data.confidence || 0.8,
          alternativeTags: result.data.alternativeTags,
          originalInput: state.textInput,
          isAutoExtracted: true,
        },
        status: 'preview',
      });
      
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '处理失败',
        status: 'idle',
      });
    }
  },

  /**
   * AI 语音转写
   * 将音频转换为文本，通过统一的 API 网关处理
   */
  transcribeAudio: async (audio: string, format: string = 'webm', language: string = 'zh') => {
    const { setStatus, setError, setVoice, voice } = get();
    
    try {
      setStatus('processing');
      setError(null);
      
      const response = await fetch('/api/ai/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio,
          format,
          language,
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || '语音转写失败');
      }
      
      const transcribedText = result.data?.text || '';
      
      // 更新 voice 数据中的转写结果
      if (voice) {
        setVoice({
          ...voice,
          transcription: transcribedText,
        });
      }
      
      setStatus('idle');
      return transcribedText;
      
    } catch (error) {
      const message = error instanceof Error ? error.message : '语音转写失败';
      setError(message);
      setStatus('idle');
      throw error;
    }
  },
}));

// ============================================================================
// 辅助 Hooks
// ============================================================================

/** 获取捕获是否有内容 */
export function useCaptureHasContent() {
  const textInput = useCaptureStore((s) => s.textInput);
  const images = useCaptureStore((s) => s.images);
  const voice = useCaptureStore((s) => s.voice);
  
  return textInput.trim().length > 0 || images.length > 0 || !!voice?.transcription;
}

/** 获取捕获是否可提交 */
export function useCaptureCanSubmit() {
  const status = useCaptureStore((s) => s.status);
  const preview = useCaptureStore((s) => s.preview);
  
  return status === 'preview' && preview !== null;
}
