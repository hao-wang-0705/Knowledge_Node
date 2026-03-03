# Knowledge Node 系统预置标签新增指南

> 版本: v3.3  
> 更新时间: 2026-03-03  
> 适用对象: 系统管理员、后端开发人员

---

## 📋 目录

1. [概述](#概述)
2. [架构说明](#架构说明)
3. [数据模型](#数据模型)
4. [API 接口](#api-接口)
5. [标签属性详解](#标签属性详解)
6. [字段类型说明](#字段类型说明)
7. [模版内容格式](#模版内容格式)
8. [新增标签操作指南](#新增标签操作指南)
9. [示例标签配置](#示例标签配置)
10. [最佳实践](#最佳实践)
11. [常见问题](#常见问题)

---

## 概述

Knowledge Node v3.3 版本将标签系统重构为**系统预置标签架构**，所有标签均由管理员通过内部 API 创建和管理，用户端为只读模式。

### 核心变更

| 版本 | 架构模式 | 用户权限 |
|------|----------|----------|
| v2.x | 用户自定义标签 | 创建/编辑/删除 |
| v3.3 | 系统预置标签 | **只读** |

### 设计理念

- **一致性**: 所有用户共享统一的标签库，确保数据结构一致
- **质量控制**: 管理员审核标签定义，保证标签质量
- **扩展预留**: 通过 `UserTagLibrary` 表为未来 UGC 模版市场预留扩展能力

---

## 架构说明

### 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户端 (只读)                              │
├─────────────────────────────────────────────────────────────────┤
│  TagLibraryPage  →  TagGalleryGrid  →  TagDetailPanel           │
│       ↓                                                          │
│  useSupertagStore (Zustand, isReadOnly: true)                   │
│       ↓                                                          │
│  GET /api/supertags (只读 API)                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↑
                              │ 数据读取
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    数据库 (PostgreSQL)                           │
│                                                                  │
│   ┌─────────────────┐     ┌─────────────────────────┐           │
│   │  tag_templates  │ ←── │  user_tag_library       │           │
│   │  (系统预置标签)  │     │  (用户订阅映射，预留)    │           │
│   └─────────────────┘     └─────────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
                              ↑
                              │ 数据写入
                              │
┌─────────────────────────────────────────────────────────────────┐
│                      管理端 (写操作)                              │
├─────────────────────────────────────────────────────────────────┤
│  POST /api/internal/tags    (创建标签)                          │
│  GET  /api/internal/tags    (查询所有标签，含非活跃)              │
│                                                                  │
│  认证方式: x-admin-key 请求头                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 数据模型

### Prisma Schema 定义

```prisma
model TagTemplate {
  id               String           @id @default(cuid())
  name             String                                    // 标签名称（必填）
  color            String           @default("#6366F1")      // 标签颜色
  icon             String?                                   // 标签图标 (Emoji)
  description      String?                                   // 标签描述
  fieldDefinitions Json             @default("[]")           // Schema 字段定义
  isGlobalDefault  Boolean          @default(true)           // 系统预置标识
  creatorId        String?                                   // 预留 UGC 创建者 ID
  status           String           @default("active")       // 状态: active/deprecated
  categoryId       String           @default("cat_uncategorized") // 分类 ID
  order            Int              @default(0)              // 排序权重
  parentId         String?                                   // 父标签 ID (继承)
  templateContent  Json?                                     // 默认内容模版
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt

  // 关系
  nodes            Node[]
  parent           TagTemplate?     @relation("TagTemplateInheritance", ...)
  children         TagTemplate[]    @relation("TagTemplateInheritance")
  creator          User?            @relation(...)
  userLibraries    UserTagLibrary[]

  @@index([isGlobalDefault, status])
  @@index([creatorId])
  @@index([parentId])
  @@index([categoryId])
  @@map("tag_templates")
}
```

### TypeScript 类型定义

```typescript
interface TagTemplate {
  id: string;
  name: string;              // 标签名称
  color: string;             // 标签颜色 (HEX)
  icon?: string;             // 标签图标 (Emoji)
  description?: string;      // 标签描述
  fieldDefinitions: FieldDefinition[];  // 字段定义数组
  isGlobalDefault: boolean;  // 是否系统预置 (当前始终为 true)
  creatorId?: string | null; // 创建者 ID (预留)
  status: 'active' | 'deprecated';  // 标签状态
  categoryId: string;        // 分类 ID
  order?: number;            // 排序顺序
  parentId?: string | null;  // 父标签 ID (继承)
  templateContent?: TemplateNode | TemplateNode[] | null;  // 模版内容
  resolvedFieldDefinitions?: FieldDefinition[];  // 合并继承后的字段
  createdAt?: string;
  updatedAt?: string;
}
```

---

## API 接口

### 创建系统预置标签

```http
POST /api/internal/tags
```

#### 请求头

| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `x-admin-key` | string | ✅ | 管理员密钥 |
| `Content-Type` | string | ✅ | `application/json` |

#### 请求体

```typescript
interface CreateTagRequest {
  name: string;              // 必填：标签名称
  color?: string;            // 可选：颜色，默认 "#6366F1"
  icon?: string;             // 可选：图标 (Emoji)
  description?: string;      // 可选：描述
  fieldDefinitions?: FieldDefinition[];  // 可选：字段定义
  isGlobalDefault?: boolean; // 可选：系统预置，默认 true
  status?: string;           // 可选：状态，默认 "active"
  categoryId?: string;       // 可选：分类 ID，默认 "cat_uncategorized"
  order?: number;            // 可选：排序，默认自增
  parentId?: string;         // 可选：父标签 ID
  templateContent?: TemplateNode[];  // 可选：模版内容
  creatorId?: string;        // 可选：创建者 ID
}
```

#### 响应

```json
{
  "success": true,
  "data": {
    "id": "clxxxxx",
    "name": "任务",
    "color": "#EF4444",
    "icon": "☑️",
    "description": "待办任务标签",
    "fieldDefinitions": [...],
    "isGlobalDefault": true,
    "status": "active",
    "categoryId": "cat_function",
    "order": 1,
    "parentId": null,
    "templateContent": null,
    "createdAt": 1709424000000,
    "updatedAt": 1709424000000
  }
}
```

#### 错误响应

| 状态码 | 错误信息 | 说明 |
|--------|----------|------|
| 401 | `Unauthorized: Invalid admin key` | 管理员密钥无效 |
| 400 | `标签名称不能为空` | 缺少必填字段 |
| 400 | `标签名称 "xxx" 已存在` | 名称重复 |
| 400 | `父标签不存在` | 无效的 parentId |

### 查询所有标签（管理员）

```http
GET /api/internal/tags
```

返回所有标签，包括非活跃状态的标签。

---

## 标签属性详解

### 基础属性

| 属性 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `name` | string | ✅ | - | 标签名称，全局唯一 |
| `color` | string | ❌ | `#6366F1` | HEX 颜色值 |
| `icon` | string | ❌ | `null` | Emoji 图标 |
| `description` | string | ❌ | `null` | 标签描述文本 |

### 分类属性

| 属性 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `categoryId` | string | ❌ | `cat_uncategorized` | 所属分类 ID |
| `order` | number | ❌ | 自增 | 分类内排序权重 |

#### 预设分类 ID

```typescript
const PRESET_CATEGORY_IDS = {
  FUNCTION: 'cat_function',       // 功能标签
  WORK: 'cat_work',               // 工作
  LIFE: 'cat_life',               // 生活
  UNCATEGORIZED: 'cat_uncategorized',  // 未分类
};
```

### 状态属性

| 属性 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `isGlobalDefault` | boolean | ❌ | `true` | 系统预置标识 |
| `status` | string | ❌ | `active` | `active` / `deprecated` |
| `creatorId` | string | ❌ | `null` | 创建者 ID（预留 UGC） |

### 继承属性

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `parentId` | string | ❌ | 父标签 ID，用于字段继承 |

---

## 字段类型说明

### FieldDefinition 结构

```typescript
interface FieldDefinition {
  id: string;           // 字段唯一 ID (uuid)
  key: string;          // 字段键名 (英文，如 "due_date")
  name: string;         // 字段显示名称 (中文，如 "截止日期")
  type: FieldType;      // 字段类型
  options?: string[];   // select 类型的选项列表
  targetTagId?: string; // reference 类型的目标标签 ID
  multiple?: boolean;   // reference 是否允许多选
  inherited?: boolean;  // 是否继承自父标签（只读）
  displayConfig?: Record<string, unknown>;  // 显示配置
}

type FieldType = 'text' | 'number' | 'date' | 'select' | 'reference';
```

### 字段类型详解

| 类型 | 说明 | 特殊属性 | 示例 |
|------|------|----------|------|
| `text` | 文本输入 | - | 标题、描述、备注 |
| `number` | 数字输入 | - | 金额、数量、评分 |
| `date` | 日期选择 | - | 截止日期、提醒时间 |
| `select` | 单选下拉 | `options: string[]` | 状态、优先级 |
| `reference` | 节点引用 | `targetTagId`, `multiple` | 关联任务、关联人员 |

### 字段定义示例

```json
[
  {
    "id": "field_1",
    "key": "status",
    "name": "状态",
    "type": "select",
    "options": ["未开始", "进行中", "已完成", "已取消"]
  },
  {
    "id": "field_2",
    "key": "priority",
    "name": "优先级",
    "type": "select",
    "options": ["低", "中", "高", "紧急"]
  },
  {
    "id": "field_3",
    "key": "due_date",
    "name": "截止日期",
    "type": "date"
  },
  {
    "id": "field_4",
    "key": "assigned_to",
    "name": "负责人",
    "type": "reference",
    "targetTagId": "tag_person_id",
    "multiple": false
  }
]
```

---

## 模版内容格式

### TemplateNode 结构

```typescript
interface TemplateNode {
  content: string;           // 节点内容
  children?: TemplateNode[]; // 子节点
}
```

### 特殊语法

| 语法 | 说明 | 示例 |
|------|------|------|
| `[ ]` | 未完成待办 | `[ ] 待办事项` |
| `[x]` | 已完成待办 | `[x] 已完成项` |
| 普通文本 | 普通节点 | `会议议程` |

### 模版示例

```json
[
  {
    "content": "会议信息",
    "children": [
      { "content": "时间: " },
      { "content": "地点: " },
      { "content": "参会人: " }
    ]
  },
  {
    "content": "议程",
    "children": [
      { "content": "[ ] 议题1" },
      { "content": "[ ] 议题2" },
      { "content": "[ ] 议题3" }
    ]
  },
  {
    "content": "待办事项",
    "children": [
      { "content": "[ ] 会后跟进" }
    ]
  }
]
```

---

## 新增标签操作指南

### 步骤 1: 确定标签信息

在创建标签前，需要明确以下信息：

- [ ] 标签名称（全局唯一）
- [ ] 标签图标（推荐 Emoji）
- [ ] 标签颜色（HEX 值）
- [ ] 标签描述
- [ ] 所属分类
- [ ] 是否继承其他标签
- [ ] 字段定义列表
- [ ] 默认模版内容（可选）

### 步骤 2: 准备请求数据

```javascript
const newTag = {
  name: "会议",
  icon: "📅",
  color: "#3B82F6",
  description: "会议记录和议程管理",
  categoryId: "cat_work",
  fieldDefinitions: [
    {
      id: "meeting_time",
      key: "meeting_time",
      name: "会议时间",
      type: "date"
    },
    {
      id: "meeting_location",
      key: "location",
      name: "会议地点",
      type: "text"
    },
    {
      id: "meeting_attendees",
      key: "attendees",
      name: "参会人员",
      type: "text"
    }
  ],
  templateContent: [
    {
      content: "议程",
      children: [
        { content: "[ ] " }
      ]
    },
    {
      content: "会议纪要",
      children: []
    },
    {
      content: "待办事项",
      children: [
        { content: "[ ] " }
      ]
    }
  ]
};
```

### 步骤 3: 发送 API 请求

#### 使用 cURL

```bash
curl -X POST https://your-domain.com/api/internal/tags \
  -H "Content-Type: application/json" \
  -H "x-admin-key: your-admin-secret-key" \
  -d '{
    "name": "会议",
    "icon": "📅",
    "color": "#3B82F6",
    "description": "会议记录和议程管理",
    "categoryId": "cat_work",
    "fieldDefinitions": [
      {"id": "f1", "key": "meeting_time", "name": "会议时间", "type": "date"},
      {"id": "f2", "key": "location", "name": "会议地点", "type": "text"},
      {"id": "f3", "key": "attendees", "name": "参会人员", "type": "text"}
    ],
    "templateContent": [
      {"content": "议程", "children": [{"content": "[ ] "}]},
      {"content": "会议纪要"},
      {"content": "待办事项", "children": [{"content": "[ ] "}]}
    ]
  }'
```

#### 使用 JavaScript (Node.js / 浏览器)

```javascript
const response = await fetch('/api/internal/tags', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-admin-key': process.env.ADMIN_API_KEY
  },
  body: JSON.stringify(newTag)
});

const result = await response.json();
if (result.success) {
  console.log('标签创建成功:', result.data);
} else {
  console.error('创建失败:', result.error);
}
```

### 步骤 4: 验证标签

```bash
# 查询所有标签验证
curl -X GET https://your-domain.com/api/internal/tags \
  -H "x-admin-key: your-admin-secret-key"
```

---

## 示例标签配置

### 功能标签示例

#### 任务标签 (Task)

```json
{
  "name": "任务",
  "icon": "☑️",
  "color": "#EF4444",
  "description": "待办任务和行动项",
  "categoryId": "cat_function",
  "fieldDefinitions": [
    {"id": "status", "key": "status", "name": "状态", "type": "select", "options": ["未开始", "进行中", "已完成", "已取消"]},
    {"id": "priority", "key": "priority", "name": "优先级", "type": "select", "options": ["低", "中", "高", "紧急"]},
    {"id": "due_date", "key": "due_date", "name": "截止日期", "type": "date"},
    {"id": "effort", "key": "effort", "name": "预估工时", "type": "number"}
  ],
  "templateContent": [
    {"content": "[ ] 任务步骤1"},
    {"content": "[ ] 任务步骤2"},
    {"content": "[ ] 任务步骤3"}
  ]
}
```

#### 想法标签 (Idea)

```json
{
  "name": "想法",
  "icon": "💡",
  "color": "#F59E0B",
  "description": "灵感和创意记录",
  "categoryId": "cat_function",
  "fieldDefinitions": [
    {"id": "category", "key": "category", "name": "类别", "type": "select", "options": ["产品", "技术", "运营", "其他"]},
    {"id": "feasibility", "key": "feasibility", "name": "可行性", "type": "select", "options": ["待评估", "可行", "需改进", "不可行"]}
  ],
  "templateContent": [
    {"content": "背景"},
    {"content": "核心想法"},
    {"content": "预期价值"},
    {"content": "下一步行动"}
  ]
}
```

#### 问题标签 (Problem)

```json
{
  "name": "问题",
  "icon": "🔥",
  "color": "#DC2626",
  "description": "问题记录和追踪",
  "categoryId": "cat_function",
  "fieldDefinitions": [
    {"id": "severity", "key": "severity", "name": "严重程度", "type": "select", "options": ["轻微", "一般", "严重", "紧急"]},
    {"id": "status", "key": "status", "name": "状态", "type": "select", "options": ["待处理", "处理中", "已解决", "已关闭"]},
    {"id": "root_cause", "key": "root_cause", "name": "根因分类", "type": "select", "options": ["流程", "技术", "人员", "外部"]}
  ],
  "templateContent": [
    {"content": "问题描述"},
    {"content": "影响范围"},
    {"content": "临时方案"},
    {"content": "根本解决方案"},
    {"content": "[ ] 后续行动"}
  ]
}
```

### 工作标签示例

#### 项目标签 (Project)

```json
{
  "name": "项目",
  "icon": "📊",
  "color": "#8B5CF6",
  "description": "项目管理和追踪",
  "categoryId": "cat_work",
  "fieldDefinitions": [
    {"id": "status", "key": "status", "name": "项目状态", "type": "select", "options": ["规划中", "进行中", "暂停", "已完成", "已取消"]},
    {"id": "start_date", "key": "start_date", "name": "开始日期", "type": "date"},
    {"id": "end_date", "key": "end_date", "name": "结束日期", "type": "date"},
    {"id": "owner", "key": "owner", "name": "负责人", "type": "text"}
  ],
  "templateContent": [
    {"content": "项目目标"},
    {"content": "关键里程碑", "children": [{"content": "[ ] 里程碑1"}, {"content": "[ ] 里程碑2"}]},
    {"content": "风险与问题"},
    {"content": "相关资源"}
  ]
}
```

### 生活标签示例

#### 书籍标签 (Book)

```json
{
  "name": "书籍",
  "icon": "📚",
  "color": "#10B981",
  "description": "阅读记录和书评",
  "categoryId": "cat_life",
  "fieldDefinitions": [
    {"id": "author", "key": "author", "name": "作者", "type": "text"},
    {"id": "status", "key": "status", "name": "阅读状态", "type": "select", "options": ["想读", "在读", "已读", "弃读"]},
    {"id": "rating", "key": "rating", "name": "评分", "type": "select", "options": ["⭐", "⭐⭐", "⭐⭐⭐", "⭐⭐⭐⭐", "⭐⭐⭐⭐⭐"]},
    {"id": "read_date", "key": "read_date", "name": "阅读日期", "type": "date"}
  ],
  "templateContent": [
    {"content": "核心观点"},
    {"content": "精彩摘录"},
    {"content": "个人感悟"},
    {"content": "行动启发"}
  ]
}
```

---

## 最佳实践

### 命名规范

1. **标签名称**: 使用简洁的名词，2-4 个字为宜
2. **字段 key**: 使用小写英文 + 下划线（snake_case）
3. **字段 name**: 使用中文显示名称，清晰表达字段含义

### 颜色选择建议

| 类别 | 推荐颜色 | HEX 值 |
|------|----------|--------|
| 功能类 | 红色系 | `#EF4444`, `#DC2626` |
| 工作类 | 蓝色系 | `#3B82F6`, `#2563EB` |
| 生活类 | 绿色系 | `#10B981`, `#059669` |
| 创意类 | 黄色系 | `#F59E0B`, `#D97706` |
| 通用类 | 紫色系 | `#8B5CF6`, `#7C3AED` |

### 图标选择建议

- 选择与标签含义直接相关的 Emoji
- 优先使用通用性强的图标
- 避免使用过于复杂或不常见的 Emoji

### 字段设计原则

1. **必要性**: 只添加真正需要的字段
2. **简洁性**: 字段数量控制在 3-6 个
3. **一致性**: 相似标签使用相似的字段结构
4. **可扩展**: 为 select 类型预留足够的选项

### 继承使用场景

- 当多个标签共享相同的基础字段时使用继承
- 子标签可以覆盖父标签的字段定义
- 避免过深的继承层级（建议不超过 2 层）

---

## 常见问题

### Q1: 如何修改已创建的标签？

目前系统不提供标签修改 API。如需修改，请：

1. 直接操作数据库（需要数据库权限）
2. 将原标签状态设为 `deprecated`，创建新标签

### Q2: 如何删除标签？

系统不建议物理删除标签，推荐：

```sql
-- 将标签设为废弃状态
UPDATE tag_templates SET status = 'deprecated' WHERE id = 'xxx';
```

### Q3: 用户看不到新创建的标签？

检查以下条件：
- `isGlobalDefault` 是否为 `true`
- `status` 是否为 `active`
- 用户是否已刷新页面

### Q4: 字段继承不生效？

确保：
- `parentId` 指向的标签确实存在
- 父标签的 `status` 为 `active`
- API 返回中包含 `resolvedFieldDefinitions`

### Q5: 模版内容格式错误？

常见问题：
- JSON 格式不正确
- `children` 属性需要是数组
- `content` 不能为空字符串

### Q6: 如何批量导入标签？

可以编写脚本循环调用 POST API：

```javascript
const tags = [...]; // 标签配置数组

for (const tag of tags) {
  await fetch('/api/internal/tags', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': process.env.ADMIN_API_KEY
    },
    body: JSON.stringify(tag)
  });
}
```

---

## 附录

### A. 环境变量配置

```env
# 管理员 API 密钥
ADMIN_API_KEY=your-secure-admin-key-here
```

### B. 预设标签 ID 推荐

| 标签类型 | 推荐 ID 前缀 | 示例 |
|----------|-------------|------|
| 功能标签 | `tag_` | `tag_task`, `tag_idea` |
| 工作标签 | `tag_work_` | `tag_work_meeting` |
| 生活标签 | `tag_life_` | `tag_life_book` |

### C. 相关文件路径

```
knowledge-node-nextjs/
├── src/
│   ├── app/api/
│   │   ├── supertags/           # 用户只读 API
│   │   │   ├── route.ts         # GET /api/supertags
│   │   │   └── [id]/route.ts    # GET /api/supertags/:id
│   │   └── internal/
│   │       └── tags/route.ts    # 管理员 API
│   ├── components/tag-library/  # 标签库组件
│   ├── stores/supertagStore.ts  # 状态管理
│   └── types/index.ts           # 类型定义
└── prisma/
    └── schema.prisma            # 数据模型
```

---

> 文档版本: 1.0.0  
> 最后更新: 2026-03-03  
> 维护者: Knowledge Node Team
