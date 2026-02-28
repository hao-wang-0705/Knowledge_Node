# ADR-004: Nexus Design Token 体系

- 状态: Accepted
- 日期: 2026-02-28
- 决策者: Nexus UI 升级计划（阶段一）

## 背景

前端存在产品名混用（「知识节点」「Project Nexus」）、主色分散（blue/indigo/purple）、硬编码 Hex/box-shadow 等问题。为统一 Nexus 品牌视觉并建立可维护的设计体系，需引入品牌常量和 Design Token。

## 决策

1. **品牌常量**：新增 `src/lib/brand.ts`，统一 `BRAND.name`、`BRAND.tagline`、`BRAND.metaTitle`、`BRAND.metaDescription`，所有产品名与 slogan 从此读取。

2. **Design Token 扩展**（`globals.css`）：
   - `--brand-primary`：Nexus 主色（oklch 靛蓝调性，体现「连接」语义）
   - `--brand-primary-foreground`：主色前景（白色或深色，保证对比度）
   - `--shadow-dropdown`：下拉菜单、右键菜单等阴影
   - `--shadow-modal`：弹层、对话框阴影
   - `--duration-fast`、`--duration-normal`：统一过渡时长

3. **颜色语义约定**：
   - Primary/品牌：Nexus 主色（Logo、主操作、链接）
   - Success/日历：绿色保持（每日笔记、成功态）
   - AI/指令：紫色保持
   - Destructive：红色保持

4. **主色取值**：亮色模式 `oklch(0.55 0.2 265)` 左右，暗色模式对应变体，确保 WCAG AA 对比度。

## 影响

- 组件逐步迁移至 Token，减少硬编码。
- 品牌资产（Favicon、Logo）与 Token 联动。
- Tailwind 通过 `@theme` 扩展 `brand-primary` 等，供 `bg-brand-primary`、`shadow-dropdown` 使用。
