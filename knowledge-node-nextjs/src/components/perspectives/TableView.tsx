'use client';

import React, { useMemo, useCallback, useState } from 'react';
import { 
  Hash, ChevronRight, AlertCircle, Table2, Edit3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNodeStore } from '@/stores/nodeStore';
import { useSupertagStore } from '@/stores/supertagStore';
import { Node, Supertag, FieldDefinition } from '@/types';
import NodeDetailModal from '../NodeDetailModal';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

interface TableViewProps {
  tagId: string;
}

// 表格单元格组件
const TableCell: React.FC<{
  value: any;
  fieldDef: FieldDefinition;
}> = ({ value, fieldDef }) => {
  if (value === null || value === undefined || value === '') {
    return <span className="text-gray-300 dark:text-gray-600">-</span>;
  }
  
  // 根据字段类型渲染
  switch (fieldDef.type) {
    case 'date':
      return (
        <span className="text-gray-600 dark:text-gray-300">
          {String(value)}
        </span>
      );
      
    case 'select':
      return (
        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
          {String(value)}
        </span>
      );
      
    case 'number':
      return (
        <span className="text-gray-800 dark:text-gray-200 font-mono">
          {String(value)}
        </span>
      );
      
    default:
      return (
        <span className="text-gray-700 dark:text-gray-300 line-clamp-1">
          {String(value)}
        </span>
      );
  }
};

const TableView: React.FC<TableViewProps> = ({ tagId }) => {
  const nodes = useNodeStore((state) => state.nodes);
  const setHoistedNode = useNodeStore((state) => state.setHoistedNode);
  const supertags = useSupertagStore((state) => state.supertags);
  const getResolvedFieldDefinitions = useSupertagStore((state) => state.getResolvedFieldDefinitions);
  
  // 编辑弹窗状态
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  
  const tag = supertags[tagId];
  
  // 获取所有带有该标签的节点
  const getDescendantIds = useSupertagStore((s) => s.getDescendantIds);
  const taggedNodes = useMemo(() => {
    const ids = getDescendantIds(tagId);
    return Object.values(nodes)
      .filter(
        (node) =>
          (node.supertagId && ids.includes(node.supertagId)) ||
          node.tags.some((t) => ids.includes(t))
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [nodes, tagId, getDescendantIds]);
  
  // 获取字段定义（用于表头）
  const fieldDefinitions = useMemo(() => {
    if (!tag) return [];
    return getResolvedFieldDefinitions(tag.id) ?? [];
  }, [tag, getResolvedFieldDefinitions]);
  
  // 导航到节点
  const handleNavigate = useCallback((nodeId: string) => {
    setHoistedNode(nodeId);
  }, [setHoistedNode]);
  
  // 打开编辑弹窗
  const handleEdit = useCallback((nodeId: string) => {
    setEditingNodeId(nodeId);
  }, []);
  
  if (!tag) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <AlertCircle className="mr-2" />
        标签不存在
      </div>
    );
  }
  
  return (
    <TooltipProvider>
    <div className="h-full flex flex-col">
      {/* 标题 */}
      <div className="flex items-center gap-3 mb-6">
        <div 
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-bold shadow-lg"
          style={{ backgroundColor: tag.color }}
        >
          <Table2 size={20} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
            #{tag.name}
          </h2>
          <p className="text-sm text-gray-500">
            共 {taggedNodes.length} 条记录 · {fieldDefinitions.length} 个字段
          </p>
        </div>
      </div>
      
      {/* 表格 */}
      <div className="flex-1 overflow-auto">
        {taggedNodes.length > 0 ? (
          <div className="min-w-full">
            <table className="w-full border-collapse">
              {/* 表头 */}
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-8">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[200px]">
                    标题
                  </th>
                  {fieldDefinitions.map((fieldDef) => (
                    <th 
                      key={fieldDef.id}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[120px]"
                    >
                      <div className="inline-flex items-center gap-1.5">
                        <span>{fieldDef.name}</span>
                        {fieldDef.inherited && (
                          <span className="px-1.5 py-0.5 text-[10px] leading-none rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 normal-case">
                            继承
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">
                    操作
                  </th>
                </tr>
              </thead>
              
              {/* 表体 */}
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
                {taggedNodes.map((node, index) => (
                  <tr 
                    key={node.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                    onClick={() => handleEdit(node.id)}
                  >
                    {/* 序号 */}
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {index + 1}
                    </td>
                    
                    {/* 标题 */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-100 line-clamp-1">
                          {node.content || '无标题'}
                        </span>
                      </div>
                    </td>
                    
                    {/* 字段值 */}
                    {fieldDefinitions.map((fieldDef) => (
                      <td key={fieldDef.id} className="px-4 py-3">
                        <TableCell 
                          value={node.fields[fieldDef.key]} 
                          fieldDef={fieldDef}
                        />
                      </td>
                    ))}
                    
                    {/* 操作 */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(node.id);
                              }}
                              className="inline-flex items-center justify-center w-7 h-7 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                            >
                              <Edit3 size={14} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>编辑</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNavigate(node.id);
                              }}
                              className="inline-flex items-center justify-center w-7 h-7 text-gray-400 hover:text-green-500 hover:bg-green-50 rounded transition-colors"
                            >
                              <ChevronRight size={14} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>查看详情</TooltipContent>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            <Table2 size={48} className="mx-auto mb-3 opacity-50" />
            <p>暂无 #{tag.name} 记录</p>
            <p className="text-sm mt-1">添加带有此标签的节点后会显示在这里</p>
          </div>
        )}
      </div>
      
      {/* 节点详情编辑弹窗 */}
      <NodeDetailModal
        nodeId={editingNodeId}
        open={editingNodeId !== null}
        onOpenChange={(open) => !open && setEditingNodeId(null)}
      />
    </div>
    </TooltipProvider>
  );
};

export default TableView;
