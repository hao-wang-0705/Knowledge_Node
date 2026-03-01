import { STORAGE_KEYS } from '@/utils/helpers';
import { clearGlobalQueryCache } from '@/lib/query-client';

const USER_ID_KEY = 'knowledge-node-user-id';
const SAMPLE_DATA_INITIALIZED_KEY = 'knowledge-node-sample-initialized';
const OFFLINE_QUEUE_BASE_KEY = 'knowledge-node-offline-queue';

const LEGACY_KEYS = [
  STORAGE_KEYS.NODES,
  STORAGE_KEYS.ROOT_IDS,
  STORAGE_KEYS.SUPERTAGS,
  STORAGE_KEYS.NOTEBOOKS,
  STORAGE_KEYS.PINNED_TAGS,
  STORAGE_KEYS.DATA_VERSION,
  SAMPLE_DATA_INITIALIZED_KEY,
  OFFLINE_QUEUE_BASE_KEY,
];

const USER_SCOPED_BASE_KEYS = [
  STORAGE_KEYS.NODES,
  STORAGE_KEYS.ROOT_IDS,
  STORAGE_KEYS.SUPERTAGS,
  STORAGE_KEYS.NOTEBOOKS,
  STORAGE_KEYS.PINNED_TAGS,
  STORAGE_KEYS.DATA_VERSION,
  SAMPLE_DATA_INITIALIZED_KEY,
  OFFLINE_QUEUE_BASE_KEY,
];

interface ClearClientCachesOptions {
  clearUserIdentity?: boolean;
  clearQueryCache?: boolean;
}

export function clearClientCaches(options: ClearClientCachesOptions = {}) {
  if (typeof window === 'undefined') return;

  const { clearUserIdentity = true, clearQueryCache = true } = options;
  const userId = localStorage.getItem(USER_ID_KEY);

  // 清理旧版全局 key
  LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));

  // 清理当前用户作用域 key
  if (userId) {
    USER_SCOPED_BASE_KEYS.forEach((baseKey) => {
      localStorage.removeItem(`${userId}:${baseKey}`);
    });

    // 兜底清理同前缀键，避免脏键残留
    const prefix = `${userId}:`;
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  }

  if (clearUserIdentity) {
    localStorage.removeItem(USER_ID_KEY);
  }

  if (clearQueryCache) {
    clearGlobalQueryCache();
  }
}
