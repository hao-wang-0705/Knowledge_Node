'use client';

import React, { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection,
  $isNodeSelection,
  COMMAND_PRIORITY_CRITICAL,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
} from 'lexical';
import { $isReferenceEntityNode } from '../nodes/ReferenceEntityNode';

/**
 * Handles deletion of reference entities that are selected via NodeSelection
 * (e.g. user clicked on a reference chip). For all other cases (collapsed cursor
 * adjacent to a reference, range selection spanning a reference) Lexical's
 * built-in DecoratorNode deletion logic handles it correctly when
 * isIsolated()=false and getTextContent()=''.
 */
function handleNodeSelectionDelete(event: KeyboardEvent): boolean {
  const selection = $getSelection();
  if (!$isNodeSelection(selection)) return false;

  const refs = selection.getNodes().filter($isReferenceEntityNode);
  if (refs.length === 0) return false;

  event.preventDefault();
  selection.deleteNodes();
  return true;
}

export const ReferenceDeletionPlugin: React.FC = () => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const unregBackspace = editor.registerCommand<KeyboardEvent>(
      KEY_BACKSPACE_COMMAND,
      handleNodeSelectionDelete,
      COMMAND_PRIORITY_CRITICAL,
    );

    const unregDelete = editor.registerCommand<KeyboardEvent>(
      KEY_DELETE_COMMAND,
      handleNodeSelectionDelete,
      COMMAND_PRIORITY_CRITICAL,
    );

    return () => {
      unregBackspace();
      unregDelete();
    };
  }, [editor]);

  return null;
};

export default ReferenceDeletionPlugin;
