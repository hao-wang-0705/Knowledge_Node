'use client';

import React, { useState, useCallback, useEffect, useRef, KeyboardEvent } from 'react';
import { FileText, Plus, GripVertical, Check, Square, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Supertag, TemplateNode } from '@/types';

interface TemplateContentEditorProps {
  tag: Supertag;
}

interface TemplateItem {
  id: string;
  content: string;
  depth: number;
  isCheckbox?: boolean;
  checked?: boolean;
}

// 将 TemplateNode 数组转换为扁平的编辑项
function flattenTemplate(nodes: TemplateNode[] | null | undefined): TemplateItem[] {
  if (!nodes) return [];
  const items: TemplateItem[] = [];
  let idCounter = 0;
  
  const walk = (nodeList: TemplateNode[], depth: number) => {
    for (const node of nodeList) {
      const content = node.content || '';
      const isCheckbox = content.startsWith('[ ]') || content.startsWith('[x]') || content.startsWith('[X]');
      const checked = content.startsWith('[x]') || content.startsWith('[X]');
      const cleanContent = isCheckbox ? content.slice(4).trim() : content;
      
      items.push({
        id: `item_${idCounter++}`,
        content: cleanContent,
        depth,
        isCheckbox,
        checked,
      });
      
      if (node.children?.length) {
        walk(node.children, depth + 1);
      }
    }
  };
  
  walk(Array.isArray(nodes) ? nodes : [nodes], 0);
  return items;
}

// 将扁平的编辑项转换回 TemplateNode 数组
function unflattenTemplate(items: TemplateItem[]): TemplateNode[] {
  const roots: TemplateNode[] = [];
  const stack: { node: TemplateNode; depth: number }[] = [];
  
  for (const item of items) {
    if (!item.content.trim()) continue;
    
    let content = item.content;
    if (item.isCheckbox) {
      content = `${item.checked ? '[x]' : '[ ]'} ${content}`;
    }
    
    const node: TemplateNode = { content, children: [] };
    
    // 弹出比当前深度大或等于的节点
    while (stack.length > 0 && stack[stack.length - 1].depth >= item.depth) {
      stack.pop();
    }
    
    if (stack.length === 0) {
      roots.push(node);
    } else {
      const parent = stack[stack.length - 1].node;
      if (!parent.children) parent.children = [];
      parent.children.push(node);
    }
    
    stack.push({ node, depth: item.depth });
  }
  
  return roots;
}

// 单个模版行组件
interface TemplateRowProps {
  item: TemplateItem;
  isEditing: boolean;
  onStartEdit: () => void;
  onUpdateContent: (content: string) => void;
  onUpdateCheckbox: (isCheckbox: boolean, checked: boolean) => void;
  onDelete: () => void;
  onIndent: () => void;
  onOutdent: () => void;
  onInsertAfter: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onFinishEdit: () => void;
}

