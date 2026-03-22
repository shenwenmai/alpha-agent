// ============================================================
// AI 资金管家 — 计算引擎
// 纯函数：指标计算 + 告警规则 + 纪律评分 + 关键时刻
// ============================================================

import type {
  FMSession, FMEvent, FMMetrics, FMAlert, FMKeyMoment,
  FMExecution, FMRuleAnalysis, FMParamSuggestion,
  SessionPlan, AlertLevel, CustomRuleCondition, CustomRule,
  EventStatus, FMDimensionScores,
} from '../types/fundManager';

// ============================================================
// 指标计算
// ============================================================

/** 从事件列表计算完整指标 */
export function computeMetrics(session: FMSession): FMMetrics {
  const { plan, events, start_time } = session;

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
    if (evt.event_type === 'win' && evt.amount != null) {
      netPnl += evt.amount;
      winHands++;
      currentWinStreak++;
      currentLossStreak = 0;
      totalWinAmount += evt.amount;
      if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
      // 从胜负事件追踪码量（+/- 按钮不生成 bet_change 事件，但 bet_unit 字段存了码量）
      if (evt.bet_unit != null) currentBetUnit = evt.bet_unit;
    } else if (evt.event_type === 'loss' && evt.amount != null) {
      netPnl -= evt.amount;
      lossHands++;
      currentLossStreak++;
      currentWinStreak = 0;
      totalLossAmount += evt.amount;
      if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;
      if (evt.bet_unit != null) currentBetUnit = evt.bet_unit;
    } else if (evt.event_type === 'bet_change' && evt.bet_unit != null) {
      currentBetUnit = evt.bet_unit;
    }

    // 追踪峰值
    if (netPnl > highestProfit) highestProfit = netPnl;
    if (netPnl < deepestLoss) deepestLoss = netPnl;
  }

  const totalHands = winHands + lossHands;

  // 计算活跃时间（扣除暂停时间）
  let pausedMs = 0;
  let lastPauseTime: number | null = null;
  for (const evt of events) {
    if (evt.event_type === 'pause') {
      lastPauseTime = new Date(evt.timestamp).getTime();
    } else if (evt.event_type === 'resume' && lastPauseTime) {
      pausedMs += new Date(evt.timestamp).getTime() - lastPauseTime;
      lastPauseTime = null;
    }
  }
  // 如果当前仍在暂停中
  if (lastPauseTime && session.status === 'paused') {
    pausedMs += Date.now() - lastPauseTime;
  }

  const totalElapsedMs = Date.now() - new Date(start_time).getTime();
  const activeMs = Math.max(0, totalElapsedMs - pausedMs);
  const elapsedMinutes = activeMs / 60000;  // 浮点数，保留精度
  const handsPerHour = elapsedMinutes > 0 ? Math.round((totalHands / elapsedMinutes) * 60) : 0;
  const currentBalance = plan.session_budget + netPnl;
  const peakCapital = plan.session_budget + highestProfit;
  const drawdownFromPeak = highestProfit > 0 ? peakCapital - currentBalance : 0;
  const distanceToStopLoss = Math.max(0, plan.stop_loss_amount + netPnl); // 不为负数
  const isInLockProfitZone = netPnl >= plan.lock_profit_trigger;
  const profitSafetyMargin = isInLockProfitZone ? netPnl - plan.lock_profit_floor : 0;
  const remainingMinutes = Math.max(0, plan.max_duration_minutes - elapsedMinutes);

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
    drawdown_pct: peakCapital > 0 && highestProfit > 0 ? Math.round(drawdownFromPeak / peakCapital * 100) : 0,
    profit_giveback_rate: highestProfit > 0 ? Math.round((highestProfit - netPnl) / highestProfit * 100) : 0,
    elapsed_minutes: elapsedMinutes,
    current_bet_unit: currentBetUnit,
    hands_per_hour: handsPerHour,
    avg_win_amount: winHands > 0 ? Math.round(totalWinAmount / winHands) : 0,
    avg_loss_amount: lossHands > 0 ? Math.round(totalLossAmount / lossHands) : 0,
    distance_to_stop_loss: distanceToStopLoss,
    is_in_lock_profit_zone: isInLockProfitZone,
    profit_safety_margin: profitSafetyMargin,
    remaining_minutes: remainingMinutes,
  };
}

// ============================================================
// 告警引擎
// ============================================================

interface AlertRule {
  key: string;
  level: AlertLevel;
  check: (plan: SessionPlan, m: FMMetrics) => boolean;
  message: (plan: SessionPlan, m: FMMetrics) => string;
  voice: (plan: SessionPlan, m: FMMetrics) => string;
}

// ============================================================
// 自定义规则 — 元数据 + 评估器
// ============================================================

/** 条件元数据：用于 UI 表单展示和 NLP 解析 */
export const CUSTOM_RULE_META: Record<CustomRuleCondition, {
  label: string;            // 中文标签
  description: string;      // 通俗解释
  unit: string;             // 单位
  category: '止损' | '止盈' | '纪律' | '统计';
  defaultLevel: AlertLevel;
  defaultThreshold?: number;
}> = {
  loss_streak_gte:     { label: '连输手数止损', description: '连续输的手数达到上限就提醒', unit: '手', category: '止损', defaultLevel: 'strong_alert', defaultThreshold: 5 },
  net_loss_hands_gte:  { label: '净输手数', description: '总输的比赢的多出几手就提醒（输10赢7=净输3手）', unit: '手', category: '止损', defaultLevel: 'strong_alert', defaultThreshold: 8 },
  drawdown_amount_gte: { label: '回撤金额', description: '从峰值资金往下跌了多少钱就提醒（峰值资金=操盘资金+最高盈利）', unit: '元', category: '止损', defaultLevel: 'formal_alert' },
  drawdown_pct_gte:    { label: '最大回撤%', description: '回撤占峰值资金的百分比。公式：(峰值资金−当前余额)÷峰值资金', unit: '%', category: '止损', defaultLevel: 'formal_alert', defaultThreshold: 30 },
  pnl_loss_gte:        { label: '净亏损金额', description: '总共亏了多少钱就提醒', unit: '元', category: '止损', defaultLevel: 'strong_alert' },
  win_streak_gte:      { label: '连赢提醒', description: '连赢太多手容易飘，到了上限提醒你冷静', unit: '手', category: '止盈', defaultLevel: 'early_warning', defaultThreshold: 5 },
  net_win_hands_gte:   { label: '净赢手数', description: '总赢的比输的多出几手就提醒（见好就收）', unit: '手', category: '止盈', defaultLevel: 'early_warning' },
  pnl_profit_gte:      { label: '净盈利金额', description: '总共赚了多少钱就提醒（目标到了该走）', unit: '元', category: '止盈', defaultLevel: 'early_warning' },
  total_hands_gte:     { label: '总手数上限', description: '打了多少手就提醒，防止无节制', unit: '手', category: '纪律', defaultLevel: 'formal_alert', defaultThreshold: 30 },
  single_bet_gte:      { label: '单手码量上限', description: '单手下注超过这个金额就提醒', unit: '元', category: '纪律', defaultLevel: 'formal_alert' },
  win_rate_below:      { label: '胜率下限', description: '胜率低于这个百分比就提醒', unit: '%', category: '统计', defaultLevel: 'early_warning', defaultThreshold: 40 },
  custom_text:         { label: '自定义描述', description: '用你自己的话描述一条规则', unit: '', category: '纪律', defaultLevel: 'formal_alert' },
};

