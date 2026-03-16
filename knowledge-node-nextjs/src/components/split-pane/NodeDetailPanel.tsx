'use client';

import React, { useMemo } from 'react';
import { X, ChevronRight, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNodeStore } from '@/stores/nodeStore';
import { useSupertagStore } from '@/stores/supertagStore';
import { useSplitPane } from './useSplitPane';
import PanelBreadcrumb from './PanelBreadcrumb';
import FieldEditor from '@/components/FieldEditor';
import Backlinks from '@/components/Backlinks';
import { ContentWithReferences } from '@/components/ReferenceChip';
import { getPlainTextWithoutReferences } from '@/utils/reference-helpers';
import { getTagStyle } from '@/utils/tag-styles';

interface NodeDetailPanelProps {
  className?: string;
}

/**
 * 节点详情面板 v2.2
 * - 显示节点完整信息
 * - 支持字段编辑
 * - 显示子节点树
 * - 显示反向引用
 * - 支持面板内导航
 */
const NodeDetailPanel: React.FC<NodeDetailPanelProps> = ({ className }) => {
  const {
    isOpen,
    panelNodeId,
    panelHistory,
    canGoBack,
    closePanel,
    goBack,
    navigateInPanel,
  } = useSplitPane();

  const nodes = useNodeStore((state) => state.nodes);
  const updateNode = useNodeStore((state) => state.updateNode);
  
  const supertags = useSupertagStore((state) => state.supertags);
  const getFieldDefinitions = useSupertagStore((state) => state.getFieldDefinitions);

  const node = panelNodeId ? nodes[panelNodeId] : null;

  // 获取节点标签
  const nodeTags = useMemo(() => {
    if (!node) return [];
    return node.tags
      .map((tagId) => supertags[tagId])
      .filter(Boolean);
  }, [node, supertags]);

  // 获取子节点
  const childNodes = useMemo(() => {
    if (!node) return [];
    return node.childrenIds
      .map((id) => nodes[id])
      .filter(Boolean);
  }, [node, nodes]);

  // 处理字段变更
  const handleFieldChange = (fieldKey: string, value: unknown) => {
    if (!panelNodeId) return;
    updateNode(panelNodeId, {
      fields: {
        ...node?.fields,
        [fieldKey]: value,
      },
    });
  };

  // 处理子节点点击
  const handleChildClick = (childId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // 面板内导航
    navigateInPanel(childId);
  };

  // 处理反向链接点击
  const handleBacklinkClick = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // 检测修饰键
    const isModifierClick = e.metaKey || e.ctrlKey;
    if (isModifierClick) {
      // 面板内导航
      navigateInPanel(nodeId);
    } else {
      // 默认行为：也在面板内导航
      navigateInPanel(nodeId);
    }
  };

  // 处理键盘快捷键
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      // Escape 关闭面板
      if (e.key === 'Escape') {
        closePanel();
        e.preventDefault();
      }
      // Backspace 返回（当不在输入框时）
      if (e.key === 'Backspace' && canGoBack) {
        const target = e.target as HTMLElement;
        if (!['INPUT', 'TEXTAREA'].includes(target.tagName) && !target.isContentEditable) {
          goBack();
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, canGoBack, closePanel, goBack]);

  if (!isOpen || !node) {
    return null;
  }

  return (
    <div className={cn(
      'flex flex-col h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700',
      className
    )}>
      {/* 面板头部 */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          {/* 面包屑导航 */}
          <PanelBreadcrumb
            history={panelHistory}
            onGoBack={goBack}
            canGoBack={canGoBack}
          />
          
          {/* 关闭按钮 */}
          <button
            onClick={closePanel}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
            title="关闭面板 (Esc)"
          >
            <X size={16} />
          </button>
        </div>
        
        {/* 节点标题 */}
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 leading-snug">
          <ContentWithReferences content={node.content} references={node.references} />
        </h2>
        
        {/* 标签 */}
        {nodeTags.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {nodeTags.map((tag) => {
              const typeStyle = getTagStyle(tag);
              return (
                <span
                  key={tag.id}
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full",
                    typeStyle.gradient,
                    typeStyle.text
                  )}
                >
                  <span className="text-sm">{typeStyle.icon}</span>
                  <span>{tag.name}</span>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* 面板内容 - 可滚动 */}
      <div className="flex-1 overflow-y-auto">
        {/* 字段区域 */}
        {nodeTags.length > 0 && (
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">字段</h3>
            <div className="space-y-1">
              {nodeTags.map((tag) => {
                const fieldDefs = getFieldDefinitions(tag.id) ?? [];
                return fieldDefs.map((fieldDef) => (
                  <FieldEditor
                    key={fieldDef.id}
                    fieldDef={fieldDef}
                    value={node.fields[fieldDef.key]}
                    onChange={(value) => handleFieldChange(fieldDef.key, value)}
                    nodeId={panelNodeId!}
                    tagId={tag.id}
                    className="!py-1"
                  />
                ));
              })}
            </div>
          </div>
        )}

        {/* 子节点区域 */}
        {childNodes.length > 0 && (
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
              子节点 <span className="text-gray-400">({childNodes.length})</span>
            </h3>
            <div className="space-y-1">
              {childNodes.slice(0, 10).map((child) => {
                const childContent = getPlainTextWithoutReferences(child.content);
                return (
                  <button
                    key={child.id}
                    onClick={(e) => handleChildClick(child.id, e)}
                    className={cn(
                      'w-full text-left px-2 py-1.5 rounded-md transition-colors',
                      'hover:bg-gray-50 dark:hover:bg-gray-800/50',
                      'flex items-center gap-2 group'
                    )}
                  >
                    <ChevronRight size={12} className="text-gray-400 flex-shrink-0" />
                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">
                      {childContent || '(空内容)'}
                    </span>
                    <ExternalLink 
                      size={10} 
                      className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" 
                    />
                  </button>
                );
              })}
              {childNodes.length > 10 && (
                <div className="text-xs text-gray-400 px-2 py-1">
                  还有 {childNodes.length - 10} 个子节点...
                </div>
              )}
            </div>
          </div>
        )}

        {/* 反向链接区域 */}
        <div className="px-4 py-3">
          <Backlinks
            nodeId={panelNodeId!}
            defaultExpanded={true}
            collapsible={false}
            onNodeClick={handleBacklinkClick}
          />
        </div>
      </div>

      {/* 面板底部 - 快捷键提示 */}
      <div className="flex-shrink-0 border-t border-gray-100 dark:border-gray-800 px-4 py-2">
        <div className="flex items-center gap-4 text-[10px] text-gray-400">
          <span>
            <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">Esc</kbd> 关闭
          </span>
          {canGoBack && (
            <span>
              <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">⌫</kbd> 返回
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default NodeDetailPanel;
