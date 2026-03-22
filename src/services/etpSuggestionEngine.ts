// ============================================================
// ETP 建议引擎 — 基于历史实战数据，为用户生成参数调整建议
//
// 数据分级：
//   0 场：无建议
//   1-2 场：基础建议（低置信）
//   3-4 场：初步观察
//   5-9 场：方向性建议
//   10+ 场：高置信建议
//   20+ 场：自动校准
// ============================================================

import type { FMSession, FMEvent, FMAlert, EmotionProfile } from '../types/fundManager';
import { getEndedSessions } from './fundManagerService';
import { supabase, getCurrentUserId } from './supabaseClient';

// ── 建议类型 ──
export type SuggestionConfidence = 'low' | 'medium' | 'high';
export type SuggestionDirection = 'tighten' | 'loosen' | 'keep';

export interface ETPSuggestion {
  param: 'etp_loss_streak' | 'etp_stagnation' | 'etp_duration' | 'bet_raise_tolerance';
  label: string;                   // "连输预警"
  current_value: number;
  suggested_value: number;
  direction: SuggestionDirection;
  confidence: SuggestionConfidence;
  evidence: string;                // "最近5场中，3场在连输2手后开始失控"
  sessions_analyzed: number;
}

export interface ETPHealthReport {
  sessions_analyzed: number;
  suggestions: ETPSuggestion[];
  compliance_rate: number | null;    // 遵守干预的比例（0-100）
  collapse_after_ignore: number | null;  // 忽略提醒后崩盘的比例（0-100）
  overall_status: 'no_data' | 'learning' | 'ready' | 'optimized';
  status_label: string;
}

// ── 时间衰减权重 ──
// 最近的场次权重更高：1周内=1.0, 2周=0.8, 1月=0.5, 2月=0.3, 更早=0.2
function timeDecayWeight(sessionTime: string): number {
  const ageMs = Date.now() - new Date(sessionTime).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays <= 7) return 1.0;
  if (ageDays <= 14) return 0.8;
  if (ageDays <= 30) return 0.5;
  if (ageDays <= 60) return 0.3;
  return 0.2;
}

/** 加权计数：用时间衰减替代简单计数 */
function weightedCount(analyses: SessionAnalysis[], predicate: (a: SessionAnalysis) => boolean): number {
  return analyses.reduce((sum, a) => sum + (predicate(a) ? a.weight : 0), 0);
}

// ── 从 session events 提取分析数据 ──
interface SessionAnalysis {
  sessionId: string;
  totalHands: number;
  maxLossStreak: number;          // 最大连输
  maxStagnation: number;          // 最大缠斗
  durationMinutes: number;        // 总时长
  etpTriggered: boolean;          // 是否触发了 ETP
  etpState: string;               // 最终 ETP 状态
  collapsed: boolean;             // 是否崩盘
  netPnl: number;                 // 最终盈亏
  firstTiltHand: number | null;   // 第一次出现 tilt 信号的手数
  betRaiseDetected: boolean;      // 是否检测到加码
  maxBetMultiple: number;         // 最大码量倍数
  alertsTotal: number;            // 系统发出的告警数
  alertsComplied: number;         // 用户遵守的告警数
  alertsIgnored: number;          // 用户忽略的告警数
  weight: number;                 // 时间衰减权重（0-1）
}

