'use client';

/**
 * CaptureBar - 多模态快速捕获输入栏
 * 
 * 功能：
 * - 文本输入（支持 @ 引用、# 标签）
 * - 图片上传（拖拽、粘贴、选择）
 * - 语音录制
 * - AI 智能捕获（v3.5 升级：合并格式化 + 标签匹配 + 字段提取）
 * - 预览确认
 */

import React, { useRef, useState, useCallback, useEffect, KeyboardEvent, ChangeEvent, DragEvent, ClipboardEvent } from 'react';
import { 
  Send, 
  Image as ImageIcon, 
  Mic, 
  MicOff, 
  X, 
  Loader2, 
  Wand2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FEATURE_FLAGS, getDisabledMessage } from '@/lib/feature-flags';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useCaptureStore, type CaptureImage } from '@/stores/captureStore';
import { useSupertagStore } from '@/stores/supertagStore';
import { useNodeStore } from '@/stores/nodeStore';
import { generateId } from '@/utils/helpers';
import PreviewBubble from './PreviewBubble';
import SmartCaptureIndicator from './SmartCaptureIndicator';

interface CaptureBarProps {
  className?: string;
}

const CaptureBar: React.FC<CaptureBarProps> = ({
  className,
}) => {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  // Store hooks
  const {
    status,
    textInput,
    images,
    voice,
    preview,
    error,
    isFocused,
    smartCaptureProgress,
    setTextInput,
    addImage,
    removeImage,
    setVoice,
    startRecording,
    stopRecording,
    setError,
    setFocused,
    cancelPreview,
    confirmPreview,
    startSmartCapture,
    cancelSmartCapture,
  } = useCaptureStore();
  
  const supertags = useSupertagStore((s) => s.supertags);
  const trackTagUsage = useSupertagStore((s) => s.trackTagUsage);
  
  const addNode = useNodeStore((s) => s.addNode);
  const updateNode = useNodeStore((s) => s.updateNode);
  const ensureTodayNode = useNodeStore((s) => s.ensureTodayNode);
  const hoistedNodeId = useNodeStore((s) => s.hoistedNodeId);

  // ============================================
  // 全局快捷键
  // ============================================
  
  useEffect(() => {
    const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
      // Cmd/Ctrl + K 聚焦输入框
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }

      // Escape 取消预览
      if (e.key === 'Escape' && preview) {
        cancelPreview();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [preview, cancelPreview]);
  
  // ============================================
  // 文本输入处理
  // ============================================
  
  const handleTextChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setTextInput(value);
    
    // 自动调整高度
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`;
    }
  }, [setTextInput]);
  
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter 触发 AI 智能捕获（无修饰键）
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      if (preview) {
        e.preventDefault();
        handleConfirm();
      } else if (textInput.trim() && status === 'idle') {
        e.preventDefault();
        // 触发 AI 智能捕获
        handleStartSmartCapture();
      }
    }
    
    // Shift + Enter 换行（默认行为）
    
    // Cmd/Ctrl + Enter 提交并保留输入框
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && preview) {
      e.preventDefault();
      handleConfirm(true);
    }
    
    // Escape 取消预览
    if (e.key === 'Escape' && preview) {
      e.preventDefault();
      cancelPreview();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview, textInput, status, cancelPreview]);
  
  // ============================================
  // 图片处理
  // ============================================
  
  const processImageFile = useCallback(async (file: File) => {
    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      setError('请上传图片文件');
      return;
    }
    
    // 检查文件大小 (最大 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('图片大小不能超过 10MB');
      return;
    }
    
    // 转换为 base64
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const newImage: CaptureImage = {
        id: generateId(),
        file,
        base64: base64.split(',')[1], // 移除 data:image/xxx;base64, 前缀
        preview: base64,
        name: file.name,
        size: file.size,
      };
      addImage(newImage);
    };
    reader.onerror = () => {
      setError('图片读取失败');
    };
    reader.readAsDataURL(file);
  }, [addImage, setError]);
  
  const handleFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    Array.from(files).forEach(processImageFile);
    
    // 清空 input 以允许再次选择相同文件
    e.target.value = '';
  }, [processImageFile]);
  
  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);
  
  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);
  
  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    Array.from(files).forEach(processImageFile);
  }, [processImageFile]);
  
  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData.items;
    
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          processImageFile(file);
        }
        break;
      }
    }
  }, [processImageFile]);
  
  // ============================================
  // 语音录制
  // ============================================
  
  const handleStartRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // 停止所有音轨
        stream.getTracks().forEach((track) => track.stop());
        
        // 转换为 base64 并进行语音转写
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = (reader.result as string).split(',')[1];
          
          // 设置语音数据（不带转写）
          const voiceData = {
            id: generateId(),
            blob: audioBlob,
            base64,
            duration: 0,
          };
          setVoice(voiceData);
          
          // 通过 Store 的 transcribeAudio 方法进行语音转写
          try {
            const transcribedText = await useCaptureStore.getState().transcribeAudio(base64, 'webm', 'zh');
            
            if (transcribedText) {
              // 同时将转写结果添加到文本输入
              setTextInput(textInput + (textInput ? '\n' : '') + transcribedText);
            }
          } catch (err) {
            console.error('Transcription failed:', err);
            // 错误已在 store 中处理
          }
        };
        reader.readAsDataURL(audioBlob);
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      startRecording();
      
    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('无法访问麦克风，请检查权限设置');
    }
  }, [startRecording, setVoice, setError, setTextInput, textInput]);
  
  const handleStopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      stopRecording();
    }
  }, [stopRecording]);
  
  // ============================================
  // 确认处理
  // ============================================
  
  const handleConfirm = useCallback((keepInput = false) => {
    const newNode = confirmPreview();
    
    if (newNode) {
      // 添加节点到 store
      const targetId = hoistedNodeId || ensureTodayNode();
      const nodeId = addNode(targetId);
      
      // 更新节点内容
      updateNode(nodeId, {
        content: newNode.content,
        tags: newNode.tags,
        supertagId: newNode.supertagId,
        fields: newNode.fields,
      });
      
      // 记录标签使用
      if (newNode.supertagId) {
        trackTagUsage(newNode.supertagId);
      }
      
      // 如果不保留输入框内容
      if (!keepInput) {
        inputRef.current?.focus();
      }
    }
  }, [confirmPreview, hoistedNodeId, ensureTodayNode, addNode, updateNode, trackTagUsage]);
  
  const handleCancel = useCallback(() => {
    cancelPreview();
    inputRef.current?.focus();
  }, [cancelPreview]);
  
  // ============================================
  // AI 智能捕获（v3.5 升级）
  // ============================================
  
  const handleStartSmartCapture = useCallback(async () => {
    if (!textInput.trim()) return;
    
    // 获取目标父节点
    const targetId = hoistedNodeId || ensureTodayNode();
    
    // 调用流式智能捕获（合并格式化 + 标签匹配 + 字段提取）
    await startSmartCapture(textInput.trim(), targetId, supertags, addNode, updateNode);
    
    // 智能捕获完成后聚焦输入框
    inputRef.current?.focus();
  }, [textInput, hoistedNodeId, ensureTodayNode, startSmartCapture, supertags, addNode, updateNode]);
  
  const handleCancelSmartCapture = useCallback(() => {
    cancelSmartCapture();
    inputRef.current?.focus();
  }, [cancelSmartCapture]);
  
  // ============================================
  // 渲染
  // ============================================
  
  const isProcessing = status === 'processing';
  const isRecording = status === 'recording';
  const isSmartCapturing = status === 'smart-capturing';
  const showPreview = status === 'preview' && preview;
  
  return (
    <TooltipProvider>
      <div 
        className={cn(
          'absolute bottom-0 left-0 right-0 z-40',
          'bg-gradient-to-t from-white via-white to-transparent dark:from-gray-900 dark:via-gray-900',
          'pt-8 pb-4 px-4',
          'pointer-events-none', // 允许点击穿透背景渐变
          className
        )}
      >
        {/* 内容区域需要恢复 pointer-events */}
        <div className="pointer-events-auto">
        {/* 预览气泡 */}
        {showPreview && (
          <PreviewBubble
            preview={preview}
            supertags={supertags}
            onConfirm={() => handleConfirm()}
            onCancel={handleCancel}
            className="mb-3"
          />
        )}
        
        {/* 输入区域容器 */}
        <div className="max-w-4xl mx-auto">
          <div
              className={cn(
                'relative rounded-2xl border shadow-lg transition-all duration-200',
                'bg-white dark:bg-gray-800',
                isDragging
                  ? 'border-blue-500 border-2 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700',
                isFocused && 'ring-2 ring-blue-500/20',
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {/* 拖拽提示遮罩 */}
              {isDragging && (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-blue-50/90 dark:bg-blue-900/50 z-10">
                  <div className="text-blue-600 dark:text-blue-400 font-medium">
                    <ImageIcon className="w-8 h-8 mx-auto mb-2" />
                    松开以添加图片
                  </div>
                </div>
              )}
              
              {/* 图片预览 */}
              {images.length > 0 && (
                <div className="flex flex-wrap gap-2 px-4 pt-3">
                  {images.map((img) => (
                    <div
                      key={img.id}
                      className="relative group w-16 h-16 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600"
                    >
                      <img
                        src={img.preview}
                        alt={img.name}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => removeImage(img.id)}
                        className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* 语音录制状态 */}
              {(isRecording || voice) && (
                <div className="flex items-center gap-2 px-4 pt-3">
                  {isRecording ? (
                    <div className="flex items-center gap-3 text-red-500 bg-red-50 dark:bg-red-900/20 rounded-full px-3 py-1.5">
                      {/* 录音指示灯 */}
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                      </span>
                      
                      {/* 波形可视化 */}
                      <div className="flex items-center gap-0.5 h-4">
                        {[...Array(5)].map((_, i) => (
                          <div
                            key={i}
                            className="w-1 bg-red-500 rounded-full recording-wave-bar"
                            style={{ height: '100%' }}
                          />
                        ))}
                      </div>
                      
                      <span className="text-sm font-medium">录音中</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={FEATURE_FLAGS.VOICE_TRANSCRIPTION ? handleStopRecording : undefined}
                        disabled={!FEATURE_FLAGS.VOICE_TRANSCRIPTION}
                        className={cn(
                          'h-6 px-2',
                          FEATURE_FLAGS.VOICE_TRANSCRIPTION
                            ? 'text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/30'
                            : 'text-gray-400 opacity-50 cursor-not-allowed'
                        )}
                      >
                        停止录音
                      </Button>
                    </div>
                  ) : voice && (
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700/50 rounded-full px-3 py-1.5">
                      <Mic className="w-4 h-4 text-green-500" />
                      <span className="text-sm">
                        {voice.transcription ? '语音已转写' : '语音已录制'}
                      </span>
                      {voice.transcription && (
                        <span className="text-xs text-gray-400 max-w-[200px] truncate">
                          {voice.transcription}
                        </span>
                      )}
                      <button
                        onClick={() => setVoice(null)}
                        className="hover:opacity-70 ml-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
              
              {/* 文本输入区 */}
              <div className="flex items-end gap-2 p-3">
                {/* 智能捕获进度指示器 - 捕获时显示 */}
                {isSmartCapturing && smartCaptureProgress ? (
                  <SmartCaptureIndicator
                    nodeCount={smartCaptureProgress.nodeCount}
                    taggedNodeCount={smartCaptureProgress.taggedNodeCount}
                    onCancel={handleCancelSmartCapture}
                    className="flex-1"
                  />
                ) : (
                  <textarea
                    ref={inputRef}
                    value={textInput}
                    onChange={handleTextChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    onPaste={handlePaste}
                    placeholder="输入你想记录的事情，自动进行格式化记录"
                    disabled={isProcessing}
                    className={cn(
                      'flex-1 resize-none bg-transparent border-none outline-none',
                      'text-gray-800 dark:text-gray-200 placeholder-gray-400',
                      'min-h-[44px] max-h-[200px] py-2 px-1',
                      'text-base leading-relaxed',
                    )}
                    rows={1}
                  />
                )}
                
                {/* 操作按钮 - 智能捕获时隐藏 */}
                {!isSmartCapturing && (
                <div className="flex items-center gap-1">
                  {/* 图片上传 - 暂时禁用 */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={true}
                        className="h-9 w-9 text-gray-400 opacity-50 cursor-not-allowed"
                      >
                        <ImageIcon className="w-5 h-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>图片上传功能暂未开放</TooltipContent>
                  </Tooltip>
                  
                  {/* 语音录制 - MVP 版本禁用 */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={FEATURE_FLAGS.VOICE_TRANSCRIPTION ? (isRecording ? handleStopRecording : handleStartRecording) : undefined}
                        disabled={!FEATURE_FLAGS.VOICE_TRANSCRIPTION || isProcessing}
                        className={cn(
                          'h-9 w-9',
                          !FEATURE_FLAGS.VOICE_TRANSCRIPTION
                            ? 'text-gray-400 opacity-50 cursor-not-allowed'
                            : isRecording 
                            ? 'text-red-500 hover:text-red-600' 
                            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        )}
                      >
                        {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {!FEATURE_FLAGS.VOICE_TRANSCRIPTION 
                        ? getDisabledMessage('VOICE_TRANSCRIPTION') 
                        : isRecording ? '停止录音' : '开始录音'}
                    </TooltipContent>
                  </Tooltip>
                  

                  
                  {/* AI 智能捕获按钮 */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleStartSmartCapture}
                        disabled={!textInput.trim() || isProcessing}
                        className={cn(
                          'h-9 w-9',
                          textInput.trim()
                            ? 'text-purple-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20'
                            : 'text-gray-400 opacity-50'
                        )}
                      >
                        <Wand2 className="w-5 h-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>AI 智能捕获（格式化 + 标签匹配）</TooltipContent>
                  </Tooltip>
                  
                  {/* 发送按钮 - 仅在预览模式下显示 */}
                  {showPreview && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="default"
                        size="icon"
                        onClick={() => handleConfirm()}
                        disabled={isProcessing}
                        className="h-9 w-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        {isProcessing ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Send className="w-5 h-5" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {isProcessing ? '处理中...' : '确认添加 (Enter)'}
                    </TooltipContent>
                  </Tooltip>
                  )}
                </div>
                )}
              </div>
              

              
              {/* 错误提示 */}
              {error && (
                <div className="px-4 pb-2">
                  <div className="text-sm text-red-500 flex items-center gap-1">
                    <X className="w-4 h-4" />
                    {error}
                  </div>
                </div>
              )}
              
              {/* 隐藏的文件输入 */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

          {/* 快捷键提示 */}
          <div className="flex justify-center mt-2 text-xs text-gray-400">
            <span className="px-2">
              <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 font-mono">⌘K</kbd>
              {' '}聚焦
            </span>
            <span className="px-2">
              <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 font-mono">Enter</kbd>
              {' '}{showPreview ? '确认' : 'AI 智能捕获'}
            </span>
            <span className="px-2">
              <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 font-mono">Esc</kbd>
              {' '}取消
            </span>
          </div>
        </div>
        </div> {/* 关闭 pointer-events-auto div */}
      </div>
    </TooltipProvider>
  );
};

export default CaptureBar;
