// ============================================================
// 情绪引擎 — Emotion Engine
// 根据注码变化 + 输赢序列 + 时间 + 行为模式 → 预判情绪状态
// 输出 tilt score (0-100) → 分级干预
// 包含 ETP（Emotional Turning Point）情绪转折点状态机
// ============================================================

import type { FMSession, FMEvent, FMMetrics, SessionPlan, EmotionProfile, EmotionSensitivity } from '../types/fundManager';

// ── 情绪等级 ──
export type EmotionLevel = 'calm' | 'mild' | 'moderate' | 'severe';

// ── ETP 六阶段状态 ──
// 前三阶段可逆（情绪可以平复），后三阶段不可逆（转折点已发生）
//
// ① normal    正常     — 按计划操作，一切正常
// ② rising    波动     — 出现值得注意的信号，有苗头
// ③ elevated  接近触发 — 离转折点很近，需要主动关心
// ④ triggered 情绪转折点 — 任一ETP条件命中（不可逆）
// ⑤ critical  上头临界点 — 转折后继续+违规操作，最后窗口
// ⑥ collapsed 整场失控  — 确认上头，不可逆终点
export type ETPState = 'normal' | 'rising' | 'elevated' | 'triggered' | 'critical' | 'collapsed';

export interface EmotionState {
  score: number;           // 0-100
  level: EmotionLevel;
  signals: EmotionSignal[];  // 触发的信号列表
  intervention: string | null;  // 干预话术（null = 不干预）
}

export interface EmotionSignal {
  type: string;
  weight: number;
  description: string;
}

// ── ETP 三大条件 ──
export interface ETPCondition {
  type: 'loss_streak' | 'stagnation' | 'duration';
  weight: number;          // 40 / 20 / 30
  met: boolean;            // 是否命中
  current: number;         // 当前值
  threshold: number;       // 阈值
  description: string;
}

// ── ETP 结果 ──
export interface ETPResult {
  etpState: ETPState;
  etpScore: number;         // 0-100（命中条件权重累加 + 引爆后 +10）
  conditions: ETPCondition[];
  conditionsMet: number;    // 命中了几个条件（0-3）
  triggerCount: number;     // 保留兼容
  turningReasons: string[];
  isTriggered: boolean;     // etpState 为 triggered / critical / collapsed
  isCollapsed: boolean;     // 崩盘（collapsed）
  isCritical: boolean;      // 上头临界点（critical）
  stageIndex: number;       // 0-5 阶段序号（用于 UI 渐变）
}

// ── 已记录的转折点 ──
export interface TurningPointRecord {
  turning_point_hand: number;
  etp_score: number;
  turning_level: 'triggered' | 'critical' | 'collapsed';
  conditions_met: string[];
  turning_reasons: string[];
}

// ── 三档预设 ──
const SENSITIVITY_PRESETS: Record<EmotionSensitivity, EmotionProfile> = {
  conservative: {
    sensitivity: 'conservative',
    loss_streak_threshold: 2,
    bet_raise_tolerance: 1.1,
    giveback_tolerance: 35,
    stop_loss_proximity: 40,
    intervention_cooldown_multiplier: 0.7,
    overtime_sensitivity: 15,
    etp_loss_streak: 2,
    etp_stagnation: 6,
    etp_duration: 35,
  },
  standard: {
    sensitivity: 'standard',
    loss_streak_threshold: 3,
    bet_raise_tolerance: 1.2,
    giveback_tolerance: 50,
    stop_loss_proximity: 30,
    intervention_cooldown_multiplier: 1.0,
    overtime_sensitivity: 10,
    etp_loss_streak: 3,
    etp_stagnation: 8,
    etp_duration: 45,
  },
  aggressive: {
    sensitivity: 'aggressive',
    loss_streak_threshold: 5,
    bet_raise_tolerance: 1.5,
    giveback_tolerance: 70,
    stop_loss_proximity: 20,
    intervention_cooldown_multiplier: 1.5,
    overtime_sensitivity: 5,
    etp_loss_streak: 5,
    etp_stagnation: 12,
    etp_duration: 60,
  },
};

/** 获取预设值 */
export function getEmotionPreset(sensitivity: EmotionSensitivity): EmotionProfile {
  return { ...SENSITIVITY_PRESETS[sensitivity] };
}

/** 获取默认 profile */
export function getDefaultEmotionProfile(): EmotionProfile {
  return { ...SENSITIVITY_PRESETS.standard };
}

// ── 当前生效的 profile（模块级缓存） ──
let _activeProfile: EmotionProfile = { ...SENSITIVITY_PRESETS.standard };

/** 加载用户的情绪 profile（app 初始化或设置变更时调用） */
export function loadEmotionProfile(profile: EmotionProfile): void {
  _activeProfile = { ...profile };
}

