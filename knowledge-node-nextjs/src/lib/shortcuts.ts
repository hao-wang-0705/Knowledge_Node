/**
 * 统一快捷键注册
 * 定义全局快捷键映射，供 useShortcuts 使用
 */

export interface ShortcutDef {
  key: string;
  modifiers?: ('meta' | 'ctrl' | 'shift' | 'alt')[];
  handler: (e: KeyboardEvent) => void;
  scope?: 'global' | 'editor';
}

export function matchShortcut(e: KeyboardEvent, def: ShortcutDef): boolean {
  const keyMatch = e.key.toLowerCase() === def.key.toLowerCase();
  const metaMatch = (def.modifiers?.includes('meta') ?? false) === e.metaKey;
  const ctrlMatch = (def.modifiers?.includes('ctrl') ?? false) === e.ctrlKey;
  const shiftMatch = (def.modifiers?.includes('shift') ?? false) === e.shiftKey;
  const altMatch = (def.modifiers?.includes('alt') ?? false) === e.altKey;
  const noExtraModifiers =
    (!def.modifiers?.includes('meta') || e.metaKey) &&
    (!def.modifiers?.includes('ctrl') || e.ctrlKey) &&
    (!def.modifiers?.includes('shift') || e.shiftKey) &&
    (!def.modifiers?.includes('alt') || e.altKey);
  return keyMatch && metaMatch && ctrlMatch && shiftMatch && altMatch && noExtraModifiers;
}

export function registerShortcuts(shortcuts: ShortcutDef[]) {
  const handler = (e: KeyboardEvent) => {
    for (const def of shortcuts) {
      if (matchShortcut(e, def)) {
        e.preventDefault();
        def.handler(e);
        return;
      }
    }
  };
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}
