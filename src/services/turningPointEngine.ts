// ============================================================
// 情绪转折点检测引擎 — Turning Point Engine
// 找到每场中情绪发生质变的精确时刻
// 逐事件回放 → 比较前后 emotion level → 标记转折点
// ============================================================

import { computeEmotion, type EmotionLevel } from './emotionEngine';
import type { FMSession, FMEvent, FMMetrics } from '../types/fundManager';

// ── 转折点 ──
export interface TurningPoint {
  timestamp: string;
  eventIndex: number;
  fromLevel: EmotionLevel;
  toLevel: EmotionLevel;
  triggerEvent: FMEvent;
  triggerSignals: string[];
  description: string;
  elapsedMinutes: number;
  context: {
    beforePnl: number;
    afterPnl: number;
    betBefore: number;
    betAfter: number;
  };
}

// ── 跨场次模式 ──
export interface TurningPointPattern {
  patternType: 'time_based' | 'loss_based' | 'streak_based' | 'bet_based';
  description: string;
  confidence: number;        // 0-1
  occurrences: number;
  totalSessions: number;
  recommendation: string;
}

// ── 等级序号（用于比较升降） ──
const LEVEL_ORDER: Record<EmotionLevel, number> = {
  calm: 0, mild: 1, moderate: 2, severe: 3,
};

const LEVEL_LABEL: Record<EmotionLevel, string> = {
  calm: '平静', mild: '注意', moderate: '警惕', severe: '危险',
};

// ── 从事件列表增量构建 FMMetrics ──
function buildMetrics(
  plan: FMSession['plan'],
  events: FMEvent[],
  startTime: string,
): FMMetrics {
  let netPnl = 0;
  let winHands = 0;
  let lossHands = 0;
  let currentWinStreak = 0;
  let currentLossStreak = 0;
  let maxWinStreak = 0;
  let maxLossStreak = 0;
  let highestProfit = 0;
  let deepestLoss = 0;
  let currentBetUnit = plan.base_unit;
  let totalWinAmount = 0;
  let totalLossAmount = 0;

  for (const evt of events) {
    if (evt.event_type === 'win') {
      const amt = evt.amount ?? currentBetUnit;
      netPnl += amt;
      winHands++;
      currentWinStreak++;
      currentLossStreak = 0;
      totalWinAmount += amt;
      if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
    } else if (evt.event_type === 'loss') {
      const amt = evt.amount ?? currentBetUnit;
      netPnl -= amt;
      lossHands++;
      currentLossStreak++;
      currentWinStreak = 0;
      totalLossAmount += amt;
      if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;
    } else if (evt.event_type === 'bet_change' && evt.bet_unit != null) {
      currentBetUnit = evt.bet_unit;
    }

    if (netPnl > highestProfit) highestProfit = netPnl;
    if (netPnl < deepestLoss) deepestLoss = netPnl;
  }

  const totalHands = winHands + lossHands;
  const currentBalance = plan.session_budget + netPnl;
  const peakBalance = plan.session_budget + highestProfit;
  const drawdownFromPeak = Math.max(0, peakBalance - currentBalance);
  const drawdownPct = peakBalance > 0 ? (drawdownFromPeak / peakBalance) * 100 : 0;
  const profitGivebackRate = highestProfit > 0
    ? Math.max(0, ((highestProfit - Math.max(0, netPnl)) / highestProfit) * 100)
    : 0;

  const lastEventTime = events.length > 0
    ? new Date(events[events.length - 1].timestamp).getTime()
    : new Date(startTime).getTime();
  const elapsedMs = lastEventTime - new Date(startTime).getTime();
  const elapsedMinutes = Math.max(0, elapsedMs / 60000);
  const remainingMinutes = plan.max_duration_minutes > 0
    ? plan.max_duration_minutes - elapsedMinutes
    : 999;

  const handsPerHour = elapsedMinutes > 0 ? totalHands / (elapsedMinutes / 60) : 0;
  const distanceToStopLoss = plan.stop_loss_amount > 0
    ? Math.max(0, plan.stop_loss_amount - Math.abs(Math.min(0, netPnl)))
    : 999;

  const isInLockProfitZone = plan.lock_profit_trigger > 0 && netPnl >= plan.lock_profit_trigger;
  const profitSafetyMargin = isInLockProfitZone ? netPnl - plan.lock_profit_floor : 0;

  return {
    net_pnl: netPnl,
    current_balance: currentBalance,
    total_hands: totalHands,
    win_hands: winHands,
    loss_hands: lossHands,
    current_win_streak: currentWinStreak,
    current_loss_streak: currentLossStreak,
    max_win_streak: maxWinStreak,
    max_loss_streak: maxLossStreak,
    net_loss_hands: lossHands - winHands,
    highest_profit: highestProfit,
    deepest_loss: deepestLoss,
    drawdown_from_peak: drawdownFromPeak,
    drawdown_pct: drawdownPct,
    profit_giveback_rate: profitGivebackRate,
    elapsed_minutes: elapsedMinutes,
    current_bet_unit: currentBetUnit,
    hands_per_hour: handsPerHour,
    avg_win_amount: winHands > 0 ? totalWinAmount / winHands : 0,
    avg_loss_amount: lossHands > 0 ? totalLossAmount / lossHands : 0,
    distance_to_stop_loss: distanceToStopLoss,
    is_in_lock_profit_zone: isInLockProfitZone,
    profit_safety_margin: profitSafetyMargin,
    remaining_minutes: remainingMinutes,
  };
}

