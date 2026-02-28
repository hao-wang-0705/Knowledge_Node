# Knowledge Node - 智能知识管理平台

> 将笔记的灵活性与数据库的强大功能相结合

## 🚀 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 复制环境配置
cp .env.example .env.local

# 3. 配置 API Key（可选，用于 AI 指令功能）
# 编辑 .env.local，填入 AI_API_KEY

# 4. 启动开发服务器
npm run dev
```

## ✨ 核心功能

| 功能 | 描述 |
|------|------|
| 超级标签 (Supertag) | 带 Schema 的功能标签，自动展开字段面板 |
| 大纲编辑器 | 无限层级的内容组织，支持拖拽排序 |
| 视图模式 | 每日笔记（日历）/ 笔记本 |
| 指令节点系统 | AI 驱动的自动化知识处理 |
| 引用系统 | 节点间关联引用，反向链接 |

## 📖 开发

```bash
# 开发模式
npm run dev

# 构建生产版本
npm run build

# 启动生产服务器
npm run start

# 类型检查
npm run type-check
```

## 📁 项目结构

```
src/
├── app/                    # Next.js App Router
│   └── api/ai/            # AI API 路由
├── components/            # React 组件
├── services/ai/          # AI 服务模块
├── stores/               # Zustand 状态管理
└── utils/                # 工具函数
```

## 🔧 技术栈

- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript
- **状态管理**: Zustand
- **样式**: Tailwind CSS

---

Built with ❤️ for knowledge workers
