'use client';

/**
 * AI 字段配置详情展示组件 (v3.5)
 * 
 * 在标签详情面板中可视化展示 AI 字段的完整配置：
 * - AI 预设类型标签和图标
 * - 系统 Prompt 概要（只读）
 * - 用户自定义 Prompt 内容（可折叠）
 * - 输出格式和选项
 * - 上下文配置
 * - 触发机制显示
 */

import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Cpu,
  FileSearch,
  FileText,
  ListChecks,
  Hand,
  Settings2,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AIFieldConfig, AIFieldPresetType, AIFieldOutputFormat } from '@/types';

interface AIFieldConfigPanelProps {
  aiConfig: AIFieldConfig;
  className?: string;
}

// AI 预设类型配置
const AI_TYPE_CONFIG: Record<AIFieldPresetType, {
  name: string;
  icon: React.ReactNode;
  color: string;
  description: string;
  systemPromptSummary: string;
}> = {
  extraction: {
    name: '信息抽取',
    icon: <FileSearch size={14} />,
    color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
    description: '从内容中精准提取关键信息',
    systemPromptSummary: '你是一个信息抽取专家，从给定内容中精准提取指定信息...',
  },
  summarization: {
    name: '总结重写',
    icon: <FileText size={14} />,
    color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
    description: '生成 TL;DR 摘要或格式化重写',
    systemPromptSummary: '你是一个专业的内容总结专家，擅长提炼核心要点...',
  },
  classification: {
    name: '自动分类',
    icon: <ListChecks size={14} />,
    color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400',
    description: '根据内容特征自动分类判定',
    systemPromptSummary: '你是一个分类判定专家，根据内容特征进行准确分类...',
  },
  // v3.5 向后兼容：旧类型映射
  urgency_score: {
    name: '紧急度评分（旧）',
    icon: <ListChecks size={14} />,
    color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400',
    description: '评估任务紧急程度（建议迁移到 classification）',
    systemPromptSummary: '评估任务紧急程度，返回 P0-P3 优先级...',
  },
  subtask_split: {
    name: '子任务拆解（旧）',
    icon: <FileSearch size={14} />,
    color: 'bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-400',
    description: '将任务拆解为子任务（建议迁移到 extraction）',
    systemPromptSummary: '将复杂任务拆解为可执行的子任务...',
  },
  custom: {
    name: '自定义（旧）',
    icon: <Settings2 size={14} />,
    color: 'bg-gray-100 text-gray-600 dark:bg-gray-900/40 dark:text-gray-400',
    description: '自定义 AI 处理逻辑',
    systemPromptSummary: '根据自定义提示词处理内容...',
  },
};

// 输出格式配置
const OUTPUT_FORMAT_CONFIG: Record<AIFieldOutputFormat, {
  name: string;
  description: string;
}> = {
  text: { name: '文本', description: '返回自由格式文本' },
  select: { name: '选项', description: '从预定义选项中选择' },
  list: { name: '列表', description: '返回多个条目的列表' },
};

// 触发时机配置
const TRIGGER_CONFIG: Record<string, {
  name: string;
  icon: React.ReactNode;
  description: string;
}> = {
  manual: { 
    name: '手动触发', 
    icon: <Hand size={12} />,
    description: '需要用户点击触发按钮执行',
  },
  create: { 
    name: '创建时', 
    icon: <Settings2 size={12} />,
    description: '节点创建时自动执行（预留接口）',
  },
  update: { 
    name: '更新时', 
    icon: <Settings2 size={12} />,
    description: '节点更新时自动执行（预留接口）',
  },
};

const AIFieldConfigPanel: React.FC<AIFieldConfigPanelProps> = ({
  aiConfig,
  className,
}) => {
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const [isContextExpanded, setIsContextExpanded] = useState(false);

  const typeConfig = AI_TYPE_CONFIG[aiConfig.aiType];
  const outputConfig = OUTPUT_FORMAT_CONFIG[aiConfig.outputFormat];
  const triggerConfig = TRIGGER_CONFIG[aiConfig.triggerOn || 'manual'];

  return (
    <div className={cn('space-y-3', className)}>
      {/* AI 预设类型 */}
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0',
            typeConfig.color
          )}
        >
          {typeConfig.icon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {typeConfig.name}
            </span>
            <span className="px-1.5 py-0.5 text-[10px] rounded bg-pink-100 dark:bg-pink-900/40 text-pink-600 dark:text-pink-300">
              AI
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{typeConfig.description}</p>
        </div>
      </div>

      {/* 系统 Prompt 概要 */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <Cpu size={12} className="text-gray-400" />
          <span className="text-xs font-medium text-gray-500">系统 Prompt（只读）</span>
        </div>
        <p className="text-xs text-gray-400 italic line-clamp-2">
          {typeConfig.systemPromptSummary}
        </p>
      </div>

      {/* 用户自定义 Prompt */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <button
          onClick={() => setIsPromptExpanded(!isPromptExpanded)}
          className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        >
          <span className="text-gray-400">
            {isPromptExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
            用户自定义 Prompt
          </span>
          {!isPromptExpanded && aiConfig.prompt && (
            <span className="flex-1 text-xs text-gray-400 truncate">
              {aiConfig.prompt.slice(0, 50)}...
            </span>
          )}
        </button>
        {isPromptExpanded && (
          <div className="px-3 pb-3">
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-md p-2">
              <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap font-mono">
                {aiConfig.prompt || '(未配置)'}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* 输出配置 */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2.5">
          <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">
            输出格式
          </div>
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {outputConfig.name}
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5">{outputConfig.description}</p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2.5">
          <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">
            触发机制
          </div>
          <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
            {triggerConfig.icon}
            <span>{triggerConfig.name}</span>
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5">{triggerConfig.description}</p>
        </div>
      </div>

      {/* 选项列表 (仅 select 输出格式时显示) */}
      {aiConfig.outputFormat === 'select' && aiConfig.options && aiConfig.options.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
          <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-2">
            可选值
          </div>
          <div className="flex flex-wrap gap-1.5">
            {aiConfig.options.map((option, index) => (
              <span
                key={index}
                className="px-2 py-0.5 text-xs rounded-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300"
              >
                {option}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 上下文配置 */}
      {(aiConfig.includeChildren || aiConfig.inputFields?.length) && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <button
            onClick={() => setIsContextExpanded(!isContextExpanded)}
            className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          >
            <span className="text-gray-400">
              {isContextExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
            <Layers size={12} className="text-gray-400" />
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              上下文配置
            </span>
          </button>
          {isContextExpanded && (
            <div className="px-3 pb-3 space-y-2">
              {/* 子节点上下文 */}
              {aiConfig.includeChildren && (
                <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-xs text-gray-500">包含子节点内容</span>
                  <span className="text-xs font-medium text-green-600 dark:text-green-400">
                    是 (深度: {aiConfig.contextDepth || 1})
                  </span>
                </div>
              )}
              {/* 输入字段 */}
              {aiConfig.inputFields && aiConfig.inputFields.length > 0 && (
                <div className="py-1.5">
                  <span className="text-xs text-gray-500">依赖字段</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {aiConfig.inputFields.map((field, index) => (
                      <span
                        key={index}
                        className="px-1.5 py-0.5 text-[10px] rounded bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
                      >
                        {field}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AIFieldConfigPanel;
