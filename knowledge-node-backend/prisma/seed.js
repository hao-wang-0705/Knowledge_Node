const { PrismaClient, Prisma } = require('@prisma/client');

const prisma = new PrismaClient();

const PRESET_TAGS = [
  {
    name: 'Task',
    color: '#3B82F6',
    icon: '☑️',
    description: '任务管理标签，包含 AI 智能字段',
    order: 1,
    fieldDefinitions: [
      { id: 'task_status', key: 'status', name: '状态', type: 'select', options: ['Todo', 'Doing', 'Done'] },
      { id: 'task_due_date', key: 'due_date', name: '截止日期', type: 'date' },
      { id: 'task_assignee', key: 'assignee', name: '负责人', type: 'text' },
      {
        id: 'task_ai_urgency',
        key: 'ai_urgency_score',
        name: 'AI 紧急度',
        type: 'ai_select',
        options: ['P0', 'P1', 'P2', 'P3'],
        aiConfig: {
          aiType: 'urgency_score',
          triggerOn: 'create',
          outputFormat: 'select',
          options: ['P0', 'P1', 'P2', 'P3'],
          inputFields: ['status', 'due_date'],
        },
      },
      {
        id: 'task_ai_subtasks',
        key: 'ai_subtasks',
        name: 'AI 子任务',
        type: 'ai_text',
        aiConfig: { aiType: 'subtask_split', triggerOn: 'manual', outputFormat: 'list' },
      },
    ],
    templateContent: {
      content: '',
      children: [{ content: '任务描述：' }, { content: '验收标准：' }],
    },
  },
  {
    name: 'Meeting',
    color: '#8B5CF6',
    icon: '📅',
    description: '会议记录标签',
    order: 2,
    fieldDefinitions: [
      { id: 'meeting_date', key: 'date', name: '会议日期', type: 'date' },
      { id: 'meeting_time', key: 'time', name: '会议时间', type: 'text' },
      { id: 'meeting_participants', key: 'participants', name: '参会人员', type: 'text' },
      { id: 'meeting_agenda', key: 'agenda', name: '议程', type: 'text' },
    ],
    templateContent: {
      content: '',
      children: [{ content: '议程：' }, { content: '讨论要点：' }, { content: '待办事项：' }],
    },
  },
  {
    name: 'Idea',
    color: '#F59E0B',
    icon: '💡',
    description: '灵感记录标签',
    order: 3,
    fieldDefinitions: [
      { id: 'idea_source', key: 'source', name: '来源', type: 'text' },
      { id: 'idea_status', key: 'status', name: '状态', type: 'select', options: ['待整理', '已归档', '已实现'] },
    ],
  },
  {
    name: 'Book',
    color: '#10B981',
    icon: '📚',
    description: '书籍阅读记录',
    order: 4,
    fieldDefinitions: [
      { id: 'book_author', key: 'author', name: '作者', type: 'text' },
      { id: 'book_rating', key: 'rating', name: '评分', type: 'number' },
      { id: 'book_status', key: 'status', name: '阅读状态', type: 'select', options: ['想读', '在读', '已读'] },
      { id: 'book_start_date', key: 'start_date', name: '开始日期', type: 'date' },
    ],
  },
];

async function upsertPresetTag(tag) {
  const existing = await prisma.tagTemplate.findFirst({ where: { name: tag.name } });

  const data = {
    color: tag.color,
    icon: tag.icon,
    description: tag.description,
    fieldDefinitions: tag.fieldDefinitions,
    templateContent: tag.templateContent ?? Prisma.JsonNull,
    isGlobalDefault: true,
    status: 'active',
    order: tag.order,
  };

  if (existing) {
    await prisma.tagTemplate.update({
      where: { id: existing.id },
      data,
    });
    console.log(`[seed] updated preset tag: ${tag.name} (${existing.id})`);
    return;
  }

  const created = await prisma.tagTemplate.create({
    data: {
      name: tag.name,
      ...data,
    },
  });
  console.log(`[seed] created preset tag: ${tag.name} (${created.id})`);
}

async function main() {
  for (const tag of PRESET_TAGS) {
    await upsertPresetTag(tag);
  }
}

main()
  .catch((error) => {
    console.error('[seed] failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