/** 生成转折点的人可读描述 */
function describeTransition(
  from: EmotionLevel,
  to: EmotionLevel,
  event: FMEvent,
  signals: string[],
): string {
  const isEscalation = LEVEL_ORDER[to] > LEVEL_ORDER[from];
  const direction = isEscalation ? '升级' : '恢复';
  const signalText = signals.length > 0 ? `，触发信号：${signals.join('、')}` : '';
  const eventDesc = event.event_type === 'win' ? '赢一手'
    : event.event_type === 'loss' ? '输一手'
    : event.event_type === 'bet_change' ? '变更码量'
    : event.event_type === 'rule_change' ? '修改规则'
    : event.event_type === 'self_check' ? '即时自检'
    : event.event_type === 'pause' ? '暂停'
    : event.event_type === 'resume' ? '继续'
    : event.event_type === 'emotion' ? '情绪标记'
    : event.event_type === 'note' ? '备注'
    : event.event_type === 'end' ? '结束'
    : event.event_type;

  return isEscalation
    ? `状态${direction}：${LEVEL_LABEL[from]} → ${LEVEL_LABEL[to]}（${eventDesc}${signalText}）`
    : `状态${direction}：${LEVEL_LABEL[from]} → ${LEVEL_LABEL[to]}（${eventDesc}，状态好转）`;
}

// ── 核心函数 ──

/**
 * 分析单场，找出所有情绪转折点
 * 逐事件回放，每个事件后重新计算情绪，比较前后 level
 */
export function detectTurningPoints(session: FMSession): TurningPoint[] {
  const points: TurningPoint[] = [];
  if (session.events.length === 0) return points;

  let prevLevel: EmotionLevel = 'calm';
  let prevPnl = 0;
  let prevBet = session.plan.base_unit;

  for (let i = 0; i < session.events.length; i++) {
    const partialEvents = session.events.slice(0, i + 1);
    const partialSession: FMSession = { ...session, events: partialEvents };
    const metrics = buildMetrics(session.plan, partialEvents, session.start_time);
    const emotion = computeEmotion(partialSession, metrics);

    // 检测 level 变化（升级=恶化 或 降级=恢复）
    if (LEVEL_ORDER[emotion.level] !== LEVEL_ORDER[prevLevel]) {
      const event = session.events[i];
      const elapsedMs = new Date(event.timestamp).getTime() - new Date(session.start_time).getTime();

      points.push({
        timestamp: event.timestamp,
        eventIndex: i,
        fromLevel: prevLevel,
        toLevel: emotion.level,
        triggerEvent: event,
        triggerSignals: emotion.signals.map(s => s.type),
        description: describeTransition(prevLevel, emotion.level, event, emotion.signals.map(s => s.description)),
        elapsedMinutes: Math.max(0, elapsedMs / 60000),
        context: {
          beforePnl: prevPnl,
          afterPnl: metrics.net_pnl,
          betBefore: prevBet,
          betAfter: metrics.current_bet_unit,
        },
      });
    }

    prevLevel = emotion.level;
    prevPnl = metrics.net_pnl;
    prevBet = metrics.current_bet_unit;
  }

  return points;
}

