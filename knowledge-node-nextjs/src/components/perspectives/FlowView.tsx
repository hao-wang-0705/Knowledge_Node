'use client';

import React, { useMemo, useCallback, useState } from 'react';
import { 
  Hash, ChevronRight, AlertCircle, GitBranch, Lightbulb,
  AlertTriangle, MessageCircle, ArrowRight, Zap, Circle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNodeStore } from '@/stores/nodeStore';
import { useSupertagStore } from '@/stores/supertagStore';
import { usePerspectiveStore } from '@/stores/perspectiveStore';
import { Node, Supertag } from '@/types';
import { FIXED_TAG_IDS } from '@/utils/mockData';

interface FlowViewProps {
  tagId: string;
}

// Miller Columns 风格的树状流视图
// 适用于需要展示层级关系的场景

// 主题卡片组件（第一列）
const TopicCard: React.FC<{
  node: Node;
  tag: Supertag;
  isSelected: boolean;
  onSelect: () => void;
  onNavigate: () => void;
  onFocus: () => void;  // 聚焦视图回调
}> = ({ node, tag, isSelected, onSelect, onNavigate, onFocus }) => {
  const topic = node.fields.topic as string | undefined;
  const background = node.fields.background as string | undefined;
  
  return (
    <div 
      className={cn(
        "group p-4 rounded-xl border-2 transition-all cursor-pointer",
        isSelected 
          ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 shadow-md"
          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-purple-300 dark:hover:border-purple-600"
      )}
      onClick={onSelect}
    >
      {/* 标题 */}
      <div className="flex items-start gap-2 mb-2">
        {/* 圆点 - 点击进入聚焦视图 */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFocus();
          }}
          className="flex-shrink-0 mt-1 p-0.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          title="点击进入聚焦模式"
        >
          <Circle 
            size={8} 
            className="fill-current"
            style={{ color: tag.color }}
          />
        </button>
        <h3 className="flex-1 font-medium text-gray-800 dark:text-gray-100 line-clamp-2">
          {node.content || '无标题主题'}
        </h3>
      </div>
      
      {/* 主题 */}
      {topic && (
        <p className="text-sm text-purple-600 dark:text-purple-400 mb-2 line-clamp-1">
          📌 {topic}
        </p>
      )}
      
      {/* 背景 */}
      {background && (
        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
          {background}
        </p>
      )}
      
      {/* 底部操作 */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100 dark:border-gray-700">
        <span 
          className="inline-flex items-center text-xs px-2 py-0.5 rounded-full"
          style={{ 
            backgroundColor: `${tag.color}20`,
            color: tag.color
          }}
        >
          #{tag.name}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate();
          }}
          className="text-xs text-gray-400 hover:text-purple-500 flex items-center gap-1"
        >
          详情 <ChevronRight size={12} />
        </button>
      </div>
    </div>
  );
};

// 关联项卡片组件（第二/三列）
const RelatedItemCard: React.FC<{
  node: Node;
  tag: Supertag | undefined;
  type: 'issue' | 'idea';
  onNavigate: () => void;
  onFocus: () => void;  // 聚焦视图回调
}> = ({ node, tag, type, onNavigate, onFocus }) => {
  const Icon = type === 'issue' ? AlertTriangle : Lightbulb;
  
  // 获取关键字段 - 使用默认灰色样式
  const getStatusBadge = () => {
    const status = node.fields.status as string | undefined;
    if (!status) return null;
    
    return (
      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
        {status}
      </span>
    );
  };
  
  return (
    <div 
      className="group p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-md transition-all cursor-pointer"
      onClick={onNavigate}
    >
      <div className="flex items-start gap-2">
        {/* 圆点 - 点击进入聚焦视图 */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFocus();
          }}
          className="flex-shrink-0 mt-1 p-0.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="点击进入聚焦模式"
        >
          <Circle 
            size={8} 
            className="fill-current text-gray-400"
          />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-100 line-clamp-2 mb-1">
            {node.content || (type === 'issue' ? '无标题问题' : '无标题创意')}
          </p>
          {getStatusBadge()}
        </div>
        <ChevronRight 
          size={14} 
          className="text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
        />
      </div>
    </div>
  );
};

