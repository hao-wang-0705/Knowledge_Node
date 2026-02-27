/**
 * 统一标签样式工具模块
 * 
 * 确保自定义标签与系统预制标签保持一致的视觉体验
 * - 为所有标签提供图标支持
 * - 统一渐变样式
 * - 基于标签颜色动态生成样式
 */

import { Supertag } from '@/types';

// ============================================================================
// 预设标签样式映射（系统内置标签）
// ============================================================================

export interface TagStyle {
  gradient: string;      // Tailwind 渐变类名
  text: string;          // Tailwind 文字颜色类名
  icon: string;          // 图标 emoji
  bgColor: string;       // CSS 背景色（用于动态生成）
  textColor: string;     // CSS 文字色（用于动态生成）
}

// 预设标签的完整样式定义
const PRESET_TAG_STYLES: Record<string, TagStyle> = {
  'tag_task': { 
    gradient: 'bg-gradient-to-r from-red-100 to-red-200', 
    text: 'text-red-700', 
    icon: '☑️',
    bgColor: '#FEE2E2',
    textColor: '#B91C1C'
  },
  'tag_meeting': { 
    gradient: 'bg-gradient-to-r from-blue-100 to-blue-200', 
    text: 'text-blue-700', 
    icon: '📅',
    bgColor: '#DBEAFE',
    textColor: '#1D4ED8'
  },
  'tag_issue': { 
    gradient: 'bg-gradient-to-r from-orange-100 to-orange-200', 
    text: 'text-orange-700', 
    icon: '🐛',
    bgColor: '#FFEDD5',
    textColor: '#C2410C'
  },
  'tag_problem': { 
    gradient: 'bg-gradient-to-r from-rose-100 to-rose-200', 
    text: 'text-rose-700', 
    icon: '🔥',
    bgColor: '#FFE4E6',
    textColor: '#BE123C'
  },
  'tag_idea': { 
    gradient: 'bg-gradient-to-r from-green-100 to-green-200', 
    text: 'text-green-700', 
    icon: '💡',
    bgColor: '#DCFCE7',
    textColor: '#15803D'
  },
  'tag_doc': { 
    gradient: 'bg-gradient-to-r from-slate-100 to-slate-200', 
    text: 'text-slate-700', 
    icon: '📄',
    bgColor: '#F1F5F9',
    textColor: '#334155'
  },
  'tag_movie': { 
    gradient: 'bg-gradient-to-r from-pink-100 to-pink-200', 
    text: 'text-pink-700', 
    icon: '🎬',
    bgColor: '#FCE7F3',
    textColor: '#BE185D'
  },
  'tag_game': { 
    gradient: 'bg-gradient-to-r from-purple-100 to-purple-200', 
    text: 'text-purple-700', 
    icon: '🎮',
    bgColor: '#F3E8FF',
    textColor: '#7E22CE'
  },
  'tag_tool': { 
    gradient: 'bg-gradient-to-r from-cyan-100 to-cyan-200', 
    text: 'text-cyan-700', 
    icon: '🔧',
    bgColor: '#CFFAFE',
    textColor: '#0E7490'
  },
  'tag_food': { 
    gradient: 'bg-gradient-to-r from-yellow-100 to-yellow-200', 
    text: 'text-yellow-700', 
    icon: '🍽️',
    bgColor: '#FEF9C3',
    textColor: '#A16207'
  },
  'tag_travel': { 
    gradient: 'bg-gradient-to-r from-teal-100 to-teal-200', 
    text: 'text-teal-700', 
    icon: '✈️',
    bgColor: '#CCFBF1',
    textColor: '#0F766E'
  },
  'tag_expense': { 
    gradient: 'bg-gradient-to-r from-violet-100 to-violet-200', 
    text: 'text-violet-700', 
    icon: '💰',
    bgColor: '#EDE9FE',
    textColor: '#6D28D9'
  },
};

// ============================================================================
// 默认图标列表（用于自定义标签的图标推荐）
// ============================================================================

