// ============================================================
// AI 资金管家 / 风控管家 — 类型定义
// ============================================================

// ---------- 枚举与联合类型 ----------

export type ReminderMode = 'popup' | 'voice' | 'vibration' | 'silent';
export type SessionStatus = 'planning' | 'active' | 'paused' | 'ended';
export type PlanInputMethod = 'form' | 'text' | 'voice' | 'screen_voice' | 'ai_qa' | 'template';

export type FMEventType =
  | 'win'
  | 'loss'
  | 'bet_change'
  | 'pause'
  | 'resume'
  | 'emotion'
  | 'rule_change'
  | 'note'
  | 'self_check'
  | 'end';

// ---------- 自检系统 ----------

/** 自检模式 */
export type SelfCheckMode = 'pre_entry' | 'live';

/** 自检触发方式 */
export type SelfCheckTrigger = 'manual' | 'system' | 'timer';

/** 单条自检信号 */
export interface DangerSignal {
  id: string;
  category: string;
  text: string;
}

/** 自检结果（记录到 FMEvent.self_check_result） */
export interface SelfCheckResult {
  mode: SelfCheckMode;
  trigger: SelfCheckTrigger;
  checked_ids: string[];
  risk_level: 'safe' | 'caution' | 'warning' | 'danger';
  timestamp: string;
}

/** 自检日志（Supabase self_check_logs 表） */
export interface SelfCheckLog {
  id: string;
  user_id: string;
  session_id: string;
  mode: SelfCheckMode;
  trigger: SelfCheckTrigger;
  checked_ids: string[];
  risk_level: 'safe' | 'caution' | 'warning' | 'danger';
  session_hand_count: number;        // 当时第几手（live模式，pre_entry为0）
  session_pnl: number;               // 当时净输赢
  session_elapsed_min: number;       // 已打多久（分钟）
  action_taken: 'continue' | 'pause' | 'end_session'; // 用户选择
  created_at: string;
}

/** 单个信号的长期统计 */
export interface SignalStat {
  signal_id: string;
  signal_text: string;
  check_count: number;               // 被勾选次数
  check_rate: number;                 // 被勾选率 (0-1)
  avg_pnl_when_checked: number;       // 勾选时场次平均输赢
  loss_rate_when_checked: number;     // 勾选时场次亏损概率 (0-1)
}

/** 跨场次自检分析（长期画像） */
export interface SelfCheckAnalysis {
  total_sessions: number;             // 总场次数
  total_checks: number;               // 总自检次数（含进场前+即时）
  pre_entry_count: number;            // 进场前自检次数
  live_count: number;                 // 即时自检次数
  avg_checks_per_session: number;     // 平均每场自检次数
  compliance_rate: number;            // 遵从率：danger/warning时停下的比例 (0-1)
  top_signals: SignalStat[];          // 高频信号排行（Top 5-10）
  risk_distribution: Record<string, number>; // 风险等级分布 { safe: 12, caution: 8, ... }
  trend: 'improving' | 'stable' | 'declining'; // 近期趋势
  insights: string[];                 // AI 生成的洞察文本列表
}

export type AlertLevel = 'early_warning' | 'formal_alert' | 'strong_alert';

// ---------- 自定义风控规则 ----------

/** 预设条件类型（可基于 FMMetrics 计算） */
export type CustomRuleCondition =
  | 'win_streak_gte'        // 连赢 >= X手
  | 'loss_streak_gte'       // 连输 >= X手
  | 'total_hands_gte'       // 总手数 >= X手
  | 'drawdown_amount_gte'   // 回撤金额 >= X元
  | 'drawdown_pct_gte'      // 回撤百分比 >= X%
  | 'win_rate_below'        // 胜率 < X%
  | 'single_bet_gte'        // 单手码量 >= X元
  | 'net_loss_hands_gte'    // 净输手数 >= X手
  | 'net_win_hands_gte'     // 净赢手数 >= X手
  | 'pnl_loss_gte'          // 净亏损 >= X元
  | 'pnl_profit_gte'        // 净盈利 >= X元
  | 'custom_text';          // 用户自由描述（AI 解析）

export interface CustomRule {
  id: string;                          // 'cr_1709812345_a3b2'
  condition: CustomRuleCondition;
  threshold: number;                   // 阈值
  level: AlertLevel;                   // 告警级别
  label: string;                       // 人可读描述 '连赢5手提醒'
  raw_input?: string;                  // 原始用户输入
}

// ---------- 风控方案 ----------

export interface SessionPlan {
  // 身份
  session_id: string;
  created_at: string;              // ISO
  input_method: PlanInputMethod;

