// ============================================================
// AI 资金管家 — 数据服务层
// localStorage + subscribe/notify 模式（复用 roomService 模式）
// ============================================================

import type {
  FMStore, FMSession, FMEvent, FMTemplate, FMTemplateSnapshot, SessionPlan,
  FMAlert, FMSettings, PlanInputMethod, SessionStatus, ReminderMode,
  BehaviorNode, BehaviorNodeType, TalkScriptEvent,
} from '../types/fundManager';
import { enqueueSync, flushSync } from './fmSyncService';
import { onSessionEnd } from './dataPipeline';
import { GOLDEN_TEMPLATES } from '../constants/goldenTemplates';

const STORAGE_KEY = 'roundtable_fm_v1';
const MAX_SESSIONS = 50;
const MAX_EVENTS_PER_SESSION = 500;

// ============================================================
// Store
// ============================================================

const defaultSettings: FMSettings = {
  default_input_method: 'form',
  default_reminder_mode: ['popup'],
  show_escort_explanation: true,
  voice_broadcast_enabled: false,
  emotion_profile: {
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
};

export const fmStore: FMStore = {
  sessions: [],
  templates: [],
  active_session_id: null,
  settings: { ...defaultSettings },
};

// ============================================================
// Persistence
// ============================================================

function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      fmStore.sessions = data.sessions || [];
      fmStore.templates = data.templates || [];
      fmStore.active_session_id = data.active_session_id || null;
      fmStore.settings = { ...defaultSettings, ...(data.settings || {}) };
    }
  } catch (e) {
    console.error('[FM] Failed to load store', e);
  }
}

function saveStore() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      sessions: fmStore.sessions,
      templates: fmStore.templates,
      active_session_id: fmStore.active_session_id,
      settings: fmStore.settings,
    }));
    // 异步推送到云端（非阻塞，debounce 2s）
    enqueueSync();
  } catch (e) {
    console.error('[FM] Failed to save store', e);
  }
}

// ============================================================
// Subscription
// ============================================================

type Listener = () => void;
const listeners: Listener[] = [];

export function subscribeFM(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx > -1) listeners.splice(idx, 1);
  };
}

function notify() {
  listeners.forEach(l => l());
}

// ============================================================
// ID 生成
// ============================================================

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================
// Session CRUD
// ============================================================

/** 创建新场次 */
export function createSession(plan: SessionPlan, templateId?: string): FMSession {
  const session: FMSession = {
    id: genId('fm_session'),
    plan: { ...plan, session_id: '' },
    status: 'planning',
    start_time: new Date().toISOString(),
    events: [],
    alerts: [],
    is_archived: false,
    ...(templateId ? { template_id: templateId } : {}),
  };
  session.plan.session_id = session.id;

  // 限制总场次数
  if (fmStore.sessions.length >= MAX_SESSIONS) {
    // 移除最旧的已结束场次
    const oldestEndedIdx = fmStore.sessions.findIndex(s => s.status === 'ended');
    if (oldestEndedIdx > -1) {
      fmStore.sessions.splice(oldestEndedIdx, 1);
    }
  }

  fmStore.sessions.unshift(session);
  fmStore.active_session_id = session.id;
  saveStore();
  notify();
  return session;
}

/** 获取场次 */
export function getSession(id: string): FMSession | undefined {
  return fmStore.sessions.find(s => s.id === id);
}

/** 获取活跃场次 */
export function getActiveSession(): FMSession | null {
  if (!fmStore.active_session_id) return null;
  return fmStore.sessions.find(s => s.id === fmStore.active_session_id) || null;
}

/** 设置活跃场次 */
export function setActiveSession(id: string | null) {
  fmStore.active_session_id = id;
  saveStore();
  notify();
}

/** 开始场次（从 planning → active） */
export function startSession(id: string) {
  const session = getSession(id);
  if (!session) return;
  session.status = 'active';
  session.start_time = new Date().toISOString();
  saveStore();
  notify();
}