// ── 情绪等级阈值 ──
const THRESHOLDS = {
  calm: 30,      // 0-30: 平静
  mild: 50,      // 31-50: 注意
  moderate: 75,  // 51-75: 警惕
  severe: 100,   // 76-100: 危险
} as const;

// ── 干预话术库 ──
const INTERVENTIONS = {
  mild: [
    '刚输了几手，注意节奏。',
    '码量变了，是计划内的吗？',
    '离止损还有 {distanceToStopLoss}，留意一下。',
    '连输 {lossStreak} 手了，先稳一下。',
    '盈利在回撤，看一眼锁盈线。',
  ],
  moderate: [
    '你现在的码量比开场大了 {betMultiple} 倍，这是你计划里的吗？',
    '从最高点回撤了 {drawdown}，要不要看一眼你定的锁盈线？',
    '连输 {lossStreak} 手了，现在加码不是策略，是情绪。',
    '你已经回吐了 {givebackRate}% 的盈利，先停下来想一想。',
    '亏损区加码是最容易失控的操作。你确定这是计划内的？',
  ],
  severe: [
    '停一下。你一开始说好的是输 {stopLoss} 就走。现在已经到了。',
    '这不是你定的计划。你现在在靠感觉打。',
    '你带来的 {budget}，还剩 {balance}。要继续，先确认一次。',
    '你已经连输 {lossStreak} 手，码量还在涨。这场需要暂停。',
    '盈利全部回吐，还倒亏了。这是你最容易犯错的时刻。',
  ],
} as const;

// ── 核心算法 ──

/**
 * 计算情绪分数
 * 输入：当前 session + 实时指标
 * 输出：EmotionState（分数、等级、信号列表、干预话术）
 */
