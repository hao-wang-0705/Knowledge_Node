'use client';

import React, { useMemo, useCallback, useState } from 'react';
import { 
  Hash, ChevronRight, AlertCircle, Star, FileText, Lightbulb,
  AlertTriangle, LayoutGrid, Circle, Edit3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNodeStore } from '@/stores/nodeStore';
import { useSupertagStore } from '@/stores/supertagStore';
import { usePerspectiveStore } from '@/stores/perspectiveStore';
import { Node, Supertag, FieldDefinition } from '@/types';
import { FIXED_TAG_IDS } from '@/utils/mockData';
import NodeDetailModal from '../NodeDetailModal';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { getTagStyle } from '@/utils/tag-styles';

interface CardViewProps {
  tagId: string;
}

// 获取卡片图标
const getCardIcon = (tagId: string) => {
  switch (tagId) {
    case FIXED_TAG_IDS.IDEA:
      return Lightbulb;
    case FIXED_TAG_IDS.PROBLEM:
      return AlertTriangle;
    case FIXED_TAG_IDS.DOC:
      return FileText;
    default:
      return Hash;
  }
};

// 卡片组件
const Card: React.FC<{
  node: Node;
  tag: Supertag;
  fieldDefinitions: FieldDefinition[];
  onNavigate: () => void;
  onFocus: () => void;  // 聚焦视图回调
  onEdit: () => void;   // 编辑回调
}> = ({ node, tag, fieldDefinitions, onNavigate, onFocus, onEdit }) => {
  const CardIcon = getCardIcon(tag.id);
  
  // 根据标签类型渲染不同的字段信息
  const renderFields = () => {
    const fields = node.fields;
    
    // 创意卡片
    if (tag.id === FIXED_TAG_IDS.IDEA) {
      const confidence = fields.confidence as string | undefined;
      const difficulty = fields.difficulty as string | undefined;
      const status = fields.status as string | undefined;
      
      return (
        <div className="space-y-2">
          {/* 信心指数（星星） */}
          {confidence && (
            <div className="flex items-center gap-1">
              <Star size={12} className="text-yellow-500" />
              <span className="text-xs text-yellow-600 dark:text-yellow-400">
                {confidence}
              </span>
            </div>
          )}
          
          <div className="flex items-center gap-2 flex-wrap">
            {/* 难度 */}
            {difficulty && (
              <span className={cn(
                "text-xs px-1.5 py-0.5 rounded",
                difficulty === '困难' && "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
                difficulty === '中等' && "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
                difficulty === '简单' && "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
              )}>
                {difficulty}
              </span>
            )}
            
            {/* 状态 */}
            {status && (
              <span className={cn(
                "text-xs px-1.5 py-0.5 rounded",
                status === '草稿池' && "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300",
                status === '孵化中' && "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
                status === '已采纳' && "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
                status === '已废弃' && "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
              )}>
                {status}
              </span>
            )}
          </div>
        </div>
      );
    }
    
    // 问题卡片
    if (tag.id === FIXED_TAG_IDS.PROBLEM) {
      const severity = fields.severity as string | undefined;
      const status = fields.status as string | undefined;
      const context = fields.context as string | undefined;
      
      return (
        <div className="flex items-center gap-2 flex-wrap">
          {/* 严重程度 */}
          {severity && (
            <span className={cn(
              "text-xs px-1.5 py-0.5 rounded",
              severity === '高' && "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
              severity === '中' && "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
              severity === '低' && "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
            )}>
              {severity}
            </span>
          )}
          
          {/* 状态 */}
          {status && (
            <span className={cn(
              "text-xs px-1.5 py-0.5 rounded",
              status === '待解决' && "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
              status === '探索中' && "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
              status === '已解决' && "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
            )}>
              {status}
            </span>
          )}
          
          {/* 发生场景 */}
          {context && (
            <span className="text-xs text-gray-400 truncate max-w-[120px]" title={context}>
              {context}
            </span>
          )}
        </div>
      );
    }
    
    // 文档卡片
    if (tag.id === FIXED_TAG_IDS.DOC) {
      const type = fields.type as string | undefined;
      const completeness = fields.completeness as string | undefined;
      const url = fields.url as string | undefined;
      
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* 文档类型 */}
            {type && (
              <span className={cn(
                "text-xs px-1.5 py-0.5 rounded",
                type === 'PRD' && "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
                type === '技术方案' && "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
                type === '调研报告' && "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
              )}>
                {type}
              </span>
            )}
            
            {/* 完成度 */}
            {completeness && (
              <span className={cn(
                "text-xs px-1.5 py-0.5 rounded",
                completeness === '草稿' && "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300",
                completeness === '评审中' && "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
                completeness === '定稿' && "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
              )}>
                {completeness}
              </span>
            )}
          </div>
          
          {/* 链接 */}
          {url && (
            <a 
              href={url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs text-blue-500 hover:underline truncate block"
              onClick={(e) => e.stopPropagation()}
            >
              🔗 {url}
            </a>
          )}
        </div>
      );
    }
    
    // 默认：显示所有字段
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {fieldDefinitions.slice(0, 3).map((fieldDef) => {
          const value = fields[fieldDef.key];
          if (!value) return null;
          
          return (
            <span 
              key={fieldDef.id}
              className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded"
            >
              {fieldDef.name}: {String(value)}
            </span>
          );
        })}
      </div>
    );
  };
  
  return (
    <div 
      className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm hover:shadow-lg transition-all cursor-pointer"
      onClick={onEdit}
    >
      {/* 标题行 */}
      <div className="flex items-start gap-2 mb-3">
        {/* 圆点 - 点击进入聚焦视图 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFocus();
              }}
              className="flex-shrink-0 mt-1 p-0.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <Circle 
                size={8} 
                className="fill-current"
                style={{ color: tag.color }}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent>聚焦模式</TooltipContent>
        </Tooltip>
        <h3 className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-100 line-clamp-2">
          {node.content || '无标题'}
        </h3>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 hover:text-blue-500"
            >
              <Edit3 size={14} />
            </button>
          </TooltipTrigger>
          <TooltipContent>编辑</TooltipContent>
        </Tooltip>
      </div>
      
      {/* 字段区域 */}
      {renderFields()}
      
      {/* 底部标签 */}
      <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700">
        {(() => {
          const tagStyle = getTagStyle(tag);
          return (
            <span 
              className={cn(
                "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
                tagStyle.gradient,
                tagStyle.text
              )}
            >
              <span className="text-sm">{tagStyle.icon}</span>
              #{tag.name}
            </span>
          );
        })()}
      </div>
    </div>
  );
};

