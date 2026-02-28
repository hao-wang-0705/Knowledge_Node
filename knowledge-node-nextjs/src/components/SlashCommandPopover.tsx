'use client';

import React, { useEffect, useRef } from 'react';
import { Hash, Link2, Plus, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SlashCommandItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  keywords?: string[];
}

export const SLASH_COMMANDS: SlashCommandItem[] = [
  { id: 'tag', label: '添加标签', icon: <Hash size={14} />, keywords: ['标签', 'tag', 'add'] },
  { id: 'ref', label: '插入引用', icon: <Link2 size={14} />, keywords: ['引用', 'ref', 'link'] },
  { id: 'child', label: '添加子节点', icon: <Plus size={14} />, keywords: ['子节点', 'child'] },
  { id: 'ai', label: '/ai 指令', icon: <Sparkles size={14} />, keywords: ['ai', '指令'] },
];

export function filterSlashCommands(search: string): SlashCommandItem[] {
  if (!search.trim()) return SLASH_COMMANDS;
  const q = search.toLowerCase();
  return SLASH_COMMANDS.filter(
    (c) =>
      c.label.toLowerCase().includes(q) ||
      c.id.includes(q) ||
      c.keywords?.some((k) => k.includes(q))
  );
}

interface SlashCommandPopoverProps {
  open: boolean;
  position: { x: number; y: number };
  commands: SlashCommandItem[];
  selectedIndex: number;
  onSelect: (command: SlashCommandItem) => void;
}

export function SlashCommandPopover({
  open,
  position,
  commands,
  selectedIndex,
  onSelect,
}: SlashCommandPopoverProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.children[selectedIndex] as HTMLElement;
    el?.scrollIntoView({ block: 'nearest' });
  }, [open, selectedIndex]);

  if (!open || commands.length === 0) return null;

  return (
    <div
      data-slash-command-popover
      className="fixed z-[200] py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl min-w-[180px] max-h-[240px] overflow-y-auto"
      style={{ left: position.x, top: position.y }}
    >
      <div ref={listRef} className="py-1">
        {commands.map((cmd, i) => (
          <button
            key={cmd.id}
            type="button"
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 text-left text-sm',
              i === selectedIndex
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
            )}
            onClick={() => onSelect(cmd)}
          >
            {cmd.icon}
            {cmd.label}
          </button>
        ))}
      </div>
    </div>
  );
}
