// ============================================================
// 教练引擎 — Coaching Engine
// 整合成长画像 + ETP 建议 + 历史场次，生成个性化教练建议
//
// 三大输出：
//   1. 场前提醒（基于历史危险模式）
//   2. 改进清单（基于最近一场复盘）
//   3. 成长趋势（纪律分/崩盘率/转折点时间线）
// ============================================================

import { getEndedSessions, getActiveSession, analyzeTemplateEffectiveness } from './fundManagerService';
import { generateProfile, type GrowthProfile } from './growthEngine';
import { detectTurningPoints } from './turningPointEngine';
import type { FMSession } from '../types/fundManager';

// ── 教练提示 ──
export interface CoachingTip {
  id: string;
  icon: string;
  title: string;
  body: string;
  priority: 'high' | 'medium' | 'low';
  source: 'growth' | 'etp' | 'review' | 'pattern' | 'template';
}

// ── 改进项 ──
export interface ImprovementItem {
  text: string;
  done: boolean;
  category: 'discipline' | 'emotion' | 'strategy' | 'time';
}

// ── 趋势数据点 ──
export interface TrendPoint {
  sessionIndex: number;
  date: string;             // 日期标签
  disciplineScore: number;  // 0-100
  collapsed: boolean;
  turningPointMinute: number | null;  // 首次转折时间
  netPnl: number;
}

// ── 教练面板数据 ──
export interface CoachingDashboard {
  // 头部状态
  totalSessions: number;
  currentStreak: number;        // 连续未崩盘场次
  overallGrade: 'S' | 'A' | 'B' | 'C' | 'D';
  gradeLabel: string;

  // 场前提醒
  preGameTips: CoachingTip[];

  // 改进清单（基于最近一场）
  improvements: ImprovementItem[];
  lastSessionSummary: string | null;

  // 成长趋势
  trend: TrendPoint[];

  // 模板建议
  templateTip: string | null;
}

// ── 核心函数 ──

export function generateCoachingDashboard(): CoachingDashboard {
  const sessions = getEndedSessions();
  const n = sessions.length;

  if (n === 0) {
    return emptyDashboard();
  }

  const profile = generateProfile(sessions);
  const recentSessions = sessions.slice(0, Math.min(n, 10));

  return {
    totalSessions: n,
    currentStreak: calcNonCollapseStreak(sessions),
    ...calcGrade(profile, sessions),
    preGameTips: generatePreGameTips(profile, sessions),
    ...generateImprovements(sessions[0]),
    trend: generateTrend(recentSessions),
    templateTip: generateTemplateTip(),
  };
}

// ── 评级 ──

function calcGrade(profile: GrowthProfile, sessions: FMSession[]): {
  overallGrade: CoachingDashboard['overallGrade'];
  gradeLabel: string;
} {
  const d = profile.avgDisciplineScore;
  const collapseRate = calcCollapseRate(sessions);
  // 综合得分 = 纪律分 * 0.6 + (100 - 崩盘率) * 0.4
  const composite = d * 0.6 + (100 - collapseRate) * 0.4;

  if (composite >= 90) return { overallGrade: 'S', gradeLabel: '大师级自控力' };
  if (composite >= 75) return { overallGrade: 'A', gradeLabel: '纪律优秀' };
  if (composite >= 60) return { overallGrade: 'B', gradeLabel: '逐步进步中' };
  if (composite >= 40) return { overallGrade: 'C', gradeLabel: '需要更多练习' };
  return { overallGrade: 'D', gradeLabel: '情绪管理待加强' };
}

function calcCollapseRate(sessions: FMSession[]): number {
  if (sessions.length === 0) return 0;
  const collapseCount = sessions.filter(s =>
    s.events.some(e => e.note?.includes('崩盘') || e.note?.includes('collapsed')),
  ).length;
  return Math.round((collapseCount / sessions.length) * 100);
}

function calcNonCollapseStreak(sessions: FMSession[]): number {
  let streak = 0;
  for (const s of sessions) {
    const hasCollapse = s.events.some(e =>
      e.note?.includes('崩盘') || e.note?.includes('collapsed'),
    );
    if (hasCollapse) break;
    streak++;
  }
  return streak;
}

// ── 场前提醒 ──