/** 条件评估函数映射（纯函数，不存储） */
export const CUSTOM_RULE_EVALUATORS: Record<
  Exclude<CustomRuleCondition, 'custom_text'>,
  (threshold: number, m: FMMetrics) => boolean
> = {
  win_streak_gte:      (t, m) => m.current_win_streak >= t,
  loss_streak_gte:     (t, m) => m.current_loss_streak >= t,
  total_hands_gte:     (t, m) => m.total_hands >= t,
  drawdown_amount_gte: (t, m) => m.drawdown_from_peak >= t,
  drawdown_pct_gte:    (t, m) => m.drawdown_pct >= t,
  win_rate_below:      (t, m) => m.total_hands >= 5 && (m.win_hands / m.total_hands * 100) < t,
  single_bet_gte:      (t, m) => m.current_bet_unit >= t,
  net_loss_hands_gte:  (t, m) => m.net_loss_hands >= t,
  net_win_hands_gte:   (t, m) => (m.win_hands - m.loss_hands) >= t,
  pnl_loss_gte:        (t, m) => m.net_pnl <= -t,
  pnl_profit_gte:      (t, m) => m.net_pnl >= t,
};

const ALERT_RULES: AlertRule[] = [
  // --- 预警 (黄) ---
  {
    key: 'loss_50pct',
    level: 'early_warning',
    check: (p, m) => {
      const threshold = -p.stop_loss_amount * 0.5;
      const upper = -p.stop_loss_amount * 0.8;
      return m.net_pnl <= threshold && m.net_pnl > upper;
    },
    message: (p, m) => `当前净亏损已达 ${Math.abs(m.net_pnl)}，止损线 ${p.stop_loss_amount}，还差 ${p.stop_loss_amount - Math.abs(m.net_pnl)} 即触发。建议降低节奏，避免冲动加码。`,
    voice: () => '接近止损，请放慢节奏。',
  },
  {
    key: 'streak_warning',
    level: 'early_warning',
    check: (p, m) => m.current_loss_streak >= p.stop_loss_streak_warn && m.current_loss_streak < p.stop_loss_streak,
    message: (p, m) => `你已连续输 ${m.current_loss_streak} 手，距离止损还差 ${p.stop_loss_streak - m.current_loss_streak} 手。`,
    voice: (_, m) => `连输接近上限，已连输${m.current_loss_streak}手。`,
  },
  {
    key: 'time_50pct',
    level: 'early_warning',
    check: (p, m) => {
      const half = p.max_duration_minutes * 0.5;
      const eighty = p.max_duration_minutes * 0.8;
      return m.elapsed_minutes >= half && m.elapsed_minutes < eighty;
    },
    message: (p, m) => `已过半程，${Math.round(m.elapsed_minutes)} 分钟。`,
    voice: () => '时间已过半，请注意节奏。',
  },
  {
    key: 'drawdown_warning',
    level: 'early_warning',
    check: (_, m) => m.highest_profit > 0 && m.drawdown_from_peak >= m.highest_profit * 0.3,
    message: (_, m) => `从最高盈利 +${m.highest_profit} 回撤 ${m.drawdown_from_peak}，注意回撤风险。`,
    voice: () => '盈利明显回撤，请注意。',
  },

  // --- 正式提醒 (橙) ---
  {
    key: 'loss_80pct',
    level: 'formal_alert',
    check: (p, m) => {
      const threshold = -p.stop_loss_amount * 0.8;
      const limit = -p.stop_loss_amount;
      return m.net_pnl <= threshold && m.net_pnl > limit;
    },
    message: (p, m) => `接近止损线！已亏损 ${Math.abs(m.net_pnl)}，止损线 ${p.stop_loss_amount}。`,
    voice: () => '接近止损线，请谨慎。',
  },
  {
    key: 'streak_critical',
    level: 'formal_alert',
    check: (p, m) => m.current_loss_streak === p.stop_loss_streak - 1,
    message: (p, m) => `再输一手即触发止损！已连输 ${m.current_loss_streak} 手。`,
    voice: () => '再输一手即触发止损。',
  },
  {
    key: 'time_80pct',
    level: 'formal_alert',
    check: (p, m) => {
      const eighty = p.max_duration_minutes * 0.8;
      return m.elapsed_minutes >= eighty && m.elapsed_minutes < p.max_duration_minutes;
    },
    message: (_, m) => `时间即将到期，还剩 ${Math.round(m.remaining_minutes)} 分钟。`,
    voice: (_, m) => `还剩${Math.round(m.remaining_minutes)}分钟，请准备结束。`,
  },
  {
    key: 'bet_violation',
    level: 'formal_alert',
    check: (p, m) => p.forbid_raise_in_loss && m.net_pnl < 0 && m.current_bet_unit > p.base_unit,
    message: (p, m) => `你当前处于亏损区，并已加码至 ${m.current_bet_unit}（计划基码 ${p.base_unit}）。这属于高风险行为。`,
    voice: () => '你已偏离原计划码量。',
  },
  {
    key: 'lock_profit_enter',
    level: 'formal_alert',
    check: (p, m) => m.is_in_lock_profit_zone && m.profit_safety_margin > 0,
    message: (p, m) => `已进入锁盈区，当前净盈利 +${m.net_pnl}。按你的规则，建议至少保留 ${p.lock_profit_floor} 的利润。`,
    voice: () => '已进入锁盈区，请注意回撤。',
  },

  // --- 强警告 (红) ---
  {
    key: 'stop_loss_hit',
    level: 'strong_alert',
    check: (p, m) => m.net_pnl <= -p.stop_loss_amount,
    message: (p) => `已触发止损线！当前净亏损已达到 ${p.stop_loss_amount}。根据你开始前确认的方案，现在建议立即结束本场。`,
    voice: () => '已触发止损线，建议立即离场。',
  },
  {
    key: 'streak_hit',
    level: 'strong_alert',
    check: (p, m) => m.current_loss_streak >= p.stop_loss_streak,
    message: (p, m) => `连败止损触发！已连输 ${m.current_loss_streak} 手，超过你设定的 ${p.stop_loss_streak} 手。`,
    voice: (_, m) => `连输${m.current_loss_streak}手，止损触发。`,
  },
  {
    key: 'net_hands_hit',
    level: 'strong_alert',
    check: (p, m) => p.stop_loss_net_hands > 0 && m.net_loss_hands >= p.stop_loss_net_hands,
    message: (p, m) => `净输手数达到止损线！净输 ${m.net_loss_hands} 手（上限 ${p.stop_loss_net_hands}）。`,
    voice: () => '净输手数达到止损线。',
  },
  {
    key: 'time_exceeded',
    level: 'strong_alert',
    check: (p, m) => m.elapsed_minutes >= p.max_duration_minutes,
    message: (p) => `时间到！已超出计划时长 ${p.max_duration_minutes} 分钟。继续下去意味着你正在偏离开局前的规则。`,
    voice: () => '已超过预设时间，请结束本场。',
  },
  {
    key: 'lock_profit_hit',
    level: 'strong_alert',
    // Fix: 使用 highest_profit 判断"曾经进入锁盈区"，不依赖当前 is_in_lock_profit_zone
    check: (p, m) => m.highest_profit >= p.lock_profit_trigger && m.net_pnl <= p.lock_profit_floor,
    message: (p, m) => `锁盈保护线触发！最高盈利 +${m.highest_profit} 已回落到 ${m.net_pnl}，触发你设置的最低保留盈利 ${p.lock_profit_floor}。现在建议锁定盈利，结束本场。`,
    voice: () => '已触发锁盈保护线，建议结束本场。',
  },
];