  // 资金
  total_bankroll: number;          // 总资金
  session_budget: number;          // 本场预算
  base_unit: number;               // 基码
  currency: string;                // 'CNY' | 'USD' | 'HKD' | 'MOP'

  // 止损
  stop_loss_amount: number;        // 最大亏损金额
  stop_loss_pct: number;           // 最大亏损比例 (0-100)
  stop_loss_streak: number;        // 连输手数止损
  stop_loss_streak_warn: number;   // 连输提醒手数
  stop_loss_net_hands: number;     // 净输手数止损

  // 时间
  max_duration_minutes: number;    // 最长时间

  // 止盈
  take_profit_amount: number;      // 盈利目标金额
  take_profit_pct: number;         // 盈利目标比例 (0-100)
  lock_profit_trigger: number;     // 锁盈触发金额
  lock_profit_floor: number;       // 最低保留盈利
  take_profit_action: 'suggest' | 'strong_suggest' | 'notify_only';

  // 纪律
  allow_raise_bet: boolean;        // 是否允许加码
  max_bet_unit: number;            // 最大码量
  allow_raise_in_profit: boolean;  // 盈利区可否调整码量
  forbid_raise_in_loss: boolean;   // 亏损区禁止加码
  idle_reminder: boolean;          // 长时间未记录提醒

  // 提醒
  reminder_mode: ReminderMode[];   // 支持多选

  // 自定义规则
  custom_rules?: CustomRule[];     // 用户自定义风控规则

  // 原始输入
  raw_input?: string;              // 原始文字/语音文本

  // 模板来源
  template_id?: string;            // 使用的模板 ID（A/B/C/D/E）

  // 专属战约（AI 问诊定策生成）
  template_name?: string;          // 用户自命名，如「龙王战约」
  player_profile?: string;         // 玩家画像: revenge_trader | profit_giver_back | hot_hand | bored_bettor

  // Sprint 2: 个性化场景触发阈值
  custom_scene_thresholds?: {
    loss_streak_alert: number;     // 追损型: 3，连输X手触发高危
    profit_lock_pct: number;       // 回吐型: 50，盈利回吐X%触发锁盈警告
    win_streak_alert: number;      // 上头型: 3，连赢X手触发减码提醒
    grind_hands_alert: number;     // 无聊型: 15，累计X手且净盈亏<5%触发缠斗警报
  };

  // Sprint 2: 个性化话术包（3-5句，实战中优先展示）
  talk_scripts?: string[];
}

// ---------- 场次 ----------

export interface FMSession {
  id: string;
  plan: SessionPlan;
  status: SessionStatus;
  start_time: string;              // ISO
  end_time?: string;               // ISO
  events: FMEvent[];
  alerts: FMAlert[];
  note?: string;                   // 用户结束时的备注
  is_archived: boolean;
  user_deleted?: boolean;          // 用户软删除（前端隐藏，系统保留用于分析）
  user_deleted_at?: string;        // 软删除时间（ISO）
  review?: FMReviewReport;         // 复盘结果
  template_id?: string;            // 使用的模板 ID（用于效果追踪）
  behavior_nodes?: BehaviorNode[]; // AR方向1: 场次高权重行为节点
  talk_script_feedback?: TalkScriptEvent[]; // AR方向3: 话术展示 + 用户反应追踪
}

// ---------- AR方向3: 话术权重学习数据 ----------

/** 单次话术展示及用户反应记录（Phase 1 收集，Phase 2 用于权重计算）*/
export interface TalkScriptEvent {
  script_index: number;       // 0-3，对应 plan.talk_scripts[i]
  script_text: string;        // 话术原文（冗余存储，防话术包变化后对不上）
  scene_pool_key: string;     // 触发场景，如 'loss_streak_chase'
  scene_level: 'L1' | 'L2' | 'L3' | 'L4';
  shown_at: string;           // ISO timestamp
  response?: {
    action: 'pause' | 'end' | 'ignore' | 'continue_loss';
    responded_at: string;
    outcome_score: number;    // end:+0.5  pause:+0.3  ignore:-0.2  continue_loss:-0.1
  };
}

// ---------- 事件 ----------

export interface FMEvent {
  id: string;
  session_id: string;
  event_type: FMEventType;
  amount?: number;                 // 输赢金额
  bet_unit?: number;               // 变更后码量
  note?: string;                   // 情绪标签/备注
  timestamp: string;               // ISO
  raw_input?: string;              // 原始输入
  self_check_result?: SelfCheckResult; // 自检结果（event_type='self_check' 时）

  // v1.2: 风控引擎快照（每手评估后附加，供复盘页读取）
  risk_snapshot?: {
    level: string;                 // InterventionLevel ('L0'-'L4')
    tier: string;                  // RiskTier
    profitLockStage: number;       // 0-5
    toxicCombos: string[];         // 当手触发的毒药组合
    keyMoments: string[];          // 当手触发的关键时刻
    survivalProb: number;
    etpProb: number;
    collapseProb: number;
  };
}