function generatePreGameTips(profile: GrowthProfile, sessions: FMSession[]): CoachingTip[] {
  const tips: CoachingTip[] = [];

  // 1. 危险时间窗口
  if (profile.dangerZones.timeWindows.length > 0) {
    const tw = profile.dangerZones.timeWindows[0];
    tips.push({
      id: 'time_danger',
      icon: '⏰',
      title: '注意时间窗口',
      body: `你在第 ${tw.minuteRange[0]}-${tw.minuteRange[1]} 分钟最容易情绪波动。到时间后主动休息 2 分钟。`,
      priority: tw.riskLevel === 'high' ? 'high' : 'medium',
      source: 'growth',
    });
  }

  // 2. 常见错误提醒
  if (profile.commonErrors.length > 0) {
    const topError = profile.commonErrors[0];
    tips.push({
      id: 'top_error',
      icon: '⚠️',
      title: `警惕：${topError.type === 'tilt_betting' ? '亏损加码' : topError.type === 'overtime' ? '超时' : topError.type === 'stop_loss_breach' ? '突破止损' : topError.type}`,
      body: topError.suggestion,
      priority: topError.frequency > 0.5 ? 'high' : 'medium',
      source: 'pattern',
    });
  }

  // 3. 转折点预警
  const tpSummary = profile.turningPointSummary;
  if (tpSummary.avgTimeToFirstTilt > 0) {
    tips.push({
      id: 'tilt_time',
      icon: '🔔',
      title: '转折点时间',
      body: `你通常在第 ${Math.round(tpSummary.avgTimeToFirstTilt)} 分钟出现首次情绪转折。今天试着在那之前主动暂停。`,
      priority: 'medium',
      source: 'etp',
    });
  }

  // 4. 最近趋势
  if (profile.disciplineTrend === 'declining') {
    tips.push({
      id: 'trend_warning',
      icon: '📉',
      title: '纪律分下滑中',
      body: '最近几场纪律分在走低。今天的目标：不追求赢，只追求纪律执行到位。',
      priority: 'high',
      source: 'growth',
    });
  } else if (profile.disciplineTrend === 'improving') {
    tips.push({
      id: 'trend_good',
      icon: '📈',
      title: '状态上升中',
      body: '你的纪律分在持续进步，保持这个节奏！',
      priority: 'low',
      source: 'growth',
    });
  }

  // 5. 连败阈值提醒
  if (profile.dangerZones.streakThresholds.length > 0) {
    const st = profile.dangerZones.streakThresholds[0];
    tips.push({
      id: 'streak_warn',
      icon: '🛑',
      title: `连败 ${st.count} 手后暂停`,
      body: st.description,
      priority: 'medium',
      source: 'pattern',
    });
  }

  // 6. 基码建议
  if (profile.optimalBaseUnit.recommended > 0 && sessions.length >= 3) {
    const last = sessions[0];
    if (last.plan.base_unit > profile.optimalBaseUnit.range[1]) {
      tips.push({
        id: 'base_unit',
        icon: '💰',
        title: '基码偏高',
        body: `你上场基码 ${last.plan.base_unit}，但历史数据建议 ${profile.optimalBaseUnit.range[0]}-${profile.optimalBaseUnit.range[1]}。考虑降低基码减轻压力。`,
        priority: 'medium',
        source: 'growth',
      });
    }
  }

  // 按优先级排序
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  tips.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  return tips;
}

// ── 改进清单 ──

