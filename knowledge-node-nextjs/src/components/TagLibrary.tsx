'use client';

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { 
  X, Plus, Trash2, Edit2, Hash, ChevronDown,
  Type, Calendar, List, Check, Link2, 
  GripVertical, Sparkles, FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useSupertagStore } from '@/stores/supertagStore';
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
  const getFieldDefinitions = useSupertagStore((state) => state.getFieldDefinitions);

  // 获取非系统标签列表
  const userTags = Object.values(supertags).filter(tag => !tag.isSystem);
  const selectedTag = selectedTagId ? supertags[selectedTagId] : null;
  
  const resolvedFields = useMemo(() => {
    if (!selectedTagId) return [];
    return getFieldDefinitions(selectedTagId) || [];
  }, [selectedTagId, getFieldDefinitions, supertags]);

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

  // 创建新标签 - 当前为只读模式，此功能已禁用
  const handleCreateTag = useCallback(async () => {
    console.warn('[TagLibrary] 当前为只读模式，无法创建标签');
  }, []);

  // 保存标签名称编辑 - 当前为只读模式，此功能已禁用
  const handleSaveTagName = useCallback(() => {
    console.warn('[TagLibrary] 当前为只读模式，无法保存标签名称');
    setEditingTagId(null);
    setEditingTagName('');
  }, []);

  // 删除标签 - 当前为只读模式，此功能已禁用
  const handleDeleteTag = useCallback((_tagId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    console.warn('[TagLibrary] 当前为只读模式，无法删除标签');
  }, []);

  // 行内添加新字段 - 当前为只读模式，此功能已禁用
  const handleAddFieldInline = useCallback(() => {
    console.warn('[TagLibrary] 当前为只读模式，无法添加字段');
  }, []);

  // 更新字段类型 - 当前为只读模式，此功能已禁用
  const handleFieldTypeChange = useCallback((_fieldId: string, _newType: FieldType) => {
    console.warn('[TagLibrary] 当前为只读模式，无法更新字段类型');
  }, []);
  
  // 更新字段的引用目标标签 - 当前为只读模式，此功能已禁用
  const handleFieldTargetTagChange = useCallback((_fieldId: string, _targetTagId: string) => {
    console.warn('[TagLibrary] 当前为只读模式，无法更新引用目标');
  }, []);
  
  // 更新字段选项 - 当前为只读模式，此功能已禁用
  const handleFieldOptionsChange = useCallback((_fieldId: string, _optionsStr: string) => {
    console.warn('[TagLibrary] 当前为只读模式，无法更新字段选项');
  }, []);

  // 删除字段 - 当前为只读模式，此功能已禁用
  const handleDeleteField = useCallback((_fieldId: string) => {
    console.warn('[TagLibrary] 当前为只读模式，无法删除字段');
  }, []);

  const handleColorChange = useCallback((_color: string) => {
    console.warn('[TagLibrary] 当前为只读模式，无法更新颜色');
  }, []);
  
  const handleSaveDescription = useCallback(() => {
    console.warn('[TagLibrary] 当前为只读模式，无法保存描述');
    setIsEditingDescription(false);
  }, []);
  
  // 保存模版 - 当前为只读模式，此功能已禁用
  const handleSaveTemplate = useCallback(() => {
    console.warn('[TagLibrary] 当前为只读模式，无法保存模版');
    setIsEditingTemplate(false);
  }, []);

  const renderFieldTypeSelector = (field: FieldDefinition) => {
    const currentType = FIELD_TYPES.find(t => t.value === field.type) || FIELD_TYPES[0];
    
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors min-w-[70px] bg-gray-100 hover:bg-gray-200 text-gray-600"
          >
            {currentType.icon}
            <span>{currentType.label}</span>
            <ChevronDown size={12} className="ml-auto" />
          </button>
        </PopoverTrigger>
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
            {userTags.map((tag) => (
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
                      <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">
                        #{tag.name}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {tag.fieldDefinitions.length}
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
            ))}

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
                  
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100 flex-1">
                    #{selectedTag.name}
                  </h3>
                  
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
                    {resolvedFields.map((field) => (
                        <div 
                          key={field.id}
                          className="grid grid-cols-[24px_1fr_100px_140px_32px] gap-2 px-3 py-2 items-center group hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        >
                          <div className="cursor-move text-gray-300">
                            <GripVertical size={14} />
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {field.name}
                            </span>
                          </div>
                          
                          <div>
                            {renderFieldTypeSelector(field)}
                          </div>
                          
                          <div>
                            {field.type === 'reference' && renderReferenceTargetSelector(field)}
                            {field.type === 'select' && (
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
                          
                          <div className="flex justify-end">
                            <button
                              onClick={() => handleDeleteField(field.id)}
                              className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                              title="删除字段"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                    ))}
                    
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