// ---------- 实时指标 ----------

export interface FMMetrics {
  net_pnl: number;                 // 净输赢
  current_balance: number;         // 当前余额 = session_budget + net_pnl
  total_hands: number;             // 总手数
  win_hands: number;               // 赢手数
  loss_hands: number;              // 输手数
  current_win_streak: number;      // 当前连赢
  current_loss_streak: number;     // 当前连输
  max_win_streak: number;          // 最大连赢
  max_loss_streak: number;         // 最大连输
  net_loss_hands: number;          // 净输手数 = loss_hands - win_hands
  highest_profit: number;          // 最高浮盈
  deepest_loss: number;            // 最大浮亏
  drawdown_from_peak: number;      // 回撤金额 = 峰值资金 - 当前余额
  drawdown_pct: number;            // 最大回撤% = (峰值资金 - 当前余额) / 峰值资金 × 100
  profit_giveback_rate: number;    // 盈利回吐率% = (最高盈利 − 当前盈利) ÷ 最高盈利 × 100（可超100%）
  elapsed_minutes: number;         // 已用时长
  current_bet_unit: number;        // 当前码量
  hands_per_hour: number;          // 每小时手数
  avg_win_amount: number;          // 平均赢额
  avg_loss_amount: number;         // 平均输额

  // 风控状态
  distance_to_stop_loss: number;   // 距止损金额
  is_in_lock_profit_zone: boolean; // 是否进入锁盈区
  profit_safety_margin: number;    // 锁盈安全边际
  remaining_minutes: number;       // 剩余时间
}

// ---------- 告警 ----------

export interface FMAlert {
  id: string;
  level: AlertLevel;
  rule_key: string;                // 触发规则标识
  message: string;                 // 人可读提示
  voice_message?: string;          // 语音播报短句
  timestamp: string;               // ISO
  dismissed: boolean;
}

// ---------- 模板 ----------

export interface FMTemplate {
  id: string;
  name: string;
  description: string;
  plan: Partial<SessionPlan>;      // 预填字段
  created_at: string;
  updated_at?: string;             // 最后编辑时间
  last_used_at?: string;           // 最近一次使用时间（用于排序）
  is_builtin: boolean;             // 系统预设还是用户创建
  use_count: number;               // 使用次数
  version: number;                 // 版本号（每次编辑+1）
  parent_id?: string;              // 来源模板 ID（编辑时保留旧版）
}

// ---------- 场次行为节点（AR方向1-P1）----------

export type BehaviorNodeType =
  | 'collapse'    // 崩盘节点：触发止损 / 严重偏离战约
  | 'rebound'     // 反弹节点：成功执行纪律、主动离场
  | 'emotion'     // 情绪节点：触发身心警报的时间点
  | 'giveback';   // 回吐节点：赢了后又输回去的转折点

export interface BehaviorNode {
  type: BehaviorNodeType;
  hand_index: number;              // 发生在第几手
  timestamp: string;               // ISO
  weight: number;                  // 初始权重 1.0，跨场次分析时动态更新
  detail: string;                  // 描述，如「连输3手后加码」
  metrics_snapshot?: {
    net_pnl: number;
    current_loss_streak: number;
    current_win_streak: number;
    elapsed_minutes: number;
  };
}

/** 模板历史快照（再编辑时旧版本自动归档） */
export interface FMTemplateSnapshot {
  template_id: string;             // 原模板 ID
  version: number;
  plan: Partial<SessionPlan>;
  saved_at: string;                // ISO
}

// ---------- 复盘报告 ----------

export interface FMReviewReport {
  session_id: string;
  generated_at: string;
  summary: string;                 // AI 叙述摘要
  metrics: FMMetrics;              // 终态指标
  discipline_score: number;        // 0-100 纪律分
  discipline_execution_rate?: number; // 纪律执行率% = 遵守规则数 ÷ 触发规则数 × 100
  trigger_density?: number;          // 风控触发密度% = 触发规则数 ÷ 总手数 × 100
  session_type?: string;             // 场次类型标签（AI 判定）
  dimension_scores?: FMDimensionScores; // 四维评分
  behavioral_analysis?: string;      // 行为分析（心理维度）
  key_moments: FMKeyMoment[];      // 关键时刻
  execution: FMExecution;          // 执行情况
  ai_advice: string;               // AI 改进建议
  rule_analysis?: FMRuleAnalysis[];     // 每条规则的执行分析
  parameter_suggestions?: FMParamSuggestion[]; // AI 参数调整建议
  self_check_summary?: SessionSelfCheckSummary; // 本场自检分析
}

