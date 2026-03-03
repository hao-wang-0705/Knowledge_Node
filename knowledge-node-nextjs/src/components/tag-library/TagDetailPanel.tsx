'use client';

/**
 * 标签详情面板组件 (v3.4)
 * 
 * 参考 Tana 风格的只读详情展示
 * - 右侧滑入式面板
 * - 折叠式分区展示 (Building blocks, Content template, Advanced options)
 * - 底部使用统计
 * - 无删除按钮、无编辑入口
 * - v3.4: 移除继承相关展示
 */

import React, { useState } from 'react';
import {
  X,
  Hash,
  ChevronDown,
  ChevronRight,
  Type,
  Calendar,
  List,
  Link2,
  FileText,
  Settings,
  Sparkles,
  Cpu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Supertag, FieldDefinition, FieldType } from '@/types';
import { useSupertagStore } from '@/stores/supertagStore';

interface TagDetailPanelProps {
  tag: Supertag;
  onClose: () => void;
}

// 字段类型图标映射
const FIELD_TYPE_ICONS: Record<FieldType, React.ReactNode> = {
  text: <Type size={14} />,
  number: <Hash size={14} />,
  date: <Calendar size={14} />,
  select: <List size={14} />,
  reference: <Link2 size={14} />,
  ai_text: <Cpu size={14} />,
  ai_select: <Cpu size={14} />,
};

// 字段类型颜色映射
const FIELD_TYPE_COLORS: Record<FieldType, string> = {
  text: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
  number: 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400',
  date: 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400',
  select: 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400',
  reference: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400',
  ai_text: 'bg-pink-100 text-pink-600 dark:bg-pink-900/40 dark:text-pink-400',
  ai_select: 'bg-pink-100 text-pink-600 dark:bg-pink-900/40 dark:text-pink-400',
};

// 字段类型名称映射
const FIELD_TYPE_NAMES: Record<FieldType, string> = {
  text: '文本',
  number: '数字',
  date: '日期',
  select: '单选',
  reference: '引用',
  ai_text: 'AI 文本',
  ai_select: 'AI 选项',
};

// 折叠区块组件
interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  defaultExpanded?: boolean;
  children: React.ReactNode;
  badge?: string | number;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  icon,
  defaultExpanded = true,
  children,
  badge,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "flex items-center gap-3 w-full px-6 py-4",
          "text-left hover:bg-gray-50 dark:hover:bg-gray-800/50",
          "transition-colors"
        )}
      >
        <span className="text-gray-400">
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
        <span className="text-gray-500 dark:text-gray-400">{icon}</span>
        <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300">
          {title}
        </span>
        {badge !== undefined && (
          <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
            {badge}
          </span>
        )}
      </button>
      {isExpanded && <div className="px-6 pb-5">{children}</div>}
    </div>
  );
};

// 字段展示行组件
interface FieldRowProps {
  field: FieldDefinition;
  supertags: Record<string, Supertag>;
}

