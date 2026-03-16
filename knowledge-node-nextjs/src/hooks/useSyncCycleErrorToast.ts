/**
 * 当同步队列中出现建边/写操作失败时展示 Toast：
 * - 循环依赖
 * - 存在未解除的阻塞前置项（Locked todo 直接闭环被拒）
 */
import { useEffect, useRef } from 'react';
import { useSyncStore } from '@/stores/syncStore';
import { useToastActions } from '@/components/ui/toast';

const CYCLE_ERROR_MARKER = '循环依赖';
const BLOCKED_ERROR_MARKER = '存在未解除的阻塞前置项';

export function useSyncCycleErrorToast() {
  const toast = useToastActions();
  const shownForOpIds = useRef<Set<string>>(new Set());
  const pendingOperations = useSyncStore((s) => s.pendingOperations);
  const status = useSyncStore((s) => s.status);

  useEffect(() => {
    const failed = pendingOperations.filter((op) => op.status === 'failed' && op.error);
    for (const op of failed) {
      if (!op.id || shownForOpIds.current.has(op.id)) continue;
      const err = op.error ?? '';
      if (err.includes(CYCLE_ERROR_MARKER)) {
        shownForOpIds.current.add(op.id);
        toast.error('建边失败：检测到循环依赖逻辑');
      } else if (err.includes(BLOCKED_ERROR_MARKER)) {
        shownForOpIds.current.add(op.id);
        toast.error('存在未解除的阻塞前置项，无法直接闭环');
      }
    }
  }, [pendingOperations, status, toast]);
}
