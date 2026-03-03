'use client';

import React, { useRef, useEffect, memo, useCallback, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FEATURE_FLAGS } from '@/lib/feature-flags';
import { useNodeStore } from '@/stores/nodeStore';
import { useSupertagStore } from '@/stores/supertagStore';
import ContextMenu from './ContextMenu';
import MentionPopover from './MentionPopover';
import UnifiedTagSelector from './UnifiedTagSelector';
import CommandConfigModal from './CommandConfigModal';
import { NodeReference, CommandConfig } from '@/types';
import BacklinksBadge from './BacklinksBadge';
import { createReferenceText, hasReferences } from '@/utils/reference-helpers';
import { analyzeNavigationTarget } from '@/utils/navigation';
import { getTemplateById } from '@/utils/command-templates';
import { useNodeCommand } from '@/hooks/useNodeCommand';
import { NodeActions, NodeCommand, NodeContent, NodeFields, NodeReferences } from './node';

interface NodeComponentProps {
  nodeId: string;
  depth: number;
  onFocusPrevious?: () => void;
  onFocusNext?: () => void;
  /** 自定义 bullet 点击行为（用于查询面板场景，点击跳转到主页面） */
  onBulletClick?: (nodeId: string) => void;
}

const NodeComponent: React.FC<NodeComponentProps> = memo(({ nodeId, depth, onFocusPrevious, onFocusNext, onBulletClick }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [tagSelectorPosition, setTagSelectorPosition] = useState({ x: 0, y: 0 });  // 标签选择器位置
  const [tagSearchTerm, setTagSearchTerm] = useState('');  // 标签搜索词
  const [cursorPosition, setCursorPosition] = useState<number>(0);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isComposing, setIsComposing] = useState(false); // 中文输入法组合状态
  const [selectedTagIndex, setSelectedTagIndex] = useState(0); // 标签选择索引
  const [showMentionPopover, setShowMentionPopover] = useState(false); // @ 引用弹窗
  const [mentionPosition, setMentionPosition] = useState({ x: 0, y: 0 }); // 引用弹窗位置
  const [isEditing, setIsEditing] = useState(false); // 是否正在编辑
  const [localContent, setLocalContent] = useState(''); // 本地编辑内容

  const node = useNodeStore((state) => state.nodes[nodeId]);
  const focusedNodeId = useNodeStore((state) => state.focusedNodeId);
  const nodes = useNodeStore((state) => state.nodes);
  const rootIds = useNodeStore((state) => state.rootIds);
  const updateNode = useNodeStore((state) => state.updateNode);
  const applySupertag = useNodeStore((state) => state.applySupertag);
  const addNode = useNodeStore((state) => state.addNode);
  const addCommandNode = useNodeStore((state) => state.addCommandNode);
  const executeCommandNode = useNodeStore((state) => state.executeCommandNode);
  const deleteNode = useNodeStore((state) => state.deleteNode);
  const indentNode = useNodeStore((state) => state.indentNode);
  const outdentNode = useNodeStore((state) => state.outdentNode);
  const toggleCollapse = useNodeStore((state) => state.toggleCollapse);
  const setFocusedNode = useNodeStore((state) => state.setFocusedNode);
  const setHoistedNode = useNodeStore((state) => state.setHoistedNode);
  
  const supertags = useSupertagStore((state) => state.supertags);
  const getFieldDefinitions = useSupertagStore((state) => state.getFieldDefinitions);
  const trackTagUsage = useSupertagStore((state) => state.trackTagUsage);
  const getRecentTags = useSupertagStore((state) => state.getRecentTags);

  const nodeCommand = useNodeCommand(nodeId);

  // 当此节点获得焦点时，聚焦 contentEditable
  const isFocused = focusedNodeId === nodeId;
  
  // 同步本地内容
  useEffect(() => {
    if (node?.content !== undefined) {
      setLocalContent(node.content);
    }
  }, [node?.content]);

  // 当此节点获得焦点时，聚焦 contentEditable
  useEffect(() => {
    if (focusedNodeId === nodeId && contentRef.current) {
      contentRef.current.focus();
      // 恢复光标位置
      const range = document.createRange();
      const selection = window.getSelection();
      const textNode = contentRef.current.firstChild;
      
      if (textNode && textNode.nodeType === window.Node.TEXT_NODE) {
        const position = Math.min(cursorPosition, textNode.textContent?.length || 0);
        range.setStart(textNode, position);
        range.setEnd(textNode, position);
      } else {
        range.selectNodeContents(contentRef.current);
        range.collapse(false);
      }
      
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  }, [focusedNodeId, nodeId, cursorPosition]);

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

  // 保存光标位置
  const saveCursorPosition = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      setCursorPosition(range.startOffset);
    }
  }, []);

  // 单击行区域时进入编辑模式，光标定位到点击位置
  const handleRowClick = useCallback((e: React.MouseEvent) => {
    // 点击标签区域不触发编辑
    const target = e.target as HTMLElement;
    if (target.closest('.tag-badge') || target.closest('.tag-selector')) return;
    
    // 如果点击的是引用块按钮，不触发编辑模式（让引用块处理跳转）
    if (target.closest('[data-reference-chip]')) return;
    
    // 如果点击的是 contentEditable 区域，浏览器会自动处理光标定位
    if (target.closest('[contenteditable]')) return;
    
    // 点击行内其他区域时（包括引用渲染区域），切换到编辑模式
    setFocusedNode(nodeId);
    setIsEditing(true);
    
    setTimeout(() => {
      if (contentRef.current) {
        contentRef.current.focus();
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(contentRef.current);
        range.collapse(false); // 移动到末尾
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }, 10);
  }, [nodeId, setFocusedNode]);

  const handleContentChange = useCallback(() => {
    // 如果正在进行中文输入法组合，不处理
    if (isComposing) return;
    
    if (contentRef.current) {
      const newContent = contentRef.current.textContent || '';
      
      // 同步到本地状态
      setLocalContent(newContent);
      
      if (newContent !== node?.content) {
        saveCursorPosition();
        
        updateNode(nodeId, { content: newContent });
        
        // 检查是否输入了 # 触发标签选择
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const textBeforeCursor = newContent.substring(0, range.startOffset);
          
          // # 触发统一标签选择器
          // 支持 # 后直接弹出，也支持 #xxx 进行搜索
          const hashMatch = textBeforeCursor.match(/#([^\s#]*)$/);
          if (hashMatch) {
            // 获取光标位置作为弹窗位置
            const rect = range.getBoundingClientRect();
            setTagSelectorPosition({
              x: rect.left - (hashMatch[1]?.length || 0) * 8,  // 回退到 # 位置
              y: rect.bottom + 4,
            });
            setTagSearchTerm(hashMatch[1] || '');  // 传递 # 后的搜索词
            setShowTagSelector(true);
          } else if (showTagSelector) {
            // 如果输入的不是 # 开头，关闭选择器
            setShowTagSelector(false);
            setTagSearchTerm('');
          }
          
          // @ 触发引用选择 (保持不变)
          if (textBeforeCursor.endsWith('@')) {
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
  }, [nodeId, node?.content, updateNode, saveCursorPosition, isComposing, showTagSelector]);

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
  }, [nodeId, node?.content, node, updateNode, saveCursorPosition]);

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
      
      const updates: { tags: string[]; fields?: Record<string, any> } = {
        tags: [...node.tags, tagId]
      };
      
      // 如果标签有状态字段且节点当前没有状态值，自动设为"待办"
      if (hasStatusField && !node.fields.status) {
        updates.fields = {
          ...node.fields,
          status: '待办'
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
        setLocalContent(newContent);
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
          updateNode(nodeId, { fields: { ...node.fields, status: '待办' } });
        }
      }
    }
    
    setShowTagSelector(false);
    setTagSearchTerm('');
    
    // 恢复焦点
    setTimeout(() => contentRef.current?.focus(), 50);
  }, [node, nodeId, updateNode, applySupertag, supertags, trackTagUsage, getFieldDefinitions]);
  
  // 统一标签选择器回调 - 创建新标签（仅支持功能标签）
  const handleUnifiedTagCreate = useCallback((name: string, tagType: 'type' | 'context') => {
    // 移除内容中的 # 及搜索词
    if (contentRef.current) {
      const content = contentRef.current.textContent || '';
      const hashPattern = /#[^\s#]*$/;
      if (hashPattern.test(content)) {
        const newContent = content.replace(hashPattern, '').trimEnd();
        contentRef.current.textContent = newContent;
        setLocalContent(newContent);
        updateNode(nodeId, { content: newContent });
      }
    }
    
    if (!node) return;
    
    // 功能标签需要通过 supertagStore 创建（暂不支持快捷创建）
    console.log('Creating tag is not supported yet:', name, tagType);
    
    setShowTagSelector(false);
    setTagSearchTerm('');
    
    // 恢复焦点
    setTimeout(() => contentRef.current?.focus(), 50);
  }, [node]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // 如果正在进行中文输入法组合，不处理快捷键
    if (isComposing) return;
    
    // 标签选择器打开时的键盘导航
    if (showTagSelector) {
      // 过滤掉系统标签和已添加的标签
      const availableTagsList = Object.values(supertags).filter(tag => !tag.isSystem && !node?.tags.includes(tag.id));
      
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
    
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      
      // 检测 /ai 快捷指令 - 仅在功能启用时生效
      const content = contentRef.current?.textContent?.trim() || '';
      if (FEATURE_FLAGS.AI_COMMAND_NODE && content.toLowerCase() === '/ai') {
        if (contentRef.current) {
          contentRef.current.textContent = '';
        }
        updateNode(nodeId, { content: '' });
        nodeCommand.openCommandConfigAndDeleteCurrentAfterCreate();
        return;
      } else if (FEATURE_FLAGS.AI_COMMAND_NODE && content.toLowerCase().startsWith('/ai ')) {
        // 如果有自定义 prompt，直接创建
        const customPrompt = content.slice(4).trim();
        
        // 清空当前节点内容
        if (contentRef.current) {
          contentRef.current.textContent = '';
        }
        updateNode(nodeId, { content: '' });
        
        // 在当前节点位置创建指令节点
        addCommandNode(node?.parentId || null, undefined, customPrompt, nodeId);
        
        // 删除当前空节点
        deleteNode(nodeId);
        return;
      }
      
      // 在当前节点后创建同级新节点
      addNode(node?.parentId || null, nodeId);
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
        // 如果内容为空，删除节点并聚焦上一个
        const siblings = node?.parentId === null ? rootIds : (nodes[node?.parentId || '']?.childrenIds || []);
        const currentIndex = siblings.indexOf(nodeId);
        
        if (currentIndex > 0) {
          // 聚焦上一个兄弟节点
          setFocusedNode(siblings[currentIndex - 1]);
        } else if (node?.parentId) {
          // 聚焦父节点
          setFocusedNode(node.parentId);
        }
        
        deleteNode(nodeId);
      }
    } else if (e.key === 'Escape') {
      setShowTagSelector(false);
    }
    // 注意：移除了 ArrowUp/ArrowDown 的拦截，让光标可以在文本内自由移动
  }, [node, nodeId, rootIds, nodes, addNode, addCommandNode, updateNode, indentNode, outdentNode, deleteNode, setFocusedNode, saveCursorPosition, isComposing, showTagSelector, supertags, selectedTagIndex, handleAddTag, nodeCommand]);

  const handleFocus = useCallback(() => {
    setFocusedNode(nodeId);
    setIsEditing(true);
  }, [nodeId, setFocusedNode]);
  
  const handleBlur = useCallback(() => {
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
    // 确保父节点展开
    if (node?.isCollapsed) {
      updateNode(nodeId, { isCollapsed: false });
    }
    addNode(nodeId); // parentId 是当前节点，没有 afterId 表示添加到末尾
  }, [nodeId, node?.isCollapsed, updateNode, addNode]);

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

  // 生成唯一 ID
  const generateRefId = useCallback(() => {
    return `ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }, []);

  // 处理引用选择 - 改为添加独立引用
  const handleMentionSelect = useCallback((targetNodeId: string, targetTitle: string) => {
    if (!node) return;
    
    // 移除触发的 @ 符号
    if (contentRef.current) {
      let content = contentRef.current.textContent || '';
      if (content.endsWith('@')) {
        content = content.slice(0, -1);
        contentRef.current.textContent = content;
        setLocalContent(content);
        updateNode(nodeId, { content });
      }
    }
    
    // 创建独立引用对象
    const newReference: NodeReference = {
      id: generateRefId(),
      targetNodeId,
      title: targetTitle.slice(0, 100).trim() || '未命名节点',
      createdAt: Date.now(),
    };
    
    // 添加到 references 数组
    const currentRefs = node.references || [];
    // 检查是否已存在相同引用
    const alreadyExists = currentRefs.some(ref => ref.targetNodeId === targetNodeId);
    if (!alreadyExists) {
      updateNode(nodeId, { 
        references: [...currentRefs, newReference] 
      });
    }
    
    // 关闭弹窗
    setShowMentionPopover(false);
    
    // 聚焦回输入框
    setTimeout(() => {
      contentRef.current?.focus();
    }, 0);
  }, [node, nodeId, updateNode, generateRefId]);
  
  // 移除独立引用
  const handleRemoveReference = useCallback((refId: string) => {
    if (!node) return;
    const currentRefs = node.references || [];
    const newRefs = currentRefs.filter(ref => ref.id !== refId);
    updateNode(nodeId, { references: newRefs });
  }, [node, nodeId, updateNode]);

  // 关闭引用弹窗
  const handleCloseMentionPopover = useCallback(() => {
    setShowMentionPopover(false);
  }, []);



  // 更新字段值
  const handleFieldChange = useCallback((fieldKey: string, value: any) => {
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

  if (!node) return null;

  const hasChildren = node.childrenIds.length > 0;
  // 功能标签 (Type Tags) - 胶囊样式（所有非系统标签都是功能标签）
  const typeTags = node.tags.map(tagId => supertags[tagId]).filter(tag => tag && !tag.isSystem);
  // 向后兼容：旧的 nodeTags
  const nodeTags = node.tags.map(tagId => supertags[tagId]).filter(Boolean);
  // 过滤掉系统标签和已添加的标签
  const availableTags = Object.values(supertags).filter(tag => !tag.isSystem && !node.tags.includes(tag.id));
  
  // 检查内容是否包含引用
  const contentHasReferences = hasReferences(node?.content || '');
  
  // 决定是否显示编辑模式
  // 只有在实际编辑时（isEditing 为 true，即正在输入）才显示原始文本
  // 如果有引用且不在编辑状态，则渲染引用块
  const showEditableContent = isEditing || !contentHasReferences;
  
  const isCommandNode = node.type === 'command';
  const commandConfig = isCommandNode ? (node.payload as CommandConfig) : null;
  const commandTemplate = commandConfig?.templateId ? getTemplateById(commandConfig.templateId) : null;

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
    
    // 如果没有子节点且当前是折叠状态，点击时创建一个空子节点
    if (!hasChildren && node.isCollapsed) {
      const newChildId = addNode(nodeId);
      if (newChildId) {
        // 展开当前节点
        toggleCollapse(nodeId);
        // 聚焦到新创建的子节点
        setTimeout(() => {
          setFocusedNode(newChildId);
        }, 50);
      }
    } else {
      // 正常的展开/折叠操作
      toggleCollapse(nodeId);
    }
  }, [nodeId, hasChildren, node.isCollapsed, addNode, toggleCollapse, setFocusedNode]);

  return (
    <div className="node-container">
      {/* 节点主行 - 标题和标签 */}
      <div
        className={cn(
          "node-row group flex items-start py-1 px-2 rounded-lg transition-all duration-150",
          // AI 指令节点特殊样式
          isCommandNode 
            ? cn(
                "bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30",
                "border-l-4 border-purple-400 dark:border-purple-500",
                "shadow-sm",
                isFocused && "ring-2 ring-purple-300 dark:ring-purple-600"
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
          isCommandNode={isCommandNode}
          hasChildren={hasChildren}
          isCollapsed={node.isCollapsed}
          hasNodeTags={nodeTags.length > 0}
          onCollapseClick={handleCollapseClick}
          onBulletClick={handleBulletClick}
        />

        {/* 内容区域 - 智能布局：标签与文本同行，空间不足时自然换行 */}
        <div className="flex-1 min-w-0 relative">
          {/* AI 指令节点专用内容区域 */}
          {isCommandNode ? (
            <NodeCommand
              icon={commandTemplate?.icon}
              name={commandTemplate?.name}
              isExecuting={nodeCommand.isExecuting}
              lastExecutionStatus={commandConfig?.lastExecutionStatus}
              prompt={commandConfig?.prompt}
              lastError={commandConfig?.lastError}
              isCollapsed={node.isCollapsed}
              onExecute={(e) => {
                e.stopPropagation();
                nodeCommand.handleExecuteCommand();
              }}
              onOpenConfig={(e) => {
                e.stopPropagation();
                nodeCommand.handleOpenCommandConfig();
              }}
            />
          ) : (
            <NodeContent
              nodeContent={node.content}
              showEditableContent={showEditableContent}
              contentRef={contentRef}
              onInput={handleContentChange}
              onKeyDown={handleKeyDown}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              onRowClick={handleRowClick}
              typeTags={typeTags}
              onRemoveTag={handleRemoveTag}
              onOpenTagSelector={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                setTagSelectorPosition({
                  x: rect.left,
                  y: rect.bottom + 4,
                });
                setTagSearchTerm('');
                setShowTagSelector(true);
              }}
              backlinksBadge={<BacklinksBadge nodeId={nodeId} className="flex-shrink-0" />}
            />
          )}

          {/* 第二行：独立引用区块 - 与正文分离，换行单独展示 */}
          {!isCommandNode && node.references && (
            <NodeReferences
              nodeId={nodeId}
              references={node.references}
              onRemove={handleRemoveReference}
              isEditing={isEditing && isFocused}
              onAdd={() => {
                if (contentRef.current) {
                  const rect = contentRef.current.getBoundingClientRect();
                  setMentionPosition({
                    x: rect.left,
                    y: rect.bottom + 4,
                  });
                }
                setShowMentionPopover(true);
              }}
            />
          )}
        </div>
      </div>

      {/* 字段表格区域 - 有标签时显示，带明显的视觉区分（非AI指令节点） */}
      {!isCommandNode && (
        <NodeFields
          node={node}
          nodeId={nodeId}
          depth={depth}
          nodeTags={nodeTags}
          getFieldDefinitions={getFieldDefinitions}
          onFieldChange={handleFieldChange}
        />
      )}

      {/* AI指令节点的子节点区域 - 特殊样式 */}
      {isCommandNode && hasChildren && !node.isCollapsed && (
        <div 
          className="ai-response-container mt-1"
          style={{ marginLeft: `${depth * 24 + 8}px` }}
        >
          {/* AI 响应区域标题 */}
          <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-purple-600 dark:text-purple-400 border-l-2 border-purple-300 dark:border-purple-600 bg-purple-50/50 dark:bg-purple-950/20 rounded-r-md mb-1">
            <Sparkles size={12} />
            <span className="font-medium">AI 生成内容</span>
            <span className="text-gray-400 dark:text-gray-500">
              ({node.childrenIds.length} 条)
            </span>
          </div>
          {/* AI 生成的子节点（可编辑） */}
          <div className="border-l-2 border-purple-200 dark:border-purple-700 ml-2 pl-1 rounded-bl-lg">
            {node.childrenIds.map((childId) => (
              <NodeComponent
                key={childId}
                nodeId={childId}
                depth={depth + 1}
                onBulletClick={onBulletClick}
              />
            ))}
          </div>
        </div>
      )}

      {/* 普通节点的子节点区域 */}
      {!isCommandNode && hasChildren && !node.isCollapsed && (
        <div className="children-container mt-1">
          {node.childrenIds.map((childId) => (
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
          onAddCommandNode={nodeCommand.handleAddCommandNodeFromContext}
          canIndent={(() => {
            // 检查是否可以缩进：需要有前一个兄弟节点
            const siblings = node?.parentId === null ? rootIds : (nodes[node?.parentId || '']?.childrenIds || []);
            const currentIndex = siblings.indexOf(nodeId);
            return currentIndex > 0;
          })()}
          canOutdent={node?.parentId !== null} // 只有非根节点才能反缩进
        />
      )}
      
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
        onCreateTag={handleUnifiedTagCreate}
        position={tagSelectorPosition}
        initialSearchTerm={tagSearchTerm}
        excludeTagIds={node?.tags || []}
        recentTags={getRecentTags(5)}
      />
      
      {/* AI 指令配置弹窗 */}
      <CommandConfigModal
        open={nodeCommand.showCommandConfig}
        onClose={nodeCommand.handleCloseCommandConfig}
        onConfirm={nodeCommand.handleCommandConfigConfirm}
        initialConfig={nodeCommand.commandConfigForModal}
        mode={nodeCommand.pendingCommandNodeId ? 'edit' : 'create'}
      />
    </div>
  );
});

NodeComponent.displayName = 'NodeComponent';

export default NodeComponent;