/** 检查并返回新告警 */
export function checkAlerts(session: FMSession, metrics: FMMetrics): FMAlert[] {
  const newAlerts: FMAlert[] = [];

  // 按 rule_key 找到最近一次告警，用于判断是否需要"二次告警"
  const lastAlertByKey = new Map<string, FMAlert>();
  for (const a of session.alerts) {
    lastAlertByKey.set(a.rule_key, a);
  }

  for (const rule of ALERT_RULES) {
    const conditionMet = rule.check(session.plan, metrics);
    const lastAlert = lastAlertByKey.get(rule.key);

    if (!lastAlert) {
      // 从未触发过 → 正常检测
      if (conditionMet) {
        newAlerts.push({
          id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          level: rule.level,
          rule_key: rule.key,
          message: rule.message(session.plan, metrics),
          voice_message: rule.voice(session.plan, metrics),
          timestamp: new Date().toISOString(),
          dismissed: false,
        });
      }
    } else if (rule.level === 'strong_alert' || rule.level === 'formal_alert') {
      // 关键告警允许二次触发：上次已 dismissed 且距离上次 ≥ 冷却时间
      // strong_alert 冷却30s（更紧迫），formal_alert 冷却60s
      const elapsed = Date.now() - new Date(lastAlert.timestamp).getTime();
      const cooldown = rule.level === 'strong_alert' ? 30_000 : 60_000;
      if (conditionMet && lastAlert.dismissed && elapsed > cooldown) {
        newAlerts.push({
          id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          level: rule.level,
          rule_key: rule.key,
          message: `⚠️ 再次提醒：${rule.message(session.plan, metrics)}`,
          voice_message: rule.voice(session.plan, metrics),
          timestamp: new Date().toISOString(),
          dismissed: false,
        });
      }
    }
    // early_warning 级别仍然只触发一次（避免骚扰）
  }

  // ── 自定义规则评估 ──
  const customRules = session.plan.custom_rules || [];
  for (const cr of customRules) {
    const ruleKey = `custom_${cr.id}`;
    if (lastAlertByKey.has(ruleKey)) continue; // 自定义规则仍然只触发一次
    if (cr.condition === 'custom_text') continue; // 纯文本规则仅做记录，不自动评估

    const evaluator = CUSTOM_RULE_EVALUATORS[cr.condition];
    if (!evaluator) continue;

    if (evaluator(cr.threshold, metrics)) {
      newAlerts.push({
        id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        level: cr.level,
        rule_key: ruleKey,
        message: `自定义规则触发：${cr.label}`,
        voice_message: `${cr.label}，请注意。`,
        timestamp: new Date().toISOString(),
        dismissed: false,
      });
    }
  }

  // ── SBI 多次触发告警（特殊检查，不走 AlertRule 接口）──
  const sbiCount = session.events.filter(e =>
    e.event_type === 'emotion' && e.note?.includes('紧急刹车')
  ).length;
  if (sbiCount >= 2 && !lastAlertByKey.has('sbi_multiple')) {
    newAlerts.push({
      id: `alert_${Date.now()}_sbi`,
      level: 'strong_alert',
      rule_key: 'sbi_multiple',
      message: `你已 ${sbiCount} 次触发紧急刹车，身体和情绪在发出信号，强烈建议立即结束本场。`,
      voice_message: '多次紧急刹车，建议立即结束。',
      timestamp: new Date().toISOString(),
      dismissed: false,
    });
  }

  return newAlerts;
}

// ============================================================
// 纪律评分
// ============================================================

/** 计算纪律评分 (0-100) */
export function computeDisciplineScore(session: FMSession, metrics: FMMetrics): number {
  let score = 100;

  // 强警告每个 -10（排除 SBI 专有告警，SBI 有独立评分逻辑）
  const strongAlerts = session.alerts.filter(a => a.level === 'strong_alert' && a.rule_key !== 'sbi_multiple');
  score -= strongAlerts.length * 10;

  // 正式警告每个 -5
  const formalAlerts = session.alerts.filter(a => a.level === 'formal_alert');
  score -= formalAlerts.length * 5;

  // 止损后继续打 -15（检查止损触发后是否还有赢/输事件）
  const stopLossAlert = session.alerts.find(a => a.rule_key === 'stop_loss_hit');
  if (stopLossAlert) {
    const eventsAfterStopLoss = session.events.filter(e =>
      (e.event_type === 'win' || e.event_type === 'loss') &&
      new Date(e.timestamp) > new Date(stopLossAlert.timestamp)
    );
    if (eventsAfterStopLoss.length > 0) {
      score -= 15;
    }
  }

  // 违规加码次数
  const betChangeEvents = session.events.filter(e => e.event_type === 'bet_change');
  const unauthorizedRaises = betChangeEvents.filter(e => {
    if (!e.bet_unit) return false;
    return e.bet_unit > session.plan.max_bet_unit;
  });
  score -= unauthorizedRaises.length * 10;

  // 规则修改
  const ruleChanges = session.events.filter(e => e.event_type === 'rule_change');
  score -= ruleChanges.length * 5;

  // SBI 紧急刹车评分：首次 +3（自我觉察），2次+ 每次 -5（应该已经结束）
  const sbiEvents = session.events.filter(e =>
    e.event_type === 'emotion' && e.note?.includes('紧急刹车')
  );
  if (sbiEvents.length === 1) {
    score += 3;
  } else if (sbiEvents.length >= 2) {
    score -= (sbiEvents.length - 1) * 5;
  }

  // 奖励：在没有强告警情况下主动结束 +10
  if (strongAlerts.length === 0 && session.status === 'ended') {
    score += 10;
  }

  // 奖励：在锁盈区主动结束 +5
  if (metrics.is_in_lock_profit_zone && session.status === 'ended') {
    score += 5;
  }

  return Math.max(0, Math.min(100, score));
}

// ============================================================
// 关键时刻提取
// ============================================================

