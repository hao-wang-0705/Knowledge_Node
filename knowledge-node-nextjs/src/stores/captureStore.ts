/**
 * 快速捕获状态管理 (Capture Store)
 * 管理多模态输入、AI 结构化预览和确认流程
 * v3.5: 新增 AI 格式化功能（流式写入）+ 智能捕获功能
 */

import { create } from 'zustand';
import type { Node, Supertag, FieldDefinition, SmartCaptureNode, SmartCaptureProgress } from '@/types';
import { generateId } from '@/utils/helpers';
import type { FormatNode } from '@/utils/format-parser';
import { useSyncStore } from '@/stores/syncStore';

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
  | 'submitting'     // 提交中
  | 'formatting'     // AI 格式化中（v3.5）
  | 'smart-capturing'; // 智能捕获中（v3.5 新增）

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
  /** 智能捕获进度（v3.5 新增） */
  smartCaptureProgress: SmartCaptureProgress | null;
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
  
  // AI 语音转写
  transcribeAudio: (audio: string, format?: string, language?: string) => Promise<string>;
  
  // v3.5: 智能捕获（合并格式化 + 标签匹配 + 字段提取）
  /** 开始智能捕获，流式写入带标签的节点 */
  startSmartCapture: (
    text: string,
    targetParentId: string,
    supertags: Record<string, Supertag>,
    addNode: (parentId: string) => string,
    updateNode: (id: string, updates: Partial<Node>) => void
  ) => Promise<void>;
  /** 取消正在进行的智能捕获 */
  cancelSmartCapture: () => void;
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
  smartCaptureProgress: null,
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
    
    if (!state.textInput.trim() && state.images.length === 0 && !state.voice?.transcription) {
      set({ error: '请输入内容' });
      return;
    }
    
    set({ status: 'processing', error: null });
    
    try {
      // 组装所有输入文本
      let combinedText = state.textInput.trim();
      if (state.voice?.transcription) {
        combinedText = combinedText
          ? `${combinedText}\n${state.voice.transcription}`
          : state.voice.transcription;
      }

      const supertagSchemas = buildSupertagSchemas(supertags);
      
      // 调用统一的 smart-structure API（quick 模式）
      const response = await fetch('/api/ai/smart-structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: combinedText,
          supertags: supertagSchemas,
          mode: 'quick',
          manualTagId: state.manualTagId,
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || result.error || '处理失败');
      }
      
      // smart-structure 返回 { nodes: [...] }（无实体识别时无 entityMentions）
      const data = result.data;
      const firstNode = Array.isArray(data?.nodes) ? data.nodes[0] : data;
      
      if (!firstNode) {
        throw new Error('AI 未返回有效节点');
      }

      const matchedTag = firstNode.supertagId ? supertags[firstNode.supertagId] : undefined;
      
      set({
        preview: {
          content: firstNode.content || combinedText,
          supertagId: firstNode.supertagId || null,
          supertag: matchedTag,
          fields: firstNode.fields || {},
          confidence: firstNode.confidence || 0.8,
          alternativeTags: undefined,
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

  /**
   * v3.5: 智能捕获 - 合并格式化 + 标签匹配 + 字段提取
   * 将大段文字格式化为树形节点，同时智能匹配标签和提取字段
   */
  startSmartCapture: async (text, targetParentId, supertags, addNode, updateNode) => {
    const { setStatus, setError } = get();
    
    const abortController = new AbortController();
    
    const smartCaptureProgress: SmartCaptureProgress = {
      nodeCount: 0,
      tempIdMap: new Map(),
      targetParentId,
      isActive: true,
      abortController,
      taggedNodeCount: 0,
    };
    
    set({ 
      status: 'smart-capturing',
      error: null,
      smartCaptureProgress,
    });

    // 记录需要后续修正引用的节点（tempId -> realId 映射在流处理后统一处理）
    const nodesWithReferences: Array<{
      realId: string;
      references: Array<{ id: string; targetNodeId: string; title: string; anchorOffset?: number; createdAt: number }>;
      fields: Record<string, unknown>;
    }> = [];
    
    try {
      const supertagSchemas = buildSupertagSchemas(supertags);
      
      // 调用统一的 smart-structure API（structure 模式）
      const response = await fetch('/api/ai/smart-structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          supertags: supertagSchemas,
          mode: 'structure',
        }),
        signal: abortController.signal,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || '智能捕获请求失败');
      }
      
      if (!response.body) {
        throw new Error('无法获取响应流');
      }

      // 智能捕获期间推迟 processQueue，等流 + Phase 3.5 全部完成后再统一触发一次
      useSyncStore.getState().setDeferProcessQueue(true);

      // 读取 SSE 流
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        // 按行处理 SSE 事件
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留未完成的行
        
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            // 解析事件类型（可用于调试）
            continue;
          }
          
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (!dataStr) continue;
            
            try {
              const data = JSON.parse(dataStr);
              
              // 获取最新的 progress 状态
              const currentProgress = get().smartCaptureProgress;
              if (!currentProgress?.isActive) {
                // 已被取消
                reader.cancel();
                return;
              }
              
              // 处理节点事件
              if (data.tempId && data.content !== undefined) {
                const node = data as SmartCaptureNode & {
                  tags?: string[];
                  references?: Array<{ id: string; targetNodeId: string; title: string; anchorOffset?: number; createdAt: number }>;
                  isNewEntity?: boolean;
                };
                
                // 确定真实父节点 ID
                let realParentId = targetParentId;
                if (node.parentTempId) {
                  const mappedParentId = currentProgress.tempIdMap.get(node.parentTempId);
                  if (mappedParentId) {
                    realParentId = mappedParentId;
                  }
                }
                
                // 创建节点
                const realId = addNode(realParentId);
                
                // 更新节点内容（包含标签、字段；引用稍后统一修正）
                const nodeUpdates: Partial<Node> = {
                  content: node.content,
                  supertagId: node.supertagId,
                  tags: node.tags || (node.supertagId ? [node.supertagId] : []),
                  fields: node.fields || {},
                };

                updateNode(realId, nodeUpdates);
                
                // 记录映射
                currentProgress.tempIdMap.set(node.tempId, realId);
                currentProgress.nodeCount++;
                if (node.supertagId) {
                  currentProgress.taggedNodeCount++;
                }

                // 记录需要后续修正引用的节点
                if ((node.references && node.references.length > 0) || node.fields) {
                  nodesWithReferences.push({
                    realId,
                    references: node.references || [],
                    fields: node.fields || {},
                  });
                }
                
                // 更新状态触发 UI 更新
                set({ smartCaptureProgress: { ...currentProgress } });
              }
              
              // 处理完成事件
              if (data.success !== undefined && data.nodeCount !== undefined) {
                console.log(`[Smart Capture] 完成，共创建 ${data.nodeCount} 个节点，${data.taggedNodeCount || 0} 个带标签`);
              }
              
              // 处理错误事件
              if (data.code && data.message) {
                throw new Error(data.message);
              }
              
            } catch (parseError) {
              // 如果是 Error 实例且有 message 属性，重新抛出
              if (parseError instanceof Error && parseError.message) {
                throw parseError;
              }
              console.warn('[Smart Capture] 解析 SSE 数据失败:', parseError);
            }
          }
        }
      }

      // ========== Phase 3.5: tempId -> realId 引用修正 ==========
      // 流处理完成后，修正所有引用中的 tempId 为 realId
      const finalProgress = get().smartCaptureProgress;
      if (finalProgress?.tempIdMap) {
        const tempIdMap = finalProgress.tempIdMap;

        for (const nodeInfo of nodesWithReferences) {
          let needsUpdate = false;
          const updatedRefs: Array<{ id: string; targetNodeId: string; title: string; anchorOffset?: number; createdAt: number }> = [];
          const updatedFields: Record<string, unknown> = { ...nodeInfo.fields };

          // 修正 references 数组中的 targetNodeId
          for (const ref of nodeInfo.references) {
            const realTargetId = tempIdMap.get(ref.targetNodeId);
            if (realTargetId && realTargetId !== ref.targetNodeId) {
              updatedRefs.push({ ...ref, targetNodeId: realTargetId });
              needsUpdate = true;
            } else {
              updatedRefs.push(ref);
            }
          }

          // 修正 fields 中 reference 类型字段的 nodeId
          for (const [key, value] of Object.entries(nodeInfo.fields)) {
            if (value && typeof value === 'object') {
              // 单值 reference: { nodeId: string, ... }
              if ('nodeId' in value && typeof (value as any).nodeId === 'string') {
                const realId = tempIdMap.get((value as any).nodeId);
                if (realId) {
                  updatedFields[key] = { ...value, nodeId: realId };
                  needsUpdate = true;
                }
              }
              // 多值 reference: Array<{ nodeId: string, ... }>
              if (Array.isArray(value)) {
                const updatedArray = value.map((item: unknown) => {
                  if (item && typeof item === 'object' && 'nodeId' in item && typeof (item as any).nodeId === 'string') {
                    const realId = tempIdMap.get((item as any).nodeId);
                    if (realId) {
                      needsUpdate = true;
                      return { ...item, nodeId: realId };
                    }
                  }
                  return item;
                });
                if (needsUpdate) {
                  updatedFields[key] = updatedArray;
                }
              }
            }
          }

          // 如果有修改，更新节点
          if (needsUpdate) {
            const nodeUpdate: Partial<Node> = {};
            if (updatedRefs.length > 0) {
              (nodeUpdate as any).references = updatedRefs;
            }
            nodeUpdate.fields = updatedFields;
            updateNode(nodeInfo.realId, nodeUpdate);
          }
        }

        console.log(`[Smart Capture] tempId -> realId 引用修正完成，共处理 ${nodesWithReferences.length} 个节点`);
      }
      
      // 智能捕获完成，重置状态
      set({ 
        status: 'idle',
        textInput: '', // 清空输入
        smartCaptureProgress: null,
      });
      
    } catch (error) {
      // 检查是否是取消操作
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[Smart Capture] 用户取消智能捕获');
        set({ 
          status: 'idle',
          smartCaptureProgress: null,
        });
      } else {
        const message = error instanceof Error ? error.message : '智能捕获失败';
        setError(message);
        set({ 
          status: 'idle',
          smartCaptureProgress: null,
        });
      }
    } finally {
      // 恢复自动 processQueue，并立即触发一次以同步已入队的所有 create/update
      useSyncStore.getState().setDeferProcessQueue(false);
      useSyncStore.getState().processQueue();
    }
  },

  /**
   * v3.5: 取消正在进行的智能捕获
   */
  cancelSmartCapture: () => {
    const { smartCaptureProgress } = get();
    
    if (smartCaptureProgress?.abortController) {
      smartCaptureProgress.abortController.abort();
    }
    
    set({
      status: 'idle',
      smartCaptureProgress: null,
    });
  },
}));

