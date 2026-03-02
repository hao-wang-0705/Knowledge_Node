'use client';

import React, { useCallback, useMemo, useRef, useEffect, useState, useLayoutEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Calendar, Plus, Book, Settings, Trash2, User, ChevronRight, Edit2, Hash, Search, Command, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FEATURE_FLAGS, getDisabledMessage } from '@/lib/feature-flags';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useNodeStore } from '@/stores/nodeStore';
import { getGreeting } from '@/utils/helpers';
import { getTodayId } from '@/utils/date-helpers';
import CommandTemplateManager from './CommandTemplateManager';

interface SidebarProps {
  className?: string;
  onOpenCommandCenter?: () => void;
}

interface ContextMenuPosition {
  x: number;
  y: number;
  nodeId: string;
}

interface AdjustedPosition {
  x: number;
  y: number;
}

const Sidebar: React.FC<SidebarProps> = ({ className, onOpenCommandCenter }) => {
  const router = useRouter();
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenuPosition | null>(null);
  const [menuPosition, setMenuPosition] = useState<AdjustedPosition | null>(null);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [showCommandManager, setShowCommandManager] = useState(false);
  const [expandedTagIds, setExpandedTagIds] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const nodes = useNodeStore((state) => state.nodes);
  const hoistedNodeId = useNodeStore((state) => state.hoistedNodeId);
  const setHoistedNode = useNodeStore((state) => state.setHoistedNode);
  const addNode = useNodeStore((state) => state.addNode);
  const updateNode = useNodeStore((state) => state.updateNode);
  const deleteNode = useNodeStore((state) => state.deleteNode);
  const goToToday = useNodeStore((state) => state.goToToday);
  const getSidebarEntries = useNodeStore((state) => state.getSidebarEntries);
  const isInDailyTree = useNodeStore((state) => state.isInDailyTree);
  const { data: session } = useSession();

  const userRootId = useMemo(
    () => Object.values(nodes).find((n) => n.nodeRole === 'user_root')?.id ?? null,
    [nodes]
  );

  const sidebarEntries = useMemo(() => getSidebarEntries(), [getSidebarEntries, nodes]);
  const dailyRootId = useMemo(
    () => sidebarEntries.find((id) => nodes[id]?.nodeRole === 'daily_root') ?? null,
    [sidebarEntries, nodes]
  );
  const notebookEntryIds = useMemo(
    () => sidebarEntries.filter((id) => id !== dailyRootId),
    [sidebarEntries, dailyRootId]
  );

  const isCalendarView = useMemo(
    () => (hoistedNodeId ? isInDailyTree(hoistedNodeId) : false),
    [hoistedNodeId, isInDailyTree]
  );
  const activeNotebookNodeId = useMemo(() => {
    if (!hoistedNodeId || !userRootId) return null;
    if (nodes[userRootId]?.childrenIds.includes(hoistedNodeId) && hoistedNodeId !== dailyRootId)
      return hoistedNodeId;
    let cur = nodes[hoistedNodeId]?.parentId ?? null;
    while (cur && cur !== userRootId) {
      const parent = nodes[cur];
      if (!parent) break;
      if (parent.nodeRole === 'user_root' && cur !== dailyRootId) return null;
      cur = parent.parentId;
    }
    if (cur === userRootId && hoistedNodeId !== dailyRootId) {
      let n = nodes[hoistedNodeId];
      while (n?.parentId && n.parentId !== userRootId) n = nodes[n.parentId];
      return n?.parentId === userRootId ? n.id : null;
    }
    return null;
  }, [hoistedNodeId, userRootId, dailyRootId, nodes]);

  const userRootDisplayName = useMemo(() => {
    const user = session?.user;
    if (!user) return '我的笔记';
    return (user as { name?: string | null; email?: string | null }).name
      || (typeof (user as { email?: string }).email === 'string'
        ? (user as { email: string }).email.split('@')[0]
        : '我的笔记');
  }, [session?.user]);

  const greeting = useMemo(() => getGreeting(), []);

  const isTodayActive = useMemo(() => {
    if (!isCalendarView) return false;
    const todayId = getTodayId();
    return hoistedNodeId === todayId;
  }, [isCalendarView, hoistedNodeId]);

  const handleGoToAllNotes = useCallback(() => {
    if (!userRootId) return;
    setHoistedNode(userRootId);
  }, [userRootId, setHoistedNode]);

  const handleGoToToday = useCallback(() => {
    goToToday();
  }, [goToToday]);

  const handleCreateNotebook = useCallback(() => {
    if (!userRootId) return;
    const newId = addNode(userRootId);
    updateNode(newId, { content: '无标题笔记本' });
    setHoistedNode(newId);
    setEditingNodeId(newId);
    setEditingName('无标题笔记本');
  }, [userRootId, addNode, updateNode, setHoistedNode]);

  const handleSelectNotebook = useCallback(
    (nodeId: string) => {
      if (editingNodeId === nodeId) return;
      setHoistedNode(nodeId);
    },
    [setHoistedNode, editingNodeId]
  );

  const handleDoubleClick = useCallback((nodeId: string, currentName: string) => {
    setEditingNodeId(nodeId);
    setEditingName(currentName);
  }, []);

  const handleSaveName = useCallback(() => {
    if (editingNodeId && editingName.trim()) {
      updateNode(editingNodeId, { content: editingName.trim() });
    }
    setEditingNodeId(null);
    setEditingName('');
  }, [editingNodeId, editingName, updateNode]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleSaveName();
      else if (e.key === 'Escape') {
        setEditingNodeId(null);
        setEditingName('');
      }
    },
    [handleSaveName]
  );

  useEffect(() => {
    if (editingNodeId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingNodeId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
        setIsMenuVisible(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
        setIsMenuVisible(false);
      }
    };
    if (contextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [contextMenu]);

  useLayoutEffect(() => {
    if (contextMenu && contextMenuRef.current) {
      const menuRect = contextMenuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const padding = 8;
      let adjustedX = contextMenu.x;
      let adjustedY = contextMenu.y;
      if (contextMenu.x + menuRect.width + padding > viewportWidth)
        adjustedX = Math.max(padding, viewportWidth - menuRect.width - padding);
      if (contextMenu.y + menuRect.height + padding > viewportHeight)
        adjustedY = Math.max(padding, viewportHeight - menuRect.height - padding);
      setMenuPosition({ x: adjustedX, y: adjustedY });
      requestAnimationFrame(() => setIsMenuVisible(true));
    } else {
      setMenuPosition(null);
      setIsMenuVisible(false);
    }
  }, [contextMenu]);

  const handleContextMenu = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsMenuVisible(false);
    setContextMenu({ x: e.clientX, y: e.clientY, nodeId });
  }, []);

  const handleRename = useCallback(() => {
    if (contextMenu) {
      const node = nodes[contextMenu.nodeId];
      if (node) {
        setEditingNodeId(contextMenu.nodeId);
        setEditingName(node.content || '');
      }
      setContextMenu(null);
    }
  }, [contextMenu, nodes]);

  const handleDeleteNotebook = useCallback(async () => {
    if (!contextMenu) return;
    const node = nodes[contextMenu.nodeId];
    if (node && confirm(`确定要删除「${node.content || '未命名'}」吗？此操作不可撤销。`)) {
      try {
        deleteNode(contextMenu.nodeId);
        if (hoistedNodeId === contextMenu.nodeId || (nodes[hoistedNodeId!]?.parentId && (() => {
          let cur: string | null = nodes[hoistedNodeId!]?.parentId ?? null;
          while (cur) { if (cur === contextMenu.nodeId) return true; cur = nodes[cur]?.parentId ?? null; }
          return false;
        })())) {
          goToToday();
        }
      } catch (error) {
        console.error('[Sidebar] 删除失败:', error);
      }
    }
    setContextMenu(null);
  }, [contextMenu, nodes, deleteNode, hoistedNodeId, goToToday]);

  return (
    <aside
      className={cn(
        'flex flex-col h-full bg-slate-50 dark:bg-slate-900 border-r border-gray-200 dark:border-gray-800',
        className
      )}
    >
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shadow-md"
            style={{
              background: 'linear-gradient(135deg, var(--brand-primary) 0%, oklch(0.45 0.2 265) 100%)',
            }}
          >
            <User size={20} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{greeting}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">欢迎回来</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-200 dark:border-gray-800">
          <button
            type="button"
            onClick={handleGoToAllNotes}
            disabled={!userRootId}
            className={cn(
              'flex flex-1 items-center gap-2 min-w-0 rounded-lg transition-all',
              hoistedNodeId === userRootId
                ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200'
            )}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, var(--brand-primary) 0%, oklch(0.45 0.2 265) 100%)',
              }}
            >
              <User size={16} className="text-white" />
            </div>
            <span className="flex-1 text-sm font-medium truncate text-left">{userRootDisplayName}</span>
          </button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
                onClick={handleCreateNotebook}
              >
                <Plus size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">新建笔记本</TooltipContent>
          </Tooltip>
        </div>

        <div className="overflow-y-auto px-2 py-2">
          <div className="space-y-0.5 pl-1">
            <div
              onClick={handleGoToToday}
              className={cn(
                'group flex items-center gap-2 pl-3 pr-2 py-2 rounded-lg cursor-pointer transition-all',
                isCalendarView
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              )}
            >
              <Calendar
                size={16}
                className={cn(
                  'flex-shrink-0',
                  isCalendarView ? 'text-green-600 dark:text-green-400' : 'text-gray-400'
                )}
              />
              <span className="flex-1 text-sm">Daily notes</span>
              {isTodayActive && (
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
              )}
              {isCalendarView && !isTodayActive && (
                <ChevronRight size={14} className="text-green-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              )}
            </div>

            {notebookEntryIds.map((nodeId) => {
              const node = nodes[nodeId];
              if (!node) return null;
              const isActive = activeNotebookNodeId === nodeId;
              const isEditing = editingNodeId === nodeId;
              const displayName = node.content?.trim() || '无标题笔记本';

              return (
                <div
                  key={nodeId}
                  onClick={() => handleSelectNotebook(nodeId)}
                  onDoubleClick={() => handleDoubleClick(nodeId, displayName)}
                  onContextMenu={(e) => handleContextMenu(e, nodeId)}
                  className={cn(
                    'group flex items-center gap-2 pl-3 pr-2 py-2 rounded-lg cursor-pointer transition-all',
                    isActive
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  )}
                >
                  <Book
                    size={16}
                    className={cn(
                      'flex-shrink-0',
                      isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'
                    )}
                  />
                  {isEditing ? (
                    <input
                      ref={inputRef}
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={handleSaveName}
                      onKeyDown={handleKeyDown}
                      className="flex-1 bg-white dark:bg-gray-800 px-2 py-0.5 text-sm rounded border border-blue-300 dark:border-blue-600 outline-none min-w-0"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="flex-1 text-sm truncate min-w-0">{displayName}</span>
                  )}
                  {isActive && !isEditing && (
                    <ChevronRight size={14} className="text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="p-3 border-t border-gray-200 dark:border-gray-800">
        <button
          onClick={onOpenCommandCenter}
          className="w-full flex items-center gap-2 px-3 py-2.5 mb-2 text-sm text-gray-600 dark:text-gray-400 hover:text-[var(--brand-primary)] bg-gray-100 dark:bg-gray-800 hover:bg-gray-200/80 dark:hover:bg-gray-700/80 rounded-lg transition-colors"
        >
          <Search size={16} />
          <span className="flex-1 text-left">🔍 搜索笔记...</span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs text-gray-400 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
            <Command size={10} />
            <span>K</span>
          </kbd>
        </button>
        <button
          onClick={() => router.push('/library/tags')}
          className="w-full flex items-center gap-2 px-3 py-2 mb-2 text-sm text-gray-600 dark:text-gray-400 hover:text-[var(--brand-primary)] hover:bg-gray-200/80 dark:hover:bg-gray-700/80 rounded-lg transition-colors"
        >
          <Hash size={16} />
          <span>🏷️ 标签库</span>
        </button>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => FEATURE_FLAGS.AI_COMMAND_NODE && setShowCommandManager(true)}
              disabled={!FEATURE_FLAGS.AI_COMMAND_NODE}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 mb-2 text-sm rounded-lg transition-colors",
                FEATURE_FLAGS.AI_COMMAND_NODE
                  ? "text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                  : "text-gray-400 dark:text-gray-500 cursor-not-allowed opacity-50"
              )}
            >
              <Sparkles size={16} />
              <span>🤖 AI 指令</span>
              <kbd className="ml-auto hidden sm:inline-flex items-center px-1.5 py-0.5 text-xs text-gray-400 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
                /ai
              </kbd>
            </button>
          </TooltipTrigger>
          {!FEATURE_FLAGS.AI_COMMAND_NODE && (
            <TooltipContent side="right">{getDisabledMessage('AI_COMMAND_NODE')}</TooltipContent>
          )}
        </Tooltip>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 justify-start text-gray-500 hover:text-gray-700 dark:hover:text-gray-400 dark:hover:text-gray-300"
              >
                <Settings size={16} className="mr-2" />
                <span className="text-xs">设置</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">应用设置</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <Trash2 size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">回收站</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {contextMenu && menuPosition && (
        <div
          ref={contextMenuRef}
          className={cn(
            'fixed z-[9999] min-w-[160px]',
            'bg-white dark:bg-gray-800',
            'border border-gray-200 dark:border-gray-700',
            'rounded-xl shadow-xl py-1.5 px-1',
            'backdrop-blur-sm bg-white/95 dark:bg-gray-800/95',
            'transition-all duration-150 ease-out',
            isMenuVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-1'
          )}
          style={{ left: menuPosition.x, top: menuPosition.y, boxShadow: 'var(--shadow-dropdown)' }}
        >
          <button
            onClick={handleRename}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-100 rounded-lg mx-0.5"
          >
            <span className="flex items-center justify-center w-5 h-5 text-gray-500">
              <Edit2 size={15} />
            </span>
            <span>重命名</span>
          </button>
          <div className="h-px bg-gray-200 dark:bg-gray-700 my-1.5 mx-2" />
          <button
            onClick={handleDeleteNotebook}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-all duration-100 rounded-lg mx-0.5"
          >
            <span className="flex items-center justify-center w-5 h-5 text-gray-500">
              <Trash2 size={15} />
            </span>
            <span>删除</span>
          </button>
        </div>
      )}

      <CommandTemplateManager open={showCommandManager} onClose={() => setShowCommandManager(false)} />
    </aside>
  );
};

export default Sidebar;
