'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, FileText, Zap, Brain, PenTool, ChevronRight, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { CommandConfig, CommandTemplate } from '@/types';
import {
  COMMAND_TEMPLATES,
  getTemplatesByCategory,
  getTemplateCategories,
  getTemplateById,
} from '@/utils/command-templates';

interface CommandConfigModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (config: { templateId?: string; prompt: string }) => void;
  initialConfig?: CommandConfig;
  mode: 'create' | 'edit';
}

// 分类图标映射
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  productivity: <Zap size={16} />,
  analysis: <Brain size={16} />,
  creative: <PenTool size={16} />,
  summary: <FileText size={16} />,
};

const CommandConfigModal: React.FC<CommandConfigModalProps> = ({
  open,
  onClose,
  onConfirm,
  initialConfig,
  mode,
}) => {
  const [activeTab, setActiveTab] = useState<'template' | 'custom'>('template');
  const [selectedCategory, setSelectedCategory] = useState<string>('productivity');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(
    initialConfig?.templateId
  );
  const [customPrompt, setCustomPrompt] = useState(initialConfig?.prompt || '');

  // 初始化状态
  useEffect(() => {
    if (open) {
      if (initialConfig?.templateId) {
        setActiveTab('template');
        setSelectedTemplateId(initialConfig.templateId);
        const template = getTemplateById(initialConfig.templateId);
        if (template) {
          setSelectedCategory(template.category);
        }
      } else if (initialConfig?.prompt) {
        setActiveTab('custom');
        setCustomPrompt(initialConfig.prompt);
      } else {
        // 新建模式，默认显示模板选择
        setActiveTab('template');
        setSelectedTemplateId(undefined);
        setCustomPrompt('');
      }
    }
  }, [open, initialConfig]);

  const categories = getTemplateCategories();

  const handleConfirm = useCallback(() => {
    if (activeTab === 'template' && selectedTemplateId) {
      const template = getTemplateById(selectedTemplateId);
      onConfirm({
        templateId: selectedTemplateId,
        prompt: template?.prompt || '',
      });
    } else {
      onConfirm({
        templateId: undefined,
        prompt: customPrompt,
      });
    }
    onClose();
  }, [activeTab, selectedTemplateId, customPrompt, onConfirm, onClose]);

  const currentTemplates = getTemplatesByCategory(
    selectedCategory as CommandTemplate['category']
  );

  const selectedTemplate = selectedTemplateId
    ? getTemplateById(selectedTemplateId)
    : undefined;

  const isValid =
    (activeTab === 'template' && selectedTemplateId) ||
    (activeTab === 'custom' && customPrompt.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-purple-700">
            <Sparkles size={20} />
            {mode === 'create' ? '新建 AI 指令' : '编辑 AI 指令'}
          </DialogTitle>
          <DialogDescription>
            选择预设模板或自定义 Prompt 来配置 AI 指令
          </DialogDescription>
        </DialogHeader>

        {/* Tab 切换 */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('template')}
            className={cn(
              'flex-1 py-2.5 px-4 text-sm font-medium transition-colors relative',
              activeTab === 'template'
                ? 'text-purple-600 dark:text-purple-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            )}
          >
            <span className="flex items-center justify-center gap-2">
              <FileText size={16} />
              选择模板
            </span>
            {activeTab === 'template' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 dark:bg-purple-400" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={cn(
              'flex-1 py-2.5 px-4 text-sm font-medium transition-colors relative',
              activeTab === 'custom'
                ? 'text-purple-600 dark:text-purple-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            )}
          >
            <span className="flex items-center justify-center gap-2">
              <PenTool size={16} />
              自定义 Prompt
            </span>
            {activeTab === 'custom' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 dark:bg-purple-400" />
            )}
          </button>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'template' ? (
            <div className="flex h-full">
              {/* 分类侧边栏 */}
              <div className="w-32 border-r border-gray-200 dark:border-gray-700 py-2 flex-shrink-0">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => {
                      setSelectedCategory(category.id);
                      setSelectedTemplateId(undefined);
                    }}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors',
                      selectedCategory === category.id
                        ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 font-medium'
                        : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
                    )}
                  >
                    <span className="text-base">{category.icon}</span>
                    <span>{category.name}</span>
                  </button>
                ))}
              </div>

              {/* 模板列表 */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {currentTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplateId(template.id)}
                    className={cn(
                      'w-full text-left p-3 rounded-lg border transition-all',
                      selectedTemplateId === template.id
                        ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/30 dark:border-purple-500 ring-1 ring-purple-300 dark:ring-purple-600'
                        : 'border-gray-200 dark:border-gray-700 hover:border-purple-200 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl flex-shrink-0">{template.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {template.name}
                          </span>
                          {selectedTemplateId === template.id && (
                            <Check size={16} className="text-purple-600 dark:text-purple-400" />
                          )}
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                          {template.description}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* 预览区域 */}
              {selectedTemplate && (
                <div className="w-64 border-l border-gray-200 dark:border-gray-700 p-3 flex-shrink-0 bg-gray-50/50 dark:bg-gray-900/30 overflow-y-auto">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">
                    指令预览
                  </div>
                  <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words leading-relaxed">
                    {selectedTemplate.prompt.length > 500
                      ? selectedTemplate.prompt.slice(0, 500) + '...'
                      : selectedTemplate.prompt}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 h-full flex flex-col">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                自定义指令内容
              </label>
              <Textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="输入你的 AI 指令...

例如：
- 帮我总结这段内容的要点
- 根据上下文生成待办事项
- 分析这些数据并给出建议

支持使用变量：
{{context}} - 当前节点及子节点内容
{{date}} - 当前日期"
                className="flex-1 min-h-[200px] resize-none"
              />
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                提示：使用 <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{'{{context}}'}</code> 引用节点内容
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!isValid}
            className={cn(
              'bg-purple-600 hover:bg-purple-700 text-white',
              !isValid && 'opacity-50 cursor-not-allowed'
            )}
          >
            <Sparkles size={16} className="mr-1" />
            {mode === 'create' ? '创建指令' : '保存修改'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CommandConfigModal;
