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
  /** 按视图的折叠状态，不传则用 node.isCollapsed */
  isCollapsed?: boolean;
}

export default function NodeFields({
  node,
  nodeId,
  depth,
  nodeTags,
  getFieldDefinitions,
  onFieldChange,
  isCollapsed = node.isCollapsed,
}: NodeFieldsProps) {
  // 锁定状态：由 statusConfig.blockedStates 判定，无配置时兜底为 todo + todo_status === 'Locked'
  const isLockedStatusField = (tag: Supertag, fieldDef: FieldDefinition) => {
    const statusDef = tag.fieldDefinitions?.find(
      (d) => d.type === 'status' && d.statusConfig?.blockedStates?.length,
    );
    if (statusDef && fieldDef.key === statusDef.key) {
      const current = (node.fields[fieldDef.key] as string | undefined) ?? '';
      return statusDef.statusConfig!.blockedStates!.includes(current);
    }
    return tag.name === 'todo' && fieldDef.key === 'todo_status' && node.fields.todo_status === 'Locked';
  };

  if (!nodeTags.length || isCollapsed) {
    return null;
  }

  return (
    <div
      className="fields-container bg-slate-50/80 border-l-2 border-blue-200 rounded-r-lg my-1"
      style={{ marginLeft: `${depth * 24 + 44}px` }}
    >
      <div className="py-1">
        {nodeTags.map((tag) => {
          const fieldDefs = getFieldDefinitions(tag.id) ?? [];
          return fieldDefs.map((fieldDef) => (
            <FieldEditor
              key={fieldDef.id}
              fieldDef={fieldDef}
              value={node.fields[fieldDef.key]}
              readOnly={isLockedStatusField(tag, fieldDef)}
              onChange={(value) => {
                if (isLockedStatusField(tag, fieldDef)) return;
                onFieldChange(fieldDef.key, value);
              }}
              nodeId={nodeId}
              tagId={tag.id}
            />
          ));
        })}
      </div>
      <Backlinks nodeId={nodeId} className="px-3 pb-2" defaultExpanded={false} />
    </div>
  );
}
