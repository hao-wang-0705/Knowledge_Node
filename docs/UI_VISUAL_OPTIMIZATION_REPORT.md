# Nexus 知识管理平台 UI 视觉优化报告

> 版本：1.0 | 日期：2026-03-09 | 作者：UI 设计专家

---

## 1. 执行摘要

### 1.1 分析背景

对 Nexus 知识管理平台进行了全面的视觉体验审计，覆盖 Design Token 系统、组件一致性、交互反馈、动画系统和无障碍支持等维度。

### 1.2 核心发现

| 维度 | 现状评分 | 主要问题 |
|------|---------|---------|
| Design Token | ⭐⭐⭐⭐ | OKLCH 色彩空间优秀，缺少间距 Token |
| 视觉层级 | ⭐⭐⭐⭐ | 层级清晰，部分组件样式未统一 |
| 交互反馈 | ⭐⭐⭐ | **超级标签无入场动画**，折叠无过渡 |
| 动画系统 | ⭐⭐⭐⭐ | 基础动画完善，缺少高级特效 |
| 无障碍 | ⭐⭐⭐ | 焦点样式到位，对比度需优化 |

### 1.3 高优先级建议

1. **P0 - 超级标签动画**：为节点应用超级标签添加入场动画、光晕呼吸、边框流光效果
2. **P1 - 节点折叠动画**：使用 Framer Motion 实现平滑的高度过渡
3. **P2 - 深色模式优化**：修复硬编码颜色，增强暗色对比度

---

## 2. 现状分析

### 2.1 Design Token 系统

#### ✅ 优势

**色彩系统**
- 采用现代 **OKLCH 色彩空间**，色彩感知一致性优秀
- 品牌色 hue=265（紫色调）贯穿整个系统
- 完整的功能色渐变系统（success/warning/error/info）
- 亮色/暗色模式变量完整

```css
/* 品牌色定义 - globals.css */
--brand-primary: oklch(0.55 0.2 265);
--brand-gradient: linear-gradient(135deg, oklch(0.55 0.2 265) 0%, oklch(0.45 0.2 280) 100%);
```

**阴影层级系统**
- 4 级阴影层级（elevation-1 到 elevation-4）
- 品牌阴影变体（shadow-brand、shadow-brand-lg）
- 下拉/弹窗专用阴影（shadow-dropdown、shadow-modal）

**动画时长变量化**
```css
--duration-instant: 100ms;
--duration-fast: 150ms;
--duration-normal: 200ms;
--duration-slow: 300ms;
--duration-enter: 400ms;
--duration-exit: 200ms;
```

**缓动函数**
```css
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
--ease-in-out-expo: cubic-bezier(0.87, 0, 0.13, 1);
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
```

#### ⚠️ 待优化

| 问题 | 影响 | 建议 |
|-----|------|-----|
| 缺少间距 Token | 样式碎片化 | 定义 `--space-{1-12}` 系列 |
| 圆角使用不统一 | 视觉一致性差 | 规范 radius 使用场景 |
| 字体权重无语义命名 | 可维护性差 | 添加 `--font-weight-{normal,medium,semibold,bold}` |

---

### 2.2 视觉层级分析

```
┌─────────────────────────────────────────────────────────────────┐
│ TopNavigation (z-30)                                            │
│   毛玻璃效果 bg-white/80 backdrop-blur-md                        │
├───────────────┬─────────────────────────────────────────────────┤
│ Sidebar       │ MainContentWrapper                              │
│ z-20          │                                                 │
│               │ ┌─────────────────────────────────────────────┐ │
│ • 导航项      │ │ OutlineEditor                               │ │
│ • 笔记本列表  │ │   • NodeComponent (核心)                    │ │
│ • 固定标签    │ │   • CaptureBar (底部悬浮)                   │ │
│               │ └─────────────────────────────────────────────┘ │
│               │                                                 │
│               │ ┌─────────────────────────────────────────────┐ │
│               │ │ QueryPanel (智能查询)                       │ │
│               │ └─────────────────────────────────────────────┘ │
└───────────────┴─────────────────────────────────────────────────┘
```

