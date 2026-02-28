import { ChevronDown, ChevronRight, Circle, GripVertical, Sparkles } from 'lucide-react';
import type { MouseEvent } from 'react';
import { cn } from '@/lib/utils';

interface NodeActionsProps {
  isCommandNode: boolean;
  hasChildren: boolean;
  isCollapsed: boolean;
  hasNodeTags: boolean;
  onCollapseClick: (e: MouseEvent) => void;
  onBulletClick: (e: MouseEvent) => void;
}

export default function NodeActions({
  isCommandNode,
  hasChildren,
  isCollapsed,
  hasNodeTags,
  onCollapseClick,
  onBulletClick,
}: NodeActionsProps) {
  return (
    <>
      <div className="flex items-center gap-0.5 mr-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button className="p-0.5 text-gray-400 hover:text-gray-600 cursor-grab" title="拖拽排序">
          <GripVertical size={14} />
        </button>
      </div>

      <div className="flex items-center mr-1 mt-0.5 flex-shrink-0">
        {isCommandNode ? (
          <>
            <div className="flex items-center justify-center w-5 h-5 rounded bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-sm">
              <Sparkles size={12} />
            </div>
            {hasChildren && (
              <button
                onClick={onCollapseClick}
                className="flex items-center justify-center w-5 h-5 rounded text-purple-600 hover:text-purple-700 hover:bg-purple-100 dark:text-purple-400 dark:hover:bg-purple-900/30 ml-0.5"
                title={isCollapsed ? '展开 AI 响应' : '折叠 AI 响应'}
              >
                {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
              </button>
            )}
          </>
        ) : (
          <>
            <button
              onClick={onCollapseClick}
              className={cn(
                'flex items-center justify-center w-5 h-5 rounded transition-colors cursor-pointer',
                hasChildren || hasNodeTags
                  ? 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                  : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100 dark:text-gray-600 dark:hover:text-gray-400 dark:hover:bg-gray-700'
              )}
              title={hasChildren ? (isCollapsed ? '展开' : '折叠') : '点击创建子节点'}
            >
              {isCollapsed ? (
                <ChevronRight size={16} className="transition-transform" />
              ) : (
                <ChevronDown size={16} className="transition-transform" />
              )}
            </button>
            <button
              onClick={onBulletClick}
              className={cn(
                'flex items-center justify-center w-5 h-5 rounded transition-all',
                'text-gray-400 hover:text-blue-500 hover:scale-125 cursor-pointer',
                'group-hover:text-gray-500'
              )}
              title="点击进入聚焦模式"
            >
              <Circle size={6} className="fill-current" />
            </button>
          </>
        )}
      </div>
    </>
  );
}
