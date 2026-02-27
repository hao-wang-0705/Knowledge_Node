/**
 * 用户存储隔离工具
 * 
 * 实现用户数据隔离，基于用户 ID 隔离存储
 */

// 用户 ID 的存储 key
const USER_ID_KEY = 'knowledge-node-user-id';

/**
 * 获取或创建用户唯一 ID
 * 首次访问时生成，后续复用
 */
export const getUserId = (): string => {
  if (typeof window === 'undefined') {
    return 'server-side';
  }
  
  let userId = localStorage.getItem(USER_ID_KEY);
  
  if (!userId) {
    // 生成唯一 ID: 时间戳 + 随机字符串
    userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(USER_ID_KEY, userId);
    console.log('📝 新用户 ID 已生成:', userId);
  }
  
  return userId;
};

/**
 * 获取用户专属的存储 key
 * @param baseKey 基础 key
 * @returns 带用户前缀的 key
 */
export const getUserStorageKey = (baseKey: string): string => {
  const userId = getUserId();
  return `${userId}:${baseKey}`;
};

/**
 * 获取用户信息（调试用）
 */
export const getUserInfo = (): { userId: string; createdAt?: string } => {
  const userId = getUserId();
  // 从 userId 中解析创建时间
  const match = userId.match(/user_(\d+)_/);
  const createdAt = match ? new Date(parseInt(match[1])).toLocaleString('zh-CN') : undefined;
  
  return { userId, createdAt };
};

/**
 * 重置用户 ID（仅用于测试）
 * 警告：这会导致用户丢失所有本地数据！
 */
export const resetUserId = (): void => {
  if (typeof window === 'undefined') return;
  
  const oldUserId = localStorage.getItem(USER_ID_KEY);
  if (oldUserId) {
    // 清除旧用户的所有数据
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(oldUserId)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`🗑️ 已清除旧用户 ${oldUserId} 的 ${keysToRemove.length} 条数据`);
  }
  
  localStorage.removeItem(USER_ID_KEY);
  console.log('🔄 用户 ID 已重置，下次访问将生成新 ID');
};

/**
 * 迁移旧数据到新的用户隔离存储
 * 用于升级时将旧版数据迁移到新格式
 */
export const migrateOldData = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const OLD_KEYS = [
    'knowledge-node-nodes',
    'knowledge-node-root-ids',
    'knowledge-node-supertags',
    'knowledge-node-notebooks',
    'knowledge-node-pinned-tags',
    'knowledge-node-data-version',
  ];
  
  // 检查是否存在旧数据
  const hasOldData = OLD_KEYS.some(key => localStorage.getItem(key) !== null);
  
  if (!hasOldData) {
    return false;
  }
  
  console.log('🔄 检测到旧版数据，开始迁移...');
  
  const userId = getUserId();
  
  // 迁移每个 key
  OLD_KEYS.forEach(oldKey => {
    const data = localStorage.getItem(oldKey);
    if (data) {
      const newKey = `${userId}:${oldKey}`;
      localStorage.setItem(newKey, data);
      // 删除旧 key（可选，保留作为备份）
      // localStorage.removeItem(oldKey);
      console.log(`  ✓ ${oldKey} -> ${newKey}`);
    }
  });
  
  console.log('✅ 数据迁移完成');
  return true;
};
