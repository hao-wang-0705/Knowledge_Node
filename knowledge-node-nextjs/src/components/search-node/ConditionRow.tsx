import React from 'react';
import type { SearchCondition } from '@/types/search';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface ConditionRowProps {
  condition: SearchCondition;
  index: number;
  onChange: (index: number, updates: Partial<SearchCondition>) => void;
  onDelete: (index: number) => void;
}

const CONDITION_TYPES: Array<SearchCondition['type']> = ['tag', 'field', 'keyword', 'ancestor', 'date'];
const OPERATORS: Array<SearchCondition['operator']> = [
  'equals',
  'contains',
  'gt',
  'lt',
  'gte',
  'lte',
  'is',
  'isNot',
  'hasAny',
  'hasAll',
  'today',
  'withinDays',
];

const ConditionRow: React.FC<ConditionRowProps> = ({ condition, index, onChange, onDelete }) => {
  return (
    <div className="mb-2 rounded-lg border border-cyan-100 bg-cyan-50/40 p-2">
      <div className="grid grid-cols-12 gap-2">
        <select
          className="col-span-3 h-9 rounded-md border border-gray-200 bg-white px-2 text-sm"
          value={condition.type}
          onChange={(event) => onChange(index, { type: event.target.value as SearchCondition['type'] })}
        >
          {CONDITION_TYPES.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>

        <Input
          className="col-span-3"
          placeholder="字段名(可选)"
          value={condition.field || ''}
          onChange={(event) => onChange(index, { field: event.target.value || undefined })}
        />

        <select
          className="col-span-3 h-9 rounded-md border border-gray-200 bg-white px-2 text-sm"
          value={condition.operator}
          onChange={(event) => onChange(index, { operator: event.target.value as SearchCondition['operator'] })}
        >
          {OPERATORS.map((operator) => (
            <option key={operator} value={operator}>{operator}</option>
          ))}
        </select>

        <Input
          className="col-span-2"
          placeholder="值"
          value={Array.isArray(condition.value) ? condition.value.join(',') : String(condition.value)}
          onChange={(event) => onChange(index, { value: event.target.value })}
        />

        <Button
          variant="outline"
          size="sm"
          className="col-span-1"
          onClick={() => onDelete(index)}
        >
          删
        </Button>
      </div>
    </div>
  );
};

export default ConditionRow;
