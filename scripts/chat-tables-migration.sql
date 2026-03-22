-- ============================================================
-- RealCost 对话采集表 — 在 Supabase SQL Editor 中运行
-- ============================================================

-- 1. chat_turns: 存储每轮对话 (用户消息 + AI 回复)
CREATE TABLE IF NOT EXISTS chat_turns (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id text NOT NULL,
  user_message text NOT NULL,
  ai_response text NOT NULL,
  mode text DEFAULT 'b',
  analyzed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_turns_session ON chat_turns(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_turns_analyzed ON chat_turns(analyzed);
CREATE INDEX IF NOT EXISTS idx_chat_turns_created ON chat_turns(created_at);

-- 2. extracted_events: 存储提取事件 (财务/崩溃/情绪)
CREATE TABLE IF NOT EXISTS extracted_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id text NOT NULL,
  event_type text,
  event_data jsonb,
  confidence float,
  status text,
  source_message_id text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_extracted_events_session ON extracted_events(session_id);

-- 3. profile_snapshots: 用户画像快照
CREATE TABLE IF NOT EXISTS profile_snapshots (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id text NOT NULL,
  profile jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_snapshots_session ON profile_snapshots(session_id);

-- 4. RLS (与 kb_chunks 保持一致)
ALTER TABLE chat_turns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_all_chat_turns" ON chat_turns FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE extracted_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_all_extracted_events" ON extracted_events FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE profile_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_all_profile_snapshots" ON profile_snapshots FOR ALL USING (true) WITH CHECK (true);

-- 5. user_feedback: 用户对 AI 回复的反馈 (👍/👎)
CREATE TABLE IF NOT EXISTS user_feedback (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id text NOT NULL,
  message_id text NOT NULL,
  rating smallint NOT NULL,          -- 1=👍, -1=👎
  mode text DEFAULT 'b',
  ai_response_preview text,          -- 前100字，用于分析
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_feedback_session ON user_feedback(session_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_rating ON user_feedback(rating);

ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_all_user_feedback" ON user_feedback FOR ALL USING (true) WITH CHECK (true);

-- 6. rag_retrieval_logs: RAG 检索日志
CREATE TABLE IF NOT EXISTS rag_retrieval_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id text NOT NULL,
  query_preview text,                -- 用户消息前80字
  mode text DEFAULT 'b',
  chunks_returned jsonb,             -- [{id, similarity, tag}]
  chunk_count int DEFAULT 0,
  avg_similarity float,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rag_logs_created ON rag_retrieval_logs(created_at);

ALTER TABLE rag_retrieval_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_all_rag_logs" ON rag_retrieval_logs FOR ALL USING (true) WITH CHECK (true);