/** 从场次中提取关键时刻（含每手走势描述） */
export function identifyKeyMoments(session: FMSession, metrics: FMMetrics): FMKeyMoment[] {
  const moments: FMKeyMoment[] = [];
  const sym = session.plan.currency === 'USD' ? '$' : session.plan.currency === 'HKD' ? 'HK$' : '¥';

  // ── 每手走势描述 ──
  let runningPnl = 0;
  let handNum = 0;
  let peakPnl = 0;
  let peakHand = 0;
  let troughPnl = 0;

  for (const evt of session.events) {
    if (evt.event_type !== 'win' && evt.event_type !== 'loss') continue;
    handNum++;
    const amount = evt.amount || 0;
    if (evt.event_type === 'win') {
      runningPnl += amount;
    } else {
      runningPnl -= amount;
    }

    // 标记关键手：第1手、峰值手、谷底手、转折手、最后一手
    const isFirst = handNum === 1;
    const isNewPeak = runningPnl > peakPnl && runningPnl > 0;
    const isNewTrough = runningPnl < troughPnl && runningPnl < 0;

    if (isNewPeak) { peakPnl = runningPnl; peakHand = handNum; }
    if (isNewTrough) troughPnl = runningPnl;

    const pnlLabel = runningPnl >= 0 ? `+${sym}${runningPnl}` : `-${sym}${Math.abs(runningPnl)}`;
    const changeLabel = evt.event_type === 'win' ? `赢${sym}${amount}` : `输${sym}${amount}`;

    if (isFirst) {
      moments.push({
        timestamp: evt.timestamp,
        description: `第${handNum}手：${changeLabel}，累计 ${pnlLabel}`,
        impact: evt.event_type === 'win' ? 'positive' : 'negative',
      });
    } else if (isNewPeak && runningPnl === metrics.highest_profit && metrics.highest_profit > 0) {
      moments.push({
        timestamp: evt.timestamp,
        description: `第${handNum}手：${changeLabel}，达到本场峰值 ${pnlLabel}`,
        impact: 'positive',
      });
    } else if (isNewTrough && runningPnl === metrics.deepest_loss && metrics.deepest_loss < 0) {
      moments.push({
        timestamp: evt.timestamp,
        description: `第${handNum}手：${changeLabel}，达到本场最大亏损 ${pnlLabel}`,
        impact: 'negative',
      });
    }
  }

  // 最后一手（如果不是第1手也不是峰值/谷底）
  if (handNum > 1) {
    const lastEvt = [...session.events].reverse().find(e => e.event_type === 'win' || e.event_type === 'loss');
    const alreadyAdded = moments.some(m => m.timestamp === lastEvt?.timestamp);
    if (lastEvt && !alreadyAdded) {
      const finalLabel = runningPnl >= 0 ? `+${sym}${runningPnl}` : `-${sym}${Math.abs(runningPnl)}`;
      moments.push({
        timestamp: lastEvt.timestamp,
        description: `第${handNum}手（末手）：最终 ${finalLabel}`,
        impact: runningPnl >= 0 ? 'positive' : 'negative',
      });
    }
  }

  // ── 最长连输时刻 ──
  if (metrics.max_loss_streak >= 3) {
    const streakEnd = findStreakEndEvent(session.events, 'loss', metrics.max_loss_streak);
    if (streakEnd) {
      moments.push({
        timestamp: streakEnd.timestamp,
        description: `连输 ${metrics.max_loss_streak} 手（本场最长）`,
        impact: 'negative',
      });
    }
  }

  // ── 码量变更 ──
  const betChanges = session.events.filter(e => e.event_type === 'bet_change');
  for (const bc of betChanges) {
    moments.push({
      timestamp: bc.timestamp,
      description: `码量调整为 ${sym}${bc.bet_unit}${bc.bet_unit && bc.bet_unit > session.plan.max_bet_unit ? '（超出上限）' : ''}`,
      impact: bc.bet_unit && bc.bet_unit > session.plan.base_unit ? 'negative' : 'neutral',
    });
  }

  // ── 止损触发 ──
  const stopLossAlert = session.alerts.find(a => a.rule_key === 'stop_loss_hit');
  if (stopLossAlert) {
    moments.push({
      timestamp: stopLossAlert.timestamp,
      description: `触发止损线 ${sym}${session.plan.stop_loss_amount}`,
      impact: 'negative',
    });
  }

  // ── 进入锁盈区 ──
  const lockProfitAlert = session.alerts.find(a => a.rule_key === 'lock_profit_enter');
  if (lockProfitAlert) {
    moments.push({
      timestamp: lockProfitAlert.timestamp,
      description: `进入锁盈区（盈利 ≥ ${sym}${session.plan.lock_profit_trigger}）`,
      impact: 'positive',
    });
  }

  // ── SBI 紧急刹车 ──
  const sbiMomentEvents = session.events.filter(e =>
    e.event_type === 'emotion' && e.note?.includes('紧急刹车')
  );
  for (const sbi of sbiMomentEvents) {
    moments.push({
      timestamp: sbi.timestamp,
      description: `触发紧急刹车: ${sbi.note?.replace('紧急刹车: ', '') || '状态异常'}`,
      impact: sbiMomentEvents.length <= 1 ? 'positive' : 'negative',
    });
  }

  // 按时间排序
  moments.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return moments;
}

/** 计算执行情况 */
export function computeExecution(session: FMSession, metrics: FMMetrics): FMExecution {
  return {
    stop_loss_triggered: session.alerts.some(a => a.rule_key === 'stop_loss_hit'),
    lock_profit_triggered: session.alerts.some(a => a.rule_key === 'lock_profit_enter' || a.rule_key === 'lock_profit_hit'),
    time_exceeded: session.alerts.some(a => a.rule_key === 'time_exceeded'),
    unauthorized_raise_count: session.events.filter(e =>
      e.event_type === 'bet_change' && e.bet_unit != null && e.bet_unit > session.plan.max_bet_unit
    ).length,
    plan_modification_count: session.events.filter(e => e.event_type === 'rule_change').length,
  };
}

// ============================================================
// 规则执行分析
// ============================================================

/** 判定事件状态（五级）：违规 / 已触发 / 未触发 / 风险预警 / 行为记录 */
function classifyEventStatus(
  hasRule: boolean,
  wasTriggered: boolean,
  userComplied: boolean,
  isApproaching: boolean,
): EventStatus {
  if (!hasRule) return 'observation';           // 无规则 → 行为记录
  if (wasTriggered && !userComplied) return 'violation'; // 有规则 + 触发 + 没遵守 → 违规
  if (wasTriggered && userComplied) return 'triggered';  // 有规则 + 触发 + 遵守 → 已触发
  if (isApproaching) return 'alert';            // 有规则 + 接近阈值 → 风险预警
  return 'safe'; // 有规则 + 未触发 → ✅ 未触发（安全）
}

