/**
 * Feature Flags - MVP 版本功能开关配置
 *
 * 通过集中式功能开关管理，控制功能的启用/禁用状态。
 * 这种方式具有以下优势：
 * - 易于恢复：只需修改配置项即可重新启用功能
 * - 集中管理：所有功能开关在一处管理，便于维护
 * - 代码无侵入：原有组件逻辑保持不变，仅在入口处添加条件判断
 */

/**
 * 功能开关配置
 *
 * 设置为 true 启用功能，false 禁用功能
 */
export const FEATURE_FLAGS = {
  /**
   * 语音转写功能
   * - 包括：麦克风录音按钮、语音转写 API 调用
   * - MVP 版本暂时禁用
   * - 注意：图片和文字捕获功能保持启用
   */
  VOICE_TRANSCRIPTION: false,

  /**
   * 搜索节点功能
   * - 包括：斜杠命令、右键菜单、搜索节点查询与渲染
   */
  SEARCH_NODE: true,

  /**
   * 统一输入内核（Lexical）
   * - 包括：NodeComponent 与 QuickInput 的编辑输入层
   * - 开启后使用 UnifiedNodeEditor，关闭后回退原生 contentEditable
   */
  UNIFIED_INPUT_KERNEL: true,
} as const;

/**
 * 功能开关类型
 */
export type FeatureFlag = keyof typeof FEATURE_FLAGS;

/**
 * 检查功能是否启用
 * @param flag - 功能开关名称
 * @returns 功能是否启用
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag];
}

/**
 * 禁用功能的提示信息
 */
export const DISABLED_FEATURE_MESSAGES = {
  VOICE_TRANSCRIPTION: '语音转写功能暂未开放',
  SEARCH_NODE: '搜索节点功能暂未开放',
  UNIFIED_INPUT_KERNEL: '统一输入内核暂未开放',
} as const;

/**
 * 获取禁用功能的提示信息
 * @param flag - 功能开关名称
 * @returns 提示信息
 */
export function getDisabledMessage(flag: FeatureFlag): string {
  return DISABLED_FEATURE_MESSAGES[flag];
}
