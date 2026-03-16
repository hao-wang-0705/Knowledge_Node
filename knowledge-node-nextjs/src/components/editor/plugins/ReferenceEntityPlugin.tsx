'use client';

import React, { MutableRefObject, useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import type { NodeReference } from '@/types';
import { buildEditorFromValue, shouldRebuildEditor } from '../referenceSerializer';

interface ReferenceEntityPluginProps {
  references: NodeReference[];
  value: string;
  lastEmittedRef: MutableRefObject<{ content: string; references: NodeReference[] }>;
  isComposingRef: MutableRefObject<boolean>;
}

function referencesShallowEqual(a: NodeReference[], b: NodeReference[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (
      left.id !== right.id ||
      left.targetNodeId !== right.targetNodeId ||
      left.title !== right.title ||
      left.anchorOffset !== right.anchorOffset
    ) {
      return false;
    }
  }
  return true;
}

/**
 * 极简版引用实体插件：
 * - 当前版本仅负责将外部 references 保存在 editor 实例上，供序列化使用
 * - 行内渲染仍交给现有的 ContentWithReferences（只读渲染）
 * - 后续可以逐步升级为真正的 Lexical inline entity node
 */
export const ReferenceEntityPlugin: React.FC<ReferenceEntityPluginProps> = ({
  references,
  value,
  lastEmittedRef,
  isComposingRef,
}) => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (isComposingRef.current) return;
    const lastEmitted = lastEmittedRef.current;
    const isEchoUpdate =
      value === lastEmitted.content &&
      referencesShallowEqual(references, lastEmitted.references);
    if (isEchoUpdate) return;
    if (!shouldRebuildEditor(editor, value, references)) return;
    buildEditorFromValue(editor, value, references);
  }, [editor, value, references, lastEmittedRef, isComposingRef]);

  return null;
};

export default ReferenceEntityPlugin;