/** 生成每条风控规则的执行分析 */
export function generateRuleAnalysis(session: FMSession, metrics: FMMetrics): FMRuleAnalysis[] {
  const plan = session.plan;
  const sym = plan.currency === 'USD' ? '$' : plan.currency === 'HKD' ? 'HK$' : '¥';
  const analysis: FMRuleAnalysis[] = [];
  const alertKeys = new Set(session.alerts.map(a => a.rule_key));

  // 检查用户在告警后是否继续下注
  const didContinueAfterAlert = (ruleKey: string) => {
    const alert = session.alerts.find(a => a.rule_key === ruleKey);
    if (!alert) return false;
    const alertTime = new Date(alert.timestamp).getTime();
    return session.events.some(e =>
      (e.event_type === 'win' || e.event_type === 'loss') &&
      new Date(e.timestamp).getTime() > alertTime
    );
  };

  // 计数告警后继续下注的手数
  const handsAfterAlert = (ruleKey: string) => {
    const alert = session.alerts.find(a => a.rule_key === ruleKey);
    if (!alert) return 0;
    const alertTime = new Date(alert.timestamp).getTime();
    return session.events.filter(e =>
      (e.event_type === 'win' || e.event_type === 'loss') &&
      new Date(e.timestamp).getTime() > alertTime
    ).length;
  };

  // ── 基础规则：止损金额 ──
  const slTriggered = alertKeys.has('stop_loss_hit');
  const slComplied = slTriggered ? !didContinueAfterAlert('stop_loss_hit') : true;
  const slApproaching = !slTriggered && Math.abs(metrics.net_pnl) >= plan.stop_loss_amount * 0.5;
  analysis.push({
    rule_name: `止损金额 ${sym}${plan.stop_loss_amount}`,
    rule_type: 'basic',
    event_status: classifyEventStatus(true, slTriggered, slComplied, slApproaching),
    was_triggered: slTriggered,
    trigger_time: session.alerts.find(a => a.rule_key === 'stop_loss_hit')?.timestamp,
    user_complied: slComplied,
    closest_value: Math.abs(metrics.net_pnl),
    note: slTriggered
      ? (slComplied
        ? '触发止损后及时停手'
        : `触发止损后继续下注 ${handsAfterAlert('stop_loss_hit')} 手`)
      : slApproaching
        ? `接近止损线，当前亏损 ${sym}${Math.abs(Math.round(metrics.net_pnl))}`
        : `未触发，最大亏损 ${sym}${Math.abs(metrics.deepest_loss)}`,
  });

  // ── 基础规则：止盈目标 ──
  const tpTriggered = metrics.highest_profit >= plan.take_profit_amount;
  const tpComplied = tpTriggered ? session.status === 'ended' : true;
  analysis.push({
    rule_name: `止盈目标 ${sym}${plan.take_profit_amount}`,
    rule_type: 'basic',
    event_status: classifyEventStatus(true, tpTriggered, tpComplied, false),
    was_triggered: tpTriggered,
    user_complied: tpComplied,
    closest_value: metrics.highest_profit,
    note: tpTriggered
      ? `最高盈利 ${sym}${metrics.highest_profit}，${tpComplied ? '达标收手' : '达标但继续'}`
      : `最高盈利 ${sym}${metrics.highest_profit}`,
  });

  // ── 基础规则：时间上限 ──
  const timeTriggered = alertKeys.has('time_exceeded');
  const timeComplied = timeTriggered ? !didContinueAfterAlert('time_exceeded') : true;
  const timeApproaching = !timeTriggered && metrics.elapsed_minutes >= plan.max_duration_minutes * 0.8;
  analysis.push({
    rule_name: `时间上限 ${plan.max_duration_minutes}分钟`,
    rule_type: 'basic',
    event_status: classifyEventStatus(true, timeTriggered, timeComplied, timeApproaching),
    was_triggered: timeTriggered,
    user_complied: timeComplied,
    closest_value: Math.round(metrics.elapsed_minutes),
    note: timeTriggered
      ? `已超时 ${Math.round(metrics.elapsed_minutes - plan.max_duration_minutes)} 分钟`
      : timeApproaching
        ? `接近时间上限，已用 ${Math.round(metrics.elapsed_minutes)} 分钟`
        : `用时 ${Math.round(metrics.elapsed_minutes)} 分钟`,
  });

  // ── 进阶规则：连输手数止损 ──
  if (plan.stop_loss_streak > 0) {
    const streakTriggered = alertKeys.has('streak_hit');
    const streakComplied = streakTriggered ? !didContinueAfterAlert('streak_hit') : true;
    const streakApproaching = !streakTriggered && metrics.max_loss_streak >= plan.stop_loss_streak - 1;
    analysis.push({
      rule_name: `连输手数止损 ${plan.stop_loss_streak}手`,
      rule_type: 'advanced',
      event_status: classifyEventStatus(true, streakTriggered, streakComplied, streakApproaching),
      was_triggered: streakTriggered,
      user_complied: streakComplied,
      closest_value: metrics.max_loss_streak,
      note: streakTriggered
        ? (streakComplied
          ? `连输 ${metrics.max_loss_streak} 手触发止损，及时停手`
          : `连输 ${plan.stop_loss_streak} 手触发止损后继续下注 ${handsAfterAlert('streak_hit')} 手`)
        : `最大连输 ${metrics.max_loss_streak} 手`,
    });
  }

  // ── 进阶规则：净输手数止损 ──
  if (plan.stop_loss_net_hands > 0) {
    const nhTriggered = alertKeys.has('net_hands_hit');
    const nhComplied = nhTriggered ? !didContinueAfterAlert('net_hands_hit') : true;
    analysis.push({
      rule_name: `净输手数止损 ${plan.stop_loss_net_hands}手`,
      rule_type: 'advanced',
      event_status: classifyEventStatus(true, nhTriggered, nhComplied, false),
      was_triggered: nhTriggered,
      user_complied: nhComplied,
      closest_value: Math.max(0, metrics.net_loss_hands),
      note: `净输 ${Math.max(0, metrics.net_loss_hands)} 手（输${metrics.loss_hands}手 − 赢${metrics.win_hands}手）`,
    });
  }

  // ── 进阶规则：锁盈（分两步：触发 + 跌破保护线）──
  if (plan.lock_profit_trigger > 0) {
    const lockActivated = metrics.highest_profit >= plan.lock_profit_trigger;
    const lockBreached = alertKeys.has('lock_profit_hit');
    const lockBreachComplied = lockBreached ? !didContinueAfterAlert('lock_profit_hit') : true;

    // 步骤1：锁盈触发（状态变化，不是需要执行的规则）
    analysis.push({
      rule_name: `锁盈触发 ${sym}${plan.lock_profit_trigger}`,
      rule_type: 'advanced',
      event_status: lockActivated ? 'activated' : 'safe',
      was_triggered: lockActivated,
      user_complied: true,
      closest_value: metrics.highest_profit,
      note: lockActivated
        ? `盈利达到 ${sym}${metrics.highest_profit}，锁盈保护已启动`
        : `最高盈利 ${sym}${metrics.highest_profit}，未达到锁盈触发线`,
    });

    // 步骤2：保护线（仅在锁盈已激活时显示）
    if (lockActivated) {
      analysis.push({
        rule_name: `锁盈保护线 ${sym}${plan.lock_profit_floor}`,
        rule_type: 'advanced',
        event_status: lockBreached
          ? classifyEventStatus(true, true, lockBreachComplied, false)
          : (metrics.net_pnl <= plan.lock_profit_floor * 1.2 ? 'alert' : 'safe'),
        was_triggered: lockBreached,
        user_complied: lockBreachComplied,
        closest_value: metrics.net_pnl,
        note: lockBreached
          ? (lockBreachComplied
            ? `盈利回落至 ${sym}${metrics.net_pnl}，跌破保护线 ${sym}${plan.lock_profit_floor}，已停手`
            : `盈利回落至 ${sym}${metrics.net_pnl}，跌破保护线后继续下注 ${handsAfterAlert('lock_profit_hit')} 手`)
          : `当前盈利 ${sym}${metrics.net_pnl}，保护线 ${sym}${plan.lock_profit_floor}`,
      });
    }
  }

  // ── 行为记录：加码行为（如果用户没有设加码规则）──
  const betChanges = session.events.filter(e => e.event_type === 'bet_change' && e.bet_unit && e.bet_unit > plan.base_unit);
  if (betChanges.length > 0) {
    const hasMaxBetRule = plan.max_bet_unit > 0 && plan.max_bet_unit !== plan.base_unit * 2; // 非默认值才算设了规则
    const maxBetUsed = Math.max(...betChanges.map(e => e.bet_unit || 0));
    const exceeded = hasMaxBetRule && maxBetUsed > plan.max_bet_unit;
    analysis.push({
      rule_name: hasMaxBetRule ? `码量上限 ${sym}${plan.max_bet_unit}` : '加码行为',
      rule_type: hasMaxBetRule ? 'basic' : 'custom',
      event_status: hasMaxBetRule
        ? (exceeded ? 'violation' : 'triggered')
        : 'observation',
      was_triggered: exceeded,
      user_complied: !exceeded,
      closest_value: maxBetUsed,
      note: hasMaxBetRule
        ? (exceeded
          ? `${betChanges.length}次加码，最高 ${sym}${maxBetUsed}，超出上限 ${sym}${plan.max_bet_unit}`
          : `${betChanges.length}次加码，最高 ${sym}${maxBetUsed}，未超出上限`)
        : `${betChanges.length}次加码，最高 ${sym}${maxBetUsed}（未设码量上限，记录供参考）`,
    });
  }

  // ── 自定义规则 ──
  const customRules = plan.custom_rules || [];
  for (const cr of customRules) {
    const ruleKey = `custom_${cr.id}`;
    const triggered = alertKeys.has(ruleKey);
    const complied = triggered ? !didContinueAfterAlert(ruleKey) : true;
    analysis.push({
      rule_name: cr.label,
      rule_type: 'custom',
      event_status: classifyEventStatus(true, triggered, complied, false),
      was_triggered: triggered,
      user_complied: complied,
      trigger_time: session.alerts.find(a => a.rule_key === ruleKey)?.timestamp,
      note: triggered
        ? (complied ? '已触发，已遵守' : `已触发，触发后继续下注 ${handsAfterAlert(ruleKey)} 手`)
        : '未触发',
    });
  }

  return analysis;
}