export function computeEmotion(session: FMSession, metrics: FMMetrics): EmotionState {
  const signals: EmotionSignal[] = [];
  let totalScore = 0;

  const p = _activeProfile;

  // ── 信号 1：连输 ──
  if (metrics.current_loss_streak >= p.loss_streak_threshold) {
    const weight = Math.min(30, (metrics.current_loss_streak - (p.loss_streak_threshold - 1)) * 12);
    signals.push({
      type: 'loss_streak',
      weight,
      description: `连输 ${metrics.current_loss_streak} 手`,
    });
    totalScore += weight;
  }

  // ── 信号 2：亏损后加码（最强信号） ──
  const tiltBet = detectTiltBetting(session.events, session.plan.base_unit, p.bet_raise_tolerance);
  if (tiltBet.detected) {
    const weight = Math.min(35, tiltBet.severity * 12);
    signals.push({
      type: 'tilt_betting',
      weight,
      description: `亏损后加码 ${tiltBet.count} 次，最大码量 ${tiltBet.maxBet}`,
    });
    totalScore += weight;
  }

  // ── 信号 3：距止损距离 ──
  const proximityThreshold = p.stop_loss_proximity / 100;
  const stopLossRatio = metrics.distance_to_stop_loss / session.plan.stop_loss_amount;
  if (stopLossRatio < proximityThreshold && session.plan.stop_loss_amount > 0) {
    const weight = Math.round((1 - stopLossRatio / proximityThreshold) * 30);
    signals.push({
      type: 'near_stop_loss',
      weight,
      description: `距止损仅剩 ${metrics.distance_to_stop_loss}`,
    });
    totalScore += weight;
  }

  // ── 信号 4：盈利回吐 ──
  if (metrics.profit_giveback_rate > p.giveback_tolerance && metrics.highest_profit > 0) {
    const weight = Math.min(25, Math.round((metrics.profit_giveback_rate - p.giveback_tolerance) / 2));
    signals.push({
      type: 'profit_giveback',
      weight,
      description: `盈利回吐 ${metrics.profit_giveback_rate}%`,
    });
    totalScore += weight;
  }

  // ── 信号 5：超时（按超出时长递增，设计文档 StackScore: overtime > 20%） ──
  if (metrics.remaining_minutes <= 0 && session.plan.max_duration_minutes > 0) {
    const overtimeMinutes = Math.abs(metrics.remaining_minutes);
    // 基础15 + 每超10分钟加8，上限40
    const weight = Math.min(40, 15 + Math.floor(overtimeMinutes / 10) * 8);
    signals.push({
      type: 'overtime',
      weight,
      description: `已超出计划时长 ${Math.round(overtimeMinutes)} 分钟`,
    });
    totalScore += weight;
  } else if (metrics.remaining_minutes > 0 && metrics.remaining_minutes <= p.overtime_sensitivity) {
    signals.push({
      type: 'near_timeout',
      weight: 8,
      description: `剩余时间不足 ${p.overtime_sensitivity} 分钟`,
    });
    totalScore += 8;
  }

  // ── 信号 5b：净亏损严重度（设计文档 StackScore: distance_to_stoploss < 30%） ──
  if (metrics.net_pnl < 0 && session.plan.stop_loss_amount > 0) {
    const lossRatio = Math.abs(metrics.net_pnl) / session.plan.stop_loss_amount;
    if (lossRatio >= 0.5) {
      const weight = Math.min(25, Math.round(lossRatio * 25));
      signals.push({
        type: 'loss_severity',
        weight,
        description: `已亏损 ${Math.abs(metrics.net_pnl)}，达止损线 ${Math.round(lossRatio * 100)}%`,
      });
      totalScore += weight;
    }
  }

  // ── 信号 5c：回撤严重度（设计文档 StackScore: drawdown > 50%） ──
  if (metrics.drawdown_from_peak > 0 && metrics.highest_profit > 0) {
    const drawdownRatio = metrics.drawdown_from_peak / metrics.highest_profit;
    if (drawdownRatio > 0.5) {
      const weight = Math.min(20, Math.round((drawdownRatio - 0.5) * 40));
      signals.push({
        type: 'drawdown_severity',
        weight,
        description: `从最高盈利回撤 ${Math.round(drawdownRatio * 100)}%`,
      });
      totalScore += weight;
    }
  }

  // ── 信号 6：注码波动率 ──
  // 码量忽大忽小 = 情绪不稳
  const betVolatility = computeBetVolatility(session.events, session.plan.base_unit);
  if (betVolatility > 1.5) {
    const weight = Math.min(15, Math.round((betVolatility - 1.5) * 10));
    signals.push({
      type: 'bet_volatility',
      weight,
      description: `注码波动较大`,
    });
    totalScore += weight;
  }

  // ── 信号 7：连赢后加码（膨胀） ──
  if (metrics.current_win_streak >= 4) {
    const recentBetChange = detectWinStreakRaise(session.events);
    if (recentBetChange) {
      signals.push({
        type: 'euphoria_raise',
        weight: 10,
        description: `连赢 ${metrics.current_win_streak} 手后加码`,
      });
      totalScore += 10;
    }
  }

  // ── 信号 8：进场前自检 → 初始底分（随手数衰减） ──
  // §九：warning权重降低，衰减加快，避免2-5手就达到severe
  // danger: 40分 衰减20手 | warning: 18分 衰减10手 | caution: 8分 衰减8手
  const preEntryCheck = session.events.find(e => e.event_type === 'self_check' && e.self_check_result?.mode === 'pre_entry');
  if (preEntryCheck) {
    const rl = preEntryCheck.self_check_result!.risk_level;
    const baseScore = rl === 'danger' ? 40 : rl === 'warning' ? 18 : rl === 'caution' ? 8 : 0;
    const decayHands = rl === 'danger' ? 20 : rl === 'warning' ? 10 : 8;
    if (baseScore > 0) {
      // 底分随手数衰减
      const decay = Math.max(0, 1 - metrics.total_hands / decayHands);
      const weight = Math.round(baseScore * decay);
      if (weight > 0) {
        const checkedCount = preEntryCheck.self_check_result!.checked_ids.length;
        signals.push({
          type: 'pre_entry_check',
          weight,
          description: `进场时${checkedCount}项危险信号（${rl === 'danger' ? '危险' : rl === 'warning' ? '警告' : '注意'}），底分衰减中`,
        });
        totalScore += weight;
      }
    }
  }

  // ── 信号 9：即时自检结果回灌（随手数衰减） ──
  // §九：warning权重降低，避免即时自检结果单独撑起severe
  const liveCheckEvents = session.events.filter(e => e.event_type === 'self_check' && e.self_check_result?.mode === 'live');
  if (liveCheckEvents.length > 0) {
    const lastCheck = liveCheckEvents[liveCheckEvents.length - 1];
    const rl = lastCheck.self_check_result!.risk_level;
    const rawWeight = rl === 'danger' ? 25 : rl === 'warning' ? 12 : rl === 'caution' ? 5 : 0;
    if (rawWeight > 0) {
      // 自检后的手数衰减：15手归零
      const checkHandCount = session.events.filter(e =>
        (e.event_type === 'win' || e.event_type === 'loss') &&
        e.timestamp > lastCheck.timestamp
      ).length;
      const decay = Math.max(0, 1 - checkHandCount / 15);
      const weight = Math.round(rawWeight * decay);
      if (weight > 0) {
        const checkedCount = lastCheck.self_check_result!.checked_ids.length;
        signals.push({
          type: 'self_check',
          weight,
          description: `即时自检: ${rl === 'danger' ? '危险' : rl === 'warning' ? '警告' : '注意'}（${checkedCount}项信号）`,
        });
        totalScore += weight;
      }
    }
  }

  // ── 复合危险加成：多个严重信号同时触发 = 复合危机 ──
  const heavySignals = signals.filter(s => s.weight >= 10).length;
  if (heavySignals >= 3) {
    const compoundBonus = 15;
    signals.push({
      type: 'compound_danger',
      weight: compoundBonus,
      description: `${heavySignals} 个严重信号同时触发，复合危险`,
    });
    totalScore += compoundBonus;
  } else if (heavySignals >= 2) {
    const compoundBonus = 8;
    signals.push({
      type: 'compound_danger',
      weight: compoundBonus,
      description: `${heavySignals} 个信号叠加`,
    });
    totalScore += compoundBonus;
  }

  // 封顶 100
  totalScore = Math.min(100, totalScore);

  // 分级
  const level = scoreToLevel(totalScore);

  // 生成干预话术
  const intervention = level === 'calm'
    ? null
    : generateIntervention(level, metrics, session, signals);

  return { score: totalScore, level, signals, intervention };
}

