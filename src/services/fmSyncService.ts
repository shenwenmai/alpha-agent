// ============================================================
// AI 资金管家 — 云端同步服务
// Local-First: localStorage 即时写入 → 异步推云端
// ============================================================

import { supabase, getCurrentUserId } from './supabaseClient';
import { fmStore, BUILTIN_IDS } from './fundManagerService';
import type {
  FMSession, FMEvent, FMAlert, FMTemplate, FMTemplateSnapshot,
  FMSettings,
} from '../types/fundManager';

// ============================================================
// 同步状态管理 — UI 可感知
// ============================================================

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

interface SyncState {
  status: SyncStatus;
  lastSyncAt: string | null;
  lastError: string | null;
  retryCount: number;
}

const syncState: SyncState = {
  status: 'idle',
  lastSyncAt: null,
  lastError: null,
  retryCount: 0,
};

type SyncListener = (state: SyncState) => void;
const syncListeners: Set<SyncListener> = new Set();

/** 订阅同步状态变化 */
export function subscribeSyncStatus(listener: SyncListener): () => void {
  syncListeners.add(listener);
  listener(syncState); // 立即推送当前状态
  return () => syncListeners.delete(listener);
}

/** 获取当前同步状态 */
export function getSyncState(): Readonly<SyncState> {
  return syncState;
}

function setSyncStatus(status: SyncStatus, error?: string) {
  syncState.status = status;
  if (status === 'success') {
    syncState.lastSyncAt = new Date().toISOString();
    syncState.lastError = null;
    syncState.retryCount = 0;
  } else if (status === 'error') {
    syncState.lastError = error || '同步失败';
  }
  syncListeners.forEach(fn => fn({ ...syncState }));
}

// ============================================================
// 同步队列（debounce 推送 + 失败重试）
// ============================================================

let syncTimer: ReturnType<typeof setTimeout> | null = null;
const SYNC_DEBOUNCE_MS = 2000;
const MAX_RETRY = 3;
const RETRY_DELAY_MS = 5000;

/** 入队同步（非阻塞，debounce） */
export function enqueueSync() {
  const userId = getCurrentUserId();
  if (!userId) return;

  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncWithRetry(userId);
  }, SYNC_DEBOUNCE_MS);
}

/** 立即推送（场次结束时调用） */
export function flushSync() {
  const userId = getCurrentUserId();
  if (!userId) return;

  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
  syncWithRetry(userId);
}

/** 带重试的同步 */
async function syncWithRetry(userId: string, attempt = 0) {
  setSyncStatus('syncing');
  try {
    await syncAll(userId);
    setSyncStatus('success');
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    if (attempt < MAX_RETRY) {
      syncState.retryCount = attempt + 1;
      syncListeners.forEach(fn => fn({ ...syncState }));
      setTimeout(() => syncWithRetry(userId, attempt + 1), RETRY_DELAY_MS * (attempt + 1));
    } else {
      setSyncStatus('error', errMsg);
    }
  }
}

// ============================================================
// 推送逻辑
// ============================================================

/** 全量同步当前 store 到云端 */
async function syncAll(userId: string) {
  const results = await Promise.allSettled([
    pushSessionsToCloud(userId),
    pushTemplatesToCloud(userId),
    pushSettingsToCloud(userId),
  ]);

  // 检查是否有失败
  const failures = results.filter(r => r.status === 'rejected');
  if (failures.length > 0) {
    throw new Error(`${failures.length} 项同步失败`);
  }
}

/** 推送所有 sessions（含 events 和 alerts） */
async function pushSessionsToCloud(userId: string) {
  const sessions = fmStore.sessions;
  if (sessions.length === 0) return;

  for (const session of sessions) {
    await pushOneSession(userId, session);
  }
}

