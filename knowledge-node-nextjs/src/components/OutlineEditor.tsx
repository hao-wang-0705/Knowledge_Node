'use client';

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Calendar, CalendarDays, ChevronLeft, ChevronRight, Book, X, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNodeStore } from '@/stores/nodeStore';
import { useSupertagStore } from '@/stores/supertagStore';
import { useSyncStore } from '@/stores/syncStore';
import { useSearchNodeStore } from '@/stores/searchNodeStore';
import { useAuthErrorHandler } from '@/hooks/useAuthErrorHandler';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import NodeComponent from './NodeComponent';
import FieldEditor from './FieldEditor';
import { formatDate } from '@/utils/helpers';
import { getCalendarNodeType, getCalendarPath, getTodayId, parseDayId } from '@/utils/date-helpers';
import { findCalendarNodeActualId } from '@/utils/calendarNodeId';
import QuickInputNode from './QuickInputNode';
import { CaptureBar } from './capture';
import { getTagStyle } from '@/utils/tag-styles';
import { OfflineToast } from './OfflineToast';
import { useSyncCycleErrorToast } from '@/hooks/useSyncCycleErrorToast';
import MentionedBySection from '@/components/node/MentionedBySection';
import { Calendar as DayPickerCalendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

/**
 * 笔记编辑器主组件
 * 重构后仅包含笔记内容区域，顶导/侧导已移至 GlobalLayout
 */
const OutlineEditor: React.FC = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasInitialNavigated, setHasInitialNavigated] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitleValue, setEditingTitleValue] = useState('');
  
  // 初始化网络状态检测
  useNetworkStatus();
  useSyncCycleErrorToast();
  
  // 同步状态
  const pendingOperations = useSyncStore((state) => state.pendingOperations);
  const lastSyncAt = useSyncStore((state) => state.lastSyncAt);
  const nodes = useNodeStore((state) => state.nodes);
  const rootIds = useNodeStore((state) => state.rootIds);
  const hoistedNodeId = useNodeStore((state) => state.hoistedNodeId);
  const loadFromStorage = useNodeStore((state) => state.loadFromStorage);
  const addNode = useNodeStore((state) => state.addNode);
  const updateNode = useNodeStore((state) => state.updateNode);
  const goToToday = useNodeStore((state) => state.goToToday);
  const getNodePath = useNodeStore((state) => state.getNodePath);
  const navigateToNode = useNodeStore((state) => state.navigateToNode);
  
  const loadSupertagsFromAPI = useSupertagStore((state) => state.loadFromAPI);
  const supertags = useSupertagStore((state) => state.supertags);
  const getFieldDefinitions = useSupertagStore((state) => state.getFieldDefinitions);
  
  const isInDailyTree = useNodeStore((state) => state.isInDailyTree);

  // 搜索节点结果（用于搜索节点聚焦视图）
  const searchResultsById = useSearchNodeStore((state) => state.resultsBySearchNodeId);
  const executeSearch = useSearchNodeStore((state) => state.executeSearch);

  const { data: session } = useSession();
  const userRootId = useMemo(
    () => Object.values(nodes).find((n) => n.nodeRole === 'user_root')?.id ?? null,
    [nodes]
  );
  const userRootDisplayName = useMemo(() => {
    const user = session?.user;
    if (!user) return '全部笔记';
    return (user as { name?: string | null; email?: string | null }).name
      || (typeof (user as { email?: string }).email === 'string'
        ? (user as { email: string }).email.split('@')[0]
        : '我的笔记');
  }, [session?.user]);
  
  // 认证错误处理
  const { withAuthErrorHandler } = useAuthErrorHandler();

  // 初始化加载数据
  useEffect(() => {
    const initializeData = async () => {
      try {
        await withAuthErrorHandler(async () => {
          // 并行加载所有数据（从数据库 API）
          await Promise.all([
            loadSupertagsFromAPI(),
            loadFromStorage(), // nodeStore 内部已实现数据库同步（统一树，一次加载全部节点）
          ]);
        });
      } catch (error) {
        // 非认证错误在此记录
        console.error('[OutlineEditor] 初始化数据失败:', error);
      } finally {
        setIsInitialized(true);
      }
    };
    
    initializeData();
  }, [loadFromStorage, loadSupertagsFromAPI, withAuthErrorHandler]);

  // 数据加载后，仅在首次加载时自动跳转到今日节点
  useEffect(() => {
    if (isInitialized && Object.keys(nodes).length > 0 && !hasInitialNavigated) {
      void goToToday();
      setHasInitialNavigated(true);
    }
  }, [isInitialized, nodes, hasInitialNavigated, goToToday]);

  const hoistedNode = useMemo(() => {
    return hoistedNodeId ? nodes[hoistedNodeId] : null;
  }, [hoistedNodeId, nodes]);

  const isSearchNodeFocus = useMemo(
    () => !!hoistedNode && hoistedNode.type === 'search',
    [hoistedNode]
  );

  // 搜索节点聚焦时，自动执行一次搜索（有有效配置时）
  useEffect(() => {
    if (!hoistedNodeId || !isSearchNodeFocus || !hoistedNode) return;
    const config = hoistedNode.payload as import('@/types/search').SearchConfig | undefined;
    if (!config || !config.conditions || config.conditions.length === 0) return;
    void executeSearch(hoistedNodeId, config);
  }, [hoistedNodeId, isSearchNodeFocus, hoistedNode, executeSearch]);

  // 获取当前显示的节点 ID 列表
  // 普通节点：使用 hoisted 的子节点；搜索节点：使用搜索结果列表
  const displayedNodeIds = useMemo(() => {
    if (hoistedNodeId && isSearchNodeFocus) {
      return searchResultsById[hoistedNodeId] ?? [];
    }

    if (hoistedNodeId) {
      const current = nodes[hoistedNodeId];
      return current?.childrenIds ?? [];
    }

    return rootIds;
  }, [hoistedNodeId, isSearchNodeFocus, searchResultsById, nodes, rootIds]);

  const isCalendarView = useMemo(
    () => (hoistedNodeId ? isInDailyTree(hoistedNodeId) : false),
    [hoistedNodeId, isInDailyTree]
  );

  /** 有日笔记的日期 ID 列表（用于日历仅可点有笔记的日期） */
  const existingDayIds = useMemo(
    () => Object.keys(nodes).filter((id) => id.startsWith('day-')),
    [nodes]
  );

  /** 当前聚焦的日期（若在日笔记上） */
  const currentDayDate = useMemo(() => {
    if (!hoistedNodeId || getCalendarNodeType(hoistedNodeId) !== 'day') return null;
    return parseDayId(hoistedNodeId);
  }, [hoistedNodeId]);

  /** 有笔记的日期按日期倒序（用于前一天：找当前之前最近一天） */
  const existingDaysSortedDesc = useMemo(() => {
    const list = existingDayIds
      .map((dayId) => ({ dayId, date: parseDayId(dayId) }))
      .filter((x): x is { dayId: string; date: Date } => x.date !== null);
    list.sort((a, b) => b.date.getTime() - a.date.getTime());
    return list;
  }, [existingDayIds]);

  /** 是否存在早于当前聚焦日期的有笔记日期（用于前一天按钮是否可点） */
  const hasPrevDay = useMemo(() => {
    if (!currentDayDate) return false;
    const t = currentDayDate.getTime();
    return existingDaysSortedDesc.some((x) => x.date.getTime() < t);
  }, [currentDayDate, existingDaysSortedDesc]);

  /** 是否存在晚于当前聚焦日期的有笔记日期（用于后一天按钮置灰） */
  const hasNextDay = useMemo(() => {
    if (!currentDayDate) return false;
    const t = currentDayDate.getTime();
    return existingDaysSortedDesc.some((x) => x.date.getTime() > t);
  }, [currentDayDate, existingDaysSortedDesc]);

  const activeNotebookNodeId = useMemo(() => {
    if (!hoistedNodeId || !userRootId) return null;
    let cur: string | undefined = hoistedNodeId;
    while (cur && nodes[cur]?.parentId && nodes[cur].parentId !== userRootId) {
      cur = nodes[cur].parentId ?? undefined;
    }
    if (cur && nodes[cur]?.parentId === userRootId && nodes[cur]?.nodeRole !== 'daily_root')
      return cur;
    return null;
  }, [hoistedNodeId, userRootId, nodes]);

  // 面包屑导航路径（严格基于 parent 链，不做本地猜测修正）
  const breadcrumbPath = useMemo(() => {
    if (!hoistedNodeId) return [];
    return getNodePath(hoistedNodeId);
  }, [hoistedNodeId, getNodePath]);

  const hasBrokenCalendarChain = useMemo(() => {
    if (!hoistedNodeId) return false;
    const calendarType = getCalendarNodeType(hoistedNodeId);
    return calendarType !== null && !isInDailyTree(hoistedNodeId);
  }, [hoistedNodeId, isInDailyTree]);

  // 日历/笔记本面包屑展示文案（统一起点：用户昵称(全部笔记)）
  const breadcrumbLabel = useCallback(
    (node: { id: string; content: string; nodeRole?: string }) => {
      if (node.nodeRole === 'daily_root') return 'Daily notes';
      if (node.nodeRole === 'user_root') return `${userRootDisplayName}(全部笔记)`;
      return node.content;
    },
    [userRootDisplayName]
  );

  // 计算统计信息：仅统计用户内容节点（排除结构根与日历层级节点）
  const stats = useMemo(() => {
    const allEntries = Object.entries(nodes);
    const contentEntries = allEntries.filter(([id, n]) => {
      if (n.nodeRole === 'user_root' || n.nodeRole === 'daily_root')
        return false;
      if (getCalendarNodeType(id) !== null) return false;
      return true;
    });
    const nodeCount = contentEntries.length;
    const lastModified =
      contentEntries.length > 0
        ? Math.max(...contentEntries.map(([, n]) => n.createdAt), 0)
        : 0;
    return {
      nodeCount,
      lastModified: lastModified > 0 ? formatDate(lastModified) : '无',
    };
  }, [nodes]);

  // 待同步：按节点去重，显示"X 个节点待同步"
  const pendingNodeCount = useMemo(() => {
    const pending = pendingOperations.filter(
      (op) => (op.status === 'pending' || op.status === 'failed') && op.entityType === 'node'
    );
    const uniqueIds = new Set(pending.map((op) => op.entityId));
    return uniqueIds.size;
  }, [pendingOperations]);

  const handleAddNode = useCallback(() => {
    addNode(hoistedNodeId);
  }, [addNode, hoistedNodeId]);

  // 判断当前聚焦节点的日历类型
  const calendarNodeType = useMemo(() => {
    return hoistedNodeId ? getCalendarNodeType(hoistedNodeId) : null;
  }, [hoistedNodeId]);

  // 判断当前是否在"日"层级
  const isDayView = calendarNodeType === 'day';

  // 判断当前查看的日节点是否是今天
  const isToday = useMemo(() => {
    if (!isDayView || !hoistedNodeId) return false;
    const todayId = getTodayId();
    return hoistedNodeId === todayId;
  }, [isDayView, hoistedNodeId]);

  // 是否可以添加节点：
  // 普通节点：解锁所有层级的添加能力；搜索节点聚焦时禁止添加子节点
  const canAddNode = useMemo(() => {
    if (isSearchNodeFocus) return false;
    return true;
  }, [isSearchNodeFocus]);

  // 聚焦节点的标签列表
  const hoistedNodeTags = useMemo(() => {
    if (!hoistedNode) return [];
    return hoistedNode.tags.map(tagId => supertags[tagId]).filter(Boolean);
  }, [hoistedNode, supertags]);

  // 处理聚焦节点字段值更新
  const handleHoistedFieldChange = useCallback((fieldKey: string, value: any) => {
    if (!hoistedNodeId || !hoistedNode) return;
    const newFields = { ...hoistedNode.fields };
    if (value === '' || value === null || value === undefined) {
      delete newFields[fieldKey];
    } else {
      newFields[fieldKey] = value;
    }
    updateNode(hoistedNodeId, { fields: newFields });
  }, [hoistedNodeId, hoistedNode, updateNode]);

  // 移除聚焦节点的标签
  const handleRemoveHoistedTag = useCallback((tagId: string) => {
    if (!hoistedNodeId || !hoistedNode) return;
    updateNode(hoistedNodeId, {
      tags: hoistedNode.tags.filter(id => id !== tagId),
      fields: Object.fromEntries(
        Object.entries(hoistedNode.fields).filter(([key]) => {
          const tag = supertags[tagId];
          const defs = tag ? getFieldDefinitions(tag.id) ?? [] : [];
          return !defs.some(field => field.key === key);
        })
      )
    });
  }, [hoistedNodeId, hoistedNode, supertags, updateNode, getFieldDefinitions]);

  // 获取页面标题 - 聚焦模式下显示当前节点内容
  const pageTitle = useMemo(() => {
    // 如果有聚焦节点，显示聚焦节点的内容
    if (hoistedNode) {
      return hoistedNode.content || '无标题';
    }
    // 否则显示根视图
    return '全部笔记';
  }, [hoistedNode]);

  const notebookName = useMemo(() => {
    if (!activeNotebookNodeId) return null;
    const node = nodes[activeNotebookNodeId];
    return node?.content?.trim() || '无标题笔记本';
  }, [activeNotebookNodeId, nodes]);

  const notebookBreadcrumb = useMemo(() => {
    if (!activeNotebookNodeId || !hoistedNodeId) return [];
    const fullPath = getNodePath(hoistedNodeId);
    const rootIndex = fullPath.findIndex((n) => n.id === activeNotebookNodeId);
    if (rootIndex >= 0) return fullPath.slice(rootIndex);
    return fullPath;
  }, [activeNotebookNodeId, hoistedNodeId, getNodePath]);

  const unifiedBreadcrumbItems = useMemo(() => {
    const firstItem = userRootId
      ? { id: userRootId, label: `${userRootDisplayName}(全部笔记)`, isUserRoot: true as const }
      : null;

    if (isCalendarView) {
      const pathWithoutUserRoot = breadcrumbPath.filter((n) => n.nodeRole !== 'user_root');
      const rest = pathWithoutUserRoot.map((n) => ({
        id: n.id,
        label: breadcrumbLabel(n),
        isUserRoot: false as const,
      }));
      return firstItem ? [firstItem, ...rest] : rest;
    }

    if (activeNotebookNodeId && notebookBreadcrumb.length > 0) {
      const rest = notebookBreadcrumb.map((n) => ({
        id: n.id,
        label: n.content || '无标题',
        isUserRoot: false as const,
      }));
      return firstItem ? [firstItem, ...rest] : rest;
    }

    return firstItem ? [firstItem] : [];
  }, [
    userRootId,
    userRootDisplayName,
    isCalendarView,
    activeNotebookNodeId,
    breadcrumbPath,
    notebookBreadcrumb,
    breadcrumbLabel,
  ]);

  const handleTitleClick = useCallback(() => {
    if (activeNotebookNodeId && hoistedNodeId === activeNotebookNodeId) {
      setIsEditingTitle(true);
      setEditingTitleValue(pageTitle);
    }
  }, [activeNotebookNodeId, hoistedNodeId, pageTitle]);

  const handleSaveTitle = useCallback(() => {
    if (hoistedNodeId && activeNotebookNodeId === hoistedNodeId && editingTitleValue.trim()) {
      updateNode(hoistedNodeId, { content: editingTitleValue.trim() });
    }
    setIsEditingTitle(false);
  }, [hoistedNodeId, activeNotebookNodeId, editingTitleValue, updateNode]);

  /** 日期切换：前一天（跳转到当前之前最近一个有笔记的日期） */
  const handlePrevDay = useCallback(() => {
    if (!currentDayDate) return;
    const t = currentDayDate.getTime();
    const prevEntry = existingDaysSortedDesc.find((x) => x.date.getTime() < t);
    if (!prevEntry) return;
    const actualId = findCalendarNodeActualId(prevEntry.dayId, nodes);
    if (actualId) navigateToNode(actualId);
  }, [currentDayDate, existingDaysSortedDesc, nodes, navigateToNode]);

  /** 日期切换：后一天（跳转到当前之后最近一个有笔记的日期；无更晚日期时按钮已置灰） */
  const handleNextDay = useCallback(() => {
    if (!currentDayDate) return;
    const t = currentDayDate.getTime();
    // 倒序列表中新日期在前，取第一个严格大于当前日期的即为“之后最近一天”
    const nextEntry = [...existingDaysSortedDesc]
      .reverse()
      .find((x) => x.date.getTime() > t);
    if (!nextEntry) return;
    const actualId = findCalendarNodeActualId(nextEntry.dayId, nodes);
    if (actualId) navigateToNode(actualId);
  }, [currentDayDate, existingDaysSortedDesc, nodes, navigateToNode]);

  /** 日历选择日期（仅可点有笔记的日期） */
  const handleCalendarSelectDate = useCallback(
    (date: Date) => {
      const dayId = getCalendarPath(date).dayId;
      const actualId = findCalendarNodeActualId(dayId, nodes);
      if (actualId) navigateToNode(actualId);
    },
    [nodes, navigateToNode]
  );

  // 聚焦标题输入框
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  return (
    <>
      {/* 主内容区 */}
      <main className="flex-1 overflow-y-auto custom-scrollbar pb-32 text-[#555] dark:text-gray-400">
        <div
          className="w-full p-10 lg:px-20 xl:px-28"
          style={{ maxWidth: 'min(72%, 1400px)' }}
        >
          {/* 统一面包屑：用户昵称(全部笔记) > Daily notes / 笔记本 > 年/周/日 或 笔记n */}
          <div className="flex items-center gap-1 text-[13px] text-[#888] dark:text-gray-500 mb-8 flex-wrap">
            {unifiedBreadcrumbItems.map((item, index) => (
              <React.Fragment key={item.id}>
                {index > 0 && <ChevronRight size={14} className="text-[#ccc] dark:text-gray-500" />}
                {index === unifiedBreadcrumbItems.length - 1 ? (
                  <span className="text-[#111] dark:text-gray-100 font-medium flex items-center gap-1">
                    {activeNotebookNodeId && index > 0 && <Book size={14} />}
                    {item.label}
                  </span>
                ) : (
                  <button
                    onClick={() => navigateToNode(item.id)}
                    className={cn(
                      "hover:underline flex items-center gap-1 text-[#666] dark:text-gray-400 hover:text-[#111] dark:hover:text-gray-100",
                      item.isUserRoot && "hover:text-[var(--brand-primary)]"
                    )}
                  >
                    {activeNotebookNodeId && index === 1 && <Book size={14} />}
                    {item.label}
                  </button>
                )}
              </React.Fragment>
            ))}
            {unifiedBreadcrumbItems.length === 0 && activeNotebookNodeId && (
              <span className="text-[#111] dark:text-gray-100 font-medium flex items-center gap-1">
                <Book size={14} />
                {notebookName || '笔记本'}
              </span>
            )}
          </div>

          {/* 页面标题区域 */}
          <div className="mb-8">
            {isEditingTitle ? (
              <input
                ref={titleInputRef}
                type="text"
                value={editingTitleValue}
                onChange={(e) => setEditingTitleValue(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveTitle();
                  if (e.key === 'Escape') setIsEditingTitle(false);
                }}
                className="text-[34px] font-bold text-[#111] dark:text-gray-100 tracking-tight bg-transparent border-none outline-none w-full"
              />
            ) : (
              <h2 
                className={cn(
                  "text-[34px] font-bold text-[#111] dark:text-gray-100 tracking-tight mb-4",
                  activeNotebookNodeId && "cursor-text hover:bg-gray-100 dark:hover:bg-gray-800 rounded px-1 -mx-1"
                )}
                onClick={handleTitleClick}
              >
                {pageTitle}
              </h2>
            )}
            
            {/* 聚焦节点的超级标签徽章 */}
            {hoistedNodeTags.length > 0 && (
              <div className="flex items-center gap-2 mt-2 mb-3 flex-wrap">
                {hoistedNodeTags.map((tag) => {
                  // 使用统一的标签样式函数
                  const tagStyle = getTagStyle(tag);
                  return (
                    <div
                      key={tag.id}
                      className="group/tag relative inline-flex items-center"
                    >
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-1 text-sm font-medium rounded-md cursor-default select-none",
                          tagStyle.gradient,
                          tagStyle.text
                        )}
                      >
                        <span className="text-base">{tagStyle.icon}</span>
                        {tag.name}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveHoistedTag(tag.id);
                        }}
                        className="absolute -right-1 -top-1 w-4 h-4 flex items-center justify-center rounded-full bg-gray-400 hover:bg-red-500 text-white opacity-0 group-hover/tag:opacity-100 transition-opacity shadow-sm"
                        title={`移除 #${tag.name}`}
                      >
                        <X size={10} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            
            {/* 聚焦节点的表单字段 */}
            {hoistedNodeTags.length > 0 && hoistedNode && (
              <div className="bg-slate-50/80 border-l-2 border-blue-200 rounded-r-lg mb-4">
                <div className="py-2">
                  {hoistedNodeTags.map((tag) =>
                    (getFieldDefinitions(tag.id) ?? []).map((fieldDef) => (
                      <FieldEditor
                        key={fieldDef.id}
                        fieldDef={fieldDef}
                        value={hoistedNode.fields[fieldDef.key]}
                        onChange={(value) => handleHoistedFieldChange(fieldDef.key, value)}
                        nodeId={hoistedNodeId || undefined}
                        tagId={tag.id}
                      />
                    ))
                  )}
                </div>
              </div>
            )}

            {/* 日期切换栏：仅在日历视图（日笔记）显示 */}
            {isCalendarView && (
              <div className="flex items-center space-x-[2px] mb-8">
                <div className="flex items-center bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-md p-[2px] shadow-sm text-[13px]">
                  <button
                    type="button"
                    onClick={handlePrevDay}
                    disabled={!hasPrevDay}
                    className={cn(
                      'w-7 h-6 flex items-center justify-center rounded-[4px] transition-colors text-[#888] dark:text-gray-400',
                      hasPrevDay && 'hover:bg-gray-100 dark:hover:bg-gray-700',
                      !hasPrevDay && 'opacity-50 cursor-not-allowed'
                    )}
                    title="前一天"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2.5} />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextDay}
                    disabled={!hasNextDay}
                    className={cn(
                      'w-7 h-6 flex items-center justify-center rounded-[4px] transition-colors text-[#888] dark:text-gray-400',
                      hasNextDay && 'hover:bg-gray-100 dark:hover:bg-gray-700',
                      !hasNextDay && 'opacity-50 cursor-not-allowed'
                    )}
                    title="后一天"
                  >
                    <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} />
                  </button>
                  <div className="w-[1px] h-3 bg-gray-200 dark:bg-gray-600 mx-1" />
                  <button
                    type="button"
                    onClick={() => void goToToday()}
                    className="px-2.5 h-6 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[4px] transition-colors font-medium text-[#333] dark:text-gray-200"
                  >
                    Today
                  </button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          'w-7 h-6 flex items-center justify-center rounded-[4px] transition-colors ml-[2px]',
                          'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                        )}
                        title="打开日历"
                      >
                        <CalendarDays className="w-3.5 h-3.5" strokeWidth={2} />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <DayPickerCalendar
                        existingDayIds={existingDayIds}
                        selectedDate={currentDayDate}
                        onSelectDate={handleCalendarSelectDate}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}
            
            {/* 日历节点的特殊提示 - 仅在今天的日记页面展示 */}
            {isToday && (
              <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <p className="text-sm text-green-800 dark:text-green-200">
                  ✨ 这是今天的日记页面，开始记录您的想法吧！
                </p>
              </div>
            )}
          </div>

          {/* 节点列表 / 搜索结果列表 */}
          <div className="space-y-1">
            {displayedNodeIds.length > 0 ? (
              displayedNodeIds.map((nodeId) => (
                <NodeComponent
                  key={nodeId}
                  nodeId={nodeId}
                  depth={0}
                />
              ))
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  {isSearchNodeFocus ? (
                    <Search size={32} className="text-teal-400" />
                  ) : isCalendarView ? (
                    <Calendar size={32} className="text-green-400" />
                  ) : (
                    <Book size={32} className="text-blue-400" />
                  )}
                </div>
                <p className="text-[15px] text-[#333] dark:text-gray-300 mb-2">
                  {isSearchNodeFocus
                    ? '这里还没有搜索结果'
                    : hasBrokenCalendarChain
                      ? '检测到日历层级关系异常'
                      : (hoistedNodeId ? '这里还没有内容' : '暂无内容')}
                </p>
                <p className="text-[13px] text-[#888] dark:text-gray-500 mb-4">
                  {isSearchNodeFocus
                    ? '请检查搜索条件，或在其他页面修改搜索配置'
                    : hasBrokenCalendarChain
                      ? '请点击「今日笔记」触发结构初始化后重试'
                      : (canAddNode ? '点击下方按钮添加第一条内容' : '展开子节点查看更多内容')}
                </p>
                {canAddNode && (
                  <Button onClick={handleAddNode} variant="outline">
                    <Plus size={16} className="mr-2" />
                    开始记录
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* 圆点聚焦页：当前聚焦节点的“被提及节点”区域（默认收起） */}
          {hoistedNodeId && (
            <MentionedBySection
              targetNodeId={hoistedNodeId}
              className="mt-8"
            />
          )}

          {/* 末尾常驻空节点输入框 */}
          {canAddNode && (
            <QuickInputNode 
              parentId={hoistedNodeId} 
              placeholder="输入新笔记..."
            />
          )}
        </div>
      </main>

      {/* 底部状态栏 */}
      <footer className="h-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-gray-200/50 dark:border-gray-800/50 flex-shrink-0 relative z-50">
        <div className="h-full px-6 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-4">
            <span>共 {stats.nodeCount} 个节点</span>
            {pendingNodeCount > 0 && (
              <span className="text-amber-600 dark:text-amber-400">
                {pendingNodeCount} 个节点待同步
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span>
              最后同步: {lastSyncAt ? formatDate(lastSyncAt) : stats.lastModified}
            </span>
          </div>
        </div>
      </footer>

      {/* 离线提示 Toast */}
      <OfflineToast />

      {/* 底部多模态快速捕获栏 */}
      <CaptureBar />
    </>
  );
};

export default OutlineEditor;
