// ============================================================
// 合议引擎 — 纯规则，不调用 LLM
// 优先级：否决 > 一致 > 局势主导 > 均衡默认
// ============================================================

import type {
  AgentPanelRequest,
  ConservativeOutput,
  BalancedOutput,
  AggressiveOutput,
  ConsensusResult,
  DirectiveKey,
} from './types';

const DIRECTIVE_LABELS: Record<DirectiveKey, string> = {
  continue: '继续 · 保持节奏',
  reduce_bet: '降注一级',
  observe: '观望一手',
  pause: '暂停 · 冷静',
  lock_profit: '锁盈 · 建议离桌',
  stop_loss: '止损 · 必须离桌',
};

// 指令强度排序（越小越强）
const DIRECTIVE_RANK: Record<DirectiveKey, number> = {
  stop_loss: 0,
  lock_profit: 1,
  pause: 2,
  reduce_bet: 3,
  observe: 4,
  continue: 5,
};

function stronger(a: DirectiveKey, b: DirectiveKey): DirectiveKey {
  return DIRECTIVE_RANK[a] <= DIRECTIVE_RANK[b] ? a : b;
}

export function runConsensus(
  conservative: ConservativeOutput,
  balanced: BalancedOutput,
  aggressive: AggressiveOutput,
  input: AgentPanelRequest,
): ConsensusResult {
  const { metrics, engine_output } = input;

  // ── 优先级 1：有否决 ──────────────────────────────────────
  const vetoList: Array<{ agent: ConsensusResult['lead_agent']; directive: DirectiveKey }> = [];

  if (conservative.veto) {
    // survival_prob < 0.30 已是否决触发条件，否决即对应 stop_loss
    const d: DirectiveKey = conservative.survival_prob < 0.30 ? 'stop_loss' : 'lock_profit';
    vetoList.push({ agent: 'conservative', directive: d });
  }
  if (balanced.veto) {
    const d: DirectiveKey = balanced.deviation_index > 7 ? 'pause' : 'reduce_bet';
    vetoList.push({ agent: 'balanced', directive: d });
  }
  if (aggressive.veto) {
    const d: DirectiveKey = aggressive.exit_window ? 'lock_profit' : 'pause';
    vetoList.push({ agent: 'aggressive', directive: d });
  }

  if (vetoList.length > 0) {
    // 取最高级别否决指令
    let directive_key = vetoList[0].directive;
    let lead_agent = vetoList[0].agent;
    for (const v of vetoList.slice(1)) {
      if (DIRECTIVE_RANK[v.directive] < DIRECTIVE_RANK[directive_key]) {
        directive_key = v.directive;
        lead_agent = v.agent;
      }
    }

    // 少数意见：其他否决Agent的不同判断
    const others = vetoList
      .filter(v => v.agent !== lead_agent)
      .map(v => `${agentName(v.agent)}否决（${DIRECTIVE_LABELS[v.directive]}）`);

    return {
      directive: DIRECTIVE_LABELS[directive_key],
      directive_key,
      lead_agent,
      dissent: others.length > 0 ? others.join('；') : undefined,
      key_metrics: buildKeyMetrics(conservative, balanced, aggressive),
    };
  }

  // ── 优先级 2：三方一致，无否决 ───────────────────────────
  const allClear =
    conservative.safety_status === 'safe' &&
    balanced.behavior_status === 'normal' &&
    !aggressive.exit_window &&
    aggressive.collapse_prob_10h < 0.4;

  if (allClear) {
    return {
      directive: DIRECTIVE_LABELS['continue'],
      directive_key: 'continue',
      lead_agent: 'balanced',
      key_metrics: buildKeyMetrics(conservative, balanced, aggressive),
    };
  }

  // ── 优先级 3：有分歧，按局势主导 ─────────────────────────
  let directive_key: DirectiveKey = 'continue';
  let lead_agent: ConsensusResult['lead_agent'] = 'balanced';
  const dissentParts: string[] = [];

  if (engine_output.etp_prob > 0.6) {
    // 情绪临界：推演官主导
    lead_agent = 'aggressive';
    directive_key = aggressive.exit_window ? 'observe' : 'pause';
    if (conservative.safety_status !== 'safe') {
      dissentParts.push(`风险官关注安全边际（${Math.round(conservative.survival_prob * 100)}%生存率）`);
    }
  } else if (metrics.net_pnl < 0) {
    // 逆风局：风险官主导
    lead_agent = 'conservative';
    directive_key = conservative.safety_status === 'caution' ? 'reduce_bet' : 'continue';
    if (balanced.behavior_status !== 'normal') {
      dissentParts.push(`行为官检测到${balanced.behavior_pattern ?? '偏差'}（偏差指数${balanced.deviation_index}/10）`);
    }
  } else {
    // 顺风局：行为官主导
    lead_agent = 'balanced';
    if (balanced.behavior_status !== 'normal') {
      // 行为偏差 → 降注；只有高偏差才升级到 pause
      directive_key = balanced.deviation_index > 7 ? 'pause' : 'reduce_bet';
    } else if (aggressive.exit_window) {
      directive_key = 'observe';
      lead_agent = 'aggressive';
    } else if (conservative.safety_status !== 'safe') {
      directive_key = 'reduce_bet';
      lead_agent = 'conservative';
    } else {
      directive_key = 'continue';
    }
    if (aggressive.exit_window && lead_agent !== 'aggressive') {
      dissentParts.push('推演官认为存在退出窗口');
    }
  }

  return {
    directive: DIRECTIVE_LABELS[directive_key],
    directive_key,
    lead_agent,
    dissent: dissentParts.length > 0 ? dissentParts.join('；') : undefined,
    key_metrics: buildKeyMetrics(conservative, balanced, aggressive),
  };
}

function buildKeyMetrics(
  conservative: ConservativeOutput,
  balanced: BalancedOutput,
  aggressive: AggressiveOutput,
) {
  return {
    survival_prob: conservative.survival_prob,
    collapse_prob: aggressive.collapse_prob_10h,
    behavior_deviation: balanced.deviation_index,
  };
}

function agentName(agent: ConsensusResult['lead_agent']): string {
  const map = { conservative: '风险官', balanced: '行为官', aggressive: '推演官' };
  return map[agent];
}
