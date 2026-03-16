'use client';

import React, { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  KEY_DOWN_COMMAND,
  COMMAND_PRIORITY_LOW,
} from 'lexical';

interface MentionTriggerPluginProps {
  onTrigger?: (position: { x: number; y: number }) => void;
}

export const MentionTriggerPlugin: React.FC<MentionTriggerPluginProps> = ({
  onTrigger,
}) => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand<KeyboardEvent>(
      KEY_DOWN_COMMAND,
      (event) => {
        if (event.key !== '@' || !onTrigger) return false;

        requestAnimationFrame(() => {
          const domSelection = window.getSelection();
          const range =
            domSelection && domSelection.rangeCount > 0
              ? domSelection.getRangeAt(0)
              : null;
          const rect = range?.getBoundingClientRect();
          onTrigger({
            x: rect?.left ?? 0,
            y: (rect?.bottom ?? 0) + 4,
          });
        });

        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor, onTrigger]);

  return null;
};

export default MentionTriggerPlugin;

