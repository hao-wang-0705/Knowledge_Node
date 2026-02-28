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
  if (e.key.toLowerCase() !== def.key.toLowerCase()) return false;
  const mods = def.modifiers ?? [];
  if (mods.includes('meta') !== e.metaKey) return false;
  if (mods.includes('ctrl') !== e.ctrlKey) return false;
  if (mods.includes('shift') !== e.shiftKey) return false;
  if (mods.includes('alt') !== e.altKey) return false;
  return true;
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