function analyzeSession(session: FMSession): SessionAnalysis {
  const events = session.events || [];
  const alerts = session.alerts || [];

  let maxLossStreak = 0;
  let currentLossStreak = 0;
  let totalHands = 0;
  let wins = 0;
  let losses = 0;
  let stagnationRun = 0;
  let maxStagnation = 0;
  let firstTiltHand: number | null = null;
  let maxBetMultiple = 1;
  let betRaiseDetected = false;

  const baseUnit = session.plan?.base_unit || 100;

  for (const ev of events) {
    if (ev.event_type === 'win' || ev.event_type === 'loss') {
      totalHands++;
      if (ev.event_type === 'loss') {
        losses++;
        currentLossStreak++;
        maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
        // 缠斗：连续赢输交替 → 净差不大
        stagnationRun++;
      } else {
        wins++;
        currentLossStreak = 0;
        stagnationRun++;
      }

      // 检测缠斗：如果净差回到±1以内，累加缠斗计数
      const netDiff = Math.abs(wins - losses);
      if (netDiff <= 2 && totalHands >= 4) {
        maxStagnation = Math.max(maxStagnation, stagnationRun);
      } else {
        stagnationRun = 0;
      }
    }

    if (ev.event_type === 'bet_change' && ev.amount) {
      const multiple = ev.amount / baseUnit;
      maxBetMultiple = Math.max(maxBetMultiple, multiple);
      if (multiple > 1.1) betRaiseDetected = true;
    }

    if (ev.event_type === 'emotion' && firstTiltHand === null) {
      firstTiltHand = totalHands;
    }
  }

  // 告警分析（dismissed=true 表示用户忽略/关闭了提醒）
  let alertsComplied = 0;
  let alertsIgnored = 0;
  for (const alert of alerts) {
    if (alert.dismissed) {
      alertsIgnored++;
    } else {
      alertsComplied++;
    }
  }

  // 时长计算
  const startTime = session.start_time ? new Date(session.start_time).getTime() : 0;
  const endTime = session.end_time ? new Date(session.end_time).getTime() : Date.now();
  const durationMinutes = startTime ? (endTime - startTime) / 60_000 : 0;

  // ETP/崩盘检测
  const etpEvents = events.filter(e => e.note?.includes('ETP') || e.note?.includes('转折'));
  const collapseEvents = events.filter(e => e.note?.includes('崩盘') || e.note?.includes('collapsed'));
  const collapsed = collapseEvents.length > 0 || (
    session.plan?.stop_loss_amount && session.plan.stop_loss_amount > 0 &&
    events.some(e => e.event_type === 'end' && e.note?.includes('止损'))
  );

  return {
    sessionId: session.id,
    totalHands,
    maxLossStreak,
    maxStagnation,
    durationMinutes: Math.round(durationMinutes),
    etpTriggered: etpEvents.length > 0,
    etpState: collapseEvents.length > 0 ? 'collapsed' : etpEvents.length > 0 ? 'triggered' : 'normal',
    collapsed: !!collapsed,
    netPnl: events.reduce((sum, e) => {
      if (e.event_type === 'win') return sum + (e.amount || 0);
      if (e.event_type === 'loss') return sum - (e.amount || 0);
      return sum;
    }, 0),
    firstTiltHand,
    betRaiseDetected,
    maxBetMultiple,
    alertsTotal: alerts.length,
    alertsComplied,
    alertsIgnored,
    weight: timeDecayWeight(session.start_time),
  };
}

