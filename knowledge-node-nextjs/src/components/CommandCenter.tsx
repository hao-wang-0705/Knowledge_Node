'use client';

import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { 
  Search, Calendar, FileText, Hash, Circle, 
  CheckSquare, Users, Lightbulb, AlertCircle,
  ChevronRight, Clock
} from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { useNodeStore } from '@/stores/nodeStore';
import { useSupertagStore } from '@/stores/supertagStore';
import { useNotebookStore } from '@/stores/notebookStore';
import { Node } from '@/types';
import { FIXED_TAG_IDS } from '@/utils/mockData';
import { SYSTEM_TAGS } from '@/utils/date-helpers';

interface CommandCenterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// 搜索结果项
interface SearchResultItem {
  id: string;
  content: string;
  tags: string[];
  breadcrumbs: string[];
  isContainer: boolean;  // 是否是容器节点（笔记本、日期节点等）
  score: number;         // 排序分数
}

// 获取标签图标
const getTagIcon = (tagId: string, size: number = 14) => {
  switch (tagId) {
    case FIXED_TAG_IDS.TASK:
      return <CheckSquare size={size} className="text-red-500" />;
    case FIXED_TAG_IDS.MEETING:
      return <Users size={size} className="text-blue-500" />;
    case FIXED_TAG_IDS.IDEA:
      return <Lightbulb size={size} className="text-yellow-500" />;
    case FIXED_TAG_IDS.PROBLEM:
      return <AlertCircle size={size} className="text-orange-500" />;
    case FIXED_TAG_IDS.DOC:
      return <FileText size={size} className="text-slate-500" />;
    case SYSTEM_TAGS.YEAR:
    case SYSTEM_TAGS.MONTH:
    case SYSTEM_TAGS.WEEK:
    case SYSTEM_TAGS.DAY:
      return <Calendar size={size} className="text-green-500" />;
    default:
      return <Hash size={size} className="text-gray-400" />;
  }
};