/**
 * 跨场次分析，找出规律性转折模式
 * 维度：时间、亏损金额、连败手数、码量变化
 */
export function analyzePatterns(sessions: FMSession[]): TurningPointPattern[] {
  const patterns: TurningPointPattern[] = [];
  const totalSessions = sessions.length;
  if (totalSessions < 2) return patterns;

  // 收集所有转折点
  const allPoints: TurningPoint[] = [];
  for (const s of sessions) {
    allPoints.push(...detectTurningPoints(s));
  }
  if (allPoints.length === 0) return patterns;

  // ── 1. 时间模式 ──
  // 按 10 分钟区间分桶
  const timeBuckets = new Map<number, number>();
  for (const p of allPoints) {
    const bucket = Math.floor(p.elapsedMinutes / 10) * 10;
    timeBuckets.set(bucket, (timeBuckets.get(bucket) ?? 0) + 1);
  }
  // 找最密集的时间区间
  let peakBucket = 0;
  let peakCount = 0;
  for (const [bucket, count] of timeBuckets) {
    if (count > peakCount) { peakBucket = bucket; peakCount = count; }
  }
  if (peakCount >= 2) {
    const confidence = Math.min(1, peakCount / totalSessions);
    patterns.push({
      patternType: 'time_based',
      description: `你通常在第 ${peakBucket}-${peakBucket + 10} 分钟开始情绪波动`,
      confidence,
      occurrences: peakCount,
      totalSessions,
      recommendation: peakBucket > 0
        ? `建议将最大时长设为 ${peakBucket} 分钟，或在第 ${peakBucket} 分钟强制休息`
        : '建议开局前做好心理准备，前 10 分钟尤其注意节奏',
    });
  }

  // ── 2. 亏损模式 ──
  // 收集转折点时的亏损金额
  const lossAmounts = allPoints
    .filter(p => p.context.afterPnl < 0)
    .map(p => Math.abs(p.context.afterPnl));
  if (lossAmounts.length >= 2) {
    lossAmounts.sort((a, b) => a - b);
    const median = lossAmounts[Math.floor(lossAmounts.length / 2)];
    // 统计在中位数 ±30% 范围内的次数
    const nearMedian = lossAmounts.filter(
      a => a >= median * 0.7 && a <= median * 1.3,
    ).length;
    if (nearMedian >= 2) {
      patterns.push({
        patternType: 'loss_based',
        description: `你通常在亏损约 ${Math.round(median)} 时开始失控`,
        confidence: Math.min(1, nearMedian / totalSessions),
        occurrences: nearMedian,
        totalSessions,
        recommendation: `建议将止损设为 ${Math.round(median * 0.8)}，在情绪失控前离场`,
      });
    }
  }

  // ── 3. 连败模式 ──
  // 收集转折点时触发了 loss_streak 信号的情况
  const streakPoints = allPoints.filter(
    p => p.triggerSignals.includes('loss_streak'),
  );
  if (streakPoints.length >= 2) {
    // 从描述中提取连败数（粗略方式：看触发事件前的连败数）
    // 统计频率
    patterns.push({
      patternType: 'streak_based',
      description: `连败是你最常见的情绪触发器，在 ${streakPoints.length} 个转折点中出现`,
      confidence: Math.min(1, streakPoints.length / allPoints.length),
      occurrences: streakPoints.length,
      totalSessions,
      recommendation: '建议设置连败自动暂停：连输 3 手后强制休息 2 分钟',
    });
  }

  // ── 4. 码量模式 ──
  // 检测转折点时是否伴随码量剧增
  const betJumps = allPoints.filter(
    p => p.context.betAfter > p.context.betBefore * 1.5,
  );
  if (betJumps.length >= 2) {
    const avgMultiple = betJumps.reduce(
      (sum, p) => sum + (p.context.betBefore > 0 ? p.context.betAfter / p.context.betBefore : 1), 0,
    ) / betJumps.length;
    patterns.push({
      patternType: 'bet_based',
      description: `你的情绪转折常伴随码量激增（平均涨 ${avgMultiple.toFixed(1)} 倍）`,
      confidence: Math.min(1, betJumps.length / allPoints.length),
      occurrences: betJumps.length,
      totalSessions,
      recommendation: `建议设置最大码量为基码的 ${Math.max(2, Math.round(avgMultiple * 0.6))} 倍，防止情绪化加码`,
    });
  }

  return patterns;
}