/** 暂停场次 */
export function pauseSession(id: string) {
  const session = getSession(id);
  if (!session) return;
  session.status = 'paused';
  saveStore();
  notify();
}

/** 恢复场次 */
export function resumeSession(id: string) {
  const session = getSession(id);
  if (!session) return;
  session.status = 'active';
  saveStore();
  notify();
}

/** 结束场次 */
export function endSession(id: string, note?: string) {
  const session = getSession(id);
  if (!session) return;
  session.status = 'ended';
  session.end_time = new Date().toISOString();
  if (note) session.note = note;
  if (fmStore.active_session_id === id) {
    fmStore.active_session_id = null;
  }
  saveStore();
  // 场次结束时立即推送云端（不等 debounce）
  flushSync();
  // 场次结束：未响应话术事件标记 ignore
  try {
    flushUnrespondedScriptEvents(id);
  } catch (e) {
    console.error('[FM] flushUnrespondedScriptEvents error:', e);
  }
  // 异步执行：行为节点提取 + 数据管道
  try {
    extractBehaviorNodes(id);
  } catch (e) {
    console.error('[FM] extractBehaviorNodes error:', e);
  }
  onSessionEnd(id).catch(e => console.error('[FM] dataPipeline error:', e));
  notify();
}

/** 软删除场次（前端隐藏，数据保留用于分析） */
export function deleteSession(id: string) {
  const session = fmStore.sessions.find(s => s.id === id);
  if (session) {
    session.user_deleted = true;
    session.user_deleted_at = new Date().toISOString();
    if (fmStore.active_session_id === id) {
      fmStore.active_session_id = null;
    }
    saveStore();
    notify();
  }
}

/** 获取所有场次（用户可见，不含软删除） */
export function getAllSessions(): FMSession[] {
  return fmStore.sessions.filter(s => !s.user_deleted);
}

/** 获取已结束场次（用户可见，不含软删除） */
export function getEndedSessions(): FMSession[] {
  return fmStore.sessions.filter(s => s.status === 'ended' && !s.user_deleted);
}

/** 获取全量场次（含软删除，用于系统分析） */
export function getAllSessionsForAnalysis(): FMSession[] {
  return fmStore.sessions;
}

/** 保存复盘报告 */
export function saveReview(sessionId: string, review: FMSession['review']) {
  const session = getSession(sessionId);
  if (!session) return;
  session.review = review;
  saveStore();
  // 复盘完成时立即推送
  flushSync();
  notify();
}

// ============================================================
// Event Recording
// ============================================================

/** 添加事件 */
export function addEvent(sessionId: string, event: Omit<FMEvent, 'id' | 'session_id'>): FMEvent | null {
  const session = getSession(sessionId);
  if (!session) return null;

  if (session.events.length >= MAX_EVENTS_PER_SESSION) {
    console.warn('[FM] Max events reached for session', sessionId);
    return null;
  }

  const fullEvent: FMEvent = {
    id: genId('fm_event'),
    session_id: sessionId,
    ...event,
  };

  session.events.push(fullEvent);
  saveStore();
  notify();
  return fullEvent;
}

/** 添加告警 */
export function addAlerts(sessionId: string, alerts: FMAlert[]) {
  const session = getSession(sessionId);
  if (!session) return;
  session.alerts.push(...alerts);
  saveStore();
  notify();
}

/** 标记告警已关闭（dismiss）— 修复Bug: 原来只清UI不标记dismissed */
export function dismissAlert(sessionId: string, alertId: string) {
  const session = getSession(sessionId);
  if (!session) return;
  const alert = session.alerts.find(a => a.id === alertId);
  if (alert) {
    alert.dismissed = true;
    saveStore();
    notify();
  }
}

/** 修改方案（记录偏离） */
export function modifyPlan(sessionId: string, changes: Partial<SessionPlan>) {
  const session = getSession(sessionId);
  if (!session) return;

  // 记录修改事件
  addEvent(sessionId, {
    event_type: 'rule_change',
    note: Object.entries(changes).map(([k, v]) => `${k}: ${v}`).join(', '),
    timestamp: new Date().toISOString(),
  });

  // 应用修改
  Object.assign(session.plan, changes);
  saveStore();
  notify();
}

