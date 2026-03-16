-- 为 network_edges 增加 MENTION 关系类型
ALTER TYPE "EdgeType" ADD VALUE IF NOT EXISTS 'MENTION';
