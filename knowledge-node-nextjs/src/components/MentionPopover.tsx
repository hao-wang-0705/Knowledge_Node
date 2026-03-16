'use client';

import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { 
  Search, Calendar, FileText, Hash, Circle, 
  CheckSquare, Users, Lightbulb, AlertCircle,
  ChevronRight, AtSign
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNodeStore } from '@/stores/nodeStore';
import { useSupertagStore } from '@/stores/supertagStore';
import { Node } from '@/types';
import { FIXED_TAG_IDS } from '@/utils/mockData';
import { SYSTEM_TAGS } from '@/utils/date-helpers';
import { isReferenceableNode } from '@/utils/reference-helpers';

interface MentionPopoverProps {
  open: boolean;
  onClose: () => void;
  onSelect: (nodeId: string, nodeTitle: string) => void;
  position: { x: number; y: number };
  excludeNodeId?: string; // 排除当前节点（不能引用自己）
}

// 搜索结果项
interface SearchResultItem {
  id: string;
  content: string;
  tags: string[];
  breadcrumbs: string[];
  isContainer: boolean;
  score: number;
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

const MentionPopover: React.FC<MentionPopoverProps> = ({ 
  open, 
  onClose, 
  onSelect, 
  position,
  excludeNodeId
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  
  const nodes = useNodeStore((state) => state.nodes);
  const getNodePath = useNodeStore((state) => state.getNodePath);
  const getSidebarEntries = useNodeStore((state) => state.getSidebarEntries);
  const supertags = useSupertagStore((state) => state.supertags);

  // 重置状态
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);
  
  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as globalThis.Node)) {
        onClose();
      }
    };
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, onClose]);
  
  // 获取节点的面包屑路径
  const getBreadcrumbs = useCallback((nodeId: string): string[] => {
    const path = getNodePath(nodeId);
    const ancestors = path.slice(0, -1);
    return ancestors.map(node => {
      const content = node.content || '未命名';
      return content.length > 15 ? content.slice(0, 15) + '...' : content;
    }).slice(-3); // 只取最后3层
  }, [getNodePath]);
  
  // 检查是否是容器节点
  const sidebarEntryIds = useMemo(() => new Set(getSidebarEntries()), [getSidebarEntries, nodes]);
  const isContainerNode = useCallback((node: Node): boolean => {
    if (node.tags?.some((tagId) =>
      [SYSTEM_TAGS.YEAR, SYSTEM_TAGS.MONTH, SYSTEM_TAGS.WEEK, SYSTEM_TAGS.DAY].includes(tagId as never)
    )) {
      return true;
    }
    if (sidebarEntryIds.has(node.id)) return true;
    return false;
  }, [sidebarEntryIds]);
  
  // 计算搜索分数
  const calculateScore = useCallback((node: Node, searchQuery: string): number => {
    const content = node.content.toLowerCase();
    const q = searchQuery.toLowerCase();
    
    let score = 0;
    
    if (content === q) {
      score += 100;
    } else if (content.startsWith(q)) {
      score += 50;
    } else if (content.includes(q)) {
      score += 25;
    }
    
    if (isContainerNode(node)) {
      score += 10;
    }
    
    if (node.tags.length > 0 && !node.tags.some(t => t.startsWith('sys_'))) {
      score += 5;
    }
    
    return score;
  }, [isContainerNode]);
  
  // 搜索结果（与引用字段统一：仅展示可引用节点，屏蔽根/日历/无内容等）
  const searchResults = useMemo((): SearchResultItem[] => {
    const allNodes = Object.values(nodes).filter((n) =>
      isReferenceableNode(n, { excludeNodeId })
    );

    if (!query.trim()) {
      // 默认显示最近的节点
      const recentNodes = allNodes
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 8);
      
      return recentNodes.map(node => ({
        id: node.id,
        content: node.content,
        tags: node.tags,
        breadcrumbs: getBreadcrumbs(node.id),
        isContainer: isContainerNode(node),
        score: 0,
      }));
    }
    
    // 模糊搜索（allNodes 已由 isReferenceableNode 过滤，含内容非空）
    const q = query.toLowerCase();
    const matched = allNodes
      .filter((node) => node.content.toLowerCase().includes(q))
      .map(node => ({
        id: node.id,
        content: node.content,
        tags: node.tags,
        breadcrumbs: getBreadcrumbs(node.id),
        isContainer: isContainerNode(node),
        score: calculateScore(node, query),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    
    return matched;
  }, [nodes, query, excludeNodeId, getBreadcrumbs, isContainerNode, calculateScore]);
  
  // 重置选中索引
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchResults.length]);
  
  // 滚动到选中项
  useEffect(() => {
    if (listRef.current) {
      const selectedItem = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);
  
  // 键盘导航
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, searchResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResults[selectedIndex]) {
        const item = searchResults[selectedIndex];
        onSelect(item.id, item.content);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }, [searchResults, selectedIndex, onSelect, onClose]);
  
  // 获取节点显示图标
  const getNodeIcon = useCallback((item: SearchResultItem) => {
    const userTag = item.tags.find(tagId => !tagId.startsWith('sys_'));
    if (userTag) {
      return getTagIcon(userTag);
    }
    const systemTag = item.tags.find(tagId => tagId.startsWith('sys_'));
    if (systemTag) {
      return getTagIcon(systemTag);
    }
    return <Circle size={14} className="text-gray-400 fill-gray-400" />;
  }, []);
  
  // 计算弹窗位置（确保不超出视窗）
  const adjustedPosition = useMemo(() => {
    const popoverWidth = 320;
    const popoverHeight = 360;
    
    let x = position.x;
    let y = position.y;
    
    // 确保不超出右边界
    if (x + popoverWidth > window.innerWidth - 20) {
      x = window.innerWidth - popoverWidth - 20;
    }
    
    // 确保不超出底部边界
    if (y + popoverHeight > window.innerHeight - 20) {
      y = position.y - popoverHeight - 30; // 显示在上方
    }
    
    return { x: Math.max(10, x), y: Math.max(10, y) };
  }, [position]);
  
  if (!open) return null;
  
  return (
    <div
      ref={popoverRef}
      data-editing-popover
      className="fixed z-[100] w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl overflow-hidden"
      style={{ 
        left: adjustedPosition.x, 
        top: adjustedPosition.y,
      }}
    >
      {/* 标题栏 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <AtSign size={16} className="text-blue-500" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">插入引用</span>
      </div>
      
      {/* 搜索输入框 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <Search size={14} className="text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          placeholder="搜索节点..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 text-sm bg-transparent outline-none placeholder:text-gray-400"
        />
      </div>
      
      {/* 搜索结果列表 */}
      <div ref={listRef} className="max-h-[280px] overflow-y-auto py-1">
        {searchResults.length === 0 ? (
          <div className="py-8 text-center text-gray-400 dark:text-gray-500">
            <Search size={24} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">未找到匹配的节点</p>
          </div>
        ) : (
          <>
            <div className="px-3 py-1 text-xs text-gray-400 dark:text-gray-500">
              {query ? `搜索结果 (${searchResults.length})` : '最近节点'}
            </div>
            {searchResults.map((item, index) => (
              <button
                key={item.id}
                onClick={() => onSelect(item.id, item.content)}
                className={cn(
                  "w-full flex items-start gap-2 px-3 py-2 text-left transition-colors",
                  index === selectedIndex 
                    ? "bg-blue-50 dark:bg-blue-900/30" 
                    : "hover:bg-gray-50 dark:hover:bg-gray-800"
                )}
              >
                {/* 图标 */}
                <div className="flex-shrink-0 mt-0.5">
                  {getNodeIcon(item)}
                </div>
                
                {/* 内容 */}
                <div className="flex-1 min-w-0">
                  {/* 标签徽章 */}
                  {item.tags.filter(t => !t.startsWith('sys_')).length > 0 && (
                    <div className="flex items-center gap-1 mb-0.5">
                      {item.tags
                        .filter(t => !t.startsWith('sys_'))
                        .slice(0, 1)
                        .map(tagId => {
                          const tag = supertags[tagId];
                          if (!tag) return null;
                          return (
                            <span
                              key={tagId}
                              className="inline-flex items-center px-1 py-0.5 rounded text-[10px] font-medium"
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
                  
                  {/* 标题 */}
                  <div className="text-sm text-gray-800 dark:text-gray-200 truncate">
                    <HighlightedText 
                      text={item.content.length > 40 ? item.content.slice(0, 40) + '...' : item.content} 
                      query={query} 
                    />
                  </div>
                  
                  {/* 面包屑 */}
                  {item.breadcrumbs.length > 0 && (
                    <div className="flex items-center gap-0.5 mt-0.5 text-[10px] text-gray-400 dark:text-gray-500 truncate">
                      {item.breadcrumbs.map((crumb, idx) => (
                        <React.Fragment key={idx}>
                          {idx > 0 && <ChevronRight size={8} />}
                          <span className="truncate">{crumb}</span>
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </>
        )}
      </div>
      
      {/* 底部提示 */}
      <div className="flex items-center gap-3 px-3 py-2 text-[10px] text-gray-400 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-700">↑↓</kbd>
          <span>选择</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-700">↵</kbd>
          <span>确认</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-700">Esc</kbd>
          <span>取消</span>
        </span>
      </div>
    </div>
  );
};

export default MentionPopover;