/** 单场自检摘要（嵌入复盘报告） */
export interface SessionSelfCheckSummary {
  total_checks: number;               // 本场自检次数
  pre_entry_risk_level: string;       // 进场前风险等级
  live_checks: {
    hand_number: number;              // 第几手时做的
    risk_level: string;
    checked_count: number;
    action_taken: string;             // continue/pause/end_session
  }[];
  top_signals: string[];              // 本场最频繁的信号ID
  compliance_score: number;           // 本场自检遵从分 0-100
  ai_comment: string;                 // AI 对自检行为的点评
}

/** 六级事件状态：违规 / 已触发 / 未触发 / 已激活 / 风险预警 / 行为记录 */
export type EventStatus = 'violation' | 'triggered' | 'safe' | 'activated' | 'alert' | 'observation';

/** 单条规则的执行分析 */
export interface FMRuleAnalysis {
  rule_name: string;               // '止损金额 ¥1500'
  rule_type: 'basic' | 'advanced' | 'custom'; // 基础/进阶/自定义
  event_status: EventStatus;       // 四级事件状态
  was_triggered: boolean;          // 是否触发（兼容旧代码）
  trigger_time?: string;           // 触发时间
  user_complied: boolean;          // 用户是否遵守（兼容旧代码）
  closest_value?: number;          // 最接近触发的值
  note: string;                    // '触发后继续下注3手' / '未触发，最大连输3手'
}

/** AI 参数调整建议 */
export interface FMParamSuggestion {
  parameter: string;               // '止损金额' / '连输手数止损'
  current_value: string;           // '¥1500' / '5手'
  suggested_value: string;         // '¥1200' / '3手'
  reason: string;                  // '实际在亏损1200时已出现明显情绪波动'
  priority: 'high' | 'medium' | 'low';
}

/** 四维评分 */
export interface FMDimensionScores {
  discipline: number;        // 纪律评分 0-100
  profit_management: number; // 利润管理评分 0-100
  risk_control: number;      // 风险控制评分 0-100
  emotion_control: number;   // 情绪控制评分 0-100
}

export interface FMKeyMoment {
  timestamp: string;
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
}

export interface FMExecution {
  stop_loss_triggered: boolean;
  lock_profit_triggered: boolean;
  time_exceeded: boolean;
  unauthorized_raise_count: number;    // 违规加码次数
  plan_modification_count: number;     // 计划修改次数
}

// ---------- Store ----------

export interface FMStore {
  sessions: FMSession[];
  templates: FMTemplate[];
  template_snapshots?: FMTemplateSnapshot[]; // 模板历史版本
  active_session_id: string | null;
  settings: FMSettings;
}

// ---------- 情绪灵敏度预设 ----------

export type EmotionSensitivity = 'conservative' | 'standard' | 'aggressive';

/** 用户个人情绪阈值（可手动调节，数据驱动自动建议） */
export interface EmotionProfile {
  sensitivity: EmotionSensitivity;            // 预设档位
  loss_streak_threshold: number;              // 连输几手开始计分（默认3）
  bet_raise_tolerance: number;                // 码量变化多少倍算异常（默认1.2）
  giveback_tolerance: number;                 // 盈利回吐多少%开始计分（默认50）
  stop_loss_proximity: number;                // 距止损多少%开始紧张（默认30）
  intervention_cooldown_multiplier: number;   // 干预冷却倍率（默认1.0）
  overtime_sensitivity: number;               // 超时敏感度：提前几分钟提醒（默认10）

  // ── ETP 情绪转折点阈值 ──
  etp_loss_streak: number;                    // 连输/净输几手进入监测（默认3）
  etp_stagnation: number;                     // 缠斗几手进入监测（默认8）
  etp_duration: number;                       // 在桌多少分钟进入监测（默认45）
  loss_raise_streak?: number;                 // 连输几手后加注视为危险信号（默认2）
  giveback_alert_pct?: number;                // 盈利回撤%触发监测，0-100（默认80）
}

export interface FMSettings {
  default_input_method: PlanInputMethod;
  default_reminder_mode: ReminderMode[];
  show_escort_explanation: boolean;     // 是否显示陪护说明
  voice_broadcast_enabled: boolean;     // 语音播报开关
  emotion_profile: EmotionProfile;      // 情绪个性化配置
}

// ---------- AI 解析结果 ----------

export interface ParsedPlanResult {
  plan: Partial<SessionPlan>;
  confidence: number;                   // 0-1 总体置信度
  missing_fields: string[];             // 缺失字段名
  warnings: string[];                   // 冲突或异常提示
}
