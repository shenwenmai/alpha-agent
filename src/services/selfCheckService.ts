// ============================================================
// 自检数据服务 — 存储、同步、分析
// Local-First: localStorage 即时写 → async Supabase 同步
// ============================================================

import type {
  SelfCheckLog,
  SelfCheckResult,
  SelfCheckAnalysis,
  SignalStat,
  SessionSelfCheckSummary,
  FMEvent,
} from '../types/fundManager';
import { supabase, getCurrentUserId } from './supabaseClient';
import { fmStore } from './fundManagerService';
import { DANGER_SIGNALS } from '../components/fundManager/FMDangerCheckView';

const STORAGE_KEY = 'self_check_logs';

// ============================================================
// 内部工具
// ============================================================

/** 生成唯一 ID */
function genId(): string {
  return `sc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 从 localStorage 读取所有日志（含 _synced 标记） */
function readLocalLogs(): (SelfCheckLog & { _synced?: boolean })[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/** 写入 localStorage */
function writeLocalLogs(logs: (SelfCheckLog & { _synced?: boolean })[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  } catch (e) {
    console.warn('[SelfCheck] localStorage 写入失败', e);
  }
}

/** 信号 ID → 文本的查找表 */
const signalTextMap = new Map(DANGER_SIGNALS.map(s => [s.id, s.text]));

function getSignalText(id: string): string {
  return signalTextMap.get(id) || id;
}

// ============================================================
// 2a. 写入自检日志（本地 + 云端）
// ============================================================

/** 保存一条自检日志，先写 localStorage，再异步推 Supabase */
export function saveSelfCheckLog(log: Omit<SelfCheckLog, 'id'>): void {
  const fullLog: SelfCheckLog & { _synced?: boolean } = {
    id: genId(),
    ...log,
    _synced: false,
  };

  const logs = readLocalLogs();
  logs.push(fullLog);
  writeLocalLogs(logs);

  // 异步推云端（不阻塞）
  const userId = getCurrentUserId();
  if (userId) {
    pushOneLog(fullLog).catch(e =>
      console.warn('[SelfCheck] 云端推送失败，稍后重试', e),
    );
  }
}

/** 推送单条日志到 Supabase */
async function pushOneLog(log: SelfCheckLog & { _synced?: boolean }): Promise<void> {
  const { _synced, ...row } = log as any;
  const { error } = await supabase
    .from('self_check_logs')
    .upsert(row, { onConflict: 'id' });

  if (error) {
    throw new Error(`self_check push: ${error.message}`);
  }

  // 标记已同步
  const logs = readLocalLogs();
  const idx = logs.findIndex(l => l.id === log.id);
  if (idx > -1) {
    logs[idx]._synced = true;
    writeLocalLogs(logs);
  }
}

// ============================================================
// 2b. 读取本场自检记录
// ============================================================

/** 获取指定场次的自检日志，按 created_at 升序 */
export function getSessionChecks(sessionId: string): SelfCheckLog[] {
  return readLocalLogs()
    .filter(l => l.session_id === sessionId)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

// ============================================================
// 2c. 读取用户全部自检历史
// ============================================================

/** 获取所有本地自检日志 */
export function getAllCheckLogs(): SelfCheckLog[] {
  return readLocalLogs();
}

// ============================================================
// 2d. 单场自检摘要（供复盘用）
// ============================================================

/** 从 FMEvent 列表生成本场自检摘要 */
export function buildSessionSelfCheckSummary(
  sessionId: string,
  events: FMEvent[],
): SessionSelfCheckSummary {
  // 过滤出自检事件
  const selfCheckEvents = events.filter(
    e => e.event_type === 'self_check' && e.self_check_result,
  );

  if (selfCheckEvents.length === 0) {
    return {
      total_checks: 0,
      pre_entry_risk_level: 'safe',
      live_checks: [],
      top_signals: [],
      compliance_score: 100,
      ai_comment: '',
    };
  }

  // 进场前自检
  const preEntry = selfCheckEvents.find(
    e => e.self_check_result!.mode === 'pre_entry',
  );
  const preEntryRisk = preEntry?.self_check_result?.risk_level || 'safe';

  // 实战自检明细
  const liveEvents = selfCheckEvents.filter(
    e => e.self_check_result!.mode === 'live',
  );

  // 同时从 localStorage 中取该场次的 SelfCheckLog，以获取 action_taken
  const sessionLogs = getSessionChecks(sessionId);
  const logByTimestamp = new Map(sessionLogs.map(l => [l.created_at, l]));

  const live_checks = liveEvents.map((e, idx) => {
    const r = e.self_check_result!;
    // 尝试匹配 log 获取 action_taken
    const matchedLog = logByTimestamp.get(r.timestamp);
    return {
      hand_number: matchedLog?.session_hand_count ?? idx + 1,
      risk_level: r.risk_level,
      checked_count: r.checked_ids.length,
      action_taken: matchedLog?.action_taken ?? 'continue',
    };
  });

  // 统计最频繁信号
  const signalCount = new Map<string, number>();
  for (const e of selfCheckEvents) {
    for (const sid of e.self_check_result!.checked_ids) {
      signalCount.set(sid, (signalCount.get(sid) || 0) + 1);
    }
  }
  const top_signals = [...signalCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id);

  // 计算 compliance_score
  const scores: number[] = [];
  for (const log of sessionLogs) {
    const score = computeComplianceScore(log.risk_level, log.action_taken);
    scores.push(score);
  }
  // 如果没有 log 但有 event，尝试从 live_checks 推断
  if (scores.length === 0) {
    for (const lc of live_checks) {
      const score = computeComplianceScore(
        lc.risk_level as SelfCheckLog['risk_level'],
        lc.action_taken as SelfCheckLog['action_taken'],
      );
      scores.push(score);
    }
  }
  const compliance_score =
    scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 100;

  return {
    total_checks: selfCheckEvents.length,
    pre_entry_risk_level: preEntryRisk,
    live_checks,
    top_signals,
    compliance_score,
    ai_comment: '', // 后续窗口C的AI填充
  };
}

/** 单次自检的遵从分 */
function computeComplianceScore(
  riskLevel: SelfCheckLog['risk_level'],
  actionTaken: SelfCheckLog['action_taken'],
): number {
  if (riskLevel === 'safe' || riskLevel === 'caution') return 100;

  if (riskLevel === 'danger') {
    if (actionTaken === 'end_session') return 100;
    if (actionTaken === 'pause') return 70;
    return 0; // continue
  }

  // warning
  if (actionTaken === 'end_session') return 100;
  if (actionTaken === 'pause') return 80;
  return 30; // continue
}

// ============================================================
// 2e. 跨场次长期分析
// ============================================================

/** 分析自检历史，生成长期画像 */
export function analyzeSelfCheckHistory(logs: SelfCheckLog[]): SelfCheckAnalysis {
  if (logs.length === 0) {
    return {
      total_sessions: 0,
      total_checks: 0,
      pre_entry_count: 0,
      live_count: 0,
      avg_checks_per_session: 0,
      compliance_rate: 1,
      top_signals: [],
      risk_distribution: { safe: 0, caution: 0, warning: 0, danger: 0 },
      trend: 'stable',
      insights: [],
    };
  }

  // 基础统计
  const sessionIds = new Set(logs.map(l => l.session_id));
  const total_sessions = sessionIds.size;
  const total_checks = logs.length;
  const pre_entry_count = logs.filter(l => l.mode === 'pre_entry').length;
  const live_count = logs.filter(l => l.mode === 'live').length;
  const avg_checks_per_session =
    total_sessions > 0 ? Math.round((total_checks / total_sessions) * 10) / 10 : 0;

  // compliance_rate: danger/warning 时停下（pause/end_session）的比例
  const riskyLogs = logs.filter(
    l => l.risk_level === 'danger' || l.risk_level === 'warning',
  );
  const compliantLogs = riskyLogs.filter(
    l => l.action_taken === 'pause' || l.action_taken === 'end_session',
  );
  const compliance_rate =
    riskyLogs.length > 0 ? Math.round((compliantLogs.length / riskyLogs.length) * 100) / 100 : 1;

  // risk_distribution
  const risk_distribution: Record<string, number> = {
    safe: 0,
    caution: 0,
    warning: 0,
    danger: 0,
  };
  for (const l of logs) {
    risk_distribution[l.risk_level] = (risk_distribution[l.risk_level] || 0) + 1;
  }

  // top_signals 统计
  const signalStats = new Map<string, { count: number; pnlSum: number; lossCount: number; sessionIds: Set<string> }>();
  for (const l of logs) {
    for (const sid of l.checked_ids) {
      let stat = signalStats.get(sid);
      if (!stat) {
        stat = { count: 0, pnlSum: 0, lossCount: 0, sessionIds: new Set() };
        signalStats.set(sid, stat);
      }
      stat.count++;
      stat.sessionIds.add(l.session_id);

      // 用 log 自带的 session_pnl 近似
      stat.pnlSum += l.session_pnl;
      if (l.session_pnl < 0) stat.lossCount++;
    }
  }

  // 尝试用 fmStore 的 session 数据获取更准确的 pnl
  const sessionPnlCache = new Map<string, number>();
  for (const session of fmStore.sessions) {
    const pnl = session.events.reduce((sum, e) => {
      if (e.event_type === 'win') return sum + (e.amount || 0);
      if (e.event_type === 'loss') return sum - (e.amount || 0);
      return sum;
    }, 0);
    sessionPnlCache.set(session.id, pnl);
  }

  const top_signals: SignalStat[] = [...signalStats.entries()]
    .map(([signal_id, stat]) => {
      // 重新计算 pnl 如果 session 数据可用
      let totalPnl = 0;
      let lossCount = 0;
      let sessionCount = 0;
      for (const sId of stat.sessionIds) {
        const cachedPnl = sessionPnlCache.get(sId);
        if (cachedPnl !== undefined) {
          totalPnl += cachedPnl;
          if (cachedPnl < 0) lossCount++;
        } else {
          // 用 log 中的 session_pnl 近似（取该 session 最后一条 log 的值）
          const sessionLogs = logs.filter(l => l.session_id === sId);
          if (sessionLogs.length > 0) {
            const lastLog = sessionLogs[sessionLogs.length - 1];
            totalPnl += lastLog.session_pnl;
            if (lastLog.session_pnl < 0) lossCount++;
          }
        }
        sessionCount++;
      }

      return {
        signal_id,
        signal_text: getSignalText(signal_id),
        check_count: stat.count,
        check_rate: total_checks > 0 ? Math.round((stat.count / total_checks) * 100) / 100 : 0,
        avg_pnl_when_checked: sessionCount > 0 ? Math.round(totalPnl / sessionCount) : 0,
        loss_rate_when_checked: sessionCount > 0 ? Math.round((lossCount / sessionCount) * 100) / 100 : 0,
      };
    })
    .sort((a, b) => b.check_count - a.check_count)
    .slice(0, 10);

  // trend: 最近 5 场 vs 之前 5 场
  const sortedSessionIds = [...sessionIds].sort((a, b) => {
    const aLog = logs.find(l => l.session_id === a);
    const bLog = logs.find(l => l.session_id === b);
    return new Date(aLog?.created_at || 0).getTime() - new Date(bLog?.created_at || 0).getTime();
  });

  let trend: 'improving' | 'stable' | 'declining' = 'stable';
  if (sortedSessionIds.length >= 6) {
    const recentIds = new Set(sortedSessionIds.slice(-5));
    const olderIds = new Set(sortedSessionIds.slice(-10, -5));

    const calcRate = (ids: Set<string>) => {
      const subset = logs.filter(
        l => ids.has(l.session_id) && (l.risk_level === 'danger' || l.risk_level === 'warning'),
      );
      const compliant = subset.filter(
        l => l.action_taken === 'pause' || l.action_taken === 'end_session',
      );
      return subset.length > 0 ? compliant.length / subset.length : 1;
    };

    const recentRate = calcRate(recentIds);
    const olderRate = calcRate(olderIds);
    const diff = recentRate - olderRate;

    if (diff > 0.10) trend = 'improving';
    else if (diff < -0.10) trend = 'declining';
  }

  return {
    total_sessions,
    total_checks,
    pre_entry_count,
    live_count,
    avg_checks_per_session,
    compliance_rate,
    top_signals,
    risk_distribution,
    trend,
    insights: [], // 后续AI填充
  };
}

// ============================================================
// 2f. 云端同步
// ============================================================

/** 推送未同步的自检日志到 Supabase */
export async function pushSelfCheckLogs(userId: string): Promise<void> {
  const logs = readLocalLogs();
  const unsyncedLogs = logs.filter(l => !l._synced);

  if (unsyncedLogs.length === 0) return;

  // 批量 upsert（去除 _synced 字段）
  const rows = unsyncedLogs.map(l => {
    const { _synced, ...row } = l as any;
    return { ...row, user_id: userId };
  });

  const { error } = await supabase
    .from('self_check_logs')
    .upsert(rows, { onConflict: 'id' });

  if (error) {
    console.warn('[SelfCheck] 批量推送失败:', error.message);
    return;
  }

  // 标记已同步
  const syncedIds = new Set(unsyncedLogs.map(l => l.id));
  for (const l of logs) {
    if (syncedIds.has(l.id)) {
      l._synced = true;
    }
  }
  writeLocalLogs(logs);
}

/** 从 Supabase 拉取自检日志，合并到本地 */
export async function pullSelfCheckLogs(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from('self_check_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(500);

  if (error || !data) {
    console.warn('[SelfCheck] 拉取失败:', error?.message);
    return;
  }

  const localLogs = readLocalLogs();
  const localIds = new Set(localLogs.map(l => l.id));

  let changed = false;
  for (const row of data) {
    if (!localIds.has(row.id)) {
      localLogs.push({
        id: row.id,
        user_id: row.user_id,
        session_id: row.session_id,
        mode: row.mode,
        trigger: row.trigger,
        checked_ids: row.checked_ids || [],
        risk_level: row.risk_level,
        session_hand_count: row.session_hand_count,
        session_pnl: Number(row.session_pnl),
        session_elapsed_min: row.session_elapsed_min,
        action_taken: row.action_taken,
        created_at: row.created_at,
        _synced: true,
      });
      changed = true;
    }
  }

  if (changed) {
    // 按 created_at 排序
    localLogs.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    writeLocalLogs(localLogs);
  }
}
