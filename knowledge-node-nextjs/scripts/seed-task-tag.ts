/**
 * @deprecated v3.5: 此脚本已废弃
 * 
 * 预置标签现通过以下方式管理：
 * 1. 管理员 API: POST /api/internal/tags/batch - 批量导入
 * 2. 管理员 API: PUT /api/internal/tags/:id - 更新单个标签  
 * 3. 管理员 API: DELETE /api/internal/tags/:id - 删除标签
 * 4. 初始化配置: knowledge-node-backend/prisma/preset-tags.json
 * 
 * 不再需要手动运行此脚本创建预置标签
 * 
 * ---
 * 
 * 种子脚本：创建 #Task 预置标签
 * v3.4: 包含 AI 智能字段（urgency_score, subtask_split）
 * 
 * 运行方式：
 * npx ts-node --compiler-options '{"module":"commonjs"}' scripts/seed-task-tag.ts
 * 
 * 或使用 tsx：
 * npx tsx scripts/seed-task-tag.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// #Task 标签的字段定义
const TASK_FIELD_DEFINITIONS = [
  // 基础字段
  {
    id: 'task_status',
    key: 'status',
    name: '状态',
    type: 'select',
    options: ['Todo', 'Doing', 'Done'],
  },
  {
    id: 'task_due_date',
    key: 'due_date',
    name: '截止日期',
    type: 'date',
  },
  {
    id: 'task_assignee',
    key: 'assignee',
    name: '负责人',
    type: 'text',
  },
  // AI 智能字段
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
    aiConfig: {
      aiType: 'subtask_split',
      triggerOn: 'manual', // 手动触发，因为子任务拆解可能比较耗时
      outputFormat: 'list',
    },
  },
];

// #Task 标签的默认内容模版
const TASK_TEMPLATE_CONTENT = {
  content: '',
  children: [
    { content: '任务描述：' },
    { content: '验收标准：' },
  ],
};

async function seedTaskTag() {
  console.log('🚀 开始创建 #Task 预置标签...\n');

  // 检查是否已存在同名标签
  const existingTag = await prisma.tagTemplate.findFirst({
    where: { name: 'Task' },
  });

  if (existingTag) {
    console.log(`⚠️  发现已存在的 #Task 标签 (ID: ${existingTag.id})`);
    console.log('   正在更新字段定义...\n');

    // 更新现有标签
    const updatedTag = await prisma.tagTemplate.update({
      where: { id: existingTag.id },
      data: {
        color: '#3B82F6', // 蓝色
        icon: '☑️',
        description: '任务管理标签，包含 AI 智能字段：紧急度评分和子任务拆解',
        fieldDefinitions: TASK_FIELD_DEFINITIONS,
        templateContent: TASK_TEMPLATE_CONTENT,
        isGlobalDefault: true,
        status: 'active',
      },
    });

    console.log('✅ #Task 标签已更新！');
    console.log(`   ID: ${updatedTag.id}`);
    console.log(`   字段数量: ${TASK_FIELD_DEFINITIONS.length}`);
    console.log(`   AI 字段: ai_urgency_score (紧急度), ai_subtasks (子任务)\n`);
    
    return updatedTag;
  }

  // 创建新标签
  const taskTag = await prisma.tagTemplate.create({
    data: {
      name: 'Task',
      color: '#3B82F6', // 蓝色
      icon: '☑️',
      description: '任务管理标签，包含 AI 智能字段：紧急度评分和子任务拆解',
      fieldDefinitions: TASK_FIELD_DEFINITIONS,
      templateContent: TASK_TEMPLATE_CONTENT,
      isGlobalDefault: true,
      status: 'active',
      order: 1,
    },
  });

  console.log('✅ #Task 标签创建成功！\n');
  console.log('📋 标签详情：');
  console.log(`   ID: ${taskTag.id}`);
  console.log(`   名称: ${taskTag.name}`);
  console.log(`   颜色: ${taskTag.color}`);
  console.log(`   图标: ${taskTag.icon}`);
  console.log(`   状态: ${taskTag.status}`);
  console.log(`   字段数量: ${TASK_FIELD_DEFINITIONS.length}`);
  console.log('\n📊 字段列表：');
  
  TASK_FIELD_DEFINITIONS.forEach((field, index) => {
    const isAI = field.type.startsWith('ai_');
    const prefix = isAI ? '🤖' : '📝';
    console.log(`   ${index + 1}. ${prefix} ${field.name} (${field.key}) - ${field.type}`);
    if (isAI && field.aiConfig) {
      console.log(`      └─ AI 配置: ${field.aiConfig.aiType}, 触发时机: ${field.aiConfig.triggerOn}`);
    }
  });

  console.log('\n🎉 种子脚本执行完成！');
  console.log('   您现在可以在应用中使用 #Task 标签来创建带有 AI 字段的任务节点。\n');

  return taskTag;
}

// 额外创建一些其他常用预置标签
async function seedOtherPresetTags() {
  console.log('\n📦 创建其他预置标签...\n');

  const presetTags = [
    {
      name: 'Meeting',
      color: '#8B5CF6', // 紫色
      icon: '📅',
      description: '会议记录标签',
      fieldDefinitions: [
        { id: 'meeting_date', key: 'date', name: '会议日期', type: 'date' },
        { id: 'meeting_time', key: 'time', name: '会议时间', type: 'text' },
        { id: 'meeting_participants', key: 'participants', name: '参会人员', type: 'text' },
        { id: 'meeting_agenda', key: 'agenda', name: '议程', type: 'text' },
      ],
      templateContent: {
        content: '',
        children: [
          { content: '议程：' },
          { content: '讨论要点：' },
          { content: '待办事项：' },
        ],
      },
      order: 2,
    },
    {
      name: 'Idea',
      color: '#F59E0B', // 橙色
      icon: '💡',
      description: '灵感记录标签',
      fieldDefinitions: [
        { id: 'idea_source', key: 'source', name: '来源', type: 'text' },
        { id: 'idea_status', key: 'status', name: '状态', type: 'select', options: ['待整理', '已归档', '已实现'] },
      ],
      order: 3,
    },
    {
      name: 'Book',
      color: '#10B981', // 绿色
      icon: '📚',
      description: '书籍阅读记录',
      fieldDefinitions: [
        { id: 'book_author', key: 'author', name: '作者', type: 'text' },
        { id: 'book_rating', key: 'rating', name: '评分', type: 'number' },
        { id: 'book_status', key: 'status', name: '阅读状态', type: 'select', options: ['想读', '在读', '已读'] },
        { id: 'book_start_date', key: 'start_date', name: '开始日期', type: 'date' },
      ],
      order: 4,
    },
  ];

  for (const tagData of presetTags) {
    const existing = await prisma.tagTemplate.findFirst({
      where: { name: tagData.name },
    });

    if (existing) {
      console.log(`   ⏭️  跳过已存在的 #${tagData.name} 标签`);
      continue;
    }

    const tag = await prisma.tagTemplate.create({
      data: {
        ...tagData,
        isGlobalDefault: true,
        status: 'active',
      },
    });

    console.log(`   ✅ 创建 #${tag.name} 标签 (ID: ${tag.id})`);
  }
}

async function main() {
  try {
    await seedTaskTag();
    await seedOtherPresetTags();
  } catch (error) {
    console.error('❌ 种子脚本执行失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
