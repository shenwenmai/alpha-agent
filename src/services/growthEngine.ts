// ============================================================
// 成长分析引擎 — Growth Engine
// 从历史场次数据中提炼长期画像
// 维度：基码分析、时间分析、亏损阈值、连败阈值、错误模式
// ============================================================

import { detectTurningPoints } from './turningPointEngine';
import type { FMSession, FMMetrics, FMEvent } from '../types/fundManager';

// ── 成长画像 ──
export interface GrowthProfile {
  totalSessions: number;
  totalHands: number;
  avgDisciplineScore: number;
  disciplineTrend: 'improving' | 'declining' | 'stable';

  optimalBaseUnit: {
    recommended: number;
    range: [number, number];
    reasoning: string;
  };

  dangerZones: {
    timeWindows: Array<{
      minuteRange: [number, number];
      riskLevel: 'medium' | 'high';
      description: string;
    }>;
    lossThresholds: Array<{
      amount: number;
      description: string;
    }>;
    streakThresholds: Array<{
      count: number;
      description: string;
    }>;
  };

  commonErrors: Array<{
    type: string;
    frequency: number;
    description: string;
    suggestion: string;
  }>;

  turningPointSummary: {
    avgPerSession: number;
    mostCommonTrigger: string;
    avgTimeToFirstTilt: number;
  };
}

// ── 辅助：从场次获取终态指标 ──
function getSessionMetrics(session: FMSession): FMMetrics | null {
  return session.review?.metrics ?? null;
}

/** 计算简易指标（用于没有 review 的场次） */
function computeBasicMetrics(session: FMSession): {
  totalHands: number;
  disciplineScore: number;
  maxLossStreak: number;
  netPnl: number;
  elapsedMinutes: number;
  baseUnit: number;
  maxBetUnit: number;
  unauthorizedRaises: number;
} {
  let netPnl = 0;
  let winHands = 0;
  let lossHands = 0;
  let maxLossStreak = 0;
  let currentLossStreak = 0;
  let currentBet = session.plan.base_unit;
  let maxBet = session.plan.base_unit;
  let unauthorizedRaises = 0;
  let lastResult: 'win' | 'loss' | null = null;

  for (const evt of session.events) {
    if (evt.event_type === 'win') {
      netPnl += evt.amount ?? currentBet;
      winHands++;
      currentLossStreak = 0;
      lastResult = 'win';
    } else if (evt.event_type === 'loss') {
      netPnl -= evt.amount ?? currentBet;
      lossHands++;
      currentLossStreak++;
      if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;
      lastResult = 'loss';
    } else if (evt.event_type === 'bet_change' && evt.bet_unit != null) {
      // 亏损区加码视为违规
      if (lastResult === 'loss' && evt.bet_unit > currentBet && session.plan.forbid_raise_in_loss) {
        unauthorizedRaises++;
      }
      currentBet = evt.bet_unit;
      if (currentBet > maxBet) maxBet = currentBet;
    }
  }

  const totalHands = winHands + lossHands;
  const elapsedMs = session.events.length > 0
    ? new Date(session.events[session.events.length - 1].timestamp).getTime() -
      new Date(session.start_time).getTime()
    : 0;

  // 简易纪律分：100 分起，每次违规 -10，超时 -15，超止损 -20
  let disciplineScore = 100;
  disciplineScore -= unauthorizedRaises * 10;
  if (session.plan.max_duration_minutes > 0 && elapsedMs / 60000 > session.plan.max_duration_minutes) {
    disciplineScore -= 15;
  }
  if (session.plan.stop_loss_amount > 0 && Math.abs(Math.min(0, netPnl)) > session.plan.stop_loss_amount) {
    disciplineScore -= 20;
  }
  disciplineScore = Math.max(0, Math.min(100, disciplineScore));

  return {
    totalHands,
    disciplineScore,
    maxLossStreak,
    netPnl,
    elapsedMinutes: Math.max(0, elapsedMs / 60000),
    baseUnit: session.plan.base_unit,
    maxBetUnit: maxBet,
    unauthorizedRaises,
  };
}