/** 推送单个 session + events + alerts */
async function pushOneSession(userId: string, session: FMSession) {
  // 1. Upsert session
  const { error: sessionError } = await supabase
    .from('fm_sessions')
    .upsert({
      id: session.id,
      user_id: userId,
      plan: session.plan,
      status: session.status,
      start_time: session.start_time,
      end_time: session.end_time || null,
      note: session.note || null,
      is_archived: session.is_archived,
      review: session.review || null,
    }, { onConflict: 'id' });

  if (sessionError) {
    throw new Error(`session ${session.id}: ${sessionError.message}`);
  }

  // 2. Upsert events (batch)
  if (session.events.length > 0) {
    const eventRows = session.events.map(e => ({
      id: e.id,
      session_id: session.id,
      user_id: userId,
      event_type: e.event_type,
      amount: e.amount ?? null,
      bet_unit: e.bet_unit ?? null,
      note: e.note || null,
      raw_input: e.raw_input || null,
      timestamp: e.timestamp,
    }));

    const { error: evtError } = await supabase
      .from('fm_events')
      .upsert(eventRows, { onConflict: 'id' });

    if (evtError) {
      throw new Error(`events ${session.id}: ${evtError.message}`);
    }
  }

  // 3. Upsert alerts (batch)
  if (session.alerts.length > 0) {
    const alertRows = session.alerts.map(a => ({
      id: a.id,
      session_id: session.id,
      user_id: userId,
      level: a.level,
      rule_key: a.rule_key,
      message: a.message,
      voice_message: a.voice_message || null,
      dismissed: a.dismissed,
      timestamp: a.timestamp,
    }));

    const { error: alertError } = await supabase
      .from('fm_alerts')
      .upsert(alertRows, { onConflict: 'id' });

    if (alertError) {
      throw new Error(`alerts ${session.id}: ${alertError.message}`);
    }
  }
}

/** 推送所有模板 */
async function pushTemplatesToCloud(userId: string) {
  const templates = fmStore.templates;
  if (templates.length === 0) return;

  const rows = templates.map(t => ({
    id: t.id,
    user_id: userId,
    name: t.name,
    description: t.description,
    plan: t.plan,
    is_builtin: t.is_builtin,
    use_count: t.use_count,
    version: t.version,
    parent_id: t.parent_id || null,
    created_at: t.created_at,
  }));

  const { error } = await supabase
    .from('fm_templates')
    .upsert(rows, { onConflict: 'id' });

  if (error) {
    // RLS 权限不足（未认证）— 静默跳过，不重试
    if (error.code === '42501' || error.message?.includes('row-level security')
      || (error as any).status === 403 || error.message?.includes('403')) {
      console.debug('[Sync] fm_templates: 跳过（RLS权限不足）');
      return;
    }
    throw new Error(`templates: ${error.message}`);
  }

  // 推送快照
  const snapshots = fmStore.template_snapshots || [];
  if (snapshots.length > 0) {
    for (const snap of snapshots) {
      const { error: snapError } = await supabase
        .from('fm_template_snapshots')
        .upsert({
          template_id: snap.template_id,
          user_id: userId,
          version: snap.version,
          plan: snap.plan,
          saved_at: snap.saved_at,
        }, {
          onConflict: 'template_id,version',
          ignoreDuplicates: true,
        });

      if (snapError) {
        if (!snapError.message?.includes('duplicate')) {
          throw new Error(`snapshot: ${snapError.message}`);
        }
      }
    }
  }
}

/** 推送设置 */
async function pushSettingsToCloud(userId: string) {
  const { error } = await supabase
    .from('fm_settings')
    .upsert({
      user_id: userId,
      settings: fmStore.settings,
    }, { onConflict: 'user_id' });

  if (error) {
    throw new Error(`settings: ${error.message}`);
  }
}

// ============================================================
// 拉取逻辑
// ============================================================

