// ============================================================
// 场景识别器 — Scene Detector v2
//
// 核心哲学：场景从原始数据直接识别，不依赖引擎。
// 引擎结果只用来升级级别（L1→L4），不决定场景存不存在。
// 第1手就有场景，不存在学习期。
// ============================================================

import type { FMMetrics, SessionPlan, FMSession } from '../types/fundManager';
import type { EvaluationResult } from '../types/riskConfig';
import { getSceneByPoolKey, pickRandomMessages } from './sceneMessagePool';

// ── 缠斗状态（共享，供 sceneDetector + FMRecordingView 使用）──
export interface GrindingState {
  handGrinding: boolean;
  moneyGrinding: boolean;
  isGrinding: boolean;
  netHandDiff: number;
  grindWarnHands: number;
  grindLimitHands: number;
}

export function computeGrindingState(m: FMMetrics, plan: SessionPlan): GrindingState {
  const grindRange = plan.base_unit * 2;
  const netHandDiff = (m.win_hands ?? 0) - (m.loss_hands ?? 0);
  const handGrinding = m.total_hands >= 2 && Math.abs(netHandDiff) <= 2;
  const moneyGrinding = m.total_hands >= 2 && Math.abs(m.net_pnl) <= grindRange;
  return {
    handGrinding,
    moneyGrinding,
    isGrinding: handGrinding || moneyGrinding,
    netHandDiff,
    grindWarnHands: 8,
    grindLimitHands: 10,
  };
}

// ── 场景识别结果 ──
export interface ActiveScene {
  sceneId: string;
  label: string;
  level: 'L1' | 'L2' | 'L3' | 'L4';
  factMessage: string;
  psychMessage: string;
  poolKey: string;
}

// ── 话术缓存：同场景不换话术 ──
let lastSceneId = '';
let lastMessages: { factMessage: string; psychMessage: string } | null = null;

export function resetSceneState(): void {
  lastSceneId = '';
  lastMessages = null;
}

const LEVEL_ORDER: Record<string, number> = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4 };

// ============================================================
// 主函数：从原始数据识别场景
// ============================================================

export function detectActiveScene(
  riskResult: EvaluationResult | null,
  metrics: FMMetrics,
  sessionPlan: SessionPlan,
  session?: FMSession,
): ActiveScene | null {
  // 从原始数据直接识别场景
  const detected = detectFromRawData(metrics, sessionPlan);
  if (!detected) {
    lastSceneId = '';
    lastMessages = null;
    return null;
  }

  // 引擎结果只用来升级级别
  let finalLevel = detected.level;
  if (riskResult && riskResult.interventionLevel !== 'L0') {
    const engineOrder = LEVEL_ORDER[riskResult.interventionLevel] || 0;
    const dataOrder = LEVEL_ORDER[detected.level] || 0;
    if (engineOrder > dataOrder) {
      finalLevel = riskResult.interventionLevel as 'L1' | 'L2' | 'L3' | 'L4';
    }
  }

  return buildScene(detected.poolKey, finalLevel, metrics, sessionPlan);
}

// ============================================================
// 从原始数据直接匹配33个场景
// 每个判断只用 FMMetrics + SessionPlan 的字段
// ============================================================

interface DetectedScene {
  poolKey: string;
  level: 'L1' | 'L2' | 'L3' | 'L4';
}

