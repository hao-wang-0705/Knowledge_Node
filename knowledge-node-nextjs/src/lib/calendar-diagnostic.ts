/**
 * 日历节点诊断逻辑（与 API 共用）
 * 扫描年/周/日节点，检测 parentId 是否符合 daily_root -> year -> week -> day
 */

import type { PrismaClient } from '@prisma/client';

export interface DiagnosticIssue {
  issueCode: 'MISSING_ANCHOR' | 'WRONG_PARENT' | 'ORDER_CONFLICT' | 'CROSS_USER_PARENT';
  nodeId: string;
  nodeType: 'year' | 'week' | 'day';
  currentParentId: string | null;
  expectedParentId: string | null;
  expectedParentType: string;
}

function getISOWeek(year: number, month: number, day: number): { isoWeekYear: number; weekNumber: number } {
  const date = new Date(year, month - 1, day);
  const dayOfWeek = date.getDay() || 7;
  date.setDate(date.getDate() + 4 - dayOfWeek);
  const yearStart = new Date(date.getFullYear(), 0, 1);
  const weekNumber = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { isoWeekYear: date.getFullYear(), weekNumber };
}

function parseCalendarNodeId(nodeId: string): {
  type: 'year' | 'week' | 'day' | null;
  year?: number;
  weekYear?: number;
  weekNumber?: number;
  month?: number;
  day?: number;
} {
  const idWithoutPrefix = nodeId.includes('_') ? nodeId.split('_').pop()! : nodeId;
  const yearMatch = idWithoutPrefix.match(/^year-(\d{4})$/);
  if (yearMatch) return { type: 'year', year: parseInt(yearMatch[1], 10) };
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

export async function runCalendarDiagnostic(
  prisma: PrismaClient,
  userId: string
): Promise<{
  issues: DiagnosticIssue[];
  dailyRootId: string | null;
  yearNodes: { id: string; parentId: string | null }[];
  weekNodes: { id: string; parentId: string | null }[];
  dayNodes: { id: string; parentId: string | null }[];
  allNodes: { id: string; parentId: string | null }[];
}> {
  const dailyRootId = `daily-root-${userId}`;
  const rawNodes = await prisma.node.findMany({
    where: {
      userId,
      OR: [
        { logicalId: { contains: 'year-' } },
        { logicalId: { contains: 'week-' } },
        { logicalId: { contains: 'day-' } },
      ],
    },
    select: { id: true, logicalId: true, parentId: true },
  });

  const dailyRoot = await prisma.node.findFirst({
    where: { userId, logicalId: dailyRootId },
    select: { id: true },
  });

  const parentMap = new Map<string, string>();
  rawNodes.forEach((n) => parentMap.set(n.id, n.logicalId));
  const missingParentIds = [
    ...new Set(rawNodes.map((n) => n.parentId).filter((pid): pid is string => !!pid && !parentMap.has(pid))),
  ];
  if (missingParentIds.length > 0) {
    const parentNodes = await prisma.node.findMany({
      where: { userId, id: { in: missingParentIds } },
      select: { id: true, logicalId: true },
    });
    parentNodes.forEach((p) => parentMap.set(p.id, p.logicalId));
  }

  const allNodes: { id: string; parentId: string | null }[] = rawNodes.map((n) => ({
    id: n.logicalId,
    parentId: n.parentId ? parentMap.get(n.parentId) ?? null : null,
  }));

  const yearNodes: { id: string; parentId: string | null }[] = [];
  const weekNodes: { id: string; parentId: string | null }[] = [];
  const dayNodes: { id: string; parentId: string | null }[] = [];
  for (const node of allNodes) {
    const parsed = parseCalendarNodeId(node.id);
    if (parsed.type === 'year') yearNodes.push(node);
    else if (parsed.type === 'week') weekNodes.push(node);
    else if (parsed.type === 'day') dayNodes.push(node);
  }

  const issues: DiagnosticIssue[] = [];

  for (const node of yearNodes) {
    if (node.parentId !== dailyRootId) {
      issues.push({
        issueCode: dailyRoot ? 'WRONG_PARENT' : 'MISSING_ANCHOR',
        nodeId: node.id,
        nodeType: 'year',
        currentParentId: node.parentId,
        expectedParentId: dailyRoot ? dailyRootId : null,
        expectedParentType: 'daily_root',
      });
    }
  }

  for (const node of weekNodes) {
    const parsed = parseCalendarNodeId(node.id);
    if (parsed.type !== 'week' || !parsed.weekYear) continue;
    const expectedYearId = `year-${parsed.weekYear}`;
    const actualYearNode = yearNodes.find(
      (y) => y.id === expectedYearId || y.id.endsWith(`_${expectedYearId}`)
    );
    const expectedParentId = actualYearNode?.id || expectedYearId;
    if (node.parentId !== expectedParentId) {
      issues.push({
        issueCode: 'WRONG_PARENT',
        nodeId: node.id,
        nodeType: 'week',
        currentParentId: node.parentId,
        expectedParentId,
        expectedParentType: `year (${expectedYearId})`,
      });
    }
  }

  for (const node of dayNodes) {
    const parsed = parseCalendarNodeId(node.id);
    if (parsed.type !== 'day' || !parsed.year || !parsed.month || !parsed.day) continue;
    const { isoWeekYear, weekNumber } = getISOWeek(parsed.year, parsed.month, parsed.day);
    const weekStr = String(weekNumber).padStart(2, '0');
    const expectedWeekId = `week-${isoWeekYear}-${weekStr}`;
    const actualWeekNode = weekNodes.find(
      (w) => w.id === expectedWeekId || w.id.endsWith(`_${expectedWeekId}`)
    );
    const expectedParentId = actualWeekNode?.id || expectedWeekId;
    if (node.parentId !== expectedParentId) {
      issues.push({
        issueCode: 'WRONG_PARENT',
        nodeId: node.id,
        nodeType: 'day',
        currentParentId: node.parentId,
        expectedParentId,
        expectedParentType: `week (${expectedWeekId})`,
      });
    }
  }

  return {
    issues,
    dailyRootId: dailyRoot ? dailyRootId : null,
    yearNodes,
    weekNodes,
    dayNodes,
    allNodes,
  };
}
