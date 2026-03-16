/**
 * 搜索节点配置弹窗
 * v4.0: 简化版配置弹窗，仅保留自然语言输入，移除高级手动配置模式
 * 交互模式参考原命令配置弹窗
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Search, Sparkles, Loader2, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSupertagStore } from '@/stores/supertagStore';
import type { SearchConfig, NLParseResult, NLSupertagSchema } from '@/types/search';
import { summarizeQuery } from './conditionUtils';

interface SearchConfigModalProps {
  /** 是否打开弹窗 */
  open: boolean;
  /** 初始配置（编辑模式） */
  initialConfig?: SearchConfig;
  /** 关闭弹窗回调 */
  onClose: () => void;
  /** 保存配置回调 */
  onSave: (config: SearchConfig) => void;
}

const SearchConfigModal: React.FC<SearchConfigModalProps> = ({
  open,
  initialConfig,
  onClose,
  onSave,
}) => {
  const [inputText, setInputText] = useState('');
  const [label, setLabel] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseResult, setParseResult] = useState<NLParseResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 获取 supertags 用于 AI 上下文
  const supertags = useSupertagStore((state) => state.supertags);

  // 转换为 AI 解析所需的 schema 格式
  const supertagsSchema: NLSupertagSchema[] = useMemo(() => {
    return Object.values(supertags).map((tag) => ({
      id: tag.id,
      name: tag.name,
      icon: tag.icon,
      fields: (tag.fieldDefinitions || []).map((f) => ({
        key: f.key,
        name: f.name,
        type: f.type as 'text' | 'number' | 'date' | 'select',
        options: f.options,
      })),
    }));
  }, [supertags]);

  // 初始化编辑模式数据
  useEffect(() => {
    if (open && initialConfig) {
      setLabel(initialConfig.label || '');
      // 如果有已解析的条件，显示摘要供参考
      if (initialConfig.conditions?.length > 0) {
        const summary = summarizeQuery(initialConfig, supertags);
        setInputText(`// 当前条件：${summary}\n`);
      }
    } else if (open) {
      setInputText('');
      setLabel('');
      setParseResult(null);
      setParseError(null);
    }
  }, [open, initialConfig, supertags]);

  // 弹窗打开时聚焦输入框
  useEffect(() => {
    if (open && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [open]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    setParseError(null);
    setParseResult(null);
  }, []);

  const handleParse = useCallback(async () => {
    const cleanInput = inputText.replace(/^\/\/.*\n?/g, '').trim();
    if (!cleanInput) {
      setParseError('请输入搜索条件描述');
      return;
    }

    setIsParsing(true);
    setParseError(null);
    setParseResult(null);

    try {
      const response = await fetch('/api/ai/search-nl-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: cleanInput,
          supertags: supertagsSchema,
        }),
      });

      const result = await response.json();

      if (response.status === 503) {
        setParseError(result.error || 'AI 服务不可用，请检查配置');
        return;
      }

      if (!response.ok) {
        throw new Error(result.error || 'AI 解析失败');
      }

      const nlResult: NLParseResult = {
        success: result.success,
        config: result.config
          ? {
              logicalOperator: result.config.logicalOperator,
              conditions: result.config.conditions,
              label: label || `搜索: ${cleanInput.slice(0, 20)}${cleanInput.length > 20 ? '...' : ''}`,
            }
          : undefined,
        explanation: result.explanation,
        warnings: result.warnings,
        confidence: result.confidence,
        error: result.error,
        suggestions: result.suggestions,
      };

      setParseResult(nlResult);

      if (!nlResult.success) {
        setParseError(nlResult.error || '解析失败');
      }
    } catch (err) {
      console.error('[SearchConfigModal] Parse error:', err);
      const errorMessage = err instanceof Error ? err.message : 'AI 解析失败';
      setParseError(errorMessage);
    } finally {
      setIsParsing(false);
    }
  }, [inputText, supertagsSchema, label]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleParse();
      }
    },
    [handleParse]
  );

  const handleConfirm = useCallback(() => {
    if (parseResult?.success && parseResult.config) {
      const finalConfig: SearchConfig = {
        ...parseResult.config,
        label: label || parseResult.config.label,
      };
      onSave(finalConfig);
    }
  }, [parseResult, label, onSave]);

  const querySummary = useMemo(() => {
    if (parseResult?.config) {
      return summarizeQuery(parseResult.config, supertags);
    }
    return null;
  }, [parseResult, supertags]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-teal-700">
            <Search size={20} />
            配置搜索条件
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 搜索名称 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              搜索名称 <span className="text-slate-400">(可选)</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="例如：本周待办任务"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>

          {/* 自然语言输入 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              搜索条件描述
            </label>
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="用自然语言描述搜索条件...&#10;例如：三天内即将到期的未完成任务"
                disabled={isParsing}
                rows={4}
                className={cn(
                  'w-full resize-none rounded-lg border bg-white px-4 py-3 text-sm',
                  'placeholder:text-slate-400',
                  'focus:outline-none focus:ring-2 focus:ring-teal-500/30',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  parseError
                    ? 'border-red-300 focus:border-red-400'
                    : 'border-slate-200 focus:border-teal-400'
                )}
              />
            </div>
            <p className="mt-1.5 text-xs text-slate-400">
              按 <kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">⌘</kbd> +{' '}
              <kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">Enter</kbd> 快速解析
            </p>
          </div>

          {/* 解析按钮 */}
          <Button
            onClick={handleParse}
            disabled={isParsing || !inputText.replace(/^\/\/.*\n?/g, '').trim()}
            className={cn(
              'w-full gap-2 bg-gradient-to-r from-teal-500 to-cyan-500',
              'hover:from-teal-600 hover:to-cyan-600',
              'disabled:opacity-50'
            )}
          >
            {isParsing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                解析中...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                AI 解析条件
              </>
            )}
          </Button>

          {/* 解析错误 */}
          {parseError && (
            <div className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{parseError}</span>
            </div>
          )}

          {/* 解析结果预览 */}
          {parseResult?.success && parseResult.config && (
            <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-teal-700">
                <CheckCircle2 size={16} />
                解析成功
              </div>
              {parseResult.explanation && (
                <p className="text-sm text-slate-600">{parseResult.explanation}</p>
              )}
              {querySummary && (
                <div className="text-xs text-slate-500 bg-white/60 rounded px-2 py-1">
                  条件摘要：{querySummary}
                </div>
              )}
              {parseResult.warnings && parseResult.warnings.length > 0 && (
                <div className="text-xs text-amber-600">
                  ⚠️ {parseResult.warnings.join('；')}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!parseResult?.success || !parseResult?.config}
            className="bg-teal-600 hover:bg-teal-700"
          >
            确认创建
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SearchConfigModal;
