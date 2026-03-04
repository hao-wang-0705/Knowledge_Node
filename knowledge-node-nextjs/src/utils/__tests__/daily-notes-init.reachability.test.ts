import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkNeedsInitialization } from '@/utils/daily-notes-init';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      findUnique: vi.fn(),
    },
    node: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}));

describe('checkNeedsInitialization 结构可达性判定', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('当今日 day 可回溯到 daily_root 时返回 false', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' });
    prismaMock.node.findFirst
      .mockResolvedValueOnce({ id: 'daily-root-phy' }) // daily_root
      .mockResolvedValueOnce({ id: 'day-phy', parentId: 'week-phy' }) // today day
      .mockResolvedValueOnce({ parentId: 'year-phy' }) // week -> year
      .mockResolvedValueOnce({ parentId: 'daily-root-phy' }); // year -> daily_root

    const needsInit = await checkNeedsInitialization('u1');
    expect(needsInit).toBe(false);
  });

  it('当今日 day 无法回溯到 daily_root 时返回 true', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' });
    prismaMock.node.findFirst
      .mockResolvedValueOnce({ id: 'daily-root-phy' }) // daily_root
      .mockResolvedValueOnce({ id: 'day-phy', parentId: 'week-phy' }) // today day
      .mockResolvedValueOnce({ parentId: null }); // week 断链

    const needsInit = await checkNeedsInitialization('u1');
    expect(needsInit).toBe(true);
  });
});
