// ============================================================
// agentRiskService.ts — 三Agent系统桥接层
// 把 b-side 的风控评估调用转发到三Agent API
// 返回与 InterventionResult 兼容的格式，供 FMRecordingView 直接使用
// ============================================================

import type { FMMetrics, SessionPlan, FMEvent } from '../types/fundManager';
import type { EvaluationResult, InterventionLevel } from '../types/riskConfig';
import type { InterventionResult } from './interventionEngine';

// ── DirectiveKey → InterventionLevel 映射 ──────────────────
const DIRECTIVE_TO_LEVEL: Record<string, InterventionLevel> = {
  continue:    'L0',
  reduce_bet:  'L1',
  observe:     'L2',
  pause:       'L3',
  lock_profit: 'L3',
  stop_loss:   'L4',
};

// ── DirectiveKey → UI 文案 ─────────────────────────────────
const DIRECTIVE_TITLES: Record<string, string> = {
  continue:    '保持节奏',
  reduce_bet:  '建议降注',
  observe:     '建议观望',
  pause:       '暂停冷静',
  lock_profit: '锁盈离桌',
  stop_loss:   '止损离桌',
};

// ── 三Agent API 响应类型（对应 api/analyze.ts 输出）──────────
interface AgentAnalysis {
  conservative: {
    safety_status: string;
    survival_margin: number;
    survival_prob: number;
    veto: boolean;
    veto_reason?: string;
    fact_line: string;
    assessment: string;
  };
  balanced: {
    behavior_status: string;
    behavior_pattern: string | null;
    deviation_index: number;
    veto: boolean;
    veto_reason?: string;
    fact_line: string;
    assessment: string;
  };
  aggressive: {
    collapse_prob_10h: number;
    fatigue_coefficient: number;
    exit_window: boolean;
    exit_window_reason?: string;
    critical_hand_estimate: number | null;
    veto: boolean;
    veto_reason?: string;
    fact_line: string;
    assessment: string;
  };
  consensus: {
    directive: string;
    directive_key: string;
    lead_agent: 'conservative' | 'balanced' | 'aggressive';
    dissent?: string;
    key_metrics: {
      survival_prob: number;
      collapse_prob: number;
      behavior_deviation: number;
    };
  };
}

// ── 分析请求结果 ───────────────────────────────────────────
export interface AgentRiskResult {
  triggered: boolean;
  level: InterventionLevel;
  interventionResult: InterventionResult;
  agentAnalysis: AgentAnalysis;
  /** 可直接附加到 EvaluationResult 的关键指标 */
  keyMetrics: {
    survivalProb: number;
    collapseProb: number;
    deviationIndex: number;
  };
}