function generateImprovements(lastSession: FMSession): {
  improvements: ImprovementItem[];
  lastSessionSummary: string | null;
} {
  if (!lastSession) {
    return { improvements: [], lastSessionSummary: null };
  }

  const improvements: ImprovementItem[] = [];
  const events = lastSession.events;
  const plan = lastSession.plan;

  // 计算基础数据
  let netPnl = 0;
  let maxBet = plan.base_unit;
  let lossStreak = 0;
  let maxLossStreak = 0;
  let overtimeMinutes = 0;

  for (const e of events) {
    if (e.event_type === 'win') netPnl += e.amount || 0;
    if (e.event_type === 'loss') {
      netPnl -= e.amount || 0;
      lossStreak++;
      maxLossStreak = Math.max(maxLossStreak, lossStreak);
    } else {
      lossStreak = 0;
    }
    if (e.event_type === 'bet_change' && e.bet_unit) {
      maxBet = Math.max(maxBet, e.bet_unit);
    }
  }

  const startTime = new Date(lastSession.start_time).getTime();
  const endTime = lastSession.end_time ? new Date(lastSession.end_time).getTime() : Date.now();
  const durationMin = (endTime - startTime) / 60000;

  if (plan.max_duration_minutes > 0 && durationMin > plan.max_duration_minutes) {
    overtimeMinutes = Math.round(durationMin - plan.max_duration_minutes);
  }

  // 生成改进项
  if (maxBet > plan.base_unit * 2) {
    improvements.push({
      text: `控制码量：上场最高到 ${maxBet}，超过基码 ${Math.round(maxBet / plan.base_unit)}倍。下场目标：不超过 2 倍。`,
      done: false,
      category: 'discipline',
    });
  }

  if (overtimeMinutes > 0) {
    improvements.push({
      text: `时间管理：上场超时 ${overtimeMinutes} 分钟。下场设好闹钟，到时即走。`,
      done: false,
      category: 'time',
    });
  }

  if (maxLossStreak >= 3) {
    improvements.push({
      text: `连败应对：上场最长连输 ${maxLossStreak} 手。下场连输 3 手后强制暂停 2 分钟。`,
      done: false,
      category: 'emotion',
    });
  }

  if (plan.stop_loss_amount > 0 && Math.abs(Math.min(0, netPnl)) > plan.stop_loss_amount) {
    improvements.push({
      text: `止损纪律：上场突破了 ${plan.stop_loss_amount} 的止损线。下场严格遵守，到线即停。`,
      done: false,
      category: 'discipline',
    });
  }

  // 有违规加码
  const raisesInLoss = events.filter((e, i) => {
    if (e.event_type !== 'bet_change' || !e.bet_unit) return false;
    const prev = events.slice(0, i).filter(ev => ev.event_type === 'loss');
    return prev.length > 0 && e.bet_unit > plan.base_unit;
  }).length;
  if (raisesInLoss > 0 && plan.forbid_raise_in_loss) {
    improvements.push({
      text: `亏损区加码 ${raisesInLoss} 次。这是最危险的行为，下场绝对禁止。`,
      done: false,
      category: 'discipline',
    });
  }

  // 转折点恢复
  const turningPoints = detectTurningPoints(lastSession);
  const recoveries = turningPoints.filter(tp => tp.fromLevel !== 'calm' && tp.toLevel === 'calm');
  if (recoveries.length > 0) {
    improvements.push({
      text: `上场有 ${recoveries.length} 次情绪恢复，说明你有自我调节能力。继续保持！`,
      done: true,
      category: 'emotion',
    });
  }

  // 摘要
  const winLoss = netPnl >= 0 ? `赢 ${netPnl}` : `亏 ${Math.abs(netPnl)}`;
  const totalHands = events.filter(e => e.event_type === 'win' || e.event_type === 'loss').length;
  const lastSessionSummary = `上场：${totalHands} 手，${winLoss}，用时 ${Math.round(durationMin)} 分钟`;

  return { improvements, lastSessionSummary };
}

// ── 成长趋势 ──

function generateTrend(recentSessions: FMSession[]): TrendPoint[] {
  // 按时间正序（旧→新）
  const sorted = [...recentSessions].reverse();

  return sorted.map((s, idx) => {
    let netPnl = 0;
    let discipline = 70; // 默认

    for (const e of s.events) {
      if (e.event_type === 'win') netPnl += e.amount || 0;
      if (e.event_type === 'loss') netPnl -= e.amount || 0;
    }

    if (s.review?.discipline_score != null) {
      discipline = s.review.discipline_score;
    }

    const collapsed = s.events.some(e =>
      e.note?.includes('崩盘') || e.note?.includes('collapsed'),
    );

    // 首次转折时间
    const tps = detectTurningPoints(s);
    const escalations = tps.filter(tp => tp.fromLevel === 'calm');
    const firstTiltMin = escalations.length > 0 ? Math.round(escalations[0].elapsedMinutes) : null;

    const date = new Date(s.start_time);
    const dateLabel = `${date.getMonth() + 1}/${date.getDate()}`;

    return {
      sessionIndex: idx,
      date: dateLabel,
      disciplineScore: discipline,
      collapsed,
      turningPointMinute: firstTiltMin,
      netPnl,
    };
  });
}

// ── 模板建议 ──

function generateTemplateTip(): string | null {
  const effectiveness = analyzeTemplateEffectiveness();
  if (effectiveness.length === 0) return null;

  const good = effectiveness.filter(t => t.verdict === 'good');
  const bad = effectiveness.filter(t => t.verdict === 'bad');

  if (good.length > 0 && bad.length > 0) {
    return `「${good[0].template_name}」的表现最好（纪律分 ${good[0].avg_discipline_score}），而「${bad[0].template_name}」崩盘率偏高（${bad[0].collapse_rate}%）。建议多用前者。`;
  }
  if (good.length > 0) {
    return `「${good[0].template_name}」是你目前效果最好的模板，纪律分均 ${good[0].avg_discipline_score}。`;
  }
  if (bad.length > 0) {
    return `「${bad[0].template_name}」的崩盘率达 ${bad[0].collapse_rate}%，建议调整参数或换模板。`;
  }
  return null;
}

// ── 空面板 ──

function emptyDashboard(): CoachingDashboard {
  return {
    totalSessions: 0,
    currentStreak: 0,
    overallGrade: 'C',
    gradeLabel: '开始你的第一场，我来帮你分析',
    preGameTips: [{
      id: 'welcome',
      icon: '👋',
      title: '欢迎来到助手',
      body: '完成第一场实战后，我会根据你的表现生成个性化建议。',
      priority: 'low',
      source: 'growth',
    }],
    improvements: [],
    lastSessionSummary: null,
    trend: [],
    templateTip: null,
  };
}
