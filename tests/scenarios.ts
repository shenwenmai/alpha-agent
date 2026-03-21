// ============================================================
// 测试场景数据集
// 6个场景覆盖合议引擎的所有分支
// ============================================================

import type { AgentPanelRequest } from '../src/types';

const BASE_PLAN = {
  session_budget: 5000,
  base_unit: 100,
  stop_loss_amount: 1500,
  take_profit_amount: 1500,
  max_duration_minutes: 60,
  max_bet_unit: 300,
  forbid_raise_in_loss: true,
};

const BASE_SELF_CHECK = {
  pre_entry_risk_level: 'safe' as const,
  pre_entry_lethal_signals: [],
  pre_entry_checked_ids: [],
  latest_live_check: null,
  hands_since_last_check: null,
};

const BASE_BEHAVIOR = {
  this_hand_bet: 100,
  last_hand_bet: 100,
  bet_deviation_pct: 0,
  is_violation: false,
  is_timid: false,
  followed_last_advice: true,
  consecutive_ignored: 0,
};

// ── 场景 1：一切正常，三Agent无警告 ─────────────────────────
// 预期结论：继续·保持节奏
export const SCENARIO_NORMAL: AgentPanelRequest = {
  hand_number: 8,
  session_plan: BASE_PLAN,
  metrics: {
    net_pnl: 200,
    current_balance: 5200,
    total_hands: 8,
    win_hands: 5,
    loss_hands: 3,
    current_win_streak: 2,
    current_loss_streak: 0,
    net_loss_hands: -2,
    highest_profit: 300,
    distance_to_stop_loss: 1700,
    elapsed_minutes: 20,
    current_bet_unit: 100,
    is_in_lock_profit_zone: false,
    profit_giveback_rate: 33,
    drawdown_pct: 0,
  },
  engine_output: {
    survival_prob: 0.88,
    etp_prob: 0.15,
    collapse_prob: 0.12,
    intervention_level: 'L1',
    toxic_combos: [],
    key_moments: [],
  },
  self_check: BASE_SELF_CHECK,
  behavior: BASE_BEHAVIOR,
  active_scene: null,
  scene_level: 'L1',
};

// ── 场景 2：风险官否决（生存概率崩盘） ──────────────────────
// 触发：survival_prob = 0.22，distance_to_stop_loss = 150（< 2×100）
// 预期结论：止损·必须离桌（风险官否决，survival_prob < 0.20 → stop_loss）
export const SCENARIO_CONSERVATIVE_VETO: AgentPanelRequest = {
  hand_number: 22,
  session_plan: BASE_PLAN,
  metrics: {
    net_pnl: -1350,
    current_balance: 3650,
    total_hands: 22,
    win_hands: 7,
    loss_hands: 15,
    current_win_streak: 0,
    current_loss_streak: 5,
    net_loss_hands: 8,
    highest_profit: 0,
    distance_to_stop_loss: 150,
    elapsed_minutes: 48,
    current_bet_unit: 200,
    is_in_lock_profit_zone: false,
    profit_giveback_rate: 0,
    drawdown_pct: 27,
  },
  engine_output: {
    survival_prob: 0.22,
    etp_prob: 0.78,
    collapse_prob: 0.71,
    intervention_level: 'L4',
    toxic_combos: ['poison_chase', 'deep_hole'],
    key_moments: ['near_stop_loss'],
  },
  self_check: BASE_SELF_CHECK,
  behavior: {
    ...BASE_BEHAVIOR,
    this_hand_bet: 200,
    bet_deviation_pct: 100,
    is_violation: false,
    consecutive_ignored: 2,
    followed_last_advice: false,
  },
  active_scene: 'near_stop_loss',
  scene_level: 'L4',
};

// ── 场景 3：行为官否决（追损型，注码偏差超300%） ─────────────
// 触发：bet_deviation_pct = 350%（100 基码 → 450 下注）
// 预期结论：降注一级 或 暂停（行为官否决 deviation_index > 7 → pause）
export const SCENARIO_BALANCED_VETO: AgentPanelRequest = {
  hand_number: 14,
  session_plan: BASE_PLAN,
  metrics: {
    net_pnl: -320,
    current_balance: 4680,
    total_hands: 14,
    win_hands: 5,
    loss_hands: 9,
    current_win_streak: 0,
    current_loss_streak: 3,
    net_loss_hands: 4,
    highest_profit: 200,
    distance_to_stop_loss: 1180,
    elapsed_minutes: 35,
    current_bet_unit: 450,
    is_in_lock_profit_zone: false,
    profit_giveback_rate: 260,
    drawdown_pct: 6.4,
  },
  engine_output: {
    survival_prob: 0.74,
    etp_prob: 0.52,
    collapse_prob: 0.38,
    intervention_level: 'L3',
    toxic_combos: ['poison_chase'],
    key_moments: [],
  },
  self_check: BASE_SELF_CHECK,
  behavior: {
    this_hand_bet: 450,
    last_hand_bet: 100,
    bet_deviation_pct: 350,
    is_violation: true,
    is_timid: false,
    followed_last_advice: false,
    consecutive_ignored: 3,
  },
  active_scene: 'poison_chase',
  scene_level: 'L3',
};

