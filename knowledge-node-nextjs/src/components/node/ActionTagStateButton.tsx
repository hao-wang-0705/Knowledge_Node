'use client';

import React from 'react';
import { Check, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TagTemplate, FieldDefinition } from '@/types';

/** 行动标签「完成」态取值（无 statusConfig 时的兜底） */
const ACTION_DONE_VALUE: Record<string, string> = {
  todo: 'Done',
  卡点: 'Resolved',
  灵感: '已验证',
};

export interface StateFieldInfo {
  fieldKey: string;
  doneValue: string;
  options: string[];
  blockedStates?: string[];
  initial?: string;
  transitions?: Record<string, Record<string, string>>;
}

function getStateFieldAndDoneValue(
  tag: TagTemplate,
  getFieldDefinitions: (tagId: string) => FieldDefinition[],
): StateFieldInfo | null {
  const defs = getFieldDefinitions(tag.id) ?? [];
  // 优先使用 type === 'status' 且带 statusConfig 的字段
  const statusDef = defs.find((d) => d.type === 'status' && d.statusConfig?.states?.length);
  if (statusDef?.statusConfig) {
    const cfg = statusDef.statusConfig;
    const doneValue = cfg.doneState ?? cfg.resolvedState ?? ACTION_DONE_VALUE[tag.name];
    if (!doneValue || !cfg.states.length) return null;
    return {
      fieldKey: statusDef.key,
      doneValue,
      options: cfg.states,
      blockedStates: cfg.blockedStates,
      initial: cfg.initial,
      transitions: cfg.transitions,
    };
  }
  const doneValue = ACTION_DONE_VALUE[tag.name];
  if (!doneValue) return null;
  const stateDef = defs.find(
    (d) =>
      d.type === 'select' &&
      Array.isArray(d.options) &&
      d.options.includes(doneValue),
  );
  if (!stateDef?.options) return null;
  return {
    fieldKey: stateDef.key,
    doneValue,
    options: stateDef.options,
  };
}

interface ActionTagStateButtonProps {
  nodeId: string;
  node: { fields: Record<string, unknown>; blockedBy?: { id: string; content: string }[] };
  supertag: TagTemplate | null;
  getFieldDefinitions: (tagId: string) => FieldDefinition[];
  onUpdate: (fieldKey: string, value: string) => void;
  className?: string;
}

export default function ActionTagStateButton({
  nodeId,
  node,
  supertag,
  getFieldDefinitions,
  onUpdate,
  className,
}: ActionTagStateButtonProps) {
  if (!supertag || supertag.category !== 'action') return null;
  const state = getStateFieldAndDoneValue(supertag, getFieldDefinitions);
  if (!state) return null;

  const current = (node.fields[state.fieldKey] as string) ?? state.initial ?? state.options[0];
  const isDone = current === state.doneValue;
  const isLocked = Boolean(
    state.blockedStates?.includes(current) ?? (supertag.name === 'todo' && current === 'Locked'),
  );

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLocked) return;
    const nextFromTransition = state.transitions?.user_toggle?.[current];
    const next =
      nextFromTransition !== undefined
        ? nextFromTransition
        : isDone
          ? (state.initial ?? state.options[0])
          : state.doneValue;
    onUpdate(state.fieldKey, next);
  };

  const lockTitle =
    isLocked && node.blockedBy?.length
      ? `被 ${node.blockedBy.length} 个前置阻塞：\n${node.blockedBy.map((b) => `🪢 ${b.content?.slice(0, 50) ?? b.id}${(b.content?.length ?? 0) > 50 ? '…' : ''}`).join('\n')}`
      : isLocked
        ? '存在未解除的阻塞前置项'
        : isDone
          ? '标记未完成'
          : '标记完成';

  return (
    <button
      type="button"
      onClick={handleClick}
      title={lockTitle}
      disabled={isLocked}
      className={cn(
        'flex-shrink-0 flex items-center justify-center w-5 h-5 rounded border transition-colors',
        isLocked &&
          'cursor-not-allowed border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500',
        !isLocked &&
          (isDone
            ? 'bg-green-500 border-green-500 text-white'
            : 'border-gray-300 dark:border-gray-600 text-gray-400 hover:border-green-400 hover:text-green-500 dark:hover:border-green-500'),
        className,
      )}
    >
      {isDone ? <Check size={12} strokeWidth={3} /> : null}
      {isLocked ? <Lock size={12} className="text-gray-500 dark:text-gray-400" /> : null}
    </button>
  );
}
