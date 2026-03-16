'use client';

import React, {
  RefObject,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { EditorState, LexicalEditor } from 'lexical';
import type { NodeReference } from '@/types';
import { ReferenceEntityPlugin } from './plugins/ReferenceEntityPlugin';
import { MentionTriggerPlugin } from './plugins/MentionTriggerPlugin';
import { HashTriggerPlugin } from './plugins/HashTriggerPlugin';
import { ReferenceDeletionPlugin } from './plugins/ReferenceDeletionPlugin';
import { EnterCommandPlugin } from './plugins/EnterCommandPlugin';
import { ReferenceEntityNode } from './nodes/ReferenceEntityNode';
import {
  insertReferenceAtSelection,
  serializeEditorState,
} from './referenceSerializer';

export interface UnifiedNodeEditorHandle {
  focus: () => void;
  insertReference: (targetNodeId: string, title: string) => void;
}

export interface UnifiedNodeEditorProps {
  value: string;
  references?: NodeReference[];
  contentRef?: RefObject<HTMLDivElement | null>;
  className?: string;
  placeholder?: string;
  readOnly?: boolean;
  onChange?: (next: { content: string; references: NodeReference[] }) => void;
  onMentionTrigger?: (position: { x: number; y: number }) => void;
  onHashTrigger?: (position: { x: number; y: number }, searchTerm: string) => void;
  onHashDismiss?: () => void;
  onPlainEnter?: () => boolean;
  onInput?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onFocus?: () => void;
  onBlur?: (e: React.FocusEvent) => void;
  onCompositionStart?: () => void;
  onCompositionEnd?: () => void;
}

function onError(error: Error) {
  console.error('[UnifiedNodeEditor] Lexical error:', error);
}

function EditorRefPlugin({
  editorRef,
}: {
  editorRef: React.MutableRefObject<LexicalEditor | null>;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    editorRef.current = editor;
  }, [editor, editorRef]);

  return null;
}

const UnifiedNodeEditor = forwardRef<UnifiedNodeEditorHandle, UnifiedNodeEditorProps>(
  (
    {
      value,
      references,
      contentRef,
      className,
      placeholder = '输入内容...',
      readOnly = false,
      onChange,
      onMentionTrigger,
      onHashTrigger,
      onHashDismiss,
      onPlainEnter,
      onInput,
      onKeyDown,
      onFocus,
      onBlur,
      onCompositionStart,
      onCompositionEnd,
    },
    ref,
  ) => {
  const lexicalEditorRef = useRef<LexicalEditor | null>(null);
  const lastEmittedRef = useRef<{ content: string; references: NodeReference[] }>({
    content: '',
    references: [],
  });
  const isComposingRef = useRef(false);

  const initialConfig = useMemo(
    () => ({
      namespace: 'knowledge-node-unified-input',
      editable: !readOnly,
      onError,
      editorState: null,
      theme: {
        paragraph: 'inline',
      },
      nodes: [ReferenceEntityNode],
    }),
    [readOnly],
  );

  useImperativeHandle(ref, () => ({
    focus: () => {
      contentRef?.current?.focus();
    },
    insertReference: (targetNodeId: string, title: string) => {
      const editor = lexicalEditorRef.current;
      if (!editor) return;
      const nextRef: NodeReference = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        targetNodeId,
        title: title.trim() || '未命名节点',
        createdAt: Date.now(),
      };
      insertReferenceAtSelection(editor, nextRef);
    },
  }), [contentRef]);

  const handleEditorChange = (editorState: EditorState) => {
    if (!onChange) return;
    const serialized = serializeEditorState(editorState);
    lastEmittedRef.current = serialized;
    onChange({
      content: serialized.content,
      references: serialized.references,
    });
  };

  const handleCompositionStart = () => {
    isComposingRef.current = true;
    onCompositionStart?.();
  };

  const handleCompositionEnd = () => {
    isComposingRef.current = false;
    onCompositionEnd?.();
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="relative inline">
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              ref={contentRef}
              className={className}
              onInput={onInput}
              onKeyDown={onKeyDown}
              onFocus={onFocus}
              onBlur={onBlur}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
            />
          }
          placeholder={
            <div className="pointer-events-none absolute left-0 top-0 text-sm text-gray-400 whitespace-nowrap">
              {placeholder}
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <EditorRefPlugin editorRef={lexicalEditorRef} />
        <HistoryPlugin />
        <OnChangePlugin onChange={handleEditorChange} />
        <ReferenceEntityPlugin
          references={references || []}
          value={value}
          lastEmittedRef={lastEmittedRef}
          isComposingRef={isComposingRef}
        />
        <MentionTriggerPlugin onTrigger={onMentionTrigger} />
        <HashTriggerPlugin onTrigger={onHashTrigger} onDismiss={onHashDismiss} />
        <ReferenceDeletionPlugin />
        <EnterCommandPlugin onPlainEnter={onPlainEnter} />
      </div>
    </LexicalComposer>
  );
  },
);

UnifiedNodeEditor.displayName = 'UnifiedNodeEditor';

export default UnifiedNodeEditor;

