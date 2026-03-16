'use client';

import React, { useRef, useEffect, memo, useCallback, useState } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FEATURE_FLAGS } from '@/lib/feature-flags';
import { useNodeStore } from '@/stores/nodeStore';
import { useSupertagStore } from '@/stores/supertagStore';
import { useSearchNodeStore } from '@/stores/searchNodeStore';
import { useDeconstructPreviewStore } from '@/stores/deconstructPreviewStore';
import { useExpandPreviewStore } from '@/stores/expandPreviewStore';
import ContextMenu from './ContextMenu';
import MentionPopover from './MentionPopover';
import UnifiedTagSelector from './UnifiedTagSelector';
import SlashCommandMenu from './SlashCommandMenu';
import type { SlashCommandItem, SlashCommandGroup } from './SlashCommandMenu';
import SearchConfigModal from './search-node/SearchConfigModal';
import { NodeReference } from '@/types';
import type { SearchConfig } from '@/types/search';
import { useSearchNode } from '@/hooks/useSearchNode';
import { useQuickAction } from '@/hooks/useQuickAction';
import { ActionTagStateButton, NodeActions, NodeContent, NodeFields } from './node';
import NodeSearch from './node/NodeSearch';
import QuickActionButton from './node/QuickActionButton';
import DeconstructHoverButton from './node/DeconstructHoverButton';
import type { UnifiedNodeEditorHandle } from '@/components/editor/UnifiedNodeEditor';
import { CollapseViewKeyContext, useCollapseViewKey } from '@/contexts/CollapseViewKeyContext';
import { useSplitPane } from '@/components/split-pane/useSplitPane';
import { Check, X, ListTree, Wand2 } from 'lucide-react';

interface NodeComponentProps {
  nodeId: string;
  depth: number;
  onFocusPrevious?: () => void;
  onFocusNext?: () => void;
  /** 自定义 bullet 点击行为（用于查询面板场景，点击跳转到主页面） */
  onBulletClick?: (nodeId: string) => void;
}

