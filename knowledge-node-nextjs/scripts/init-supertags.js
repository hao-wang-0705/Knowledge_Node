const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function initSupertags() {
  // 获取测试用户
  const user = await prisma.user.findFirst({
    where: { email: 'test@example.com' }
  });
  
  if (!user) {
    console.log('未找到测试用户 test@example.com');
    return;
  }
  
  console.log('找到用户:', user.email, user.id);
  
  // 清除现有标签
  await prisma.supertag.deleteMany({
    where: { userId: user.id }
  });
  console.log('已清除现有标签');
  
  // 创建基础标签：会议（父标签）
  const meetingTag = await prisma.supertag.create({
    data: {
      userId: user.id,
      name: '会议',
      color: '#8B5CF6',
      icon: '📅',
      description: '通用会议管理',
      categoryId: 'cat_function',
      order: 1,
      fieldDefinitions: [
        { id: 'f_m_date', key: 'date', name: '会议日期', type: 'date' },
        { id: 'f_m_time', key: 'time', name: '会议时间', type: 'text' },
        { id: 'f_m_location', key: 'location', name: '会议地点', type: 'text' },
        { id: 'f_m_participants', key: 'participants', name: '参会人员', type: 'text' },
        { id: 'f_m_agenda', key: 'agenda', name: '议程', type: 'text' },
        { id: 'f_m_notes', key: 'notes', name: '会议记录', type: 'text' }
      ]
    }
  });
  console.log('创建基础标签: 会议', meetingTag.id);
  
  // 创建子标签：工作会议（继承自会议）
  const workMeetingTag = await prisma.supertag.create({
    data: {
      userId: user.id,
      name: '工作会议',
      color: '#1D4ED8',
      icon: '🏢',
      description: '工作相关会议，继承自「会议」',
      categoryId: 'cat_function',
      order: 2,
      parentId: meetingTag.id,
      fieldDefinitions: [
        { id: 'f_wm_project', key: 'project', name: '关联项目', type: 'text' },
        { id: 'f_wm_decision', key: 'decision', name: '决策事项', type: 'text' }
      ]
    }
  });
  console.log('创建子标签: 工作会议 (继承自会议)', workMeetingTag.id);
  
  // 创建待办标签
  const taskTag = await prisma.supertag.create({
    data: {
      userId: user.id,
      name: '待办',
      color: '#10B981',
      icon: '☑️',
      description: '任务和待办事项',
      categoryId: 'cat_function',
      order: 3,
      fieldDefinitions: [
        { id: 'f_t_status', key: 'status', name: '状态', type: 'select', options: ['待处理', '进行中', '已完成', '已取消'] },
        { id: 'f_t_priority', key: 'priority', name: '优先级', type: 'select', options: ['高', '中', '低'] },
        { id: 'f_t_due', key: 'dueDate', name: '截止日期', type: 'date' },
        { id: 'f_t_assignee', key: 'assignee', name: '负责人', type: 'text' }
      ]
    }
  });
  console.log('创建基础标签: 待办', taskTag.id);
  
  // 创建灵感标签
  const ideaTag = await prisma.supertag.create({
    data: {
      userId: user.id,
      name: '灵感',
      color: '#F59E0B',
      icon: '💡',
      description: '记录灵感和创意',
      categoryId: 'cat_function',
      order: 4,
      fieldDefinitions: [
        { id: 'f_i_source', key: 'source', name: '来源', type: 'text' },
        { id: 'f_i_status', key: 'status', name: '状态', type: 'select', options: ['待整理', '已归档', '已实现'] }
      ]
    }
  });
  console.log('创建基础标签: 灵感', ideaTag.id);
  
  // 创建文档标签
  const docTag = await prisma.supertag.create({
    data: {
      userId: user.id,
      name: '文档',
      color: '#64748B',
      icon: '📄',
      description: '文档管理',
      categoryId: 'cat_function',
      order: 5,
      fieldDefinitions: [
        { id: 'f_d_type', key: 'type', name: '文档类型', type: 'select', options: ['PRD', '技术方案', '调研报告', '会议纪要'] },
        { id: 'f_d_author', key: 'author', name: '作者', type: 'text' },
        { id: 'f_d_version', key: 'version', name: '版本', type: 'text' }
      ]
    }
  });
  console.log('创建基础标签: 文档', docTag.id);
  
  // 创建问题标签
  const problemTag = await prisma.supertag.create({
    data: {
      userId: user.id,
      name: '问题',
      color: '#EF4444',
      icon: '🔥',
      description: '问题跟踪',
      categoryId: 'cat_function',
      order: 6,
      fieldDefinitions: [
        { id: 'f_p_severity', key: 'severity', name: '严重程度', type: 'select', options: ['致命', '严重', '一般', '轻微'] },
        { id: 'f_p_status', key: 'status', name: '状态', type: 'select', options: ['待处理', '处理中', '已解决', '已关闭'] },
        { id: 'f_p_owner', key: 'owner', name: '责任人', type: 'text' }
      ]
    }
  });
  console.log('创建基础标签: 问题', problemTag.id);
  
  console.log('\n✅ 初始化完成！共创建 6 个标签');
  console.log('   其中「工作会议」继承自「会议」，会自动拥有会议的 6 个字段 + 自己的 2 个字段 = 共 8 个字段');
}

initSupertags()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