const FlowView: React.FC<FlowViewProps> = ({ tagId }) => {
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  
  const nodes = useNodeStore((state) => state.nodes);
  const setHoistedNode = useNodeStore((state) => state.setHoistedNode);
  const supertags = useSupertagStore((state) => state.supertags);
  const setPerspectiveActive = usePerspectiveStore((state) => state.setActiveTag);
  
  const tag = supertags[tagId];
  
  // 获取所有标签节点
  const getDescendantIds = useSupertagStore((s) => s.getDescendantIds);
  const tagNodes = useMemo(() => {
    const ids = getDescendantIds(tagId);
    return Object.values(nodes)
      .filter(
        (node) =>
          (node.supertagId && ids.includes(node.supertagId)) ||
          node.tags.some((t) => ids.includes(t))
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [nodes, tagId, getDescendantIds]);
  
  // 当前选中的主题
  const selectedTopic = selectedTopicId ? nodes[selectedTopicId] : null;
  
  // 获取关联的问题和创意
  const relatedItems = useMemo(() => {
    if (!selectedTopic) return { issues: [], ideas: [] };
    
    const issueIds = selectedTopic.fields.related_issues as string[] | string | undefined;
    const ideaIds = selectedTopic.fields.related_ideas as string[] | string | undefined;
    
    // 处理可能是单个值或数组的情况
    const normalizeIds = (ids: string[] | string | undefined): string[] => {
      if (!ids) return [];
      if (Array.isArray(ids)) return ids;
      return [ids];
    };
    
    const issues = normalizeIds(issueIds)
      .map(id => nodes[id])
      .filter(Boolean);
      
    const ideas = normalizeIds(ideaIds)
      .map(id => nodes[id])
      .filter(Boolean);
    
    // 同时获取子节点中的问题和创意
    const childNodes = selectedTopic.childrenIds
      .map(id => nodes[id])
      .filter(Boolean);
    
    const childIssues = childNodes.filter(n => n.tags.includes(FIXED_TAG_IDS.PROBLEM));
    const childIdeas = childNodes.filter(n => n.tags.includes(FIXED_TAG_IDS.IDEA));
    
    return {
      issues: [...issues, ...childIssues],
      ideas: [...ideas, ...childIdeas],
    };
  }, [selectedTopic, nodes]);
  
  // 导航到节点
  const handleNavigate = useCallback((nodeId: string) => {
    setHoistedNode(nodeId);
  }, [setHoistedNode]);

  // 聚焦到节点（退出透视，进入大纲聚焦模式）
  const handleFocus = useCallback((nodeId: string) => {
    setPerspectiveActive(null);  // 退出透视模式
    setHoistedNode(nodeId);      // 进入聚焦模式
  }, [setPerspectiveActive, setHoistedNode]);
  
  if (!tag) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <AlertCircle className="mr-2" />
        标签不存在
      </div>
    );
  }
  
  return (
    <div className="h-full flex flex-col">
      {/* 标题 */}
      <div className="flex items-center gap-3 mb-6">
        <div 
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-bold shadow-lg"
          style={{ backgroundColor: tag.color }}
        >
          <GitBranch size={20} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
            #{tag.name}
          </h2>
          <p className="text-sm text-gray-500">
            共 {tagNodes.length} 个主题
          </p>
        </div>
      </div>
      
      {/* Miller Columns 布局 */}
      <div className="flex-1 overflow-hidden">
        <div className="flex gap-4 h-full">
          {/* 第一列：主题列表 */}
          <div className="w-80 flex-shrink-0 flex flex-col">
            <div className="flex items-center gap-2 mb-3 px-1">
              <Zap size={16} className="text-purple-500" />
              <span className="font-medium text-gray-700 dark:text-gray-200">
                主题列表
              </span>
              <span className="ml-auto text-xs text-gray-400">
                {tagNodes.length}
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {tagNodes.length > 0 ? (
                tagNodes.map((node) => (
                  <TopicCard
                    key={node.id}
                    node={node}
                    tag={tag}
                    isSelected={selectedTopicId === node.id}
                    onSelect={() => setSelectedTopicId(node.id)}
                    onNavigate={() => handleNavigate(node.id)}
                    onFocus={() => handleFocus(node.id)}
                  />
                ))
              ) : (
                <div className="text-center py-8 text-gray-400 text-sm">
                  暂无主题
                </div>
              )}
            </div>
          </div>
          
          {/* 连接线 */}
          {selectedTopic && (
            <div className="flex items-center">
              <ArrowRight size={20} className="text-gray-300 dark:text-gray-600" />
            </div>
          )}
          
          {/* 第二列：关联问题 */}
          {selectedTopic && (
            <div className="w-64 flex-shrink-0 flex flex-col">
              <div className="flex items-center gap-2 mb-3 px-1">
                <AlertTriangle size={16} className="text-orange-500" />
                <span className="font-medium text-gray-700 dark:text-gray-200">
                  关联问题
                </span>
                <span className="ml-auto text-xs text-gray-400">
                  {relatedItems.issues.length}
                </span>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                {relatedItems.issues.length > 0 ? (
                  relatedItems.issues.map((node) => (
                    <RelatedItemCard
                      key={node.id}
                      node={node}
                      tag={supertags[FIXED_TAG_IDS.PROBLEM]}
                      type="issue"
                      onNavigate={() => handleNavigate(node.id)}
                      onFocus={() => handleFocus(node.id)}
                    />
                  ))
                ) : (
                  <div className="text-center py-6 text-gray-400 text-sm bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    暂无关联问题
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* 第三列：关联创意 */}
          {selectedTopic && (
            <div className="w-64 flex-shrink-0 flex flex-col">
              <div className="flex items-center gap-2 mb-3 px-1">
                <Lightbulb size={16} className="text-yellow-500" />
                <span className="font-medium text-gray-700 dark:text-gray-200">
                  关联创意
                </span>
                <span className="ml-auto text-xs text-gray-400">
                  {relatedItems.ideas.length}
                </span>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                {relatedItems.ideas.length > 0 ? (
                  relatedItems.ideas.map((node) => (
                    <RelatedItemCard
                      key={node.id}
                      node={node}
                      tag={supertags[FIXED_TAG_IDS.IDEA]}
                      type="idea"
                      onNavigate={() => handleNavigate(node.id)}
                      onFocus={() => handleFocus(node.id)}
                    />
                  ))
                ) : (
                  <div className="text-center py-6 text-gray-400 text-sm bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    暂无关联创意
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* 未选择主题时的提示 */}
          {!selectedTopic && tagNodes.length > 0 && (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <MessageCircle size={32} className="mr-3 opacity-50" />
              <div>
                <p className="font-medium">选择一个主题</p>
                <p className="text-sm">查看关联的问题和创意</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FlowView;
