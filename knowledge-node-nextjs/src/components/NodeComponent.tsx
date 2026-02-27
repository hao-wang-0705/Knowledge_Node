'use client';

import React, { useRef, useEffect, memo, useCallback, useState } from 'react';
import { ChevronRight, ChevronDown, GripVertical, Circle, Hash, X, Sparkles, Play, Loader2, CheckCircle2, AlertCircle, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNodeStore } from '@/stores/nodeStore';
import { useSupertagStore } from '@/stores/supertagStore';
import { useNotebookStore } from '@/stores/notebookStore';
import { usePerspectiveStore } from '@/stores/perspectiveStore';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import FieldEditor from './FieldEditor';
import ContextMenu from './ContextMenu';
import MentionPopover from './MentionPopover';
import UnifiedTagSelector from './UnifiedTagSelector';
import CommandConfigModal from './CommandConfigModal';
import { ContentWithReferences } from './ReferenceChip';
import { ReferenceBlock } from './ReferenceBlock';
import { NodeReference, CommandConfig } from '@/types';
import Backlinks from './Backlinks';
import BacklinksBadge from './BacklinksBadge';
import { createReferenceText, hasReferences } from '@/utils/reference-helpers';
import { analyzeNavigationTarget } from '@/utils/navigation';
import { getTemplateById } from '@/utils/command-templates';
import { getTagStyle } from '@/utils/tag-styles';

interface NodeComponentProps {
  nodeId: string;
  depth: number;
  onFocusPrevious?: () => void;
  onFocusNext?: () => void;
}

