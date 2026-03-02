'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Play,
  Loader2,
  Settings2,
  Sparkles,
  Copy,
  Check,
  RefreshCw,
  BookTemplate,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FEATURE_FLAGS, getDisabledMessage } from '@/lib/feature-flags';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TokenBudgetIndicator } from './TokenBudgetIndicator';
import { ContextSelector } from './ContextSelector';
import { CommandTemplateLibrary } from './CommandTemplateLibrary';
import {
  fillTemplateVariables,
  estimateTokenCount,
  DEFAULT_MAX_TOKENS,
  getTemplateById,
} from '@/utils/command-templates';
import type { CommandConfig, ContextFilter, Supertag, Node, CommandTemplate } from '@/types';

interface CommandNodeViewProps {
  /** 节点 ID */
  nodeId: string;
  /** 指令配置 */
  config: CommandConfig;
  /** 配置变更回调 */
  onConfigChange: (config: CommandConfig) => void;
  /** 执行指令回调 */
  onExecute: (prompt: string, context: string) => Promise<void>;
  /** 执行结果（流式） */
  result?: string;
  /** 是否正在执行 */
  isExecuting?: boolean;
  /** 可用的 Supertags */
  supertags?: Supertag[];
  /** 节点数据（用于上下文筛选） */
  nodes?: Record<string, Node>;
  /** 根据筛选条件获取上下文内容 */
  getContextContent?: (filter: ContextFilter) => string;
  /** 自定义类名 */
  className?: string;
}

/**
 * 指令节点视图组件
 * 完整的指令节点交互界面，包含：
 * - Prompt 编辑器
 * - 模板选择
 * - 上下文筛选
 * - Token 预算指示
 * - 执行按钮和结果展示
 */