**已实现的视觉规范**：
- `.nexus-card` 统一卡片样式
- `.icon-container` 图标容器变体（solid/gradient/glass/success/warning/error/info）
- `.sidebar-nav-item` 导航项样式
- `.context-menu` 右键菜单样式

---

### 2.3 交互反馈

#### 当前实现状态

| 交互场景 | 实现状态 | 详情 |
|---------|---------|------|
| 按钮悬停 | ✅ 完善 | hover:shadow-md, hover:scale-105 |
| 输入聚焦 | ✅ 完善 | focus:ring 效果 |
| 卡片悬停 | ✅ 完善 | translateY(-2px) + 阴影提升 |
| 标签悬停 | ⚠️ 基础 | 仅有 hover:scale-105 |
| **超级标签入场** | ❌ **缺失** | **无任何动画反馈** |
| 节点折叠/展开 | ❌ 缺失 | 无高度过渡动画 |

#### 🔴 重点问题：超级标签动画缺失

**当前实现**（`NodeContent.tsx`）：
```tsx
<span
  className={cn(
    'inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full',
    'shadow-sm transition-all duration-200',
    'hover:shadow-md hover:scale-105',  // 仅有悬停效果
    typeStyle.gradient,
    typeStyle.text
  )}
>
```

**问题**：
1. 节点应用超级标签时**无任何入场动画**
2. 标签使用静态渐变背景，缺乏动态感
3. 无法通过视觉效果区分"普通标签"与"超级标签"的特殊性
4. 用户操作后缺乏即时反馈，体验割裂

---

### 2.4 动画系统

#### 已实现的动画

```css
/* globals.css 中已定义的动画 */
@keyframes capture-bar-enter    /* 快速捕获栏入场 */
@keyframes preview-bubble-enter /* 预览气泡入场 */
@keyframes node-fly-in          /* 节点飞入 */
@keyframes pulse-ring           /* 脉冲环 */
@keyframes shimmer              /* 微光扫过 */
@keyframes fade-in-up           /* 淡入上移 */
@keyframes fade-in-scale        /* 淡入缩放 */
@keyframes glow-breathe         /* 光晕呼吸 */
@keyframes float                /* 浮动 */
@keyframes skeleton-pulse       /* 骨架屏 */
@keyframes sparkle              /* 闪烁旋转 */
```

**工具类**：
- `.animate-fade-in-up`
- `.animate-fade-in-scale`
- `.animate-pulse-soft`
- `.animate-glow-breathe`
- `.animate-float`
- `.animate-skeleton`
- `.animation-delay-{75,100,150,200,300,400,500}`

#### 待补充的动画

| 场景 | 建议动画 | 优先级 |
|-----|---------|-------|
| 超级标签入场 | spring 弹入 + 光晕脉动 | **P0** |
| 超级标签边框 | 渐变流光动画 | **P0** |
| 节点折叠 | Framer Motion 高度过渡 | P1 |
| 列表 stagger | 级联延迟入场 | P2 |

---

### 2.5 无障碍支持

#### 已实现

- `.focus-glow` 焦点光晕效果
- `aria-label` 和 `title` 属性
- 键盘导航支持（Tab、Enter、Escape）

#### 待改进

| 问题 | 影响 | 建议 |
|-----|-----|-----|
| 部分渐变背景对比度不足 | WCAG AA 不达标 | 增强前景色对比度 |
| 动画无 reduce-motion 支持 | 前庭敏感用户体验差 | 添加 `prefers-reduced-motion` 媒体查询 |
| 暗色模式某些标签颜色过浅 | 可读性下降 | 暗色模式单独调色 |

---

## 3. 优化建议

### 3.1 P0 高优先级 — 超级标签动画（重点）

#### 3.1.1 设计目标

1. **视觉差异化**：通过动画和特效，让超级标签一眼就能区分于普通标签
2. **操作反馈**：用户应用标签时获得即时的视觉满足感
3. **品牌强化**：通过"能量感"动效强化 Nexus 的"知识赋能"定位

#### 3.1.2 动画方案设计

