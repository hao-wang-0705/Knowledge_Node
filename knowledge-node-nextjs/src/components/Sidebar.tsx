'use client';

import React, { useCallback, useMemo, useRef, useEffect, useState, useLayoutEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Plus, Book, Settings, Trash2, User, ChevronRight, Edit2, Hash, Eye, PinOff, Search, Command, Lock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useNotebookStore } from '@/stores/notebookStore';
import { useNodeStore } from '@/stores/nodeStore';
import { useSupertagStore } from '@/stores/supertagStore';
import { usePerspectiveStore } from '@/stores/perspectiveStore';
import { getGreeting } from '@/utils/helpers';
import { getTodayId } from '@/utils/date-helpers';
import CommandTemplateManager from './CommandTemplateManager';

interface SidebarProps {
  className?: string;
  onOpenCommandCenter?: () => void;
}

// 右键菜单位置
interface ContextMenuPosition {
  x: number;
  y: number;
  notebookId: string;
}

// 调整后的菜单位置
interface AdjustedPosition {
  x: number;
  y: number;
}

const Sidebar: React.FC<SidebarProps> = ({ className, onOpenCommandCenter }) => {
  const router = useRouter();
  const [editingNotebookId, setEditingNotebookId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenuPosition | null>(null);
  const [menuPosition, setMenuPosition] = useState<AdjustedPosition | null>(null);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [showCommandManager, setShowCommandManager] = useState(false);
  const [expandedTagIds, setExpandedTagIds] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  
  const notebooks = useNotebookStore((state) => state.notebooks);
  const notebookIds = useNotebookStore((state) => state.notebookIds);
  const activeNotebookId = useNotebookStore((state) => state.activeNotebookId);
  const navigationMode = useNotebookStore((state) => state.navigationMode);
  const createNotebook = useNotebookStore((state) => state.createNotebook);
  const updateNotebook = useNotebookStore((state) => state.updateNotebook);
  const deleteNotebook = useNotebookStore((state) => state.deleteNotebook);
  const setActiveNotebook = useNotebookStore((state) => state.setActiveNotebook);
  const goToCalendar = useNotebookStore((state) => state.goToCalendar);
  const setNavigationMode = useNotebookStore((state) => state.setNavigationMode);
  
  const hoistedNodeId = useNodeStore((state) => state.hoistedNodeId);
  
  // 透视相关
  const supertags = useSupertagStore((state) => state.supertags);
  const pinnedTagIds = usePerspectiveStore((state) => state.pinnedTagIds);
  const activeTagId = usePerspectiveStore((state) => state.activeTagId);
  const setActiveTag = usePerspectiveStore((state) => state.setActiveTag);
  const unpinTag = usePerspectiveStore((state) => state.unpinTag);
  const loadPerspectives = usePerspectiveStore((state) => state.loadFromAPI);
  
  // 获取钉住的标签列表
  const pinnedTags = useMemo(() => {
    return pinnedTagIds
      .map(id => supertags[id])
      .filter(Boolean);
  }, [pinnedTagIds, supertags]);
  
  // 加载透视数据
  useEffect(() => {
    loadPerspectives();
  }, [loadPerspectives]);
  
  // 获取问候语
  const greeting = useMemo(() => getGreeting(), []);
  
  // 判断是否在今日日记页面
  const isTodayActive = useMemo(() => {
    if (navigationMode !== 'calendar') return false;
    const todayId = getTodayId();
    return hoistedNodeId === todayId;
  }, [navigationMode, hoistedNodeId]);
  
  // 处理点击今日笔记
  const handleGoToToday = useCallback(() => {
    setActiveTag(null);  // 清除透视激活状态
    goToCalendar();
  }, [goToCalendar, setActiveTag]);
  
  // 处理点击透视标签
  const handleSelectPerspective = useCallback((tagId: string) => {
    setActiveTag(tagId);
    setNavigationMode('perspective');
  }, [setActiveTag, setNavigationMode]);
  
  // 处理取消钉住透视
  const handleUnpinTag = useCallback((tagId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    unpinTag(tagId);
  }, [unpinTag]);
  
  // 处理创建新笔记本
  const handleCreateNotebook = useCallback(async () => {
    const newNotebookId = await createNotebook();
    if (newNotebookId) {
      // 创建后立即进入编辑状态
      setEditingNotebookId(newNotebookId);
      setEditingName('无标题笔记本');
    }
  }, [createNotebook]);
  
  // 处理选择笔记本
  const handleSelectNotebook = useCallback((notebookId: string) => {
    if (editingNotebookId === notebookId) return; // 编辑中不响应点击
    setActiveTag(null);  // 清除透视激活状态
    setActiveNotebook(notebookId);
  }, [setActiveNotebook, editingNotebookId, setActiveTag]);
  
  // 处理双击编辑笔记本名称
  const handleDoubleClick = useCallback((notebookId: string, currentName: string) => {
    setEditingNotebookId(notebookId);
    setEditingName(currentName);
  }, []);
  
  // 处理保存笔记本名称
  const handleSaveName = useCallback(() => {
    if (editingNotebookId && editingName.trim()) {
      updateNotebook(editingNotebookId, { name: editingName.trim() });
    }
    setEditingNotebookId(null);
    setEditingName('');
  }, [editingNotebookId, editingName, updateNotebook]);
  
  // 处理按键
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveName();
    } else if (e.key === 'Escape') {
      setEditingNotebookId(null);
      setEditingName('');
    }
  }, [handleSaveName]);
  
  // 自动聚焦输入框
  useEffect(() => {
    if (editingNotebookId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingNotebookId]);

  // 点击外部关闭右键菜单
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

  // 边界检测：调整菜单位置
  useLayoutEffect(() => {
    if (contextMenu && contextMenuRef.current) {
      const menuRect = contextMenuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const padding = 8;

      let adjustedX = contextMenu.x;
      let adjustedY = contextMenu.y;

      // 检查右侧边界
      if (contextMenu.x + menuRect.width + padding > viewportWidth) {
        adjustedX = Math.max(padding, viewportWidth - menuRect.width - padding);
      }

      // 检查底部边界
      if (contextMenu.y + menuRect.height + padding > viewportHeight) {
        adjustedY = Math.max(padding, viewportHeight - menuRect.height - padding);
      }

      setMenuPosition({ x: adjustedX, y: adjustedY });
      requestAnimationFrame(() => setIsMenuVisible(true));
    } else {
      setMenuPosition(null);
      setIsMenuVisible(false);
    }
  }, [contextMenu]);

  // 处理右键菜单
  const handleContextMenu = useCallback((e: React.MouseEvent, notebookId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsMenuVisible(false);
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      notebookId,
    });
  }, []);

  // 处理重命名
  const handleRename = useCallback(() => {
    if (contextMenu) {
      const notebook = notebooks[contextMenu.notebookId];
      if (notebook) {
        setEditingNotebookId(contextMenu.notebookId);
        setEditingName(notebook.name);
      }
      setContextMenu(null);
    }
  }, [contextMenu, notebooks]);

  // 处理删除笔记本
  const handleDeleteNotebook = useCallback(() => {
    if (contextMenu) {
      const notebook = notebooks[contextMenu.notebookId];
      if (notebook && confirm(`确定要删除笔记本"${notebook.name}"吗？此操作不可撤销。`)) {
        deleteNotebook(contextMenu.notebookId);
      }
      setContextMenu(null);
    }
  }, [contextMenu, notebooks, deleteNotebook]);

  return (
    <aside className={cn(
      "flex flex-col h-full bg-slate-50 dark:bg-slate-900 border-r border-gray-200 dark:border-gray-800",
      className
    )}>
      {/* 区域 A：用户状态 */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        {/* 用户状态 */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-md">
            <User size={20} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
              {greeting}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              欢迎回来
            </p>
          </div>
        </div>
      </div>
      
      {/* 区域 B：笔记本系统（包含每日笔记） */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            我的笔记本
          </h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                onClick={handleCreateNotebook}
              >
                <Plus size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">新建笔记本</TooltipContent>
          </Tooltip>
        </div>
        
        {/* 笔记本列表 */}
        <div className="overflow-y-auto px-2 pb-2">
          <div className="space-y-1">
            {/* 每日笔记 - 固定在列表第一位 */}
            <div
              onClick={handleGoToToday}
              className={cn(
                "group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all",
                navigationMode === 'calendar'
                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              )}
            >
              <Calendar size={16} className={cn(
                navigationMode === 'calendar' ? "text-green-600 dark:text-green-400" : "text-gray-400"
              )} />
              <span className="flex-1 text-sm">📅 每日笔记</span>
              {isTodayActive && (
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              )}
              {navigationMode === 'calendar' && !isTodayActive && (
                <ChevronRight size={14} className="text-green-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </div>
            
            {/* 分隔线 */}
            {notebookIds.length > 0 && (
              <div className="my-2 border-t border-gray-200 dark:border-gray-700" />
            )}
            
            {/* 其他笔记本 */}
            {notebookIds.map((notebookId) => {
              const notebook = notebooks[notebookId];
              if (!notebook) return null;
              
              const isActive = activeNotebookId === notebookId && navigationMode === 'notebook';
              const isEditing = editingNotebookId === notebookId;
              
              return (
                <div
                  key={notebookId}
                  onClick={() => handleSelectNotebook(notebookId)}
                  onDoubleClick={() => handleDoubleClick(notebookId, notebook.name)}
                  onContextMenu={(e) => handleContextMenu(e, notebookId)}
                  className={cn(
                    "group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all",
                    isActive
                      ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                  )}
                >
                  <Book size={16} className={cn(
                    isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-400"
                  )} />
                  
                  {isEditing ? (
                    <input
                      ref={inputRef}
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={handleSaveName}
                      onKeyDown={handleKeyDown}
                      className="flex-1 bg-white dark:bg-gray-800 px-2 py-0.5 text-sm rounded border border-blue-300 dark:border-blue-600 outline-none"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="flex-1 text-sm truncate">
                      {notebook.name}
                    </span>
                  )}
                  
                  {isActive && !isEditing && (
                    <ChevronRight size={14} className="text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
        
        {/* 透视区域 (Perspectives) */}
        {pinnedTags.length > 0 && (
          <>
            <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <Eye size={12} />
                👁️ 透视
              </h3>
            </div>
            <div className="overflow-y-auto px-2 pb-2">
              <div className="space-y-1">
                {pinnedTags.map((tag) => {
                  const isActive = navigationMode === 'perspective' && activeTagId === tag.id;
                  
                  return (
                    <div
                      key={tag.id}
                      onClick={() => handleSelectPerspective(tag.id)}
                      className={cn(
                        "group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all",
                        isActive
                          ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                      )}
                    >
                      <div 
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="flex-1 text-sm truncate">
                        #{tag.name}
                      </span>
                      
                      {/* 取消钉住按钮 */}
                      <button
                        onClick={(e) => handleUnpinTag(tag.id, e)}
                        className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity rounded"
                        title="取消钉住"
                      >
                        <PinOff size={12} />
                      </button>
                      
                      {isActive && (
                        <ChevronRight size={14} className="text-purple-400" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* 区域 C：底部工具 */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-800">
        {/* 全局搜索入口 */}
        <button
          onClick={onOpenCommandCenter}
          className="w-full flex items-center gap-2 px-3 py-2.5 mb-2 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 bg-gray-100 dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
        >
          <Search size={16} />
          <span className="flex-1 text-left">🔍 搜索笔记...</span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs text-gray-400 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
            <Command size={10} />
            <span>K</span>
          </kbd>
        </button>
        
        {/* 标签库入口 */}
        <button
          onClick={() => router.push('/library/tags')}
          className="w-full flex items-center gap-2 px-3 py-2 mb-2 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
        >
          <Hash size={16} />
          <span>🏷️ 标签库</span>
        </button>
        
        {/* AI 指令模板入口 */}
        <button
          onClick={() => setShowCommandManager(true)}
          className="w-full flex items-center gap-2 px-3 py-2 mb-2 text-sm text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
        >
          <Sparkles size={16} />
          <span>🤖 AI 指令</span>
          <kbd className="ml-auto hidden sm:inline-flex items-center px-1.5 py-0.5 text-xs text-gray-400 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
            /ai
          </kbd>
        </button>
        
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 justify-start text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                <Settings size={16} className="mr-2" />
                <span className="text-xs">设置</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">应用设置</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <Trash2 size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">回收站</TooltipContent>
          </Tooltip>
        </div>
      </div>
      
      {/* 右键菜单 */}
      {contextMenu && menuPosition && (
        <div
          ref={contextMenuRef}
          className={cn(
            "fixed z-[9999] min-w-[160px]",
            "bg-white dark:bg-gray-800",
            "border border-gray-200 dark:border-gray-700",
            "rounded-xl shadow-xl",
            "py-1.5 px-1",
            "backdrop-blur-sm bg-white/95 dark:bg-gray-800/95",
            "transition-all duration-150 ease-out",
            isMenuVisible 
              ? "opacity-100 scale-100 translate-y-0" 
              : "opacity-0 scale-95 -translate-y-1"
          )}
          style={{
            left: menuPosition.x,
            top: menuPosition.y,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08)',
          }}
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

      {/* AI 指令模板管理器 */}
      <CommandTemplateManager
        open={showCommandManager}
        onClose={() => setShowCommandManager(false)}
      />
    </aside>
  );
};

export default Sidebar;
