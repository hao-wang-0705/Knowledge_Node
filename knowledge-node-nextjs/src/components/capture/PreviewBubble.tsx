'use client';

/**
 * PreviewBubble - AI 结构化预览气泡
 * 
 * 在输入框上方显示 AI 识别的结构化结果
 * 支持快速确认、修改标签、编辑字段
 */

import React, { useState, useCallback } from 'react';
import { 
  Check, 
  X, 
  ChevronDown,
  Sparkles,
  Edit2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useCaptureStore, type CapturePreview } from '@/stores/captureStore';
import type { Supertag, FieldDefinition } from '@/types';

interface PreviewBubbleProps {
  preview: CapturePreview;
  supertags: Record<string, Supertag>;
  onConfirm: () => void;
  onCancel: () => void;
  className?: string;
}

const PreviewBubble: React.FC<PreviewBubbleProps> = ({
  preview,
  supertags,
  onConfirm,
  onCancel,
  className,
}) => {
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [isEditingContent, setIsEditingContent] = useState(false);
  
  const { updatePreviewField, updatePreviewTag, setPreview } = useCaptureStore();
  
  const currentTag = preview.supertagId ? supertags[preview.supertagId] : null;
  const availableTags = Object.values(supertags).filter((t) => !t.isSystem);
  
  // ============================================
  // 标签切换
  // ============================================
  
  const handleTagChange = useCallback((tagId: string | null) => {
    const tag = tagId ? supertags[tagId] : undefined;
    updatePreviewTag(tagId, tag);
    setShowTagSelector(false);
  }, [supertags, updatePreviewTag]);
  
  // ============================================
  // 字段编辑
  // ============================================
  
  const handleFieldChange = useCallback((key: string, value: any) => {
    updatePreviewField(key, value);
    setEditingField(null);
  }, [updatePreviewField]);
  
  // ============================================
  // 内容编辑
  // ============================================
  
  const handleContentChange = useCallback((newContent: string) => {
    setPreview({
      ...preview,
      content: newContent,
    });
    setIsEditingContent(false);
  }, [preview, setPreview]);
  
  // ============================================
  // 字段渲染
  // ============================================
  
  const renderFieldValue = (field: FieldDefinition, value: any) => {
    if (editingField === field.key) {
      // 编辑模式
      if (field.type === 'select' && field.options) {
        return (
          <select
            autoFocus
            value={value || ''}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            onBlur={() => setEditingField(null)}
            className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
          >
            <option value="">选择{field.name}...</option>
            {field.options.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
      }
      
      if (field.type === 'date') {
        return (
          <input
            type="date"
            autoFocus
            value={value || ''}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            onBlur={() => setEditingField(null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleFieldChange(field.key, (e.target as HTMLInputElement).value);
              if (e.key === 'Escape') setEditingField(null);
            }}
            className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
          />
        );
      }
      
      return (
        <input
          type="text"
          autoFocus
          value={value || ''}
          onChange={(e) => updatePreviewField(field.key, e.target.value)}
          onBlur={() => setEditingField(null)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setEditingField(null);
            if (e.key === 'Escape') setEditingField(null);
          }}
          className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
        />
      );
    }
    
    // 显示模式
    const displayValue = value || '点击编辑...';
    const hasValue = value !== undefined && value !== null && value !== '';
    
    return (
      <span
        onClick={() => setEditingField(field.key)}
        className={cn(
          'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-1 rounded',
          !hasValue && 'text-gray-400 italic'
        )}
      >
        {displayValue}
      </span>
    );
  };
  
  // ============================================
  // 渲染
  // ============================================
  
  return (
    <div className={cn('max-w-4xl mx-auto', className)}>
      <div
        className={cn(
          'relative rounded-xl border shadow-lg overflow-hidden',
          'bg-white dark:bg-gray-800',
          'border-blue-200 dark:border-blue-700',
          'animate-preview-bubble-enter'
        )}
      >
        {/* AI 标识 */}
        <div className="absolute top-2 right-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
            <Sparkles className="w-3 h-3" />
            AI 识别
            {preview.confidence > 0 && (
              <span className="text-blue-400">
                {Math.round(preview.confidence * 100)}%
              </span>
            )}
          </span>
        </div>
        
        <div className="p-4">
          {/* 内容区 */}
          <div className="flex items-start gap-3 mb-3">
            {/* 标签选择 */}
            <div className="relative">
              <button
                onClick={() => setShowTagSelector(!showTagSelector)}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-medium transition-colors',
                  currentTag
                    ? 'hover:opacity-80'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                )}
                style={currentTag ? {
                  backgroundColor: `${currentTag.color}20`,
                  color: currentTag.color,
                } : undefined}
              >
                {currentTag?.icon || '📌'}
                {currentTag?.name || '选择标签'}
                <ChevronDown className="w-3 h-3" />
              </button>
              
              {/* 标签下拉 */}
              {showTagSelector && (
                <div className="absolute top-full left-0 mt-1 z-20 w-48 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg py-1">
                  <button
                    onClick={() => handleTagChange(null)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
                  >
                    无标签
                  </button>
                  <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                  {availableTags.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => handleTagChange(tag.id)}
                      className={cn(
                        'w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2',
                        tag.id === preview.supertagId && 'bg-gray-50 dark:bg-gray-700'
                      )}
                    >
                      <span
                        className="w-5 h-5 rounded flex items-center justify-center text-xs"
                        style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                      >
                        {tag.icon || '#'}
                      </span>
                      {tag.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* 节点内容 */}
            <div className="flex-1">
              {isEditingContent ? (
                <textarea
                  autoFocus
                  defaultValue={preview.content}
                  onBlur={(e) => handleContentChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setIsEditingContent(false);
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleContentChange((e.target as HTMLTextAreaElement).value);
                    }
                  }}
                  className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 resize-none"
                  rows={2}
                />
              ) : (
                <p
                  onClick={() => setIsEditingContent(true)}
                  className="text-gray-800 dark:text-gray-200 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 px-2 py-1 rounded -ml-2"
                >
                  {preview.content || '点击编辑内容...'}
                  <Edit2 className="w-3 h-3 inline-block ml-1 text-gray-400" />
                </p>
              )}
            </div>
          </div>
          
          {/* 字段区 */}
          {currentTag && currentTag.fieldDefinitions.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 mb-3 pl-10">
              {currentTag.fieldDefinitions.slice(0, 4).map((field) => {
                const value = preview.fields[field.key];
                const hasValue = value !== undefined && value !== null && value !== '';
                
                return (
                  <div
                    key={field.id}
                    className={cn(
                      'inline-flex items-center gap-1 text-sm',
                      hasValue
                        ? 'text-gray-700 dark:text-gray-300'
                        : 'text-gray-400'
                    )}
                  >
                    <span className="text-gray-400">{field.name}:</span>
                    {renderFieldValue(field, value)}
                  </div>
                );
              })}
              
              {currentTag.fieldDefinitions.length > 4 && (
                <span className="text-xs text-gray-400">
                  +{currentTag.fieldDefinitions.length - 4} 更多字段
                </span>
              )}
            </div>
          )}
          
          {/* 操作按钮 */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
            <span className="text-xs text-gray-400 mr-auto">
              按 Enter 确认 · Esc 取消
            </span>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="h-8 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X className="w-4 h-4 mr-1" />
              取消
            </Button>
            
            <Button
              variant="default"
              size="sm"
              onClick={onConfirm}
              className="h-8 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Check className="w-4 h-4 mr-1" />
              确认添加
            </Button>
          </div>
        </div>
        
        {/* AI 提取高亮指示条 */}
        {preview.isAutoExtracted && (
          <div 
            className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"
          />
        )}
      </div>
    </div>
  );
};

export default PreviewBubble;
