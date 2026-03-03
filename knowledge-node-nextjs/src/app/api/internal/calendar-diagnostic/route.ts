/**
 * 日历节点诊断 API
 * 扫描所有日历节点（年/周/日），检测 parentId 异常
 * - 年节点的 parentId 应指向 daily_root
 * - 周节点的 parentId 应指向对应的年节点
 * - 日节点的 parentId 应指向对应的周节点
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

interface DiagnosticIssue {
  nodeId: string;
  nodeType: 'year' | 'week' | 'day';
  currentParentId: string | null;
  expectedParentId: string | null;
  expectedParentType: string;
}

interface DiagnosticReport {
  userId: string;
  scannedAt: string;
  summary: {
    totalCalendarNodes: number;
    yearNodes: number;
    weekNodes: number;
    dayNodes: number;
    issuesFound: number;
  };
  issues: DiagnosticIssue[];
  dailyRootId: string | null;
}

/**
 * 根据日期字符串计算 ISO 周号
 */
function getISOWeek(year: number, month: number, day: number): { isoWeekYear: number; weekNumber: number } {
  const date = new Date(year, month - 1, day);
  const dayOfWeek = date.getDay() || 7;
  date.setDate(date.getDate() + 4 - dayOfWeek);
  const yearStart = new Date(date.getFullYear(), 0, 1);
  const weekNumber = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { isoWeekYear: date.getFullYear(), weekNumber };
}

/**
 * 解析日历节点 ID，提取年份、周号、日期信息
 */
function parseCalendarNodeId(nodeId: string): {
  type: 'year' | 'week' | 'day' | null;
  year?: number;
  weekYear?: number;
  weekNumber?: number;
  month?: number;
  day?: number;
} {
  // 移除可能的用户前缀（如 user123_year-2026）
  const idWithoutPrefix = nodeId.includes('_') ? nodeId.split('_').pop()! : nodeId;

  const yearMatch = idWithoutPrefix.match(/^year-(\d{4})$/);
  if (yearMatch) {
    return { type: 'year', year: parseInt(yearMatch[1], 10) };
  }

  const weekMatch = idWithoutPrefix.match(/^week-(\d{4})-(\d{2})$/);
  if (weekMatch) {
    return {
      type: 'week',
      weekYear: parseInt(weekMatch[1], 10),
      weekNumber: parseInt(weekMatch[2], 10),
    };
  }

  const dayMatch = idWithoutPrefix.match(/^day-(\d{4})-(\d{2})-(\d{2})$/);
  if (dayMatch) {
    return {
      type: 'day',
      year: parseInt(dayMatch[1], 10),
      month: parseInt(dayMatch[2], 10),
      day: parseInt(dayMatch[3], 10),
    };
  }

  return { type: null };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const dailyRootId = `daily-root-${userId}`;

    // 获取该用户的所有日历节点
    const allNodes = await prisma.node.findMany({
      where: {
        userId,
        OR: [
          { id: { contains: 'year-' } },
          { id: { contains: 'week-' } },
          { id: { contains: 'day-' } },
        ],
      },
      select: {
        id: true,
        parentId: true,
      },
    });

    // 检查 daily-root 是否存在
    const dailyRoot = await prisma.node.findUnique({
      where: { id: dailyRootId },
      select: { id: true },
    });

    const yearNodes: typeof allNodes = [];
    const weekNodes: typeof allNodes = [];
    const dayNodes: typeof allNodes = [];

    // 分类节点
    for (const node of allNodes) {
      const parsed = parseCalendarNodeId(node.id);
      if (parsed.type === 'year') yearNodes.push(node);
      else if (parsed.type === 'week') weekNodes.push(node);
      else if (parsed.type === 'day') dayNodes.push(node);
    }

    const issues: DiagnosticIssue[] = [];

    // 检查年节点：parentId 应指向 daily_root
    for (const node of yearNodes) {
      if (node.parentId !== dailyRootId) {
        issues.push({
          nodeId: node.id,
          nodeType: 'year',
          currentParentId: node.parentId,
          expectedParentId: dailyRoot ? dailyRootId : null,
          expectedParentType: 'daily_root',
        });
      }
    }

    // 检查周节点：parentId 应指向对应的年节点
    for (const node of weekNodes) {
      const parsed = parseCalendarNodeId(node.id);
      if (parsed.type !== 'week' || !parsed.weekYear) continue;

      const expectedYearId = `year-${parsed.weekYear}`;
      // 查找实际存在的年节点（可能有前缀）
      const actualYearNode = yearNodes.find(
        (y) => y.id === expectedYearId || y.id.endsWith(`_${expectedYearId}`)
      );
      const expectedParentId = actualYearNode?.id || expectedYearId;

      if (node.parentId !== expectedParentId) {
        issues.push({
          nodeId: node.id,
          nodeType: 'week',
          currentParentId: node.parentId,
          expectedParentId,
          expectedParentType: `year (${expectedYearId})`,
        });
      }
    }

    // 检查日节点：parentId 应指向对应的周节点
    for (const node of dayNodes) {
      const parsed = parseCalendarNodeId(node.id);
      if (parsed.type !== 'day' || !parsed.year || !parsed.month || !parsed.day) continue;

      const { isoWeekYear, weekNumber } = getISOWeek(parsed.year, parsed.month, parsed.day);
      const weekStr = String(weekNumber).padStart(2, '0');
      const expectedWeekId = `week-${isoWeekYear}-${weekStr}`;

      // 查找实际存在的周节点（可能有前缀）
      const actualWeekNode = weekNodes.find(
        (w) => w.id === expectedWeekId || w.id.endsWith(`_${expectedWeekId}`)
      );
      const expectedParentId = actualWeekNode?.id || expectedWeekId;

      if (node.parentId !== expectedParentId) {
        issues.push({
          nodeId: node.id,
          nodeType: 'day',
          currentParentId: node.parentId,
          expectedParentId,
          expectedParentType: `week (${expectedWeekId})`,
        });
      }
    }

    const report: DiagnosticReport = {
      userId,
      scannedAt: new Date().toISOString(),
      summary: {
        totalCalendarNodes: allNodes.length,
        yearNodes: yearNodes.length,
        weekNodes: weekNodes.length,
        dayNodes: dayNodes.length,
        issuesFound: issues.length,
      },
      issues,
      dailyRootId: dailyRoot ? dailyRootId : null,
    };

    return NextResponse.json(report);
  } catch (error) {
    console.error('[calendar-diagnostic] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