export const DEFAULT_TAG_ICONS = [
  '📌', '📝', '📋', '✨', '⭐', '🎯', '🏷️', '📎',
  '💫', '🔔', '💬', '📣', '🎨', '🎭', '🎪', '🎲',
  '🏆', '🥇', '🎖️', '🏅', '📚', '📖', '📕', '📗',
  '📘', '📙', '🔖', '🗂️', '📁', '📂', '🗃️', '📰',
  '🗞️', '💼', '🛠️', '⚙️', '🔩', '🧰', '🧲', '🔬',
  '🔭', '💊', '🩺', '🧪', '🧫', '🧬', '💉', '🩹',
];

// ============================================================================
// 颜色处理工具函数
// ============================================================================

/**
 * 将 HEX 颜色转换为 RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * 判断颜色是否为浅色
 */
function isLightColor(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return true;
  // 使用亮度公式
  const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return brightness > 128;
}

/**
 * 获取颜色的浅色变体（用于背景）
 */
function getLightVariant(hex: string, opacity: number = 0.15): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return `${hex}26`; // 15% opacity fallback
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
}

/**
 * 获取颜色的深色变体（用于文字）
 */
function getDarkVariant(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  // 将颜色加深 30%
  const darken = (value: number) => Math.max(0, Math.floor(value * 0.7));
  const r = darken(rgb.r).toString(16).padStart(2, '0');
  const g = darken(rgb.g).toString(16).padStart(2, '0');
  const b = darken(rgb.b).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

// ============================================================================
// 核心样式获取函数
// ============================================================================

/**
 * 获取标签的统一样式
 * 
 * @param tag - Supertag 对象
 * @returns TagStyle 完整样式对象
 * 
 * 优先级：
 * 1. 预设标签使用 PRESET_TAG_STYLES 中的样式
 * 2. 自定义标签基于 tag.color 动态生成样式
 * 3. 图标优先使用 tag.icon，否则使用默认 📌
 */
export function getTagStyle(tag: Supertag | null | undefined): TagStyle {
  if (!tag) {
    return getDefaultTagStyle();
  }
  
  // 1. 检查是否为预设标签
  if (PRESET_TAG_STYLES[tag.id]) {
    const preset = PRESET_TAG_STYLES[tag.id];
    // 如果标签有自定义图标，使用自定义图标
    return {
      ...preset,
      icon: tag.icon || preset.icon,
    };
  }
  
  // 2. 自定义标签：基于颜色动态生成样式
  return generateTagStyleFromColor(tag.color, tag.icon);
}

/**
 * 通过标签 ID 和 supertags 映射获取样式
 */
export function getTagStyleById(
  tagId: string, 
  supertags: Record<string, Supertag>
): TagStyle {
  const tag = supertags[tagId];
  return getTagStyle(tag);
}

/**
 * 获取默认标签样式（用于回退）
 */
export function getDefaultTagStyle(): TagStyle {
  return {
    gradient: 'bg-gradient-to-r from-gray-100 to-gray-200',
    text: 'text-gray-700',
    icon: '#',  // 没有图标时显示 # 符号
    bgColor: '#F3F4F6',
    textColor: '#374151',
  };
}

/**
 * 基于颜色动态生成标签样式
 */
export function generateTagStyleFromColor(color: string, icon?: string): TagStyle {
  // 根据颜色映射到最接近的 Tailwind 颜色
  const tailwindColor = mapToTailwindColor(color);
  
  return {
    gradient: `bg-gradient-to-r ${tailwindColor.fromClass} ${tailwindColor.toClass}`,
    text: tailwindColor.textClass,
    icon: icon || '#',  // 没有图标时显示 # 符号
    bgColor: getLightVariant(color, 0.2),
    textColor: getDarkVariant(color),
  };
}

// ============================================================================
// Tailwind 颜色映射
// ============================================================================

interface TailwindColorMapping {
  fromClass: string;
  toClass: string;
  textClass: string;
}

// 颜色到 Tailwind 类的映射
const COLOR_MAPPINGS: { range: [number, number, number]; mapping: TailwindColorMapping }[] = [
  // 红色系
  { range: [0, 20, 340], mapping: { fromClass: 'from-red-100', toClass: 'to-red-200', textClass: 'text-red-700' }},
  // 橙色系
  { range: [20, 45, 0], mapping: { fromClass: 'from-orange-100', toClass: 'to-orange-200', textClass: 'text-orange-700' }},
  // 黄色系
  { range: [45, 65, 0], mapping: { fromClass: 'from-yellow-100', toClass: 'to-yellow-200', textClass: 'text-yellow-700' }},
  // 绿色系
  { range: [65, 170, 0], mapping: { fromClass: 'from-green-100', toClass: 'to-green-200', textClass: 'text-green-700' }},
  // 青色系
  { range: [170, 200, 0], mapping: { fromClass: 'from-cyan-100', toClass: 'to-cyan-200', textClass: 'text-cyan-700' }},
  // 蓝色系
  { range: [200, 260, 0], mapping: { fromClass: 'from-blue-100', toClass: 'to-blue-200', textClass: 'text-blue-700' }},
  // 紫色系
  { range: [260, 290, 0], mapping: { fromClass: 'from-purple-100', toClass: 'to-purple-200', textClass: 'text-purple-700' }},
  // 粉色系
  { range: [290, 340, 0], mapping: { fromClass: 'from-pink-100', toClass: 'to-pink-200', textClass: 'text-pink-700' }},
];

/**
 * 将 HEX 颜色映射到最接近的 Tailwind 颜色类
 */
function mapToTailwindColor(hex: string): TailwindColorMapping {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return { fromClass: 'from-gray-100', toClass: 'to-gray-200', textClass: 'text-gray-700' };
  }
  
  // 计算色相
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  
  let hue = 0;
  if (delta !== 0) {
    if (max === r) {
      hue = ((g - b) / delta) % 6;
    } else if (max === g) {
      hue = (b - r) / delta + 2;
    } else {
      hue = (r - g) / delta + 4;
    }
    hue = Math.round(hue * 60);
    if (hue < 0) hue += 360;
  }
  
  // 检查饱和度 - 如果太低则返回灰色
  const saturation = max === 0 ? 0 : delta / max;
  if (saturation < 0.1) {
    return { fromClass: 'from-gray-100', toClass: 'to-gray-200', textClass: 'text-gray-700' };
  }
  
  // 根据色相匹配最接近的颜色
  for (const { range, mapping } of COLOR_MAPPINGS) {
    const [start, end, wrap] = range;
    if (wrap > 0) {
      // 红色需要处理色相环的首尾
      if (hue >= start || hue < wrap) {
        return mapping;
      }
    } else if (hue >= start && hue < end) {
      return mapping;
    }
  }
  
  return { fromClass: 'from-gray-100', toClass: 'to-gray-200', textClass: 'text-gray-700' };
}