export function CommandNodeView({
  nodeId: _nodeId, // 保留用于未来扩展
  config,
  onConfigChange,
  onExecute,
  result,
  isExecuting = false,
  supertags = [],
  nodes = {},
  getContextContent,
  className,
}: CommandNodeViewProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [copied, setCopied] = useState(false);
  const [localPrompt, setLocalPrompt] = useState(config.prompt || '');

  // 获取当前模板信息
  const currentTemplate = useMemo(() => {
    return config.templateId ? getTemplateById(config.templateId) : null;
  }, [config.templateId]);

  // 计算上下文内容
  const contextContent = useMemo(() => {
    if (getContextContent && config.contextFilter) {
      return getContextContent(config.contextFilter);
    }
    return '';
  }, [getContextContent, config.contextFilter]);

  // 填充变量后的 Prompt
  const filledPrompt = useMemo(() => {
    return fillTemplateVariables(localPrompt, {
      context: contextContent,
      date: new Date().toLocaleDateString('zh-CN'),
      week: `第${Math.ceil(new Date().getDate() / 7)}周`,
      month: `${new Date().getMonth() + 1}月`,
    });
  }, [localPrompt, contextContent]);

  // 处理 Prompt 变更
  const handlePromptChange = useCallback((value: string) => {
    setLocalPrompt(value);
    onConfigChange({
      ...config,
      prompt: value,
    });
  }, [config, onConfigChange]);

  // 处理模板选择
  const handleSelectTemplate = useCallback((template: CommandTemplate) => {
    setLocalPrompt(template.prompt);
    onConfigChange({
      ...config,
      templateId: template.id,
      prompt: template.prompt,
      contextFilter: template.suggestedFilter as ContextFilter,
    });
    setShowTemplates(false);
  }, [config, onConfigChange]);

  // 处理筛选条件变更
  const handleFilterChange = useCallback((filter: ContextFilter) => {
    onConfigChange({
      ...config,
      contextFilter: filter,
    });
  }, [config, onConfigChange]);

  // 执行指令
  const handleExecute = useCallback(async () => {
    await onExecute(filledPrompt, contextContent);
  }, [onExecute, filledPrompt, contextContent]);

  // 复制结果
  const handleCopyResult = useCallback(() => {
    if (result) {
      navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [result]);

  // Token 预算检查
  const isOverBudget = useMemo(() => {
    const total = estimateTokenCount(filledPrompt);
    return total > (config.maxTokens || DEFAULT_MAX_TOKENS);
  }, [filledPrompt, config.maxTokens]);

  return (
    <div className={cn('bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden', className)}>
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-500" />
          <span className="font-medium text-sm">AI 指令</span>
          {currentTemplate && (
            <span className="px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 text-xs">
              {currentTemplate.icon} {currentTemplate.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => FEATURE_FLAGS.AI_COMMAND_NODE && setShowTemplates(!showTemplates)}
                disabled={!FEATURE_FLAGS.AI_COMMAND_NODE}
                className={cn(
                  'p-1.5 rounded-lg text-zinc-600 dark:text-zinc-400',
                  FEATURE_FLAGS.AI_COMMAND_NODE
                    ? 'hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50'
                    : 'opacity-50 cursor-not-allowed'
                )}
                title={FEATURE_FLAGS.AI_COMMAND_NODE ? '选择模板' : getDisabledMessage('AI_COMMAND_NODE')}
              >
                <BookTemplate className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            {!FEATURE_FLAGS.AI_COMMAND_NODE && (
              <TooltipContent>{getDisabledMessage('AI_COMMAND_NODE')}</TooltipContent>
            )}
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => FEATURE_FLAGS.AI_COMMAND_NODE && setShowSettings(!showSettings)}
                disabled={!FEATURE_FLAGS.AI_COMMAND_NODE}
                className={cn(
                  'p-1.5 rounded-lg transition-colors',
                  !FEATURE_FLAGS.AI_COMMAND_NODE
                    ? 'opacity-50 cursor-not-allowed text-zinc-600 dark:text-zinc-400'
                    : showSettings
                    ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400'
                    : 'hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50 text-zinc-600 dark:text-zinc-400'
                )}
                title={FEATURE_FLAGS.AI_COMMAND_NODE ? '设置' : getDisabledMessage('AI_COMMAND_NODE')}
              >
                <Settings2 className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            {!FEATURE_FLAGS.AI_COMMAND_NODE && (
              <TooltipContent>{getDisabledMessage('AI_COMMAND_NODE')}</TooltipContent>
            )}
          </Tooltip>
        </div>
      </div>

      {/* 模板选择面板 */}
      {showTemplates && (
        <div className="border-b border-zinc-200 dark:border-zinc-800">
          <CommandTemplateLibrary
            onSelectTemplate={handleSelectTemplate}
            selectedTemplateId={config.templateId}
            isPopover
          />
        </div>
      )}

      {/* 设置面板 */}
      {showSettings && (
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/30">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 上下文筛选 */}
            <ContextSelector
              filter={config.contextFilter || {}}
              onFilterChange={handleFilterChange}
              supertags={supertags}
              nodes={nodes}
            />
            
            {/* Token 预算 */}
            <div className="space-y-3">
              <TokenBudgetIndicator
                promptText={filledPrompt}
                contextText={contextContent}
                maxTokens={config.maxTokens}
                model={config.model}
                showDetails
              />
              
              {/* 模型选择 */}
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">AI 模型</label>
                <select
                  value={config.model || 'gpt-4'}
                  onChange={(e) => onConfigChange({ ...config, model: e.target.value as CommandConfig['model'] })}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="gpt-4">GPT-4</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  <option value="claude-3-opus">Claude 3 Opus</option>
                  <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Prompt 编辑器 */}
      <div className="p-4">
        <textarea
          value={localPrompt}
          onChange={(e) => handlePromptChange(e.target.value)}
          placeholder="输入指令 Prompt...&#10;&#10;可使用变量：{{context}} {{date}} {{week}} {{month}}"
          className="w-full min-h-[120px] px-4 py-3 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-zinc-400"
        />
        
        {/* Token 简要指示 */}
        {!showSettings && (
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-zinc-400">
              约 {estimateTokenCount(filledPrompt).toLocaleString()} tokens
            </span>
            {isOverBudget && (
              <span className="text-xs text-red-500">超出预算</span>
            )}
          </div>
        )}
      </div>

      {/* 执行按钮 */}
      <div className="px-4 pb-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleExecute}
              disabled={!FEATURE_FLAGS.AI_COMMAND_NODE || isExecuting || isOverBudget || !localPrompt.trim()}
              className={cn(
                'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all',
                !FEATURE_FLAGS.AI_COMMAND_NODE
                  ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-400 cursor-not-allowed opacity-50'
                  : isExecuting
                  ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500 cursor-wait'
                  : isOverBudget || !localPrompt.trim()
                  ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/25'
              )}
            >
              {isExecuting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  执行中...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  运行指令
                </>
              )}
            </button>
          </TooltipTrigger>
          {!FEATURE_FLAGS.AI_COMMAND_NODE && (
            <TooltipContent>{getDisabledMessage('AI_COMMAND_NODE')}</TooltipContent>
          )}
        </Tooltip>
      </div>

      {/* 执行结果 */}
      {result && (
        <div className="border-t border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between px-4 py-2 bg-zinc-50 dark:bg-zinc-800/50">
            <span className="text-xs font-medium text-zinc-500">执行结果</span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyResult}
                className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500"
                title="复制结果"
              >
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
              <button
                onClick={handleExecute}
                disabled={isExecuting}
                className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500"
                title="重新执行"
              >
                <RefreshCw className={cn('w-4 h-4', isExecuting && 'animate-spin')} />
              </button>
            </div>
          </div>
          <div className="p-4 prose prose-sm dark:prose-invert max-w-none">
            <pre className="whitespace-pre-wrap text-sm bg-zinc-100 dark:bg-zinc-800 rounded-lg p-4 overflow-x-auto">
              {result}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 紧凑版指令节点（用于大纲视图内联显示）
 */
export function CommandNodeCompact({
  config,
  isExecuting,
  onExecute,
  className,
}: {
  config: CommandConfig;
  isExecuting?: boolean;
  onExecute: () => void;
  className?: string;
}) {
  const template = config.templateId ? getTemplateById(config.templateId) : null;

  return (
    <div className={cn('flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/30', className)}>
      <Sparkles className="w-4 h-4 text-indigo-500" />
      <span className="text-sm text-indigo-600 dark:text-indigo-400 flex-1 truncate">
        {template ? `${template.icon} ${template.name}` : '自定义指令'}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onExecute}
            disabled={!FEATURE_FLAGS.AI_COMMAND_NODE || isExecuting}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              !FEATURE_FLAGS.AI_COMMAND_NODE
                ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-400 opacity-50 cursor-not-allowed'
                : isExecuting
                ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-400'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            )}
          >
            {isExecuting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </button>
        </TooltipTrigger>
        {!FEATURE_FLAGS.AI_COMMAND_NODE && (
          <TooltipContent>{getDisabledMessage('AI_COMMAND_NODE')}</TooltipContent>
        )}
      </Tooltip>
    </div>
  );
}
