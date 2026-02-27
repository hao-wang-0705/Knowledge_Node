# v2.1 数据库迁移说明

## 变更内容

- **supertags** 表新增字段：
  - `parent_id` (TEXT, 可空)：父标签 ID，用于继承
  - `template_content` (JSONB, 可空)：默认内容模版（节点树 JSON）

## 执行方式

1. 确保 PostgreSQL 已启动且 `DATABASE_URL` 正确。
2. 在项目根目录（knowledge-node-backend）执行：

```bash
npx prisma migrate deploy
```

若在开发环境且希望保留迁移历史，可使用：

```bash
npx prisma migrate dev
```

3. 迁移文件位于：`migrations/20260212000000_add_supertag_inheritance_and_template/migration.sql`

## 兼容性

- 新字段均为可空，现有数据无需修改即可继续使用。
- 旧版 `fieldDefinitions` 与 `nodes.fields` 结构保持不变；v2.1 仅扩展了 reference 类型与模版能力。