// ============================================================================
// 快捷样式生成函数（用于内联样式）
// ============================================================================

/**
 * 获取标签的内联样式对象（用于 style 属性）
 */
export function getTagInlineStyle(tag: Supertag | null | undefined): React.CSSProperties {
  const style = getTagStyle(tag);
  return {
    backgroundColor: style.bgColor,
    color: style.textColor,
  };
}

/**
 * 获取标签徽章的 CSS 类名
 */
export function getTagBadgeClasses(tag: Supertag | null | undefined): string {
  const style = getTagStyle(tag);
  return `${style.gradient} ${style.text}`;
}

// ============================================================================
// 图标相关工具函数
// ============================================================================

/**
 * 获取标签图标
 * 优先级：tag.icon > PRESET 图标 > 默认 # 符号
 */
export function getTagIcon(tag: Supertag | null | undefined): string {
  if (!tag) return '#';
  if (tag.icon) return tag.icon;
  if (PRESET_TAG_STYLES[tag.id]) return PRESET_TAG_STYLES[tag.id].icon;
  return '#';  // 自定义标签没有设置图标时显示 # 符号
}

/**
 * 获取推荐的标签图标列表
 */
export function getRecommendedIcons(): string[] {
  return DEFAULT_TAG_ICONS;
}

/**
 * 检查标签是否有自定义图标
 */
export function hasCustomIcon(tag: Supertag | null | undefined): boolean {
  if (!tag) return false;
  return Boolean(tag.icon);
}