// ── 场景 4：推演官否决（崩盘概率超60%，高疲劳） ─────────────
// 触发：collapse_prob = 0.67，fatigue = 0.92，net_pnl < 0
// 预期结论：锁盈·建议离桌 或 暂停·冷静
export const SCENARIO_AGGRESSIVE_VETO: AgentPanelRequest = {
  hand_number: 35,
  session_plan: BASE_PLAN,
  metrics: {
    net_pnl: -280,
    current_balance: 4720,
    total_hands: 35,
    win_hands: 14,
    loss_hands: 21,
    current_win_streak: 0,
    current_loss_streak: 2,
    net_loss_hands: 7,
    highest_profit: 400,
    distance_to_stop_loss: 1220,
    elapsed_minutes: 55,
    current_bet_unit: 100,
    is_in_lock_profit_zone: false,
    profit_giveback_rate: 170,
    drawdown_pct: 13.1,
  },
  engine_output: {
    survival_prob: 0.61,
    etp_prob: 0.64,
    collapse_prob: 0.67,
    intervention_level: 'L3',
    toxic_combos: ['fatigue_grind'],
    key_moments: ['time_warning'],
  },
  self_check: BASE_SELF_CHECK,
  behavior: BASE_BEHAVIOR,
  active_scene: 'fatigue_grind',
  scene_level: 'L3',
};

// ── 场景 5：顺风局，行为偏差，行为官主导 ────────────────────
// net_pnl > 0，连赢后加注，但行为官判定顺风扩张型
// 预期结论：降注一级 或 观望（行为官主导）
export const SCENARIO_UPWIND_BEHAVIOR: AgentPanelRequest = {
  hand_number: 12,
  session_plan: BASE_PLAN,
  metrics: {
    net_pnl: 680,
    current_balance: 5680,
    total_hands: 12,
    win_hands: 9,
    loss_hands: 3,
    current_win_streak: 4,
    current_loss_streak: 0,
    net_loss_hands: -6,
    highest_profit: 680,
    distance_to_stop_loss: 2180,
    elapsed_minutes: 28,
    current_bet_unit: 250,
    is_in_lock_profit_zone: false,
    profit_giveback_rate: 0,
    drawdown_pct: 0,
  },
  engine_output: {
    survival_prob: 0.91,
    etp_prob: 0.28,
    collapse_prob: 0.19,
    intervention_level: 'L2',
    toxic_combos: ['overconfidence'],
    key_moments: [],
  },
  self_check: BASE_SELF_CHECK,
  behavior: {
    this_hand_bet: 250,
    last_hand_bet: 150,
    bet_deviation_pct: 150,
    is_violation: false,
    is_timid: false,
    followed_last_advice: true,
    consecutive_ignored: 0,
  },
  active_scene: 'overconfidence_rally',
  scene_level: 'L2',
};

// ── 场景 6：带病入场，danger级别自检，第一手即亏 ─────────────
// pre_entry_risk_level = danger，net_pnl < 0
// 预期：推演官否决（danger+亏损），collapse_prob 上调
export const SCENARIO_PRE_ENTRY_DANGER: AgentPanelRequest = {
  hand_number: 3,
  session_plan: BASE_PLAN,
  metrics: {
    net_pnl: -200,
    current_balance: 4800,
    total_hands: 3,
    win_hands: 0,
    loss_hands: 3,
    current_win_streak: 0,
    current_loss_streak: 3,
    net_loss_hands: 3,
    highest_profit: 0,
    distance_to_stop_loss: 1300,
    elapsed_minutes: 8,
    current_bet_unit: 100,
    is_in_lock_profit_zone: false,
    profit_giveback_rate: 0,
    drawdown_pct: 4,
  },
  engine_output: {
    survival_prob: 0.79,
    etp_prob: 0.45,
    collapse_prob: 0.31,
    intervention_level: 'L2',
    toxic_combos: [],
    key_moments: ['pre_entry_high_risk'],
  },
  self_check: {
    pre_entry_risk_level: 'danger',
    pre_entry_lethal_signals: ['mental_1', 'mental_3'],
    pre_entry_checked_ids: ['mental_1', 'mental_3', 'body_3'],
    latest_live_check: null,
    hands_since_last_check: null,
  },
  behavior: BASE_BEHAVIOR,
  active_scene: 'pre_entry_high_risk',
  scene_level: 'L2',
};

export const ALL_SCENARIOS = [
  { name: '场景1 正常局面', input: SCENARIO_NORMAL, expected_directive: 'continue' },
  { name: '场景2 风险官否决（临近止损）', input: SCENARIO_CONSERVATIVE_VETO, expected_directive: 'stop_loss' },
  { name: '场景3 行为官否决（追损+350%偏差）', input: SCENARIO_BALANCED_VETO, expected_directive: 'pause' },
  { name: '场景4 推演官否决（崩盘67%+高疲劳）', input: SCENARIO_AGGRESSIVE_VETO, expected_directive: 'pause' },
  { name: '场景5 顺风局行为偏差', input: SCENARIO_UPWIND_BEHAVIOR, expected_directive: 'reduce_bet' },
  { name: '场景6 带病入场（danger+亏损）', input: SCENARIO_PRE_ENTRY_DANGER, expected_directive: 'pause' },
];
