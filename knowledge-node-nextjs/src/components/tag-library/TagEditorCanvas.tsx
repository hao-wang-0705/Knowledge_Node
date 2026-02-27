'use client';

import React from 'react';
import { Supertag } from '@/types';
import TagHeaderConfig from './TagHeaderConfig';
import SchemaFieldList from './SchemaFieldList';
import TemplateContentEditor from './TemplateContentEditor';

interface TagEditorCanvasProps {
  tag: Supertag;
}

/**
 * 标签编辑器画布 - 三段式紧凑设计
 * 
 * 布局顺序（从上到下）：
 * 1. Meta Header - 元数据卡片（图标、名称、继承、颜色）
 * 2. Schema Definition - 字段定义（表格式列表）
 * 3. Template Editor - 内容模版（WYSIWYG 编辑器）
 */
const TagEditorCanvas: React.FC<TagEditorCanvasProps> = ({ tag }) => {
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-900">
      {/* 区域 A: 头部元数据 - 紧凑排列 */}
      <TagHeaderConfig tag={tag} />
      
      {/* 可滚动的内容区域 */}
      <div className="flex-1 overflow-y-auto">
        {/* 区域 B: 字段 Schema - 表格式列表 */}
        <SchemaFieldList tag={tag} />
        
        {/* 区域 C: 默认内容模版 - WYSIWYG */}
        <TemplateContentEditor tag={tag} />
      </div>
    </div>
  );
};

export default TagEditorCanvas;
