'use client';

/**
 * ViewSwitcher - 视图切换器组件
 * v3.6: 支持在不同视图类型间快速切换
 */

import React from 'react';
import { LayoutGrid, Table2, List, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ViewLayoutType } from '@/types/view-config';
import type { FieldDefinition } from '@/types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ViewSwitcherProps {
  currentType: ViewLayoutType;
  availableTypes: ViewLayoutType[];
  groupByField?: string;
  fieldDefinitions: FieldDefinition[];
  onChange: (type: ViewLayoutType) => void;
}

/**
 * 视图类型配置
 */
const VIEW_CONFIG: Record<ViewLayoutType, {
  icon: React.ReactNode;
  label: string;
  requiresGroupField?: boolean;
}> = {
  table: {
    icon: <Table2 size={16} />,
    label: '表格视图',
  },
  kanban: {
    icon: <LayoutGrid size={16} />,
    label: '看板视图',
    requiresGroupField: true,
  },
  list: {
    icon: <List size={16} />,
    label: '列表视图',
  },
};

export function ViewSwitcher({
  currentType,
  availableTypes,
  groupByField,
  fieldDefinitions,
  onChange,
}: ViewSwitcherProps) {
  // 检查是否有可用的分组字段
  const hasSelectField = fieldDefinitions.some(
    (f) => f.type === 'select' || f.type === 'multi-select'
  );
  
  return (
    <TooltipProvider>
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {availableTypes.map((type) => {
          const config = VIEW_CONFIG[type];
          if (!config) return null;
          
          const isActive = currentType === type;
          const isDisabled = config.requiresGroupField && !hasSelectField;
          
          return (
            <Tooltip key={type}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => !isDisabled && onChange(type)}
                  disabled={isDisabled}
                  className={cn(
                    'p-1.5 rounded-md transition-all',
                    isActive
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300',
                    isDisabled && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {config.icon}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <div className="flex items-center gap-1">
                  <span>{config.label}</span>
                  {isDisabled && (
                    <span className="text-yellow-500 flex items-center gap-0.5">
                      <AlertCircle size={10} />
                      需要选择字段
                    </span>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

export default ViewSwitcher;
