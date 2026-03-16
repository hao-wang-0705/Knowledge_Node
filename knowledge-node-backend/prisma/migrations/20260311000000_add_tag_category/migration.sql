-- v4.2: 实体+行动双轨超级标签 - 为 tag_templates 添加 category 字段
-- category: 'entity' | 'action'

-- AlterTable
ALTER TABLE "tag_templates" ADD COLUMN IF NOT EXISTS "category" VARCHAR;

COMMENT ON COLUMN "tag_templates"."category" IS 'entity=实体标签 / action=行动标签';
