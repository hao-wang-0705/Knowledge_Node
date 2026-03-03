import Backlinks from '@/components/Backlinks';
import FieldEditor from '@/components/FieldEditor';
import type { Node, Supertag, FieldDefinition } from '@/types';

interface NodeFieldsProps {
  node: Node;
  nodeId: string;
  depth: number;
  nodeTags: Supertag[];
  getFieldDefinitions: (tagId: string) => FieldDefinition[];
  onFieldChange: (fieldKey: string, value: unknown) => void;
}

export default function NodeFields({
  node,
  nodeId,
  depth,
  nodeTags,
  getFieldDefinitions,
  onFieldChange,
}: NodeFieldsProps) {
  if (!nodeTags.length || node.isCollapsed) {
    return null;
  }

  return (
    <div
      className="fields-container bg-slate-50/80 border-l-2 border-blue-200 rounded-r-lg my-1"
      style={{ marginLeft: `${depth * 24 + 44}px` }}
    >
      <div className="py-1">
        {nodeTags.map((tag) =>
          (getFieldDefinitions(tag.id) ?? []).map((fieldDef) => (
            <FieldEditor
              key={fieldDef.id}
              fieldDef={fieldDef}
              value={node.fields[fieldDef.key]}
              onChange={(value) => onFieldChange(fieldDef.key, value)}
              nodeId={nodeId}
              tagId={tag.id}
            />
          ))
        )}
      </div>
      <Backlinks nodeId={nodeId} className="px-3 pb-2" defaultExpanded={false} />
    </div>
  );
}
