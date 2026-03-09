/**
 * 自然语言输入组件
 * v3.5: 用于搜索节点的自然语言条件配置
 */

import React, { useState, useCallback } from 'react';
import { Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { NLParseResult, NLSupertagSchema } from '@/types/search';

interface NaturalLanguageInputProps {
  /** 初始输入值 */
  initialValue?: string;
  /** Supertag Schema 列表（用于 AI 上下文） */
  supertags: NLSupertagSchema[];
  /** 解析结果回调 */
  onParseResult: (result: NLParseResult) => void;
  /** 输入变更回调 */
  onInputChange?: (value: string) => void;
  /** 是否禁用 */
  disabled?: boolean;
}

const NaturalLanguageInput: React.FC<NaturalLanguageInputProps> = ({
  initialValue = '',
  supertags,
  onParseResult,
  onInputChange,
  disabled = false,
}) => {
  const [inputText, setInputText] = useState(initialValue);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setInputText(value);
      setParseError(null);
      onInputChange?.(value);
    },
    [onInputChange]
  );

  const handleParse = useCallback(async () => {
    if (!inputText.trim()) {
      setParseError('请输入查询条件');
      return;
    }

    setIsParsing(true);
    setParseError(null);

    try {
      // 调用服务端 API 进行 AI 解析
      const response = await fetch('/api/ai/search-nl-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: inputText.trim(),
          supertags: supertags.map((tag) => ({
            id: tag.id,
            name: tag.name,
            icon: tag.icon,
            fields: tag.fields.map((f) => ({
              key: f.key,
              name: f.name,
              type: f.type,
              options: f.options,
            })),
          })),
        }),
      });

      const parseResult = await response.json();

      // 处理服务不可用的情况
      if (response.status === 503) {
        setParseError(parseResult.error || 'AI 服务不可用，请检查配置');
        return;
      }

      if (!response.ok) {
        throw new Error(parseResult.error || 'AI 解析失败');
      }

      // 转换为 NLParseResult 格式
      const result: NLParseResult = {
        success: parseResult.success,
        config: parseResult.config
          ? {
              logicalOperator: parseResult.config.logicalOperator,
              conditions: parseResult.config.conditions.map((c: {
                type: string;
                field?: string;
                operator: string;
                value: unknown;
                negate?: boolean;
              }) => ({
                type: c.type as 'keyword' | 'tag' | 'field' | 'date' | 'ancestor',
                field: c.field,
                operator: c.operator as NLParseResult['config'] extends undefined
                  ? never
                  : NonNullable<NLParseResult['config']>['conditions'][0]['operator'],
                value: c.value,
                negate: c.negate,
              })),
            }
          : undefined,
        explanation: parseResult.explanation,
        warnings: parseResult.warnings,
        confidence: parseResult.confidence,
        error: parseResult.error,
        suggestions: parseResult.suggestions,
      };

      onParseResult(result);
    } catch (err) {
      console.error('[NaturalLanguageInput] Parse error:', err);
      const errorMessage = err instanceof Error ? err.message : 'AI 解析失败';
      setParseError(errorMessage);
      onParseResult({
        success: false,
        error: errorMessage,
        suggestions: ['请重试或使用手动配置模式'],
      });
    } finally {
      setIsParsing(false);
    }
  }, [inputText, supertags, onParseResult]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Ctrl/Cmd + Enter 触发解析
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleParse();
      }
    },
    [handleParse]
  );

  return (
    <div className="space-y-3">
      {/* 输入区域 */}
      <div className="relative">
        <textarea
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="用自然语言描述你的搜索条件...&#10;例如：三天内即将到期的未完成任务"
          disabled={disabled || isParsing}
          rows={3}
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

        {/* 解析按钮 */}
        <div className="absolute bottom-3 right-3">
          <Button
            size="sm"
            onClick={handleParse}
            disabled={disabled || isParsing || !inputText.trim()}
            className={cn(
              'gap-1.5 bg-gradient-to-r from-teal-500 to-cyan-500',
              'hover:from-teal-600 hover:to-cyan-600',
              'disabled:opacity-50'
            )}
          >
            {isParsing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>解析中</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>AI 解析</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 错误提示 */}
      {parseError && (
        <div className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{parseError}</span>
        </div>
      )}

      {/* 快捷键提示 */}
      <p className="text-xs text-slate-400">
        提示：按 <kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">⌘</kbd> +{' '}
        <kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">Enter</kbd> 快速解析
      </p>
    </div>
  );
};

export default NaturalLanguageInput;