/** 生成参数调整建议 */
export function generateParamSuggestions(session: FMSession, metrics: FMMetrics): FMParamSuggestion[] {
  const plan = session.plan;
  const sym = plan.currency === 'USD' ? '$' : plan.currency === 'HKD' ? 'HK$' : '¥';
  const suggestions: FMParamSuggestion[] = [];

  // 1. 止损金额：如果实际亏损远低于止损线就停了，建议收紧
  if (metrics.net_pnl < 0 && Math.abs(metrics.net_pnl) < plan.stop_loss_amount * 0.5 && session.status === 'ended') {
    const suggested = Math.round(Math.abs(metrics.net_pnl) * 1.2);
    suggestions.push({
      parameter: '止损金额',
      current_value: `${sym}${plan.stop_loss_amount}`,
      suggested_value: `${sym}${suggested}`,
      reason: `实际在亏损 ${sym}${Math.abs(metrics.net_pnl)} 时就结束了，说明你的真实承受力低于设定值`,
      priority: 'high',
    });
  }

  // 2. 回撤严重但没设回撤止损
  const hasDrawdownRule = (plan.custom_rules || []).some(cr =>
    cr.condition === 'drawdown_amount_gte' || cr.condition === 'drawdown_pct_gte'
  );
  const peakCap = plan.session_budget + metrics.highest_profit;
  if (metrics.drawdown_from_peak > peakCap * 0.3 && metrics.highest_profit > 0 && !hasDrawdownRule) {
    suggestions.push({
      parameter: '最大回撤止损',
      current_value: '未设置',
      suggested_value: `回撤 ${Math.round(peakCap * 0.2)} 元提醒`,
      reason: `峰值资金 ${sym}${peakCap}，最大回撤 ${sym}${metrics.drawdown_from_peak}（${metrics.drawdown_pct}%）`,
      priority: 'high',
    });
  }

  // 3. 连输超过 warn 但未达到 stop，说明 streak 设置可能偏大
  if (metrics.max_loss_streak >= plan.stop_loss_streak_warn && metrics.max_loss_streak < plan.stop_loss_streak) {
    if (metrics.net_pnl < 0) { // 输了钱的情况下才建议
      suggestions.push({
        parameter: '连输手数止损',
        current_value: `${plan.stop_loss_streak} 手`,
        suggested_value: `${metrics.max_loss_streak} 手`,
        reason: `最大连输 ${metrics.max_loss_streak} 手时已经亏损较多，建议降低连输手数止损线`,
        priority: 'medium',
      });
    }
  }

  // 4. 没设净输手数止损但净输手数较大
  if (plan.stop_loss_net_hands === 0 && metrics.net_loss_hands > 3) {
    suggestions.push({
      parameter: '净输手数',
      current_value: '未设置',
      suggested_value: `${Math.max(3, Math.round(metrics.net_loss_hands * 0.8))} 手`,
      reason: `本场净输 ${metrics.net_loss_hands} 手，建议设置净输手数止损`,
      priority: 'medium',
    });
  }

  // 5. 超时
  if (metrics.elapsed_minutes > plan.max_duration_minutes * 1.2) {
    suggestions.push({
      parameter: '时间上限',
      current_value: `${plan.max_duration_minutes} 分钟`,
      suggested_value: `${plan.max_duration_minutes} 分钟（严格执行）`,
      reason: '本场超出时间上限较多，长时间操作判断力下降',
      priority: 'medium',
    });
  }

  // 6. 码量违规
  const violations = session.events.filter(e =>
    e.event_type === 'bet_change' && e.bet_unit != null && e.bet_unit > plan.max_bet_unit
  );
  if (violations.length > 0) {
    suggestions.push({
      parameter: '加码纪律',
      current_value: `最大码量 ${sym}${plan.max_bet_unit}`,
      suggested_value: plan.allow_raise_bet ? '关闭加码' : '保持禁止加码',
      reason: `本场 ${violations.length} 次超出码量上限，追码是亏损的主因之一`,
      priority: 'high',
    });
  }

  return suggestions;
}

// ============================================================
// 纪律执行率
// ============================================================

/** 计算纪律执行率：遵守的规则数 ÷ 需要执行的触发规则数 × 100%
 *  只统计 violation 和 triggered（排除 activated/safe/alert/observation）
 *  activated = 状态变化（如锁盈启动），不需要用户执行动作
 */
export function computeDisciplineExecutionRate(ruleAnalysis: FMRuleAnalysis[]): number {
  const actionableTriggered = ruleAnalysis.filter(ra =>
    ra.event_status === 'violation' || ra.event_status === 'triggered'
  );
  if (actionableTriggered.length === 0) return 100; // 没有需要执行的规则被触发 = 100%
  const compliedCount = actionableTriggered.filter(ra => ra.event_status === 'triggered').length;
  return Math.round(compliedCount / actionableTriggered.length * 100);
}

/** 计算风控触发密度：触发规则数 ÷ 总手数 × 100%
 *  触发 = violation + triggered + activated（不含 safe/alert/observation）
 *  密度 > 30% 说明本场策略不稳定
 */
export function computeTriggerDensity(ruleAnalysis: FMRuleAnalysis[], totalHands: number): number {
  if (totalHands === 0) return 0;
  const triggeredCount = ruleAnalysis.filter(ra =>
    ra.event_status === 'violation' || ra.event_status === 'triggered' || ra.event_status === 'activated'
  ).length;
  return Math.round(triggeredCount / totalHands * 100);
}

// ============================================================
// 场次类型分类
// ============================================================

/** 根据场次数据判定场次类型标签 */
export function classifySessionType(
  session: FMSession, metrics: FMMetrics, ruleAnalysis: FMRuleAnalysis[],
): string {
  const violations = ruleAnalysis.filter(ra => ra.event_status === 'violation').length;
  const isShort = metrics.total_hands <= 10;
  const isLong = metrics.total_hands >= 30;
  const isProfit = metrics.net_pnl >= 0;
  const highGiveback = metrics.profit_giveback_rate > 50;
  const isChasing = (() => {
    // 追损判断：止损后继续、或亏损区多次加码
    const slAlert = session.alerts.find(a => a.rule_key === 'stop_loss_hit');
    if (slAlert) {
      const afterCount = session.events.filter(e =>
        (e.event_type === 'win' || e.event_type === 'loss') &&
        new Date(e.timestamp) > new Date(slAlert.timestamp)
      ).length;
      if (afterCount >= 2) return true;
    }
    // 亏损区加码
    const raisesInLoss = session.events.filter(e =>
      e.event_type === 'bet_change' && e.bet_unit && e.bet_unit > session.plan.base_unit
    );
    return raisesInLoss.length >= 2 && metrics.net_pnl < 0;
  })();

  const tags: string[] = [];

  // 主标签
  if (isChasing) {
    tags.push('追损型');
  } else if (violations >= 2) {
    tags.push('纪律违规型');
  } else if (isProfit && highGiveback) {
    tags.push('盈利回吐型');
  } else if (isProfit) {
    tags.push(isShort ? '短局盈利型' : isLong ? '长局盈利型' : '盈利型');
  } else {
    tags.push(isShort ? '短局亏损型' : '亏损控制型');
  }

  // 副标签
  if (violations === 0 && !isChasing) tags.push('纪律良好');
  if (metrics.profit_giveback_rate > 100) tags.push('盈利转亏');

  return tags.join(' + ');
}

