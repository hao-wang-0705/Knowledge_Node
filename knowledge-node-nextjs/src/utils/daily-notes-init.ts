import { prisma } from '@/lib/prisma';
import {
  startOfWeek,
  endOfWeek,
  format,
  getWeek,
  getYear,
  getMonth,
  getDate,
  getDay,
  eachDayOfInterval,
  isBefore,
  startOfDay,
} from 'date-fns';
import { zhCN } from 'date-fns/locale';

/**
 * 星期几的中文名称
 */
const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/**
 * 生成年节点内容
 */
function getYearContent(year: number): string {
  return `${year}`;
}

/**
 * 生成月节点内容
 */
function getMonthContent(month: number): string {
  return `${month}月`;
}

/**
 * 生成周节点内容
 */
function getWeekContent(weekNumber: number, weekStart: Date, weekEnd: Date): string {
  const startStr = format(weekStart, 'MM.dd');
  const endStr = format(weekEnd, 'MM.dd');
  return `第${weekNumber}周 (${startStr}-${endStr})`;
}

/**
 * 生成日节点内容
 */
function getDayContent(date: Date): string {
  const month = format(date, 'MM');
  const day = format(date, 'dd');
  const weekday = WEEKDAY_NAMES[getDay(date)];
  return `${month}月${day}日 ${weekday}`;
}

/**
 * 初始化用户的每日笔记系统
 * 在用户首次登录时调用，创建年/月/周/日层级结构
 * 只生成当前周内已过去的日期（包括今天）
 */
export async function initializeDailyNotes(userId: string) {
  const now = new Date();
  const currentYear = getYear(now);
  const currentMonth = getMonth(now) + 1; // date-fns 月份从 0 开始
  const currentWeek = getWeek(now, { weekStartsOn: 1, locale: zhCN }); // 周一为一周开始
  
  // 获取当前周的起止日期
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // 周一开始
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  
  // 获取从周一到今天的日期列表
  const today = startOfDay(now);
  const daysToCreate = eachDayOfInterval({
    start: weekStart,
    end: today,
  }).filter(date => isBefore(date, today) || date.getTime() === today.getTime());

  // 使用事务确保原子性
  const result = await prisma.$transaction(async (tx) => {
    // 1. 创建年节点（ADR-005：每日树隔离）
    const yearNode = await tx.node.create({
      data: {
        userId,
        parentId: null,
        content: getYearContent(currentYear),
        nodeType: 'daily',
        scope: 'daily',
        sortOrder: 0,
        payload: {
          level: 'year',
          year: currentYear,
        } as unknown as object,
      },
    });

    // 2. 创建月节点
    const monthNode = await tx.node.create({
      data: {
        userId,
        parentId: yearNode.id,
        content: getMonthContent(currentMonth),
        nodeType: 'daily',
        scope: 'daily',
        sortOrder: 0,
        payload: {
          level: 'month',
          year: currentYear,
          month: currentMonth,
        } as unknown as object,
      },
    });

    // 3. 创建周节点
    const weekNode = await tx.node.create({
      data: {
        userId,
        parentId: monthNode.id,
        content: getWeekContent(currentWeek, weekStart, weekEnd),
        nodeType: 'daily',
        scope: 'daily',
        sortOrder: 0,
        payload: {
          level: 'week',
          year: currentYear,
          month: currentMonth,
          week: currentWeek,
        } as unknown as object,
      },
    });

    // 4. 创建日节点
    const dayNodes = [];
    for (let i = 0; i < daysToCreate.length; i++) {
      const date = daysToCreate[i];
      const dayNode = await tx.node.create({
        data: {
          userId,
          parentId: weekNode.id,
          content: getDayContent(date),
          nodeType: 'daily',
          scope: 'daily',
          sortOrder: i,
          payload: {
            level: 'day',
            year: getYear(date),
            month: getMonth(date) + 1,
            week: getWeek(date, { weekStartsOn: 1, locale: zhCN }),
            day: getDate(date),
            dayOfWeek: getDay(date),
            dateString: format(date, 'yyyy-MM-dd'),
          } as unknown as object,
        },
      });
      dayNodes.push(dayNode);
    }

    // 5. 标记用户已初始化
    await tx.user.update({
      where: { id: userId },
      data: { isInitialized: true },
    });

    return {
      yearNode,
      monthNode,
      weekNode,
      dayNodes,
      daysCreated: dayNodes.length,
    };
  });

  return {
    success: true,
    message: `已初始化每日笔记系统，创建了 ${result.daysCreated} 个日笔记`,
    data: {
      yearId: result.yearNode.id,
      monthId: result.monthNode.id,
      weekId: result.weekNode.id,
      dayIds: result.dayNodes.map(n => n.id),
    },
  };
}

/**
 * 检查用户是否需要初始化
 */
export async function checkNeedsInitialization(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isInitialized: true },
  });

  if (!user) {
    return false;
  }

  // 如果已标记初始化，直接返回
  if (user.isInitialized) {
    return false;
  }

  // 否则检查是否有任何节点
  const nodeCount = await prisma.node.count({
    where: { userId },
  });

  return nodeCount === 0;
}

/**
 * 获取或创建今天的日笔记节点
 * 用于日常使用时自动创建当天的笔记
 */
export async function getOrCreateTodayNote(userId: string) {
  const today = startOfDay(new Date());
  const dateString = format(today, 'yyyy-MM-dd');

  // 查找今天的日笔记
  const existingNote = await prisma.node.findFirst({
    where: {
      userId,
      nodeType: 'daily',
      payload: {
        path: ['dateString'],
        equals: dateString,
      },
    },
  });

  if (existingNote) {
    return { exists: true, node: existingNote };
  }

  // 需要创建今天的笔记，先确保父级结构存在
  // 这里简化处理，假设用户已经初始化过
  // 完整实现需要递归创建年/月/周节点
  
  return { exists: false, node: null };
}