// 高亮搜索关键词
const HighlightedText: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  if (!query.trim()) return <span>{text}</span>;
  
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  const parts = text.split(regex);
  
  return (
    <span>
      {parts.map((part, index) => 
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 text-inherit rounded px-0.5">
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </span>
  );
};

const CommandCenter: React.FC<CommandCenterProps> = ({ open, onOpenChange }) => {
  const [query, setQuery] = useState('');
  
  const nodes = useNodeStore((state) => state.nodes);
  const setFocusedNode = useNodeStore((state) => state.setFocusedNode);
  const setHoistedNode = useNodeStore((state) => state.setHoistedNode);
  const getNodePath = useNodeStore((state) => state.getNodePath);
  
  const supertags = useSupertagStore((state) => state.supertags);
  const notebooks = useNotebookStore((state) => state.notebooks);
  const setActiveNotebook = useNotebookStore((state) => state.setActiveNotebook);
  const setNavigationMode = useNotebookStore((state) => state.setNavigationMode);
  
  // 清空搜索
  useEffect(() => {
    if (!open) {
      setQuery('');
    }
  }, [open]);
  
  // 全局键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K 切换弹窗
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
      // ESC 关闭弹窗
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        onOpenChange(false);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);
  
  // 获取节点的面包屑路径
  const getBreadcrumbs = useCallback((nodeId: string): string[] => {
    const path = getNodePath(nodeId);
    // 移除自身，只保留祖先路径
    const ancestors = path.slice(0, -1);
    return ancestors.map(node => {
      // 截断过长的内容
      const content = node.content || '未命名';
      return content.length > 20 ? content.slice(0, 20) + '...' : content;
    });
  }, [getNodePath]);
  
  // 检查是否是容器节点
  const isContainerNode = useCallback((node: Node): boolean => {
    // 日历节点
    if (node.tags.some(tagId => 
      [SYSTEM_TAGS.YEAR, SYSTEM_TAGS.MONTH, SYSTEM_TAGS.WEEK, SYSTEM_TAGS.DAY].includes(tagId as any)
    )) {
      return true;
    }
    // 笔记本根节点
    if (Object.values(notebooks).some(nb => nb.rootNodeId === node.id)) {
      return true;
    }
    return false;
  }, [notebooks]);
  
  // 计算搜索分数
  const calculateScore = useCallback((node: Node, searchQuery: string): number => {
    const content = node.content.toLowerCase();
    const q = searchQuery.toLowerCase();
    
    let score = 0;
    
    // 完全匹配加分
    if (content === q) {
      score += 100;
    }
    // 开头匹配加分
    else if (content.startsWith(q)) {
      score += 50;
    }
    // 包含匹配
    else if (content.includes(q)) {
      score += 25;
    }
    
    // 容器节点权重提升
    if (isContainerNode(node)) {
      score += 10;
    }
    
    // 有标签的节点权重提升
    if (node.tags.length > 0 && !node.tags.some(t => t.startsWith('sys_'))) {
      score += 5;
    }
    
    return score;
  }, [isContainerNode]);
  
  // 搜索结果
  const searchResults = useMemo((): SearchResultItem[] => {
    const allNodes = Object.values(nodes);
    
    if (!query.trim()) {
      // 默认显示最近的节点（按创建时间排序，取前10个有内容的）
      const recentNodes = allNodes
        .filter(node => node.content.trim())
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 10);
      
      return recentNodes.map(node => ({
        id: node.id,
        content: node.content,
        tags: node.tags,
        breadcrumbs: getBreadcrumbs(node.id),
        isContainer: isContainerNode(node),
        score: 0,
      }));
    }
    
    // 模糊搜索
    const q = query.toLowerCase();
    const matched = allNodes
      .filter(node => 
        node.content.toLowerCase().includes(q) && 
        node.content.trim()
      )
      .map(node => ({
        id: node.id,
        content: node.content,
        tags: node.tags,
        breadcrumbs: getBreadcrumbs(node.id),
        isContainer: isContainerNode(node),
        score: calculateScore(node, query),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);  // 最多显示20条
    
    return matched;
  }, [nodes, query, getBreadcrumbs, isContainerNode, calculateScore]);
  
  // 处理选择节点
  const handleSelect = useCallback((nodeId: string) => {
    const node = nodes[nodeId];
    if (!node) return;
    
    
    // 判断节点类型
    const isCalendarNode = node.tags.some(tagId => 
      [SYSTEM_TAGS.YEAR, SYSTEM_TAGS.MONTH, SYSTEM_TAGS.WEEK, SYSTEM_TAGS.DAY].includes(tagId as any)
    );
    
    // 查找节点所属的笔记本
    const belongsToNotebook = Object.values(notebooks).find(nb => {
      let currentNode: Node | null = node;
      while (currentNode) {
        if (currentNode.id === nb.rootNodeId) return true;
        currentNode = currentNode.parentId ? nodes[currentNode.parentId] : null;
      }
      return false;
    });
    
    // 查找节点所属的日历父节点（日节点）
    const findCalendarParent = (): string | null => {
      let currentNode: Node | null = node;
      while (currentNode) {
        if (currentNode.tags.includes(SYSTEM_TAGS.DAY)) {
          return currentNode.id;
        }
        currentNode = currentNode.parentId ? nodes[currentNode.parentId] : null;
      }
      return null;
    };
    
    if (isCalendarNode) {
      // 日历节点：直接跳转到该节点
      setNavigationMode('calendar');
      setHoistedNode(nodeId);
      setFocusedNode(nodeId);
    } else if (belongsToNotebook) {
      // 笔记本内的节点
      setActiveNotebook(belongsToNotebook.id);
      setNavigationMode('notebook');
      // 设置 hoisted 为笔记本根节点
      setHoistedNode(belongsToNotebook.rootNodeId);
      // 聚焦到目标节点
      setFocusedNode(nodeId);
    } else {
      // 其他节点：尝试找到日历父节点
      const calendarParent = findCalendarParent();
      setNavigationMode('calendar');
      if (calendarParent) {
        setHoistedNode(calendarParent);
      }
      setFocusedNode(nodeId);
    }
    
    // 关闭弹窗
    onOpenChange(false);
  }, [nodes, notebooks, setNavigationMode, setActiveNotebook, setHoistedNode, setFocusedNode, onOpenChange]);
  
  // 获取节点显示图标
  const getNodeIcon = useCallback((item: SearchResultItem) => {
    // 优先显示用户标签图标
    const userTag = item.tags.find(tagId => !tagId.startsWith('sys_'));
    if (userTag) {
      return getTagIcon(userTag);
    }
    // 日历节点
    const systemTag = item.tags.find(tagId => tagId.startsWith('sys_'));
    if (systemTag) {
      return getTagIcon(systemTag);
    }
    // 默认圆点
    return <Circle size={14} className="text-gray-400 fill-gray-400" />;
  }, []);
  
  return (
    <>
      {/* 遮罩层 */}
      {open && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          onClick={() => onOpenChange(false)}
        />
      )}
      
      {/* 指令中心弹窗 */}
      {open && (
        <div className="fixed left-1/2 top-1/4 z-50 w-[600px] max-w-[90vw] -translate-x-1/2 transform">
          <Command
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl overflow-hidden"
          >
            {/* 搜索输入框 */}
            <div className="flex items-center border-b border-gray-200 dark:border-gray-700 px-4">
              <Search className="mr-3 h-5 w-5 shrink-0 text-gray-400" />
              <input
                className="flex h-14 w-full bg-transparent py-4 text-base outline-none placeholder:text-gray-400 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="搜索笔记、任务、会议..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
              <kbd className="hidden sm:inline-flex h-6 items-center gap-1 rounded border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 px-2 text-xs text-gray-500">
                ESC
              </kbd>
            </div>
            
            {/* 搜索结果列表 */}
            <CommandList className="max-h-[400px] overflow-y-auto p-2">
              {searchResults.length === 0 && query && (
                <CommandEmpty className="py-12 text-center">
                  <Search className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600 mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">未找到匹配的节点</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                    尝试使用其他关键词搜索
                  </p>
                </CommandEmpty>
              )}
              
              {searchResults.length > 0 && (
                <CommandGroup 
                  heading={query ? `搜索结果 (${searchResults.length})` : '最近访问'}
                  className="px-1"
                >
                  {searchResults.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={item.id}
                      onSelect={() => handleSelect(item.id)}
                      className="flex items-start gap-3 px-3 py-3 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 data-[selected=true]:bg-blue-50 dark:data-[selected=true]:bg-blue-900/30 transition-colors"
                    >
                      {/* 左侧图标 */}
                      <div className="flex-shrink-0 mt-0.5">
                        {getNodeIcon(item)}
                      </div>
                      
                      {/* 主内容 */}
                      <div className="flex-1 min-w-0">
                        {/* 标签徽章 */}
                        {item.tags.filter(t => !t.startsWith('sys_')).length > 0 && (
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            {item.tags
                              .filter(t => !t.startsWith('sys_'))
                              .slice(0, 2)
                              .map(tagId => {
                                const tag = supertags[tagId];
                                if (!tag) return null;
                                return (
                                  <span
                                    key={tagId}
                                    className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium"
                                    style={{ 
                                      backgroundColor: `${tag.color}20`,
                                      color: tag.color 
                                    }}
                                  >
                                    #{tag.name}
                                  </span>
                                );
                              })}
                          </div>
                        )}
                        
                        {/* 主标题 */}
                        <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                          <HighlightedText text={item.content} query={query} />
                        </div>
                        
                        {/* 面包屑路径 */}
                        {item.breadcrumbs.length > 0 && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-gray-400 dark:text-gray-500 truncate">
                            {item.breadcrumbs.map((crumb, index) => (
                              <React.Fragment key={index}>
                                {index > 0 && <ChevronRight size={10} className="flex-shrink-0" />}
                                <span className="truncate max-w-[100px]">{crumb}</span>
                              </React.Fragment>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      {/* 右侧提示 */}
                      <div className="flex-shrink-0 text-xs text-gray-400 dark:text-gray-500">
                        <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500">
                          ↵
                        </kbd>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
            
            {/* 底部快捷键提示 */}
            <div className="flex flex-col gap-2 border-t border-gray-200 dark:border-gray-700 px-4 py-2.5 text-xs text-gray-400">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800">↑</kbd>
                    <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800">↓</kbd>
                    <span className="ml-1">导航</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800">↵</kbd>
                    <span className="ml-1">跳转</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800">esc</kbd>
                    <span className="ml-1">关闭</span>
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock size={12} />
                  <span>手不离键盘，直达任意节点</span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-gray-500 dark:text-gray-500">
                <span><kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800">⌘K</kbd> 打开</span>
                <span><kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800">/</kbd> 块级命令</span>
                <span><kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800">#</kbd> 标签</span>
                <span><kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800">@</kbd> 引用</span>
                <span><kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800">⌘Z</kbd> 撤销</span>
                <span><kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800">⌘⇧Z</kbd> 重做</span>
                <span><kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800">Tab</kbd> 缩进</span>
                <span><kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800">Enter</kbd> 新建</span>
              </div>
            </div>
          </Command>
        </div>
      )}
    </>
  );
};

export default CommandCenter;
