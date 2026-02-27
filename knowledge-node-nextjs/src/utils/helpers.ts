// ID 生成器
export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// LocalStorage 基础键名（不带用户前缀）
export const STORAGE_KEYS = {
  NODES: 'knowledge-node-nodes',
  ROOT_IDS: 'knowledge-node-root-ids',
  SUPERTAGS: 'knowledge-node-supertags',
  NOTEBOOKS: 'knowledge-node-notebooks',
  PINNED_TAGS: 'knowledge-node-pinned-tags',
  DATA_VERSION: 'knowledge-node-data-version',
} as const;

// 数据版本号 - 修改此值会触发数据重置
export const CURRENT_DATA_VERSION = '14.0.0';

// 获取基于时段的问候语
export const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 6) return '夜深了';
  if (hour < 9) return '早上好';
  if (hour < 12) return '上午好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  if (hour < 22) return '晚上好';
  return '夜深了';
};

// 格式化日期
export const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// 获取今天的日期字符串
export const getTodayDateString = (): string => {
  const today = new Date();
  return today.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
};

// 防抖函数
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
    }, wait);
  };
};