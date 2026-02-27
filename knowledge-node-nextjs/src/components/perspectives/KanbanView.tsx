'use client';

import React, { useMemo, useCallback, useState } from 'react';
import { 
  Circle, CheckCircle2, Clock, Pause, GripVertical, Hash,
  AlertCircle, Edit3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNodeStore } from '@/stores/nodeStore';
import { useSupertagStore } from '@/stores/supertagStore';
import { usePerspectiveStore } from '@/stores/perspectiveStore';
import { Node, Supertag } from '@/types';
import NodeDetailModal from '../NodeDetailModal';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

interface KanbanViewProps {
  tagId: string;
}

// 看板列配置
const KANBAN_COLUMNS = [
  { key: '待办', label: '待办', icon: Circle, color: 'text-gray-500', bgColor: 'bg-gray-50 dark:bg-gray-800/50', dropColor: 'ring-gray-400' },
  { key: '进行中', label: '进行中', icon: Clock, color: 'text-blue-500', bgColor: 'bg-blue-50 dark:bg-blue-900/20', dropColor: 'ring-blue-400' },
  { key: '已完成', label: '已完成', icon: CheckCircle2, color: 'text-green-500', bgColor: 'bg-green-50 dark:bg-green-900/20', dropColor: 'ring-green-400' },
  { key: '搁置', label: '搁置', icon: Pause, color: 'text-orange-500', bgColor: 'bg-orange-50 dark:bg-orange-900/20', dropColor: 'ring-orange-400' },
];

