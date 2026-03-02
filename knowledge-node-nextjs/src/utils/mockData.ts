import { Node, Supertag, PRESET_CATEGORY_IDS } from '@/types';
import { generateId } from './helpers';
import { SYSTEM_TAGS, getCalendarPath, getISOWeekNumber, getISOWeekYear } from './date-helpers';

// 预设标签颜色
export const TAG_COLORS = [
  '#2563EB', // 蓝色
  '#22C55E', // 绿色
  '#EF4444', // 红色
  '#F59E0B', // 橙色
  '#8B5CF6', // 紫色
  '#EC4899', // 粉色
  '#06B6D4', // 青色
  '#84CC16', // 柠檬绿
];

// 固定的标签 ID（用于 reference 类型引用）
// 仅保留5个核心标签：待办、会议、问题、灵感、文档
export const FIXED_TAG_IDS = {
  TASK: 'tag_task',        // 待办（原任务）
  MEETING: 'tag_meeting',  // 会议
  PROBLEM: 'tag_problem',  // 问题
  IDEA: 'tag_idea',        // 灵感
  DOC: 'tag_doc',          // 文档
  // v2.1: 继承示例标签
  WORK_MEETING: 'tag_work_meeting',  // 工作会议（继承自会议）
};

// 创建系统标签（日历相关）
const createSystemSupertags = (): Record<string, Supertag> => {
  return {
    // 年标签
    [SYSTEM_TAGS.YEAR]: {
      id: SYSTEM_TAGS.YEAR,
      name: 'Year',
      color: '#6366F1', // 靛蓝色
      fieldDefinitions: [],
      isSystem: true,
      categoryId: PRESET_CATEGORY_IDS.UNCATEGORIZED,
    },
    // 月标签
    [SYSTEM_TAGS.MONTH]: {
      id: SYSTEM_TAGS.MONTH,
      name: 'Month',
      color: '#8B5CF6', // 紫色
      fieldDefinitions: [],
      isSystem: true,
      categoryId: PRESET_CATEGORY_IDS.UNCATEGORIZED,
    },
    // 周标签
    [SYSTEM_TAGS.WEEK]: {
      id: SYSTEM_TAGS.WEEK,
      name: 'Week',
      color: '#06B6D4', // 青色
      fieldDefinitions: [],
      isSystem: true,
      categoryId: PRESET_CATEGORY_IDS.UNCATEGORIZED,
    },
    // 日标签
    [SYSTEM_TAGS.DAY]: {
      id: SYSTEM_TAGS.DAY,
      name: 'Day',
      color: '#10B981', // 绿色
      fieldDefinitions: [],
      isSystem: true,
      categoryId: PRESET_CATEGORY_IDS.UNCATEGORIZED,
    },
  };
};