// ── 把 b-side metrics + session 转为 AgentPanelRequest ─────
function buildAgentRequest(
  metrics: FMMetrics,
  plan: SessionPlan,
  events: FMEvent[],
  interventionLevel: InterventionLevel,
) {
  const lastEvent = events[events.length - 1];
  const prevEvent = events[events.length - 2];

  // 计算生存概率（用于 engine_output）
  const distanceToSL = metrics.distance_to_stop_loss ?? (metrics.current_balance - (plan.total_bankroll - (plan.stop_loss_amount ?? plan.total_bankroll * 0.3)));
  const survivalProb = Math.max(0, Math.min(1, distanceToSL / (plan.stop_loss_amount ?? plan.total_bankroll * 0.3)));
  const streakStress = Math.min(1, (metrics.current_loss_streak ?? 0) / 5);
  const etpProb = Math.min(0.9, streakStress * 0.6 + ((metrics.profit_giveback_rate ?? 0) > 50 ? 0.3 : 0));
  const collapseProb = Math.max(0, Math.min(1, 1 - survivalProb - 0.1));

  const thisBet = lastEvent?.bet_unit ?? plan.base_unit ?? 100;
  const prevBet = prevEvent?.bet_unit ?? plan.base_unit ?? 100;

  return {
    hand_number: metrics.total_hands,
    session_plan: {
      session_budget: plan.session_budget ?? plan.total_bankroll,
      base_unit: plan.base_unit ?? 100,
      stop_loss_amount: plan.stop_loss_amount ?? plan.total_bankroll * 0.3,
      take_profit_amount: plan.take_profit_amount ?? plan.total_bankroll * 0.5,
      max_duration_minutes: plan.max_duration_minutes ?? 120,
      max_bet_unit: plan.max_bet_unit ?? (plan.base_unit ?? 100) * 5,
    },
    metrics: {
      net_pnl: metrics.net_pnl,
      current_balance: metrics.current_balance,
      total_hands: metrics.total_hands,
      win_hands: metrics.win_hands,
      loss_hands: metrics.loss_hands,
      current_win_streak: metrics.current_win_streak ?? 0,
      current_loss_streak: metrics.current_loss_streak ?? 0,
      net_loss_hands: (metrics.loss_hands ?? 0) - (metrics.win_hands ?? 0),
      highest_profit: metrics.highest_profit ?? 0,
      distance_to_stop_loss: distanceToSL,
      elapsed_minutes: metrics.elapsed_minutes ?? 0,
      current_bet_unit: thisBet,
      is_in_lock_profit_zone: metrics.is_in_lock_profit_zone ?? false,
      profit_giveback_rate: metrics.profit_giveback_rate ?? 0,
      drawdown_pct: metrics.drawdown_pct ?? 0,
    },
    engine_output: {
      survival_prob: parseFloat(survivalProb.toFixed(3)),
      etp_prob: parseFloat(etpProb.toFixed(3)),
      collapse_prob: parseFloat(collapseProb.toFixed(3)),
      intervention_level: interventionLevel,
      toxic_combos: [],
      key_moments: [],
    },
    self_check: {
      pre_entry_risk_level: survivalProb > 0.7 ? 'safe' : survivalProb > 0.4 ? 'caution' : 'warning',
      pre_entry_lethal_signals: [],
      pre_entry_checked_ids: [],
      latest_live_check: {
        risk_level: survivalProb > 0.5 ? 'safe' : 'caution',
        checked_ids: [],
      },
      hands_since_last_check: metrics.total_hands,
    },
    behavior: {
      this_hand_bet: thisBet,
      last_hand_bet: prevBet,
      bet_deviation_pct: ((thisBet - (plan.base_unit ?? 100)) / (plan.base_unit ?? 100)) * 100,
      is_violation: thisBet > (plan.max_bet_unit ?? (plan.base_unit ?? 100) * 5),
      is_timid: thisBet < (plan.base_unit ?? 100) * 0.5,
      followed_last_advice: null,
      consecutive_ignored: 0,
    },
    active_scene: null,
    scene_level: interventionLevel,
  };
}

// ── 主调用函数 ─────────────────────────────────────────────
export async function callAgentRisk(
  metrics: FMMetrics,
  plan: SessionPlan,
  events: FMEvent[],
  currentLevel: InterventionLevel,
): Promise<AgentRiskResult | null> {
  try {
    const body = buildAgentRequest(metrics, plan, events, currentLevel);

    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const analysis: AgentAnalysis = data.agent_analysis;
    const { consensus } = analysis;

    const directiveKey = consensus.directive_key;
    const level = DIRECTIVE_TO_LEVEL[directiveKey] ?? currentLevel;

    // ── 用三Agent的 fact_line + assessment 构建干预文案 ──
    const agentLabels: Record<string, string> = {
      conservative: '🛡 风险官',
      balanced: '⚖️ 行为官',
      aggressive: '🔮 推演官',
    };
    const leadLabel = agentLabels[consensus.lead_agent] ?? '系统';
    const leadAgent = analysis[consensus.lead_agent as keyof AgentAnalysis] as typeof analysis.conservative;

    const title = DIRECTIVE_TITLES[directiveKey] ?? '风险提示';
    const message = [
      leadAgent?.fact_line,
      leadAgent?.assessment,
      consensus.dissent ? `【异议】${consensus.dissent}` : null,
    ].filter(Boolean).join('\n');

    const interventionResult: InterventionResult = {
      triggered: level !== 'L0',
      level,
      ui_mode: ({ L0: 'none', L1: 'toast', L2: 'modal', L3: 'fullscreen', L4: 'forced' } as const)[level],
      title: `${leadLabel} · ${title}`,
      message,
      actions: level === 'L4'
        ? [{ key: 'end', text: '立即止损离桌' }]
        : level === 'L3'
          ? [{ key: 'continue', text: '我知道了，继续' }, { key: 'end', text: '好，现在停止' }]
          : [{ key: 'continue', text: '继续' }],
      trigger_type: `agent_${directiveKey}`,
      pool_key: `agent_${directiveKey}`,
    };

    return {
      triggered: level !== 'L0',
      level,
      interventionResult,
      agentAnalysis: analysis,
      keyMetrics: {
        survivalProb: consensus.key_metrics.survival_prob,
        collapseProb: consensus.key_metrics.collapse_prob,
        deviationIndex: consensus.key_metrics.behavior_deviation,
      },
    };
  } catch (e) {
    console.error('[agentRiskService] call failed:', e);
    return null;
  }
}