const TemplateRow: React.FC<TemplateRowProps> = ({
  item,
  isEditing,
  onStartEdit,
  onUpdateContent,
  onUpdateCheckbox,
  onDelete,
  onIndent,
  onOutdent,
  onInsertAfter,
  onFinishEdit,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.setSelectionRange(item.content.length, item.content.length);
    }
  }, [isEditing, item.content]);
  
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onInsertAfter();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        onOutdent();
      } else {
        onIndent();
      }
    } else if (e.key === 'Backspace' && item.content === '') {
      e.preventDefault();
      onDelete();
    } else if (e.key === 'Escape') {
      onFinishEdit();
    }
  };
  
  return (
    <div
      className={cn(
        "group flex items-start gap-1 py-1 px-2 rounded transition-colors min-h-[32px]",
        isEditing && "bg-blue-50 dark:bg-blue-900/20"
      )}
      style={{ paddingLeft: `${12 + item.depth * 20}px` }}
    >
      {/* 拖拽手柄 */}
      <div className="w-4 h-6 flex items-center justify-center text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100 cursor-grab">
        <GripVertical size={12} />
      </div>
      
      {/* 复选框或项目符号 */}
      <button
        onClick={() => {
          if (item.isCheckbox) {
            onUpdateCheckbox(true, !item.checked);
          } else {
            onUpdateCheckbox(true, false);
          }
        }}
        className={cn(
          "w-5 h-6 flex items-center justify-center flex-shrink-0 transition-colors",
          item.isCheckbox
            ? item.checked
              ? "text-green-500"
              : "text-gray-400 hover:text-gray-600"
            : "text-gray-300 hover:text-gray-400"
        )}
      >
        {item.isCheckbox ? (
          item.checked ? (
            <Check size={14} className="bg-green-500 text-white rounded-sm p-0.5" />
          ) : (
            <Square size={14} />
          )
        ) : (
          <span className="text-xs">•</span>
        )}
      </button>
      
      {/* 内容 */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={item.content}
            onChange={(e) => onUpdateContent(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={onFinishEdit}
            className="w-full text-sm bg-transparent outline-none text-gray-800 dark:text-gray-200"
            placeholder="输入内容..."
          />
        ) : (
          <div
            onClick={onStartEdit}
            className={cn(
              "text-sm cursor-text py-0.5 min-h-[20px]",
              item.isCheckbox && item.checked
                ? "text-gray-400 line-through"
                : "text-gray-700 dark:text-gray-300",
              !item.content && "text-gray-400 italic"
            )}
          >
            {item.content || '点击编辑...'}
          </div>
        )}
      </div>
      
      {/* 删除按钮 */}
      <button
        onClick={onDelete}
        className="w-5 h-6 flex items-center justify-center text-gray-300 dark:text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
};

const TemplateContentEditor: React.FC<TemplateContentEditorProps> = ({ tag }) => {
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  
  // 从 tag 加载模版
  useEffect(() => {
    const templateNodes = tag.templateContent;
    if (Array.isArray(templateNodes)) {
      setItems(flattenTemplate(templateNodes));
    } else if (templateNodes && typeof templateNodes === 'object') {
      setItems(flattenTemplate([templateNodes as TemplateNode]));
    } else {
      setItems([]);
    }
    setIsDirty(false);
    setEditingId(null);
  }, [tag.id, tag.templateContent]);
  
  // 保存模版 - 当前为只读模式，此功能已禁用
  const handleSave = useCallback(() => {
    console.warn('[TemplateContentEditor] 当前为只读模式，无法保存模版');
    setIsDirty(false);
  }, []);
  
  // 自动保存（失去焦点时）
  const handleBlurSave = useCallback(() => {
    if (isDirty) {
      handleSave();
    }
  }, [isDirty, handleSave]);
  
  // 生成唯一 ID
  const generateId = () => `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // 添加新行
  const handleAddItem = useCallback(() => {
    const newItem: TemplateItem = {
      id: generateId(),
      content: '',
      depth: 0,
    };
    setItems(prev => [...prev, newItem]);
    setEditingId(newItem.id);
    setIsDirty(true);
  }, []);
  
  // 更新内容
  const handleUpdateContent = useCallback((id: string, content: string) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, content } : item
    ));
    setIsDirty(true);
  }, []);
  
  // 更新复选框
  const handleUpdateCheckbox = useCallback((id: string, isCheckbox: boolean, checked: boolean) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, isCheckbox, checked } : item
    ));
    setIsDirty(true);
  }, []);
  
  // 删除行
  const handleDelete = useCallback((id: string) => {
    setItems(prev => {
      const index = prev.findIndex(item => item.id === id);
      const newItems = prev.filter(item => item.id !== id);
      // 如果删除后还有项目，聚焦到上一个或下一个
      if (newItems.length > 0 && editingId === id) {
        const newIndex = Math.max(0, index - 1);
        setEditingId(newItems[newIndex]?.id || null);
      } else {
        setEditingId(null);
      }
      return newItems;
    });
    setIsDirty(true);
  }, [editingId]);
  
  // 缩进
  const handleIndent = useCallback((id: string) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, depth: Math.min(item.depth + 1, 5) } : item
    ));
    setIsDirty(true);
  }, []);
  
  // 取消缩进
  const handleOutdent = useCallback((id: string) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, depth: Math.max(item.depth - 1, 0) } : item
    ));
    setIsDirty(true);
  }, []);
  
  // 在当前行后插入新行
  const handleInsertAfter = useCallback((id: string) => {
    const index = items.findIndex(item => item.id === id);
    if (index === -1) return;
    
    const currentItem = items[index];
    const newItem: TemplateItem = {
      id: generateId(),
      content: '',
      depth: currentItem.depth,
    };
    
    setItems(prev => [
      ...prev.slice(0, index + 1),
      newItem,
      ...prev.slice(index + 1),
    ]);
    setEditingId(newItem.id);
    setIsDirty(true);
  }, [items]);
  
  return (
    <div className="px-6 py-5">
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <FileText size={14} />
          初始化模版 (Template)
        </h3>
        <div className="flex items-center gap-2">
          {isDirty && (
            <button
              onClick={handleSave}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-400 rounded-lg transition-colors"
            >
              <Check size={12} />
              保存
            </button>
          )}
          <span className="text-xs text-gray-400">应用标签时自动填充</span>
        </div>
      </div>
      
      {/* WYSIWYG 编辑区 */}
      <div
        className={cn(
          "border rounded-lg transition-colors min-h-[160px] bg-white dark:bg-gray-900",
          isDirty
            ? "border-blue-300 dark:border-blue-700 ring-1 ring-blue-100 dark:ring-blue-900/50"
            : "border-gray-200 dark:border-gray-700 border-dashed hover:border-gray-300 dark:hover:border-gray-600"
        )}
        onBlur={(e) => {
          // 只有当焦点离开整个容器时才保存
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            handleBlurSave();
          }
        }}
      >
        {items.length > 0 ? (
          <div className="py-2">
            {items.map((item) => (
              <TemplateRow
                key={item.id}
                item={item}
                isEditing={editingId === item.id}
                onStartEdit={() => setEditingId(item.id)}
                onUpdateContent={(content) => handleUpdateContent(item.id, content)}
                onUpdateCheckbox={(isCheckbox, checked) => handleUpdateCheckbox(item.id, isCheckbox, checked)}
                onDelete={() => handleDelete(item.id)}
                onIndent={() => handleIndent(item.id)}
                onOutdent={() => handleOutdent(item.id)}
                onInsertAfter={() => handleInsertAfter(item.id)}
                onMoveUp={() => {}}
                onMoveDown={() => {}}
                onFinishEdit={() => setEditingId(null)}
              />
            ))}
            
            {/* 添加新行按钮 */}
            <button
              onClick={handleAddItem}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors rounded-b-lg"
            >
              <Plus size={14} />
              <span>添加内容</span>
            </button>
          </div>
        ) : (
          <div
            onClick={handleAddItem}
            className="flex flex-col items-center justify-center h-full py-10 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors"
          >
            <FileText size={24} className="mb-2 text-gray-300 dark:text-gray-600" />
            <p className="text-sm text-gray-400 dark:text-gray-500">点击添加模版内容</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              支持层级缩进、复选框、Emoji
            </p>
          </div>
        )}
      </div>
      
      {/* 使用提示 */}
      <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
        <span>Enter 换行</span>
        <span>Tab 缩进</span>
        <span>Shift+Tab 取消缩进</span>
        <span>点击 • 转为复选框</span>
      </div>
    </div>
  );
};

export default TemplateContentEditor;
