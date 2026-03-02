'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { X, Search, Sparkles, Play, Plus, ChevronRight, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COMMAND_TEMPLATES, getTemplateCategories } from '@/utils/command-templates';
import { useNodeStore } from '@/stores/nodeStore';
import type { CommandTemplate } from '@/types';

interface CommandTemplateManagerProps {
  open: boolean;
  onClose: () => void;
}

/**
 * 指令模板管理器组件
 * 用于查看、搜索和快速创建指令节点
 */
const CommandTemplateManager: React.FC<CommandTemplateManagerProps> = ({ open, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<CommandTemplate | null>(null);
  
  const addCommandNode = useNodeStore((state) => state.addCommandNode);
  const hoistedNodeId = useNodeStore((state) => state.hoistedNodeId);
  const focusedNodeId = useNodeStore((state) => state.focusedNodeId);

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

  // 创建指令节点
  const handleCreateCommandNode = useCallback((template: CommandTemplate) => {
    // 确定父节点
    const parentId = focusedNodeId || hoistedNodeId || null;
    
    // 创建指令节点
    addCommandNode(parentId, template.id, template.prompt);
    
    // 关闭弹窗
    onClose();
  }, [addCommandNode, focusedNodeId, hoistedNodeId, onClose]);

  // 创建自定义指令
  const handleCreateCustomCommand = useCallback(() => {
    const parentId = focusedNodeId || hoistedNodeId || null;
    addCommandNode(parentId, undefined, '');
    onClose();
  }, [addCommandNode, focusedNodeId, hoistedNodeId, onClose]);

  // ESC 关闭
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  if (!open) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div 
        className="w-full max-w-2xl max-h-[80vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                🤖 AI 指令模板
              </h2>
              <p className="text-sm text-gray-500">
                选择模板快速创建 AI 指令节点
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* 搜索栏 */}
        <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索指令模板..."
              autoFocus
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
            />
          </div>
        </div>

        {/* 分类标签 */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-gray-200 dark:border-gray-800 overflow-x-auto">
          <button
            onClick={() => setActiveCategory(null)}
            className={cn(
              'px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition-all',
              activeCategory === null
                ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
            )}
          >
            全部
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                'px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition-all flex items-center gap-1.5',
                activeCategory === cat.id
                  ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
              )}
            >
              <span>{cat.icon}</span>
              {cat.name}
            </button>
          ))}
        </div>

        {/* 模板列表 */}
        <div className="flex-1 overflow-y-auto">
          {/* 快速创建自定义指令 */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <button
              onClick={handleCreateCustomCommand}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 hover:from-purple-100 hover:to-indigo-100 dark:hover:from-purple-900/30 dark:hover:to-indigo-900/30 transition-all group"
            >
              <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg">
                <Plus size={18} className="text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  创建自定义指令
                </p>
                <p className="text-sm text-gray-500">
                  从头开始编写你自己的 AI 指令
                </p>
              </div>
              <ChevronRight size={18} className="text-gray-400 group-hover:text-purple-500 transition-colors" />
            </button>
          </div>

          {filteredTemplates.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-base">没有找到匹配的模板</p>
              <p className="text-sm mt-1">尝试其他关键词或创建自定义指令</p>
            </div>
          ) : groupedTemplates ? (
            // 分组显示
            Object.entries(groupedTemplates).map(([category, templates]) => {
              const categoryInfo = categories.find((c) => c.id === category);
              return (
                <div key={category}>
                  <div className="px-6 py-2 bg-gray-50 dark:bg-gray-800/50 text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    <span className="text-base">{categoryInfo?.icon}</span>
                    {categoryInfo?.name || category}
                  </div>
                  {templates.map((template) => (
                    <TemplateItem
                      key={template.id}
                      template={template}
                      onClick={() => handleCreateCommandNode(template)}
                      onPreview={() => setSelectedTemplate(template)}
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
                onClick={() => handleCreateCommandNode(template)}
                onPreview={() => setSelectedTemplate(template)}
              />
            ))
          )}
        </div>

        {/* 底部提示 */}
        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 text-xs">/ai</kbd>
                <span>快速创建</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 text-xs">ESC</kbd>
                <span>关闭</span>
              </span>
            </div>
            <span className="text-gray-400">共 {COMMAND_TEMPLATES.length} 个模板</span>
          </div>
        </div>
      </div>

      {/* 模板预览弹窗 */}
      {selectedTemplate && (
        <TemplatePreview
          template={selectedTemplate}
          onClose={() => setSelectedTemplate(null)}
          onCreate={() => {
            handleCreateCommandNode(selectedTemplate);
            setSelectedTemplate(null);
          }}
        />
      )}
    </div>
  );
};

/**
 * 模板列表项
 */
function TemplateItem({
  template,
  onClick,
  onPreview,
}: {
  template: CommandTemplate;
  onClick: () => void;
  onPreview: () => void;
}) {
  return (
    <div
      className="group flex items-center gap-3 px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <span className="text-2xl flex-shrink-0">{template.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
          {template.name}
        </p>
        <p className="text-sm text-gray-500 truncate">{template.description}</p>
      </div>
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPreview();
          }}
          className="p-2 text-gray-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
          title="预览"
        >
          <Search size={16} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-sm font-medium rounded-lg hover:shadow-md transition-all"
        >
          <Zap size={14} />
          使用
        </button>
      </div>
    </div>
  );
}

/**
 * 模板预览弹窗
 */
function TemplatePreview({
  template,
  onClose,
  onCreate,
}: {
  template: CommandTemplate;
  onClose: () => void;
  onCreate: () => void;
}) {
  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20">
          <span className="text-4xl">{template.icon}</span>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {template.name}
            </h3>
            <p className="text-sm text-gray-500">{template.description}</p>
          </div>
        </div>

        {/* Prompt 内容 */}
        <div className="px-6 py-4 max-h-64 overflow-y-auto">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Prompt 模板
          </h4>
          <pre className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
            {template.prompt}
          </pre>
        </div>

        {/* 底部操作 */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
          >
            取消
          </button>
          <button
            onClick={onCreate}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-sm font-medium rounded-lg hover:shadow-md transition-all"
          >
            <Play size={16} />
            创建指令节点
          </button>
        </div>
      </div>
    </div>
  );
}

export default CommandTemplateManager;
