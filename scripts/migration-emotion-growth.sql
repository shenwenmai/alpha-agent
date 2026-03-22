-- ============================================================
-- 情绪数据持久化 + 成长画像存储
-- Sprint 1 迁移脚本
-- 在 Supabase SQL Editor 中执行
-- ============================================================

-- 表1: emotion_snapshots — 情绪快照（每场关键时刻记录）
CREATE TABLE emotion_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  session_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  level TEXT NOT NULL CHECK (level IN ('calm', 'mild', 'moderate', 'severe')),
  signals JSONB NOT NULL DEFAULT '[]',
  intervention TEXT,
  event_index INTEGER,
  metrics_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_emotion_snapshots_user ON emotion_snapshots(user_id);
CREATE INDEX idx_emotion_snapshots_session ON emotion_snapshots(session_id);
CREATE INDEX idx_emotion_snapshots_level ON emotion_snapshots(level);

ALTER TABLE emotion_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY emotion_snapshots_user_policy ON emotion_snapshots
  FOR ALL USING (auth.uid() = user_id);

-- 表2: turning_points — 情绪转折点
CREATE TABLE turning_points (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  session_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  event_index INTEGER NOT NULL,
  from_level TEXT NOT NULL,
  to_level TEXT NOT NULL,
  trigger_event JSONB NOT NULL,
  trigger_signals TEXT[] NOT NULL DEFAULT '{}',
  description TEXT NOT NULL,
  elapsed_minutes REAL NOT NULL,
  context JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_turning_points_user ON turning_points(user_id);
CREATE INDEX idx_turning_points_session ON turning_points(session_id);

ALTER TABLE turning_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY turning_points_user_policy ON turning_points
  FOR ALL USING (auth.uid() = user_id);

-- 表3: growth_profiles — 成长画像（定期聚合）
CREATE TABLE growth_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) UNIQUE,
  total_sessions INTEGER NOT NULL DEFAULT 0,
  total_hands INTEGER NOT NULL DEFAULT 0,
  avg_discipline_score REAL,
  discipline_trend TEXT CHECK (discipline_trend IN ('improving', 'declining', 'stable')),
  optimal_base_unit JSONB,
  danger_zones JSONB,
  common_errors JSONB,
  turning_point_summary JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_growth_profiles_user ON growth_profiles(user_id);

ALTER TABLE growth_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY growth_profiles_user_policy ON growth_profiles
  FOR ALL USING (auth.uid() = user_id);
