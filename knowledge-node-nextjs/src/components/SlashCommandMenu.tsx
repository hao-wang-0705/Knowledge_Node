'use client';

import React, { useMemo, useState } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SlashCommandItem {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

interface SlashCommandMenuProps {
  open: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onSelect: (itemId: string) => void;
  commands: SlashCommandItem[];
}

const SlashCommandMenu: React.FC<SlashCommandMenuProps> = ({
  open,
  position,
  onClose,
  onSelect,
  commands,
}) => {
  const [keyword, setKeyword] = useState('');

  const filtered = useMemo(() => {
    if (!keyword.trim()) return commands;
    const lower = keyword.toLowerCase();
    return commands.filter((item) =>
      item.label.toLowerCase().includes(lower)
      || item.description.toLowerCase().includes(lower)
    );
  }, [commands, keyword]);

  if (!open) return null;

  return (
    <div
      className="fixed z-[10000] w-80 rounded-xl border border-cyan-100 bg-white/95 p-2 shadow-2xl backdrop-blur"
      style={{ left: position.x, top: position.y }}
    >
      <div className="mb-2 flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2">
        <Search size={14} className="text-gray-400" />
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          className="h-8 w-full border-none bg-transparent text-sm outline-none"
          placeholder="搜索命令"
          autoFocus
        />
      </div>

      <div className="max-h-64 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="px-2 py-6 text-center text-xs text-gray-400">未找到匹配命令</div>
        )}
        {filtered.map((item) => (
          <button
            key={item.id}
            className={cn(
              'mb-1 flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-left',
              'hover:bg-cyan-50 focus:bg-cyan-50'
            )}
            onClick={() => {
              onSelect(item.id);
              onClose();
            }}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-cyan-50 text-cyan-600">
              {item.icon || <Sparkles size={14} />}
            </span>
            <span className="flex-1">
              <span className="block text-sm font-medium text-slate-800">{item.label}</span>
              <span className="block text-xs text-slate-500">{item.description}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default SlashCommandMenu;