// ── 辅助函数 ──

/** 检测亏损后加码行为（支持延迟检测：输后3手内加码均算tilt） */
function detectTiltBetting(
  events: FMEvent[],
  baseUnit: number,
  raiseTolerance: number = 1.2,
): { detected: boolean; count: number; severity: number; maxBet: number } {
  let count = 0;
  let maxBet = baseUnit;
  let handsSinceLastLoss = Infinity; // 距上次输的手数
  let currentBet = baseUnit;
  const TILT_WINDOW = 3; // 输后3手内加码都算tilt

  for (const evt of events) {
    if (evt.event_type === 'win') {
      handsSinceLastLoss++;
    } else if (evt.event_type === 'loss') {
      handsSinceLastLoss = 0;
    } else if (evt.event_type === 'bet_change' && evt.bet_unit != null) {
      // 输后 N 手内加码 = tilt（超过容忍倍率才算）
      if (handsSinceLastLoss <= TILT_WINDOW && evt.bet_unit > currentBet * raiseTolerance) {
        count++;
        if (evt.bet_unit > maxBet) maxBet = evt.bet_unit;
      }
      currentBet = evt.bet_unit;
    }
  }

  const severity = count === 0 ? 0 : Math.min(3, count);
  return { detected: count > 0, count, severity, maxBet };
}

/** 计算注码波动率（标准差 / 平均值） */
function computeBetVolatility(events: FMEvent[], baseUnit: number): number {
  const bets: number[] = [];
  let currentBet = baseUnit;

  for (const evt of events) {
    if (evt.event_type === 'bet_change' && evt.bet_unit != null) {
      currentBet = evt.bet_unit;
    }
    if (evt.event_type === 'win' || evt.event_type === 'loss') {
      bets.push(currentBet);
    }
  }

  if (bets.length < 3) return 0;

  const avg = bets.reduce((a, b) => a + b, 0) / bets.length;
  if (avg === 0) return 0;

  const variance = bets.reduce((sum, b) => sum + (b - avg) ** 2, 0) / bets.length;
  return Math.sqrt(variance) / avg;
}

/** 检测连赢后是否加码 */
function detectWinStreakRaise(events: FMEvent[]): boolean {
  // 看最后 10 个事件
  const recent = events.slice(-10);
  let inWinStreak = false;
  let streakCount = 0;

  for (const evt of recent) {
    if (evt.event_type === 'win') {
      streakCount++;
      if (streakCount >= 3) inWinStreak = true;
    } else if (evt.event_type === 'loss') {
      streakCount = 0;
      inWinStreak = false;
    } else if (evt.event_type === 'bet_change' && inWinStreak) {
      return true;
    }
  }
  return false;
}

/** 分数 → 等级 */
function scoreToLevel(score: number): EmotionLevel {
  if (score <= THRESHOLDS.calm) return 'calm';
  if (score <= THRESHOLDS.mild) return 'mild';
  if (score <= THRESHOLDS.moderate) return 'moderate';
  return 'severe';
}

/** 生成干预话术（模板变量替换） */
function generateIntervention(
  level: 'mild' | 'moderate' | 'severe',
  metrics: FMMetrics,
  session: FMSession,
  signals: EmotionSignal[],
): string {
  const pool = INTERVENTIONS[level];

  // 根据信号选择最相关的话术
  const msg = pickRelevantMessage(pool, signals, level);

  // 替换模板变量（空值保护：undefined/null 显示 '--'）
  let result = msg
    .replace('{distanceToStopLoss}', String(metrics.distance_to_stop_loss ?? '--'))
    .replace('{lossStreak}', String(metrics.current_loss_streak ?? '--'))
    .replace('{betMultiple}', String(
      metrics.current_bet_unit != null && session.plan.base_unit
        ? Math.round((metrics.current_bet_unit / session.plan.base_unit) * 10) / 10
        : '--'
    ))
    .replace('{drawdown}', String(metrics.drawdown_from_peak ?? '--'))
    .replace('{givebackRate}', String(metrics.profit_giveback_rate ?? '--'))
    .replace('{stopLoss}', String(session.plan.stop_loss_amount ?? '--'))
    .replace('{budget}', String(session.plan.session_budget ?? '--'))
    .replace('{balance}', String(metrics.current_balance ?? '--'));

  // 兜底清理：移除未替换的占位符
  result = result.replace(/\{[^}]+\}/g, '--');

  return result;
}