**效果 1：Spring 弹入动画**
```css
@keyframes supertag-spring-in {
  0% {
    opacity: 0;
    transform: scale(0.3) translateY(-8px);
  }
  50% {
    transform: scale(1.08) translateY(0);
  }
  70% {
    transform: scale(0.95);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.animate-supertag-in {
  animation: supertag-spring-in 0.5s var(--ease-spring) both;
}
```

**效果 2：光晕呼吸**
```css
@keyframes supertag-glow {
  0%, 100% {
    box-shadow: 
      0 0 0 0 var(--tag-glow-color, oklch(0.55 0.2 265 / 0.4)),
      0 2px 8px var(--tag-glow-color, oklch(0.55 0.2 265 / 0.15));
  }
  50% {
    box-shadow: 
      0 0 12px 3px var(--tag-glow-color, oklch(0.55 0.2 265 / 0.3)),
      0 2px 12px var(--tag-glow-color, oklch(0.55 0.2 265 / 0.25));
  }
}

.animate-supertag-glow {
  animation: supertag-glow 2.5s ease-in-out infinite;
}
```

**效果 3：边框流光**
```css
@keyframes border-flow {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

.supertag-border-flow {
  position: relative;
}

.supertag-border-flow::before {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: inherit;
  padding: 2px;
  background: linear-gradient(
    90deg,
    oklch(0.55 0.2 265 / 0.8),
    oklch(0.65 0.18 280 / 0.8),
    oklch(0.60 0.22 250 / 0.8),
    oklch(0.55 0.2 265 / 0.8)
  );
  background-size: 300% 100%;
  animation: border-flow 3s linear infinite;
  -webkit-mask: 
    linear-gradient(#fff 0 0) content-box, 
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}
```

**效果 4：图标微动**
```css
@keyframes icon-wiggle {
  0%, 100% {
    transform: rotate(0deg) scale(1);
  }
  25% {
    transform: rotate(-8deg) scale(1.1);
  }
  75% {
    transform: rotate(8deg) scale(1.1);
  }
}

.animate-icon-wiggle {
  animation: icon-wiggle 0.6s var(--ease-spring);
}
```

#### 3.1.3 组件实现方案

**新建 `SupertagBadge.tsx` 组件**：

```tsx
'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { getTagStyle } from '@/utils/tag-styles';
import type { Supertag } from '@/types';

interface SupertagBadgeProps {
  tag: Supertag;
  isNew?: boolean;  // 是否为新添加的标签
  onRemove?: () => void;
  className?: string;
}

export function SupertagBadge({ 
  tag, 
  isNew = false, 
  onRemove,
  className 
}: SupertagBadgeProps) {
  const [shouldAnimate, setShouldAnimate] = useState(isNew);
  const [showGlow, setShowGlow] = useState(false);
  const typeStyle = getTagStyle(tag);
  
  useEffect(() => {
    if (isNew) {
      // 入场动画完成后开启光晕呼吸
      const timer = setTimeout(() => {
        setShouldAnimate(false);
        setShowGlow(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isNew]);

  return (
    <div className="group/tag relative inline-flex items-center">
      <span
        className={cn(
          // 基础样式
          'inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full',
          'cursor-default select-none',
          // 阴影与过渡
          'shadow-sm transition-all duration-200',
          'hover:shadow-md hover:scale-105',
          // 颜色
          typeStyle.gradient,
          typeStyle.text,
          // 边框流光效果
          'supertag-border-flow',
          // 入场动画
          shouldAnimate && 'animate-supertag-in',
          // 光晕呼吸（入场动画结束后）
          showGlow && 'animate-supertag-glow',
          className
        )}
        style={{
          '--tag-glow-color': typeStyle.bgColor,
        } as React.CSSProperties}
      >
        {/* 图标 - 入场时有微动 */}
        <span 
          className={cn(
            'text-sm transition-transform',
            shouldAnimate && 'animate-icon-wiggle'
          )}
        >
          {typeStyle.icon}
        </span>
        {/* 名称 */}
        <span>{tag.name}</span>
      </span>
      
      {/* 删除按钮 */}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className={cn(
            'absolute -right-1 -top-1 w-4 h-4',
            'flex items-center justify-center rounded-full',
            'bg-gray-500 hover:bg-red-500 text-white',
            'opacity-0 group-hover/tag:opacity-100',
            'transition-all shadow-sm'
          )}
          title={`移除 #${tag.name}`}
        >
          <X size={10} />
        </button>
      )}
    </div>
  );
}
```

**在 `NodeContent.tsx` 中集成**：

```tsx
// 替换原有的标签渲染
{typeTags.map((tag, index) => (
  <SupertagBadge
    key={tag.id}
    tag={tag}
    isNew={newlyAddedTagIds.includes(tag.id)}
    onRemove={() => onRemoveTag(tag.id)}
    className={cn(
      // stagger 延迟入场
      `animation-delay-${index * 75}`
    )}
  />
))}
```

---

### 3.2 P1 中优先级

#### 3.2.1 节点折叠动画

使用 Framer Motion 实现平滑的高度过渡：

```tsx
import { motion, AnimatePresence } from 'framer-motion';

