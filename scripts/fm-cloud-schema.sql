-- ============================================================
-- AI 资金管家 — 云端数据库 Schema
-- 在 Supabase SQL Editor 中执行
-- ============================================================

-- 1. fm_sessions — 场次（核心表）
CREATE TABLE IF NOT EXISTS fm_sessions (
  id TEXT PRIMARY KEY,                                -- 客户端生成 fm_session_xxx
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan JSONB NOT NULL DEFAULT '{}'::jsonb,            -- 完整 SessionPlan 对象
  status TEXT NOT NULL DEFAULT 'planning',             -- planning/active/paused/ended
  start_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_time TIMESTAMPTZ,
  note TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  review JSONB,                                        -- 完整 FMReviewReport 对象
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. fm_events — 事件（每手记录）
CREATE TABLE IF NOT EXISTS fm_events (
  id TEXT PRIMARY KEY,                                -- 客户端生成 fm_event_xxx
  session_id TEXT NOT NULL REFERENCES fm_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,                           -- win/loss/bet_change/pause/resume/emotion/rule_change/end
  amount NUMERIC,                                     -- 输赢金额
  bet_unit NUMERIC,                                   -- 码量
  note TEXT,
  raw_input TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. fm_alerts — 告警记录
CREATE TABLE IF NOT EXISTS fm_alerts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES fm_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level TEXT NOT NULL,                                -- early_warning/formal_alert/strong_alert
  rule_key TEXT NOT NULL,
  message TEXT NOT NULL,
  voice_message TEXT,
  dismissed BOOLEAN NOT NULL DEFAULT false,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. fm_templates — 风控方案模板
CREATE TABLE IF NOT EXISTS fm_templates (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  plan JSONB NOT NULL DEFAULT '{}'::jsonb,            -- Partial<SessionPlan>
  is_builtin BOOLEAN NOT NULL DEFAULT false,
  use_count INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  parent_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. fm_template_snapshots — 模板历史快照
CREATE TABLE IF NOT EXISTS fm_template_snapshots (
  id SERIAL PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES fm_templates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  plan JSONB NOT NULL DEFAULT '{}'::jsonb,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(template_id, version)
);

-- 6. fm_settings — 用户设置
CREATE TABLE IF NOT EXISTS fm_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,        -- FMSettings 对象
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. user_profiles — 用户信息
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 索引
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_fm_sessions_user ON fm_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_fm_sessions_status ON fm_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_fm_events_session ON fm_events(session_id);
CREATE INDEX IF NOT EXISTS idx_fm_events_user ON fm_events(user_id);
CREATE INDEX IF NOT EXISTS idx_fm_alerts_session ON fm_alerts(session_id);
CREATE INDEX IF NOT EXISTS idx_fm_templates_user ON fm_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_fm_template_snapshots_template ON fm_template_snapshots(template_id);

-- ============================================================
-- RLS (Row Level Security)
-- 每个用户只能访问自己的数据
-- ============================================================

ALTER TABLE fm_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fm_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE fm_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fm_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE fm_template_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE fm_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- fm_sessions
CREATE POLICY "Users can view own sessions" ON fm_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sessions" ON fm_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions" ON fm_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sessions" ON fm_sessions FOR DELETE USING (auth.uid() = user_id);

-- fm_events
CREATE POLICY "Users can view own events" ON fm_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own events" ON fm_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own events" ON fm_events FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own events" ON fm_events FOR DELETE USING (auth.uid() = user_id);

-- fm_alerts
CREATE POLICY "Users can view own alerts" ON fm_alerts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own alerts" ON fm_alerts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own alerts" ON fm_alerts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own alerts" ON fm_alerts FOR DELETE USING (auth.uid() = user_id);

-- fm_templates
CREATE POLICY "Users can view own templates" ON fm_templates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own templates" ON fm_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own templates" ON fm_templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own templates" ON fm_templates FOR DELETE USING (auth.uid() = user_id);

-- fm_template_snapshots
CREATE POLICY "Users can view own snapshots" ON fm_template_snapshots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own snapshots" ON fm_template_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);

-- fm_settings
CREATE POLICY "Users can view own settings" ON fm_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings" ON fm_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON fm_settings FOR UPDATE USING (auth.uid() = user_id);

-- user_profiles
CREATE POLICY "Users can view own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);

-- ============================================================
-- 自动更新 updated_at 触发器
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_fm_sessions_updated_at
  BEFORE UPDATE ON fm_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_fm_templates_updated_at
  BEFORE UPDATE ON fm_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_fm_settings_updated_at
  BEFORE UPDATE ON fm_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 自动创建 user_profiles（新用户注册时）
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 仅当触发器不存在时创建
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION handle_new_user();
  END IF;
END
$$;