/** 根据触发信号选择最相关的话术 */
function pickRelevantMessage(
  pool: readonly string[],
  signals: EmotionSignal[],
  level: 'mild' | 'moderate' | 'severe',
): string {
  // 找到权重最高的信号
  const topSignal = signals.reduce((a, b) => a.weight > b.weight ? a : b, signals[0]);

  // 信号类型 → 话术关键词匹配
  const keywordMap: Record<string, string[]> = {
    loss_streak: ['连输', '连输'],
    tilt_betting: ['码量', '加码'],
    near_stop_loss: ['止损', '止损'],
    profit_giveback: ['回撤', '回吐', '盈利'],
    overtime: ['时长', '时间'],
    bet_volatility: ['码量', '注码'],
    euphoria_raise: ['连赢', '加码'],
  };

  const keywords = keywordMap[topSignal?.type] || [];

  // 尝试找匹配的话术
  for (const msg of pool) {
    if (keywords.some(kw => msg.includes(kw))) {
      return msg;
    }
  }

  // 没匹配到就随机选一条
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── 导出：是否需要干预（供 UI 层快速判断） ──
export function needsIntervention(emotion: EmotionState): boolean {
  return emotion.level !== 'calm';
}

// ── 导出：获取上次干预时间（防止频繁弹窗） ──
const interventionCooldown: Record<EmotionLevel, number> = {
  calm: 0,
  mild: 60_000,      // 轻度：至少 1 分钟间隔
  moderate: 120_000,  // 中度：至少 2 分钟间隔
  severe: 180_000,    // 重度：至少 3 分钟间隔
};

let lastInterventionTime = 0;
let lastInterventionLevel: EmotionLevel = 'calm';
let lastInterventionSignals: string[] = [];

/** 检查是否应该展示干预（考虑冷却时间 + 个人倍率） */
export function shouldShowIntervention(emotion: EmotionState): boolean {
  if (emotion.level === 'calm') return false;

  const now = Date.now();
  const baseCooldown = interventionCooldown[emotion.level];
  const cooldown = Math.round(baseCooldown * _activeProfile.intervention_cooldown_multiplier);

  // 如果等级升高了，检查信号是否相同（相同原因30秒内不重复）
  const levelOrder: Record<EmotionLevel, number> = { calm: 0, mild: 1, moderate: 2, severe: 3 };
  if (levelOrder[emotion.level] > levelOrder[lastInterventionLevel]) {
    const signalKey = emotion.signals.map(s => s.type).sort().join(',');
    const lastSignalKey = [...lastInterventionSignals].sort().join(',');
    if (signalKey === lastSignalKey && now - lastInterventionTime < 30_000) {
      return false; // 相同原因，30秒内不重复
    }
    lastInterventionTime = now;
    lastInterventionLevel = emotion.level;
    lastInterventionSignals = emotion.signals.map(s => s.type);
    return true;
  }

  // 否则看冷却
  if (now - lastInterventionTime >= cooldown) {
    lastInterventionTime = now;
    lastInterventionLevel = emotion.level;
    lastInterventionSignals = emotion.signals.map(s => s.type);
    return true;
  }

  return false;
}

/** 重置冷却（新场次开始时调用） */
export function resetEmotionCooldown(): void {
  lastInterventionTime = 0;
  lastInterventionLevel = 'calm';
  lastInterventionSignals = [];
}

// ============================================================
// ETP 情绪转折点状态机（v4 — 六阶段）
//
// 条件 A：连输/净输 ≥ 阈值（权重40%）
// 条件 B：缠斗 ≥ 阈值（权重20%）
// 条件 C：在桌时长 ≥ 阈值（权重30%）
//
// 六阶段状态转移：
//   ① normal    — 正常（无信号或信号很弱）
//   ② rising    — 波动（出现信号/任一条件≥60%阈值）        ↕ 可逆
//   ③ elevated  — 接近触发（条件≥80%阈值/多条件蓄能）      ↕ 可逆
//   ④ triggered — 情绪转折点（任一条件命中）               ↓ 不可逆
//   ⑤ critical  — 上头临界点（转折后继续+违规行为）        ↓ 不可逆
//   ⑥ collapsed — 整场失控（确认上头）                     ↓ 终点
//
// 行为红线快速通道：
//   亏损加码 severity≥2 且 情绪≥mild → 直接 triggered
//   止损突破 → 直接 collapsed
//
// 脆弱系数：身心自检 → 动态调节阈值
// ============================================================

// ── 脆弱系数：身心自检 → 阈值调节 ──
function computeVulnerability(session: FMSession): number {
  let v = 1.0;

  // 进场自检
  const preEntry = session.events.find(e => e.event_type === 'self_check' && e.self_check_result?.mode === 'pre_entry');
  if (preEntry) {
    const rl = preEntry.self_check_result!.risk_level;
    if (rl === 'danger') v *= 0.65;
    else if (rl === 'warning') v *= 0.80;
    else if (rl === 'caution') v *= 0.90;
  }

  // 最近一次实战自检
  const liveChecks = session.events.filter(e => e.event_type === 'self_check' && e.self_check_result?.mode === 'live');
  if (liveChecks.length > 0) {
    const last = liveChecks[liveChecks.length - 1];
    const rl = last.self_check_result!.risk_level;
    if (rl === 'danger') v *= 0.75;
    else if (rl === 'warning') v *= 0.85;
    else if (rl === 'caution') v *= 0.95;
  }

  // 下限 0.50（不会低于基准的50%）
  return Math.max(0.50, v);
}

// ── ETP 动态阈值（基准 × 脆弱系数，从用户 profile 读取） ──
function getETPConditions(session: FMSession) {
  const v = computeVulnerability(session);
  return {
    lossStreak: Math.max(2, Math.floor((_activeProfile.etp_loss_streak ?? 3) * v)),
    stagnation: Math.max(3, Math.floor((_activeProfile.etp_stagnation ?? 8) * v)),
    duration: Math.max(15, Math.floor((_activeProfile.etp_duration ?? 45) * v)),
    vulnerability: v,
  };
}

const ETP_WEIGHTS = {
  lossStreak: 40,
  stagnation: 20,
  duration: 30,
} as const;

// ── 模块级 ETP 状态 ──
let _etpState: ETPState = 'normal';
let _triggerSnapshot = {           // 进入 triggered 时的快照
  lossStreak: 0,
  stagnation: 0,
  duration: 0,
};
let _postTriggerViolations = 0;    // triggered 后的违规次数（用于 critical 判定）
let _lastViolationEventCount = 0;  // 上次检测到违规时的事件数（防止同一条件重复计数）

/** 获取当前 ETP 状态 */
export function getETPState(): ETPState {
  return _etpState;
}

/** 重置 ETP 状态（新场次时调用） */
export function resetETPState(): void {
  _etpState = 'normal';
  _triggerSnapshot = { lossStreak: 0, stagnation: 0, duration: 0 };
  _postTriggerViolations = 0;
  _lastViolationEventCount = 0;
}

/** 恢复 ETP 状态（页面刷新后从 checkpoint 恢复） */
export function restoreETPState(state: ETPState): void {
  if (STAGE_INDEX[state] !== undefined) {
    _etpState = state;
  }
}

/** 阶段序号（用于 UI 渐变和比较） */
const STAGE_INDEX: Record<ETPState, number> = {
  normal: 0, rising: 1, elevated: 2, triggered: 3, critical: 4, collapsed: 5,
};

/**
 * 评估 ETP 情绪转折点（v4 — 六阶段）
 *
 * @param metrics 当前实时指标
 * @param session 当前 session
 * @param emotionScore 当前情绪分（用于行为红线快速通道 + 阶段判定）
 */
export function evaluateETP(
  metrics: FMMetrics,
  session: FMSession,
  emotionScore?: number,
): ETPResult {
  // ── 计算动态阈值（基准 × 脆弱系数） ──
  const etpCond = getETPConditions(session);
  const netLoss = Math.max(metrics.current_loss_streak, metrics.net_loss_hands);
  const stagnationHands = countStagnation(session.events);
  const durationMinutes = metrics.elapsed_minutes;

  const conditions: ETPCondition[] = [
    {
      type: 'loss_streak',
      weight: ETP_WEIGHTS.lossStreak,
      met: netLoss >= etpCond.lossStreak,
      current: netLoss,
      threshold: etpCond.lossStreak,
      description: `连输/净输 ${netLoss} 手（阈值 ${etpCond.lossStreak}，脆弱系数 ${etpCond.vulnerability.toFixed(2)}）`,
    },
    {
      type: 'stagnation',
      weight: ETP_WEIGHTS.stagnation,
      met: stagnationHands >= etpCond.stagnation,
      current: stagnationHands,
      threshold: etpCond.stagnation,
      description: `${stagnationHands} 手无明确输赢（阈值 ${etpCond.stagnation}）`,
    },
    {
      type: 'duration',
      weight: ETP_WEIGHTS.duration,
      met: durationMinutes >= etpCond.duration,
      current: Math.round(durationMinutes),
      threshold: etpCond.duration,
      description: `在桌 ${Math.round(durationMinutes)} 分钟（阈值 ${etpCond.duration}）`,
    },
  ];

  const conditionsMet = conditions.filter(c => c.met).length;
  const baseScore = conditions.reduce((sum, c) => sum + (c.met ? c.weight : 0), 0);

  // ── 各条件接近程度（0-1，用于前三阶段判定） ──
  const approachRatios = conditions.map(c => c.threshold > 0 ? c.current / c.threshold : 0);
  const maxApproach = Math.max(...approachRatios);
  const conditionsAbove60 = approachRatios.filter(r => r >= 0.6).length;
  const conditionsAbove80 = approachRatios.filter(r => r >= 0.8).length;

  // ── 行为红线检测 ──
  const tiltBet = detectTiltBetting(session.events, session.plan.base_unit, _activeProfile.bet_raise_tolerance);
  const hasBehaviorRedLine = tiltBet.detected && tiltBet.severity >= 2 && (emotionScore ?? 0) > 30;
  const stopLossBreached = session.plan.stop_loss_amount > 0 && metrics.distance_to_stop_loss <= 0;

  // ── 违规信号检测（用于 triggered→critical 判定） ──
  const hasViolation = (tiltBet.detected && tiltBet.severity >= 1)  // 亏损加码（severity≥1才算违规）
    || (metrics.current_bet_unit > session.plan.base_unit * 1.5)  // 码量突增
    || (metrics.profit_giveback_rate > 80 && metrics.highest_profit > 0);  // 盈利几乎全部回吐

  // ── 六阶段状态转移 ──
  const turningReasons: string[] = [];
  const prevState = _etpState;
  const score = emotionScore ?? 0;

  switch (_etpState) {
    // ── 前三阶段：可逆 ──

    case 'normal': {
      if (stopLossBreached) {
        _etpState = 'collapsed';
        turningReasons.push('止损突破，整场失控');
        _triggerSnapshot = { lossStreak: netLoss, stagnation: stagnationHands, duration: durationMinutes };
      } else if (hasBehaviorRedLine) {
        _etpState = 'triggered';
        _postTriggerViolations = 0;
        turningReasons.push(`亏损后加码 ${tiltBet.count} 次（人性失控信号），直接触达情绪转折点`);
        _triggerSnapshot = { lossStreak: netLoss, stagnation: stagnationHands, duration: durationMinutes };
      } else if (conditionsMet >= 1) {
        _etpState = 'triggered';
        _postTriggerViolations = 0;
        conditions.filter(c => c.met).forEach(c => turningReasons.push(c.description));
        _triggerSnapshot = { lossStreak: netLoss, stagnation: stagnationHands, duration: durationMinutes };
      } else if (score > 50 || conditionsAbove80 >= 1 || conditionsAbove60 >= 2) {
        _etpState = 'elevated';
        turningReasons.push('接近情绪转折点');
      } else if (score > 30 || maxApproach >= 0.6) {
        _etpState = 'rising';
      }
      // else: 保持 normal
      break;
    }

    case 'rising': {
      if (stopLossBreached) {
        _etpState = 'collapsed';
        turningReasons.push('止损突破，整场失控');
        _triggerSnapshot = { lossStreak: netLoss, stagnation: stagnationHands, duration: durationMinutes };
      } else if (hasBehaviorRedLine) {
        _etpState = 'triggered';
        _postTriggerViolations = 0;
        turningReasons.push(`亏损后加码（人性失控信号），直接触达情绪转折点`);
        _triggerSnapshot = { lossStreak: netLoss, stagnation: stagnationHands, duration: durationMinutes };
      } else if (conditionsMet >= 1) {
        _etpState = 'triggered';
        _postTriggerViolations = 0;
        conditions.filter(c => c.met).forEach(c => turningReasons.push(c.description));
        _triggerSnapshot = { lossStreak: netLoss, stagnation: stagnationHands, duration: durationMinutes };
      } else if (score > 50 || conditionsAbove80 >= 1 || conditionsAbove60 >= 2) {
        _etpState = 'elevated';
        turningReasons.push('接近情绪转折点');
      } else if (score <= 25 && maxApproach < 0.4) {
        _etpState = 'normal'; // 回落
      }
      // else: 保持 rising
      break;
    }

    case 'elevated': {
      if (stopLossBreached) {
        _etpState = 'collapsed';
        turningReasons.push('止损突破，整场失控');
        _triggerSnapshot = { lossStreak: netLoss, stagnation: stagnationHands, duration: durationMinutes };
      } else if (hasBehaviorRedLine) {
        _etpState = 'triggered';
        _postTriggerViolations = 0;
        turningReasons.push(`亏损后加码（人性失控信号），直接触达情绪转折点`);
        _triggerSnapshot = { lossStreak: netLoss, stagnation: stagnationHands, duration: durationMinutes };
      } else if (conditionsMet >= 1) {
        _etpState = 'triggered';
        _postTriggerViolations = 0;
        conditions.filter(c => c.met).forEach(c => turningReasons.push(c.description));
        _triggerSnapshot = { lossStreak: netLoss, stagnation: stagnationHands, duration: durationMinutes };
      } else if (score <= 30 && maxApproach < 0.5) {
        _etpState = 'rising'; // 回落到波动
      }
      // else: 保持 elevated
      break;
    }

    // ── 后三阶段：不可逆 ──

    case 'triggered': {
      if (stopLossBreached) {
        _etpState = 'collapsed';
        turningReasons.push('止损突破，整场失控');
        break;
      }

      // 检测违规行为 → 仅在新事件产生时累计（防止同一条件每次刷新都+1）
      const eventCount = session.events.length;
      if (hasViolation && eventCount > _lastViolationEventCount) {
        _postTriggerViolations++;
        _lastViolationEventCount = eventCount;
      }

      // triggered → critical：新的违规行为 或 行为指标恶化
      if (_postTriggerViolations >= 1 || hasAnyIncrease(netLoss, stagnationHands, durationMinutes)) {
        _etpState = 'critical';
        turningReasons.push('情绪转折点后继续操作且出现违规信号，进入上头临界点');
      }
      break;
    }

    case 'critical': {
      if (stopLossBreached) {
        _etpState = 'collapsed';
        turningReasons.push('止损突破，整场失控');
        break;
      }

      // critical → collapsed：任一指标继续恶化
      const furtherDeterioration = hasAnyIncrease(netLoss, stagnationHands, durationMinutes);
      if (furtherDeterioration) {
        _etpState = 'collapsed';
        turningReasons.push('上头临界点后指标继续恶化，确认整场失控');
      }
      break;
    }

    case 'collapsed': {
      // 终点，不可逆
      break;
    }
  }

  // 状态进入不可逆阶段时更新快照
  if (STAGE_INDEX[_etpState] >= 3 && STAGE_INDEX[prevState] < 3) {
    _triggerSnapshot = { lossStreak: netLoss, stagnation: stagnationHands, duration: durationMinutes };
  }
  // critical/collapsed 时也更新快照（用于下一步判定）
  if (_etpState !== prevState && (_etpState === 'critical' || _etpState === 'collapsed')) {
    _triggerSnapshot = { lossStreak: netLoss, stagnation: stagnationHands, duration: durationMinutes };
  }

  // ── 最终分数 ──
  const si = STAGE_INDEX[_etpState];
  const etpScore = si === 5 ? 100                         // collapsed
    : si === 4 ? Math.min(95, baseScore + 20)              // critical
    : si === 3 ? Math.min(80, baseScore + 10)              // triggered
    : si === 2 ? Math.min(60, Math.round(maxApproach * 60)) // elevated
    : si === 1 ? Math.min(40, Math.round(maxApproach * 40)) // rising
    : Math.round(maxApproach * 20);                         // normal

  return {
    etpState: _etpState,
    etpScore,
    conditions,
    conditionsMet,
    triggerCount: _postTriggerViolations,
    turningReasons,
    isTriggered: si >= 3,
    isCollapsed: _etpState === 'collapsed',
    isCritical: _etpState === 'critical',
    stageIndex: si,
  };
}

/** 计算缠斗手数（连续无明确输赢的手数） */
function countStagnation(events: FMEvent[]): number {
  // 缠斗 = 连续的非明确输赢手牌（仅计算实际手牌相关事件）
  // pause/resume/self_check/note/emotion 不是手牌，不算缠斗
  const handTypes = new Set(['win', 'loss', 'tie', 'bet_change']);
  let stagnation = 0;
  let maxStagnation = 0;
  for (const evt of events) {
    if (!handTypes.has(evt.event_type)) continue; // 跳过非手牌事件
    if (evt.event_type === 'win' || evt.event_type === 'loss') {
      if (stagnation > maxStagnation) maxStagnation = stagnation;
      stagnation = 0;
    } else {
      // tie / bet_change = 缠斗（在桌上但无明确输赢）
      stagnation++;
    }
  }
  return Math.max(maxStagnation, stagnation);
}

/** 检测行为指标是否比触发时刻的快照恶化（不含 duration，避免时间流逝自动升级） */
function hasAnyIncrease(
  lossStreak: number,
  stagnation: number,
  _duration: number, // 保留参数签名兼容，但不用于判定
): boolean {
  return (
    lossStreak > _triggerSnapshot.lossStreak
    || stagnation > _triggerSnapshot.stagnation
    // duration 不参与判定：时间永远递增，会导致 triggered 5分钟后必然升级 critical
    // 改为仅检测用户行为（连输/缠斗）是否恶化
  );
}

// ── 扩展 FMMetrics（可选字段） ──
declare module '../types/fundManager' {
  interface FMMetrics {
    tilt_score_snapshot?: number;
  }
}