// 在 NodeComponent 中
<AnimatePresence>
  {!node.isCollapsed && node.childrenIds.length > 0 && (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ 
        duration: 0.2, 
        ease: [0.16, 1, 0.3, 1] // ease-out-expo
      }}
      className="overflow-hidden"
    >
      {node.childrenIds.map(childId => (
        <NodeComponent key={childId} nodeId={childId} depth={depth + 1} />
      ))}
    </motion.div>
  )}
</AnimatePresence>
```

#### 3.2.2 标签悬停增强

```css
/* 标签悬停 - 增加 Y 轴位移 */
.tag-badge:hover {
  transform: translateY(-2px) scale(1.05);
  box-shadow: var(--shadow-elevation-2);
}

/* 过渡效果 */
.tag-badge {
  transition: 
    transform 150ms var(--ease-out-expo),
    box-shadow 150ms var(--ease-out-expo);
}
```

#### 3.2.3 按钮按压反馈

```css
.btn-press:active {
  transform: scale(0.98);
  box-shadow: var(--shadow-elevation-1);
}
```

---

### 3.3 P2 低优先级

#### 3.3.1 间距 Token 系统

```css
:root {
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-5: 1.25rem;   /* 20px */
  --space-6: 1.5rem;    /* 24px */
  --space-8: 2rem;      /* 32px */
  --space-10: 2.5rem;   /* 40px */
  --space-12: 3rem;     /* 48px */
}
```

#### 3.3.2 字体权重 Token

```css
:root {
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
}
```

#### 3.3.3 Reduce Motion 支持

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 4. 实施指南

### 4.1 超级标签动画组件（重点）

#### Step 1: 添加 CSS 动画

在 `globals.css` 中添加：

```css
/* ============================================
 * 超级标签动画系统
 * ============================================ */