// ── 核心函数 ──

/**
 * 生成完整成长画像
 * 分析所有历史场次，提炼 5 个维度的长期数据
 */
export function generateProfile(sessions: FMSession[]): GrowthProfile {
  if (sessions.length === 0) {
    return emptyProfile();
  }

  // 收集每场的基础数据
  const sessionData = sessions.map(s => {
    const reviewMetrics = getSessionMetrics(s);
    const basic = computeBasicMetrics(s);
    return {
      session: s,
      metrics: reviewMetrics,
      basic,
      disciplineScore: s.review?.discipline_score ?? basic.disciplineScore,
    };
  });

  const totalHands = sessionData.reduce((sum, d) => sum + d.basic.totalHands, 0);
  const disciplineScores = sessionData.map(d => d.disciplineScore);
  const avgDisciplineScore = disciplineScores.length > 0
    ? Math.round(disciplineScores.reduce((a, b) => a + b, 0) / disciplineScores.length)
    : 0;

  // ── 1. 纪律趋势 ──
  const disciplineTrend = analyzeTrend(disciplineScores);

  // ── 2. 基码分析 ──
  const optimalBaseUnit = analyzeOptimalBaseUnit(sessionData);

  // ── 3. 危险区域 ──
  const dangerZones = analyzeDangerZones(sessions, sessionData);

  // ── 4. 常见错误 ──
  const commonErrors = analyzeCommonErrors(sessions, sessionData);

  // ── 5. 转折点摘要 ──
  const turningPointSummary = analyzeTurningPointSummary(sessions);

  return {
    totalSessions: sessions.length,
    totalHands,
    avgDisciplineScore,
    disciplineTrend,
    optimalBaseUnit,
    dangerZones,
    commonErrors,
    turningPointSummary,
  };
}

// ── 分析子函数 ──

/** 分析纪律分趋势 */
function analyzeTrend(scores: number[]): 'improving' | 'declining' | 'stable' {
  if (scores.length < 3) return 'stable';

  // 简单线性回归斜率
  const n = scores.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += scores[i];
    sumXY += i * scores[i];
    sumX2 += i * i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

  if (slope > 1) return 'improving';
  if (slope < -1) return 'declining';
  return 'stable';
}

/** 分析最优基码 */
function analyzeOptimalBaseUnit(
  sessionData: Array<{ basic: ReturnType<typeof computeBasicMetrics>; disciplineScore: number }>,
): GrowthProfile['optimalBaseUnit'] {
  if (sessionData.length === 0) {
    return { recommended: 100, range: [50, 200], reasoning: '数据不足，使用默认推荐' };
  }

  // 按纪律分排序，取前 30% 的场次
  const sorted = [...sessionData].sort((a, b) => b.disciplineScore - a.disciplineScore);
  const topCount = Math.max(1, Math.ceil(sorted.length * 0.3));
  const topSessions = sorted.slice(0, topCount);

  const baseUnits = topSessions.map(s => s.basic.baseUnit).filter(u => u > 0);
  if (baseUnits.length === 0) {
    return { recommended: 100, range: [50, 200], reasoning: '数据不足，使用默认推荐' };
  }

  baseUnits.sort((a, b) => a - b);
  const median = baseUnits[Math.floor(baseUnits.length / 2)];
  const min = baseUnits[0];
  const max = baseUnits[baseUnits.length - 1];

  return {
    recommended: median,
    range: [min, max],
    reasoning: `分析了 ${sessionData.length} 场数据，纪律分最高的 ${topCount} 场使用的基码在 ${min}-${max} 之间，中位数 ${median}`,
  };
}

