/**
 * 搜索条件工具函数
 * v3.5: 增加条件校验和人类可读格式化函数
 * v3.5.1: 支持标签和字段的中文名称映射
 */

import type { SearchCondition, SearchConfig, ConditionType, ConditionOperator } from '@/types/search';
import type { TagTemplate } from '@/types';

// ============================================================================
// 常量定义
// ============================================================================

/** 支持的条件类型 */
export const VALID_CONDITION_TYPES: ConditionType[] = ['tag', 'field', 'keyword', 'ancestor', 'date'];

/** 支持的操作符 */
export const VALID_OPERATORS: ConditionOperator[] = [
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

/** 操作符中文映射 */
export const OPERATOR_LABELS: Record<string, string> = {
  equals: '等于',
  contains: '包含',
  gt: '大于',
  lt: '小于',
  gte: '大于等于',
  lte: '小于等于',
  is: '是',
  isNot: '不是',
  hasAny: '包含任意',
  hasAll: '包含全部',
  today: '今天',
  withinDays: '天内',
};

/** 条件类型中文映射 */
export const CONDITION_TYPE_LABELS: Record<ConditionType, string> = {
  keyword: '关键词',
  tag: '标签',
  field: '字段',
  date: '时间',
  ancestor: '祖先',
};

// ============================================================================
// 名称解析辅助函数
// ============================================================================

/**
 * 从标签 ID 获取中文显示名称
 */
export function getTagDisplayName(
  tagId: string,
  supertags: Record<string, TagTemplate>
): string {
  const tag = supertags[tagId];
  return tag?.name || tagId;
}

/**
 * 从字段 key 获取中文显示名称
 */
export function getFieldDisplayName(
  fieldKey: string,
  supertags: Record<string, TagTemplate>
): string {
  for (const tag of Object.values(supertags)) {
    const field = tag.fieldDefinitions?.find(f => f.key === fieldKey);
    if (field) {
      return field.name;
    }
  }
  return fieldKey;
}

// ============================================================================
// 条件校验函数
// ============================================================================

/**
 * 校验单个条件是否合法
 */
export function validateCondition(condition: SearchCondition): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // 校验条件类型
  if (!VALID_CONDITION_TYPES.includes(condition.type)) {
    errors.push(`不支持的条件类型: ${condition.type}`);
  }

  // 校验操作符
  if (!VALID_OPERATORS.includes(condition.operator)) {
    errors.push(`不支持的操作符: ${condition.operator}`);
  }

  // 校验值
  const value = condition.value;
  if (value === undefined || value === null) {
    errors.push('条件值不能为空');
  } else if (typeof value === 'string' && value.trim() === '') {
    errors.push('条件值不能为空字符串');
  } else if (Array.isArray(value) && value.length === 0) {
    errors.push('条件值数组不能为空');
  }

  // 字段类型需要 field 属性
  if (condition.type === 'field' && !condition.field) {
    errors.push('字段类型条件必须指定 field 属性');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 校验整个搜索配置
 */
export function validateSearchConfig(config: SearchConfig): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config.conditions || config.conditions.length === 0) {
    warnings.push('搜索配置中没有条件');
  }

  config.conditions.forEach((condition, index) => {
    const result = validateCondition(condition);
    if (!result.valid) {
      result.errors.forEach((err) => {
        errors.push(`条件 ${index + 1}: ${err}`);
      });
    }
  });

  if (!['AND', 'OR'].includes(config.logicalOperator)) {
    errors.push(`不支持的逻辑操作符: ${config.logicalOperator}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// 格式化函数
// ============================================================================

/**
 * 将单个条件格式化为人类可读的文本
 * @param condition 搜索条件
 * @param supertags 可选的标签数据，用于解析中文名称
 */
export function formatCondition(
  condition: SearchCondition,
  supertags?: Record<string, TagTemplate>
): string {
  const negate = condition.negate ? '非' : '';
  const typeLabel = CONDITION_TYPE_LABELS[condition.type] || condition.type;
  const operatorLabel = OPERATOR_LABELS[condition.operator] || condition.operator;
  
  // 格式化值（支持标签 ID 转中文名）
  const formatValue = (value: SearchCondition['value']): string => {
    // 标签类型：尝试解析中文名称
    if (condition.type === 'tag' && supertags) {
      if (Array.isArray(value)) {
        return value.map(v => typeof v === 'string' ? getTagDisplayName(v, supertags) : String(v)).join('、');
      }
      return typeof value === 'string' ? getTagDisplayName(value, supertags) : String(value);
    }
    
    // 其他类型
    if (Array.isArray(value)) {
      return value.join('、');
    }
    if (typeof value === 'boolean') {
      return value ? '是' : '否';
    }
    return String(value);
  };

  const valueStr = formatValue(condition.value);
  
  // 获取字段中文名称
  const getFieldName = (fieldKey: string | undefined): string => {
    if (!fieldKey) return '';
    if (supertags) {
      return getFieldDisplayName(fieldKey, supertags);
    }
    return fieldKey;
  };

  switch (condition.type) {
    case 'keyword':
      return `${negate}文本${operatorLabel}「${valueStr}」`;
    case 'tag':
      return `${negate}标签${operatorLabel}「${valueStr}」`;
    case 'field': {
      const fieldName = getFieldName(condition.field) || '字段';
      return `${negate}${fieldName}${operatorLabel}「${valueStr}」`;
    }
    case 'date': {
      const fieldName = getFieldName(condition.field) || '时间';
      if (condition.operator === 'today') {
        return `${fieldName}是今天`;
      }
      if (condition.operator === 'withinDays') {
        return `${fieldName}在 ${valueStr} 天内`;
      }
      return `${negate}${fieldName}${operatorLabel} ${valueStr}`;
    }
    case 'ancestor':
      return `${negate}祖先节点${operatorLabel}「${valueStr}」`;
    default:
      return `${negate}${typeLabel}${operatorLabel}「${valueStr}」`;
  }
}

/**
 * 将搜索配置格式化为人类可读的摘要
 * @param config 搜索配置
 * @param supertags 可选的标签数据，用于解析中文名称
 */
export function summarizeQuery(
  config?: SearchConfig,
  supertags?: Record<string, TagTemplate>
): string {
  if (!config || config.conditions.length === 0) {
    return '未配置筛选条件';
  }

  const connector = config.logicalOperator === 'AND' ? ' 且 ' : ' 或 ';
  return config.conditions.map(c => formatCondition(c, supertags)).join(connector);
}

/**
 * 生成搜索配置的详细描述（用于 AI 解释）
 * @param config 搜索配置
 * @param supertags 可选的标签数据，用于解析中文名称
 */
export function describeSearchConfig(
  config: SearchConfig,
  supertags?: Record<string, TagTemplate>
): string {
  if (config.conditions.length === 0) {
    return '无筛选条件';
  }

  const connector = config.logicalOperator === 'AND' ? '同时满足' : '满足任一';
  const conditionsDesc = config.conditions
    .map((c, i) => `${i + 1}. ${formatCondition(c, supertags)}`)
    .join('\n');
  
  return `查询条件（${connector}）：\n${conditionsDesc}`;
}

// ============================================================================
// 辅助函数（保留向后兼容）
// ============================================================================

/**
 * 从配置中提取默认值（用于创建继承节点）
 * @deprecated v3.5 已移除内联创建功能，此函数保留仅为向后兼容
 */
export function extractDefaultsFromConfig(config?: SearchConfig): {
  tags: string[];
  fields: Record<string, unknown>;
} {
  if (!config) {
    return { tags: [], fields: {} };
  }

  const tags: string[] = [];
  const fields: Record<string, unknown> = {};

  config.conditions.forEach((condition) => {
    if (condition.negate) {
      return;
    }

    if (condition.type === 'tag') {
      const values = Array.isArray(condition.value) ? condition.value : [condition.value];
      values.forEach((value) => {
        if (typeof value === 'string' && value.trim() && !tags.includes(value)) {
          tags.push(value);
        }
      });
      return;
    }

    if (condition.type === 'field' && condition.field && ['equals', 'is', 'contains'].includes(condition.operator)) {
      fields[condition.field] = condition.value;
    }
  });

  return { tags, fields };
}
