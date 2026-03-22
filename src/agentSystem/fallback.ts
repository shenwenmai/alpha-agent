// ============================================================
// 降级兜底模块
// LLM 调用失败时，用纯规则生成各 Agent 的结构化输出
// 保证实战中系统永不沉默
// ============================================================

import type {
  AgentPanelRequest,
  ConservativeOutput,
  BalancedOutput,
  AggressiveOutput,
} from './types';

export function fallbackConservative(input: AgentPanelRequest): ConservativeOutput {
  const { metrics, engine_output, session_plan } = input;
  const margin = Math.round((metrics.distance_to_stop_loss / session_plan.base_unit) * 10) / 10;
  const sp = engine_output.survival_prob;
  const veto =
    sp < 0.30 ||
    metrics.distance_to_stop_loss <= session_plan.base_unit * 2 ||
    (metrics.is_in_lock_profit_zone && metrics.profit_giveback_rate > 50);

  const safety_status =
    sp < 0.30 ? 'critical' : sp < 0.55 || margin < 4 ? 'caution' : 'safe';

  const veto_reason = veto
    ? sp < 0.30
      ? `生存概率${Math.round(sp * 100)}%，已低于30%警戒线`
      : metrics.distance_to_stop_loss <= session_plan.base_unit * 2
        ? `距止损仅${metrics.distance_to_stop_loss}，不足2手基码`
        : `锁盈区内回吐率${Math.round(metrics.profit_giveback_rate)}%`
    : undefined;

  return {
    safety_status,
    survival_margin: margin,
    survival_prob: sp,
    veto,
    veto_reason,
    fact_line: `距止损${metrics.distance_to_stop_loss}，安全边际${margin}手，生存概率${Math.round(sp * 100)}%。`,
    assessment: veto
      ? '当前状态已无安全边际，建议立即止损。'
      : margin < 5
        ? '边际收窄，严格控制注码。'
        : '账面尚有空间，保持节奏。',
  };
}

export function fallbackBalanced(input: AgentPanelRequest): BalancedOutput {
  const { metrics, behavior, session_plan } = input;
  const dev = behavior.bet_deviation_pct;

  const veto =
    (behavior.is_violation && behavior.consecutive_ignored >= 2) ||
    dev > 300 ||
    (behavior.consecutive_ignored >= 3 && metrics.net_pnl < 0);

  const devIdx = Math.min(10, Math.round(Math.abs(dev) / 30));
  const behavior_status = veto ? 'critical' : devIdx > 4 ? 'deviating' : 'normal';

  let behavior_pattern: BalancedOutput['behavior_pattern'] = null;
  if (metrics.current_loss_streak >= 2 && dev > 50) {
    behavior_pattern = '追损型';
  } else if (dev > 200) {
    behavior_pattern = '冲动型';
  } else if (metrics.net_pnl > 0 && dev < -50) {
    behavior_pattern = '畏缩型';
  } else if (behavior.consecutive_ignored >= 3) {
    behavior_pattern = '忽视型';
  } else if (metrics.current_win_streak >= 3 && dev > 50) {
    behavior_pattern = '顺风扩张型';
  }

  const veto_reason = veto
    ? dev > 300
      ? `注码偏差${dev}%，超过300%否决线`
      : behavior.consecutive_ignored >= 3
        ? `连续忽视建议${behavior.consecutive_ignored}次且处于亏损状态`
        : `连续违规加码`
    : undefined;

  return {
    behavior_status,
    behavior_pattern,
    deviation_index: devIdx,
    veto,
    veto_reason,
    fact_line: `当前仓位偏差${dev > 0 ? '+' : ''}${dev}%，偏差指数${devIdx}/10。`,
    assessment: veto
      ? '立即回归基准注码，否则将触发强制止损。'
      : behavior_pattern
        ? `检测到${behavior_pattern}倾向，建议回归基准。`
        : '行为在正常范围内，保持节奏。',
  };
}

export function fallbackAggressive(input: AgentPanelRequest): AggressiveOutput {
  const { metrics, engine_output, session_plan, self_check } = input;
  const maxMin = session_plan.max_duration_minutes || 60;
  const fatigue = Math.min(1, Math.round((metrics.elapsed_minutes / maxMin) * 100) / 100);

  // 进场前 danger 修正崩盘概率
  let cp = engine_output.collapse_prob;
  if (self_check.pre_entry_risk_level === 'danger') {
    cp = Math.min(1, cp * 1.3);
  }
  if (self_check.pre_entry_lethal_signals.length > 0 && self_check.latest_live_check) {
    cp = Math.min(1, cp + 0.2);
  }
  cp = Math.round(cp * 100) / 100;

  const veto =
    cp > 0.60 ||
    (fatigue > 0.90 && metrics.net_pnl < 0) ||
    (self_check.pre_entry_risk_level === 'danger' && metrics.net_pnl < 0);

  const exit_window =
    (metrics.net_pnl > 0 && fatigue > 0.6) ||
    metrics.net_pnl >= session_plan.take_profit_amount * 0.8;

  const critical_hand_estimate =
    cp > 0.4
      ? metrics.total_hands + Math.round((1 - cp) * 12)
      : null;

  const exit_window_reason = exit_window
    ? metrics.net_pnl >= session_plan.take_profit_amount * 0.8
      ? `已接近止盈目标${Math.round((metrics.net_pnl / session_plan.take_profit_amount) * 100)}%，当前是主动退出窗口`
      : `疲劳系数${fatigue}，顺风局存在主动退出窗口`
    : undefined;

  const veto_reason = veto
    ? cp > 0.60
      ? `崩盘概率${Math.round(cp * 100)}%，超过60%否决线`
      : fatigue > 0.90
        ? `疲劳系数${fatigue}且当前处于亏损状态`
        : `带病入场（danger级别）且出现亏损`
    : undefined;

  return {
    collapse_prob_10h: cp,
    fatigue_coefficient: fatigue,
    exit_window,
    exit_window_reason,
    critical_hand_estimate,
    veto,
    veto_reason,
    fact_line: `前方10手崩盘概率${Math.round(cp * 100)}%，疲劳系数${fatigue}${critical_hand_estimate ? `，第${critical_hand_estimate}手是临界点` : ''}。`,
    assessment: veto
      ? exit_window
        ? '当前是主动退出窗口，窗口关闭后将被动止损。'
        : '崩盘路径已确认，建议立即暂停冷静。'
      : exit_window
        ? '退出窗口已开，可考虑锁盈收仓。'
        : '继续推演中，窗口尚未出现，控制仓位。',
  };
}
