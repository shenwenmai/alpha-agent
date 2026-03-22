-- ============================================================
-- 用户记忆系统 (User Memory System) — Supabase Migration
--
-- 支持：单场风控、情绪转折点、长期画像、复盘、个性化提醒
-- 共 8 张核心表，用户主键对接 auth.users(id)
-- 所有表启用 RLS，用户只能读写自己的数据
-- ============================================================

-- ========================================
-- 0. updated_at 自动更新 trigger 函数
-- ========================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 1. user_profiles — 用户长期画像
-- ========================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  risk_style text,                          -- 保守/平衡/激进/易追损/易回吐
  play_style text,                          -- 短打/久打/固定基码/跳码型
  preferred_base_bet_min numeric(12,2),
  preferred_base_bet_max numeric(12,2),
  common_tilt_trigger jsonb DEFAULT '[]',
  common_rule_break jsonb DEFAULT '[]',
  strongest_risk_pattern jsonb DEFAULT '{}',
  best_lockprofit_pattern jsonb DEFAULT '{}',
  stoploss_execution_rate numeric(5,2),
  lockprofit_execution_rate numeric(5,2),
  rule_change_rate numeric(5,2),
  overtime_rate numeric(5,2),
  helper_mode_effective boolean DEFAULT false,
  avg_discipline_score numeric(5,2),
  avg_turning_point_hand numeric(6,2),
  growth_trend text,                        -- improving/flat/deteriorating
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_profiles_select_own" ON public.user_profiles
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "user_profiles_insert_own" ON public.user_profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_profiles_update_own" ON public.user_profiles
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "user_profiles_delete_own" ON public.user_profiles
  FOR DELETE USING (user_id = auth.uid());

CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ========================================
-- 2. session_plans — 本场计划
-- ========================================
CREATE TABLE IF NOT EXISTS public.session_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'planned',   -- planned/active/ended/cancelled
  total_bankroll numeric(12,2),
  session_budget numeric(12,2),
  base_bet numeric(12,2),
  max_bet numeric(12,2),
  stoploss_amount numeric(12,2),
  stoploss_streak int,
  stoploss_net_hands int,
  takeprofit_amount numeric(12,2),
  lockprofit_trigger numeric(12,2),
  lockprofit_floor numeric(12,2),
  max_duration_minutes int,
  allow_raise_bet boolean DEFAULT false,
  input_mode text,                          -- form/text/voice/guided
  helper_mode_enabled boolean DEFAULT false,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_session_plans_user_status ON public.session_plans(user_id, status);
CREATE INDEX idx_session_plans_user_created ON public.session_plans(user_id, created_at);

ALTER TABLE public.session_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_plans_select_own" ON public.session_plans
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "session_plans_insert_own" ON public.session_plans
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "session_plans_update_own" ON public.session_plans
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "session_plans_delete_own" ON public.session_plans
  FOR DELETE USING (user_id = auth.uid());