// ============================================================
// Template CRUD
// ============================================================

/** 获取所有模板 */
export function getTemplates(): FMTemplate[] {
  return fmStore.templates;
}

/** 保存新模板（从方案创建） */
export function saveTemplate(template: Omit<FMTemplate, 'id' | 'created_at' | 'use_count' | 'version'>): FMTemplate {
  const full: FMTemplate = {
    id: genId('fm_tpl'),
    created_at: new Date().toISOString(),
    use_count: 0,
    version: 1,
    ...template,
  };
  fmStore.templates.push(full);
  saveStore();
  notify();
  return full;
}

/** 编辑模板（保留旧版本快照） */
export function editTemplate(id: string, updatedPlan: Partial<SessionPlan>, newName?: string, newDescription?: string): FMTemplate | null {
  const tpl = fmStore.templates.find(t => t.id === id);
  if (!tpl) return null;

  // 保存旧版本快照
  if (!fmStore.template_snapshots) fmStore.template_snapshots = [];
  fmStore.template_snapshots.push({
    template_id: tpl.id,
    version: tpl.version,
    plan: { ...tpl.plan },
    saved_at: new Date().toISOString(),
  });

  // 限制快照数量（每模板最多保留 10 个版本）
  const thisSnapshots = fmStore.template_snapshots.filter(s => s.template_id === id);
  if (thisSnapshots.length > 10) {
    const oldest = thisSnapshots[0];
    const idx = fmStore.template_snapshots.indexOf(oldest);
    if (idx > -1) fmStore.template_snapshots.splice(idx, 1);
  }

  // 更新模板
  tpl.plan = updatedPlan;
  tpl.version += 1;
  tpl.updated_at = new Date().toISOString();
  if (newName) tpl.name = newName;
  if (newDescription) tpl.description = newDescription;

  saveStore();
  notify();
  return tpl;
}

/** 获取模板历史版本 */
export function getTemplateSnapshots(templateId: string): FMTemplateSnapshot[] {
  return (fmStore.template_snapshots || [])
    .filter(s => s.template_id === templateId)
    .sort((a, b) => b.version - a.version);
}

/** 从快照恢复模板 */
export function restoreTemplateSnapshot(templateId: string, version: number): FMTemplate | null {
  const snapshot = (fmStore.template_snapshots || []).find(
    s => s.template_id === templateId && s.version === version,
  );
  if (!snapshot) return null;
  return editTemplate(templateId, snapshot.plan);
}

/** 删除模板 */
export function deleteTemplate(id: string) {
  const idx = fmStore.templates.findIndex(t => t.id === id);
  if (idx > -1) {
    fmStore.templates.splice(idx, 1);
    // 同时清理历史快照
    if (fmStore.template_snapshots) {
      fmStore.template_snapshots = fmStore.template_snapshots.filter(s => s.template_id !== id);
    }
    saveStore();
    notify();
  }
}

/** 增加模板使用计数，并记录最近使用时间 */
export function incrementTemplateUseCount(id: string) {
  const tpl = fmStore.templates.find(t => t.id === id);
  if (tpl) {
    tpl.use_count++;
    tpl.last_used_at = new Date().toISOString();
    saveStore();
  }
}

// ============================================================
// AR方向1-P1: 场次行为节点提取
// ============================================================

/**
 * 从已结束场次的事件流中提取高权重行为节点。
 * 结果写入 session.behavior_nodes，供跨场次分析使用。
 */