/** 分析危险区域 */
function analyzeDangerZones(
  sessions: FMSession[],
  sessionData: Array<{ basic: ReturnType<typeof computeBasicMetrics> }>,
): GrowthProfile['dangerZones'] {
  // 时间窗口分析：收集所有转折点的时间
  const allPoints = sessions.flatMap(s => detectTurningPoints(s));
  const timeBuckets = new Map<number, number>();
  for (const p of allPoints) {
    const bucket = Math.floor(p.elapsedMinutes / 10) * 10;
    timeBuckets.set(bucket, (timeBuckets.get(bucket) ?? 0) + 1);
  }

  const timeWindows: GrowthProfile['dangerZones']['timeWindows'] = [];
  for (const [bucket, count] of timeBuckets) {
    if (count >= 2) {
      const ratio = count / sessions.length;
      timeWindows.push({
        minuteRange: [bucket, bucket + 10],
        riskLevel: ratio >= 0.5 ? 'high' : 'medium',
        description: `第 ${bucket}-${bucket + 10} 分钟出现了 ${count} 次情绪转折`,
      });
    }
  }
  timeWindows.sort((a, b) => b.minuteRange[0] - a.minuteRange[0]);

  // 亏损阈值：转折点时的亏损金额聚类
  const lossThresholds: GrowthProfile['dangerZones']['lossThresholds'] = [];
  const lossAmounts = allPoints
    .filter(p => p.context.afterPnl < 0)
    .map(p => Math.abs(p.context.afterPnl));
  if (lossAmounts.length >= 2) {
    lossAmounts.sort((a, b) => a - b);
    const median = lossAmounts[Math.floor(lossAmounts.length / 2)];
    lossThresholds.push({
      amount: Math.round(median),
      description: `亏损约 ${Math.round(median)} 时最容易情绪失控（${lossAmounts.length} 次记录）`,
    });
  }

  // 连败阈值：统计导致情绪升级的连败手数
  const streakThresholds: GrowthProfile['dangerZones']['streakThresholds'] = [];
  const maxStreaks = sessionData.map(d => d.basic.maxLossStreak).filter(s => s >= 3);
  if (maxStreaks.length >= 2) {
    maxStreaks.sort((a, b) => a - b);
    const median = maxStreaks[Math.floor(maxStreaks.length / 2)];
    streakThresholds.push({
      count: median,
      description: `连输 ${median} 手后最容易冲动加码（${maxStreaks.length} 场出现）`,
    });
  }

  return { timeWindows, lossThresholds, streakThresholds };
}

/** 分析常见错误 */
function analyzeCommonErrors(
  sessions: FMSession[],
  sessionData: Array<{ basic: ReturnType<typeof computeBasicMetrics>; session: FMSession }>,
): GrowthProfile['commonErrors'] {
  const errors: GrowthProfile['commonErrors'] = [];
  const totalSessions = sessions.length;

  // 错误 1：亏损区加码
  const tiltCount = sessionData.filter(d => d.basic.unauthorizedRaises > 0).length;
  if (tiltCount > 0) {
    errors.push({
      type: 'tilt_betting',
      frequency: tiltCount / totalSessions,
      description: `${tiltCount}/${totalSessions} 场出现亏损区加码`,
      suggestion: '开启"亏损区禁止加码"，设置最大码量上限',
    });
  }

  // 错误 2：超时
  const overtimeCount = sessionData.filter(d => {
    if (d.session.plan.max_duration_minutes <= 0) return false;
    return d.basic.elapsedMinutes > d.session.plan.max_duration_minutes;
  }).length;
  if (overtimeCount > 0) {
    errors.push({
      type: 'overtime',
      frequency: overtimeCount / totalSessions,
      description: `${overtimeCount}/${totalSessions} 场超出计划时长`,
      suggestion: '设置更严格的时间提醒，超时后自动结束场次',
    });
  }

  // 错误 3：突破止损
  const breachCount = sessionData.filter(d => {
    if (d.session.plan.stop_loss_amount <= 0) return false;
    return Math.abs(Math.min(0, d.basic.netPnl)) > d.session.plan.stop_loss_amount;
  }).length;
  if (breachCount > 0) {
    errors.push({
      type: 'stop_loss_breach',
      frequency: breachCount / totalSessions,
      description: `${breachCount}/${totalSessions} 场突破止损线`,
      suggestion: '在接近止损时加大提醒力度，考虑降低止损金额',
    });
  }

  // 错误 4：码量波动过大
  const volatileCount = sessionData.filter(d => {
    return d.basic.maxBetUnit > d.basic.baseUnit * 3;
  }).length;
  if (volatileCount > 0) {
    errors.push({
      type: 'bet_volatility',
      frequency: volatileCount / totalSessions,
      description: `${volatileCount}/${totalSessions} 场码量波动超过 3 倍基码`,
      suggestion: '设置最大码量为基码的 2 倍，减少情绪化调码',
    });
  }

  // 错误 5：中途改规则
  const ruleChangeCount = sessionData.filter(d =>
    d.session.events.some(e => e.event_type === 'rule_change'),
  ).length;
  if (ruleChangeCount > 0) {
    errors.push({
      type: 'rule_change',
      frequency: ruleChangeCount / totalSessions,
      description: `${ruleChangeCount}/${totalSessions} 场中途修改规则`,
      suggestion: '开场前充分设定规则，实战中锁定计划不可修改',
    });
  }

  // 按频率排序
  errors.sort((a, b) => b.frequency - a.frequency);
  return errors;
}

