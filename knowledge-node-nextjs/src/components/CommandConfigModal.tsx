'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, Wand2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { CommandConfig, CommandSurface } from '@/types';

interface CommandConfigModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (surface: CommandSurface) => void;
  initialConfig?: CommandConfig;
  mode: 'create' | 'edit';
}

/**
 * v4.0 极简版 AI 指令配置弹窗
 * 仅需要输入：指令名称 + 自然语言 Prompt
 */
const CommandConfigModal: React.FC<CommandConfigModalProps> = ({
  open,
  onClose,
  onConfirm,
  initialConfig,
  mode,
}) => {
  const [name, setName] = useState('');
  const [userPrompt, setUserPrompt] = useState('');

  // 初始化状态
  useEffect(() => {
    if (open) {
      if (initialConfig?.surface) {
        setName(initialConfig.surface.name || '');
        setUserPrompt(initialConfig.surface.userPrompt || '');
      } else {
        setName('');
        setUserPrompt('');
      }
    }
  }, [open, initialConfig]);

  const handleConfirm = useCallback(() => {
    if (!name.trim() || !userPrompt.trim()) return;
    
    onConfirm({
      name: name.trim(),
      userPrompt: userPrompt.trim(),
    });
    onClose();
  }, [name, userPrompt, onConfirm, onClose]);

  const isValid = name.trim().length > 0 && userPrompt.trim().length > 0;

  // 快捷示例
  const examples = [
    { name: '生成周报', prompt: '帮我总结上周所有的笔记，提取核心要点和待办事项' },
    { name: '头脑风暴', prompt: '基于当前节点的内容，发散思考 5 个相关的新想法' },
    { name: '任务拆解', prompt: '将当前任务拆解为可执行的子任务清单' },
  ];

  const applyExample = (example: { name: string; prompt: string }) => {
    setName(example.name);
    setUserPrompt(example.prompt);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-400">
            <Sparkles size={20} />
            {mode === 'create' ? '新建 AI 指令' : '编辑 AI 指令'}
          </DialogTitle>
          <DialogDescription>
            告诉 AI 你想做什么，它会自动理解并执行
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 指令名称 */}
          <div className="space-y-2">
            <Label htmlFor="command-name" className="text-sm font-medium">
              指令名称
            </Label>
            <Input
              id="command-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：生成周报、头脑风暴、任务拆解..."
              className="w-full"
              autoFocus
            />
          </div>

          {/* 自然语言 Prompt */}
          <div className="space-y-2">
            <Label htmlFor="command-prompt" className="text-sm font-medium">
              告诉 AI 做什么
            </Label>
            <Textarea
              id="command-prompt"
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              placeholder={`用自然语言描述你的需求...

💡 提示：
• 用 # 引用标签，如 #产品规划
• 用 @ 提及特定节点
• 支持时间描述，如"上周"、"本月"`}
              className="min-h-[120px] resize-none"
            />
          </div>

          {/* 快捷示例 */}
          {mode === 'create' && (
            <div className="space-y-2">
              <Label className="text-xs text-gray-500 dark:text-gray-400">
                快捷示例
              </Label>
              <div className="flex flex-wrap gap-2">
                {examples.map((example) => (
                  <button
                    key={example.name}
                    onClick={() => applyExample(example)}
                    className={cn(
                      'px-3 py-1.5 text-xs rounded-full border transition-colors',
                      'border-gray-200 dark:border-gray-700',
                      'text-gray-600 dark:text-gray-400',
                      'hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700',
                      'dark:hover:border-purple-600 dark:hover:bg-purple-900/30 dark:hover:text-purple-300'
                    )}
                  >
                    <Wand2 size={12} className="inline mr-1" />
                    {example.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
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
            {mode === 'create' ? '创建并执行' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CommandConfigModal;
