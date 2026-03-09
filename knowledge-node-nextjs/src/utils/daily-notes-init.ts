import { prisma } from '@/lib/prisma';
import {
  format,
  getYear,
  getMonth,
  getDate,
  getDay,
  startOfDay,
} from 'date-fns';
import {
  getCalendarPath,
  getISOWeekNumber,
  getISOWeekYear,
  SYSTEM_TAGS,
} from '@/utils/date-helpers';
import { randomUUID } from 'crypto';

const WEEKDAY_NAMES = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

function getDayContent(date: Date): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = WEEKDAY_NAMES[getDay(date)];
  return `${month}月${day}日 ${weekday}`;
}

/**
 * 初始化用户的每日笔记系统
 * 层级：daily_root -> year -> week -> day（无 month）
 * 使用与前端一致的确定性 ID：year-YYYY, week-YYYY-WW, day-YYYY-MM-DD
 */
export async function initializeDailyNotes(userId: string) {
  const now = new Date();
  const today = startOfDay(now);
  // 只创建今天的日期节点
  const daysToCreate = [today];

  const userRootId = `user-root-${userId}`;
  const dailyRootId = `daily-root-${userId}`;

  const result = await prisma.$transaction(async (tx) => {
    let userRoot = await tx.node.findFirst({
      where: { userId, logicalId: userRootId },
      select: { id: true },
    });
    if (!userRoot) {
      userRoot = await tx.node.create({
        data: {
          id: randomUUID(),
          logicalId: userRootId,
          userId,
          content: '用户根节点',
          nodeType: 'root',
          nodeRole: 'user_root',
        },
        select: { id: true },
      });
    }

    let dailyRoot = await tx.node.findFirst({
      where: { userId, logicalId: dailyRootId },
      select: { id: true },
    });
    if (!dailyRoot) {
      const createdDailyRoot = await tx.node.create({
        data: {
          id: randomUUID(),
          logicalId: dailyRootId,
          userId,
          parentId: userRoot.id,
          content: '每日笔记(Daily Note)',
          nodeType: 'daily',
          nodeRole: 'daily_root',
        },
      });
      dailyRoot = { id: createdDailyRoot.id };
    }

    const pathToday = getCalendarPath(today);
    const isoWeek = getISOWeekNumber(today);
    const isoWeekYear = getISOWeekYear(today);
    const yearId = pathToday.yearId;
    const weekId = pathToday.weekId;

    let yearNode = await tx.node.findFirst({
      where: { userId, logicalId: yearId },
    });
    if (!yearNode) {
      yearNode = await tx.node.create({
        data: {
          id: randomUUID(),
          logicalId: yearId,
          userId,
          parentId: dailyRoot.id,
          content: pathToday.yearContent,
          nodeType: 'daily',
          sortOrder: 0,
          tags: [SYSTEM_TAGS.YEAR],
          payload: {
            level: 'year',
            year: isoWeekYear,
          } as unknown as object,
        },
      });
    }

    let weekNode = await tx.node.findFirst({
      where: { userId, logicalId: weekId },
    });
    if (!weekNode) {
      weekNode = await tx.node.create({
        data: {
          id: randomUUID(),
          logicalId: weekId,
          userId,
          parentId: yearNode.id,
          content: pathToday.weekContent,
          nodeType: 'daily',
          sortOrder: 0,
          tags: [SYSTEM_TAGS.WEEK],
          payload: {
            level: 'week',
            year: isoWeekYear,
            week: isoWeek,
            isoWeekYear,
          } as unknown as object,
        },
      });
    }

    const dayNodes: { id: string; content: string; sortOrder: number }[] = [];
    for (let i = 0; i < daysToCreate.length; i++) {
      const date = daysToCreate[i];
      const path = getCalendarPath(date);
      const existing = await tx.node.findFirst({
        where: { userId, logicalId: path.dayId },
      });
      if (existing) {
        dayNodes.push({
          id: existing.logicalId,
          content: existing.content,
          sortOrder: existing.sortOrder,
        });
        continue;
      }
      const dayNode = await tx.node.create({
        data: {
          id: randomUUID(),
          logicalId: path.dayId,
          userId,
          parentId: weekNode.id,
          content: getDayContent(date),
          nodeType: 'daily',
          sortOrder: i,
          tags: [SYSTEM_TAGS.DAY],
          payload: {
            level: 'day',
            year: getYear(date),
            month: getMonth(date) + 1,
            week: getISOWeekNumber(date),
            day: getDate(date),
            dayOfWeek: getDay(date),
            dateString: format(date, 'yyyy-MM-dd'),
          } as unknown as object,
        },
      });
      dayNodes.push({
        id: dayNode.logicalId,
        content: dayNode.content,
        sortOrder: dayNode.sortOrder,
      });
    }

    await tx.user.update({
      where: { id: userId },
      data: { isInitialized: true },
    });

    return {
      yearNode,
      weekNode,
      dayNodes,
      daysCreated: dayNodes.length,
    };
  });

  return {
    success: true,
    message: `已初始化每日笔记系统，创建了 ${result.daysCreated} 个日笔记`,
    data: {
      yearId: result.yearNode.logicalId,
      weekId: result.weekNode.logicalId,
      dayIds: result.dayNodes.map((n) => n.id),
    },
  };
}

/**
 * 检查用户是否需要初始化
 * 条件：结构不可达（无 daily_root，或今日 day 节点不可达）
 */
export async function checkNeedsInitialization(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return false;

  const dailyRootId = `daily-root-${userId}`;
  const dailyRoot = await prisma.node.findFirst({
    where: { userId, logicalId: dailyRootId },
    select: { id: true },
  });
  if (!dailyRoot) return true;

  const pathToday = getCalendarPath(startOfDay(new Date()));
  const todayDay = await prisma.node.findFirst({
    where: { userId, logicalId: pathToday.dayId },
    select: { id: true, parentId: true },
  });
  if (!todayDay) return true;

  let cur: string | null = todayDay.parentId;
  let reachable = false;
  while (cur) {
    if (cur === dailyRoot.id) {
      reachable = true;
      break;
    }
    const parent = await prisma.node.findFirst({
      where: { userId, id: cur },
      select: { parentId: true },
    });
    cur = parent?.parentId ?? null;
  }
  return !reachable;
}

/**
 * 获取或创建今天的日笔记节点
 * 用于日常使用时自动创建当天的笔记
 */
export async function getOrCreateTodayNote(userId: string) {
  const today = startOfDay(new Date());
  const pathToday = getCalendarPath(today);

  const existingNote = await prisma.node.findUnique({
    where: {
      userId_logicalId: {
        userId,
        logicalId: pathToday.dayId,
      },
    },
  });

  if (existingNote) {
    return { exists: true, node: existingNote };
  }

  return { exists: false, node: null };
}