/* 1. Spring 弹入动画 */
@keyframes supertag-spring-in {
  0% {
    opacity: 0;
    transform: scale(0.3) translateY(-8px);
  }
  50% {
    transform: scale(1.08) translateY(0);
  }
  70% {
    transform: scale(0.95);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.animate-supertag-in {
  animation: supertag-spring-in 0.5s var(--ease-spring) both;
}

/* 2. 光晕呼吸动画 */
@keyframes supertag-glow {
  0%, 100% {
    box-shadow: 
      0 0 0 0 var(--tag-glow-color, oklch(0.55 0.2 265 / 0.4)),
      0 2px 8px var(--tag-glow-color, oklch(0.55 0.2 265 / 0.15));
  }
  50% {
    box-shadow: 
      0 0 12px 3px var(--tag-glow-color, oklch(0.55 0.2 265 / 0.3)),
      0 2px 12px var(--tag-glow-color, oklch(0.55 0.2 265 / 0.25));
  }
}

.animate-supertag-glow {
  animation: supertag-glow 2.5s ease-in-out infinite;
}

/* 3. 边框流光动画 */
@keyframes supertag-border-flow {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

.supertag-border-glow {
  position: relative;
}

.supertag-border-glow::before {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: inherit;
  padding: 2px;
  background: linear-gradient(
    90deg,
    oklch(0.55 0.2 265 / 0.6),
    oklch(0.65 0.18 280 / 0.6),
    oklch(0.60 0.22 250 / 0.6),
    oklch(0.55 0.2 265 / 0.6)
  );
  background-size: 300% 100%;
  animation: supertag-border-flow 3s linear infinite;
  -webkit-mask: 
    linear-gradient(#fff 0 0) content-box, 
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.supertag-border-glow:hover::before {
  opacity: 1;
}

/* 4. 图标微动动画 */
@keyframes supertag-icon-wiggle {
  0%, 100% {
    transform: rotate(0deg) scale(1);
  }
  25% {
    transform: rotate(-8deg) scale(1.1);
  }
  75% {
    transform: rotate(8deg) scale(1.1);
  }
}

.animate-supertag-icon {
  animation: supertag-icon-wiggle 0.6s var(--ease-spring);
}
```

#### Step 2: 创建 SupertagBadge 组件

创建文件 `src/components/ui/supertag-badge.tsx`：

```tsx
'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTagStyle } from '@/utils/tag-styles';
import type { Supertag } from '@/types';

export interface SupertagBadgeProps {
  tag: Supertag;
  /** 是否为新添加的标签，触发入场动画 */
  isNew?: boolean;
  /** 移除标签回调 */
  onRemove?: () => void;
  /** 自定义类名 */
  className?: string;
  /** 是否显示边框流光效果 */
  showBorderGlow?: boolean;
}

export function SupertagBadge({
  tag,
  isNew = false,
  onRemove,
  className,
  showBorderGlow = true,
}: SupertagBadgeProps) {
  const [shouldAnimate, setShouldAnimate] = useState(isNew);
  const [showGlow, setShowGlow] = useState(false);
  const typeStyle = getTagStyle(tag);

  useEffect(() => {
    if (isNew) {
      // 入场动画完成后开启光晕呼吸
      const timer = setTimeout(() => {
        setShouldAnimate(false);
        setShowGlow(true);
        
        // 光晕呼吸持续 5 秒后停止，避免持续消耗性能
        setTimeout(() => setShowGlow(false), 5000);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isNew]);

  return (
    <div className="group/tag relative inline-flex items-center">
      <span
        className={cn(
          // 基础样式
          'inline-flex items-center gap-1 px-2.5 py-0.5',
          'text-xs font-medium rounded-full',
          'cursor-default select-none',
          // 阴影与过渡
          'shadow-sm transition-all duration-200',
          'hover:shadow-md hover:scale-105 hover:-translate-y-0.5',
          // 颜色
          typeStyle.gradient,
          typeStyle.text,
          // 边框流光效果
          showBorderGlow && 'supertag-border-glow',
          // 入场动画
          shouldAnimate && 'animate-supertag-in',
          // 光晕呼吸（入场动画结束后）
          showGlow && 'animate-supertag-glow',
          className
        )}
        style={{
          '--tag-glow-color': typeStyle.bgColor,
        } as React.CSSProperties}
      >
        {/* 图标 - 入场时有微动 */}
        <span
          className={cn(
            'text-sm transition-transform',
            shouldAnimate && 'animate-supertag-icon'
          )}
        >
          {typeStyle.icon}
        </span>
        {/* 名称 */}
        <span>{tag.name}</span>
      </span>

      {/* 删除按钮 */}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className={cn(
            'absolute -right-1 -top-1 w-4 h-4',
            'flex items-center justify-center rounded-full',
            'bg-gray-500 hover:bg-red-500 text-white',
            'opacity-0 group-hover/tag:opacity-100',
            'transition-all duration-150 shadow-sm',
            'focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-red-400'
          )}
          title={`移除 #${tag.name}`}
          aria-label={`移除标签 ${tag.name}`}
        >
          <X size={10} />
        </button>
      )}
    </div>
  );
}
```

#### Step 3: 在 NodeContent 中集成

修改 `src/components/node/NodeContent.tsx`：

```tsx
// 导入组件
import { SupertagBadge } from '@/components/ui/supertag-badge';

// 替换原有的标签渲染逻辑
{typeTags.length > 0 && (
  <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
    {typeTags.map((tag, index) => (
      <SupertagBadge
        key={tag.id}
        tag={tag}
        isNew={newlyAddedTagIds?.includes(tag.id)}
        onRemove={() => onRemoveTag(tag.id)}
        className={`animation-delay-${Math.min(index * 75, 500)}`}
      />
    ))}
  </div>
)}
```

---

### 4.2 节点组件优化

#### 折叠动画

```tsx
// 安装 Framer Motion
// npm install framer-motion

import { motion, AnimatePresence } from 'framer-motion';

// 在子节点渲染处
<AnimatePresence initial={false}>
  {!isCollapsed && childrenIds.length > 0 && (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{
        height: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
        opacity: { duration: 0.15 }
      }}
      className="overflow-hidden"
    >
      {childrenIds.map(childId => (
        <NodeComponent key={childId} nodeId={childId} depth={depth + 1} />
      ))}
    </motion.div>
  )}
</AnimatePresence>
```

---

### 4.3 侧边栏优化

#### 导航项激活指示器

```tsx
// 在激活的导航项中添加左侧指示条
<div className="relative">
  {isActive && (
    <motion.div
      layoutId="sidebar-indicator"
      className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-brand-primary rounded-r-full"
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
    />
  )}
  <NavItem ... />
</div>
```

---

### 4.4 捕获栏优化

捕获栏已有较好的入场动画（`animate-capture-bar-enter`），可增加：

```css
/* 捕获栏聚焦时的光晕效果 */
.capture-bar:focus-within {
  box-shadow: 
    var(--shadow-elevation-2),
    0 0 0 2px oklch(0.55 0.2 265 / 0.2);
}

/* 发送按钮悬停微光 */
.capture-bar-send:hover {
  box-shadow: var(--shadow-brand);
}
```

---

### 4.5 空状态优化

`EmptyState` 组件已实现良好，可增加：

```tsx
// 空状态插图动画
<IconContainer
  variant="gradient"
  className="animate-float"  // 使用浮动动画
>
  {icon}
</IconContainer>
```

---

## 5. 验收标准

### 5.1 超级标签动画（P0）

| 检查项 | 验收标准 |
|-------|---------|
| 入场动画 | 新添加的标签应从 0.3 倍缩放弹入到正常大小 |
| 动画时长 | 入场动画 500ms，使用 spring 缓动 |
| 光晕呼吸 | 入场后 5 秒内持续呼吸效果 |
| 边框流光 | 悬停时显示流动的渐变边框 |
| 图标微动 | 入场时图标有轻微摇晃 |
| 性能 | 动画 FPS ≥ 60，无明显卡顿 |

### 5.2 节点折叠（P1）

| 检查项 | 验收标准 |
|-------|---------|
| 展开动画 | 高度从 0 过渡到 auto，透明度 0→1 |
| 折叠动画 | 高度从当前值过渡到 0，透明度 1→0 |
| 动画时长 | 200ms，使用 ease-out-expo 缓动 |

### 5.3 通用标准

| 检查项 | 验收标准 |
|-------|---------|
| Reduce Motion | 在系统开启减少动画时，所有动画应被禁用 |
| 深色模式 | 动画效果在深色模式下正常显示 |
| 无障碍 | 动画不影响键盘导航和屏幕阅读器 |

---

## 附录

### A. 文件变更清单

| 文件路径 | 变更类型 |
|---------|---------|
| `src/app/globals.css` | 新增超级标签动画 keyframes |
| `src/components/ui/supertag-badge.tsx` | 新增组件 |
| `src/components/node/NodeContent.tsx` | 修改标签渲染逻辑 |

### B. 依赖项

- `framer-motion` (推荐用于节点折叠动画)

### C. 参考资源

- [OKLCH 色彩空间](https://oklch.com/)
- [Framer Motion 文档](https://www.framer.com/motion/)
- [WCAG 2.1 对比度标准](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