const NodeComponent: React.FC<NodeComponentProps> = memo((props) => {
  const { nodeId, depth, onBulletClick } = props;
  const contentRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<UnifiedNodeEditorHandle | null>(null);
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [tagSelectorPosition, setTagSelectorPosition] = useState({ x: 0, y: 0 });  // 标签选择器位置
  const [tagSearchTerm, setTagSearchTerm] = useState('');  // 标签搜索词
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isComposing, setIsComposing] = useState(false); // 中文输入法组合状态
  const [selectedTagIndex, setSelectedTagIndex] = useState(0); // 标签选择索引
  const [showMentionPopover, setShowMentionPopover] = useState(false); // @ 引用弹窗
  const [mentionPosition, setMentionPosition] = useState({ x: 0, y: 0 }); // 引用弹窗位置
  const [isEditing, setIsEditing] = useState(false); // 是否正在编辑
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashMenuPosition, setSlashMenuPosition] = useState({ x: 0, y: 0 });

  const node = useNodeStore((state) => state.nodes[nodeId]);
  const focusedNodeId = useNodeStore((state) => state.focusedNodeId);
  const nodes = useNodeStore((state) => state.nodes);
  const rootIds = useNodeStore((state) => state.rootIds);
  const updateNode = useNodeStore((state) => state.updateNode);
  const applySupertag = useNodeStore((state) => state.applySupertag);
  const addNode = useNodeStore((state) => state.addNode);
  const addSearchNode = useNodeStore((state) => state.addSearchNode);
  const deleteNode = useNodeStore((state) => state.deleteNode);
  const indentNode = useNodeStore((state) => state.indentNode);
  const outdentNode = useNodeStore((state) => state.outdentNode);
  const toggleCollapse = useNodeStore((state) => state.toggleCollapse);
  const setCollapseState = useNodeStore((state) => state.setCollapseState);
  const setFocusedNode = useNodeStore((state) => state.setFocusedNode);
  const setHoistedNode = useNodeStore((state) => state.setHoistedNode);

  const viewKey = useCollapseViewKey();
  const effectiveCollapsed = useNodeStore((state) => {
    const key = `${viewKey}:${nodeId}`;
    return key in state.collapseOverlay ? state.collapseOverlay[key] : (state.nodes[nodeId]?.isCollapsed ?? false);
  });

  const supertags = useSupertagStore((state) => state.supertags);
  const getFieldDefinitions = useSupertagStore((state) => state.getFieldDefinitions);
  const trackTagUsage = useSupertagStore((state) => state.trackTagUsage);
  const getRecentTags = useSupertagStore((state) => state.getRecentTags);

  const { openPanel } = useSplitPane();
  const nodeSearch = useSearchNode(nodeId);
  const { isExecuting: quickActionExecuting, actionType: quickActionType, expandedContent } = useQuickAction(nodeId);
  const previewEntry = useDeconstructPreviewStore((s) => s.previews[nodeId]);
  const setPreview = useDeconstructPreviewStore((s) => s.setPreview);
  const applyDeconstructPreview = useNodeStore((s) => s.applyDeconstructPreview);
  const expandPreviewEntry = useExpandPreviewStore((s) => s.previews[nodeId]);
  const setExpandPreview = useExpandPreviewStore((s) => s.setPreview);

  // 当此节点获得焦点时，聚焦 contentEditable
  const isFocused = focusedNodeId === nodeId;
  
  // 当此节点获得焦点时，聚焦编辑器（由 Lexical 管理选区）
  useEffect(() => {
    if (focusedNodeId === nodeId && contentRef.current) {
      contentRef.current.focus();
    }
  }, [focusedNodeId, nodeId]);

  // 关闭右键菜单当点击其他地方时
  useEffect(() => {
    const handleGlobalClick = () => {
      if (contextMenu) {
        setContextMenu(null);
      }
    };

    if (contextMenu) {
      document.addEventListener('click', handleGlobalClick);
      return () => document.removeEventListener('click', handleGlobalClick);
    }
  }, [contextMenu]);

  // 迁移到统一输入内核后，选区由编辑器维护，不再手动同步光标位置
  const saveCursorPosition = useCallback(() => {
    return;
  }, []);

  const getCaretOffsetInEditor = useCallback(() => {
    if (!contentRef.current) return 0;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return 0;
    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(contentRef.current);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    return preCaretRange.toString().length;
  }, []);

  // 单击行区域时进入编辑模式，光标定位到点击位置
  const handleRowClick = useCallback((e: React.MouseEvent) => {
    // 点击标签区域不触发编辑
    const target = e.target as HTMLElement;
    if (target.closest('.tag-badge') || target.closest('.tag-selector')) return;
    
    // 如果点击的是 contentEditable 区域，浏览器会自动处理光标定位
    if (target.closest('[contenteditable]')) return;
    
    // 点击行内其他区域时（包括引用渲染区域），切换到编辑模式
    setFocusedNode(nodeId);
    setIsEditing(true);
    
    setTimeout(() => {
      if (contentRef.current) {
        if (FEATURE_FLAGS.UNIFIED_INPUT_KERNEL) {
          editorRef.current?.focus();
        } else {
          contentRef.current.focus();
          const range = document.createRange();
          const selection = window.getSelection();
          range.selectNodeContents(contentRef.current);
          range.collapse(false); // 移动到末尾
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      }
    }, 10);
  }, [nodeId, setFocusedNode]);

  const handleContentChange = useCallback(() => {
    // 如果正在进行中文输入法组合，不处理
    if (isComposing) return;
    
    if (contentRef.current) {
      const newContent = contentRef.current.textContent || '';
      
      if (newContent !== node?.content) {
        saveCursorPosition();
        
        updateNode(nodeId, { content: newContent });
        
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const caretOffset = getCaretOffsetInEditor();
          const textBeforeCursor = newContent.substring(0, caretOffset);

          // # 触发统一标签选择器（旧输入内核）
          if (!FEATURE_FLAGS.UNIFIED_INPUT_KERNEL) {
            const hashMatch = textBeforeCursor.match(/#([^\s#]*)$/);
            if (hashMatch) {
              const rect = range.getBoundingClientRect();
              setTagSelectorPosition({
                x: rect.left - (hashMatch[1]?.length || 0) * 8,
                y: rect.bottom + 4,
              });
              setTagSearchTerm(hashMatch[1] || '');
              setShowTagSelector(true);
            } else if (showTagSelector) {
              setShowTagSelector(false);
              setTagSearchTerm('');
            }
          }

          // @ 触发引用选择（统一输入内核下由 MentionTriggerPlugin 处理）
          if (!FEATURE_FLAGS.UNIFIED_INPUT_KERNEL && textBeforeCursor.endsWith('@')) {
            // 获取光标位置
            const mentionRect = range.getBoundingClientRect();
            setMentionPosition({
              x: mentionRect.left,
              y: mentionRect.bottom + 4,
            });
            setShowMentionPopover(true);
          }
        }
      }
    }
  }, [nodeId, node, updateNode, saveCursorPosition, isComposing, showTagSelector, getCaretOffsetInEditor]);

  // 中文输入法组合开始
  const handleCompositionStart = useCallback(() => {
    setIsComposing(true);
  }, []);

  // 中文输入法组合结束
  const handleCompositionEnd = useCallback(() => {
    setIsComposing(false);
    
    // 组合结束后手动触发内容更新
    if (contentRef.current) {
      const newContent = contentRef.current.textContent || '';
      if (newContent !== node?.content) {
        saveCursorPosition();
        updateNode(nodeId, { content: newContent });
      }
    }
  }, [node, nodeId, updateNode, saveCursorPosition]);

  // 添加标签到节点 - 需要在 handleKeyDown 之前定义
  const handleAddTag = useCallback((tagId: string) => {
    // 选择标签前，先移除内容中的 # 及搜索词
    if (contentRef.current) {
      const content = contentRef.current.textContent || '';
      // 移除 # 和可能的搜索词
      const hashPattern = /#[^\s#]*$/;
      if (hashPattern.test(content)) {
        const newContent = content.replace(hashPattern, '').trimEnd();
        contentRef.current.textContent = newContent;
        updateNode(nodeId, { content: newContent });
      }
    }
    
    if (node && !node.tags.includes(tagId)) {
      // 检查标签是否有 status 字段定义，如果有则自动设置默认状态
      const tag = supertags[tagId];
      const defs = tag ? getFieldDefinitions(tag.id) ?? [] : [];
      const hasStatusField = defs.some((f) => f.key === 'status');
      
      const updates: { tags: string[]; fields?: Record<string, unknown> } = {
        tags: [...node.tags, tagId]
      };
      
      // 如果标签有状态字段且节点当前没有状态值，自动设为 "Todo"
      if (hasStatusField && !node.fields.status) {
        updates.fields = {
          ...node.fields,
          status: 'Todo'
        };
      }
      
      updateNode(nodeId, updates);
    }
    setShowTagSelector(false);
    setSelectedTagIndex(0);
    setTagSearchTerm('');
  }, [node, nodeId, updateNode, supertags, getFieldDefinitions]);

  // 统一标签选择器回调 - 选择标签
  const handleUnifiedTagSelect = useCallback((tagId: string, tagType: 'type' | 'context') => {
    // 移除内容中的 # 及搜索词
    if (contentRef.current) {
      const content = contentRef.current.textContent || '';
      const hashPattern = /#[^\s#]*$/;
      if (hashPattern.test(content)) {
        const newContent = content.replace(hashPattern, '').trimEnd();
        contentRef.current.textContent = newContent;
        updateNode(nodeId, { content: newContent });
      }
    }
    
    if (!node) return;
    
    // 追踪标签使用
    trackTagUsage(tagId);
    
    if (tagType === 'type') {
      // 功能标签：v2.1 使用 applySupertag（含模版自动填充）
      if (!node.tags.includes(tagId)) {
        applySupertag(nodeId, tagId, { fillTemplateIfEmpty: true });
        const tag = supertags[tagId];
        const defs = tag ? getFieldDefinitions(tag.id) ?? [] : [];
        const hasStatusField = defs.some((f: { key: string }) => f.key === 'status');
        if (hasStatusField && !node.fields?.status) {
          updateNode(nodeId, { fields: { ...node.fields, status: 'Todo' } });
        }
      }
    }
    
    setShowTagSelector(false);
    setTagSearchTerm('');
    
    // 恢复焦点
    setTimeout(() => contentRef.current?.focus(), 50);
  }, [node, nodeId, updateNode, applySupertag, supertags, trackTagUsage, getFieldDefinitions]);
  
  const handlePlainEnter = useCallback(() => {
    if (showTagSelector) return false;

    const content = contentRef.current?.textContent?.trim() || '';
    if (FEATURE_FLAGS.SEARCH_NODE && content === '/') {
      const rect = contentRef.current?.getBoundingClientRect();
      setSlashMenuPosition({ x: rect?.left || 0, y: (rect?.bottom || 0) + 8 });
      setShowSlashMenu(true);
      return true;
    }

    if (FEATURE_FLAGS.SEARCH_NODE && content.toLowerCase() === '/search') {
      if (contentRef.current) {
        contentRef.current.textContent = '';
      }
      updateNode(nodeId, { content: '' });
      // v4.0: 创建搜索节点后自动打开配置弹窗
      nodeSearch.openSearchConfigAndDeleteCurrentAfterCreate();
      return true;
    }

    // 在当前节点后创建同级新节点
    addNode(node?.parentId || null, nodeId);
    return true;
  }, [node, nodeId, addNode, updateNode, nodeSearch, showTagSelector]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // 如果正在进行中文输入法组合，不处理快捷键
    if (isComposing) return;
    
    // 标签选择器打开时的键盘导航
    if (showTagSelector) {
      // 过滤掉已废弃标签和已添加的标签
      const availableTagsList = Object.values(supertags).filter(tag => tag.status !== 'deprecated' && !node?.tags.includes(tag.id));
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedTagIndex(prev => Math.min(prev + 1, availableTagsList.length - 1));
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedTagIndex(prev => Math.max(prev - 1, 0));
        return;
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (availableTagsList[selectedTagIndex]) {
          handleAddTag(availableTagsList[selectedTagIndex].id);
        }
        return;
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowTagSelector(false);
        setSelectedTagIndex(0);
        return;
      }
    }
    
    // 保存光标位置
    saveCursorPosition();

    // 旧输入内核下：当光标紧挨某个引用时，Backspace/Delete 整体删除该引用实体
    if (
      !FEATURE_FLAGS.UNIFIED_INPUT_KERNEL &&
      contentRef.current &&
      node?.references &&
      node.references.length > 0 &&
      (e.key === 'Backspace' || e.key === 'Delete')
    ) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const offset = getCaretOffsetInEditor();
        const refs = node.references;

        const isNearRef = (ref: NodeReference) => {
          const anchor = ref.anchorOffset ?? 0;
          return e.key === 'Backspace'
            ? offset === anchor + 1 || offset === anchor
            : offset === anchor;
        };

        const targetRef = refs.find(isNearRef);
        if (targetRef) {
          e.preventDefault();
          const nextRefs = refs.filter(r => r.id !== targetRef.id);
          updateNode(nodeId, { references: nextRefs });
          // 光标位置保持不变即可，由内容层自行决定展示
          return;
        }
      }
    }
    
    if (e.key === 'Enter' && !e.shiftKey) {
      if (FEATURE_FLAGS.UNIFIED_INPUT_KERNEL) {
        return;
      }
      e.preventDefault();
      handlePlainEnter();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      
      if (e.shiftKey) {
        // Shift+Tab: 反缩进
        outdentNode(nodeId);
      } else {
        // Tab: 缩进
        indentNode(nodeId);
      }
    } else if (e.key === 'Backspace') {
      const content = contentRef.current?.textContent || '';
      if (content === '') {
        e.preventDefault();
        // v4.2: 若节点有超级标签，先退格清除标签与 fields，再次退格再删节点
        if (node?.supertagId) {
          updateNode(nodeId, { supertagId: null, fields: {}, tags: [] });
          return;
        }
        // 内容为空且无标签：删除节点并聚焦上一个
        const siblings = node?.parentId === null ? rootIds : (nodes[node?.parentId || '']?.childrenIds || []);
        const currentIndex = siblings.indexOf(nodeId);
        if (currentIndex > 0) setFocusedNode(siblings[currentIndex - 1]);
        else if (node?.parentId) setFocusedNode(node.parentId);
        deleteNode(nodeId);
      }
    } else if (e.key === 'Escape') {
      setShowTagSelector(false);
    }
    // 注意：移除了 ArrowUp/ArrowDown 的拦截，让光标可以在文本内自由移动
  }, [node, nodeId, rootIds, nodes, updateNode, indentNode, outdentNode, deleteNode, setFocusedNode, saveCursorPosition, isComposing, showTagSelector, supertags, selectedTagIndex, handleAddTag, handlePlainEnter, getCaretOffsetInEditor]);

  const handleUnifiedEditorChange = useCallback((next: { content: string; references: NodeReference[] }) => {
    updateNode(nodeId, {
      content: next.content,
      references: next.references,
    });
  }, [nodeId, updateNode]);

  const handleUnifiedMentionTrigger = useCallback((position: { x: number; y: number }) => {
    setMentionPosition(position);
    setShowMentionPopover(true);
  }, []);

  const handleUnifiedHashTrigger = useCallback((position: { x: number; y: number }, searchTerm: string) => {
    setTagSelectorPosition(position);
    setTagSearchTerm(searchTerm);
    setShowTagSelector(true);
  }, []);

  const handleUnifiedHashDismiss = useCallback(() => {
    setShowTagSelector(false);
    setTagSearchTerm('');
  }, []);

  const handleFocus = useCallback(() => {
    setFocusedNode(nodeId);
    setIsEditing(true);
  }, [nodeId, setFocusedNode]);
  
  const handleBlur = useCallback((e: React.FocusEvent) => {
    const related = e.relatedTarget as HTMLElement | null;
    if (related?.closest('[data-editing-popover]')) return;
    saveCursorPosition();
    setIsEditing(false);
  }, [saveCursorPosition]);

  // 右键菜单处理
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
    setFocusedNode(nodeId);
  }, [nodeId, setFocusedNode]);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleDeleteFromContext = useCallback(() => {
    // 找到要聚焦的节点
    const siblings = node?.parentId === null ? rootIds : (nodes[node?.parentId || '']?.childrenIds || []);
    const currentIndex = siblings.indexOf(nodeId);
    
    if (currentIndex > 0) {
      // 聚焦上一个兄弟节点
      setFocusedNode(siblings[currentIndex - 1]);
    } else if (currentIndex < siblings.length - 1) {
      // 聚焦下一个兄弟节点
      setFocusedNode(siblings[currentIndex + 1]);
    } else if (node?.parentId) {
      // 聚焦父节点
      setFocusedNode(node.parentId);
    } else {
      setFocusedNode(null);
    }
    
    deleteNode(nodeId);
  }, [node, nodeId, rootIds, nodes, deleteNode, setFocusedNode]);

  const handleCopyNode = useCallback(() => {
    if (node) {
      // 复制节点内容到剪贴板
      navigator.clipboard.writeText(node.content);
    }
  }, [node]);

  const handleCutNode = useCallback(() => {
    if (node) {
      // 复制到剪贴板然后删除
      navigator.clipboard.writeText(node.content);
      handleDeleteFromContext();
    }
  }, [node, handleDeleteFromContext]);

  const handleAddTagFromContext = useCallback(() => {
    setShowTagSelector(true);
  }, []);

  const handleIndentFromContext = useCallback(() => {
    indentNode(nodeId);
  }, [nodeId, indentNode]);

  const handleOutdentFromContext = useCallback(() => {
    outdentNode(nodeId);
  }, [nodeId, outdentNode]);

  // 添加子节点
  const handleAddChild = useCallback(() => {
    if (effectiveCollapsed) setCollapseState(viewKey, nodeId, false);
    addNode(nodeId);
  }, [nodeId, viewKey, effectiveCollapsed, setCollapseState, addNode]);

  // 从右键菜单触发引用插入
  const handleInsertReferenceFromContext = useCallback(() => {
    if (contentRef.current) {
      const rect = contentRef.current.getBoundingClientRect();
      setMentionPosition({
        x: rect.left,
        y: rect.bottom + 4,
      });
    }
    setShowMentionPopover(true);
  }, []);

  const handleAddSearchNodeFromContext = useCallback(() => {
    addSearchNode(node?.parentId || null, undefined, nodeId);
  }, [addSearchNode, node, nodeId]);

  // v4.2: 实体 + 行动双轨超级标签 + 命令（搜索节点）
  const slashCommandGroups: SlashCommandGroup[] = [
    {
      group: '实体',
      items: Object.values(supertags)
        .filter((t) => t.status !== 'deprecated' && t.category === 'entity')
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((t) => ({
          id: t.id,
          label: t.name,
          description: t.description ?? '',
          icon: <span className="text-base">{t.icon ?? '📌'}</span>,
        })),
    },
    {
      group: '行动',
      items: Object.values(supertags)
        .filter((t) => t.status !== 'deprecated' && t.category === 'action')
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((t) => ({
          id: t.id,
          label: t.name,
          description: t.description ?? '',
          icon: <span className="text-base">{t.icon ?? '📌'}</span>,
        })),
    },
    ...(FEATURE_FLAGS.SEARCH_NODE
      ? [
          {
            group: '命令',
            items: [
              {
                id: 'search-node',
                label: '搜索节点',
                description: '创建一个动态搜索视图节点',
                icon: <Search size={14} />,
              },
            ] as SlashCommandItem[],
          },
        ]
      : []),
  ].filter((g) => g.items.length > 0) as SlashCommandGroup[];

  const handleSlashCommandSelect = useCallback(
    (commandId: string) => {
      if (commandId === 'search-node') {
        if (contentRef.current) contentRef.current.textContent = '';
        updateNode(nodeId, { content: '' });
        nodeSearch.openSearchConfigAndDeleteCurrentAfterCreate();
        setShowSlashMenu(false);
        return;
      }
      // 超级标签：应用标签并清空 "/"
      if (supertags[commandId]) {
        if (contentRef.current) contentRef.current.textContent = '';
        updateNode(nodeId, { content: '' });
        applySupertag(nodeId, commandId);
        setShowSlashMenu(false);
      }
    },
    [nodeId, updateNode, nodeSearch, supertags, applySupertag],
  );

  // 处理引用选择 - 创建实体引用（NodeReference）并记录 anchorOffset
  const handleMentionSelect = useCallback((targetNodeId: string, targetTitle: string) => {
    setShowMentionPopover(false);

    if (FEATURE_FLAGS.UNIFIED_INPUT_KERNEL) {
      editorRef.current?.insertReference(targetNodeId, targetTitle);
    } else if (node && contentRef.current) {
      const raw = contentRef.current.textContent || '';
      const selection = window.getSelection();
      const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
      let offset = raw.length;
      if (range) offset = getCaretOffsetInEditor();
      const hasTriggerAt = offset > 0 && raw[offset - 1] === '@';
      const anchorOffset = hasTriggerAt ? offset - 1 : offset;
      const pureContent = hasTriggerAt ? raw.slice(0, anchorOffset) + raw.slice(offset) : raw;
      const newRef: NodeReference = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        targetNodeId,
        title: targetTitle.trim() || '未命名节点',
        createdAt: Date.now(),
        anchorOffset,
      };
      const currentRefs = node.references || [];
      contentRef.current.textContent = pureContent;
      updateNode(nodeId, { content: pureContent, references: [...currentRefs, newRef] });
      setTimeout(() => contentRef.current?.focus(), 0);
    }
  }, [node, nodeId, updateNode, getCaretOffsetInEditor]);

  // 关闭引用弹窗
  const handleCloseMentionPopover = useCallback(() => {
    setShowMentionPopover(false);
  }, []);



  // 更新字段值
  const handleFieldChange = useCallback((fieldKey: string, value: unknown) => {
    if (node) {
      const newFields = { ...node.fields };
      if (value === '' || value === null || value === undefined) {
        delete newFields[fieldKey];
      } else {
        newFields[fieldKey] = value;
      }
      updateNode(nodeId, { fields: newFields });
    }
  }, [node, nodeId, updateNode]);

  // 移除标签
  const handleRemoveTag = useCallback((tagId: string) => {
    if (node) {
      updateNode(nodeId, {
        tags: node.tags.filter(id => id !== tagId),
        fields: Object.fromEntries(
          Object.entries(node.fields).filter(([key]) => {
            const tag = supertags[tagId];
            const defs = tag ? getFieldDefinitions(tag.id) ?? [] : [];
            return !defs.some(field => field.key === key);
          })
        )
      });
    }
  }, [node, nodeId, updateNode, supertags, getFieldDefinitions]);

  const hasChildren = (node?.childrenIds.length ?? 0) > 0;
  // 功能标签 (Type Tags) - 胶囊样式（排除已废弃标签）
  const typeTags = (node?.tags ?? []).map(tagId => supertags[tagId]).filter(tag => tag && tag.status !== 'deprecated');
  // 向后兼容：旧的 nodeTags
  const nodeTags = (node?.tags ?? []).map(tagId => supertags[tagId]).filter(Boolean);
  
  // 检查内容是否包含引用（实体模型下基于 references 判断）
  const contentHasReferences = !!(node?.references && node.references.length > 0);
  
  // 决定是否显示编辑模式
  // 只有在实际编辑时（isEditing 为 true，即正在输入）才显示原始文本
  // 如果有引用且不在编辑状态，则渲染引用块
  const showEditableContent = isEditing || !contentHasReferences;
  
  const isSearchNode = node.type === 'search';
  const searchConfig = isSearchNode ? (node.payload as SearchConfig | undefined) : undefined;
  
  // v4.0: 搜索节点状态
  const EMPTY_ARRAY: string[] = [];
  const searchResultIds = useSearchNodeStore((state) => isSearchNode ? (state.resultsBySearchNodeId[nodeId] ?? EMPTY_ARRAY) : EMPTY_ARRAY);
  const searchLoading = useSearchNodeStore((state) => isSearchNode ? !!state.loadingBySearchNodeId[nodeId] : false);
  const searchError = useSearchNodeStore((state) => isSearchNode ? state.errorBySearchNodeId[nodeId] : null);
  const searchResultCount = searchResultIds.length;
  const hasSearchConditions = !!(searchConfig?.conditions && searchConfig.conditions.length > 0);

  // 点击圆点进入聚焦模式（Deep Focus）或触发自定义回调
  const handleBulletClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // 如果传入了自定义回调（查询面板场景），优先使用
    if (onBulletClick) {
      onBulletClick(nodeId);
    } else {
      // 默认行为：聚焦进入
      setHoistedNode(nodeId);
    }
  };

  // 折叠/展开按钮点击 - 优化：无子节点时自动创建空子节点
  const handleCollapseClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasChildren && effectiveCollapsed) {
      const newChildId = addNode(nodeId);
      if (newChildId) {
        setCollapseState(viewKey, nodeId, false);
        setTimeout(() => setFocusedNode(newChildId), 50);
      }
    } else {
      toggleCollapse(viewKey, nodeId);
    }
  }, [nodeId, viewKey, hasChildren, effectiveCollapsed, addNode, toggleCollapse, setCollapseState, setFocusedNode]);

  if (!node) return null;

  return (
    <div className="node-container">
      {/* 节点主行 - 标题和标签 */}
      <div
        className={cn(
          "node-row group flex items-start py-1 px-2 rounded-lg transition-all duration-150",
          isSearchNode
            ? cn(
                'bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-950/30 dark:to-cyan-950/30',
                'border-l-4 border-teal-400 dark:border-teal-500',
                'shadow-sm',
                isFocused && 'ring-2 ring-teal-300 dark:ring-teal-600'
              )
            : cn(
                  isFocused && "bg-blue-50 dark:bg-blue-950/30",
                  "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                )
        )}
        style={{ paddingLeft: `${depth * 24 + 8}px` }}
        onContextMenu={handleContextMenu}
        onClick={handleRowClick}
      >
        <NodeActions
          hasChildren={hasChildren}
          isCollapsed={effectiveCollapsed}
          hasNodeTags={nodeTags.length > 0}
          onCollapseClick={handleCollapseClick}
          onBulletClick={handleBulletClick}
        />

        {/* v4.2: 行动标签行内状态一键完成 */}
        {!isSearchNode && node.supertagId && (
          <ActionTagStateButton
            nodeId={nodeId}
            node={node}
            supertag={supertags[node.supertagId] ?? null}
            getFieldDefinitions={getFieldDefinitions}
            onUpdate={(fieldKey, value) =>
              updateNode(nodeId, { fields: { ...node.fields, [fieldKey]: value } })
            }
            className="mr-1"
          />
        )}

        {/* 内容区域 - 智能布局：标签与文本同行，空间不足时自然换行 */}
        <div className="flex-1 min-w-0 relative">
          {!isSearchNode && (
            <QuickActionButton
              nodeId={nodeId}
              hasContent={!!node.content?.trim()}
              className="absolute right-0 top-0.5 z-10"
            />
          )}

          {isSearchNode ? (
            <NodeSearch
              name={searchConfig?.label}
              resultCount={searchResultCount}
              isLoading={searchLoading}
              hasError={!!searchError}
              errorMessage={searchError ?? undefined}
              hasConditions={hasSearchConditions}
              isCollapsed={effectiveCollapsed}
              onRefresh={(e) => {
                e.stopPropagation();
                nodeSearch.handleExecuteSearch();
              }}
              onOpenConfig={(e) => {
                e.stopPropagation();
                nodeSearch.handleOpenSearchConfig();
              }}
            />
          ) : (
            <NodeContent
              nodeContent={node.content}
              showEditableContent={showEditableContent}
              contentRef={contentRef}
              editorRef={editorRef}
              onInput={handleContentChange}
              onEditorChange={handleUnifiedEditorChange}
              onMentionTrigger={handleUnifiedMentionTrigger}
              onHashTrigger={handleUnifiedHashTrigger}
              onHashDismiss={handleUnifiedHashDismiss}
              onPlainEnter={handlePlainEnter}
              onKeyDown={handleKeyDown}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              onRowClick={handleRowClick}
              typeTags={typeTags}
              onRemoveTag={handleRemoveTag}
              onTagClick={() => openPanel(nodeId)}
              references={node.references}
            />
          )}

        </div>

        {/* 右侧悬浮「解构」入口：仅普通文本节点、候选内容且 LLM 建议解构时展示 */}
        {!isSearchNode && (
          <DeconstructHoverButton nodeId={nodeId} content={node.content ?? ''} />
        )}
      </div>

      {/* 字段表格区域 - 有标签时显示，带明显的视觉区分（非AI指令节点） */}
      {!isSearchNode && (
        <NodeFields
          node={node}
          nodeId={nodeId}
          depth={depth}
          nodeTags={nodeTags}
          getFieldDefinitions={getFieldDefinitions}
          onFieldChange={handleFieldChange}
          isCollapsed={effectiveCollapsed}
        />
      )}

      {/* 智能解构：加载骨架 / 幽灵预览 + 接受·舍弃 */}
      {!isSearchNode && (quickActionExecuting && quickActionType === 'deconstruct' || previewEntry) && (
        <div
          className={cn(
            'mt-2 rounded-lg border-2 border-dashed overflow-hidden',
            quickActionExecuting
              ? 'border-purple-300 dark:border-purple-600 bg-purple-50/50 dark:bg-purple-950/20 animate-pulse'
              : 'border-gray-300 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-900/50'
          )}
          style={{ marginLeft: `${depth * 24 + 8}px` }}
        >
          {quickActionExecuting && quickActionType === 'deconstruct' ? (
            <div className="flex items-center gap-2 px-3 py-4 text-sm text-purple-600 dark:text-purple-400">
              <ListTree size={16} className="animate-pulse" />
              <span>正在解构为结构化子节点…</span>
            </div>
          ) : previewEntry ? (
            <>
              <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <ListTree size={12} />
                幽灵预览（确认后替换为正式节点）
              </div>
              <div className="py-2 pl-2">
                {previewEntry.nodes.map((n) => {
                  const d = (() => {
                    let dep = 0;
                    let cur: string | null = n.parentTempId;
                    while (cur) {
                      dep++;
                      const parent = previewEntry.nodes.find((x) => x.tempId === cur);
                      cur = parent?.parentTempId ?? null;
                    }
                    return dep;
                  })();
                  const tagLabel = n.supertagId ? (supertags[n.supertagId]?.name ?? n.supertagId) : null;
                  return (
                    <div
                      key={n.tempId}
                      className={cn(
                        'py-1 px-2 rounded text-sm text-gray-700 dark:text-gray-200',
                        'border-l-2 border-transparent'
                      )}
                      style={{ marginLeft: `${d * 16}px`, borderLeftColor: tagLabel ? 'var(--color-accent)' : undefined }}
                    >
                      {tagLabel && (
                        <span className="text-xs text-purple-600 dark:text-purple-400 mr-2">#{tagLabel}</span>
                      )}
                      {n.content}
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-end gap-2 px-3 py-2 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreview(nodeId, null);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <X size={14} />
                  舍弃
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    applyDeconstructPreview(nodeId, previewEntry.nodes);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-md bg-purple-600 text-white hover:bg-purple-700"
                >
                  <Check size={14} />
                  接受并替换
                </button>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* 智能扩写：幽灵预览 + 确认/舍弃 */}
      {!isSearchNode && (quickActionExecuting && quickActionType === 'expand' || expandPreviewEntry) && (
        <div
          className={cn(
            'mt-2 rounded-lg border-2 border-dashed overflow-hidden',
            quickActionExecuting
              ? 'border-purple-300 dark:border-purple-600 bg-purple-50/50 dark:bg-purple-950/20 animate-pulse'
              : 'border-gray-300 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-900/50'
          )}
          style={{ marginLeft: `${depth * 24 + 8}px` }}
        >
          {quickActionExecuting && quickActionType === 'expand' ? (
            <div className="px-3 py-4">
              <div className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400 mb-2">
                <Wand2 size={16} className="animate-pulse" />
                <span>正在智能扩写…</span>
              </div>
              {expandedContent ? (
                <div className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap border-l-2 border-purple-300 dark:border-purple-600 pl-3 py-1">
                  {expandedContent}
                </div>
              ) : (
                <div className="h-12 rounded bg-gray-200/50 dark:bg-gray-700/30 animate-pulse" />
              )}
            </div>
          ) : expandPreviewEntry ? (
            <>
              <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <Wand2 size={12} />
                幽灵预览（确认后替换节点内容）
              </div>
              <div className="px-3 py-3 text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
                {expandPreviewEntry.content}
              </div>
              <div className="flex justify-end gap-2 px-3 py-2 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandPreview(nodeId, null);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <X size={14} />
                  舍弃
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateNode(nodeId, { content: expandPreviewEntry.content });
                    setExpandPreview(nodeId, null);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-md bg-purple-600 text-white hover:bg-purple-700"
                >
                  <Check size={14} />
                  接受并替换
                </button>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* v4.0: 搜索节点的搜索结果区域 - 普通节点样式展示，子节点使用 search:nodeId 视图键 */}
      {isSearchNode && searchResultCount > 0 && !effectiveCollapsed && (
        <div 
          className="search-results-container mt-1"
          style={{ marginLeft: `${depth * 24 + 8}px` }}
        >
          <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-teal-600 dark:text-teal-400 border-l-2 border-teal-300 dark:border-teal-600 bg-teal-50/50 dark:bg-teal-950/20 rounded-r-md mb-1">
            <Search size={12} />
            <span className="font-medium">搜索结果</span>
            <span className="text-gray-400 dark:text-gray-500">
              ({searchResultCount} 条)
            </span>
          </div>
          <div className="border-l-2 border-teal-200 dark:border-teal-700 ml-2 pl-1 rounded-bl-lg">
            <CollapseViewKeyContext.Provider value={`search:${nodeId}`}>
              {searchResultIds.map((resultNodeId) => (
                <NodeComponent
                  key={`${nodeId}-search-result-${resultNodeId}`}
                  nodeId={resultNodeId}
                  depth={depth + 1}
                  onBulletClick={onBulletClick}
                />
              ))}
            </CollapseViewKeyContext.Provider>
          </div>
        </div>
      )}

      {/* 普通节点的子节点区域 */}
      {!isSearchNode && hasChildren && !effectiveCollapsed && (
        <div className="children-container mt-1">
          {node.childrenIds
            .filter((childId) => nodes[childId])
            .map((childId) => (
              <NodeComponent
                key={childId}
                nodeId={childId}
                depth={depth + 1}
                onBulletClick={onBulletClick}
              />
            ))}
        </div>
      )}

      {/* 右键菜单 */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={handleCloseContextMenu}
          onDelete={handleDeleteFromContext}
          onCopy={handleCopyNode}
          onCut={handleCutNode}
          onAddTag={handleAddTagFromContext}
          onIndent={handleIndentFromContext}
          onOutdent={handleOutdentFromContext}
          onAddChild={handleAddChild}
          onInsertReference={handleInsertReferenceFromContext}
          onAddSearchNode={handleAddSearchNodeFromContext}
          canIndent={(() => {
            // 检查是否可以缩进：需要有前一个兄弟节点
            const siblings = node?.parentId === null ? rootIds : (nodes[node?.parentId || '']?.childrenIds || []);
            const currentIndex = siblings.indexOf(nodeId);
            return currentIndex > 0;
          })()}
          canOutdent={node?.parentId !== null} // 只有非根节点才能反缩进
        />
      )}
      
      <SlashCommandMenu
        open={showSlashMenu}
        position={slashMenuPosition}
        onClose={() => setShowSlashMenu(false)}
        onSelect={handleSlashCommandSelect}
        commandGroups={slashCommandGroups}
      />

      {/* @ 引用弹窗 */}
      <MentionPopover
        open={showMentionPopover}
        onClose={handleCloseMentionPopover}
        onSelect={handleMentionSelect}
        position={mentionPosition}
        excludeNodeId={nodeId}
      />
      
      {/* 统一标签选择器 */}
      <UnifiedTagSelector
        open={showTagSelector}
        onClose={() => {
          setShowTagSelector(false);
          setTagSearchTerm('');
        }}
        onSelectTag={handleUnifiedTagSelect}
        position={tagSelectorPosition}
        initialSearchTerm={tagSearchTerm}
        excludeTagIds={node?.tags || []}
        recentTags={getRecentTags(5)}
      />
      
      {/* v4.0: 搜索节点配置弹窗 */}
      <SearchConfigModal
        open={nodeSearch.showSearchConfig}
        initialConfig={nodeSearch.searchConfigForModal}
        onClose={nodeSearch.handleCloseSearchConfig}
        onSave={nodeSearch.handleSearchConfigConfirm}
      />
    </div>
  );
});

NodeComponent.displayName = 'NodeComponent';

export default NodeComponent;