// ── 核心：生成建议 ──
export function generateETPSuggestions(profile: EmotionProfile): ETPHealthReport {
  const sessions = getEndedSessions();
  const n = sessions.length;

  if (n === 0) {
    return {
      sessions_analyzed: 0,
      suggestions: [],
      compliance_rate: null,
      collapse_after_ignore: null,
      overall_status: 'no_data',
      status_label: '完成第一场后，系统开始了解你',
    };
  }

  // 分析最近的场次（最多20场）
  const recentSessions = sessions.slice(0, Math.min(n, 20));
  const analyses = recentSessions.map(analyzeSession);

  // 1-2场：给基础建议（不需要统计显著性）
  if (n <= 2) {
    const basicSuggestions: ETPSuggestion[] = [];
    const a = analyses[0];

    // 第1场就能给的建议：基于实际表现
    if (a.collapsed) {
      basicSuggestions.push({
        param: 'etp_loss_streak',
        label: '连输预警',
        current_value: profile.etp_loss_streak,
        suggested_value: Math.max(1, a.maxLossStreak - 1),
        direction: 'tighten',
        confidence: 'low',
        evidence: `你第${n === 1 ? '一' : '二'}场在连输 ${a.maxLossStreak} 手后崩盘。建议把预警提前 1 手。`,
        sessions_analyzed: n,
      });
    }
    if (a.durationMinutes > profile.etp_duration && a.collapsed) {
      basicSuggestions.push({
        param: 'etp_duration',
        label: '在桌时间',
        current_value: profile.etp_duration,
        suggested_value: Math.max(20, Math.round(a.durationMinutes * 0.7)),
        direction: 'tighten',
        confidence: 'low',
        evidence: `你在桌 ${a.durationMinutes} 分钟后崩盘。建议缩短在桌时间。`,
        sessions_analyzed: n,
      });
    }
    if (a.betRaiseDetected && a.maxBetMultiple > 2) {
      basicSuggestions.push({
        param: 'bet_raise_tolerance',
        label: '加码容忍',
        current_value: profile.bet_raise_tolerance,
        suggested_value: Math.max(1.0, Math.round((a.maxBetMultiple * 0.7) * 10) / 10),
        direction: 'tighten',
        confidence: 'low',
        evidence: `你最高加到 ${a.maxBetMultiple.toFixed(1)}x 基码。初期建议保守设置。`,
        sessions_analyzed: n,
      });
    }

    return {
      sessions_analyzed: n,
      suggestions: basicSuggestions,
      compliance_rate: a.alertsTotal > 0 ? Math.round(a.alertsComplied / a.alertsTotal * 100) : null,
      collapse_after_ignore: null,
      overall_status: 'learning',
      status_label: n === 1
        ? '第一场分析完成！再打 2 场后建议更精准'
        : '已分析 2 场，再打 1 场后建议开始可靠',
    };
  }

  const suggestions: ETPSuggestion[] = [];
  // 置信度：考虑场次数量 + 近期数据权重
  const avgWeight = analyses.reduce((s, a) => s + a.weight, 0) / analyses.length;
  const effectiveN = n * avgWeight; // 近期数据多→有效样本量高
  const confidence: SuggestionConfidence = effectiveN >= 8 ? 'high' : effectiveN >= 4 ? 'medium' : 'low';

  // ── 分析1：连输预警阈值 ──
  const lossStreaks = analyses.map(a => a.maxLossStreak).filter(v => v > 0);
  if (lossStreaks.length >= 3) {
    // 加权中位数：近期场次的连输手数更重要
    const sorted = [...lossStreaks].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    // 崩盘场次的连输手数（加权计数判断是否有足够证据）
    const collapsedAnalyses = analyses.filter(a => a.collapsed);
    const collapseWeightedCount = weightedCount(analyses, a => a.collapsed);
    const collapseLossStreaks = collapsedAnalyses.map(a => a.maxLossStreak);
    const collapseMedian = collapseWeightedCount >= 1.5
      ? [...collapseLossStreaks].sort((a, b) => a - b)[Math.floor(collapseLossStreaks.length / 2)]
      : null;

    // 如果崩盘时的连输手数经常 < 当前阈值 → 建议收紧
    if (collapseMedian !== null && collapseMedian < profile.etp_loss_streak) {
      suggestions.push({
        param: 'etp_loss_streak',
        label: '连输预警',
        current_value: profile.etp_loss_streak,
        suggested_value: Math.max(1, collapseMedian),
        direction: 'tighten',
        confidence,
        evidence: `最近 ${analyses.length} 场中，${collapseLossStreaks.length} 场崩盘发生在连输 ${collapseMedian} 手时（你的预警设在 ${profile.etp_loss_streak} 手）`,
        sessions_analyzed: analyses.length,
      });
    } else if (median > profile.etp_loss_streak + 1 && collapseLossStreaks.length === 0) {
      // 从没崩盘且连输远超阈值 → 可以放宽
      suggestions.push({
        param: 'etp_loss_streak',
        label: '连输预警',
        current_value: profile.etp_loss_streak,
        suggested_value: Math.min(median, profile.etp_loss_streak + 1),
        direction: 'loosen',
        confidence,
        evidence: `最近 ${analyses.length} 场你连输中位数 ${median} 手但都没崩盘，当前预警 ${profile.etp_loss_streak} 手可能偏敏感`,
        sessions_analyzed: analyses.length,
      });
    }
  }

  // ── 分析2：在桌时间阈值 ──
  const durations = analyses.map(a => a.durationMinutes).filter(v => v > 10);
  if (durations.length >= 3) {
    // 崩盘场次的时长
    const collapseDurations = analyses.filter(a => a.collapsed).map(a => a.durationMinutes);

    if (collapseDurations.length >= 2) {
      const avgCollapseDuration = Math.round(
        collapseDurations.reduce((s, v) => s + v, 0) / collapseDurations.length
      );

      if (avgCollapseDuration < profile.etp_duration - 5) {
        suggestions.push({
          param: 'etp_duration',
          label: '在桌时间',
          current_value: profile.etp_duration,
          suggested_value: Math.max(20, avgCollapseDuration - 5),
          direction: 'tighten',
          confidence,
          evidence: `你 ${collapseDurations.length} 次崩盘平均发生在 ${avgCollapseDuration} 分钟时（预警设在 ${profile.etp_duration} 分钟）`,
          sessions_analyzed: analyses.length,
        });
      }
    }

    // 如果所有场次都远超时间阈值但没崩 → 放宽
    const avgDuration = Math.round(durations.reduce((s, v) => s + v, 0) / durations.length);
    const collapseCount = analyses.filter(a => a.collapsed).length;
    if (avgDuration > profile.etp_duration + 15 && collapseCount === 0) {
      suggestions.push({
        param: 'etp_duration',
        label: '在桌时间',
        current_value: profile.etp_duration,
        suggested_value: Math.min(avgDuration, profile.etp_duration + 15),
        direction: 'loosen',
        confidence,
        evidence: `最近 ${analyses.length} 场你平均在桌 ${avgDuration} 分钟且无崩盘，预警可以适当延后`,
        sessions_analyzed: analyses.length,
      });
    }
  }

  // ── 分析3：加码容忍度 ──
  const betMultiples = analyses.filter(a => a.betRaiseDetected).map(a => a.maxBetMultiple);
  const collapseWithRaise = analyses.filter(a => a.collapsed && a.betRaiseDetected);
  if (collapseWithRaise.length >= 2) {
    const avgCollapseMultiple = collapseWithRaise.reduce((s, a) => s + a.maxBetMultiple, 0) / collapseWithRaise.length;
    const roundedMultiple = Math.round(avgCollapseMultiple * 10) / 10;

    if (roundedMultiple < profile.bet_raise_tolerance) {
      suggestions.push({
        param: 'bet_raise_tolerance',
        label: '加码容忍',
        current_value: profile.bet_raise_tolerance,
        suggested_value: Math.max(1.0, roundedMultiple - 0.1),
        direction: 'tighten',
        confidence,
        evidence: `${collapseWithRaise.length} 次崩盘都是从加码 ${roundedMultiple}x 开始的（你的容忍度设在 ${profile.bet_raise_tolerance}x）`,
        sessions_analyzed: analyses.length,
      });
    }
  }

  // ── 合规率 + 忽略后崩盘率 ──
  const totalAlerts = analyses.reduce((s, a) => s + a.alertsTotal, 0);
  const totalComplied = analyses.reduce((s, a) => s + a.alertsComplied, 0);
  const totalIgnored = analyses.reduce((s, a) => s + a.alertsIgnored, 0);
  const compliance_rate = totalAlerts > 0 ? Math.round(totalComplied / totalAlerts * 100) : null;

  // 忽略提醒后崩盘率
  const sessionsWithIgnore = analyses.filter(a => a.alertsIgnored > 0);
  const ignoreAndCollapse = sessionsWithIgnore.filter(a => a.collapsed);
  const collapse_after_ignore = sessionsWithIgnore.length >= 2
    ? Math.round(ignoreAndCollapse.length / sessionsWithIgnore.length * 100)
    : null;

  // 整体状态
  let overall_status: ETPHealthReport['overall_status'];
  let status_label: string;
  if (n < 5) {
    overall_status = 'learning';
    status_label = `已分析 ${n} 场，再积累 ${5 - n} 场数据建议更准确`;
  } else if (suggestions.length === 0) {
    overall_status = 'optimized';
    status_label = `基于 ${n} 场数据，你的参数设置目前合理`;
  } else {
    overall_status = 'ready';
    status_label = `基于 ${n} 场数据，发现 ${suggestions.length} 项可优化`;
  }

  return {
    sessions_analyzed: n,
    suggestions,
    compliance_rate,
    collapse_after_ignore,
    overall_status,
    status_label,
  };
}

