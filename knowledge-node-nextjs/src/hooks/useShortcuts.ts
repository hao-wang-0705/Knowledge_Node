/**
 * 统一快捷键 Hook
 * 在 mount 时注册、unmount 时解除
 */

import { useEffect } from 'react';
import type { ShortcutDef } from '@/lib/shortcuts';
import { registerShortcuts } from '@/lib/shortcuts';

export function useShortcuts(shortcuts: ShortcutDef[]) {
  useEffect(() => {
    return registerShortcuts(shortcuts);
  }, [shortcuts]);
}
