-- ============================================================
-- RealCost 向量知识库 — 在 Supabase SQL Editor 中运行此文件
-- ============================================================

-- 1. 启用 pgvector 扩展
create extension if not exists vector;

-- 2. 创建知识块表
create table if not exists kb_chunks (
  id text primary key,
  content text not null,
  metadata jsonb default '{}',
  embedding vector(1536),
  created_at timestamptz default now()
);

-- 3. 创建向量搜索函数
create or replace function match_kb_chunks (
  query_embedding vector(1536),
  match_count int default 5,
  match_threshold float default 0.3
)
returns table (
  id text,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    kb_chunks.id,
    kb_chunks.content,
    kb_chunks.metadata,
    1 - (kb_chunks.embedding <=> query_embedding) as similarity
  from kb_chunks
  where 1 - (kb_chunks.embedding <=> query_embedding) > match_threshold
  order by kb_chunks.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- 4. 创建向量索引（加速搜索）
create index if not exists kb_chunks_embedding_idx
  on kb_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 10);

-- 5. 禁用 RLS（与其他表保持一致）
alter table kb_chunks enable row level security;
create policy "Allow all for service role" on kb_chunks
  for all using (true) with check (true);
