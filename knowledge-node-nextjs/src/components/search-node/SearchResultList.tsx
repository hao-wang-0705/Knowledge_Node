import React from 'react';

interface SearchResultListProps {
  nodeIds: string[];
  loading: boolean;
  error?: string | null;
  renderNode: (nodeId: string) => React.ReactNode;
}

const SearchResultList: React.FC<SearchResultListProps> = ({ nodeIds, loading, error, renderNode }) => {
  if (loading) {
    return <div className="py-4 text-xs text-slate-500">正在加载搜索结果...</div>;
  }

  if (error) {
    return <div className="py-4 text-xs text-red-500">{error}</div>;
  }

  if (nodeIds.length === 0) {
    return <div className="py-4 text-xs text-slate-400">暂无匹配节点</div>;
  }

  return <div className="space-y-1">{nodeIds.map((nodeId) => renderNode(nodeId))}</div>;
};

export default SearchResultList;