const CardView: React.FC<CardViewProps> = ({ tagId }) => {
  const nodes = useNodeStore((state) => state.nodes);
  const setHoistedNode = useNodeStore((state) => state.setHoistedNode);
  const supertags = useSupertagStore((state) => state.supertags);
  const getResolvedFieldDefinitions = useSupertagStore((state) => state.getResolvedFieldDefinitions);
  const setPerspectiveActive = usePerspectiveStore((state) => state.setActiveTag);
  
  // 编辑弹窗状态
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  
  const tag = supertags[tagId];
  const fieldDefinitions = useMemo(() => {
    if (!tag) return [];
    return getResolvedFieldDefinitions(tag.id) ?? [];
  }, [tag, getResolvedFieldDefinitions]);
  const CardIcon = getCardIcon(tagId);
  
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
  
  // 导航到节点
  const handleNavigate = useCallback((nodeId: string) => {
    setHoistedNode(nodeId);
  }, [setHoistedNode]);

  // 聚焦到节点（退出透视，进入大纲聚焦模式）
  const handleFocus = useCallback((nodeId: string) => {
    setPerspectiveActive(null);  // 退出透视模式
    setHoistedNode(nodeId);      // 进入聚焦模式
  }, [setPerspectiveActive, setHoistedNode]);
  
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
          <CardIcon size={20} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
            #{tag.name}
          </h2>
          <p className="text-sm text-gray-500">
            共 {taggedNodes.length} 条记录
          </p>
        </div>
      </div>
      
      {/* 卡片网格 */}
      <div className="flex-1 overflow-y-auto">
        {taggedNodes.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {taggedNodes.map((node) => (
              <Card
                key={node.id}
                node={node}
                tag={tag}
                fieldDefinitions={fieldDefinitions}
                onNavigate={() => handleNavigate(node.id)}
                onFocus={() => handleFocus(node.id)}
                onEdit={() => handleEdit(node.id)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            <LayoutGrid size={48} className="mx-auto mb-3 opacity-50" />
            <p>暂无 #{tag.name} 记录</p>
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

export default CardView;