const FieldRow: React.FC<FieldRowProps> = ({ field, supertags }) => {
  const targetTag = field.targetTagId ? supertags[field.targetTagId] : null;
  const isAIField = field.type === 'ai_text' || field.type === 'ai_select';

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg",
        isAIField
          ? "bg-pink-50/50 dark:bg-pink-900/10"
          : "bg-gray-50 dark:bg-gray-800/50"
      )}
    >
      {/* 字段类型图标 */}
      <span
        className={cn(
          "flex items-center justify-center w-7 h-7 rounded-md",
          FIELD_TYPE_COLORS[field.type]
        )}
      >
        {FIELD_TYPE_ICONS[field.type]}
      </span>

      {/* 字段名称 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate text-gray-700 dark:text-gray-300">
            {field.name}
          </span>
          {isAIField && (
            <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] rounded bg-pink-100 dark:bg-pink-900/40 text-pink-600 dark:text-pink-300">
              AI
            </span>
          )}
        </div>

        {/* 字段配置详情 */}
        <div className="text-xs text-gray-400 mt-0.5">
          <span>{FIELD_TYPE_NAMES[field.type]}</span>
          {field.type === 'select' && field.options && (
            <span className="ml-2">
              ({field.options.length} 个选项)
            </span>
          )}
          {field.type === 'reference' && targetTag && (
            <span className="ml-2">
              → #{targetTag.name}
              {field.multiple && ' (多选)'}
            </span>
          )}
          {isAIField && field.aiConfig && (
            <span className="ml-2">
              触发: {field.aiConfig.triggerOn === 'create' ? '创建时' : field.aiConfig.triggerOn === 'update' ? '更新时' : '手动'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

const TagDetailPanel: React.FC<TagDetailPanelProps> = ({ tag, onClose }) => {
  // 从 store 获取数据
  const supertags = useSupertagStore((state) => state.supertags);

  // 统计数据
  const fieldCount = tag.fieldDefinitions?.length || 0;
  const aiFieldCount = tag.fieldDefinitions?.filter(f => f.type === 'ai_text' || f.type === 'ai_select').length || 0;
  const hasTemplateContent =
    tag.templateContent &&
    (Array.isArray(tag.templateContent)
      ? tag.templateContent.length > 0
      : true);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* 头部 */}
      <div className="flex-shrink-0 px-6 py-5 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-start justify-between">
          {/* 标签信息 */}
          <div className="flex items-center gap-4">
            {/* 标签图标/颜色 */}
            <div
              className="flex items-center justify-center w-14 h-14 rounded-xl text-2xl"
              style={{
                backgroundColor: `${tag.color}20`,
                borderColor: tag.color,
                borderWidth: '2px',
              }}
            >
              {tag.icon || (
                <Hash size={28} style={{ color: tag.color }} strokeWidth={2.5} />
              )}
            </div>

            {/* 标签名称和描述 */}
            <div>
              <h2
                className="text-xl font-bold"
                style={{ color: tag.color }}
              >
                #{tag.name}
              </h2>
              {tag.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {tag.description}
                </p>
              )}
              
              {/* 标签徽章 */}
              <div className="flex items-center gap-2 mt-2">
                {tag.isGlobalDefault && (
                  <span className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
                    <Sparkles size={10} />
                    系统预置
                  </span>
                )}
                {aiFieldCount > 0 && (
                  <span className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-pink-100 dark:bg-pink-900/40 text-pink-600 dark:text-pink-400">
                    <Cpu size={10} />
                    {aiFieldCount} 个 AI 字段
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 关闭按钮 */}
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto">
        {/* Building blocks (字段定义) */}
        <CollapsibleSection
          title="Building blocks"
          icon={<Type size={16} />}
          badge={fieldCount}
          defaultExpanded={true}
        >
          {fieldCount > 0 ? (
            <div className="space-y-2">
              {tag.fieldDefinitions.map((field) => (
                <FieldRow key={field.id} field={field} supertags={supertags} />
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400">
              <Type size={24} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">暂无字段定义</p>
            </div>
          )}

          {/* 字段统计 */}
          {fieldCount > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-4 text-xs text-gray-400">
              <span>共 {fieldCount} 个字段</span>
              {aiFieldCount > 0 && (
                <span className="text-pink-500">
                  含 {aiFieldCount} 个 AI 字段
                </span>
              )}
            </div>
          )}
        </CollapsibleSection>

        {/* Content template (内容模版) */}
        <CollapsibleSection
          title="Content template"
          icon={<FileText size={16} />}
          defaultExpanded={!!hasTemplateContent}
        >
          {hasTemplateContent ? (
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
              <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap font-mono">
                {JSON.stringify(tag.templateContent, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400">
              <FileText size={24} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">暂无内容模版</p>
            </div>
          )}
        </CollapsibleSection>

        {/* Advanced options (高级选项) */}
        <CollapsibleSection
          title="Advanced options"
          icon={<Settings size={16} />}
          defaultExpanded={false}
        >
          <div className="space-y-3">
            {/* 标签 ID */}
            <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
              <span className="text-sm text-gray-500">标签 ID</span>
              <code className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-gray-600 dark:text-gray-400">
                {tag.id}
              </code>
            </div>

            {/* 状态 */}
            <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
              <span className="text-sm text-gray-500">状态</span>
              <span
                className={cn(
                  "text-xs px-2 py-0.5 rounded-full",
                  tag.status === 'active'
                    ? "bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400"
                    : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                )}
              >
                {tag.status === 'active' ? '活跃' : '已废弃'}
              </span>
            </div>

            {/* 排序 */}
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-500">排序权重</span>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {tag.order ?? 0}
              </span>
            </div>
          </div>
        </CollapsibleSection>
      </div>

      {/* 底部提示 */}
      <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <p className="text-xs text-gray-400 text-center">
          此标签由系统预置，如需修改请联系管理员
        </p>
      </div>
    </div>
  );
};

export default TagDetailPanel;
