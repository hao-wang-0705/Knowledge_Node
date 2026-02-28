'use client';

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { FileText, Calendar, ChevronRight, Book, X, Hash, Plus } from 'lucide-react';
import { UserMenu } from '@/components/UserMenu';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useNodeStore } from '@/stores/nodeStore';
import { useSupertagStore } from '@/stores/supertagStore';
import { useNotebookStore } from '@/stores/notebookStore';
import { useSyncStore } from '@/stores/syncStore';
import { useAuthErrorHandler } from '@/hooks/useAuthErrorHandler';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import NodeComponent from './NodeComponent';
import FieldEditor from './FieldEditor';
import Sidebar from './Sidebar';
import CommandCenter from './CommandCenter';
import { formatDate } from '@/utils/helpers';
import { getCalendarNodeType } from '@/utils/date-helpers';
import QuickInputNode from './QuickInputNode';
import { CaptureBar } from './capture';
import { getTagStyle } from '@/utils/tag-styles';
import { SplitPaneProvider } from './split-pane';
import { SyncStatusIndicator } from './SyncStatusIndicator';
import { OfflineToast } from './OfflineToast';

const OutlineEditor: React.FC = () => {
  const [showCommandCenter, setShowCommandCenter] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasInitialNavigated, setHasInitialNavigated] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitleValue, setEditingTitleValue] = useState('');
  
  // 初始化网络状态检测
  useNetworkStatus();
  
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
  const setHoistedNode = useNodeStore((state) => state.setHoistedNode);
  
  const loadSupertagsFromAPI = useSupertagStore((state) => state.loadFromAPI);
  const supertags = useSupertagStore((state) => state.supertags);
  const getResolvedFieldDefinitions = useSupertagStore((state) => state.getResolvedFieldDefinitions);
  const isSupertagsInitialized = useSupertagStore((state) => state.isInitialized);
  
  const navigationMode = useNotebookStore((state) => state.navigationMode);
  const activeNotebookId = useNotebookStore((state) => state.activeNotebookId);
  const notebooks = useNotebookStore((state) => state.notebooks);
  const loadNotebooksFromAPI = useNotebookStore((state) => state.loadFromAPI);
  const updateNotebook = useNotebookStore((state) => state.updateNotebook);
  
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
            loadFromStorage(), // nodeStore 内部已实现数据库同步
            loadNotebooksFromAPI(), // 笔记本从 API 加载
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
  }, [loadFromStorage, loadSupertagsFromAPI, loadNotebooksFromAPI, withAuthErrorHandler]);

  // 数据加载后，仅在首次加载时自动跳转到今日节点
  useEffect(() => {
    if (isInitialized && Object.keys(nodes).length > 0 && !hasInitialNavigated) {
      goToToday();
      setHasInitialNavigated(true);
    }
  }, [isInitialized, nodes, hasInitialNavigated, goToToday]);

  // 获取当前显示的节点 ID 列表
  const displayedNodeIds = useMemo(() => {
    if (hoistedNodeId) {
      const hoistedNode = nodes[hoistedNodeId];
      return hoistedNode ? hoistedNode.childrenIds : [];
    }
    return rootIds;
  }, [hoistedNodeId, nodes, rootIds]);

  // 获取当前 hoisted 节点
  const hoistedNode = useMemo(() => {
    return hoistedNodeId ? nodes[hoistedNodeId] : null;
  }, [hoistedNodeId, nodes]);

  // 面包屑导航路径
  const breadcrumbPath = useMemo(() => {
    if (!hoistedNodeId) return [];
    return getNodePath(hoistedNodeId);
  }, [hoistedNodeId, getNodePath]);

  // 计算统计信息
  const stats = useMemo(() => {
    const allNodes = Object.entries(nodes);
    const nodeCount = allNodes.length;
    const lastModified = allNodes.length > 0 
      ? Math.max(...allNodes.map(([, n]) => n.createdAt), 0)
      : 0;
    return {
      nodeCount,
      lastModified: lastModified > 0 ? formatDate(lastModified) : '无',
    };
  }, [nodes]);

  const handleAddNode = useCallback(() => {
    addNode(hoistedNodeId);
  }, [addNode, hoistedNodeId]);

  const handleGoToToday = useCallback(() => {
    goToToday();
  }, [goToToday]);

  // 判断当前是否在日历视图
  const isCalendarView = useMemo(() => {
    return navigationMode === 'calendar';
  }, [navigationMode]);

  // 判断当前聚焦节点的日历类型
  const calendarNodeType = useMemo(() => {
    return hoistedNodeId ? getCalendarNodeType(hoistedNodeId) : null;
  }, [hoistedNodeId]);

  // 判断当前是否在"日"层级
  const isDayView = calendarNodeType === 'day';

  // 是否可以添加节点：
  // 解锁所有层级的添加能力，包括年/月/周/日各层级
  const canAddNode = useMemo(() => {
    // 任何情况下都允许添加节点
    return true;
  }, []);

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
          const defs = tag ? getResolvedFieldDefinitions(tag.id) ?? [] : [];
          return !defs.some(field => field.key === key);
        })
      )
    });
  }, [hoistedNodeId, hoistedNode, supertags, updateNode, getResolvedFieldDefinitions]);

  // 获取页面标题 - 聚焦模式下显示当前节点内容
  const pageTitle = useMemo(() => {
    // 如果有聚焦节点，显示聚焦节点的内容
    if (hoistedNode) {
      return hoistedNode.content || '无标题';
    }
    // 否则显示根视图
    return '全部笔记';
  }, [hoistedNode]);

  // 获取当前笔记本名称（用于笔记本模式的面包屑）
  const notebookName = useMemo(() => {
    if (navigationMode !== 'notebook' || !activeNotebookId) return null;
    const notebook = notebooks[activeNotebookId];
    return notebook?.name || '无标题笔记本';
  }, [navigationMode, activeNotebookId, notebooks]);

  // 获取当前笔记本的面包屑路径（笔记本模式）
  const notebookBreadcrumb = useMemo(() => {
    if (navigationMode !== 'notebook' || !activeNotebookId) return [];
    const notebook = notebooks[activeNotebookId];
    if (!notebook) return [];
    
    // 获取完整路径
    const fullPath = getNodePath(hoistedNodeId || '');
    
    // 找到笔记本根节点的位置
    const rootIndex = fullPath.findIndex(n => n.id === notebook.rootNodeId);
    
    if (rootIndex >= 0) {
      // 返回根节点之后的路径（包括根节点）
      return fullPath.slice(rootIndex);
    }
    
    return fullPath;
  }, [navigationMode, activeNotebookId, notebooks, hoistedNodeId, getNodePath]);

  // 处理标题点击（进入编辑模式）
  const handleTitleClick = useCallback(() => {
    if (navigationMode === 'notebook' && activeNotebookId) {
      setIsEditingTitle(true);
      setEditingTitleValue(pageTitle);
    }
  }, [navigationMode, activeNotebookId, pageTitle]);

  // 保存标题
  const handleSaveTitle = useCallback(() => {
    if (activeNotebookId && editingTitleValue.trim()) {
      updateNotebook(activeNotebookId, { name: editingTitleValue.trim() });
    }
    setIsEditingTitle(false);
  }, [activeNotebookId, editingTitleValue, updateNotebook]);

  // 聚焦标题输入框
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  return (
    <TooltipProvider>
      <div className="h-screen flex bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
        {/* 左侧侧边栏 */}
        <Sidebar 
          className="w-64 flex-shrink-0" 
          onOpenCommandCenter={() => setShowCommandCenter(true)}
        />
        
        {/* 中间主视图 - 包含右侧面板 */}
        <SplitPaneProvider>
          {/* 顶部导航栏 */}
          <header className="h-14 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-800/50 flex-shrink-0">
            <div className="h-full px-6 flex items-center justify-between">
              {/* 左侧：Logo 和标题 */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <FileText size={18} className="text-white" />
                </div>
                <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                  知识节点
                </h1>
              </div>

              {/* 右侧：操作按钮和用户菜单 */}
              <div className="flex items-center gap-2">
                {/* 今日按钮 */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className={cn(
                        "hover:bg-green-50",
                        isCalendarView ? "text-green-600" : "text-gray-500 hover:text-green-600"
                      )}
                      onClick={handleGoToToday}
                    >
                      <Calendar size={18} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>今日日记</TooltipContent>
                </Tooltip>

                {/* 同步状态指示器 */}
                <SyncStatusIndicator />

                {/* 分隔线 */}
                <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1" />

                {/* 用户菜单 */}
                <UserMenu />
              </div>
            </div>
          </header>

          {/* 主内容区 */}
          <main className="flex-1 overflow-y-auto pb-32">
            <div className="max-w-3xl mx-auto px-6 py-8">
              {/* 面包屑导航 */}
              <div className="flex items-center gap-1 text-sm text-gray-500 mb-4 flex-wrap">
                {navigationMode === 'calendar' ? (
                  <>
                    {/* 日历模式面包屑：全部笔记 > 年 > 月 > 周 > 日 > 用户节点... */}
                    {hoistedNodeId ? (
                      <button
                        onClick={() => setHoistedNode(null)}
                        className="hover:text-blue-600 hover:underline"
                      >
                        全部笔记
                      </button>
                    ) : (
                      <span className="text-gray-800 font-medium">全部笔记</span>
                    )}
                    {breadcrumbPath.map((node, index) => (
                      <React.Fragment key={node.id}>
                        <ChevronRight size={14} className="text-gray-400" />
                        {index === breadcrumbPath.length - 1 ? (
                          <span className="text-gray-800 font-medium">{node.content}</span>
                        ) : (
                          <button
                            onClick={() => setHoistedNode(node.id)}
                            className="hover:text-blue-600 hover:underline"
                          >
                            {node.content}
                          </button>
                        )}
                      </React.Fragment>
                    ))}
                  </>
                ) : (
                  <>
                    {/* 笔记本模式面包屑：笔记本名称 > 子页面... */}
                    {notebookBreadcrumb.length > 0 ? (
                      notebookBreadcrumb.map((node, index) => (
                        <React.Fragment key={node.id}>
                          {index > 0 && <ChevronRight size={14} className="text-gray-400" />}
                          {index === notebookBreadcrumb.length - 1 ? (
                            <span className="text-gray-800 font-medium flex items-center gap-1">
                              {index === 0 && <Book size={14} />}
                              {node.content}
                            </span>
                          ) : (
                            <button
                              onClick={() => setHoistedNode(node.id)}
                              className="hover:text-blue-600 hover:underline flex items-center gap-1"
                            >
                              {index === 0 && <Book size={14} />}
                              {node.content}
                            </button>
                          )}
                        </React.Fragment>
                      ))
                    ) : (
                      <span className="text-gray-800 font-medium flex items-center gap-1">
                        <Book size={14} />
                        {notebookName || '笔记本'}
                      </span>
                    )}
                  </>
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
                    className="text-2xl font-bold text-gray-800 dark:text-gray-100 bg-transparent border-none outline-none w-full"
                  />
                ) : (
                  <h2 
                    className={cn(
                      "text-2xl font-bold text-gray-800 dark:text-gray-100 mb-1",
                      navigationMode === 'notebook' && "cursor-text hover:bg-gray-100 dark:hover:bg-gray-800 rounded px-1 -mx-1"
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
                        (getResolvedFieldDefinitions(tag.id) ?? []).map((fieldDef) => (
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
                
                {/* 日历节点的特殊提示 */}
                {isCalendarView && isDayView && (
                  <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <p className="text-sm text-green-800 dark:text-green-200">
                      ✨ 这是今天的日记页面，开始记录您的想法吧！
                    </p>
                  </div>
                )}
              </div>

              {/* 节点列表 */}
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
                      {isCalendarView ? (
                        <Calendar size={32} className="text-green-400" />
                      ) : (
                        <Book size={32} className="text-blue-400" />
                      )}
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 mb-2">
                      {hoistedNodeId ? '这里还没有内容' : '暂无内容'}
                    </p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">
                      {canAddNode 
                        ? '点击下方按钮添加第一条内容' 
                        : '展开子节点查看更多内容'}
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
                {pendingOperations.length > 0 && (
                  <span className="text-amber-600 dark:text-amber-400">
                    {pendingOperations.length} 个待同步
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

          {/* 底部多模态快速捕获栏 - 在中间主视图内部定位 */}
          <CaptureBar />
        </SplitPaneProvider>

        {/* 全局指令中心 */}
        <CommandCenter
          open={showCommandCenter}
          onOpenChange={setShowCommandCenter}
        />
      </div>
    </TooltipProvider>
  );
};

export default OutlineEditor;
