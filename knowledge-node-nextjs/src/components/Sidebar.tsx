'use client';

import React, { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Calendar, CalendarDays, Plus, Book, Settings, Trash2, User, ChevronRight, Edit2, Hash, Search, Command, Sparkles, Clock, Pin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FEATURE_FLAGS, getDisabledMessage } from '@/lib/feature-flags';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { NavItem } from '@/components/ui/nav-item';
import { useNodeStore } from '@/stores/nodeStore';
import { getTodayId } from '@/utils/date-helpers';
import CommandTemplateManager from './CommandTemplateManager';
import {
  sidebarContainerStyles,
  avatarStyles,
  notebookItemStyles,
  getNotebookItemClass,
  getNotebookIconClass,
} from '@/styles/visual-tokens';

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
  const pathname = usePathname();
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
  const navigateToNode = useNodeStore((state) => state.navigateToNode);
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

  // 路由高亮状态判断
  const isTagsPage = pathname === '/library/tags';

  const isTodayActive = useMemo(() => {
    if (!isCalendarView) return false;
    const todayId = getTodayId();
    return hoistedNodeId === todayId;
  }, [isCalendarView, hoistedNodeId]);

  // 快捷功能区导航
  const handleGoToTags = useCallback(() => {
    router.push('/library/tags');
  }, [router]);

  const handleGoToAllNotes = useCallback(() => {
    if (!userRootId) return;
    navigateToNode(userRootId);
    router.push('/');  // 确保从其他页面能正确切换回笔记主页
  }, [userRootId, navigateToNode, router]);

  const handleGoToToday = useCallback(async () => {
    try {
      await goToToday();
      router.push('/');  // 确保从其他页面能正确切换回笔记主页
    } catch (error) {
      console.error('[Sidebar] 跳转今日笔记失败:', error);
      alert('今日笔记初始化失败，请稍后重试');
    }
  }, [goToToday, router]);

  const handleCreateNotebook = useCallback(() => {
    if (!userRootId) return;
    const newId = addNode(userRootId);
    updateNode(newId, { content: '无标题笔记本' });
    navigateToNode(newId);
    setEditingNodeId(newId);
    setEditingName('无标题笔记本');
  }, [userRootId, addNode, updateNode, navigateToNode]);

  const handleSelectNotebook = useCallback(
    (nodeId: string) => {
      if (editingNodeId === nodeId) return;
      navigateToNode(nodeId);
      router.push('/');  // 确保从其他页面能正确切换回笔记主页
    },
    [navigateToNode, editingNodeId, router]
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

  useEffect(() => {
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
          void goToToday();
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
        'sidebar-container',
        className
      )}
    >
      {/* ============ 第一部分：顶部快捷功能区 ============ */}
      <div className="px-2 pt-3 pb-2">
        <div className="space-y-0.5">
          {/* 今日笔记 - 纯快捷入口 */}
          <NavItem
            icon={<CalendarDays size={18} />}
            label="今日笔记"
            onClick={handleGoToToday}
          />

          {/* 超级标签 */}
          <NavItem
            icon={<Hash size={18} />}
            label="超级标签"
            isActive={isTagsPage}
            onClick={handleGoToTags}
          />

          {/* 笔记历史 - 置灰 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <NavItem
                  icon={<Clock size={18} />}
                  label="笔记历史"
                  disabled
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">功能开发中，敬请期待</TooltipContent>
          </Tooltip>

          {/* AI 助手 - 置灰 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <NavItem
                  icon={<Sparkles size={18} />}
                  label="AI 助手"
                  disabled
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">功能开发中，敬请期待</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* ============ 第二部分：搜索功能区 ============ */}
      <div className="px-3 py-2">
        <button
          onClick={onOpenCommandCenter}
          className="search-box"
        >
          <Search size={16} className="text-gray-400" />
          <span className="flex-1 text-left">搜索笔记...</span>
          <kbd className="search-box-shortcut">
            <Command size={10} />
            <span>K</span>
          </kbd>
        </button>
      </div>

      {/* ============ 第三部分：聚焦区（置灰） ============ */}
      <div className="px-3 py-2 sidebar-section">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="opacity-50 cursor-not-allowed">
              <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
                <Pin size={14} className="text-gray-400" />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">聚焦</span>
                <span className="text-[10px] text-gray-400 dark:text-gray-500">Pinned</span>
              </div>
              <div className="px-2 py-3 text-center">
                <p className="text-xs text-gray-400 dark:text-gray-500">即将推出</p>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">功能开发中，敬请期待</TooltipContent>
        </Tooltip>
      </div>

      {/* ============ 第四部分：笔记本区 ============ */}
      <div className="flex-1 flex flex-col min-h-0 sidebar-section">
        {/* 用户信息栏 + 新建按钮 */}
        <div className="flex items-center gap-2 px-3 py-2.5">
          <button
            type="button"
            onClick={handleGoToAllNotes}
            disabled={!userRootId}
            className={cn(
              'flex flex-1 items-center gap-2 min-w-0 px-2 py-1.5 rounded-lg transition-all',
              hoistedNodeId === userRootId && !isTagsPage
                ? 'sidebar-nav-item-active'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200'
            )}
          >
            <div
              className={cn(avatarStyles.container, avatarStyles.gradient)}
            >
              <User size={14} className={avatarStyles.icon} />
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

        {/* 笔记本列表（可滚动） */}
        <div className="overflow-y-auto px-2 pb-2 flex-1">
          <div className="space-y-0.5 pl-1">
            {/* Daily Notes - 统一使用品牌色 */}
            <div
              onClick={handleGoToToday}
              className={cn(
                getNotebookItemClass(isCalendarView && !isTagsPage)
              )}
            >
              <Calendar
                size={16}
                className={cn(
                  'flex-shrink-0',
                  getNotebookIconClass(isCalendarView && !isTagsPage)
                )}
              />
              <span className="flex-1 text-sm">Daily notes</span>
              {isTodayActive && !isTagsPage && (
                <div className="today-indicator" />
              )}
              {isCalendarView && !isTodayActive && !isTagsPage && (
                <ChevronRight size={14} className={cn(notebookItemStyles.chevronActive, 'opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0')} />
              )}
            </div>

            {/* 笔记本列表 - 统一使用品牌色 */}
            {notebookEntryIds.map((nodeId) => {
              const node = nodes[nodeId];
              if (!node) return null;
              const isActive = activeNotebookNodeId === nodeId && !isTagsPage;
              const isEditing = editingNodeId === nodeId;
              const displayName = node.content?.trim() || '无标题笔记本';

              return (
                <div
                  key={nodeId}
                  onClick={() => handleSelectNotebook(nodeId)}
                  onDoubleClick={() => handleDoubleClick(nodeId, displayName)}
                  onContextMenu={(e) => handleContextMenu(e, nodeId)}
                  className={cn(getNotebookItemClass(isActive))}
                >
                  <Book
                    size={16}
                    className={cn(
                      'flex-shrink-0',
                      getNotebookIconClass(isActive)
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
                      className="inline-edit-input"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="flex-1 text-sm truncate min-w-0">{displayName}</span>
                  )}
                  {isActive && !isEditing && (
                    <ChevronRight size={14} className={cn(notebookItemStyles.chevronActive, 'opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0')} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ============ 底部工具栏 ============ */}
      <div className="p-2 border-t border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <Settings size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">设置</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
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
            'context-menu',
            'transition-all duration-150 ease-out',
            isMenuVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-1'
          )}
          style={{ left: menuPosition.x, top: menuPosition.y }}
        >
          <button
            onClick={handleRename}
            className="context-menu-item"
          >
            <span className="context-menu-icon">
              <Edit2 size={15} />
            </span>
            <span>重命名</span>
          </button>
          <div className="context-menu-divider" />
          <button
            onClick={handleDeleteNotebook}
            className="context-menu-item-danger"
          >
            <span className="context-menu-icon">
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
