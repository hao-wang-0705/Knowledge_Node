/**
 * 解析结果预览组件
 * v3.5: 展示 AI 解析出的结构化条件列表
 */

import React from 'react';
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SearchConfig, SearchCondition, LogicalOperator } from '@/types/search';
import ConditionCard from './ConditionCard';

interface ParsedConditionsPreviewProps {
  /** 解析出的搜索配置 */
  config: SearchConfig;
  /** 解析说明 */
  explanation?: string;
  /** 警告信息 */
  warnings?: string[];
  /** 置信度 (0-1) */
  confidence?: number;
  /** 条件删除回调 */
  onConditionDelete?: (index: number) => void;
  /** 条件编辑回调 */
  onConditionEdit?: (index: number) => void;
  /** 逻辑操作符变更回调 */
  onLogicalOperatorChange?: (operator: LogicalOperator) => void;
  /** 是否可编辑 */
  editable?: boolean;
}

const ParsedConditionsPreview: React.FC<ParsedConditionsPreviewProps> = ({
  config,
  explanation,
  warnings,
  confidence,
  onConditionDelete,
  onConditionEdit,
  onLogicalOperatorChange,
  editable = true,
}) => {
  const isLowConfidence = confidence !== undefined && confidence < 0.7;
  const hasWarnings = warnings && warnings.length > 0;

  return (
    <div className="space-y-4">
      {/* 状态指示条 */}
      <div
        className={cn(
          'flex items-start gap-2 rounded-lg border px-4 py-3',
          isLowConfidence
            ? 'border-amber-200 bg-amber-50'
            : hasWarnings
              ? 'border-yellow-200 bg-yellow-50'
              : 'border-green-200 bg-green-50'
        )}
      >
        {isLowConfidence ? (
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
        ) : hasWarnings ? (
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-600" />
        ) : (
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
        )}
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              'text-sm font-medium',
              isLowConfidence
                ? 'text-amber-700'
                : hasWarnings
                  ? 'text-yellow-700'
                  : 'text-green-700'
            )}
          >
            {explanation || '已成功解析查询条件'}
          </p>
          {confidence !== undefined && (
            <p className="mt-0.5 text-xs opacity-70">
              置信度：{Math.round(confidence * 100)}%
              {isLowConfidence && ' - 建议确认条件是否正确'}
            </p>
          )}
        </div>
      </div>

      {/* 警告列表 */}
      {hasWarnings && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50/50 px-4 py-3">
          <p className="mb-1.5 text-xs font-medium text-yellow-700">注意事项：</p>
          <ul className="space-y-1">
            {warnings.map((warning, idx) => (
              <li key={idx} className="flex items-start gap-1.5 text-xs text-yellow-600">
                <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-yellow-400" />
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 逻辑操作符 */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">条件组合：</span>
        {editable && onLogicalOperatorChange ? (
          <select
            className="h-7 rounded border border-slate-200 bg-white px-2 text-xs"
            value={config.logicalOperator}
            onChange={(e) => onLogicalOperatorChange(e.target.value as LogicalOperator)}
          >
            <option value="AND">全部满足 (AND)</option>
            <option value="OR">满足任一 (OR)</option>
          </select>
        ) : (
          <span className="text-xs font-medium text-slate-700">
            {config.logicalOperator === 'AND' ? '全部满足' : '满足任一'}
          </span>
        )}
      </div>

      {/* 条件卡片列表 */}
      <div className="space-y-2">
        {config.conditions.map((condition, index) => (
          <React.Fragment key={`condition-${index}`}>
            <ConditionCard
              condition={condition}
              index={index}
              editable={editable}
              onDelete={onConditionDelete}
              onEdit={onConditionEdit}
            />
            {/* 逻辑操作符分隔 */}
            {index < config.conditions.length - 1 && (
              <div className="flex items-center justify-center py-1">
                <span
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-xs font-medium',
                    config.logicalOperator === 'AND'
                      ? 'bg-teal-100 text-teal-600'
                      : 'bg-cyan-100 text-cyan-600'
                  )}
                >
                  {config.logicalOperator}
                </span>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* 空状态 */}
      {config.conditions.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
          <p className="text-sm text-slate-500">暂无解析出的条件</p>
        </div>
      )}
    </div>
  );
};

export default ParsedConditionsPreview;