export function extractBehaviorNodes(sessionId: string): BehaviorNode[] {
  const session = getSession(sessionId);
  if (!session || session.status !== 'ended') return [];

  const nodes: BehaviorNode[] = [];
  const plan = session.plan;
  const events = session.events;

  // ── 计算每手时的累计状态 ──
  let netPnl = 0;
  let winStreak = 0;
  let lossStreak = 0;
  let peakPnl = 0;
  let handIndex = 0;
  let lastEmotionAlertHand = -1;

  const startMs = new Date(session.start_time).getTime();

  for (const ev of events) {
    const evMs = new Date(ev.timestamp).getTime();
    const elapsedMin = (evMs - startMs) / 60000;

    if (ev.event_type === 'win') {
      handIndex++;
      const amt = ev.amount ?? 0;
      netPnl += amt;
      winStreak++;
      lossStreak = 0;
      if (netPnl > peakPnl) peakPnl = netPnl;

      // 回吐节点：赢了后净盈利下降到峰值50%以下
      if (peakPnl > 0 && netPnl < peakPnl * 0.5 && netPnl > 0) {
        nodes.push({
          type: 'giveback',
          hand_index: handIndex,
          timestamp: ev.timestamp,
          weight: 1.2,
          detail: `盈利回吐 ${Math.round((1 - netPnl / peakPnl) * 100)}%，峰值 +${peakPnl}→ 当前 +${netPnl}`,
          metrics_snapshot: { net_pnl: netPnl, current_loss_streak: lossStreak, current_win_streak: winStreak, elapsed_minutes: elapsedMin },
        });
      }
    }

    if (ev.event_type === 'loss') {
      handIndex++;
      const amt = ev.amount ?? 0;
      netPnl -= amt;
      lossStreak++;
      winStreak = 0;

      // 崩盘节点：触发止损连输阈值
      const streakLimit = plan.custom_scene_thresholds?.loss_streak_alert ?? plan.stop_loss_streak ?? 3;
      if (lossStreak >= streakLimit) {
        // 只在首次触发时记录，避免重复
        const alreadyRecorded = nodes.some(
          n => n.type === 'collapse' && n.hand_index === handIndex,
        );
        if (!alreadyRecorded) {
          nodes.push({
            type: 'collapse',
            hand_index: handIndex,
            timestamp: ev.timestamp,
            weight: 1.5,
            detail: `连输 ${lossStreak} 手，触发预警阈值`,
            metrics_snapshot: { net_pnl: netPnl, current_loss_streak: lossStreak, current_win_streak: winStreak, elapsed_minutes: elapsedMin },
          });
        }
      }

      // 回吐节点：从盈利转为亏损
      if (peakPnl > 0 && netPnl < 0) {
        const alreadyRecorded = nodes.some(n => n.type === 'giveback' && n.hand_index >= handIndex - 2);
        if (!alreadyRecorded) {
          nodes.push({
            type: 'giveback',
            hand_index: handIndex,
            timestamp: ev.timestamp,
            weight: 1.4,
            detail: `盈利完全回吐并转亏，峰值 +${peakPnl}→ 当前 ${netPnl}`,
            metrics_snapshot: { net_pnl: netPnl, current_loss_streak: lossStreak, current_win_streak: winStreak, elapsed_minutes: elapsedMin },
          });
        }
      }
    }

    // 情绪节点：自检触发警报级以上
    if (ev.event_type === 'self_check' && ev.self_check_result) {
      const level = ev.self_check_result.risk_level;
      if ((level === 'warning' || level === 'danger') && handIndex > lastEmotionAlertHand) {
        lastEmotionAlertHand = handIndex;
        nodes.push({
          type: 'emotion',
          hand_index: handIndex,
          timestamp: ev.timestamp,
          weight: level === 'danger' ? 1.5 : 1.2,
          detail: `即时自检：${level === 'danger' ? '高危' : '警告'}级 (${ev.self_check_result.checked_ids.length} 项信号)`,
          metrics_snapshot: { net_pnl: netPnl, current_loss_streak: lossStreak, current_win_streak: winStreak, elapsed_minutes: elapsedMin },
        });
      }
    }
  }

  // 反弹节点：场次最终以纪律性离场结束
  // 判断依据：最终净盈利 > 0，或 session.note 含有"纪律"相关词
  const disciplinaryExit = netPnl > 0
    || (plan.take_profit_amount > 0 && netPnl >= plan.take_profit_amount * 0.8)
    || (session.note && /纪律|达标|止盈|走了|赢着|执行/.test(session.note));

  if (disciplinaryExit && nodes.length > 0) {
    const endMs = session.end_time ? new Date(session.end_time).getTime() : Date.now();
    const totalMin = (endMs - startMs) / 60000;
    nodes.push({
      type: 'rebound',
      hand_index: handIndex + 1,
      timestamp: session.end_time ?? new Date().toISOString(),
      weight: 1.3,
      detail: `纪律性离场，最终 ${netPnl >= 0 ? '+' : ''}${netPnl}`,
      metrics_snapshot: { net_pnl: netPnl, current_loss_streak: lossStreak, current_win_streak: winStreak, elapsed_minutes: totalMin },
    });
  }

  // 写入 session
  session.behavior_nodes = nodes;
  saveStore();
  return nodes;
}