const NodeComponent: React.FC<NodeComponentProps> = memo(({ nodeId, depth, onFocusPrevious, onFocusNext }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const tagMenuRef = useRef<HTMLDivElement>(null);
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
  const [isExecuting, setIsExecuting] = useState(false); // AI 指令执行中
  const [showCommandConfig, setShowCommandConfig] = useState(false); // 指令配置弹窗
  const [pendingCommandNodeId, setPendingCommandNodeId] = useState<string | null>(null); // 待配置的指令节点ID
  const [deleteAfterCommandCreate, setDeleteAfterCommandCreate] = useState(false); // 创建后是否删除当前节点（/ai 触发）
  
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
  const getResolvedFieldDefinitions = useSupertagStore((state) => state.getResolvedFieldDefinitions);
  const trackTagUsage = useSupertagStore((state) => state.trackTagUsage);
  const getRecentTags = useSupertagStore((state) => state.getRecentTags);

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
      const defs = tag ? getResolvedFieldDefinitions(tag.id) ?? [] : [];
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
  }, [node, nodeId, updateNode, supertags, getResolvedFieldDefinitions]);

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
        const defs = tag ? getResolvedFieldDefinitions(tag.id) ?? [] : [];
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
  }, [node, nodeId, updateNode, applySupertag, supertags, trackTagUsage, getResolvedFieldDefinitions]);
  
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
      
      // 检测 /ai 快捷指令
      const content = contentRef.current?.textContent?.trim() || '';
      if (content.toLowerCase() === '/ai') {
        // 清空当前节点内容
        if (contentRef.current) {
          contentRef.current.textContent = '';
        }
        updateNode(nodeId, { content: '' });
        
        // 打开配置弹窗而不是直接创建
        setPendingCommandNodeId(null);
        setDeleteAfterCommandCreate(true); // 标记创建后删除当前空节点
        setShowCommandConfig(true);
        return;
      } else if (content.toLowerCase().startsWith('/ai ')) {
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
  }, [node, nodeId, rootIds, nodes, addNode, addCommandNode, updateNode, indentNode, outdentNode, deleteNode, setFocusedNode, saveCursorPosition, isComposing, showTagSelector, supertags, selectedTagIndex, handleAddTag]);

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
    // 获取光标位置，如果没有则使用节点末尾
    if (contentRef.current) {
      const rect = contentRef.current.getBoundingClientRect();
      setMentionPosition({
        x: rect.left,
        y: rect.bottom + 4,
      });
    }
    setShowMentionPopover(true);
  }, []);

  // 从右键菜单创建指令节点 - 先打开配置弹窗
  const handleAddCommandNodeFromContext = useCallback(() => {
    // 打开配置弹窗，而不是直接创建
    setPendingCommandNodeId(null); // 表示这是新建模式
    setShowCommandConfig(true);
  }, []);

  // 打开现有指令节点的配置弹窗
  const handleOpenCommandConfig = useCallback(() => {
    if (node?.type === 'command') {
      setPendingCommandNodeId(nodeId);
      setShowCommandConfig(true);
    }
  }, [node?.type, nodeId]);

  // 处理指令配置确认
  const handleCommandConfigConfirm = useCallback((config: { templateId?: string; prompt: string }) => {
    if (pendingCommandNodeId) {
      // 编辑现有指令节点
      const existingNode = nodes[pendingCommandNodeId];
      if (existingNode && existingNode.type === 'command') {
        const existingConfig = existingNode.payload as CommandConfig;
        const template = config.templateId ? getTemplateById(config.templateId) : undefined;
        updateNode(pendingCommandNodeId, {
          content: template ? `🤖 ${template.icon} ${template.name}` : '🤖 自定义指令',
          payload: {
            ...existingConfig,
            templateId: config.templateId,
            prompt: config.prompt,
          },
        });
      }
    } else {
      // 创建新指令节点
      addCommandNode(node?.parentId || null, config.templateId, config.prompt, nodeId);
      
      // 如果是通过 /ai 触发的，删除当前空节点
      if (deleteAfterCommandCreate) {
        deleteNode(nodeId);
      }
    }
    setShowCommandConfig(false);
    setPendingCommandNodeId(null);
    setDeleteAfterCommandCreate(false);
  }, [pendingCommandNodeId, nodes, node?.parentId, nodeId, updateNode, addCommandNode, deleteAfterCommandCreate, deleteNode]);

  // 关闭配置弹窗
  const handleCloseCommandConfig = useCallback(() => {
    setShowCommandConfig(false);
    setPendingCommandNodeId(null);
    setDeleteAfterCommandCreate(false);
  }, []);

  // 执行 AI 指令
  const handleExecuteCommand = useCallback(async () => {
    if (!node || node.type !== 'command' || isExecuting) return;
    
    // 检查是否配置了 prompt
    const config = node.payload as CommandConfig;
    if (!config?.prompt && !config?.templateId) {
      // 打开配置弹窗
      setPendingCommandNodeId(nodeId);
      setShowCommandConfig(true);
      return;
    }
    
    setIsExecuting(true);
    try {
      await executeCommandNode(nodeId);
    } catch (error) {
      // 错误已经保存到节点的 lastError 中，这里可以添加额外的通知
      console.error('[handleExecuteCommand] AI 执行失败:', error);
    } finally {
      setIsExecuting(false);
    }
  }, [node, nodeId, executeCommandNode, isExecuting]);

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
            const defs = tag ? getResolvedFieldDefinitions(tag.id) ?? [] : [];
            return !defs.some(field => field.key === key);
          })
        )
      });
    }
  }, [node, nodeId, updateNode, supertags, getResolvedFieldDefinitions]);

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
  
  // 检查是否为AI指令节点
  const isCommandNode = node.type === 'command';
  const commandConfig = isCommandNode ? (node.payload as CommandConfig) : null;
  const commandTemplate = commandConfig?.templateId ? getTemplateById(commandConfig.templateId) : null;

  // 点击圆点进入聚焦模式（Deep Focus）
  const handleBulletClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // 任何节点都可以聚焦进入
    setHoistedNode(nodeId);
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
        {/* 左侧操作区 */}
        <div className="flex items-center gap-0.5 mr-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            className="p-0.5 text-gray-400 hover:text-gray-600 cursor-grab"
            title="拖拽排序"
          >
            <GripVertical size={14} />
          </button>
        </div>

        {/* AI指令节点专用图标 / 折叠按钮（始终显示）+ 圆点（可点击进入聚焦模式） */}
        <div className="flex items-center mr-1 mt-0.5 flex-shrink-0">
          {isCommandNode ? (
            <>
              {/* AI 指令节点专用图标 */}
              <div className="flex items-center justify-center w-5 h-5 rounded bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-sm">
                <Sparkles size={12} />
              </div>
              {/* 展开/收起按钮 */}
              {hasChildren && (
                <button
                  onClick={handleCollapseClick}
                  className="flex items-center justify-center w-5 h-5 rounded text-purple-600 hover:text-purple-700 hover:bg-purple-100 dark:text-purple-400 dark:hover:bg-purple-900/30 ml-0.5"
                  title={node.isCollapsed ? "展开 AI 响应" : "折叠 AI 响应"}
                >
                  {node.isCollapsed ? (
                    <ChevronRight size={16} />
                  ) : (
                    <ChevronDown size={16} />
                  )}
                </button>
              )}
            </>
          ) : (
            <>
              {/* 展开/收起按钮 - 所有节点都显示 */}
              <button
                onClick={handleCollapseClick}
                className={cn(
                  "flex items-center justify-center w-5 h-5 rounded transition-colors cursor-pointer",
                  hasChildren || nodeTags.length > 0
                    ? "text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                    : "text-gray-300 hover:text-gray-500 hover:bg-gray-100 dark:text-gray-600 dark:hover:text-gray-400 dark:hover:bg-gray-700"
                )}
            title={hasChildren 
              ? (node.isCollapsed ? "展开" : "折叠") 
              : "点击创建子节点"
            }
          >
            {node.isCollapsed ? (
              <ChevronRight size={16} className="transition-transform" />
            ) : (
              <ChevronDown size={16} className="transition-transform" />
            )}
          </button>
          
          {/* 圆点 - 单击进入聚焦模式 */}
          <button
            onClick={handleBulletClick}
            className={cn(
              "flex items-center justify-center w-5 h-5 rounded transition-all",
              "text-gray-400 hover:text-blue-500 hover:scale-125 cursor-pointer",
              "group-hover:text-gray-500"
            )}
            title="点击进入聚焦模式"
          >
            <Circle size={6} className="fill-current" />
          </button>
            </>
          )}
        </div>

        {/* 内容区域 - 智能布局：标签与文本同行，空间不足时自然换行 */}
        <div className="flex-1 min-w-0 relative">
          {/* AI 指令节点专用内容区域 */}
          {isCommandNode ? (
            <div className="flex flex-col gap-2">
              {/* 指令标题行 */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-purple-700 dark:text-purple-300">
                  {commandTemplate?.icon || '🤖'} {commandTemplate?.name || '自定义指令'}
                </span>
                {/* 执行状态指示器 */}
                <div className="flex items-center gap-1">
                  {isExecuting && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 animate-pulse">
                      <Loader2 size={12} className="animate-spin" />
                      执行中...
                    </span>
                  )}
                  {!isExecuting && commandConfig?.lastExecutionStatus === 'pending' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                      <Circle size={8} className="fill-gray-400" />
                      待执行
                    </span>
                  )}
                  {!isExecuting && commandConfig?.lastExecutionStatus === 'success' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      <CheckCircle2 size={12} />
                      已完成
                    </span>
                  )}
                  {!isExecuting && commandConfig?.lastExecutionStatus === 'error' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      <AlertCircle size={12} />
                      执行失败
                    </span>
                  )}
                </div>
                {/* 操作按钮 */}
                <div className="flex items-center gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-6 px-2",
                      isExecuting
                        ? "text-gray-400 cursor-not-allowed"
                        : "text-purple-600 hover:text-purple-700 hover:bg-purple-100 dark:text-purple-400 dark:hover:bg-purple-900/30"
                    )}
                    title={isExecuting ? "执行中..." : "执行指令"}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExecuteCommand();
                    }}
                    disabled={isExecuting}
                  >
                    {isExecuting ? (
                      <Loader2 size={12} className="mr-1 animate-spin" />
                    ) : (
                      <Play size={12} className="mr-1" />
                    )}
                    {isExecuting ? '执行中' : '执行'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                    title="设置指令"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenCommandConfig();
                    }}
                  >
                    <Settings2 size={14} />
                  </Button>
                </div>
              </div>
              {/* Prompt 预览（折叠状态下隐藏详情） */}
              {commandConfig?.prompt && !node.isCollapsed && (
                <div className="text-sm text-gray-600 dark:text-gray-400 bg-white/50 dark:bg-gray-800/50 rounded-md px-3 py-2 border border-purple-200/50 dark:border-purple-700/30">
                  <div className="text-xs text-purple-500 dark:text-purple-400 mb-1 font-medium">📝 指令内容</div>
                  <div className="line-clamp-2">{commandConfig.prompt}</div>
                </div>
              )}
              {/* 错误信息显示 */}
              {commandConfig?.lastExecutionStatus === 'error' && commandConfig?.lastError && !node.isCollapsed && (
                <div className="text-sm bg-red-50 dark:bg-red-900/20 rounded-md px-3 py-2 border border-red-200 dark:border-red-800">
                  <div className="text-xs text-red-600 dark:text-red-400 mb-1 font-medium flex items-center gap-1">
                    <AlertCircle size={12} />
                    执行失败
                  </div>
                  <div className="text-red-700 dark:text-red-300 text-xs whitespace-pre-wrap">
                    {commandConfig.lastError}
                  </div>
                </div>
              )}
              {/* 未配置 Prompt 提示 */}
              {!commandConfig?.prompt && !commandConfig?.templateId && !node.isCollapsed && (
                <div className="text-sm bg-amber-50 dark:bg-amber-900/20 rounded-md px-3 py-2 border border-amber-200 dark:border-amber-800">
                  <div className="text-amber-700 dark:text-amber-300 text-xs">
                    ⚠️ 请点击设置按钮配置指令内容或选择模板
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* 普通节点内容区域 */
            <div className="flex items-center gap-2 flex-wrap">
              {/* 可编辑内容 / 引用渲染切换 */}
              {showEditableContent ? (
                <div className="relative flex-1 min-w-[120px]">
                  {/* 真实输入框 - 独占整行宽度 */}
                  <div
                    ref={contentRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={handleContentChange}
                    onKeyDown={handleKeyDown}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    onCompositionStart={handleCompositionStart}
                    onCompositionEnd={handleCompositionEnd}
                    className={cn(
                      "relative outline-none min-h-[24px] leading-6 text-gray-800 dark:text-gray-200 w-full",
                      "empty:before:content-['输入内容...'] empty:before:text-gray-400",
                      "bg-transparent"
                    )}
                    style={{ 
                      direction: 'ltr', 
                      textAlign: 'left',
                      unicodeBidi: 'plaintext'
                    }}
                    data-placeholder="输入内容..."
                  >
                    {node.content}
                  </div>
                </div>
              ) : (
                <div
                  onClick={handleRowClick}
                  className={cn(
                    "min-h-[24px] leading-6 text-gray-800 dark:text-gray-200 flex-1 min-w-[80px] cursor-text"
                  )}
                >
                  <ContentWithReferences content={node.content} />
                </div>
              )}

              {/* 标签区域 - 与文本在同一行，空间不足时自然换行 */}
              {typeTags.length > 0 && (
                <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
                  {/* 功能标签 (Type Tags) - 渐变胶囊样式 */}
                  {typeTags.map((tag) => {
                    // 使用统一的标签样式函数，支持预设标签和自定义标签
                    const typeStyle = getTagStyle(tag);
                    return (
                      <div
                        key={tag.id}
                        className="group/tag relative inline-flex items-center"
                      >
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full cursor-default select-none",
                            "shadow-sm transition-all duration-200",
                            "hover:shadow-md hover:scale-105",
                            typeStyle.gradient,
                            typeStyle.text
                          )}
                        >
                          <span className="text-sm">{typeStyle.icon}</span>
                          <span>{tag.name}</span>
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveTag(tag.id);
                          }}
                          className="absolute -right-1 -top-1 w-4 h-4 flex items-center justify-center rounded-full bg-gray-500 hover:bg-red-500 text-white opacity-0 group-hover/tag:opacity-100 transition-all shadow-sm"
                          title={`移除 #${tag.name}`}
                        >
                          <X size={10} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {/* 添加标签按钮 - 始终显示，触发统一标签选择器 */}
              <Button
                variant="ghost"
                size="sm"
                className="tag-selector opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 flex-shrink-0"
                title="添加标签 (#)"
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  setTagSelectorPosition({
                    x: rect.left,
                    y: rect.bottom + 4,
                  });
                  setTagSearchTerm('');
                  setShowTagSelector(true);
                }}
              >
                <Hash size={12} />
              </Button>
              
              {/* 反向链接徽标 - v2.2 新增，显示在标签区域之后 */}
              {!isCommandNode && (
                <BacklinksBadge 
                  nodeId={nodeId} 
                  className="flex-shrink-0"
                />
              )}
            </div>
          )}

          {/* 第二行：独立引用区块 - 与正文分离，换行单独展示 */}
          {!isCommandNode && (node.references && node.references.length > 0) && (
            <ReferenceBlock
              nodeId={nodeId}
              references={node.references}
              onRemove={handleRemoveReference}
              onAdd={() => {
                // 打开引用选择弹窗
                if (contentRef.current) {
                  const rect = contentRef.current.getBoundingClientRect();
                  setMentionPosition({
                    x: rect.left,
                    y: rect.bottom + 4,
                  });
                }
                setShowMentionPopover(true);
              }}
              readOnly={false}
              isEditing={isEditing && isFocused}
              maxDisplay={3}
            />
          )}
        </div>
      </div>

      {/* 字段表格区域 - 有标签时显示，带明显的视觉区分（非AI指令节点） */}
      {!isCommandNode && nodeTags.length > 0 && !node.isCollapsed && (
        <div 
          className="fields-container bg-slate-50/80 border-l-2 border-blue-200 rounded-r-lg my-1"
          style={{ marginLeft: `${depth * 24 + 44}px` }}
        >
          <div className="py-1">
            {nodeTags.map((tag) =>
              (getResolvedFieldDefinitions(tag.id) ?? []).map((fieldDef) => (
                <FieldEditor
                  key={fieldDef.id}
                  fieldDef={fieldDef}
                  value={node.fields[fieldDef.key]}
                  onChange={(value) => handleFieldChange(fieldDef.key, value)}
                  nodeId={nodeId}
                  tagId={tag.id}
                />
              ))
            )}
          </div>
          
          {/* 反向链接详情 - 在字段区域底部显示，默认折叠 */}
          <Backlinks nodeId={nodeId} className="px-3 pb-2" defaultExpanded={false} />
        </div>
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
          onAddCommandNode={handleAddCommandNodeFromContext}
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
        open={showCommandConfig}
        onClose={handleCloseCommandConfig}
        onConfirm={handleCommandConfigConfirm}
        initialConfig={pendingCommandNodeId 
          ? (nodes[pendingCommandNodeId]?.payload as CommandConfig) 
          : undefined
        }
        mode={pendingCommandNodeId ? 'edit' : 'create'}
      />
    </div>
  );
});

NodeComponent.displayName = 'NodeComponent';

export default NodeComponent;