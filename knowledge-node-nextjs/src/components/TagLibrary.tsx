'use client';

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { 
  X, Plus, Trash2, Edit2, Hash, ChevronRight, ChevronDown,
  Type, Calendar, List, Check, Pin, PinOff, Eye, Link2, 
  GripVertical, Sparkles, GitBranch, Circle, FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useSupertagStore } from '@/stores/supertagStore';
import { usePerspectiveStore } from '@/stores/perspectiveStore';
import { FieldType, Supertag, FieldDefinition } from '@/types';
import { TAG_COLORS } from '@/utils/mockData';

interface TagLibraryProps {
  open: boolean;
  onClose: () => void;
}

// 字段类型配置 - 包含 reference 类型
const FIELD_TYPES: { value: FieldType; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'text', label: '文本', icon: <Type size={14} />, description: '单行文本' },
  { value: 'number', label: '数字', icon: <Hash size={14} />, description: '数值类型' },
  { value: 'date', label: '日期', icon: <Calendar size={14} />, description: '日期选择' },
  { value: 'select', label: '单选', icon: <List size={14} />, description: '下拉选项' },
  { value: 'reference', label: '引用', icon: <Link2 size={14} />, description: '节点引用' },
];

const TagLibrary: React.FC<TagLibraryProps> = ({ open, onClose }) => {
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingTagName, setEditingTagName] = useState('');
  
  // 字段编辑状态
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [isAddingField, setIsAddingField] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  
  // 描述编辑状态
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [descriptionValue, setDescriptionValue] = useState('');
  
  // 模版编辑状态
  const [templateValue, setTemplateValue] = useState('');
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);

  const newTagInputRef = useRef<HTMLInputElement>(null);
  const editTagInputRef = useRef<HTMLInputElement>(null);
  const newFieldInputRef = useRef<HTMLInputElement>(null);

  const supertags = useSupertagStore((state) => state.supertags);
  const addSupertag = useSupertagStore((state) => state.addSupertag);
  const updateSupertag = useSupertagStore((state) => state.updateSupertag);
  const deleteSupertag = useSupertagStore((state) => state.deleteSupertag);
  const addFieldDefinition = useSupertagStore((state) => state.addFieldDefinition);
  const updateFieldDefinition = useSupertagStore((state) => state.updateFieldDefinition);
  const removeFieldDefinition = useSupertagStore((state) => state.removeFieldDefinition);
  const getResolvedFieldDefinitions = useSupertagStore((state) => state.getResolvedFieldDefinitions);

  // 透视相关
  const pinnedTagIds = usePerspectiveStore((state) => state.pinnedTagIds);
  const pinTag = usePerspectiveStore((state) => state.pinTag);
  const unpinTag = usePerspectiveStore((state) => state.unpinTag);
  const getViewType = usePerspectiveStore((state) => state.getViewType);

  // 获取非系统标签列表
  const userTags = Object.values(supertags).filter(tag => !tag.isSystem);
  const selectedTag = selectedTagId ? supertags[selectedTagId] : null;
  
  // 获取合并继承后的字段定义
  const resolvedFields = useMemo(() => {
    if (!selectedTagId) return [];
    return getResolvedFieldDefinitions(selectedTagId) || [];
  }, [selectedTagId, getResolvedFieldDefinitions, supertags]);
  
  // 获取父标签信息
  const parentTag = selectedTag?.parentId ? supertags[selectedTag.parentId] : null;
  
  // 获取可选的父标签列表（排除自己和自己的后代）
  const availableParentTags = useMemo(() => {
    if (!selectedTagId) return userTags;
    const descendantIds = useSupertagStore.getState().getDescendantIds(selectedTagId);
    return userTags.filter(tag => !descendantIds.includes(tag.id));
  }, [selectedTagId, userTags]);

  // 聚焦新标签输入框
  useEffect(() => {
    if (isAddingTag && newTagInputRef.current) {
      newTagInputRef.current.focus();
    }
  }, [isAddingTag]);

  // 聚焦编辑标签输入框
  useEffect(() => {
    if (editingTagId && editTagInputRef.current) {
      editTagInputRef.current.focus();
      editTagInputRef.current.select();
    }
  }, [editingTagId]);
  
  // 聚焦新字段输入框
  useEffect(() => {
    if (isAddingField && newFieldInputRef.current) {
      newFieldInputRef.current.focus();
    }
  }, [isAddingField]);

  // 切换标签时更新相关状态
  useEffect(() => {
    setEditingFieldId(null);
    setIsAddingField(false);
    setNewFieldName('');
    if (selectedTag) {
      setDescriptionValue(selectedTag.description || '');
      // 解析模版内容
      const tmpl = selectedTag.templateContent;
      if (tmpl) {
        if (Array.isArray(tmpl)) {
          setTemplateValue(tmpl.map(t => t.content).join('\n'));
        } else if (typeof tmpl === 'object' && 'content' in tmpl) {
          setTemplateValue(tmpl.content);
        } else {
          setTemplateValue('');
        }
      } else {
        setTemplateValue('');
      }
    }
  }, [selectedTagId, selectedTag]);

  // 创建新标签
  const handleCreateTag = useCallback(async () => {
    if (!newTagName.trim()) return;
    
    const colorIndex = userTags.length % TAG_COLORS.length;
    const newId = await addSupertag(newTagName.trim(), TAG_COLORS[colorIndex]);
    
    setNewTagName('');
    setIsAddingTag(false);
    if (newId) {
      setSelectedTagId(newId);
    }
  }, [newTagName, userTags.length, addSupertag]);

  // 保存标签名称编辑
  const handleSaveTagName = useCallback(() => {
    if (!editingTagId || !editingTagName.trim()) {
      setEditingTagId(null);
      setEditingTagName('');
      return;
    }
    
    updateSupertag(editingTagId, { name: editingTagName.trim() });
    setEditingTagId(null);
    setEditingTagName('');
  }, [editingTagId, editingTagName, updateSupertag]);

  // 删除标签
  const handleDeleteTag = useCallback((tagId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const tag = supertags[tagId];
    if (tag && confirm(`确定要删除标签 #${tag.name} 吗？此操作不可撤销。`)) {
      deleteSupertag(tagId);
      if (selectedTagId === tagId) {
        setSelectedTagId(null);
      }
    }
  }, [supertags, deleteSupertag, selectedTagId]);

  // 行内添加新字段
  const handleAddFieldInline = useCallback(() => {
    if (!selectedTagId || !newFieldName.trim()) return;

    const fieldKey = newFieldName.trim().toLowerCase().replace(/\s+/g, '_');
    
    const fieldDef: Omit<FieldDefinition, 'id'> = {
      key: fieldKey,
      name: newFieldName.trim(),
      type: 'text', // 默认为文本类型
    };

    addFieldDefinition(selectedTagId, fieldDef);
    setNewFieldName('');
    setIsAddingField(false);
  }, [selectedTagId, newFieldName, addFieldDefinition]);

  // 更新字段类型
  const handleFieldTypeChange = useCallback((fieldId: string, newType: FieldType) => {
    if (!selectedTagId) return;
    
    const updates: Partial<FieldDefinition> = { type: newType };
    
    // 如果切换到 select 类型，添加默认选项
    if (newType === 'select') {
      updates.options = ['选项1', '选项2', '选项3'];
    } else {
      updates.options = undefined;
    }
    
    // 如果切换到 reference 类型，清除 targetTagId（需要用户选择）
    if (newType === 'reference') {
      updates.targetTagId = undefined;
    } else {
      updates.targetTagId = undefined;
    }
    
    updateFieldDefinition(selectedTagId, fieldId, updates);
  }, [selectedTagId, updateFieldDefinition]);
  
  // 更新字段的引用目标标签
  const handleFieldTargetTagChange = useCallback((fieldId: string, targetTagId: string) => {
    if (!selectedTagId) return;
    updateFieldDefinition(selectedTagId, fieldId, { targetTagId });
  }, [selectedTagId, updateFieldDefinition]);
  
  // 更新字段选项
  const handleFieldOptionsChange = useCallback((fieldId: string, optionsStr: string) => {
    if (!selectedTagId) return;
    const options = optionsStr.split(',').map(o => o.trim()).filter(Boolean);
    updateFieldDefinition(selectedTagId, fieldId, { options });
  }, [selectedTagId, updateFieldDefinition]);

  // 删除字段
  const handleDeleteField = useCallback((fieldId: string) => {
    if (!selectedTagId) return;
    removeFieldDefinition(selectedTagId, fieldId);
  }, [selectedTagId, removeFieldDefinition]);

  // 更新标签颜色
  const handleColorChange = useCallback((color: string) => {
    if (!selectedTagId) return;
    updateSupertag(selectedTagId, { color });
  }, [selectedTagId, updateSupertag]);
  
  // 更新父标签
  const handleParentChange = useCallback((parentId: string | null) => {
    if (!selectedTagId) return;
    updateSupertag(selectedTagId, { parentId });
  }, [selectedTagId, updateSupertag]);
  
  // 保存描述
  const handleSaveDescription = useCallback(() => {
    if (!selectedTagId) return;
    updateSupertag(selectedTagId, { description: descriptionValue.trim() || undefined });
    setIsEditingDescription(false);
  }, [selectedTagId, descriptionValue, updateSupertag]);
  
  // 保存模版
  const handleSaveTemplate = useCallback(() => {
    if (!selectedTagId) return;
    const lines = templateValue.split('\n').filter(l => l.trim());
    const templateContent = lines.length > 0 
      ? lines.map(content => ({ content: content.trim() }))
      : null;
    updateSupertag(selectedTagId, { templateContent });
    setIsEditingTemplate(false);
  }, [selectedTagId, templateValue, updateSupertag]);

  // 钉住/取消钉住标签到透视
  const handleTogglePin = useCallback((tagId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (pinnedTagIds.includes(tagId)) {
      unpinTag(tagId);
    } else {
      pinTag(tagId);
    }
  }, [pinnedTagIds, pinTag, unpinTag]);

  // 获取视图类型的显示名称
  const getViewTypeName = (tagId: string): string => {
    const viewType = getViewType(tagId);
    switch (viewType) {
      case 'kanban': return '看板视图';
      case 'agenda': return '日程视图';
      case 'card': return '卡片视图';
      case 'flow': return '流程视图';
      case 'table': return '表格视图';
      default: return '默认视图';
    }
  };
  
  // 渲染字段类型选择器
  const renderFieldTypeSelector = (field: FieldDefinition) => {
    const currentType = FIELD_TYPES.find(t => t.value === field.type) || FIELD_TYPES[0];
    const isInherited = field.inherited;
    
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            disabled={isInherited}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors min-w-[70px]",
              isInherited 
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-gray-100 hover:bg-gray-200 text-gray-600"
            )}
          >
            {currentType.icon}
            <span>{currentType.label}</span>
            {!isInherited && <ChevronDown size={12} className="ml-auto" />}
          </button>
        </PopoverTrigger>
        {!isInherited && (
          <PopoverContent className="w-40 p-1" align="start">
            {FIELD_TYPES.map((type) => (
              <button
                key={type.value}
                onClick={() => handleFieldTypeChange(field.id, type.value)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors",
                  field.type === type.value
                    ? "bg-blue-100 text-blue-700"
                    : "hover:bg-gray-100 text-gray-700"
                )}
              >
                {type.icon}
                <span>{type.label}</span>
              </button>
            ))}
          </PopoverContent>
        )}
      </Popover>
    );
  };
  
  // 渲染引用目标选择器
  const renderReferenceTargetSelector = (field: FieldDefinition) => {
    if (field.type !== 'reference') return null;
    
    const targetTag = field.targetTagId ? supertags[field.targetTagId] : null;
    const needsTarget = !field.targetTagId;
    
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors",
              needsTarget 
                ? "bg-red-100 text-red-600 animate-pulse border border-red-300"
                : "bg-blue-50 text-blue-600 hover:bg-blue-100"
            )}
          >
            <span>→</span>
            <span>{targetTag ? `#${targetTag.name}` : '选择目标标签'}</span>
            {needsTarget && <span className="text-red-500">*</span>}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-1 max-h-60 overflow-auto" align="start">
          <div className="text-xs text-gray-500 px-2 py-1 mb-1">选择引用的目标标签</div>
          {userTags.filter(t => t.id !== selectedTagId).map((tag) => (
            <button
              key={tag.id}
              onClick={() => handleFieldTargetTagChange(field.id, tag.id)}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors",
                field.targetTagId === tag.id
                  ? "bg-blue-100 text-blue-700"
                  : "hover:bg-gray-100 text-gray-700"
              )}
            >
              <div 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: tag.color }}
              />
              <span>#{tag.name}</span>
            </button>
          ))}
        </PopoverContent>
      </Popover>
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩 */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* 主面板 */}
      <div className="relative w-[960px] max-w-[95vw] h-[700px] max-h-[90vh] bg-white dark:bg-gray-900 rounded-xl shadow-2xl flex overflow-hidden">
        {/* 左侧：标签列表 */}
        <div className="w-64 border-r border-gray-200 dark:border-gray-700 flex flex-col bg-gray-50/50 dark:bg-gray-800/50">
          {/* 标题 */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <Hash size={18} className="text-blue-500" />
              标签库
            </h2>
          </div>

          {/* 标签列表 */}
          <div className="flex-1 overflow-y-auto p-2">
            {userTags.map((tag) => {
              const hasParent = !!tag.parentId;
              const childCount = useSupertagStore.getState().getChildren(tag.id).length;
              
              return (
                <div
                  key={tag.id}
                  onClick={() => setSelectedTagId(tag.id)}
                  className={cn(
                    "group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all mb-0.5",
                    selectedTagId === tag.id
                      ? "bg-blue-100 dark:bg-blue-900/40"
                      : "hover:bg-gray-100 dark:hover:bg-gray-800"
                  )}
                >
                  <div 
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  {editingTagId === tag.id ? (
                    <input
                      ref={editTagInputRef}
                      type="text"
                      value={editingTagName}
                      onChange={(e) => setEditingTagName(e.target.value)}
                      onBlur={handleSaveTagName}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveTagName();
                        if (e.key === 'Escape') {
                          setEditingTagId(null);
                          setEditingTagName('');
                        }
                      }}
                      className="flex-1 bg-white dark:bg-gray-800 px-2 py-0.5 text-sm rounded border border-blue-300 outline-none"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <>
                      {/* 继承指示 */}
                      {hasParent && (
                        <GitBranch size={10} className="text-purple-500 flex-shrink-0" />
                      )}
                      {/* 钉住状态指示 */}
                      {pinnedTagIds.includes(tag.id) && (
                        <Pin size={10} className="text-purple-500 flex-shrink-0" />
                      )}
                      <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">
                        #{tag.name}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {tag.fieldDefinitions.length}
                        {childCount > 0 && <span className="text-purple-400 ml-1">+{childCount}</span>}
                      </span>
                    </>
                  )}
                  
                  {/* 操作按钮 */}
                  {editingTagId !== tag.id && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTagId(tag.id);
                          setEditingTagName(tag.name);
                        }}
                        className="p-1 text-gray-400 hover:text-blue-500 rounded"
                        title="重命名"
                      >
                        <Edit2 size={11} />
                      </button>
                      <button
                        onClick={(e) => handleDeleteTag(tag.id, e)}
                        className="p-1 text-gray-400 hover:text-red-500 rounded"
                        title="删除"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* 添加新标签 */}
            {isAddingTag ? (
              <div className="flex items-center gap-2 px-3 py-2">
                <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                <input
                  ref={newTagInputRef}
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onBlur={() => {
                    if (!newTagName.trim()) setIsAddingTag(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateTag();
                    if (e.key === 'Escape') {
                      setIsAddingTag(false);
                      setNewTagName('');
                    }
                  }}
                  placeholder="标签名称"
                  className="flex-1 bg-white dark:bg-gray-800 px-2 py-1 text-sm rounded border border-blue-300 outline-none"
                />
                <button
                  onClick={handleCreateTag}
                  className="p-1 text-green-500 hover:text-green-600"
                  disabled={!newTagName.trim()}
                >
                  <Check size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAddingTag(true)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <Plus size={14} />
                新建标签
              </button>
            )}

            {/* 空状态 */}
            {userTags.length === 0 && !isAddingTag && (
              <div className="text-center py-8 text-gray-400">
                <Hash size={28} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">暂无自定义标签</p>
              </div>
            )}
          </div>
        </div>

        {/* 右侧：标签详情 - 三段式布局 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 关闭按钮 */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors z-10"
          >
            <X size={18} />
          </button>

          {selectedTag ? (
            <div className="flex-1 overflow-y-auto">
              {/* ============================================ */}
              {/* 区域 A: 头部元数据 - 紧凑排列 */}
              {/* ============================================ */}
              <div className="p-5 bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 border-b border-gray-200 dark:border-gray-700">
                {/* 第一行：图标 + 名称 + 继承 + 颜色 */}
                <div className="flex items-center gap-3">
                  {/* 标签图标 */}
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg font-bold shadow-md"
                    style={{ backgroundColor: selectedTag.color }}
                  >
                    #
                  </div>
                  
                  {/* 标签名称 */}
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                    #{selectedTag.name}
                  </h3>
                  
                  {/* 继承选择器 */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors",
                        parentTag 
                          ? "bg-purple-100 text-purple-700 hover:bg-purple-200"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      )}>
                        <GitBranch size={14} />
                        <span>{parentTag ? `继承自 #${parentTag.name}` : '设置继承…'}</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-1" align="start">
                      <div className="text-xs text-gray-500 px-2 py-1.5 border-b mb-1">选择父标签</div>
                      <button
                        onClick={() => handleParentChange(null)}
                        className={cn(
                          "w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors",
                          !parentTag ? "bg-gray-100" : "hover:bg-gray-100"
                        )}
                      >
                        <Circle size={8} className="text-gray-400" />
                        <span className="text-gray-500">无继承</span>
                      </button>
                      {availableParentTags.filter(t => t.id !== selectedTagId).map((tag) => (
                        <button
                          key={tag.id}
                          onClick={() => handleParentChange(tag.id)}
                          className={cn(
                            "w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors",
                            selectedTag.parentId === tag.id
                              ? "bg-purple-100 text-purple-700"
                              : "hover:bg-gray-100 text-gray-700"
                          )}
                        >
                          <div 
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: tag.color }}
                          />
                          <span>#{tag.name}</span>
                          <span className="ml-auto text-xs text-gray-400">{tag.fieldDefinitions.length} 字段</span>
                        </button>
                      ))}
                    </PopoverContent>
                  </Popover>
                  
                  {/* 颜色选择器 - 收纳为小图标 */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button 
                        className="w-6 h-6 rounded-full border-2 border-white shadow-sm hover:scale-110 transition-transform"
                        style={{ backgroundColor: selectedTag.color }}
                        title="修改颜色"
                      />
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-2" align="end">
                      <div className="flex gap-1.5 flex-wrap max-w-[180px]">
                        {TAG_COLORS.map((color) => (
                          <button
                            key={color}
                            onClick={() => handleColorChange(color)}
                            className={cn(
                              "w-6 h-6 rounded-full transition-transform hover:scale-110",
                              selectedTag.color === color && "ring-2 ring-offset-2 ring-blue-500"
                            )}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                  
                  {/* 透视钉住按钮 */}
                  <button
                    onClick={(e) => handleTogglePin(selectedTag.id, e)}
                    className={cn(
                      "p-2 rounded-lg transition-colors ml-auto",
                      pinnedTagIds.includes(selectedTag.id)
                        ? "text-purple-600 bg-purple-100 hover:bg-purple-200"
                        : "text-gray-400 hover:text-purple-500 hover:bg-gray-100"
                    )}
                    title={pinnedTagIds.includes(selectedTag.id) ? "取消钉住" : "钉住到侧栏"}
                  >
                    {pinnedTagIds.includes(selectedTag.id) ? <PinOff size={16} /> : <Pin size={16} />}
                  </button>
                </div>
                
                {/* 第二行：描述 */}
                <div className="mt-3 ml-[52px]">
                  {isEditingDescription ? (
                    <input
                      type="text"
                      value={descriptionValue}
                      onChange={(e) => setDescriptionValue(e.target.value)}
                      onBlur={handleSaveDescription}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveDescription();
                        if (e.key === 'Escape') {
                          setDescriptionValue(selectedTag.description || '');
                          setIsEditingDescription(false);
                        }
                      }}
                      placeholder="添加标签描述…"
                      className="w-full text-sm text-gray-600 bg-white border border-gray-200 rounded px-2 py-1 outline-none focus:border-blue-400"
                      autoFocus
                    />
                  ) : (
                    <p 
                      onClick={() => setIsEditingDescription(true)}
                      className={cn(
                        "text-sm cursor-text py-1 -my-1 px-2 -mx-2 rounded hover:bg-gray-100 transition-colors",
                        selectedTag.description ? "text-gray-600" : "text-gray-400"
                      )}
                    >
                      {selectedTag.description || '点击添加描述…'}
                    </p>
                  )}
                </div>
              </div>

              {/* ============================================ */}
              {/* 区域 B: 字段 Schema - 列表式 */}
              {/* ============================================ */}
              <div className="p-5 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <Type size={14} />
                    字段定义 (Schema)
                  </h4>
                  {/* AI 建议入口 */}
                  <button className="flex items-center gap-1 text-xs text-gray-400 hover:text-purple-500 transition-colors">
                    <Sparkles size={12} />
                    <span>AI 建议</span>
                  </button>
                </div>

                {/* 字段列表 - 表格式 */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  {/* 表头 */}
                  <div className="grid grid-cols-[24px_1fr_100px_140px_32px] gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 font-medium border-b border-gray-200 dark:border-gray-700">
                    <div></div>
                    <div>字段名</div>
                    <div>类型</div>
                    <div>配置</div>
                    <div></div>
                  </div>
                  
                  {/* 字段行 */}
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {resolvedFields.map((field) => {
                      const isInherited = field.inherited;
                      
                      return (
                        <div 
                          key={field.id}
                          className={cn(
                            "grid grid-cols-[24px_1fr_100px_140px_32px] gap-2 px-3 py-2 items-center group",
                            isInherited ? "bg-purple-50/50 dark:bg-purple-900/10" : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                          )}
                        >
                          {/* 拖拽手柄 */}
                          <div className={cn(
                            "cursor-move text-gray-300",
                            isInherited && "opacity-30"
                          )}>
                            <GripVertical size={14} />
                          </div>
                          
                          {/* 字段名 */}
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "text-sm font-medium",
                              isInherited ? "text-purple-700 dark:text-purple-300" : "text-gray-700 dark:text-gray-300"
                            )}>
                              {field.name}
                            </span>
                            {isInherited && (
                              <span className="px-1.5 py-0.5 text-[10px] rounded bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300">
                                继承
                              </span>
                            )}
                          </div>
                          
                          {/* 类型选择 */}
                          <div>
                            {renderFieldTypeSelector(field)}
                          </div>
                          
                          {/* 配置项 */}
                          <div>
                            {field.type === 'reference' && renderReferenceTargetSelector(field)}
                            {field.type === 'select' && !isInherited && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button className="text-xs text-gray-500 hover:text-gray-700 truncate max-w-full">
                                    {field.options?.join(', ') || '设置选项…'}
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-64 p-3" align="start">
                                  <label className="text-xs text-gray-500 mb-1 block">选项列表（逗号分隔）</label>
                                  <input
                                    type="text"
                                    defaultValue={field.options?.join(', ') || ''}
                                    onBlur={(e) => handleFieldOptionsChange(field.id, e.target.value)}
                                    className="w-full px-2 py-1.5 text-sm border rounded"
                                    placeholder="选项1, 选项2, 选项3"
                                  />
                                </PopoverContent>
                              </Popover>
                            )}
                          </div>
                          
                          {/* 删除按钮 */}
                          <div className="flex justify-end">
                            {!isInherited && (
                              <button
                                onClick={() => handleDeleteField(field.id)}
                                className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                title="删除字段"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* 添加字段行 */}
                    {isAddingField ? (
                      <div className="grid grid-cols-[24px_1fr_100px_140px_32px] gap-2 px-3 py-2 items-center bg-blue-50 dark:bg-blue-900/20">
                        <div></div>
                        <input
                          ref={newFieldInputRef}
                          type="text"
                          value={newFieldName}
                          onChange={(e) => setNewFieldName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newFieldName.trim()) {
                              handleAddFieldInline();
                            }
                            if (e.key === 'Escape') {
                              setIsAddingField(false);
                              setNewFieldName('');
                            }
                          }}
                          placeholder="输入字段名称，回车创建"
                          className="text-sm bg-white border border-blue-300 rounded px-2 py-1 outline-none focus:border-blue-500"
                        />
                        <span className="text-xs text-gray-400">文本</span>
                        <span className="text-xs text-gray-400">创建后配置</span>
                        <button
                          onClick={() => {
                            setIsAddingField(false);
                            setNewFieldName('');
                          }}
                          className="p-1 text-gray-400 hover:text-gray-600"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setIsAddingField(true)}
                        className="w-full grid grid-cols-[24px_1fr] gap-2 px-3 py-2.5 text-sm text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors border-t border-dashed border-gray-200 dark:border-gray-700"
                      >
                        <Plus size={14} className="ml-0.5" />
                        <span className="text-left">添加字段</span>
                      </button>
                    )}
                  </div>
                </div>
                
                {/* 空状态提示 */}
                {resolvedFields.length === 0 && !isAddingField && (
                  <div className="text-center py-6 text-gray-400">
                    <Type size={24} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">暂无字段定义</p>
                    <p className="text-xs mt-1">点击"添加字段"开始配置</p>
                  </div>
                )}
              </div>

              {/* ============================================ */}
              {/* 区域 C: 默认内容模版 - WYSIWYG */}
              {/* ============================================ */}
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <FileText size={14} />
                    初始化模版 (Template)
                  </h4>
                  <span className="text-xs text-gray-400">
                    应用标签时自动填充
                  </span>
                </div>

                {/* 模版编辑区 - 模拟 WYSIWYG */}
                <div 
                  className={cn(
                    "border rounded-lg transition-colors min-h-[160px]",
                    isEditingTemplate
                      ? "border-blue-400 ring-2 ring-blue-100"
                      : "border-gray-200 dark:border-gray-700 border-dashed hover:border-gray-300"
                  )}
                >
                  {isEditingTemplate ? (
                    <div className="p-4">
                      <textarea
                        value={templateValue}
                        onChange={(e) => setTemplateValue(e.target.value)}
                        onBlur={handleSaveTemplate}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            const tmpl = selectedTag.templateContent;
                            if (tmpl && Array.isArray(tmpl)) {
                              setTemplateValue(tmpl.map(t => t.content).join('\n'));
                            } else if (tmpl && typeof tmpl === 'object' && 'content' in tmpl) {
                              setTemplateValue(tmpl.content);
                            } else {
                              setTemplateValue('');
                            }
                            setIsEditingTemplate(false);
                          }
                        }}
                        placeholder="输入模版内容，每行一个项目…&#10;例如：&#10;• 🎯 会议目标&#10;• 📝 议程&#10;• ✅ 待办事项"
                        className="w-full min-h-[140px] bg-transparent outline-none text-sm text-gray-700 dark:text-gray-300 resize-none font-mono"
                        autoFocus
                      />
                      <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-gray-100">
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => {
                            const tmpl = selectedTag.templateContent;
                            if (tmpl && Array.isArray(tmpl)) {
                              setTemplateValue(tmpl.map(t => t.content).join('\n'));
                            } else {
                              setTemplateValue('');
                            }
                            setIsEditingTemplate(false);
                          }}
                        >
                          取消
                        </Button>
                        <Button size="sm" onClick={handleSaveTemplate}>
                          <Check size={14} className="mr-1" />
                          保存
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div 
                      onClick={() => setIsEditingTemplate(true)}
                      className="p-4 cursor-text min-h-[160px]"
                    >
                      {templateValue ? (
                        <div className="space-y-1.5">
                          {templateValue.split('\n').filter(l => l.trim()).map((line, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                              <span className="text-gray-400 select-none">•</span>
                              <span>{line.trim()}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full py-8 text-gray-400">
                          <FileText size={24} className="mb-2 opacity-50" />
                          <p className="text-sm">点击编辑模版内容</p>
                          <p className="text-xs mt-1">应用此标签时将自动填充</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* 未选择标签时的提示 */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <Hash size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-base font-medium">选择一个标签</p>
                <p className="text-sm mt-1">在左侧列表中选择或创建标签</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TagLibrary;