// ============================================================
// AR方向1-P2: 跨场次行为模式分析 → 战约阈值自动调整
// ============================================================

export interface ThresholdAdjustment {
  field: 'loss_streak_alert' | 'profit_lock_pct' | 'max_duration_minutes';
  from: number;
  to: number;
  reason: string;
}

export interface HistoryPatternResult {
  adjustments: ThresholdAdjustment[];
  sessions_analyzed: number;
}

/**
 * 读取最近 N 场已结束场次的 behavior_nodes，
 * 识别高频风险模式，返回建议的阈值调整清单。
 * 不直接修改计划——由调用方决定是否应用。
 */
export function analyzeHistoryPatterns(
  currentThresholds: {
    loss_streak_alert: number;
    profit_lock_pct: number;
    win_streak_alert: number;
    grind_hands_alert: number;
  },
  currentPlan: Partial<{ max_duration_minutes: number }>,
  lookback = 8,
): HistoryPatternResult {
  const ended = fmStore.sessions
    .filter(s => s.status === 'ended' && s.behavior_nodes)
    .sort((a, b) => (b.end_time ?? '').localeCompare(a.end_time ?? ''))
    .slice(0, lookback);

  if (ended.length < 2) return { adjustments: [], sessions_analyzed: ended.length };

  // 统计各类节点出现次数
  let collapseCount = 0;
  let givebackCount = 0;
  let overtimeCount = 0;

  for (const s of ended) {
    const nodes = s.behavior_nodes ?? [];
    if (nodes.some(n => n.type === 'collapse')) collapseCount++;
    if (nodes.some(n => n.type === 'giveback')) givebackCount++;

    // 超时：场次实际时长超出计划时长 20% 以上
    const planMins = s.plan.max_duration_minutes ?? 90;
    if (s.start_time && s.end_time) {
      const actualMins = (new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 60000;
      if (actualMins > planMins * 1.2) overtimeCount++;
    }
  }

  const n = ended.length;
  const adjustments: ThresholdAdjustment[] = [];

  // 规则1: 崩盘率 ≥ 60% → 提早连损预警（-1 手，最小 2）
  if (collapseCount / n >= 0.6) {
    const from = currentThresholds.loss_streak_alert;
    const to = Math.max(2, from - 1);
    if (to < from) {
      adjustments.push({
        field: 'loss_streak_alert',
        from,
        to,
        reason: `过去${n}场有${collapseCount}场出现连损崩盘，提早1手预警`,
      });
    }
  }

  // 规则2: 回吐率 ≥ 50% → 加严盈利保护触发点（+10%，最高 80）
  if (givebackCount / n >= 0.5) {
    const from = currentThresholds.profit_lock_pct;
    const to = Math.min(80, from + 10);
    if (to > from) {
      adjustments.push({
        field: 'profit_lock_pct',
        from,
        to,
        reason: `过去${n}场有${givebackCount}场出现盈利回吐，盈利保护触发门槛调低`,
      });
    }
  }

  // 规则3: 超时率 ≥ 50% → 建议缩短计划时长（-15 分钟，最少 30）
  if (overtimeCount / n >= 0.5) {
    const from = currentPlan.max_duration_minutes ?? 90;
    const to = Math.max(30, from - 15);
    if (to < from) {
      adjustments.push({
        field: 'max_duration_minutes',
        from,
        to,
        reason: `过去${n}场有${overtimeCount}场超时，建议主动缩短计划时长`,
      });
    }
  }

  return { adjustments, sessions_analyzed: n };
}

// ============================================================
// AR方向3 Phase 1: 话术展示 + 用户行为追踪
// ============================================================

/**
 * 记录一次话术展示事件（在 EmotionPanel 展示 activeTalkScript 时调用）。
 * scriptIndex 对应 plan.talk_scripts[i]
 */
export function recordScriptShown(
  sessionId: string,
  scriptIndex: number,
  scriptText: string,
  scenePoolKey: string,
  sceneLevel: 'L1' | 'L2' | 'L3' | 'L4',
): void {
  const session = getSession(sessionId);
  if (!session) return;
  if (!session.talk_script_feedback) session.talk_script_feedback = [];

  // 防止同一秒内重复记录同一条话术
  const last = session.talk_script_feedback[session.talk_script_feedback.length - 1];
  if (last && last.script_index === scriptIndex && !last.response) {
    const diffMs = Date.now() - new Date(last.shown_at).getTime();
    if (diffMs < 10_000) return; // 10秒内不重复
  }

  session.talk_script_feedback.push({
    script_index: scriptIndex,
    script_text: scriptText,
    scene_pool_key: scenePoolKey,
    scene_level: sceneLevel,
    shown_at: new Date().toISOString(),
  });
  saveStore();
}

/**
 * 归因用户响应到最近一次话术展示（在用户点暂停/结束时调用）。
 * 只归因2分钟内最后一条未响应的记录；超时不归因。
 */
export function attributeScriptResponse(
  sessionId: string,
  action: TalkScriptEvent['response']['action'],
): void {
  const session = getSession(sessionId);
  if (!session?.talk_script_feedback?.length) return;

  const ATTRIBUTION_WINDOW_MS = 2 * 60 * 1000;
  const now = Date.now();

  // 从末尾往前找最近一条无 response、在时间窗口内的记录
  for (let i = session.talk_script_feedback.length - 1; i >= 0; i--) {
    const ev = session.talk_script_feedback[i];
    if (ev.response) continue; // 已归因，跳过
    const diff = now - new Date(ev.shown_at).getTime();
    if (diff > ATTRIBUTION_WINDOW_MS) break; // 超窗口，不往前再找

    const OUTCOME_SCORES: Record<string, number> = {
      end: 0.5,
      pause: 0.3,
      ignore: -0.2,
      continue_loss: -0.1,
    };
    ev.response = {
      action,
      responded_at: new Date().toISOString(),
      outcome_score: OUTCOME_SCORES[action] ?? 0,
    };
    saveStore();
    return;
  }
}

/**
 * 场次结束时，将所有仍无 response 的话术事件标记为 'ignore'。
 * 在 endSession 内调用（try/catch 包裹）。
 */
export function flushUnrespondedScriptEvents(sessionId: string): void {
  const session = getSession(sessionId);
  if (!session?.talk_script_feedback?.length) return;
  const respondedAt = new Date().toISOString();
  let changed = false;
  for (const ev of session.talk_script_feedback) {
    if (!ev.response) {
      ev.response = { action: 'ignore', responded_at: respondedAt, outcome_score: -0.2 };
      changed = true;
    }
  }
  if (changed) saveStore();
}

/** 从方案自动保存为个人模板 */
const PROFILE_DESCS: Record<string, string> = {
  revenge_trader: '追损倾向明显',
  profit_giver_back: '容易回吐盈利',
  hot_hand: '赢了容易加大',
  bored_bettor: '对输赢不太敏感',
};

export function saveAsPersonalTemplate(
  plan: SessionPlan,
  templateName?: string,
  playerProfile?: string,
): FMTemplate {
  const name = templateName || `我的战约 ${new Date().toLocaleDateString('zh-CN')}`;
  const profileDesc = playerProfile ? `${PROFILE_DESCS[playerProfile] ?? playerProfile} · ` : '';
  return saveTemplate({
    name,
    description: `${profileDesc}操盘${plan.session_budget}，基码${plan.base_unit}`,
    is_builtin: false,
    plan: { ...plan, template_name: name },
  });
}

// ============================================================
// 模板效果分析
// ============================================================

export interface TemplateEffectiveness {
  template_id: string;
  template_name: string;
  sessions_used: number;
  avg_discipline_score: number;
  collapse_rate: number;           // 崩盘率 0-100
  avg_net_pnl: number;
  avg_duration_minutes: number;
  verdict: 'good' | 'neutral' | 'bad';  // 综合评价
}

/** 分析每个模板的使用效果 */
export function analyzeTemplateEffectiveness(): TemplateEffectiveness[] {
  const templates = getTemplates();
  const endedSessions = getEndedSessions();
  const results: TemplateEffectiveness[] = [];

  for (const tpl of templates) {
    const sessions = endedSessions.filter(s => s.template_id === tpl.id);
    if (sessions.length === 0) continue;

    // 计算每场的基础指标
    let totalDiscipline = 0;
    let collapseCount = 0;
    let totalPnl = 0;
    let totalDuration = 0;

    for (const s of sessions) {
      // 纪律分
      const discipline = s.review?.discipline_score ?? 70;
      totalDiscipline += discipline;

      // 崩盘检测
      const hasCollapse = s.events.some(e =>
        e.note?.includes('崩盘') || e.note?.includes('collapsed'),
      );
      if (hasCollapse) collapseCount++;

      // 盈亏
      const pnl = s.events.reduce((sum, e) => {
        if (e.event_type === 'win') return sum + (e.amount || 0);
        if (e.event_type === 'loss') return sum - (e.amount || 0);
        return sum;
      }, 0);
      totalPnl += pnl;

      // 时长
      const start = new Date(s.start_time).getTime();
      const end = s.end_time ? new Date(s.end_time).getTime() : Date.now();
      totalDuration += (end - start) / 60000;
    }

    const n = sessions.length;
    const avgDiscipline = Math.round(totalDiscipline / n);
    const collapseRate = Math.round((collapseCount / n) * 100);
    const avgPnl = Math.round(totalPnl / n);

    // 综合评价：纪律分高+崩盘少=good
    const verdict: 'good' | 'neutral' | 'bad' =
      avgDiscipline >= 75 && collapseRate <= 20 ? 'good'
      : avgDiscipline < 50 || collapseRate >= 60 ? 'bad'
      : 'neutral';

    results.push({
      template_id: tpl.id,
      template_name: tpl.name,
      sessions_used: n,
      avg_discipline_score: avgDiscipline,
      collapse_rate: collapseRate,
      avg_net_pnl: avgPnl,
      avg_duration_minutes: Math.round(totalDuration / n),
      verdict,
    });
  }

  // 按使用次数排序
  results.sort((a, b) => b.sessions_used - a.sessions_used);
  return results;
}

// ============================================================
// Settings
// ============================================================

export function getSettings(): FMSettings {
  return fmStore.settings;
}

export function updateSettings(changes: Partial<FMSettings>) {
  Object.assign(fmStore.settings, changes);
  saveStore();
  notify();
}

// ============================================================
// 初始化
// ============================================================

/** 内建模板白名单 — 只允许这 3 个 ID */
const BUILTIN_ID_LIST = ['fm_tpl_builtin_conservative', 'fm_tpl_builtin_balanced', 'fm_tpl_builtin_aggressive'] as const;
export const BUILTIN_IDS = new Set<string>(BUILTIN_ID_LIST);

/** 初始化内建模板 */
function initBuiltinTemplates() {
  // 硬过滤：只保留白名单内的 builtin + 去重（同ID只留一个）
  const seenBuiltinIds = new Set<string>();
  fmStore.templates = fmStore.templates.filter(t => {
    if (t.is_builtin) {
      if (!BUILTIN_IDS.has(t.id)) return false;  // 不在白名单 → 删
      if (seenBuiltinIds.has(t.id)) return false; // 重复ID → 删
      seenBuiltinIds.add(t.id);
    }
    return true;
  });

  // 确保三个 builtin 都存在
  const existingIds = new Set(fmStore.templates.filter(t => t.is_builtin).map(t => t.id));

  // ── 内建模板从 goldenTemplates 生成，确保参数一致 ──
  // 默认进场资金 5000（用户选模板后可调整）
  const DEFAULT_ENTRY_BANK = 5000;
  const goldenMapping: { builtinId: string; goldenId: 'A' | 'B' | 'C'; name: string }[] = [
    { builtinId: BUILTIN_ID_LIST[0], goldenId: 'A', name: '保守模式' },
    { builtinId: BUILTIN_ID_LIST[1], goldenId: 'B', name: '平衡模式' },
    { builtinId: BUILTIN_ID_LIST[2], goldenId: 'C', name: '激进模式' },
  ];

  const builtinDefs = goldenMapping.map(({ builtinId, goldenId, name }) => {
    const golden = GOLDEN_TEMPLATES[goldenId];
    return {
      id: builtinId,
      name,
      description: golden.description,
      plan: {
        ...golden.toPlanPartial(DEFAULT_ENTRY_BANK),
        currency: 'CNY',
        reminder_mode: ['popup'] as ReminderMode[],
      },
    };
  });

  let changed = false;
  for (const def of builtinDefs) {
    if (!existingIds.has(def.id)) {
      fmStore.templates.push({
        id: def.id,
        name: def.name,
        description: def.description,
        is_builtin: true,
        version: 1,
        plan: def.plan,
        created_at: new Date().toISOString(),
        use_count: 0,
      });
      changed = true;
    }
  }
  if (changed) saveStore();
}

// 模块加载时初始化
loadStore();
initBuiltinTemplates();

// ============================================================
// AR方向3 Phase 2 开发触发检查（每次 App 启动时自动运行）
// 条件满足时在 console 打印醒目提示，提醒开发者实施学习算法
// ============================================================
(function checkAR3LearningReadiness() {
  try {
    const ended = fmStore.sessions.filter(
      s => s.status === 'ended' && (s.talk_script_feedback?.length ?? 0) > 0,
    );
    const feedbackWithResponse = ended.flatMap(
      s => (s.talk_script_feedback ?? []).filter(e => e.response),
    );
    const scriptShowCounts: Record<number, number> = {};
    feedbackWithResponse.forEach(e => {
      scriptShowCounts[e.script_index] = (scriptShowCounts[e.script_index] ?? 0) + 1;
    });
    const scriptsWithEnoughData = Object.values(scriptShowCounts).filter(c => c >= 2).length;

    const sessionCount = ended.length;
    const feedbackCount = feedbackWithResponse.length;
    const ready = sessionCount >= 5 && feedbackCount >= 10 && scriptsWithEnoughData >= 2;

    if (ready) {
      console.warn(
        '%c[AR方向3] ✅ 话术学习条件已满足！可以实施 Phase 2 权重学习算法',
        'background:#22c55e;color:#fff;padding:4px 8px;border-radius:4px;font-weight:bold',
      );
      console.warn(
        `[AR方向3] 数据：${sessionCount}场 / ${feedbackCount}条反馈 / ${scriptsWithEnoughData}句话术达标`,
      );
      console.warn('[AR方向3] 新会话启动语：「继续开发 talk-script-learning Phase 2」');
      console.warn('[AR方向3] 参考文档：docs/design/talk-script-learning-roadmap.md');
    } else {
      console.info(
        `[AR方向3] 学习积累中 — 场次:${sessionCount}/5  反馈:${feedbackCount}/10  话术达标:${scriptsWithEnoughData}/2`,
      );
    }
  } catch (_) { /* 静默失败，不影响主流程 */ }
})();