// 任务卡片组件
const TaskCard: React.FC<{
  node: Node;
  tag: Supertag;
  onStatusChange: (newStatus: string) => void;
  onNavigate: () => void;
  onFocus: () => void;  // 聚焦视图回调
  onEdit: () => void;   // 编辑回调
  isDragging?: boolean; // 是否正在拖拽
  onDragStart: (e: React.DragEvent, nodeId: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
}> = ({ node, tag, onStatusChange, onNavigate, onFocus, onEdit, isDragging, onDragStart, onDragEnd }) => {
  const priority = node.fields.priority as string | undefined;
  const dueDate = node.fields.due_date as string | undefined;
  const assignee = node.fields.assignee as string | undefined;
  
  // 优先级颜色
  const priorityStyle = useMemo(() => {
    if (!priority) return null;
    if (priority.includes('P0')) return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' };
    if (priority.includes('P1')) return { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300' };
    return { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-300' };
  }, [priority]);
  
  return (
    <div 
      className={cn(
        "group bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50 ring-2 ring-blue-400 ring-offset-2"
      )}
      draggable
      onDragStart={(e) => onDragStart(e, node.id)}
      onDragEnd={onDragEnd}
      onClick={onEdit}
    >
      {/* 拖拽手柄 */}
      <div className="flex items-start gap-2">
        <GripVertical 
          size={14} 
          className="text-gray-400 dark:text-gray-500 mt-1 opacity-50 group-hover:opacity-100 transition-opacity flex-shrink-0 cursor-grab"
        />
        
        {/* 圆点 - 点击进入聚焦视图 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFocus();
              }}
              className="flex-shrink-0 mt-1 p-0.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <Circle 
                size={8} 
                className="fill-current"
                style={{ color: tag.color }}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent>聚焦模式</TooltipContent>
        </Tooltip>
        
        <div className="flex-1 min-w-0">
          {/* 标题 */}
          <p className="text-sm font-medium text-gray-800 dark:text-gray-100 line-clamp-2 mb-2">
            {node.content || '无标题任务'}
          </p>
          
          {/* 元信息 */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* 优先级 */}
            {priority && priorityStyle && (
              <span className={cn(
                "inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded",
                priorityStyle.bg,
                priorityStyle.text
              )}>
                {priority}
              </span>
            )}
            
            {/* 截止日期 */}
            {dueDate && (
              <span className="inline-flex items-center text-xs text-gray-500 dark:text-gray-400">
                <Clock size={12} className="mr-1" />
                {dueDate}
              </span>
            )}
            
            {/* 负责人 */}
            {assignee && (
              <span className="inline-flex items-center text-xs text-gray-500 dark:text-gray-400">
                @{assignee}
              </span>
            )}
          </div>
        </div>
        
        {/* 编辑按钮 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 hover:text-blue-500"
            >
              <Edit3 size={14} />
            </button>
          </TooltipTrigger>
          <TooltipContent>编辑</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};

const KanbanView: React.FC<KanbanViewProps> = ({ tagId }) => {
  const nodes = useNodeStore((state) => state.nodes);
  const updateNode = useNodeStore((state) => state.updateNode);
  const setHoistedNode = useNodeStore((state) => state.setHoistedNode);
  const supertags = useSupertagStore((state) => state.supertags);
  const setPerspectiveActive = usePerspectiveStore((state) => state.setActiveTag);
  
  // 编辑弹窗状态
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  
  // 拖拽状态
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  
  const tag = supertags[tagId];
  const getDescendantIds = useSupertagStore((s) => s.getDescendantIds);

  // 获取所有带有该标签或其子标签的节点（v2.1 多态查询）
  const taggedNodes = useMemo(() => {
    const ids = getDescendantIds(tagId);
    return Object.values(nodes).filter(
      (node) =>
        (node.supertagId && ids.includes(node.supertagId)) ||
        node.tags.some((t) => ids.includes(t))
    );
  }, [nodes, tagId, getDescendantIds]);
  
  // 按状态分组
  const groupedTasks = useMemo(() => {
    const groups: Record<string, Node[]> = {};
    
    // 初始化所有列
    KANBAN_COLUMNS.forEach(col => {
      groups[col.key] = [];
    });
    
    // 分配任务到对应列
    taggedNodes.forEach(node => {
      const status = (node.fields.status as string) || '待办';
      if (groups[status]) {
        groups[status].push(node);
      } else {
        // 未知状态放入待办
        groups['待办'].push(node);
      }
    });
    
    return groups;
  }, [taggedNodes]);
  
  // 处理状态变更
  const handleStatusChange = useCallback((nodeId: string, newStatus: string) => {
    updateNode(nodeId, {
      fields: {
        ...nodes[nodeId].fields,
        status: newStatus,
      }
    });
  }, [nodes, updateNode]);
  
  // 导航到节点
  const handleNavigate = useCallback((nodeId: string) => {
    setHoistedNode(nodeId);
  }, [setHoistedNode]);

  // 聚焦到节点（退出透视，进入大纲聚焦模式）
  const handleFocus = useCallback((nodeId: string) => {
    setPerspectiveActive(null);  // 退出透视模式
    setHoistedNode(nodeId);      // 进入聚焦模式
  }, [setPerspectiveActive, setHoistedNode]);
  
  // 打开编辑弹窗
  const handleEdit = useCallback((nodeId: string) => {
    setEditingNodeId(nodeId);
  }, []);
  
  // 拖拽开始
  const handleDragStart = useCallback((e: React.DragEvent, nodeId: string) => {
    setDraggingNodeId(nodeId);
    e.dataTransfer.setData('text/plain', nodeId);
    e.dataTransfer.effectAllowed = 'move';
    
    // 设置拖拽时的视觉效果
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  }, []);
  
  // 拖拽结束
  const handleDragEnd = useCallback((e: React.DragEvent) => {
    setDraggingNodeId(null);
    setDragOverColumn(null);
    
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  }, []);
  
  // 拖拽经过列
  const handleDragOver = useCallback((e: React.DragEvent, columnKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnKey);
  }, []);
  
  // 拖拽离开列
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // 检查是否真的离开了列（而不是进入子元素）
    const relatedTarget = e.relatedTarget as HTMLElement;
    const currentTarget = e.currentTarget as HTMLElement;
    if (!currentTarget.contains(relatedTarget)) {
      setDragOverColumn(null);
    }
  }, []);
  
  // 放置到列
  const handleDrop = useCallback((e: React.DragEvent, columnKey: string) => {
    e.preventDefault();
    const nodeId = e.dataTransfer.getData('text/plain');
    
    if (nodeId && nodes[nodeId]) {
      const currentStatus = (nodes[nodeId].fields.status as string) || '待办';
      
      // 如果状态改变了，更新节点
      if (currentStatus !== columnKey) {
        handleStatusChange(nodeId, columnKey);
      }
    }
    
    setDraggingNodeId(null);
    setDragOverColumn(null);
  }, [nodes, handleStatusChange]);
  
  if (!tag) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <AlertCircle className="mr-2" />
        标签不存在
      </div>
    );
  }
  
  return (
    <TooltipProvider>
    <div className="h-full flex flex-col">
      {/* 标题 */}
      <div className="flex items-center gap-3 mb-6">
        <div 
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-bold shadow-lg"
          style={{ backgroundColor: tag.color }}
        >
          <Hash size={20} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
            #{tag.name}
          </h2>
          <p className="text-sm text-gray-500">
            共 {taggedNodes.length} 个任务 · 拖拽卡片可更改状态
          </p>
        </div>
      </div>
      
      {/* 看板 */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-4 min-w-max h-full pb-4">
          {KANBAN_COLUMNS.map((column) => {
            const Icon = column.icon;
            const tasks = groupedTasks[column.key] || [];
            const isDropTarget = dragOverColumn === column.key;
            
            return (
              <div 
                key={column.key}
                className={cn(
                  "w-72 flex-shrink-0 rounded-xl p-3 flex flex-col transition-all duration-200",
                  column.bgColor,
                  isDropTarget && `ring-2 ${column.dropColor} ring-offset-2 bg-opacity-80`
                )}
                onDragOver={(e) => handleDragOver(e, column.key)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, column.key)}
              >
                {/* 列标题 */}
                <div className="flex items-center gap-2 mb-3 px-1">
                  <Icon size={16} className={column.color} />
                  <span className="font-medium text-gray-700 dark:text-gray-200">
                    {column.label}
                  </span>
                  <span className="ml-auto text-xs text-gray-400 bg-white dark:bg-gray-700 px-2 py-0.5 rounded-full">
                    {tasks.length}
                  </span>
                </div>
                
                {/* 任务列表 */}
                <div className={cn(
                  "flex-1 space-y-2 overflow-y-auto min-h-[100px] rounded-lg transition-all duration-200",
                  isDropTarget && "bg-white/50 dark:bg-gray-900/30"
                )}>
                  {tasks.length > 0 ? (
                    tasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        node={task}
                        tag={tag}
                        onStatusChange={(newStatus) => handleStatusChange(task.id, newStatus)}
                        onNavigate={() => handleNavigate(task.id)}
                        onFocus={() => handleFocus(task.id)}
                        onEdit={() => handleEdit(task.id)}
                        isDragging={draggingNodeId === task.id}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                      />
                    ))
                  ) : (
                    <div className={cn(
                      "text-center py-8 text-gray-400 text-sm rounded-lg border-2 border-dashed border-transparent transition-all",
                      isDropTarget && "border-gray-300 dark:border-gray-600 bg-white/30 dark:bg-gray-800/30"
                    )}>
                      {isDropTarget ? '放置到这里' : '暂无任务'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* 节点详情编辑弹窗 */}
      <NodeDetailModal
        nodeId={editingNodeId}
        open={editingNodeId !== null}
        onOpenChange={(open) => !open && setEditingNodeId(null)}
      />
    </div>
    </TooltipProvider>
  );
};

export default KanbanView;