// ============================================================
// 四维评分
// ============================================================

/** 计算四维评分：纪律 / 利润管理 / 风险控制 / 情绪控制 */
export function computeDimensionScores(
  session: FMSession, metrics: FMMetrics, ruleAnalysis: FMRuleAnalysis[],
): FMDimensionScores {
  // ── 纪律评分 ──
  let discipline = 100;
  const violations = ruleAnalysis.filter(ra => ra.event_status === 'violation');
  discipline -= violations.length * 15;
  const unauthorizedRaises = session.events.filter(e =>
    e.event_type === 'bet_change' && e.bet_unit && e.bet_unit > session.plan.max_bet_unit
  ).length;
  discipline -= unauthorizedRaises * 10;
  const ruleChanges = session.events.filter(e => e.event_type === 'rule_change').length;
  discipline -= ruleChanges * 8;
  if (metrics.elapsed_minutes > session.plan.max_duration_minutes) discipline -= 10;
  discipline = Math.max(0, Math.min(100, discipline));

  // ── 利润管理评分 ──
  let profitMgmt = 100;
  if (metrics.highest_profit > 0) {
    // 回吐率越高扣分越多
    if (metrics.profit_giveback_rate > 100) profitMgmt -= 40;
    else if (metrics.profit_giveback_rate > 70) profitMgmt -= 30;
    else if (metrics.profit_giveback_rate > 50) profitMgmt -= 20;
    else if (metrics.profit_giveback_rate > 30) profitMgmt -= 10;

    // 锁盈触发后是否保住利润
    const lockActivated = metrics.highest_profit >= session.plan.lock_profit_trigger;
    if (lockActivated && metrics.net_pnl < session.plan.lock_profit_floor) {
      profitMgmt -= 20; // 锁盈后跌破保护线
    } else if (lockActivated && metrics.net_pnl >= session.plan.lock_profit_floor) {
      profitMgmt += 10; // 锁盈成功保护
    }
  } else {
    // 没有盈利过，利润管理不适用，给中性分
    profitMgmt = 60;
  }
  profitMgmt = Math.max(0, Math.min(100, profitMgmt));

  // ── 风险控制评分 ──
  let riskControl = 100;
  if (metrics.drawdown_pct > 30) riskControl -= 20;
  else if (metrics.drawdown_pct > 20) riskControl -= 10;
  // 止损后继续
  const slAlert = session.alerts.find(a => a.rule_key === 'stop_loss_hit');
  if (slAlert) {
    const afterSL = session.events.filter(e =>
      (e.event_type === 'win' || e.event_type === 'loss') &&
      new Date(e.timestamp) > new Date(slAlert.timestamp)
    ).length;
    riskControl -= Math.min(30, afterSL * 10);
  }
  // 亏损区加码
  if (session.plan.forbid_raise_in_loss && metrics.net_pnl < 0) {
    const raisesInLoss = session.events.filter(e =>
      e.event_type === 'bet_change' && e.bet_unit && e.bet_unit > session.plan.base_unit
    ).length;
    riskControl -= raisesInLoss * 10;
  }
  // 有设置风控规则加分
  if ((session.plan.custom_rules || []).length > 0) riskControl += 5;
  riskControl = Math.max(0, Math.min(100, riskControl));

  // ── 情绪控制评分 ──
  let emotionControl = 100;
  const sbiEvents = session.events.filter(e =>
    e.event_type === 'emotion' && e.note?.includes('紧急刹车')
  );
  if (sbiEvents.length === 1) {
    emotionControl -= 5; // 触发一次轻微扣分（有觉察是好的）
  } else if (sbiEvents.length >= 2) {
    emotionControl -= sbiEvents.length * 10;
  }
  // 连输后立即加码（冲动行为）
  let lossStreak = 0;
  for (const evt of session.events) {
    if (evt.event_type === 'loss') lossStreak++;
    else if (evt.event_type === 'win') lossStreak = 0;
    else if (evt.event_type === 'bet_change' && evt.bet_unit && evt.bet_unit > session.plan.base_unit && lossStreak >= 2) {
      emotionControl -= 10; // 连输后加码 = 情绪失控信号
    }
  }
  // 主动暂停加分
  const voluntaryPauses = session.events.filter(e =>
    e.event_type === 'pause' && !e.note?.includes('紧急刹车')
  ).length;
  if (voluntaryPauses > 0) emotionControl += 5;
  emotionControl = Math.max(0, Math.min(100, emotionControl));

  return { discipline, profit_management: profitMgmt, risk_control: riskControl, emotion_control: emotionControl };
}

// ============================================================
// 行为分析（心理维度）
// ============================================================

/** 基于 SBI、加码行为、暂停行为等生成行为分析文本 */
export function generateBehavioralAnalysis(session: FMSession, metrics: FMMetrics): string {
  const parts: string[] = [];

  // SBI 紧急刹车分析
  const sbiEvents = session.events.filter(e =>
    e.event_type === 'emotion' && e.note?.includes('紧急刹车')
  );
  if (sbiEvents.length === 0) {
    // 没触发过紧急刹车
    if (metrics.net_pnl < -session.plan.stop_loss_amount * 0.5) {
      parts.push('本场亏损较大但未使用紧急刹车，建议在感到不适时及时使用，避免情绪累积影响判断。');
    }
  } else if (sbiEvents.length === 1) {
    const reason = sbiEvents[0].note?.replace('紧急刹车: ', '') || '状态异常';
    parts.push(`本场在感知到「${reason}」时主动触发了紧急刹车，说明具备较好的自我觉察能力。这种在情绪干扰下仍能暂停的能力，是长期稳定操盘的关键。`);
  } else {
    parts.push(`本场触发了 ${sbiEvents.length} 次紧急刹车，频繁的身体/情绪信号说明当时状态已不适合继续。建议在第一次触发时就认真考虑结束本场。`);
  }

  // 加码行为模式
  const betChanges = session.events.filter(e => e.event_type === 'bet_change' && e.bet_unit);
  if (betChanges.length > 0) {
    // 分析加码时的盈亏状态
    let pnlAtChange = 0;
    let raisesInLoss = 0;
    let raisesInProfit = 0;
    let idx = 0;
    for (const evt of session.events) {
      if (evt.event_type === 'win' && evt.amount) pnlAtChange += evt.amount;
      else if (evt.event_type === 'loss' && evt.amount) pnlAtChange -= evt.amount;
      else if (evt.event_type === 'bet_change' && evt.bet_unit && evt.bet_unit > session.plan.base_unit) {
        if (pnlAtChange < 0) raisesInLoss++;
        else raisesInProfit++;
      }
      idx++;
    }
    if (raisesInLoss > 0 && raisesInLoss > raisesInProfit) {
      parts.push(`码量调整主要发生在亏损区（${raisesInLoss}次），这是典型的「追损加码」行为模式，容易加速亏损。建议仅在盈利区考虑加码。`);
    } else if (raisesInProfit > 0 && raisesInLoss === 0) {
      parts.push('码量调整均发生在盈利区，属于合理的资金管理行为。');
    }
  }

  // 暂停行为
  const pauseEvents = session.events.filter(e => e.event_type === 'pause');
  const resumeEvents = session.events.filter(e => e.event_type === 'resume');
  if (pauseEvents.length > 0 && sbiEvents.length === 0) {
    parts.push(`本场主动暂停 ${pauseEvents.length} 次，体现了良好的节奏控制。`);
  }

  if (parts.length === 0) {
    parts.push('本场未检测到明显的情绪波动或冲动行为，继续保持冷静操盘。');
  }

  return parts.join('\n');
}