/** 分析转折点摘要 */
function analyzeTurningPointSummary(sessions: FMSession[]): GrowthProfile['turningPointSummary'] {
  if (sessions.length === 0) {
    return { avgPerSession: 0, mostCommonTrigger: '无数据', avgTimeToFirstTilt: 0 };
  }

  const allSessionPoints = sessions.map(s => detectTurningPoints(s));
  const totalPoints = allSessionPoints.reduce((sum, pts) => sum + pts.length, 0);
  const avgPerSession = Math.round((totalPoints / sessions.length) * 10) / 10;

  // 最常见的触发信号
  const signalCounts = new Map<string, number>();
  for (const pts of allSessionPoints) {
    for (const p of pts) {
      for (const sig of p.triggerSignals) {
        signalCounts.set(sig, (signalCounts.get(sig) ?? 0) + 1);
      }
    }
  }
  let mostCommonTrigger = '无数据';
  let maxCount = 0;
  for (const [sig, count] of signalCounts) {
    if (count > maxCount) { mostCommonTrigger = sig; maxCount = count; }
  }

  // 首次 tilt 的平均时间
  const firstTiltTimes: number[] = [];
  for (const pts of allSessionPoints) {
    if (pts.length > 0) {
      firstTiltTimes.push(pts[0].elapsedMinutes);
    }
  }
  const avgTimeToFirstTilt = firstTiltTimes.length > 0
    ? Math.round(firstTiltTimes.reduce((a, b) => a + b, 0) / firstTiltTimes.length)
    : 0;

  // 翻译信号名称
  const SIGNAL_LABELS: Record<string, string> = {
    loss_streak: '连败',
    tilt_betting: '亏损加码',
    near_stop_loss: '接近止损',
    profit_giveback: '盈利回吐',
    overtime: '超时',
    near_timeout: '接近超时',
    bet_volatility: '码量波动',
    euphoria_raise: '连赢加码',
  };
  mostCommonTrigger = SIGNAL_LABELS[mostCommonTrigger] ?? mostCommonTrigger;

  return { avgPerSession, mostCommonTrigger, avgTimeToFirstTilt };
}

/** 空画像（无数据时返回） */
function emptyProfile(): GrowthProfile {
  return {
    totalSessions: 0,
    totalHands: 0,
    avgDisciplineScore: 0,
    disciplineTrend: 'stable',
    optimalBaseUnit: {
      recommended: 100,
      range: [50, 200],
      reasoning: '暂无数据，使用默认推荐',
    },
    dangerZones: {
      timeWindows: [],
      lossThresholds: [],
      streakThresholds: [],
    },
    commonErrors: [],
    turningPointSummary: {
      avgPerSession: 0,
      mostCommonTrigger: '无数据',
      avgTimeToFirstTilt: 0,
    },
  };
}
