'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { GitBranch, Circle, Trash2, Edit2, Check, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Supertag } from '@/types';
import { useSupertagStore } from '@/stores/supertagStore';
import { TAG_COLORS } from '@/utils/mockData';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface TagHeaderConfigProps {
  tag: Supertag;
}

// 预设图标分类（精简版）
const ICON_PRESETS = [
  '📌', '📝', '📋', '✨', '⭐', '🎯', '🏷️', '📎', '💫', '🔔', '💡', '🔥',
  '☑️', '✅', '📅', '⏰', '🗓️', '📆', '📊', '📈', '🗂️', '📄', '📰', '📚',
  '🎨', '🎬', '🎮', '🎵', '📷', '🔧', '⚙️', '💻', '📱', '🏠', '🏢', '🌍',
  '😊', '🤔', '👍', '❤️', '💪', '🙌', '🏆', '💎', '🚀', '🌟', '🎉', '🎊',
];

const TagHeaderConfig: React.FC<TagHeaderConfigProps> = ({ tag }) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState(tag.name);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editingDesc, setEditingDesc] = useState(tag.description || '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const updateSupertag = useSupertagStore((state) => state.updateSupertag);
  const deleteSupertag = useSupertagStore((state) => state.deleteSupertag);
  const supertags = useSupertagStore((state) => state.supertags);
  const getDescendantIds = useSupertagStore((state) => state.getDescendantIds);
  const getResolvedFieldDefinitions = useSupertagStore((state) => state.getResolvedFieldDefinitions);
  
  // 获取合并后的字段数量
  const resolvedFields = useMemo(() => {
    return getResolvedFieldDefinitions(tag.id) || [];
  }, [tag.id, getResolvedFieldDefinitions]);
  
  const ownFieldCount = tag.fieldDefinitions.length;
  const inheritedFieldCount = resolvedFields.filter(f => f.inherited).length;
  
  // 获取父标签
  const parentTag = tag.parentId ? supertags[tag.parentId] : null;
  
  // 获取可用的父标签列表（排除自己和后代）
  const availableParentTags = useMemo(() => {
    const blockedIds = new Set(getDescendantIds(tag.id));
    blockedIds.add(tag.id);
    return Object.values(supertags)
      .filter((t) => !blockedIds.has(t.id) && !t.isSystem)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [getDescendantIds, supertags, tag.id]);

  // 处理名称保存
  const handleSaveName = useCallback(() => {
    if (editingName.trim() && editingName.trim() !== tag.name) {
      updateSupertag(tag.id, { name: editingName.trim() });
    }
    setIsEditingName(false);
  }, [tag.id, tag.name, editingName, updateSupertag]);
  
  // 处理描述保存
  const handleSaveDesc = useCallback(() => {
    const desc = editingDesc.trim();
    if (desc !== (tag.description || '')) {
      updateSupertag(tag.id, { description: desc || undefined });
    }
    setIsEditingDesc(false);
  }, [tag.id, tag.description, editingDesc, updateSupertag]);

  // 处理颜色更改
  const handleColorChange = useCallback((color: string) => {
    updateSupertag(tag.id, { color });
  }, [tag.id, updateSupertag]);

  // 处理图标更改
  const handleIconChange = useCallback((icon: string | undefined) => {
    updateSupertag(tag.id, { icon });
  }, [tag.id, updateSupertag]);

  // 处理父标签更改
  const handleParentChange = useCallback((parentId: string | null) => {
    updateSupertag(tag.id, { parentId });
  }, [tag.id, updateSupertag]);

  // 处理删除
  const handleDelete = useCallback(() => {
    deleteSupertag(tag.id);
    setShowDeleteConfirm(false);
  }, [tag.id, deleteSupertag]);

  return (
    <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      {/* 第一行：图标 + 名称 + 继承 + 颜色 + 删除 */}
      <div className="flex items-center gap-3">
        {/* 图标选择器 */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-lg hover:scale-105 transition-transform cursor-pointer relative group"
              style={{ backgroundColor: tag.color }}
              title="点击选择图标"
            >
              {tag.icon || '#'}
              <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/10 transition-colors" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="start">
            <div className="grid grid-cols-8 gap-1.5">
              {ICON_PRESETS.map((icon) => (
                <button
                  key={icon}
                  onClick={() => handleIconChange(icon)}
                  className={cn(
                    "w-7 h-7 rounded flex items-center justify-center text-base hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors",
                    tag.icon === icon && "bg-blue-100 dark:bg-blue-900/50 ring-1 ring-blue-400"
                  )}
                >
                  {icon}
                </button>
              ))}
            </div>
            {tag.icon && (
              <button
                onClick={() => handleIconChange(undefined)}
                className="w-full mt-2 px-2 py-1.5 text-xs text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
              >
                清除图标
              </button>
            )}
          </PopoverContent>
        </Popover>

        {/* 标签名称 - 可点击编辑 */}
        <div className="flex-1 min-w-0">
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') {
                    setEditingName(tag.name);
                    setIsEditingName(false);
                  }
                }}
                onBlur={handleSaveName}
                className="text-xl font-bold px-2 py-1 border border-blue-400 rounded-lg outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 w-full max-w-xs"
                autoFocus
              />
            </div>
          ) : (
            <div
              onClick={() => {
                setEditingName(tag.name);
                setIsEditingName(true);
              }}
              className="group cursor-text"
            >
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <span>#{tag.name}</span>
                <Edit2 size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
              </h2>
            </div>
          )}
        </div>

        {/* 继承选择器 - 关键功能 */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                parentTag
                  ? "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/60"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              )}
            >
              <GitBranch size={14} />
              <span>{parentTag ? `继承 #${parentTag.name}` : '设置继承…'}</span>
              <ChevronDown size={12} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-1" align="end">
            <div className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1.5 border-b border-gray-100 dark:border-gray-700 mb-1">
              选择父标签以继承其字段
            </div>
            <button
              onClick={() => handleParentChange(null)}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors text-left",
                !parentTag
                  ? "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                  : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
              )}
            >
              <Circle size={8} className="text-gray-400" />
              <span>无继承</span>
            </button>
            {availableParentTags.map((t) => (
              <button
                key={t.id}
                onClick={() => handleParentChange(t.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors text-left",
                  tag.parentId === t.id
                    ? "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300"
                    : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                )}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: t.color }}
                />
                <span className="truncate">#{t.name}</span>
                <span className="ml-auto text-xs text-gray-400">{t.fieldDefinitions.length}</span>
              </button>
            ))}
          </PopoverContent>
        </Popover>

        {/* 颜色选择器 - 收纳为小圆点 */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="w-7 h-7 rounded-full border-2 border-white dark:border-gray-700 shadow-md hover:scale-110 transition-transform"
              style={{ backgroundColor: tag.color }}
              title="修改颜色"
            />
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="end">
            <div className="flex gap-1.5 flex-wrap max-w-[200px]">
              {TAG_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => handleColorChange(color)}
                  className={cn(
                    "w-6 h-6 rounded-full transition-transform hover:scale-110",
                    tag.color === color && "ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-gray-800"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* 删除按钮 */}
        {showDeleteConfirm ? (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <span className="text-xs text-red-600 dark:text-red-400">确认删除?</span>
            <button
              onClick={handleDelete}
              className="px-2 py-0.5 text-xs text-white bg-red-500 hover:bg-red-600 rounded transition-colors"
            >
              删除
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              取消
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
            title="删除标签"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {/* 第二行：描述（可编辑） */}
      <div className="mt-3 ml-[60px]">
        {isEditingDesc ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={editingDesc}
              onChange={(e) => setEditingDesc(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveDesc();
                if (e.key === 'Escape') {
                  setEditingDesc(tag.description || '');
                  setIsEditingDesc(false);
                }
              }}
              onBlur={handleSaveDesc}
              placeholder="添加标签描述…"
              className="flex-1 text-sm text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded px-2 py-1 outline-none focus:border-blue-400"
              autoFocus
            />
            <button
              onClick={handleSaveDesc}
              className="p-1 text-green-500 hover:text-green-600"
            >
              <Check size={14} />
            </button>
            <button
              onClick={() => {
                setEditingDesc(tag.description || '');
                setIsEditingDesc(false);
              }}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <p
            onClick={() => {
              setEditingDesc(tag.description || '');
              setIsEditingDesc(true);
            }}
            className={cn(
              "text-sm cursor-text py-0.5 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors inline-block px-1 -mx-1",
              tag.description
                ? "text-gray-600 dark:text-gray-400"
                : "text-gray-400 dark:text-gray-500 italic"
            )}
          >
            {tag.description || '点击添加描述…'}
          </p>
        )}
      </div>

      {/* 第三行：字段统计信息 */}
      <div className="mt-2 ml-[60px] flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
        <span>{ownFieldCount} 个自有字段</span>
        {inheritedFieldCount > 0 && (
          <>
            <span className="text-gray-300 dark:text-gray-600">•</span>
            <span className="text-purple-500 dark:text-purple-400">
              +{inheritedFieldCount} 个继承字段
            </span>
          </>
        )}
        {parentTag && (
          <>
            <span className="text-gray-300 dark:text-gray-600">•</span>
            <span className="flex items-center gap-1 text-purple-500 dark:text-purple-400">
              <GitBranch size={10} />
              继承自 #{parentTag.name}
            </span>
          </>
        )}
      </div>
    </div>
  );
};

export default TagHeaderConfig;