// ============================================================
// 方案校验
// ============================================================

/** 校验解析后的方案 */
export function validateParsedPlan(plan: Partial<SessionPlan>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (plan.session_budget && plan.total_bankroll && plan.session_budget > plan.total_bankroll) {
    errors.push('操盘资金不能超过总资金');
  }
  if (plan.stop_loss_amount && plan.session_budget && plan.stop_loss_amount > plan.session_budget) {
    errors.push('止损金额不应超过操盘资金');
  }
  if (plan.lock_profit_floor && plan.lock_profit_trigger && plan.lock_profit_floor >= plan.lock_profit_trigger) {
    errors.push('最低保留盈利应低于锁盈触发金额');
  }
  if (plan.base_unit && plan.max_bet_unit && plan.base_unit > plan.max_bet_unit) {
    errors.push('基码不应超过最大码量');
  }
  if (plan.stop_loss_streak_warn && plan.stop_loss_streak && plan.stop_loss_streak_warn >= plan.stop_loss_streak) {
    errors.push('连输提醒手数应低于连输手数止损');
  }

  return { valid: errors.length === 0, errors };
}

/** 填充默认值 */
export function fillDefaults(partial: Partial<SessionPlan>): SessionPlan {
  const budget = partial.session_budget || partial.total_bankroll || 5000;

  return {
    session_id: '',
    created_at: new Date().toISOString(),
    input_method: partial.input_method || 'form',
    total_bankroll: partial.total_bankroll || budget,   // 不自动×2，用户只说一个数就是本场资金
    session_budget: budget,
    base_unit: partial.base_unit || Math.round(budget * 0.02),
    currency: partial.currency || 'CNY',
    stop_loss_amount: partial.stop_loss_amount || Math.round(budget * 0.24),
    stop_loss_pct: partial.stop_loss_pct || 24,
    stop_loss_streak: partial.stop_loss_streak ?? 0,    // 0 = 不启用（用户未指定时不默认5手）
    stop_loss_streak_warn: partial.stop_loss_streak_warn || (partial.stop_loss_streak ? partial.stop_loss_streak - 1 : 0),
    stop_loss_net_hands: partial.stop_loss_net_hands || 0, // 0 = 未启用（可选指标）
    max_duration_minutes: partial.max_duration_minutes || 90,
    take_profit_amount: partial.take_profit_amount || Math.round(budget * 0.3),
    take_profit_pct: partial.take_profit_pct || 30,
    lock_profit_trigger: partial.lock_profit_trigger || Math.round(budget * 0.16),
    lock_profit_floor: partial.lock_profit_floor || Math.round(budget * 0.1),
    take_profit_action: partial.take_profit_action || 'suggest',
    allow_raise_bet: partial.allow_raise_bet ?? false,
    max_bet_unit: partial.max_bet_unit || (partial.base_unit ? partial.base_unit * 2 : Math.round(budget * 0.04)),
    allow_raise_in_profit: partial.allow_raise_in_profit ?? true,
    forbid_raise_in_loss: partial.forbid_raise_in_loss ?? true,
    idle_reminder: partial.idle_reminder ?? true,
    reminder_mode: partial.reminder_mode || ['popup'],
    custom_rules: partial.custom_rules || [],
    raw_input: partial.raw_input,
    template_id: partial.template_id,
  };
}

/** 判断风险等级标签 */
export function getRiskLevel(plan: SessionPlan): '保守' | '平衡' | '偏激进' {
  // 标准模板直接映射，避免参数阈值误判
  if (plan.template_id === 'A') return '保守';
  if (plan.template_id === 'B') return '平衡';
  if (plan.template_id === 'C') return '偏激进';

  // 自定义方案（D/E/无模板）：用注单尺寸判断——下注比例是最直接的风险指标
  const betRatio = plan.base_unit / plan.session_budget;
  if (betRatio <= 0.03) return '保守';
  if (betRatio >= 0.06) return '偏激进';
  return '平衡';
}

// ============================================================
// 辅助函数
// ============================================================

function findStreakEndEvent(events: FMEvent[], type: 'win' | 'loss', streakLen: number): FMEvent | null {
  let streak = 0;
  let lastEvent: FMEvent | null = null;

  for (const evt of events) {
    if (evt.event_type === type) {
      streak++;
      lastEvent = evt;
      if (streak === streakLen) return lastEvent;
    } else if (evt.event_type === (type === 'win' ? 'loss' : 'win')) {
      streak = 0;
    }
  }
  return null;
}

function findPeakEvent(events: FMEvent[], budget: number): FMEvent | null {
  let runningPnl = 0;
  let peakPnl = 0;
  let peakEvent: FMEvent | null = null;

  for (const evt of events) {
    if (evt.event_type === 'win' && evt.amount != null) {
      runningPnl += evt.amount;
    } else if (evt.event_type === 'loss' && evt.amount != null) {
      runningPnl -= evt.amount;
    }
    if (runningPnl > peakPnl) {
      peakPnl = runningPnl;
      peakEvent = evt;
    }
  }
  return peakEvent;
}

/** 生成 AI 反馈文本（事件记录后的简短回复） */
export function generateEventFeedback(event: FMEvent, metrics: FMMetrics, plan: SessionPlan): string {
  switch (event.event_type) {
    case 'win':
      return `已记录：赢 ${event.amount}。\n当前净输赢：${metrics.net_pnl >= 0 ? '+' : ''}${metrics.net_pnl}\n${metrics.current_loss_streak > 0 ? '' : `连赢：${metrics.current_win_streak} 手`}`;

    case 'loss':
      return `已记录：输 ${event.amount}。\n当前净输赢：${metrics.net_pnl >= 0 ? '+' : ''}${metrics.net_pnl}\n连输：${metrics.current_loss_streak} 手\n距离止损：还剩 ${metrics.distance_to_stop_loss}`;

    case 'bet_change':
      const withinLimit = (event.bet_unit || 0) <= plan.max_bet_unit;
      return `已记录：当前码量调整为 ${event.bet_unit}。\n${withinLimit ? '仍在允许的最大码量范围内。' : '⚠️ 已超出计划最大码量！'}`;

    case 'pause':
      return `已记录：暂停。\n如果恢复继续，直接告诉我"继续"就可以。`;

    case 'resume':
      return `好的，本场继续。\n当前净输赢：${metrics.net_pnl >= 0 ? '+' : ''}${metrics.net_pnl}\n已用时：${Math.round(metrics.elapsed_minutes)} 分钟`;

    case 'emotion':
      if (event.note?.includes('紧急刹车')) {
        return `紧急刹车已触发，场次已暂停。\n${event.note.replace('紧急刹车: ', '原因: ')}\n正在进入冷静期，请放松呼吸。`;
      }
      return `我记下了你当前的状态：${event.note || '情绪波动'}。\n建议先放慢节奏，必要时暂停几分钟。`;

    default:
      return '已记录。';
  }
}
