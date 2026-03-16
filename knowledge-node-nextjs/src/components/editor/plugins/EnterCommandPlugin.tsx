'use client';

import React, { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { COMMAND_PRIORITY_HIGH, KEY_ENTER_COMMAND } from 'lexical';

interface EnterCommandPluginProps {
  onPlainEnter?: () => boolean;
}

export const EnterCommandPlugin: React.FC<EnterCommandPluginProps> = ({
  onPlainEnter,
}) => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand<KeyboardEvent>(
      KEY_ENTER_COMMAND,
      (event) => {
        if (event.shiftKey) return false;
        if (!onPlainEnter) return false;
        const handled = onPlainEnter();
        if (!handled) return false;
        event.preventDefault();
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor, onPlainEnter]);

  return null;
};

export default EnterCommandPlugin;