CREATE TRIGGER session_plans_updated_at
  BEFORE UPDATE ON public.session_plans
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ========================================
-- 3. session_events — 场次原始事件
-- ========================================
CREATE TABLE IF NOT EXISTS public.session_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.session_plans(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  event_type text NOT NULL,                 -- win/loss/bet_change/pause/resume/emotion/rule_change/helper_action
  amount numeric(12,2),
  bet_size numeric(12,2),
  raw_input text,
  parsed_payload jsonb,
  hand_index int,
  event_time timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_session_events_session_time ON public.session_events(session_id, event_time);
CREATE INDEX idx_session_events_session_hand ON public.session_events(session_id, hand_index);
CREATE INDEX idx_session_events_user_time ON public.session_events(user_id, event_time);

ALTER TABLE public.session_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_events_select_own" ON public.session_events
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "session_events_insert_own" ON public.session_events
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "session_events_update_own" ON public.session_events
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "session_events_delete_own" ON public.session_events
  FOR DELETE USING (user_id = auth.uid());

-- ========================================
-- 4. session_metrics_snapshots — 场次指标快照
-- ========================================
CREATE TABLE IF NOT EXISTS public.session_metrics_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.session_plans(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  hand_index int,
  net_pnl numeric(12,2),
  current_balance numeric(12,2),
  total_hands int,
  win_hands int,
  loss_hands int,
  win_streak int,
  loss_streak int,
  net_loss_hands int,
  peak_profit numeric(12,2),
  deepest_loss numeric(12,2),
  drawdown_from_peak numeric(12,2),
  elapsed_minutes int,
  tilt_score int DEFAULT 0,
  tilt_level text,                          -- calm/mild/moderate/severe
  event_trigger text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_metrics_snapshots_session_created ON public.session_metrics_snapshots(session_id, created_at);
CREATE INDEX idx_metrics_snapshots_session_hand ON public.session_metrics_snapshots(session_id, hand_index);

ALTER TABLE public.session_metrics_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_metrics_snapshots_select_own" ON public.session_metrics_snapshots
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "session_metrics_snapshots_insert_own" ON public.session_metrics_snapshots
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "session_metrics_snapshots_update_own" ON public.session_metrics_snapshots
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "session_metrics_snapshots_delete_own" ON public.session_metrics_snapshots
  FOR DELETE USING (user_id = auth.uid());

-- ========================================
-- 5. session_turning_points — 情绪转折点（核心特色表）
-- ========================================
CREATE TABLE IF NOT EXISTS public.session_turning_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.session_plans(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  turning_point_hand int,
  turning_point_time timestamptz NOT NULL,
  etp_score int NOT NULL,
  turning_level text,                       -- mild/clear/strong
  tilt_score_at_trigger int,
  jump_score int,
  deviation_score int,
  stack_score int,
  turning_reasons jsonb DEFAULT '[]',
  first_break_rule text,
  is_confirmed boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_turning_points_session_time ON public.session_turning_points(session_id, turning_point_time);
CREATE INDEX idx_turning_points_user_time ON public.session_turning_points(user_id, turning_point_time);

ALTER TABLE public.session_turning_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_turning_points_select_own" ON public.session_turning_points
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "session_turning_points_insert_own" ON public.session_turning_points
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "session_turning_points_update_own" ON public.session_turning_points
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "session_turning_points_delete_own" ON public.session_turning_points
  FOR DELETE USING (user_id = auth.uid());

-- ========================================
-- 6. session_interventions — 干预记录
-- ========================================
CREATE TABLE IF NOT EXISTS public.session_interventions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.session_plans(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  trigger_type text,                        -- tilt/turning_point/stoploss/drawdown/overtime
  trigger_level text,                       -- mild/moderate/severe
  trigger_reason jsonb,
  ui_mode text,                             -- toast/modal/fullscreen
  message_text text NOT NULL,
  message_pool_key text,
  user_action text,                         -- ignored/continue/open_rules/end_session/helper_mode
  action_delay_seconds int,
  effective_result text,                    -- calmed/ignored/escalated/ended
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_interventions_session_created ON public.session_interventions(session_id, created_at);
CREATE INDEX idx_interventions_user_created ON public.session_interventions(user_id, created_at);

ALTER TABLE public.session_interventions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_interventions_select_own" ON public.session_interventions
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "session_interventions_insert_own" ON public.session_interventions
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "session_interventions_update_own" ON public.session_interventions
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "session_interventions_delete_own" ON public.session_interventions
  FOR DELETE USING (user_id = auth.uid());

-- ========================================
-- 7. session_reviews — 单场复盘
-- ========================================
CREATE TABLE IF NOT EXISTS public.session_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.session_plans(id) UNIQUE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  final_pnl numeric(12,2),
  peak_profit numeric(12,2),
  deepest_loss numeric(12,2),
  profit_giveback numeric(12,2),
  discipline_score int,
  execution_score int,
  calm_score int,
  quality_rating text,                      -- excellent/good/risky/out_of_control
  turning_point_count int DEFAULT 0,
  major_turning_point_hand int,
  major_turning_reason jsonb,
  rule_break_count int DEFAULT 0,
  helper_mode_used boolean DEFAULT false,
  helper_mode_effective boolean DEFAULT false,
  summary_text text,
  ai_review_text text,
  improvement_suggestions jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.session_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_reviews_select_own" ON public.session_reviews
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "session_reviews_insert_own" ON public.session_reviews
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "session_reviews_update_own" ON public.session_reviews
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "session_reviews_delete_own" ON public.session_reviews
  FOR DELETE USING (user_id = auth.uid());

-- ========================================
-- 8. user_pattern_stats — 用户模式统计
-- ========================================
CREATE TABLE IF NOT EXISTS public.user_pattern_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) UNIQUE,
  total_sessions int DEFAULT 0,
  total_hands int DEFAULT 0,
  avg_session_pnl numeric(12,2),
  avg_peak_profit numeric(12,2),
  avg_profit_giveback numeric(12,2),
  avg_discipline_score numeric(5,2),
  avg_turning_point_hand numeric(6,2),
  most_common_turning_trigger text,
  most_common_rule_break text,
  most_common_risk_window text,
  stoploss_execution_rate numeric(5,2),
  lockprofit_execution_rate numeric(5,2),
  helper_accept_rate numeric(5,2),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_pattern_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_pattern_stats_select_own" ON public.user_pattern_stats
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "user_pattern_stats_insert_own" ON public.user_pattern_stats
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_pattern_stats_update_own" ON public.user_pattern_stats
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "user_pattern_stats_delete_own" ON public.user_pattern_stats
  FOR DELETE USING (user_id = auth.uid());

CREATE TRIGGER user_pattern_stats_updated_at
  BEFORE UPDATE ON public.user_pattern_stats
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
