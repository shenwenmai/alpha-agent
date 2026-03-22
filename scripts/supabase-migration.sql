-- ============================================================
-- RealCost KB 升级迁移 — 添加 tag 字段 + 更新向量搜索函数
-- 在 Supabase SQL Editor 中执行
-- ============================================================

-- 1. 添加 tag 列（如已存在则跳过）
ALTER TABLE kb_chunks ADD COLUMN IF NOT EXISTS tag text DEFAULT 'intervention';

-- 2. 创建索引加速 tag 过滤
CREATE INDEX IF NOT EXISTS idx_kb_chunks_tag ON kb_chunks(tag);

-- 3. 删除旧函数
DROP FUNCTION IF EXISTS match_kb_chunks(vector, int, float);
DROP FUNCTION IF EXISTS match_kb_chunks(vector, int, float, text[]);

-- 4. 创建新函数：支持 tag 过滤
CREATE OR REPLACE FUNCTION match_kb_chunks(
  query_embedding vector(1536),
  match_count int DEFAULT 5,
  match_threshold float DEFAULT 0.3,
  filter_tags text[] DEFAULT NULL
)
RETURNS TABLE (
  id text,
  content text,
  metadata jsonb,
  tag text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    kc.content,
    kc.metadata,
    kc.tag,
    1 - (kc.embedding <=> query_embedding) AS similarity
  FROM kb_chunks kc
  WHERE 1 - (kc.embedding <=> query_embedding) > match_threshold
    AND (filter_tags IS NULL OR kc.tag = ANY(filter_tags))
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
