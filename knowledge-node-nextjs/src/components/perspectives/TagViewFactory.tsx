'use client';

import React from 'react';
import { usePerspectiveStore } from '@/stores/perspectiveStore';
import KanbanView from './KanbanView';
import AgendaView from './AgendaView';
import CardView from './CardView';
import FlowView from './FlowView';
import TableView from './TableView';

interface TagViewFactoryProps {
  tagId: string;
}

/**
 * 视图工厂组件
 * 根据标签 ID 动态渲染对应的专用视图
 */
const TagViewFactory: React.FC<TagViewFactoryProps> = ({ tagId }) => {
  const getViewType = usePerspectiveStore((state) => state.getViewType);
  const viewType = getViewType(tagId);
  
  // 根据视图类型渲染对应组件
  switch (viewType) {
    case 'kanban':
      return <KanbanView tagId={tagId} />;
    
    case 'agenda':
      return <AgendaView tagId={tagId} />;
    
    case 'card':
      return <CardView tagId={tagId} />;
    
    case 'flow':
      return <FlowView tagId={tagId} />;
    
    case 'table':
    default:
      return <TableView tagId={tagId} />;
  }
};

export default TagViewFactory;
