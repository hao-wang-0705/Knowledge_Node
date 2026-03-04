/**
 * 日历节点工具函数
 * 用于生成确定性 ID 和格式化标题
 */

// 系统标签 ID（用于日历节点）
export const SYSTEM_TAGS = {
  YEAR: 'sys_tag_year',
  MONTH: 'sys_tag_month',
  WEEK: 'sys_tag_week',
  DAY: 'sys_tag_day',
} as const;

// 星期几的中文名称
const WEEKDAY_NAMES = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

/**
 * 获取 ISO 周数
 * @param date 日期
 * @returns ISO 周数 (1-53)
 */
export function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // 将日期设置为最近的周四（ISO 周以周四所在的年份为准）
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  // 获取年初的第一天
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  // 计算周数
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
}

/**
 * 获取 ISO 周所属的年份（ISO 周年可能与日历年不同）
 * @param date 日期
 * @returns ISO 周年
 */
export function getISOWeekYear(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  return d.getUTCFullYear();
}

/**
 * 日历路径信息（年->周->日，无月层）
 */
export interface CalendarPath {
  yearId: string;
  yearContent: string;
  weekId: string;
  weekContent: string;
  dayId: string;
  dayContent: string;
}

/**
 * 根据日期生成日历路径（确定性 ID），层级为 年->周->日
 * @param date 日期对象
 * @returns 日历路径信息
 */
export function getCalendarPath(date: Date): CalendarPath {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 0-indexed，仅用于 dayId 格式兼容
  const day = date.getDate();
  const weekday = date.getDay();
  const isoWeek = getISOWeekNumber(date);
  const isoWeekYear = getISOWeekYear(date);

  const monthStr = month.toString().padStart(2, '0');
  const dayStr = day.toString().padStart(2, '0');
  const weekStr = isoWeek.toString().padStart(2, '0');

  return {
    yearId: `year-${isoWeekYear}`,
    yearContent: `📅 ${isoWeekYear}年`,
    weekId: `week-${isoWeekYear}-${weekStr}`,
    weekContent: `${isoWeekYear}年第${weekStr}周`,
    dayId: `day-${year}-${monthStr}-${dayStr}`,
    dayContent: `${month}月${day}日 ${WEEKDAY_NAMES[weekday]}`,
  };
}

/**
 * 从日期 ID 解析日期
 * @param dayId 日期 ID (格式: day-YYYY-MM-DD)
 * @returns Date 对象或 null
 */
export function parseDayId(dayId: string): Date | null {
  const match = dayId.match(/^day-(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  
  const [, year, month, day] = match;
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}

/**
 * 检查节点 ID 是否为日历节点（年/周/日；旧 month- 仅作兼容识别，返回 null 不参与新导航）
 * @param nodeId 节点 ID
 * @returns 日历节点类型或 null
 */
export function getCalendarNodeType(nodeId: string): 'year' | 'week' | 'day' | null {
  if (nodeId.startsWith('year-')) return 'year';
  if (nodeId.startsWith('week-')) return 'week';
  if (nodeId.startsWith('day-')) return 'day';
  return null;
}

/**
 * 获取今天的日期 ID
 * @returns 今天的 day ID
 */
export function getTodayId(): string {
  return getCalendarPath(new Date()).dayId;
}

/**
 * 格式化日期为简短显示
 * @param date 日期
 * @returns 格式化字符串
 */
export function formatShortDate(date: Date): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}月${day}日`;
}

/**
 * 判断两个日期是否为同一天
 * @param date1 日期1
 * @param date2 日期2
 * @returns 是否同一天
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * 获取一周的所有日期（周一到周日）
 * 注意：此函数返回完整的一周，包括未来日期
 * 如果需要只获取今天及之前的日期，请使用 getWeekDaysUntilToday
 * @param date 周内的任意一天
 * @returns 该周的 7 个日期数组（周一到周日）
 */
export function getWeekDays(date: Date): Date[] {
  const d = new Date(date);
  const day = d.getDay();
  // 计算到周一的偏移（周日为 0，需要特殊处理）
  const diff = day === 0 ? -6 : 1 - day;
  
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  
  const weekDays: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const weekDay = new Date(monday);
    weekDay.setDate(monday.getDate() + i);
    weekDays.push(weekDay);
  }
  
  return weekDays;
}

/**
 * 获取指定日期所在周从周一到今天的所有日期（不包括未来日期）
 * 用于日历节点初始化，确保不会提前创建未来日期的节点
 * @param date 周内的任意一天（通常是今天）
 * @returns 从周一到今天的日期数组
 */
export function getWeekDaysUntilToday(date: Date): Date[] {
  const d = new Date(date);
  const day = d.getDay();
  // 计算到周一的偏移（周日为 0，需要特殊处理）
  const diff = day === 0 ? -6 : 1 - day;
  
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  
  // 获取今天的日期（不含时间）
  const today = new Date(date);
  today.setHours(0, 0, 0, 0);
  
  const weekDays: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const weekDay = new Date(monday);
    weekDay.setDate(monday.getDate() + i);
    weekDay.setHours(0, 0, 0, 0);
    
    // 只添加今天及之前的日期
    if (weekDay <= today) {
      weekDays.push(weekDay);
    }
  }
  
  return weekDays;
}
