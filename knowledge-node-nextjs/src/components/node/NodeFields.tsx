import { useCallback, useState } from 'react';
import Backlinks from '@/components/Backlinks';
import FieldEditor from '@/components/FieldEditor';
import type { Node, Supertag, FieldDefinition } from '@/types';
import type { AIFieldProcessResult } from '@/services/ai/field-processor';

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
  const [loadingFields, setLoadingFields] = useState<Set<string>>(new Set());

  // AI 字段触发回调 - 通过 API 调用
  const handleTriggerAI = useCallback(async (fieldId: string, allFieldDefs: FieldDefinition[]) => {
    const fieldDef = allFieldDefs.find(f => f.id === fieldId);
    if (!fieldDef) return;

    // 设置加载状态
    setLoadingFields(prev => new Set(prev).add(fieldId));

    try {
      const response = await fetch('/api/ai/field', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeContent: node.content || '',
          fieldDef,
          existingFields: node.fields,
          nodeId, // 传递 nodeId，让后端查询子节点上下文
        }),
      });

      const result: AIFieldProcessResult = await response.json();

      if (result.success && result.value !== null) {
        onFieldChange(result.fieldKey, result.value);
      } else if (result.error) {
        console.error('[NodeFields] AI 处理失败:', result.error);
      }
    } catch (error) {
      console.error('[NodeFields] AI 请求失败:', error);
    } finally {
      setLoadingFields(prev => {
        const next = new Set(prev);
        next.delete(fieldId);
        return next;
      });
    }
  }, [node.content, node.fields, nodeId, onFieldChange]);

  if (!nodeTags.length || node.isCollapsed) {
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
              onChange={(value) => onFieldChange(fieldDef.key, value)}
              nodeId={nodeId}
              tagId={tag.id}
              onTriggerAI={
                fieldDef.type === 'ai_text' || fieldDef.type === 'ai_select'
                  ? (fieldId) => handleTriggerAI(fieldId, fieldDefs)
                  : undefined
              }
            />
          ));
        })}
      </div>
      <Backlinks nodeId={nodeId} className="px-3 pb-2" defaultExpanded={false} />
    </div>
  );
}
