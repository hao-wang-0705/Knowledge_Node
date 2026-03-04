import { describe, expect, it } from 'vitest';
import { getCalendarPath } from '@/utils/date-helpers';

describe('date-helpers ISO 语义', () => {
  it('跨年周场景下 yearId 使用 ISO 周年', () => {
    const path = getCalendarPath(new Date('2021-01-01T12:00:00.000Z'));
    expect(path.yearId).toBe('year-2020');
    expect(path.weekId).toBe('week-2020-53');
  });
});
import { describe, it, expect } from 'vitest';
import {
  getCalendarPath,
  getCalendarNodeType,
  getTodayId,
  getISOWeekNumber,
  getISOWeekYear,
} from '@/utils/date-helpers';

describe('date-helpers', () => {
  describe('getCalendarPath', () => {
    it('返回年周日至层级，无月层', () => {
      const date = new Date(2026, 2, 2); // 2026-03-02
      const path = getCalendarPath(date);
      expect(path).toHaveProperty('yearId', 'year-2026');
      expect(path).toHaveProperty('yearContent');
      expect(path).toHaveProperty('weekId');
      expect(path).toHaveProperty('weekContent');
      expect(path).toHaveProperty('dayId', 'day-2026-03-02');
      expect(path).toHaveProperty('dayContent');
      expect(path).not.toHaveProperty('monthId');
      expect(path).not.toHaveProperty('monthContent');
    });

    it('周节点挂在年下（weekId 含 ISO 周年与周数）', () => {
      const path = getCalendarPath(new Date(2026, 0, 5));
      expect(path.weekId).toMatch(/^week-\d{4}-\d{2}$/);
      expect(path.yearId).toBe('year-2026');
    });
  });

  describe('getCalendarNodeType', () => {
    it('识别 year/week/day，不返回 month', () => {
      expect(getCalendarNodeType('year-2026')).toBe('year');
      expect(getCalendarNodeType('week-2026-10')).toBe('week');
      expect(getCalendarNodeType('day-2026-03-02')).toBe('day');
      expect(getCalendarNodeType('month-2026-03')).toBeNull();
    });

    it('非日历 ID 返回 null', () => {
      expect(getCalendarNodeType('node-1')).toBeNull();
    });
  });

  describe('getTodayId', () => {
    it('返回当日 dayId 格式', () => {
      const id = getTodayId();
      expect(id).toMatch(/^day-\d{4}-\d{2}-\d{2}$/);
    });
  });
});
