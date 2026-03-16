'use client';

import React from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import {
  DecoratorNode,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from 'lexical';
import type { NodeReference } from '@/types';
import { ReferenceChip } from '@/components/ReferenceChip';

function ReferenceEntityComponent({
  nodeKey,
  reference,
}: {
  nodeKey: NodeKey;
  reference: NodeReference;
}) {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);

  const handleMouseDown = (event: React.MouseEvent<HTMLSpanElement>) => {
    event.preventDefault();
    editor.focus();
    editor.update(() => {
      if (!event.shiftKey) {
        clearSelection();
      }
      setSelected(true);
    });
  };

  return (
    <span
      contentEditable={false}
      onMouseDown={handleMouseDown}
      className={isSelected ? 'rounded-sm ring-2 ring-blue-400/60 ring-offset-1' : undefined}
    >
      <ReferenceChip
        nodeId={reference.targetNodeId}
        title={reference.title}
        interactive={false}
      />
    </span>
  );
}

export type SerializedReferenceEntityNode = Spread<
  {
    type: 'reference-entity';
    version: 1;
    reference: NodeReference;
  },
  SerializedLexicalNode
>;

export class ReferenceEntityNode extends DecoratorNode<React.JSX.Element> {
  __reference: NodeReference;

  static getType(): string {
    return 'reference-entity';
  }

  static clone(node: ReferenceEntityNode): ReferenceEntityNode {
    return new ReferenceEntityNode(node.__reference, node.__key);
  }

  static importJSON(serializedNode: SerializedReferenceEntityNode): ReferenceEntityNode {
    return $createReferenceEntityNode(serializedNode.reference);
  }

  constructor(reference: NodeReference, key?: NodeKey) {
    super(key);
    this.__reference = reference;
  }

  exportJSON(): SerializedReferenceEntityNode {
    return {
      ...super.exportJSON(),
      type: 'reference-entity',
      version: 1,
      reference: this.__reference,
    };
  }

  createDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'inline-flex align-middle';
    return span;
  }

  updateDOM(): false {
    return false;
  }

  isInline(): boolean {
    return true;
  }

  isIsolated(): boolean {
    return false;
  }

  isKeyboardSelectable(): boolean {
    return true;
  }

  getTextContent(): string {
    return '';
  }

  getReference(): NodeReference {
    return this.getLatest().__reference;
  }

  decorate(): React.JSX.Element {
    const ref = this.getLatest().__reference;
    return <ReferenceEntityComponent nodeKey={this.getKey()} reference={ref} />;
  }
}

export function $createReferenceEntityNode(reference: NodeReference): ReferenceEntityNode {
  return new ReferenceEntityNode(reference);
}

export function $isReferenceEntityNode(
  node: LexicalNode | null | undefined,
): node is ReferenceEntityNode {
  return node instanceof ReferenceEntityNode;
}
