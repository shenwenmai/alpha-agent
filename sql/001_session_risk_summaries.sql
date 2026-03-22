-- ============================================================
-- 管道5: 风控评估摘要表 — 场次级风控数据闭环
--
-- 用途：
--   1. 干预有效性分析（哪个级别/话术让用户停下）
--   2. 毒药组合验证（是否真的导致更大亏损）
--   3. 锁盈阈值校准（阈值是否合理）
--   4. 模板参数再学习（A/B/C参数优化依据）
--
-- 执行方式：在 Supabase Dashboard → SQL Editor 执行
-- ============================================================

CREATE TABLE IF NOT EXISTS session_risk_summaries (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id    TEXT NOT NULL,
  template_id   TEXT,                          -- 'A' | 'B' | 'C'

  -- 场次结果（用于与风控数据做相关性分析）
  entry_bank    NUMERIC,                       -- 进场资金
  final_pnl     NUMERIC,                       -- 最终盈亏
  total_hands   INT,                           -- 总手数
  elapsed_min   NUMERIC,                       -- 总时长(分钟)

  -- 风控引擎聚合
  max_level     TEXT NOT NULL,                 -- 本场最高干预级别 L0-L4
  intervention_count INT NOT NULL DEFAULT 0,   -- L2+干预触发次数
  max_profit_lock_stage INT NOT NULL DEFAULT 0,-- 最高锁盈阶段 0-5
  toxic_combos  JSONB DEFAULT '[]',            -- 触发过的毒药组合 ['fatigue_pressure']
  key_moments   JSONB DEFAULT '[]',            -- 触发过的关键时刻 ['streak_net_loss','overtime']

  -- 三维概率极值（帮助校准阈值）
  min_survival_prob NUMERIC,                   -- 本场最低生存概率
  max_etp_prob      NUMERIC,                   -- 本场最高情绪崩盘概率
  max_collapse_prob NUMERIC,                   -- 本场最高崩盘路径概率

  -- 干预有效性（从 session_interventions 聚合）
  interventions_complied  INT DEFAULT 0,       -- 用户遵从的干预次数(ended)
  interventions_ignored   INT DEFAULT 0,       -- 用户忽略的干预次数(ignored)
  avg_response_delay_sec  NUMERIC,             -- 平均响应延迟(秒)

  -- 每手风控快照序列（完整时间线，供回放分析）
  hand_snapshots JSONB DEFAULT '[]',           -- [{hand, level, survivalProb, etpProb, collapseProb, profitLockStage}]

  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 索引：按用户+模板查询（分析特定模板效果）
CREATE INDEX IF NOT EXISTS idx_risk_summaries_user_template
  ON session_risk_summaries(user_id, template_id);

-- 索引：按最高级别查询（找出所有L3+场次）
CREATE INDEX IF NOT EXISTS idx_risk_summaries_max_level
  ON session_risk_summaries(max_level);

-- RLS: 用户只能读写自己的数据
ALTER TABLE session_risk_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own risk summaries"
  ON session_risk_summaries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own risk summaries"
  ON session_risk_summaries FOR SELECT
  USING (auth.uid() = user_id);

-- 注释
COMMENT ON TABLE session_risk_summaries IS '场次风控评估摘要 — 管道5输出，用于参数再学习';
COMMENT ON COLUMN session_risk_summaries.hand_snapshots IS '每手风控快照序列，JSON数组，供时间线回放';
COMMENT ON COLUMN session_risk_summaries.toxic_combos IS '本场触发过的毒药组合ID列表';
