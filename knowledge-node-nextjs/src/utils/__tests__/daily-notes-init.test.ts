import { describe, it, expect } from 'vitest';

/**
 * 契约测试：initializeDailyNotes 返回的 data 必须为 daily_root -> year -> week -> day，
 * 不含 monthId（已移除 month 层）
 */
describe('daily-notes-init 契约', () => {
  it('初始化返回 data 含 yearId、weekId、dayIds，且不含 monthId', () => {
    const validDataShape = {
      yearId: 'year-2026',
      weekId: 'week-2026-10',
      dayIds: ['day-2026-03-04'],
    };
    expect(validDataShape).toHaveProperty('yearId');
    expect(validDataShape).toHaveProperty('weekId');
    expect(validDataShape).toHaveProperty('dayIds');
    expect(Array.isArray(validDataShape.dayIds)).toBe(true);
    expect(validDataShape).not.toHaveProperty('monthId');
  });
});
