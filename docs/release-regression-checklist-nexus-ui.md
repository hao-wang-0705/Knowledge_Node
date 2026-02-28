# Nexus UI 升级 - 视觉回归 Checklist

版本：v2.2.0-nexus-ui | 日期：2026-02-28

## 品牌文案

- [ ] 登录页：文案为「登录您的 Nexus 账户」（非 Project Nexus）
- [ ] 注册页：文案为「加入 Nexus，开启知识管理之旅」
- [ ] 首页 Header：标题为「Nexus」
- [ ] 浏览器 Tab：标题为「Nexus - AI-Native 节点式知识操作系统」

## 主色与 Token

- [ ] Header Logo：使用品牌主色渐变（靛蓝调）
- [ ] 今日按钮（日历模式激活）：绿色保持
- [ ] 面包屑链接 hover：品牌主色
- [ ] Auth 表单按钮与 focus ring：品牌主色
- [ ] 下拉菜单/右键菜单：使用 `--shadow-dropdown`，无硬编码阴影

## 暗色模式

- [ ] 品牌主色在暗色背景下对比度合格
- [ ] 各 Token 在 `.dark` 下表现正确
- [ ] 无漏掉的 `dark:` 变体

## 品牌资产

- [ ] Favicon 显示正确
- [ ] 各入口 Logo/图标风格统一

## E2E

- [ ] `basic-flow` 含 Nexus 文案断言并通过（`expect(page.getByText('Nexus')).toBeVisible()`）
- [ ] 其他冒烟用例（api-auth-401、nodes-crud 等）保持通过

## Phase 4 Review 完成项

- [x] `--brand-primary` oklch(0.55 0.2 265) 与白色背景对比度满足 WCAG AA
- [x] 暗色模式 `.dark` 下 `--brand-primary` 为 oklch(0.65 0.2 265)，前景为白色
- [x] `--duration-fast`、`--duration-normal` 已定义于 globals.css
- [x] 各 Token 在亮/暗模式下均通过 CSS 变量正确引用