function detectFromRawData(
  m: FMMetrics,
  plan: SessionPlan,
): DetectedScene | null {
  const ct = plan.custom_scene_thresholds;
  // 个性化阈值优先；无则取方案参数；无则取保底默认
  const streakLimit = ct?.loss_streak_alert ?? plan.stop_loss_streak ?? 3;
  const netLossLimit = plan.stop_loss_net_hands ?? 3;
  const maxTime = plan.max_duration_minutes || 60;
  const timePercent = (m.elapsed_minutes / maxTime) * 100;
  const betRaised = m.current_bet_unit > plan.base_unit * 1.2;
  const hadProfit = m.highest_profit > 0;
  const givebackRate = m.profit_giveback_rate ?? 0;
  const { handGrinding, moneyGrinding, isGrinding, grindWarnHands, grindLimitHands } = computeGrindingState(m, plan);

  // ── 个性化场景：上头型（连赢加大）──
  if (ct?.win_streak_alert && m.current_win_streak >= ct.win_streak_alert && betRaised)
    return { poolKey: 'poison_pivot_tilt', level: 'L2' };

  // ── 个性化场景：回吐型（盈利锁定区快速回吐）──
  if (ct?.profit_lock_pct && hadProfit && m.net_pnl > 0) {
    const givebackPct = m.profit_giveback_rate ?? 0;
    if (givebackPct >= ct.profit_lock_pct)
      return { poolKey: 'profit_giveback', level: 'L2' };
  }

  // ── 个性化场景：无聊型（累计X手净盈亏<5%）──
  if (ct?.grind_hands_alert && ct.grind_hands_alert > 0 && m.total_hands >= ct.grind_hands_alert) {
    const budgetPct = plan.session_budget > 0
      ? Math.abs(m.net_pnl) / plan.session_budget * 100
      : 100;
    if (budgetPct < 5)
      return { poolKey: 'grind_approaching', level: 'L2' };
  }

  // ═══ L4：止损触发 ═══
  if (m.distance_to_stop_loss <= 0 && m.net_pnl < 0) {
    if (betRaised) return { poolKey: 'poison_stoploss_raise', level: 'L4' };
    return { poolKey: 'stoploss_hit', level: 'L4' };
  }

  // ═══ 多维组合（3+指标） ═══
  if (timePercent >= 60 && isGrinding && m.total_hands >= grindLimitHands && m.net_pnl < 0)
    return { poolKey: 'poison_grind_despair', level: 'L3' };
  if (timePercent >= 75 && isGrinding && m.total_hands >= grindWarnHands && m.net_pnl < 0)
    return { poolKey: 'poison_multi_pressure', level: 'L3' };

  // ═══ 双指标毒药组合 ═══
  if (m.current_loss_streak >= 2 && betRaised)
    return { poolKey: 'poison_chase', level: 'L3' };
  if (hadProfit && m.net_pnl < 0 && betRaised && m.total_hands >= 5)
    return { poolKey: 'poison_pivot_tilt', level: 'L3' };
  if (m.is_in_lock_profit_zone && m.current_loss_streak >= 2)
    return { poolKey: 'poison_lock_panic', level: 'L3' };
  if (m.max_win_streak >= 2 && m.current_loss_streak >= 2 && givebackRate >= 50)
    return { poolKey: 'poison_momentum', level: 'L3' };
  if (timePercent >= 60 && givebackRate >= 50 && hadProfit)
    return { poolKey: 'poison_fatigue_giveback', level: 'L3' };
  if (m.net_loss_hands >= 2 && betRaised)
    return { poolKey: 'poison_netloss_raise', level: 'L3' };
  if (m.current_loss_streak >= 2 && timePercent >= 60)
    return { poolKey: 'poison_streak_time', level: 'L3' };
  if (m.net_loss_hands >= 2 && timePercent >= 60)
    return { poolKey: 'poison_netloss_time', level: 'L3' };
  if (m.current_loss_streak >= 2 && isGrinding && m.total_hands >= grindWarnHands)
    return { poolKey: 'poison_streak_grind', level: 'L3' };
  if (m.net_loss_hands >= 2 && isGrinding && m.total_hands >= grindWarnHands)
    return { poolKey: 'poison_netloss_grind', level: 'L3' };
  if (isGrinding && m.total_hands >= grindWarnHands && betRaised)
    return { poolKey: 'poison_grind_raise', level: 'L3' };
  if (timePercent >= 60 && betRaised)
    return { poolKey: 'poison_time_raise', level: 'L3' };
  if (timePercent >= 75 && isGrinding && m.net_pnl < 0)
    return { poolKey: 'poison_fatigue', level: 'L3' };

  // ═══ 锁盈 ═══
  if (m.is_in_lock_profit_zone && givebackRate >= 50)
    return { poolKey: 'profit_lock_drawdown', level: 'L3' };
  if (m.is_in_lock_profit_zone && m.current_loss_streak === 1 && givebackRate < 50)
    return { poolKey: 'profit_lock_approaching', level: 'L2' };
  if (m.is_in_lock_profit_zone)
    return { poolKey: 'profit_lock_activated', level: 'L1' };

  // ═══ 单指标关键时刻 ═══
  if (m.current_loss_streak >= streakLimit)
    return { poolKey: 'streak_critical', level: 'L3' };
  if (m.net_loss_hands >= netLossLimit)
    return { poolKey: 'net_loss_critical', level: 'L3' };
  if (isGrinding && m.total_hands >= grindLimitHands)
    return { poolKey: 'grind_critical', level: 'L3' };
  if (hadProfit && m.net_pnl < 0 && m.total_hands >= 5)
    return { poolKey: 'profit_giveback', level: 'L2' };

  // ═══ 接近预警 ═══
  if (m.current_loss_streak === streakLimit - 1 && streakLimit > 1)
    return { poolKey: 'streak_approaching', level: 'L2' };
  if (m.net_loss_hands === netLossLimit - 1 && netLossLimit > 1)
    return { poolKey: 'net_loss_approaching', level: 'L2' };
  if (isGrinding && m.total_hands >= grindWarnHands && m.total_hands < grindLimitHands)
    return { poolKey: 'grind_approaching', level: 'L2' };

  // ═══ 接近止损 ═══
  if (m.distance_to_stop_loss <= plan.base_unit * 2 && m.net_pnl < 0)
    return { poolKey: 'near_stoploss', level: 'L2' };

  // ═══ 自检不是场景 ═══
  // 自检结果只影响引擎权重(selfCheckBoost)和"你的状态与环境"常驻区
  // 不进入场景识别链

  // ═══ 时间阶梯 ═══
  if (timePercent >= 100)
    return { poolKey: 'time_warn_3', level: 'L3' };
  if (timePercent >= 92)
    return { poolKey: 'time_warn_2', level: 'L2' };
  if (timePercent >= 75)
    return { poolKey: 'time_warn_1', level: 'L1' };

  // 无场景
  return null;
}