// ============================================================
// 管道 5: 跨设备建议引擎 — 优先读云端，降级读本地
// ============================================================

/**
 * 云端增强版建议生成
 * 1. 尝试从 Supabase 拉取完整历史 sessions（跨设备）
 * 2. 与本地 sessions 合并去重
 * 3. 用合并后的数据生成建议
 * 4. 如果云端不可用，降级为纯本地
 */
export async function generateETPSuggestionsCloud(
  profile: EmotionProfile,
): Promise<ETPHealthReport> {
  const userId = getCurrentUserId();
  if (!userId) {
    // 未登录 → 纯本地
    return generateETPSuggestions(profile);
  }

  try {
    // 从云端拉取已结束的 sessions
    const { data: cloudSessions, error } = await supabase
      .from('fm_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'ended')
      .order('start_time', { ascending: false })
      .limit(20);

    if (error || !cloudSessions || cloudSessions.length === 0) {
      return generateETPSuggestions(profile);
    }

    // 拉取对应的 events 和 alerts
    const sessionIds = cloudSessions.map(s => s.id);
    const [eventsResult, alertsResult] = await Promise.allSettled([
      supabase.from('fm_events').select('*').in('session_id', sessionIds).order('timestamp'),
      supabase.from('fm_alerts').select('*').in('session_id', sessionIds).order('timestamp'),
    ]);

    const cloudEvents = eventsResult.status === 'fulfilled' ? (eventsResult.value.data || []) : [];
    const cloudAlerts = alertsResult.status === 'fulfilled' ? (alertsResult.value.data || []) : [];

    // 组装为 FMSession 格式
    const assembled: FMSession[] = cloudSessions.map(row => ({
      id: row.id,
      plan: row.plan,
      status: row.status,
      start_time: row.start_time,
      end_time: row.end_time || undefined,
      events: cloudEvents
        .filter((e: Partial<FMEvent> & { session_id: string }) => e.session_id === row.id)
        .map((e: Partial<FMEvent> & { session_id: string }) => ({
          id: e.id!,
          session_id: e.session_id,
          event_type: e.event_type!,
          amount: e.amount != null ? Number(e.amount) : undefined,
          bet_unit: e.bet_unit != null ? Number(e.bet_unit) : undefined,
          note: e.note || undefined,
          raw_input: e.raw_input || undefined,
          timestamp: e.timestamp!,
        })),
      alerts: cloudAlerts
        .filter((a: Partial<FMAlert> & { session_id: string }) => a.session_id === row.id)
        .map((a: Partial<FMAlert> & { session_id: string }) => ({
          id: a.id!,
          level: a.level!,
          rule_key: a.rule_key!,
          message: a.message!,
          voice_message: a.voice_message || undefined,
          timestamp: a.timestamp!,
          dismissed: a.dismissed!,
        })),
      is_archived: row.is_archived,
      review: row.review || undefined,
    }));

    // 与本地合并去重（以 session id 为 key，本地优先）
    const localSessions = getEndedSessions();
    const localIds = new Set(localSessions.map(s => s.id));
    const merged = [
      ...localSessions,
      ...assembled.filter(s => !localIds.has(s.id)),
    ];

    // 按时间排序（最新在前）
    merged.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());

    // 用合并数据生成建议
    return generateFromSessions(merged, profile);
  } catch (e) {
    console.error('[etpSuggestionEngine] cloud read failed, fallback to local:', e);
    return generateETPSuggestions(profile);
  }
}

