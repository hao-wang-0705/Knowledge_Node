'use client';

import React, { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';

interface HashTriggerPluginProps {
  onTrigger?: (position: { x: number; y: number }, searchTerm: string) => void;
  onDismiss?: () => void;
}

/**
 * 在 Lexical 更新后检测光标前是否存在 #trigger，
 * 避免依赖原生 input 事件导致的触发不稳定。
 */
export const HashTriggerPlugin: React.FC<HashTriggerPluginProps> = ({
  onTrigger,
  onDismiss,
}) => {
  const [editor] = useLexicalComposerContext();
  const wasActiveRef = useRef(false);

  useEffect(() => {
    return editor.registerUpdateListener(() => {
      if (!onTrigger) return;

      requestAnimationFrame(() => {
        const rootElement = editor.getRootElement();
        const activeElement = document.activeElement;
        const domSelection = window.getSelection();

        if (
          !rootElement ||
          !activeElement ||
          !rootElement.contains(activeElement) ||
          !domSelection ||
          domSelection.rangeCount === 0
        ) {
          if (wasActiveRef.current) {
            onDismiss?.();
            wasActiveRef.current = false;
          }
          return;
        }

        const selectionRange = domSelection.getRangeAt(0);
        if (!rootElement.contains(selectionRange.startContainer)) {
          if (wasActiveRef.current) {
            onDismiss?.();
            wasActiveRef.current = false;
          }
          return;
        }

        // 通过 DOM Range 计算光标前字符数，兼容多 text node 场景
        const beforeCaretRange = selectionRange.cloneRange();
        beforeCaretRange.selectNodeContents(rootElement);
        beforeCaretRange.setEnd(selectionRange.startContainer, selectionRange.startOffset);

        const fullText = rootElement.textContent || '';
        const caretOffset = beforeCaretRange.toString().length;
        const textBeforeCursor = fullText.substring(0, caretOffset);
        const hashMatch = textBeforeCursor.match(/#([^\s#]*)$/);

        if (!hashMatch) {
          if (wasActiveRef.current) {
            onDismiss?.();
            wasActiveRef.current = false;
          }
          return;
        }

        const rect = selectionRange.getBoundingClientRect();
        onTrigger(
          {
            x: rect.left - (hashMatch[1]?.length || 0) * 8,
            y: rect.bottom + 4,
          },
          hashMatch[1] || '',
        );
        wasActiveRef.current = true;
      });
    });
  }, [editor, onTrigger, onDismiss]);

  return null;
};

export default HashTriggerPlugin;
