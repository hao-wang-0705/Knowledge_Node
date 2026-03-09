'use client';

import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Search, RefreshCw, Trash2, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNodeStore } from '@/stores/nodeStore';
import { useQueryPanelStore } from '@/stores/queryPanelStore';
import { useSearchNodeStore } from '@/stores/searchNodeStore';
import { useSupertagStore } from '@/stores/supertagStore';
import type { SearchConfig } from '@/types/search';
import QueryBuilderModal from '@/components/search-node/QueryBuilderModal';
import { summarizeQuery } from '@/components/search-node/conditionUtils';
import { cn } from '@/lib/utils';

interface SearchNodeCardProps {
  /** 搜索节点 ID */
  nodeId: string;
  /** 渲染搜索结果节点的函数 */
  renderResultNode: (nodeId: string) => React.ReactNode;
}

// 稳定的空数组引用
const EMPTY_ARRAY: string[] = [];

/**
 * 搜索节点卡片组件
 * v3.6: 用于智能查询面板，复用搜索节点核心功能
 */
const SearchNodeCard: React.FC<SearchNodeCardProps> = memo(({ nodeId, renderResultNode }) => {
  const [openBuilder, setOpenBuilder] = useState(false);
  
  // 从 nodeStore 获取节点数据
  const node = useNodeStore((state) => state.nodes[nodeId]);
  const updateNode = useNodeStore((state) => state.updateNode);
  const removeSearchNode = useQueryPanelStore((state) => state.removeSearchNode);
  
  // 搜索相关状态
  const executeSearch = useSearchNodeStore((state) => state.executeSearch);
  const refreshSearch = useSearchNodeStore((state) => state.refreshSearch);
  const resultNodeIds = useSearchNodeStore((state) => state.resultsBySearchNodeId[nodeId] ?? EMPTY_ARRAY);
  const loading = useSearchNodeStore((state) => !!state.loadingBySearchNodeId[nodeId]);
  const error = useSearchNodeStore((state) => state.errorBySearchNodeId[nodeId]);
  
  // 获取 supertags 用于解析中文名称
  const supertags = useSupertagStore((state) => state.supertags);

  // 提取搜索配置
  const config = useMemo(() => {
    if (!node || node.type !== 'search') return undefined;
    return node.payload as SearchConfig | undefined;
  }, [node]);

  // 执行搜索
  useEffect(() => {
    if (config && config.conditions.length > 0) {
      executeSearch(nodeId, config);
    }
  }, [nodeId, config, executeSearch]);

  // 查询摘要
  const querySummary = useMemo(() => summarizeQuery(config, supertags), [config, supertags]);

  // 更新搜索配置
  const handleUpdateConfig = useCallback((newConfig: SearchConfig) => {
    updateNode(nodeId, { payload: newConfig, content: newConfig.label || '🔎 搜索节点' });
    setOpenBuilder(false);
  }, [nodeId, updateNode]);

  // 删除搜索节点
  const handleDelete = useCallback(() => {
    removeSearchNode(nodeId);
  }, [nodeId, removeSearchNode]);

  // 刷新搜索
  const handleRefresh = useCallback(() => {
    refreshSearch(nodeId, config);
  }, [nodeId, config, refreshSearch]);

  if (!node) return null;

  const label = config?.label || node.content || '搜索节点';
  const hasConditions = config && config.conditions.length > 0;

  return (
    <div className={cn(
      'flex-1 min-h-[120px] rounded-xl border',
      'border-cyan-200 dark:border-cyan-800',
      'bg-gradient-to-r from-teal-50 via-cyan-50 to-white',
      'dark:from-slate-800 dark:via-slate-800 dark:to-slate-900',
      'p-3 shadow-sm',
      'flex flex-col'
    )}>
      {/* 头部 */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-md bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300">
            <Search size={14} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold text-slate-800 dark:text-slate-200 truncate">
              {label}
            </div>
            <div className="text-[12px] text-slate-500 dark:text-slate-400 truncate">
              {hasConditions ? querySummary : '点击设置配置查询条件'}
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="rounded bg-cyan-100 dark:bg-cyan-900 px-2 py-1 text-[10px] text-cyan-700 dark:text-cyan-300">
            {resultNodeIds.length} 条
          </span>
          <Button 
            variant="ghost" 
            size="icon-sm" 
            onClick={() => setOpenBuilder(true)}
            title="编辑查询条件"
          >
            <Settings size={14} />
          </Button>
          <Button 
            variant="ghost" 
            size="icon-sm" 
            onClick={handleRefresh}
            disabled={loading || !hasConditions}
            title="刷新搜索"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </Button>
          <Button 
            variant="ghost" 
            size="icon-sm" 
            onClick={handleDelete}
            className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            title="删除搜索节点"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      {/* 搜索结果 - 使用 NodeComponent 展示完整节点树 */}
      <div className="flex-1 overflow-auto min-h-0 max-h-[400px]">
        {error ? (
          <div className="text-sm text-red-500 p-2">{error}</div>
        ) : loading ? (
          <div className="text-sm text-slate-400 p-2">搜索中...</div>
        ) : !hasConditions ? (
          <div className="text-sm text-slate-400 p-2 text-center">
            请先配置查询条件
          </div>
        ) : resultNodeIds.length === 0 ? (
          <div className="text-sm text-slate-400 p-2 text-center">
            无匹配结果
          </div>
        ) : (
          <div className="query-panel-compact space-y-0.5">
            {resultNodeIds.slice(0, 20).map((resultId) => renderResultNode(resultId))}
            {resultNodeIds.length > 20 && (
              <div className="text-xs text-slate-400 text-center py-2 border-t border-slate-200 dark:border-slate-700 mt-2">
                还有 {resultNodeIds.length - 20} 条结果...
              </div>
            )}
          </div>
        )}
      </div>

      {/* 查询配置弹窗 */}
      <QueryBuilderModal
        open={openBuilder}
        initialConfig={config}
        onClose={() => setOpenBuilder(false)}
        onSave={handleUpdateConfig}
      />
    </div>
  );
});

SearchNodeCard.displayName = 'SearchNodeCard';

export default SearchNodeCard;
