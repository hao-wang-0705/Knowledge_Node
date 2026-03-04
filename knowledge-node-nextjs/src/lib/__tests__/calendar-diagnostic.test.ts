import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runCalendarDiagnostic } from '@/lib/calendar-diagnostic';

describe('runCalendarDiagnostic', () => {
  const userId = 'user-1';
  const dailyRootId = `daily-root-${userId}`;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('年节点 parentId 错误时产出 issue，expectedParentId 为 daily_root', async () => {
    const mockFindMany = vi.fn().mockResolvedValue([
      { id: 'phy-year', logicalId: 'year-2026', parentId: null },
      { id: 'phy-week', logicalId: 'week-2026-10', parentId: 'phy-year' },
      { id: 'phy-day', logicalId: 'day-2026-03-04', parentId: 'phy-week' },
    ]);
    const mockFindFirst = vi.fn().mockImplementation((args: { where: { logicalId?: string } }) => {
      if (args.where.logicalId === dailyRootId) return Promise.resolve({ id: 'phy-daily-root' });
      return Promise.resolve(null);
    });

    const prisma = {
      node: {
        findMany: mockFindMany,
        findFirst: mockFindFirst,
      },
    } as any;

    const result = await runCalendarDiagnostic(prisma, userId);

    expect(result.issues.length).toBeGreaterThan(0);
    const yearIssue = result.issues.find((i) => i.nodeType === 'year');
    expect(yearIssue).toBeDefined();
    expect(yearIssue!.nodeId).toBe('year-2026');
    expect(yearIssue!.currentParentId).toBeNull();
    expect(yearIssue!.expectedParentId).toBe(dailyRootId);
    expect(yearIssue!.expectedParentType).toBe('daily_root');
  });

  it('全部层级正确时 issues 为空', async () => {
    const mockFindMany = vi.fn().mockImplementation((args?: { where?: { id?: { in?: string[] } } }) => {
      if (args?.where?.id?.in?.includes('phy-daily-root')) {
        return Promise.resolve([{ id: 'phy-daily-root', logicalId: dailyRootId }]);
      }
      return Promise.resolve([
        { id: 'phy-year', logicalId: 'year-2026', parentId: 'phy-daily-root' },
        { id: 'phy-week', logicalId: 'week-2026-10', parentId: 'phy-year' },
        { id: 'phy-day', logicalId: 'day-2026-03-04', parentId: 'phy-week' },
      ]);
    });
    const mockFindFirst = vi.fn().mockImplementation((args: { where: { logicalId?: string } }) => {
      if (args.where.logicalId === dailyRootId) return Promise.resolve({ id: 'phy-daily-root' });
      return Promise.resolve(null);
    });

    const prisma = {
      node: {
        findMany: mockFindMany,
        findFirst: mockFindFirst,
      },
    } as any;

    const result = await runCalendarDiagnostic(prisma, userId);

    expect(result.issues).toHaveLength(0);
    expect(result.dailyRootId).toBe(dailyRootId);
  });
});
