// ============================================================
// 博弈风控 Agent 系统 — 类型定义
// 完全独立，不依赖 b-side 任何代码
// ============================================================

// ── 输入层 ────────────────────────────────────────────────────

/** 玩家场次计划 */
export interface SessionPlan {
  session_budget: number;         // 本场预算
  base_unit: number;              // 基础注码
  stop_loss_amount: number;       // 止损金额
  take_profit_amount: number;     // 止盈金额
  max_duration_minutes: number;   // 最大时长（分钟）
  max_bet_unit: number;           // 最大注码上限
  stop_loss_streak?: number;      // 连输止损手数
  forbid_raise_in_loss?: boolean; // 亏损时禁止加码
}

/** 实时指标快照 */
export interface MetricsSnapshot {
  net_pnl: number;                // 净盈亏
  current_balance: number;        // 当前余额
  total_hands: number;            // 总手数
  win_hands: number;
  loss_hands: number;
  current_win_streak: number;
  current_loss_streak: number;
  net_loss_hands: number;         // 净输手数 = loss - win
  highest_profit: number;         // 历史最高浮盈
  distance_to_stop_loss: number;  // 距止损金额
  elapsed_minutes: number;        // 已用时长
  current_bet_unit: number;       // 本手注码
  is_in_lock_profit_zone: boolean;
  profit_giveback_rate: number;   // 盈利回吐率 % (可超100%)
  drawdown_pct: number;           // 当前回撤 %
}

/** 风控引擎已计算的三维概率 */
export interface EngineOutput {
  survival_prob: number;          // 生存概率 0-1
  etp_prob: number;               // 情绪转折概率 0-1
  collapse_prob: number;          // 崩盘概率 0-1
  intervention_level: 'L0' | 'L1' | 'L2' | 'L3' | 'L4';
  toxic_combos: string[];
  key_moments: string[];
}

/** 自检状态（进场前 + 最新即时） */
export interface SelfCheckContext {
  pre_entry_risk_level: 'safe' | 'caution' | 'warning' | 'danger' | null;
  pre_entry_lethal_signals: string[];   // 权重5的信号ID列表
  pre_entry_checked_ids: string[];      // 所有勾选信号ID
  latest_live_check: {
    risk_level: 'safe' | 'caution' | 'warning' | 'danger';
    checked_ids: string[];
  } | null;
  hands_since_last_check: number | null;
}

/** 每手行为数据 */
export interface HandBehavior {
  this_hand_bet: number;
  last_hand_bet: number;
  bet_deviation_pct: number;             // (本手注码 - 基码) / 基码 × 100
  is_violation: boolean;                 // 超过 max_bet_unit
  is_timid: boolean;                     // 注码 < base_unit × 0.5
  followed_last_advice: boolean | null;  // null = 第一手/无建议
  consecutive_ignored: number;           // 连续忽视建议次数
}

/** Agent 分析请求（三个Agent共享此输入） */
export interface AgentPanelRequest {
  hand_number: number;
  session_plan: SessionPlan;
  metrics: MetricsSnapshot;
  engine_output: EngineOutput;
  self_check: SelfCheckContext;
  behavior: HandBehavior;
  active_scene: string | null;           // 当前场景Key（如 'poison_chase'）
  scene_level: 'L0' | 'L1' | 'L2' | 'L3' | 'L4';
}

// ── 输出层 ────────────────────────────────────────────────────

/** 风险官输出 */
export interface ConservativeOutput {
  safety_status: 'safe' | 'caution' | 'critical';
  survival_margin: number;               // 还能承受几手基码
  survival_prob: number;
  veto: boolean;
  veto_reason?: string;
  fact_line: string;                     // 事实一句话
  assessment: string;                    // 判断一句话
}

/** 行为官输出 */
export interface BalancedOutput {
  behavior_status: 'normal' | 'deviating' | 'critical';
  behavior_pattern: '追损型' | '冲动型' | '畏缩型' | '忽视型' | '顺风扩张型' | null;
  deviation_index: number;               // 0-10
  veto: boolean;
  veto_reason?: string;
  fact_line: string;
  assessment: string;
}

/** 推演官输出 */
export interface AggressiveOutput {
  collapse_prob_10h: number;
  fatigue_coefficient: number;           // 0-1
  exit_window: boolean;
  exit_window_reason?: string;
  critical_hand_estimate: number | null; // 预计第几手ETP爆发
  veto: boolean;
  veto_reason?: string;
  fact_line: string;
  assessment: string;
}

export type DirectiveKey =
  | 'continue'      // 继续·保持节奏
  | 'reduce_bet'    // 降注一级
  | 'observe'       // 观望一手
  | 'pause'         // 暂停·冷静
  | 'lock_profit'   // 锁盈·建议离桌
  | 'stop_loss';    // 止损·必须离桌

/** 合议结果 */
export interface ConsensusResult {
  directive: string;                     // 最终指令文本（用于UI展示）
  directive_key: DirectiveKey;
  lead_agent: 'conservative' | 'balanced' | 'aggressive';
  dissent?: string;                      // 少数意见（有分歧时）
  key_metrics: {
    survival_prob: number;
    collapse_prob: number;
    behavior_deviation: number;          // deviation_index
  };
}

/** 三Agent完整圆桌分析结果 */
export interface AgentAnalysis {
  conservative: ConservativeOutput;
  balanced: BalancedOutput;
  aggressive: AggressiveOutput;
  consensus: ConsensusResult;
}

/** API 响应 */
export interface AgentPanelResponse {
  agent_analysis: AgentAnalysis;
}
