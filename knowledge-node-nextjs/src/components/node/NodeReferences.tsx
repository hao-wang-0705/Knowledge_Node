import { ReferenceBlock } from '@/components/ReferenceBlock';
import type { NodeReference } from '@/types';

interface NodeReferencesProps {
  nodeId: string;
  references: NodeReference[];
  onRemove: (referenceId: string) => void;
  onAdd: () => void;
  isEditing: boolean;
}

export default function NodeReferences({
  nodeId,
  references,
  onRemove,
  onAdd,
  isEditing,
}: NodeReferencesProps) {
  if (!references.length) {
    return null;
  }

  return (
    <ReferenceBlock
      nodeId={nodeId}
      references={references}
      onRemove={onRemove}
      onAdd={onAdd}
      readOnly={false}
      isEditing={isEditing}
      maxDisplay={3}
    />
  );
}