/** 从云端初始化（登录后调用） */
export async function initFromCloud(userId: string) {
  setSyncStatus('syncing');
  try {
    const [sessionsResult, templatesResult, settingsResult] = await Promise.allSettled([
      pullSessions(userId),
      pullTemplates(userId),
      pullSettings(userId),
    ]);

    // 合并 sessions
    if (sessionsResult.status === 'fulfilled' && sessionsResult.value.length > 0) {
      mergeCloudSessions(sessionsResult.value);
    }

    // 合并 templates
    if (templatesResult.status === 'fulfilled' && templatesResult.value.length > 0) {
      mergeCloudTemplates(templatesResult.value);
    }

    // 合并 settings
    if (settingsResult.status === 'fulfilled' && settingsResult.value) {
      const cloudSettings = settingsResult.value as FMSettings;
      Object.assign(fmStore.settings, cloudSettings);
    }

    // 保存合并后的数据到 localStorage
    saveStoreFromSync();

    // 检查是否有拉取失败
    const failures = [sessionsResult, templatesResult, settingsResult]
      .filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      setSyncStatus('error', '部分数据拉取失败');
    } else {
      setSyncStatus('success');
    }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    setSyncStatus('error', errMsg);
  }
}

async function pullSessions(userId: string): Promise<FMSession[]> {
  const { data: sessionRows, error: sessErr } = await supabase
    .from('fm_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (sessErr || !sessionRows) {
    throw new Error(`拉取场次失败: ${sessErr?.message}`);
  }

  const sessionIds = sessionRows.map(s => s.id);

  const [eventsResult, alertsResult] = await Promise.allSettled([
    supabase.from('fm_events').select('*').in('session_id', sessionIds).order('timestamp'),
    supabase.from('fm_alerts').select('*').in('session_id', sessionIds).order('timestamp'),
  ]);

  const eventRows = eventsResult.status === 'fulfilled' ? (eventsResult.value.data || []) : [];
  const alertRows = alertsResult.status === 'fulfilled' ? (alertsResult.value.data || []) : [];

  return sessionRows.map(row => {
    const session: FMSession = {
      id: row.id,
      plan: row.plan,
      status: row.status,
      start_time: row.start_time,
      end_time: row.end_time || undefined,
      events: eventRows
        .filter((e: any) => e.session_id === row.id)
        .map((e: any) => ({
          id: e.id,
          session_id: e.session_id,
          event_type: e.event_type,
          amount: e.amount != null ? Number(e.amount) : undefined,
          bet_unit: e.bet_unit != null ? Number(e.bet_unit) : undefined,
          note: e.note || undefined,
          raw_input: e.raw_input || undefined,
          timestamp: e.timestamp,
        })),
      alerts: alertRows
        .filter((a: any) => a.session_id === row.id)
        .map((a: any) => ({
          id: a.id,
          level: a.level,
          rule_key: a.rule_key,
          message: a.message,
          voice_message: a.voice_message || undefined,
          timestamp: a.timestamp,
          dismissed: a.dismissed,
        })),
      note: row.note || undefined,
      is_archived: row.is_archived,
      review: row.review || undefined,
    };
    return session;
  });
}

async function pullTemplates(userId: string): Promise<FMTemplate[]> {
  const { data, error } = await supabase
    .from('fm_templates')
    .select('*')
    .eq('user_id', userId)
    .order('created_at');

  if (error || !data) {
    throw new Error(`拉取模板失败: ${error?.message}`);
  }

  return data.map(row => ({
    id: row.id,
    name: row.name,
    description: row.description,
    plan: row.plan,
    is_builtin: row.is_builtin,
    use_count: row.use_count,
    version: row.version,
    parent_id: row.parent_id || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at || undefined,
  }));
}

async function pullSettings(userId: string): Promise<FMSettings | null> {
  const { data, error } = await supabase
    .from('fm_settings')
    .select('settings')
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;
  return data.settings as FMSettings;
}

// ============================================================
// 合并策略（Last-Write-Wins）
// ============================================================

/** 合并冲突日志（调试用） */
const conflictLog: Array<{ type: string; id: string; resolution: string; time: string }> = [];

export function getConflictLog() {
  return conflictLog.slice();
}

function logConflict(type: string, id: string, resolution: string) {
  conflictLog.push({ type, id, resolution, time: new Date().toISOString() });
  if (conflictLog.length > 50) conflictLog.shift();
  console.info(`[Sync] 冲突: ${type} ${id} → ${resolution}`);
}

