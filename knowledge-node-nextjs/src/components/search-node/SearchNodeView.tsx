/**
 * 搜索节点视图组件
 * v3.5: 移除内联节点创建功能，搜索节点仅作为动态查询视图
 * v3.5.1: 支持标签和字段的中文名称显示
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSearchNodeStore } from '@/stores/searchNodeStore';
import { useSupertagStore } from '@/stores/supertagStore';
import type { SearchConfig } from '@/types/search';
import QueryBuilderModal from './QueryBuilderModal';
import SearchResultList from './SearchResultList';
import { summarizeQuery } from './conditionUtils';

interface SearchNodeViewProps {
  nodeId: string;
  config?: SearchConfig;
  onUpdateConfig: (config: SearchConfig) => void;
  renderNode: (resultNodeId: string) => React.ReactNode;
}

// 稳定的空数组引用，避免每次 selector 返回新数组导致无限渲染
const EMPTY_ARRAY: string[] = [];

const SearchNodeView: React.FC<SearchNodeViewProps> = ({ nodeId, config, onUpdateConfig, renderNode }) => {
  const [openBuilder, setOpenBuilder] = useState(false);
  const executeSearch = useSearchNodeStore((state) => state.executeSearch);
  const refreshSearch = useSearchNodeStore((state) => state.refreshSearch);
  const resultNodeIds = useSearchNodeStore((state) => state.resultsBySearchNodeId[nodeId] ?? EMPTY_ARRAY);
  const loading = useSearchNodeStore((state) => !!state.loadingBySearchNodeId[nodeId]);
  const error = useSearchNodeStore((state) => state.errorBySearchNodeId[nodeId]);
  
  // 获取 supertags 用于解析中文名称
  const supertags = useSupertagStore((state) => state.supertags);

  useEffect(() => {
    if (config && config.conditions.length > 0) {
      executeSearch(nodeId, config);
    }
  }, [nodeId, config, executeSearch]);

  // 使用 supertags 解析中文名称的查询摘要
  const querySummary = useMemo(() => summarizeQuery(config, supertags), [config, supertags]);

  return (
    <div className="mt-1 rounded-xl border border-cyan-200 bg-gradient-to-r from-teal-50 via-cyan-50 to-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-teal-100 text-teal-700">
            <Search size={14} />
          </span>
          <div>
            <div className="text-[14px] font-semibold text-slate-800">{config?.label || '搜索节点'}</div>
            <div className="text-[12px] text-slate-500">{querySummary}</div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <span className="rounded bg-cyan-100 px-2 py-1 text-[10px] text-cyan-700">{resultNodeIds.length} 条</span>
          <Button variant="outline" size="sm" onClick={() => setOpenBuilder(true)}>编辑</Button>
          <Button variant="outline" size="sm" onClick={() => refreshSearch(nodeId, config)}>
            <RefreshCw size={14} />
          </Button>
        </div>
      </div>

      <SearchResultList
        nodeIds={resultNodeIds}
        loading={loading}
        error={error}
        renderNode={renderNode}
      />

      <QueryBuilderModal
        open={openBuilder}
        initialConfig={config}
        onClose={() => setOpenBuilder(false)}
        onSave={onUpdateConfig}
      />
    </div>
  );
};

export default SearchNodeView;