// 创建 Mock 超级标签 - 功能标签 (Type Tags) + 系统标签
// 仅保留5个核心标签：待办、会议、问题、灵感、文档
export const createMockSupertags = (): Record<string, Supertag> => {
  // 系统标签 (日历)
  const systemTags = createSystemSupertags();
  
  // 功能标签 (Type Tags) - 定义节点的属性和行为
  // 仅保留5个核心标签
  const typeTags: Record<string, Supertag> = {
    // 待办标签 ☑️（原任务）
    [FIXED_TAG_IDS.TASK]: {
      id: FIXED_TAG_IDS.TASK,
      name: '待办',
      color: '#EF4444', // 红色
      categoryId: PRESET_CATEGORY_IDS.UNCATEGORIZED,
      icon: '☑️',
      description: '待办事项和任务追踪',
      order: 0,
      fieldDefinitions: [
        { id: 'f_task_status', key: 'status', name: '状态', type: 'select', options: ['待办', '进行中', '已完成', '搁置'] },
        { id: 'f_task_priority', key: 'priority', name: '优先级', type: 'select', options: ['P0-紧急', 'P1-重要', 'P2-一般'] },
        { id: 'f_task_due', key: 'due_date', name: '截止日期', type: 'date' },
        { id: 'f_task_assignee', key: 'assignee', name: '关联人', type: 'text' },
      ],
    },
    // 会议标签 📅
    [FIXED_TAG_IDS.MEETING]: {
      id: FIXED_TAG_IDS.MEETING,
      name: '会议',
      color: '#2563EB', // 蓝色
      categoryId: PRESET_CATEGORY_IDS.UNCATEGORIZED,
      icon: '📅',
      description: '会议记录和日程安排',
      order: 1,
      fieldDefinitions: [
        { id: 'f_mtg_date', key: 'date', name: '会议日期', type: 'date' },
        { id: 'f_mtg_time', key: 'time', name: '会议时间', type: 'text' },
        { id: 'f_mtg_attendees', key: 'attendees', name: '参会人', type: 'text' },
        { id: 'f_mtg_type', key: 'type', name: '会议类型', type: 'select', options: ['内部周会', '产品评审', '客户沟通', '面试', '一对一', '头脑风暴'] },
        { id: 'f_mtg_location', key: 'location', name: '会议地点', type: 'text' },
        { id: 'f_mtg_agenda', key: 'agenda', name: '会议议程', type: 'text' },
      ],
    },
    // 问题标签 🔥
    [FIXED_TAG_IDS.PROBLEM]: {
      id: FIXED_TAG_IDS.PROBLEM,
      name: '问题',
      color: '#DC2626', // 红色
      categoryId: PRESET_CATEGORY_IDS.UNCATEGORIZED,
      icon: '🔥',
      description: '工作中的痛点、困惑或待解决的问题',
      order: 2,
      fieldDefinitions: [
        { id: 'f_prob_severity', key: 'severity', name: '严重程度', type: 'select', options: ['高', '中', '低'] },
        { id: 'f_prob_status', key: 'status', name: '状态', type: 'select', options: ['待解决', '探索中', '已解决'] },
        { id: 'f_prob_context', key: 'context', name: '发生场景', type: 'text' },
        { id: 'f_prob_impact', key: 'impact', name: '影响范围', type: 'text' },
      ],
    },
    // 灵感标签 💡
    [FIXED_TAG_IDS.IDEA]: {
      id: FIXED_TAG_IDS.IDEA,
      name: '灵感',
      color: '#22C55E', // 绿色
      categoryId: PRESET_CATEGORY_IDS.UNCATEGORIZED,
      icon: '💡',
      description: '灵光一现的想法、参考案例或假设',
      order: 3,
      fieldDefinitions: [
        { id: 'f_idea_confidence', key: 'confidence', name: '信心指数', type: 'select', options: ['⭐⭐⭐⭐⭐ 非常可行', '⭐⭐⭐ 值得一试', '⭐ 待验证'] },
        { id: 'f_idea_source', key: 'source', name: '来源', type: 'select', options: ['我的想法', '同事建议', '竞品参考', '用户反馈', '行业资讯'] },
        { id: 'f_idea_url', key: 'url', name: '参考链接', type: 'text' },
        { id: 'f_idea_status', key: 'status', name: '状态', type: 'select', options: ['草稿池', '孵化中', '已采纳', '已废弃'] },
      ],
    },
    // 文档标签 📄
    [FIXED_TAG_IDS.DOC]: {
      id: FIXED_TAG_IDS.DOC,
      name: '文档',
      color: '#64748B', // 灰色
      categoryId: PRESET_CATEGORY_IDS.UNCATEGORIZED,
      icon: '📄',
      description: '文档管理和知识沉淀',
      order: 4,
      fieldDefinitions: [
        { id: 'f_doc_type', key: 'type', name: '文档类型', type: 'select', options: ['PRD', '技术方案', '调研报告', '会议纪要', '周报', '攻略'] },
        { id: 'f_doc_comp', key: 'completeness', name: '完成度', type: 'select', options: ['草稿', '评审中', '定稿'] },
        { id: 'f_doc_author', key: 'author', name: '作者', type: 'text' },
        { id: 'f_doc_version', key: 'version', name: '版本', type: 'text' },
        { id: 'f_doc_link', key: 'url', name: '关联链接', type: 'text' },
      ],
    },
    // v2.1 继承示例：工作会议（继承自会议标签）🏢
    [FIXED_TAG_IDS.WORK_MEETING]: {
      id: FIXED_TAG_IDS.WORK_MEETING,
      name: '工作会议',
      color: '#1D4ED8', // 深蓝色
      categoryId: PRESET_CATEGORY_IDS.UNCATEGORIZED,
      icon: '🏢',
      description: '工作相关的会议，继承自「会议」标签',
      order: 5,
      parentId: FIXED_TAG_IDS.MEETING, // 继承自会议标签
      fieldDefinitions: [
        // 自有字段（会覆盖或补充父标签的字段）
        { id: 'f_wm_project', key: 'project', name: '关联项目', type: 'text' },
        { id: 'f_wm_decision', key: 'decision', name: '决策事项', type: 'text' },
      ],
    },
  };
  
  // 合并系统标签和功能标签
  return { ...systemTags, ...typeTags };
};

