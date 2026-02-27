'use client';

import React, { useMemo, useCallback, useState } from 'react';
import { 
  Calendar, Clock, Users, ChevronRight, Hash, AlertCircle,
  CalendarDays, Circle, Edit3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNodeStore } from '@/stores/nodeStore';
import { useSupertagStore } from '@/stores/supertagStore';
import { usePerspectiveStore } from '@/stores/perspectiveStore';
import { Node, Supertag } from '@/types';
import NodeDetailModal from '../NodeDetailModal';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

interface AgendaViewProps {
  tagId: string;
}

// 周几名称
const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

// 获取日期所在的周
const getWeekKey = (dateStr: string): string => {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '未设定日期';
  
  // 获取周一的日期作为 key
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  
  return monday.toISOString().split('T')[0];
};

// 获取周范围的显示文本
const getWeekRangeLabel = (mondayStr: string): string => {
  if (mondayStr === '未设定日期') return '未设定日期';
  
  const monday = new Date(mondayStr);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  
  const formatDate = (d: Date) => `${d.getMonth() + 1}月${d.getDate()}日`;
  
  return `${formatDate(monday)} - ${formatDate(sunday)}`;
};

// 判断是否是本周
const isThisWeek = (mondayStr: string): boolean => {
  if (mondayStr === '未设定日期') return false;
  
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() + diff);
  
  return mondayStr === thisMonday.toISOString().split('T')[0];
};

