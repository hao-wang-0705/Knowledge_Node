/**
 * 同步状态反馈 Hook
 * 监听 syncStore 状态变化，在适当时机显示 Toast 提示
 */

import { useEffect, useRef } from 'react';
import { useSyncStore } from '@/stores/syncStore';
import { useToastActions } from '@/components/ui/toast';

export function useSyncFeedback() {
  const toast = useToastActions();
  const status = useSyncStore((state) => state.status);
  const prevStatusRef = useRef<string | null>(null);

  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;

    if (status === 'synced') {
      if (prev === 'syncing') {
        toast.success('已同步');
      } else if (prev === 'error') {
        toast.success('同步已恢复');
      }
    }
  }, [status, toast]);
}
