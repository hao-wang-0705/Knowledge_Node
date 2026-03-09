/**
 * #任务 样板间预置配置
 * v3.6: 状态看板 + AI 站会播报的完整工作流配置
 */

import type { ViewConfig } from '@/types/view-config';

/**
 * #任务 标签的 ViewConfig 预置配置
 * 
 * 功能特性：
 * 1. 顶栏 AI 站会播报 - 聚合今日到期/逾期任务，输出高优预警
 * 2. 状态看板主工作区 - 以"状态"字段分组，卡片透出截止日期和负责人
 * 3. 极速流转 - Quick Capture 回车建任务 → 拖拽改状态 → Focus Panel 深入编辑
 */
export const TASK_KANBAN_CONFIG: ViewConfig = {
  version: '1.0',
  
  layout: {
    type: 'kanban',
    groupByField: 'task_status',
    sortField: 'due_date',
    sortOrder: 'asc',
  },
  
  widgets: {
    header: [
      {
        id: 'standup-report',
        type: 'ai-aggregation',
        props: {
          title: '📋 站会播报',
          query: {
            filters: [
              {
                field: 'task_status',
                operator: 'nin',
                value: ['已完成', '已取消'],
              },
            ],
            limit: 20,
            includeChildren: true,
            childDepth: 1,
          },
          prompt: `请作为站会主持人，分析以下任务列表并生成简洁的站会播报：

1. **高优预警**：列出已逾期或今天到期的任务，用 [[nodeId]] 格式引用
2. **进展摘要**：总结进行中任务的整体进度
3. **阻塞风险**：识别可能存在阻塞或依赖的任务

要求：
- 语言简洁有力，适合晨会口播
- 优先级最高的任务放在最前面
- 每个要点不超过 3 条`,
          cacheTTL: 600,
          showBacklinks: true,
        },
      },
    ],
  },
  
  actions: {
    quickCapture: {
      defaultFields: {
        task_status: '待启动',
      },
      placeholder: '快速添加任务，回车创建...',
    },
    
    drag: {
      targetField: 'task_status',
      allowedTransitions: {
        '待启动': ['进行中', '已取消'],
        '进行中': ['已完成', '待启动'],
        '已完成': ['进行中'],
        '已取消': ['待启动'],
      },
      debounceMs: 300,
    },
  },
};

/**
 * #任务 标签的字段定义参考
 * 用于创建或验证任务标签的字段结构
 */
export const TASK_FIELD_DEFINITIONS = [
  {
    key: 'task_status',
    name: '任务状态',
    type: 'select' as const,
    options: ['待启动', '进行中', '已完成', '已取消'],
  },
  {
    key: 'task_priority',
    name: '任务优先级',
    type: 'select' as const,
    options: ['P0', 'P1', 'P2', 'Nice To Have'],
  },
  {
    key: 'due_date',
    name: '截止日期',
    type: 'date' as const,
  },
];

/**
 * 获取 #任务 标签的完整 ViewConfig
 * 可根据实际字段定义动态调整
 */
export function getTaskKanbanConfig(customFields?: Record<string, unknown>): ViewConfig {
  if (!customFields) {
    return TASK_KANBAN_CONFIG;
  }
  
  // 深拷贝并合并自定义配置
  const config = JSON.parse(JSON.stringify(TASK_KANBAN_CONFIG)) as ViewConfig;
  
  if (config.actions?.quickCapture?.defaultFields) {
    config.actions.quickCapture.defaultFields = {
      ...config.actions.quickCapture.defaultFields,
      ...customFields,
    };
  }
  
  return config;
}

export default TASK_KANBAN_CONFIG;
