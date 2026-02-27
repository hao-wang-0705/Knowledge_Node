'use client';

import { useState, useMemo } from 'react';
import { Search, Sparkles, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COMMAND_TEMPLATES, getTemplateCategories } from '@/utils/command-templates';
import type { CommandTemplate } from '@/types';

interface CommandTemplateLibraryProps {
  /** 选择模板回调 */
  onSelectTemplate: (template: CommandTemplate) => void;
  /** 当前选中的模板 ID */
  selectedTemplateId?: string;
  /** 是否显示为弹窗模式 */
  isPopover?: boolean;
  /** 自定义类名 */
  className?: string;
}

/**
 * 指令模板库组件
 * 展示预设的 AI 指令模板，支持搜索和分类浏览
 */
export function CommandTemplateLibrary({
  onSelectTemplate,
  selectedTemplateId,
  isPopover = false,
  className,
}: CommandTemplateLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const categories = getTemplateCategories();

  // 筛选模板
  const filteredTemplates = useMemo(() => {
    let templates = COMMAND_TEMPLATES;

    // 按分类筛选
    if (activeCategory) {
      templates = templates.filter((t) => t.category === activeCategory);
    }

    // 按搜索词筛选
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      templates = templates.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.description.toLowerCase().includes(query)
      );
    }

    return templates;
  }, [activeCategory, searchQuery]);

  // 按分类分组
  const groupedTemplates = useMemo(() => {
    if (activeCategory) return null;
    
    const groups: Record<string, CommandTemplate[]> = {};
    for (const template of filteredTemplates) {
      if (!groups[template.category]) {
        groups[template.category] = [];
      }
      groups[template.category].push(template);
    }
    return groups;
  }, [activeCategory, filteredTemplates]);

  return (
    <div
      className={cn(
        'flex flex-col bg-white dark:bg-zinc-900 rounded-lg',
        isPopover ? 'max-h-96' : 'border border-zinc-200 dark:border-zinc-800',
        className
      )}
    >
      {/* 搜索栏 */}
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索模板..."
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* 分类标签 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto">
        <button
          onClick={() => setActiveCategory(null)}
          className={cn(
            'px-3 py-1 rounded-full text-xs whitespace-nowrap transition-colors',
            activeCategory === null
              ? 'bg-indigo-600 text-white'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200'
          )}
        >
          全部
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={cn(
              'px-3 py-1 rounded-full text-xs whitespace-nowrap transition-colors flex items-center gap-1',
              activeCategory === cat.id
                ? 'bg-indigo-600 text-white'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200'
            )}
          >
            <span>{cat.icon}</span>
            {cat.name}
          </button>
        ))}
      </div>

      {/* 模板列表 */}
      <div className="flex-1 overflow-y-auto">
        {filteredTemplates.length === 0 ? (
          <div className="p-8 text-center text-zinc-400">
            <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">没有找到匹配的模板</p>
          </div>
        ) : groupedTemplates ? (
          // 分组显示
          Object.entries(groupedTemplates).map(([category, templates]) => {
            const categoryInfo = categories.find((c) => c.id === category);
            return (
              <div key={category}>
                <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 text-xs font-medium text-zinc-500 flex items-center gap-1">
                  <span>{categoryInfo?.icon}</span>
                  {categoryInfo?.name || category}
                </div>
                {templates.map((template) => (
                  <TemplateItem
                    key={template.id}
                    template={template}
                    isSelected={template.id === selectedTemplateId}
                    onClick={() => onSelectTemplate(template)}
                  />
                ))}
              </div>
            );
          })
        ) : (
          // 平铺显示
          filteredTemplates.map((template) => (
            <TemplateItem
              key={template.id}
              template={template}
              isSelected={template.id === selectedTemplateId}
              onClick={() => onSelectTemplate(template)}
            />
          ))
        )}
      </div>

      {/* 底部提示 */}
      <div className="px-3 py-2 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
        <p className="text-xs text-zinc-400">
          选择模板后可以自定义 Prompt
        </p>
      </div>
    </div>
  );
}

/**
 * 模板列表项
 */
function TemplateItem({
  template,
  isSelected,
  onClick,
}: {
  template: CommandTemplate;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-3 text-left transition-colors',
        isSelected
          ? 'bg-indigo-50 dark:bg-indigo-900/30'
          : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
      )}
    >
      <span className="text-xl flex-shrink-0">{template.icon}</span>
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-sm font-medium truncate',
            isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-900 dark:text-zinc-100'
          )}
        >
          {template.name}
        </p>
        <p className="text-xs text-zinc-500 truncate">{template.description}</p>
      </div>
      <ChevronRight
        className={cn(
          'w-4 h-4 flex-shrink-0',
          isSelected ? 'text-indigo-500' : 'text-zinc-300 dark:text-zinc-600'
        )}
      />
    </button>
  );
}

/**
 * 紧凑版模板选择器（用于下拉菜单）
 */
export function TemplateQuickPicker({
  onSelect,
  className,
}: {
  onSelect: (template: CommandTemplate) => void;
  className?: string;
}) {
  const recentTemplates = COMMAND_TEMPLATES.slice(0, 5);

  return (
    <div className={cn('py-1', className)}>
      <p className="px-3 py-1.5 text-xs font-medium text-zinc-400">快速选择模板</p>
      {recentTemplates.map((template) => (
        <button
          key={template.id}
          onClick={() => onSelect(template)}
          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <span>{template.icon}</span>
          <span className="text-sm text-zinc-700 dark:text-zinc-300">{template.name}</span>
        </button>
      ))}
    </div>
  );
}