function mergeCloudSessions(cloudSessions: FMSession[]) {
  const localMap = new Map(fmStore.sessions.map(s => [s.id, s]));

  for (const cloud of cloudSessions) {
    const local = localMap.get(cloud.id);
    if (!local) {
      // 云端新增，直接采纳
      fmStore.sessions.push(cloud);
      continue;
    }

    // 同一场次冲突合并
    let changed = false;

    // 1. 状态升级：ended > recording > planned
    const statusRank: Record<string, number> = { planned: 0, recording: 1, ended: 2 };
    if ((statusRank[cloud.status] || 0) > (statusRank[local.status] || 0)) {
      local.status = cloud.status;
      local.end_time = cloud.end_time;
      changed = true;
      logConflict('session.status', local.id, `升级为 ${cloud.status}`);
    }

    // 2. 事件合并（并集，按 id 去重）
    const localEventIds = new Set(local.events.map(e => e.id));
    const newEvents = cloud.events.filter(e => !localEventIds.has(e.id));
    if (newEvents.length > 0) {
      local.events = [...local.events, ...newEvents]
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      changed = true;
      logConflict('session.events', local.id, `合并 ${newEvents.length} 条新事件`);
    }

    // 3. 警报合并（并集）
    const localAlertIds = new Set(local.alerts.map(a => a.id));
    const newAlerts = cloud.alerts.filter(a => !localAlertIds.has(a.id));
    if (newAlerts.length > 0) {
      local.alerts = [...local.alerts, ...newAlerts]
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      changed = true;
    }

    // 4. Review：云端有本地无 → 采纳；都有 → 取较新的
    if (cloud.review && !local.review) {
      local.review = cloud.review;
      changed = true;
      logConflict('session.review', local.id, '采纳云端 review');
    }

    // 5. Plan 字段：本地优先（用户最后编辑的）
    // 不覆盖，保持本地

    if (changed) {
      localMap.set(local.id, local);
    }
  }

  fmStore.sessions.sort((a, b) =>
    new Date(b.start_time).getTime() - new Date(a.start_time).getTime(),
  );

  if (fmStore.sessions.length > 50) {
    fmStore.sessions.length = 50;
  }
}

function mergeCloudTemplates(cloudTemplates: FMTemplate[]) {
  const localMap = new Map(fmStore.templates.map(t => [t.id, t]));

  for (const cloud of cloudTemplates) {
    // 拦截非法 builtin：云端标记为 builtin 但不在白名单内 → 跳过
    if (cloud.is_builtin && !BUILTIN_IDS.has(cloud.id)) continue;

    const local = localMap.get(cloud.id);
    if (!local) {
      fmStore.templates.push(cloud);
      continue;
    }

    // 版本号更高 → 采纳云端
    if (cloud.version > local.version) {
      logConflict('template', local.id, `云端 v${cloud.version} > 本地 v${local.version}`);
      Object.assign(local, cloud);
    } else if (cloud.version === local.version) {
      // 同版本看 updated_at
      const cloudTime = cloud.updated_at ? new Date(cloud.updated_at).getTime() : 0;
      const localTime = local.updated_at ? new Date(local.updated_at).getTime() : 0;
      if (cloudTime > localTime) {
        logConflict('template', local.id, '同版本，云端更新时间较新');
        Object.assign(local, cloud);
      }
    }
    // 本地版本更高 → 保留本地（下次 push 会覆盖云端）
  }
}

// ============================================================
// 首次迁移（localStorage → Cloud）
// ============================================================

export async function migrateLocalToCloud(userId: string) {
  setSyncStatus('syncing');
  try {
    await Promise.allSettled([
      pushSessionsToCloud(userId),
      pushTemplatesToCloud(userId),
      pushSettingsToCloud(userId),
    ]);
    setSyncStatus('success');
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    setSyncStatus('error', errMsg);
  }
}

// ============================================================
// 辅助：直接写入 localStorage（不触发 notify）
// ============================================================

const STORAGE_KEY = 'roundtable_fm_v1';

function saveStoreFromSync() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      sessions: fmStore.sessions,
      templates: fmStore.templates,
      active_session_id: fmStore.active_session_id,
      settings: fmStore.settings,
    }));
  } catch (e) {
    // localStorage 写入失败（容量满等），不阻断流程
  }
}