/**
 * 内部：从给定的 sessions 列表生成建议（复用核心逻辑）
 */
function generateFromSessions(sessions: FMSession[], profile: EmotionProfile): ETPHealthReport {
  // 复用主函数的逻辑（含1-2场基础建议）
  // 临时替换 getEndedSessions 的数据源
  const n = sessions.length;

  if (n === 0) {
    return {
      sessions_analyzed: 0,
      suggestions: [],
      compliance_rate: null,
      collapse_after_ignore: null,
      overall_status: 'no_data',
      status_label: '完成第一场后，系统开始了解你',
    };
  }

  const recentSessions = sessions.slice(0, Math.min(n, 20));
  const analyses = recentSessions.map(analyzeSession);

  // 1-2场基础建议
  if (n <= 2) {
    const basicSuggestions: ETPSuggestion[] = [];
    const a = analyses[0];
    if (a.collapsed) {
      basicSuggestions.push({
        param: 'etp_loss_streak', label: '连输预警',
        current_value: profile.etp_loss_streak,
        suggested_value: Math.max(1, a.maxLossStreak - 1),
        direction: 'tighten', confidence: 'low',
        evidence: `你在连输 ${a.maxLossStreak} 手后崩盘。建议把预警提前。`,
        sessions_analyzed: n,
      });
    }
    return {
      sessions_analyzed: n,
      suggestions: basicSuggestions,
      compliance_rate: null,
      collapse_after_ignore: null,
      overall_status: 'learning',
      status_label: `已分析 ${n} 场，再积累数据建议更准确`,
    };
  }

  const suggestions: ETPSuggestion[] = [];
  const avgWeight = analyses.reduce((s, a) => s + a.weight, 0) / analyses.length;
  const effectiveN = n * avgWeight;
  const confidence: SuggestionConfidence = effectiveN >= 8 ? 'high' : effectiveN >= 4 ? 'medium' : 'low';

  // 分析1：连输预警阈值
  const lossStreaks = analyses.map(a => a.maxLossStreak).filter(v => v > 0);
  if (lossStreaks.length >= 3) {
    const sorted = [...lossStreaks].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const collapsedAnalyses = analyses.filter(a => a.collapsed);
    const collapseWeightedCount = weightedCount(analyses, a => a.collapsed);
    const collapseLossStreaks = collapsedAnalyses.map(a => a.maxLossStreak);
    const collapseMedian = collapseWeightedCount >= 1.5
      ? [...collapseLossStreaks].sort((a, b) => a - b)[Math.floor(collapseLossStreaks.length / 2)]
      : null;

    if (collapseMedian !== null && collapseMedian < profile.etp_loss_streak) {
      suggestions.push({
        param: 'etp_loss_streak', label: '连输预警',
        current_value: profile.etp_loss_streak,
        suggested_value: Math.max(1, collapseMedian),
        direction: 'tighten', confidence,
        evidence: `最近 ${analyses.length} 场中，${collapseLossStreaks.length} 场崩盘发生在连输 ${collapseMedian} 手时（你的预警设在 ${profile.etp_loss_streak} 手）`,
        sessions_analyzed: analyses.length,
      });
    } else if (median > profile.etp_loss_streak + 1 && collapseLossStreaks.length === 0) {
      suggestions.push({
        param: 'etp_loss_streak', label: '连输预警',
        current_value: profile.etp_loss_streak,
        suggested_value: Math.min(median, profile.etp_loss_streak + 1),
        direction: 'loosen', confidence,
        evidence: `最近 ${analyses.length} 场你连输中位数 ${median} 手但都没崩盘，当前预警 ${profile.etp_loss_streak} 手可能偏敏感`,
        sessions_analyzed: analyses.length,
      });
    }
  }

  // 分析2：在桌时间阈值
  const durations = analyses.map(a => a.durationMinutes).filter(v => v > 10);
  if (durations.length >= 3) {
    const collapseDurations = analyses.filter(a => a.collapsed).map(a => a.durationMinutes);
    if (collapseDurations.length >= 2) {
      const avgCollapseDuration = Math.round(
        collapseDurations.reduce((s, v) => s + v, 0) / collapseDurations.length,
      );
      if (avgCollapseDuration < profile.etp_duration - 5) {
        suggestions.push({
          param: 'etp_duration', label: '在桌时间',
          current_value: profile.etp_duration,
          suggested_value: Math.max(20, avgCollapseDuration - 5),
          direction: 'tighten', confidence,
          evidence: `你 ${collapseDurations.length} 次崩盘平均发生在 ${avgCollapseDuration} 分钟时（预警设在 ${profile.etp_duration} 分钟）`,
          sessions_analyzed: analyses.length,
        });
      }
    }
    const avgDuration = Math.round(durations.reduce((s, v) => s + v, 0) / durations.length);
    const collapseCount = analyses.filter(a => a.collapsed).length;
    if (avgDuration > profile.etp_duration + 15 && collapseCount === 0) {
      suggestions.push({
        param: 'etp_duration', label: '在桌时间',
        current_value: profile.etp_duration,
        suggested_value: Math.min(avgDuration, profile.etp_duration + 15),
        direction: 'loosen', confidence,
        evidence: `最近 ${analyses.length} 场你平均在桌 ${avgDuration} 分钟且无崩盘，预警可以适当延后`,
        sessions_analyzed: analyses.length,
      });
    }
  }

  // 分析3：加码容忍度
  const collapseWithRaise = analyses.filter(a => a.collapsed && a.betRaiseDetected);
  if (collapseWithRaise.length >= 2) {
    const avgCollapseMultiple = collapseWithRaise.reduce((s, a) => s + a.maxBetMultiple, 0) / collapseWithRaise.length;
    const roundedMultiple = Math.round(avgCollapseMultiple * 10) / 10;
    if (roundedMultiple < profile.bet_raise_tolerance) {
      suggestions.push({
        param: 'bet_raise_tolerance', label: '加码容忍',
        current_value: profile.bet_raise_tolerance,
        suggested_value: Math.max(1.0, roundedMultiple - 0.1),
        direction: 'tighten', confidence,
        evidence: `${collapseWithRaise.length} 次崩盘都是从加码 ${roundedMultiple}x 开始的（你的容忍度设在 ${profile.bet_raise_tolerance}x）`,
        sessions_analyzed: analyses.length,
      });
    }
  }

  // 合规率 + 忽略后崩盘率
  const totalAlerts = analyses.reduce((s, a) => s + a.alertsTotal, 0);
  const totalComplied = analyses.reduce((s, a) => s + a.alertsComplied, 0);
  const compliance_rate = totalAlerts > 0 ? Math.round(totalComplied / totalAlerts * 100) : null;
  const sessionsWithIgnore = analyses.filter(a => a.alertsIgnored > 0);
  const ignoreAndCollapse = sessionsWithIgnore.filter(a => a.collapsed);
  const collapse_after_ignore = sessionsWithIgnore.length >= 2
    ? Math.round(ignoreAndCollapse.length / sessionsWithIgnore.length * 100)
    : null;

  let overall_status: ETPHealthReport['overall_status'];
  let status_label: string;
  if (n < 5) {
    overall_status = 'learning';
    status_label = `已分析 ${n} 场，再积累 ${5 - n} 场数据建议更准确`;
  } else if (suggestions.length === 0) {
    overall_status = 'optimized';
    status_label = `基于 ${n} 场数据，你的参数设置目前合理`;
  } else {
    overall_status = 'ready';
    status_label = `基于 ${n} 场数据，发现 ${suggestions.length} 项可优化`;
  }

  return {
    sessions_analyzed: n,
    suggestions,
    compliance_rate,
    collapse_after_ignore,
    overall_status,
    status_label,
  };
}
