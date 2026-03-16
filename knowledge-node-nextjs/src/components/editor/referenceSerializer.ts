'use client';

import {
  $createLineBreakNode,
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  EditorState,
  ElementNode,
  LexicalEditor,
  LexicalNode,
} from 'lexical';
import type { NodeReference } from '@/types';
import {
  $createReferenceEntityNode,
  $isReferenceEntityNode,
} from './nodes/ReferenceEntityNode';

function appendTextWithLineBreaks(parent: ElementNode, text: string) {
  const parts = text.split('\n');
  parts.forEach((part, index) => {
    if (part) {
      parent.append($createTextNode(part));
    }
    if (index < parts.length - 1) {
      parent.append($createLineBreakNode());
    }
  });
}

export function buildEditorFromValue(
  editor: LexicalEditor,
  content: string,
  references: NodeReference[] = [],
) {
  const sortedRefs = [...references].sort(
    (a, b) => (a.anchorOffset ?? 0) - (b.anchorOffset ?? 0),
  );

  editor.update(() => {
    const root = $getRoot();
    root.clear();

    const paragraph = $createParagraphNode();
    let cursor = 0;

    for (const ref of sortedRefs) {
      const anchor = Math.max(0, Math.min(ref.anchorOffset ?? 0, content.length));
      if (anchor > cursor) {
        appendTextWithLineBreaks(paragraph, content.slice(cursor, anchor));
      }
      paragraph.append($createReferenceEntityNode(ref));
      cursor = anchor;
    }

    if (cursor < content.length) {
      appendTextWithLineBreaks(paragraph, content.slice(cursor));
    }

    root.append(paragraph);
  });
}

function walkNode(
  node: LexicalNode,
  acc: { content: string; references: NodeReference[] },
) {
  if ($isReferenceEntityNode(node)) {
    const ref = node.getReference();
    acc.references.push({
      ...ref,
      anchorOffset: acc.content.length,
    });
    return;
  }

  if ($isTextNode(node)) {
    acc.content += node.getTextContent();
    return;
  }

  if ($isElementNode(node)) {
    node.getChildren().forEach((child) => walkNode(child, acc));
  }
}

export function serializeEditorState(editorState: EditorState): {
  content: string;
  references: NodeReference[];
} {
  const result = { content: '', references: [] as NodeReference[] };

  editorState.read(() => {
    const root = $getRoot();
    const topLevel = root.getChildren();
    topLevel.forEach((node, index) => {
      walkNode(node, result);
      if (index < topLevel.length - 1) {
        result.content += '\n';
      }
    });
  });

  return result;
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

export function shouldRebuildEditor(
  editor: LexicalEditor,
  nextContent: string,
  nextReferences: NodeReference[] = [],
) {
  const current = serializeEditorState(editor.getEditorState());
  return (
    current.content !== nextContent ||
    !referencesShallowEqual(current.references, nextReferences)
  );
}

export function insertReferenceAtSelection(
  editor: LexicalEditor,
  reference: NodeReference,
) {
  editor.focus();

  editor.update(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;

    if (!selection.isCollapsed()) {
      selection.removeText();
    }

    const anchorNode = selection.anchor.getNode();
    if ($isTextNode(anchorNode)) {
      const offset = selection.anchor.offset;
      const text = anchorNode.getTextContent();
      if (offset > 0 && text[offset - 1] === '@') {
        anchorNode.setTextContent(text.slice(0, offset - 1) + text.slice(offset));
        selection.setTextNodeRange(anchorNode, offset - 1, anchorNode, offset - 1);
      }
    }

    selection.insertNodes([$createReferenceEntityNode(reference)]);
  });
}