// ============================================================
// 构建最终场景对象
// ============================================================

function buildScene(
  poolKey: string,
  level: 'L1' | 'L2' | 'L3' | 'L4',
  m: FMMetrics,
  plan: SessionPlan,
): ActiveScene {
  const scene = getSceneByPoolKey(poolKey);

  if (!scene) {
    return makeGenericScene(level);
  }

  // 话术稳定性：同场景不换，换场景才换
  let messages: { factMessage: string; psychMessage: string };
  if (scene.sceneId === lastSceneId && lastMessages) {
    messages = lastMessages;
  } else {
    messages = pickRandomMessages(scene);
    lastSceneId = scene.sceneId;
    lastMessages = messages;
  }

  const factMessage = fillTemplate(messages.factMessage, m, plan);
  const psychMessage = fillTemplate(messages.psychMessage, m, plan);

  return {
    sceneId: scene.sceneId,
    label: scene.label,
    level,
    factMessage,
    psychMessage,
    poolKey,
  };
}

// ============================================================
// 辅助函数
// ============================================================

// getLatestSelfCheckLevel 已移除 — 自检不参与场景识别
// 自检数据由 EmotionPanel "你的状态与环境" 区域独立读取和显示

function fillTemplate(template: string, m: FMMetrics, plan: SessionPlan): string {
  const maxTime = plan.max_duration_minutes || 60;
  const timePercent = Math.round((m.elapsed_minutes / maxTime) * 100);
  const betMultiple = Math.round((m.current_bet_unit / Math.max(1, plan.base_unit)) * 10) / 10;

  return template
    .replace(/\{lossStreak\}/g, String(m.current_loss_streak))
    .replace(/\{netLoss\}/g, String(m.net_loss_hands ?? 0))
    .replace(/\{elapsed\}/g, String(Math.floor(m.elapsed_minutes)))
    .replace(/\{balance\}/g, String(m.current_balance))
    .replace(/\{grindHands\}/g, String(m.total_hands))
    .replace(/\{pnlAbs\}/g, String(Math.abs(m.net_pnl ?? 0)))
    .replace(/\{pnl\}/g, String(m.net_pnl ?? 0))
    .replace(/\{givebackRate\}/g, String(Math.round(m.profit_giveback_rate ?? 0)))
    .replace(/\{timePercent\}/g, String(timePercent))
    .replace(/\{stopLoss\}/g, String(plan.stop_loss_amount ?? 0))
    .replace(/\{baseBet\}/g, String(plan.base_unit ?? 0))
    .replace(/\{betMultiple\}/g, String(betMultiple))
    .replace(/\{peakProfit\}/g, String(m.highest_profit ?? 0))
    .replace(/\{consecutiveWins\}/g, String(m.max_win_streak ?? 0))
    .replace(/\{streakLimit\}/g, String(plan.stop_loss_streak ?? 3))
    .replace(/\{netLossLimit\}/g, String(plan.stop_loss_net_hands ?? 3))
    .replace(/\{distanceToStopLoss\}/g, String(m.distance_to_stop_loss ?? 0));
}

function makeGenericScene(level: 'L1' | 'L2' | 'L3' | 'L4'): ActiveScene {
  const config: Record<string, { label: string; fact: string; psych: string }> = {
    L1: {
      label: '轻微波动',
      fact: '系统检测到轻微风险波动，保持警觉',
      psych: '保持节奏，不要因为小波动改变你的计划',
    },
    L2: {
      label: '注意风险',
      fact: '多项风险指标亮起，建议谨慎操作',
      psych: '你可能觉得还好，但数据显示风险在累积。相信数据，它比感觉更客观',
    },
    L3: {
      label: '高危警告',
      fact: '风险已升至高危水平，强烈建议暂停',
      psych: '到了这个阶段，你的判断力已经受到情绪影响。最好的决定：先停下来',
    },
    L4: {
      label: '强制保护',
      fact: '风控系统判定当前状态极度危险，必须停止',
      psych: '你的计划已经被突破。每一秒继续都是在用最差的状态做最重要的决定',
    },
  };
  const c = config[level];
  return { sceneId: `generic_${level}`, label: c.label, level, factMessage: c.fact, psychMessage: c.psych, poolKey: '' };
}