// 会议卡片组件
const MeetingCard: React.FC<{
  node: Node;
  tag: Supertag;
  onNavigate: () => void;
  onFocus: () => void;  // 聚焦视图回调
  onEdit: () => void;   // 编辑回调
}> = ({ node, tag, onNavigate, onFocus, onEdit }) => {
  const meetingDate = node.fields.date as string | undefined;
  const attendees = node.fields.attendees as string | undefined;
  const meetingType = node.fields.type as string | undefined;
  
  // 获取星期几
  const weekday = useMemo(() => {
    if (!meetingDate) return null;
    const date = new Date(meetingDate);
    if (isNaN(date.getTime())) return null;
    return WEEKDAY_NAMES[date.getDay()];
  }, [meetingDate]);
  
  // 会议类型颜色
  const typeStyle = useMemo(() => {
    if (!meetingType) return null;
    if (meetingType === '内部周会') return { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' };
    if (meetingType === '产品评审') return { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300' };
    if (meetingType === '客户沟通') return { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300' };
    if (meetingType === '面试') return { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300' };
    return { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-300' };
  }, [meetingType]);
  
  return (
    <div 
      className="group flex items-stretch bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer"
      onClick={onEdit}
    >
      {/* 左侧日期区域 */}
      <div 
        className="w-20 flex-shrink-0 flex flex-col items-center justify-center py-3 text-white"
        style={{ backgroundColor: tag.color }}
      >
        {weekday ? (
          <>
            <span className="text-xs opacity-80">{weekday}</span>
            <span className="text-lg font-bold">
              {meetingDate ? new Date(meetingDate).getDate() : '--'}
            </span>
          </>
        ) : (
          <span className="text-xs">未设定</span>
        )}
      </div>
      
      {/* 右侧内容 */}
      <div className="flex-1 p-3 min-w-0">
        {/* 标题行 */}
        <div className="flex items-start gap-2 mb-1">
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
          <p className="text-sm font-medium text-gray-800 dark:text-gray-100 line-clamp-1">
            {node.content || '无标题会议'}
          </p>
        </div>
        
        {/* 元信息 */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* 会议类型 */}
          {meetingType && typeStyle && (
            <span className={cn(
              "inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded",
              typeStyle.bg,
              typeStyle.text
            )}>
              {meetingType}
            </span>
          )}
          
          {/* 参会人 */}
          {attendees && (
            <span className="inline-flex items-center text-xs text-gray-500 dark:text-gray-400">
              <Users size={12} className="mr-1" />
              {attendees}
            </span>
          )}
        </div>
      </div>
      
      {/* 编辑按钮 */}
      <div className="flex items-center pr-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity hover:text-blue-500"
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

const AgendaView: React.FC<AgendaViewProps> = ({ tagId }) => {
  const nodes = useNodeStore((state) => state.nodes);
  const setHoistedNode = useNodeStore((state) => state.setHoistedNode);
  const supertags = useSupertagStore((state) => state.supertags);
  const setPerspectiveActive = usePerspectiveStore((state) => state.setActiveTag);
  
  // 编辑弹窗状态
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  
  const tag = supertags[tagId];
  
  // 获取所有带有该标签的节点
  const getDescendantIds = useSupertagStore((s) => s.getDescendantIds);
  const taggedNodes = useMemo(() => {
    const ids = getDescendantIds(tagId);
    return Object.values(nodes).filter(
      (node) =>
        (node.supertagId && ids.includes(node.supertagId)) ||
        node.tags.some((t) => ids.includes(t))
    );
  }, [nodes, tagId, getDescendantIds]);
  
  // 按周分组
  const groupedByWeek = useMemo(() => {
    const groups: Record<string, Node[]> = {};
    
    taggedNodes.forEach(node => {
      const dateStr = node.fields.date as string;
      const weekKey = dateStr ? getWeekKey(dateStr) : '未设定日期';
      
      if (!groups[weekKey]) {
        groups[weekKey] = [];
      }
      groups[weekKey].push(node);
    });
    
    // 在每周内按日期排序
    Object.keys(groups).forEach(weekKey => {
      groups[weekKey].sort((a, b) => {
        const dateA = a.fields.date as string || '';
        const dateB = b.fields.date as string || '';
        return dateA.localeCompare(dateB);
      });
    });
    
    return groups;
  }, [taggedNodes]);
  
  // 获取排序后的周列表
  const sortedWeeks = useMemo(() => {
    const weeks = Object.keys(groupedByWeek);
    return weeks.sort((a, b) => {
      if (a === '未设定日期') return 1;
      if (b === '未设定日期') return -1;
      return a.localeCompare(b);
    });
  }, [groupedByWeek]);
  
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
          <Calendar size={20} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
            #{tag.name}
          </h2>
          <p className="text-sm text-gray-500">
            共 {taggedNodes.length} 个会议
          </p>
        </div>
      </div>
      
      {/* 周历列表 */}
      <div className="flex-1 overflow-y-auto space-y-6">
        {sortedWeeks.length > 0 ? (
          sortedWeeks.map((weekKey) => {
            const meetings = groupedByWeek[weekKey];
            const isCurrentWeek = isThisWeek(weekKey);
            
            return (
              <div key={weekKey}>
                {/* 周标题 */}
                <div className={cn(
                  "flex items-center gap-2 mb-3 px-2 py-1 rounded-lg",
                  isCurrentWeek && "bg-blue-50 dark:bg-blue-900/20"
                )}>
                  <CalendarDays size={16} className={cn(
                    isCurrentWeek ? "text-blue-500" : "text-gray-400"
                  )} />
                  <span className={cn(
                    "font-medium",
                    isCurrentWeek ? "text-blue-700 dark:text-blue-300" : "text-gray-600 dark:text-gray-300"
                  )}>
                    {getWeekRangeLabel(weekKey)}
                  </span>
                  {isCurrentWeek && (
                    <span className="text-xs px-2 py-0.5 bg-blue-500 text-white rounded-full">
                      本周
                    </span>
                  )}
                  <span className="ml-auto text-xs text-gray-400">
                    {meetings.length} 个会议
                  </span>
                </div>
                
                {/* 会议列表 */}
                <div className="space-y-2 pl-2">
                  {meetings.map((meeting) => (
                    <MeetingCard
                      key={meeting.id}
                      node={meeting}
                      tag={tag}
                      onNavigate={() => handleNavigate(meeting.id)}
                      onFocus={() => handleFocus(meeting.id)}
                      onEdit={() => handleEdit(meeting.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-12 text-gray-400">
            <Calendar size={48} className="mx-auto mb-3 opacity-50" />
            <p>暂无会议记录</p>
          </div>
        )}
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

export default AgendaView;
