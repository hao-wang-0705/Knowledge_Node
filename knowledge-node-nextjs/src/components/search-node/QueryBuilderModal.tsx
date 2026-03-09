/**
 * 搜索节点配置弹窗
 * v3.5: 重构为自然语言配置模式 + 高级手动编辑模式
 */

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { ChevronDown, ChevronUp, Settings2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { SearchConfig, SearchCondition, NLParseResult, NLSupertagSchema } from '@/types/search';
import { useSupertagStore } from '@/stores/supertagStore';
import NaturalLanguageInput from './NaturalLanguageInput';
import ParsedConditionsPreview from './ParsedConditionsPreview';
import ParseErrorAlert from './ParseErrorAlert';
import ConditionRow from './ConditionRow';

interface QueryBuilderModalProps {
  open: boolean;
  initialConfig?: SearchConfig;
  onClose: () => void;
  onSave: (config: SearchConfig) => void;
}

const createDefaultCondition = (): SearchCondition => ({
  type: 'keyword',
  operator: 'contains',
  value: '',
});

const QueryBuilderModal: React.FC<QueryBuilderModalProps> = ({
  open,
  initialConfig,
  onClose,
  onSave,
}) => {
  // ============================================================================
  // Store & 状态
  // ============================================================================
  const { getAllSupertags, isInitialized, loadFromAPI } = useSupertagStore();

  // 配置状态
  const defaultConfig = useMemo<SearchConfig>(() => {
    return (
      initialConfig || {
        label: '',
        logicalOperator: 'AND',
        conditions: [],
      }
    );
  }, [initialConfig]);

  const [label, setLabel] = useState(defaultConfig.label || '');
  const [logicalOperator, setLogicalOperator] = useState<SearchConfig['logicalOperator']>(
    defaultConfig.logicalOperator
  );
  const [conditions, setConditions] = useState<SearchCondition[]>(defaultConfig.conditions);

  // 自然语言解析状态
  const [parseResult, setParseResult] = useState<NLParseResult | null>(null);
  const [showAdvancedMode, setShowAdvancedMode] = useState(false);

  // ============================================================================
  // 初始化
  // ============================================================================
  useEffect(() => {
    if (open && !isInitialized) {
      loadFromAPI();
    }
  }, [open, isInitialized, loadFromAPI]);

  // 重置状态当弹窗关闭
  useEffect(() => {
    if (!open) {
      setParseResult(null);
      setShowAdvancedMode(false);
    }
  }, [open]);

  // ============================================================================
  // Supertag Schema 转换（用于 AI 上下文）
  // ============================================================================
  const supertagsSchema = useMemo<NLSupertagSchema[]>(() => {
    const allTags = getAllSupertags();
    return allTags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      icon: tag.icon,
      fields: (tag.fieldDefinitions || []).map((f) => ({
        key: f.key,
        name: f.name,
        type: f.type as 'text' | 'number' | 'date' | 'select',
        options: f.options,
      })),
    }));
  }, [getAllSupertags]);

  // ============================================================================
  // 事件处理
  // ============================================================================

  // 处理 AI 解析结果
  const handleParseResult = useCallback((result: NLParseResult) => {
    setParseResult(result);
    if (result.success && result.config) {
      setConditions(result.config.conditions);
      setLogicalOperator(result.config.logicalOperator);
    }
  }, []);

  // 条件变更（高级模式）
  const handleConditionChange = useCallback(
    (index: number, updates: Partial<SearchCondition>) => {
      setConditions((prev) =>
        prev.map((item, i) => (i === index ? { ...item, ...updates } : item))
      );
    },
    []
  );

  // 删除条件
  const handleConditionDelete = useCallback((index: number) => {
    setConditions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // 添加条件（高级模式）
  const handleAddCondition = useCallback(() => {
    setConditions((prev) => [...prev, createDefaultCondition()]);
  }, []);

  // 逻辑操作符变更
  const handleLogicalOperatorChange = useCallback(
    (op: SearchConfig['logicalOperator']) => {
      setLogicalOperator(op);
    },
    []
  );

  // 切换到手动模式
  const handleSwitchToManual = useCallback(() => {
    setShowAdvancedMode(true);
    // 如果当前没有条件，添加一个默认条件
    if (conditions.length === 0) {
      setConditions([createDefaultCondition()]);
    }
  }, [conditions.length]);

  // 重试解析
  const handleRetryParse = useCallback(() => {
    setParseResult(null);
  }, []);

  // 保存配置
  const handleSave = useCallback(() => {
    const validConditions = conditions.filter((c) => {
      const value = c.value;
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      return String(value).trim() !== '';
    });

    onSave({
      label,
      logicalOperator,
      conditions: validConditions,
    });
    onClose();
  }, [conditions, label, logicalOperator, onSave, onClose]);

  // ============================================================================
  // 渲染
  // ============================================================================

  const hasParseError = parseResult && !parseResult.success;
  const hasParseSuccess = parseResult && parseResult.success && parseResult.config;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-3xl border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-teal-50">
        <DialogHeader>
          <DialogTitle className="text-[14px] font-semibold text-slate-800">
            配置搜索节点
          </DialogTitle>
          <DialogDescription>
            使用自然语言描述筛选条件，AI 将自动解析为结构化查询。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 搜索节点名称 */}
          <Input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="搜索节点名称（可选）"
          />

          {/* 自然语言输入区域 */}
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <NaturalLanguageInput
              supertags={supertagsSchema}
              onParseResult={handleParseResult}
              disabled={showAdvancedMode}
            />
          </div>

          {/* 解析错误提示 */}
          {hasParseError && (
            <ParseErrorAlert
              error={parseResult.error || '解析失败'}
              suggestions={parseResult.suggestions}
              onRetry={handleRetryParse}
              onSwitchToManual={handleSwitchToManual}
            />
          )}

          {/* 解析结果预览 */}
          {hasParseSuccess && !showAdvancedMode && (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <ParsedConditionsPreview
                config={{
                  logicalOperator,
                  conditions,
                }}
                explanation={parseResult.explanation}
                warnings={parseResult.warnings}
                confidence={parseResult.confidence}
                onConditionDelete={handleConditionDelete}
                onLogicalOperatorChange={handleLogicalOperatorChange}
                editable
              />
            </div>
          )}

          {/* 高级模式切换 */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvancedMode(!showAdvancedMode)}
              className="gap-1.5 text-slate-600 hover:text-slate-800"
            >
              <Settings2 className="h-4 w-4" />
              <span>高级模式（手动编辑）</span>
              {showAdvancedMode ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* 高级编辑模式 */}
          {showAdvancedMode && (
            <div
              className={cn(
                'rounded-lg border border-slate-200 bg-white p-4',
                'animate-in slide-in-from-top-2 duration-200'
              )}
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xs text-slate-500">组合逻辑</span>
                <select
                  className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm"
                  value={logicalOperator}
                  onChange={(event) =>
                    setLogicalOperator(event.target.value as SearchConfig['logicalOperator'])
                  }
                >
                  <option value="AND">AND</option>
                  <option value="OR">OR</option>
                </select>
                <Button variant="outline" size="sm" onClick={handleAddCondition}>
                  新增条件
                </Button>
              </div>

              <div className="space-y-2">
                {conditions.map((condition, index) => (
                  <ConditionRow
                    key={`${condition.type}-${index}`}
                    condition={condition}
                    index={index}
                    onChange={handleConditionChange}
                    onDelete={handleConditionDelete}
                  />
                ))}

                {conditions.length === 0 && (
                  <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
                    <p className="text-sm text-slate-500">暂无条件，点击"新增条件"添加</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={handleSave}
            disabled={conditions.length === 0}
            className="bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600"
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QueryBuilderModal;