// 创建 Mock 节点数据 - 包含日历数据
export const createMockNodes = (_supertags: Record<string, Supertag>): { nodes: Record<string, Node>; rootIds: string[] } => {
  // 直接调用只保留日历结构的初始化函数
  return createCalendarOnlyNodes();
};

// 创建只包含日历节点的数据（空白初始化）
export const createCalendarOnlyNodes = (): { nodes: Record<string, Node>; rootIds: string[] } => {
  const nodes: Record<string, Node> = {};
  const rootIds: string[] = [];
  const now = Date.now();

  // 辅助函数：创建日历节点
  const createCalendarNode = (
    id: string, 
    content: string, 
    parentId: string | null, 
    tagId: string,
    childrenIds: string[] = []
  ): Node => ({
    id,
    content,
    parentId,
    childrenIds,
    isCollapsed: true,
    tags: [tagId],
    // 超级标签体系
    supertagId: tagId,  // 日历节点的功能标签
    fields: {},
    createdAt: now,
  });

  // 辅助函数：为指定日期创建日历层级（年→周→日）
  const ensureCalendarHierarchy = (date: Date): { yearId: string; weekId: string; dayId: string } => {
    const path = getCalendarPath(date);

    if (!nodes[path.yearId]) {
      nodes[path.yearId] = createCalendarNode(path.yearId, path.yearContent, null, SYSTEM_TAGS.YEAR, []);
      if (!rootIds.includes(path.yearId)) {
        rootIds.push(path.yearId);
      }
    }

    if (!nodes[path.weekId]) {
      nodes[path.weekId] = createCalendarNode(path.weekId, path.weekContent, path.yearId, SYSTEM_TAGS.WEEK, []);
      const yearNode = nodes[path.yearId];
      if (!yearNode.childrenIds.includes(path.weekId)) {
        yearNode.childrenIds = [...yearNode.childrenIds, path.weekId];
      }
    }

    if (!nodes[path.dayId]) {
      nodes[path.dayId] = createCalendarNode(path.dayId, path.dayContent, path.weekId, SYSTEM_TAGS.DAY, []);
      const weekNode = nodes[path.weekId];
      if (!weekNode.childrenIds.includes(path.dayId)) {
        weekNode.childrenIds = [...weekNode.childrenIds, path.dayId];
      }
    }

    return path;
  };

  // 辅助函数：获取一周内从周一到今天的所有日期（不包括未来日期）
  const getWeekDatesUntilToday = (date: Date): Date[] => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day; // 周一开始
    const monday = new Date(d);
    monday.setDate(d.getDate() + diff);
    
    // 获取今天的日期（不含时间）
    const today = new Date(date);
    today.setHours(0, 0, 0, 0);
    
    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const weekDay = new Date(monday);
      weekDay.setDate(monday.getDate() + i);
      weekDay.setHours(0, 0, 0, 0);
      
      // 只添加今天及之前的日期，不创建未来日期
      if (weekDay <= today) {
        dates.push(weekDay);
      }
    }
    return dates;
  };

  // 获取今天的日期和本周已过去的日期（包括今天）
  const today = new Date();
  const todayPath = getCalendarPath(today);
  const weekDates = getWeekDatesUntilToday(today);

  // 创建本周每天的日历节点（只创建今天及之前的日期，不创建未来日期）
  weekDates.forEach((date) => {
    const dayPath = ensureCalendarHierarchy(date);
    
    // 今天的节点默认展开
    if (dayPath.dayId === todayPath.dayId) {
      nodes[dayPath.dayId].isCollapsed = false;
    }
  });

  // 展开当前年、周节点，方便查看
  if (nodes[todayPath.yearId]) nodes[todayPath.yearId].isCollapsed = false;
  if (nodes[todayPath.weekId]) nodes[todayPath.weekId].isCollapsed = false;

  return { nodes, rootIds };
};