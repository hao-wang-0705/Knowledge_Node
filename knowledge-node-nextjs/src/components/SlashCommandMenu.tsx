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

/** v4.2: 分组命令（实体 / 行动 / 命令） */
export interface SlashCommandGroup {
  group: string;
  items: SlashCommandItem[];
}

interface SlashCommandMenuProps {
  open: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onSelect: (itemId: string) => void;
  /** 扁平命令列表（兼容旧用法） */
  commands?: SlashCommandItem[];
  /** v4.2: 分组命令，优先于 commands 展示（实体 / 行动 / 其他） */
  commandGroups?: SlashCommandGroup[];
}

const SlashCommandMenu: React.FC<SlashCommandMenuProps> = ({
  open,
  position,
  onClose,
  onSelect,
  commands = [],
  commandGroups,
}) => {
  const [keyword, setKeyword] = useState('');

  const flatFromGroups = useMemo(
    () => (commandGroups ? commandGroups.flatMap((g) => g.items) : commands),
    [commandGroups, commands],
  );

  const filteredFlat = useMemo(() => {
    if (!keyword.trim()) return flatFromGroups;
    const lower = keyword.toLowerCase();
    return flatFromGroups.filter(
      (item) =>
        item.label.toLowerCase().includes(lower) ||
        item.description.toLowerCase().includes(lower),
    );
  }, [flatFromGroups, keyword]);

  const filteredGroups = useMemo(() => {
    if (!commandGroups) return null;
    if (!keyword.trim()) {
      return commandGroups.map((g) => ({
        group: g.group,
        items: g.items,
      }));
    }
    const lower = keyword.toLowerCase();
    return commandGroups
      .map((g) => ({
        group: g.group,
        items: g.items.filter(
          (item) =>
            item.label.toLowerCase().includes(lower) ||
            item.description.toLowerCase().includes(lower),
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [commandGroups, keyword]);

  const showGrouped = filteredGroups && filteredGroups.length > 0;
  const listEmpty = showGrouped
    ? filteredGroups.every((g) => g.items.length === 0)
    : filteredFlat.length === 0;

  if (!open) return null;

  return (
    <div
      data-editing-popover
      className="fixed z-[10000] w-80 rounded-xl border border-cyan-100 bg-white/95 p-2 shadow-2xl backdrop-blur dark:border-gray-600 dark:bg-gray-900/95"
      style={{ left: position.x, top: position.y }}
    >
      <div className="mb-2 flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 dark:border-gray-600 dark:bg-gray-800">
        <Search size={14} className="text-gray-400" />
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          className="h-8 w-full border-none bg-transparent text-sm outline-none dark:text-gray-200"
          placeholder="搜索超级标签或命令"
          autoFocus
        />
      </div>

      <div className="max-h-64 overflow-y-auto">
        {listEmpty && (
          <div className="px-2 py-6 text-center text-xs text-gray-400">未找到匹配</div>
        )}
        {showGrouped &&
          filteredGroups!.map(({ group, items }) => (
            <div key={group} className="mb-1">
              <div className="px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {group}
              </div>
              {items.map((item) => (
                <button
                  key={item.id}
                  className={cn(
                    'mb-0.5 flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-left',
                    'hover:bg-cyan-50 focus:bg-cyan-50 dark:hover:bg-gray-700 dark:focus:bg-gray-700',
                  )}
                  onClick={() => {
                    onSelect(item.id);
                    onClose();
                  }}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-cyan-50 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-400">
                    {item.icon ?? <Sparkles size={14} />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                      {item.label}
                    </span>
                    {item.description && (
                      <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                        {item.description}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          ))}
        {!showGrouped &&
          filteredFlat.map((item) => (
            <button
              key={item.id}
              className={cn(
                'mb-1 flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-left',
                'hover:bg-cyan-50 focus:bg-cyan-50 dark:hover:bg-gray-700 dark:focus:bg-gray-700',
              )}
              onClick={() => {
                onSelect(item.id);
                onClose();
              }}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-cyan-50 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-400">
                {item.icon ?? <Sparkles size={14} />}
              </span>
              <span className="flex-1">
                <span className="block text-sm font-medium text-slate-800 dark:text-slate-200">
                  {item.label}
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  {item.description}
                </span>
              </span>
            </button>
          ))}
      </div>
    </div>
  );
};

export default SlashCommandMenu;
