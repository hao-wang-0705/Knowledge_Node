-- v3.6: 为 tag_templates 表添加 viewConfig 字段
-- 用于声明式驱动 Pinned 页面渲染

-- AlterTable
ALTER TABLE "tag_templates" ADD COLUMN "viewConfig" JSONB;

-- 为 viewConfig 添加注释
COMMENT ON COLUMN "tag_templates"."viewConfig" IS 'ViewConfig Schema JSON - 声明式视图配置';