// ============================================================================
// 内部工具函数
// ============================================================================

/**
 * 构建精简版 Supertag Schema 列表（传给后端 AI 工具）
 * 包含 category、字段的 targetTagId、statusConfig 等信息，
 * 以支持 Phase 2 属性挂载和实体识别
 */
function buildSupertagSchemas(supertags: Record<string, Supertag>) {
  const resolveFields = (tagId: string): FieldDefinition[] => {
    const tag = supertags[tagId];
    return (tag?.fieldDefinitions ?? []) as unknown as FieldDefinition[];
  };

  return Object.values(supertags)
    .filter((tag) => tag.status !== 'deprecated')
    .map((tag) => ({
      id: tag.id,
      name: tag.name,
      icon: tag.icon,
      description: tag.description,
      category: (tag as any).category as 'entity' | 'action' | undefined,
      fields: resolveFields(tag.id).map((f) => ({
        key: f.key,
        name: f.name,
        type: f.type,
        options: f.options,
        targetTagId: (f as any).targetTagId as string | undefined,
        targetTagIds: (f as any).targetTagIds as string[] | undefined,
        multiple: (f as any).multiple as boolean | undefined,
        statusConfig: (f as any).statusConfig as {
          states: string[];
          initial: string;
          doneState?: string;
        } | undefined,
      })),
    }));
}

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
