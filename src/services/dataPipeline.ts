// ============================================================
// 数据管道编排 — Data Pipeline Orchestrator
// 连接前端引擎 → 数据库，实现"越用越懂你"
//
// 管道 1: ETP 状态变化 → 记录转折点事件
// 管道 2: 干预响应 → 记录用户行为
// 管道 3: 场次结束 → 推送情绪快照 + 转折点到云端
// 管道 4: 场次结束 → 计算成长画像并推送
// ============================================================

import { supabase, getCurrentUserId } from './supabaseClient';
import { getEndedSessions, addEvent, getSession } from './fundManagerService';
import { evaluateETP, restoreETPState, type ETPResult, type ETPState } from './emotionEngine';
import { evaluateIntervention, evaluateInterventionFromRisk, type InterventionResult, type LastIntervention } from './interventionEngine';
import { detectTurningPoints, type TurningPoint } from './turningPointEngine';
import { generateProfile, type GrowthProfile } from './growthEngine';
import type { FMSession, FMMetrics, EmotionProfile } from '../types/fundManager';
import type { EmotionState } from './emotionEngine';
import { evaluate as evaluateRisk, metricsToRiskInput, resetEngine as resetRiskEngine, serializeEngineState, restoreEngineState } from './riskEvaluationEngine';
import { getDefaultRiskConfig } from './riskConfigService';
import type { GoldenTemplateId, EvaluationResult } from '../types/riskConfig';
import { GOLDEN_TEMPLATES } from '../constants/goldenTemplates';

// ============================================================
// 管道 1: ETP 实时评估 + 转折点记录
// ============================================================

// 每个 session 的 ETP 追踪状态
interface ETPTracker {
  sessionId: string;
  lastState: ETPState;
  snapshots: EmotionSnapshot[];
  turningPoints: PipelineTurningPoint[];
  interventions: PipelineIntervention[];
  lastIntervention: LastIntervention | null;
}

// 情绪快照（每次状态变化时记录）
interface EmotionSnapshot {
  session_id: string;
  timestamp: string;
  score: number;
  level: string;
  signals: string[];
  intervention: string | null;
  event_index: number;
  metrics_snapshot: {
    net_pnl: number;
    total_hands: number;
    current_bet_unit: number;
    elapsed_minutes: number;
  };
}

// 转折点记录
interface PipelineTurningPoint {
  session_id: string;
  timestamp: string;
  event_index: number;
  from_level: string;
  to_level: string;
  etp_state: ETPState;
  etp_score: number;
  conditions_met: string[];
  turning_reasons: string[];
  context: {
    net_pnl: number;
    current_bet_unit: number;
    elapsed_minutes: number;
    etp_score?: number;
    tilt_score?: number;
  };
}

// 干预记录（列名对齐 migration-memory-system.sql session_interventions 表）
interface PipelineIntervention {
  session_id: string;
  timestamp: string;
  trigger_type: string;
  trigger_level: string;           // DB: trigger_level (mild/moderate/severe)
  trigger_reason: object | null;   // DB: trigger_reason (JSONB)
  ui_mode: string;                 // DB: ui_mode (toast/modal/fullscreen)
  message_text: string;            // DB: message_text
  message_pool_key: string;        // DB: message_pool_key
  user_action: string | null;      // DB: user_action
  action_delay_seconds: number | null; // DB: action_delay_seconds (秒)
  effective_result: string | null; // DB: effective_result
  shown_at: number;                // 内部用，不写入 DB
}

// 活跃 session 的 tracker（模块级缓存）
const trackers = new Map<string, ETPTracker>();

/** 获取或创建 session 的 tracker */
function getTracker(sessionId: string): ETPTracker {
  let tracker = trackers.get(sessionId);
  if (!tracker) {
    tracker = {
      sessionId,
      lastState: 'normal',
      snapshots: [],
      turningPoints: [],
      interventions: [],
      lastIntervention: null,
    };
    trackers.set(sessionId, tracker);
  }
  return tracker;
}

/**
 * 管道 1: 实时 ETP 评估
 * 每次事件后调用，检测 ETP 状态变化并记录
 *
 * @returns ETP 评估结果 + 干预结果
 */
export function evaluateLiveETP(
  session: FMSession,
  metrics: FMMetrics,
  emotionState: EmotionState,
): {
  etpResult: ETPResult;
  interventionResult: InterventionResult;
  riskResult: EvaluationResult | null;
} {
  const tracker = getTracker(session.id);

  // 评估 ETP（传入情绪分，用于行为红线快速通道）
  const etpResult = evaluateETP(metrics, session, emotionState.score);

  // 评估干预（ETP通道，可能被三维引擎覆盖）
  let interventionResult = evaluateIntervention(
    { ...metrics, tilt_score_snapshot: emotionState.score },
    etpResult,
    session.plan,
    tracker.lastIntervention,
  );

  // ── 三维风控引擎（v1.2：评估结果驱动干预，优先级 > ETP） ──
  let riskResult: EvaluationResult | null = null;
  try {
    if (session.plan && metrics.total_hands > 0) {
      const validIds = new Set(['A', 'B', 'C', 'D', 'E']);
      const rawId = (session.plan as unknown as Record<string, unknown>).template_id as string;
      const templateId = (validIds.has(rawId) ? rawId : 'A') as GoldenTemplateId;
      const template = GOLDEN_TEMPLATES[templateId];
      const riskConfig = getDefaultRiskConfig(templateId, session.plan.session_budget);
      const riskInput = metricsToRiskInput(metrics, session, session.plan, template.params);
      riskResult = evaluateRisk(riskInput, riskConfig);

      // v1.2: 三维引擎驱动干预（优先级 > ETP干预）
      const riskIntervention = evaluateInterventionFromRisk(
        riskResult, metrics, session.plan, tracker.lastIntervention,
      );
      // 取更高级别：三维引擎 vs ETP
      const LEVEL_NUM: Record<string, number> = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4 };
      if (riskIntervention.triggered &&
          LEVEL_NUM[riskIntervention.level] >= LEVEL_NUM[interventionResult.level]) {
        interventionResult = riskIntervention;
      }

      // 3a: 附加风控快照到最近事件（供复盘页读取）
      const lastEvent = session.events[session.events.length - 1];
      if (lastEvent && riskResult) {
        lastEvent.risk_snapshot = {
          level: riskResult.interventionLevel,
          tier: riskResult.finalTier,
          profitLockStage: riskResult.profitLockStage,
          toxicCombos: riskResult.toxicCombos,
          keyMoments: riskResult.keyMoments,
          survivalProb: riskResult.survivalProb,
          etpProb: riskResult.etpProb,
          collapseProb: riskResult.collapseProb,
        };
      }

      console.debug('[风控引擎]', `手${metrics.total_hands}`,
        `生存=${riskResult.survivalProb}`, `情绪=${riskResult.etpProb}`,
        `路径=${riskResult.collapseProb}`, `级别=${riskResult.interventionLevel}`,
        `来源=${riskResult.interventionSource}`,
        `锁盈=${riskResult.profitLockStage}`,
        `有效阈值=${JSON.stringify(riskResult.effectiveLimits)}`,
        `毒药=${riskResult.toxicCombos.join(',') || '无'}`);
    }
  } catch (e) {
    console.error('[风控引擎] 评估错误:', e);
  }

  // 检测 ETP 状态变化 → 记录转折点
  if (etpResult.etpState !== tracker.lastState) {
    const stateChanged = etpResult.etpState !== 'normal';

    if (stateChanged) {
      // 记录情绪快照
      tracker.snapshots.push({
        session_id: session.id,
        timestamp: new Date().toISOString(),
        score: emotionState.score,
        level: emotionState.level,
        signals: emotionState.signals.map(s => s.type),
        intervention: emotionState.intervention,
        event_index: session.events.length - 1,
        metrics_snapshot: {
          net_pnl: metrics.net_pnl,
          total_hands: metrics.total_hands,
          current_bet_unit: metrics.current_bet_unit,
          elapsed_minutes: metrics.elapsed_minutes,
        },
      });

      // 记录转折点（阶段4-6有记录价值）
      if (etpResult.etpState === 'triggered' || etpResult.etpState === 'critical' || etpResult.etpState === 'collapsed') {
        const tp: PipelineTurningPoint = {
          session_id: session.id,
          timestamp: new Date().toISOString(),
          event_index: session.events.length - 1,
          from_level: tracker.lastState,
          to_level: etpResult.etpState,
          etp_state: etpResult.etpState,
          etp_score: etpResult.etpScore,
          conditions_met: etpResult.conditions.filter(c => c.met).map(c => c.type),
          turning_reasons: etpResult.turningReasons,
          context: {
            net_pnl: metrics.net_pnl,
            current_bet_unit: metrics.current_bet_unit,
            elapsed_minutes: metrics.elapsed_minutes,
            etp_score: etpResult.etpScore,
            tilt_score: emotionState.score,
          },
        };
        tracker.turningPoints.push(tp);

        // 同时写入本地 session 事件（这样复盘能看到）
        const stateLabels: Record<string, string> = {
          triggered: 'ETP情绪转折点',
          critical: 'ETP上头临界点',
          collapsed: 'ETP整场失控',
        };
        addEvent(session.id, {
          event_type: 'emotion',
          note: `${stateLabels[etpResult.etpState] || 'ETP'}：${etpResult.turningReasons.join('；')}`,
          timestamp: new Date().toISOString(),
        });
      }
    }

    tracker.lastState = etpResult.etpState;
  }

  // 每次评估后 checkpoint，防刷新丢失
  checkpointTracker(session.id);

  return { etpResult, interventionResult, riskResult };
}

// ============================================================
// 管道 2: 干预响应记录
// ============================================================

/**
 * 记录干预展示（干预弹出时调用）
 */
export function recordInterventionShown(
  sessionId: string,
  intervention: InterventionResult,
): void {
  const tracker = getTracker(sessionId);

  tracker.interventions.push({
    session_id: sessionId,
    timestamp: new Date().toISOString(),
    trigger_type: intervention.trigger_type,
    trigger_level: intervention.level,
    trigger_reason: { title: intervention.title, pool_key: intervention.pool_key },
    ui_mode: intervention.ui_mode,
    message_text: intervention.message,
    message_pool_key: intervention.pool_key,
    user_action: null,
    action_delay_seconds: null,
    effective_result: null,
    shown_at: Date.now(),
  });

  // 更新 lastIntervention（供冷却逻辑使用）
  tracker.lastIntervention = {
    level: intervention.level,
    timestamp: Date.now(),
    trigger_type: intervention.trigger_type,
  };
}

/**
 * 记录用户对干预的响应（用户点击按钮时调用）
 */
export function recordInterventionResponse(
  sessionId: string,
  actionKey: string,
): void {
  const tracker = getTracker(sessionId);

  // 更新最后一条干预记录
  const lastIntervention = tracker.interventions[tracker.interventions.length - 1];
  if (lastIntervention && lastIntervention.user_action === null) {
    lastIntervention.user_action = actionKey;
    lastIntervention.action_delay_seconds = Math.round((Date.now() - lastIntervention.shown_at) / 1000);
    // 根据用户行为推断效果
    lastIntervention.effective_result =
      actionKey === 'end_session' || actionKey === 'sbi_end_session' ? 'ended'
      : actionKey === 'dismiss' || actionKey === 'continue' || actionKey === 'sbi_continue' ? 'ignored'
      : actionKey === 'pause' || actionKey === 'view_rules' || actionKey === 'open_rules' || actionKey === 'reset_bet' || actionKey === 'sbi_confirm' || actionKey === 'start_self_check' ? 'calmed'
      : 'ignored';
  }

  // 同时写入 session 事件
  addEvent(sessionId, {
    event_type: 'emotion',
    note: `干预响应：${actionKey}`,
    timestamp: new Date().toISOString(),
  });
}

// ============================================================
// 管道 3: 场次结束 → 推送情绪数据到云端（含重试队列）
// ============================================================

const RETRY_QUEUE_KEY = 'fm_sync_retry_queue';
const MAX_RETRIES = 3;

/** 保存失败数据到重试队列 */
function enqueueRetry(payload: { snapshots: any[]; turning_points: any[]; interventions: any[] }): void {
  try {
    const raw = localStorage.getItem(RETRY_QUEUE_KEY);
    const queue: any[] = raw ? JSON.parse(raw) : [];
    queue.push({ payload, retries: 0, enqueuedAt: Date.now() });
    // 最多保留5个待重试任务
    while (queue.length > 5) queue.shift();
    localStorage.setItem(RETRY_QUEUE_KEY, JSON.stringify(queue));
  } catch { /* noop */ }
}

/** 尝试消费重试队列（场次开始时调用） */
export async function flushRetryQueue(): Promise<void> {
  try {
    const raw = localStorage.getItem(RETRY_QUEUE_KEY);
    if (!raw) return;
    const queue: any[] = JSON.parse(raw);
    if (queue.length === 0) return;

    const { data: { session: authSession } } = await supabase.auth.getSession();
    const token = authSession?.access_token;
    if (!token) return;

    const remaining: any[] = [];
    for (const item of queue) {
      try {
        const res = await fetch('/api/emotion-sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            snapshots: item.payload.snapshots,
            turning_points: item.payload.turning_points,
          }),
        });
        if (!res.ok && item.retries < MAX_RETRIES) {
          remaining.push({ ...item, retries: item.retries + 1 });
        }
        // 成功或超过重试次数：丢弃
      } catch {
        if (item.retries < MAX_RETRIES) {
          remaining.push({ ...item, retries: item.retries + 1 });
        }
      }
    }

    if (remaining.length > 0) {
      localStorage.setItem(RETRY_QUEUE_KEY, JSON.stringify(remaining));
    } else {
      localStorage.removeItem(RETRY_QUEUE_KEY);
    }
  } catch { /* noop */ }
}

/**
 * 场次结束时调用：收集所有情绪数据并异步推送到 /api/emotion-sync
 */
export async function pushEmotionData(sessionId: string): Promise<void> {
  const tracker = trackers.get(sessionId);
  if (!tracker) return;

  const userId = getCurrentUserId();
  if (!userId) return;

  // 获取完整 session 来做离线转折点分析
  const session = getSession(sessionId);
  if (!session) return;

  // 用 turningPointEngine 做完整的逐事件回放分析
  const detailedPoints = detectTurningPoints(session);

  // 合并 pipeline 实时记录 + 离线回放分析（去重：同一 event_index 只保留一条）
  const pipelinePoints = tracker.turningPoints.map(tp => ({
    session_id: tp.session_id,
    timestamp: tp.timestamp,
    event_index: tp.event_index,
    from_level: tp.from_level,
    to_level: tp.to_level,
    trigger_event: null,
    trigger_signals: tp.conditions_met,
    description: tp.turning_reasons.join('；'),
    elapsed_minutes: tp.context.elapsed_minutes,
    context: tp.context,
  }));
  const pipelineEventIndices = new Set(pipelinePoints.map(p => p.event_index));
  // 离线回放分析的只保留 pipeline 没捕获到的事件
  const replayPoints = detailedPoints
    .filter(tp => !pipelineEventIndices.has(tp.eventIndex))
    .map(tp => ({
      session_id: sessionId,
      timestamp: tp.timestamp,
      event_index: tp.eventIndex,
      from_level: tp.fromLevel,
      to_level: tp.toLevel,
      trigger_event: { event_type: tp.triggerEvent.event_type, amount: tp.triggerEvent.amount },
      trigger_signals: tp.triggerSignals,
      description: tp.description,
      elapsed_minutes: tp.elapsedMinutes,
      context: tp.context,
    }));
  const allTurningPoints = [...pipelinePoints, ...replayPoints];

  try {
    // 获取 auth token
    const { data: { session: authSession } } = await supabase.auth.getSession();
    const token = authSession?.access_token;
    if (!token) return;

    // 推送到 /api/emotion-sync
    const res = await fetch('/api/emotion-sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        snapshots: tracker.snapshots,
        turning_points: allTurningPoints,
      }),
    });

    if (!res.ok) {
      console.error('[dataPipeline] emotion-sync failed:', await res.text().catch(() => ''));
      // 推送失败 → 加入重试队列
      enqueueRetry({
        snapshots: tracker.snapshots,
        turning_points: allTurningPoints,
        interventions: tracker.interventions,
      });
    }

    // 推送干预记录到 session_interventions（列名对齐 migration-memory-system.sql）
    if (tracker.interventions.length > 0) {
      const interventionRows = tracker.interventions.map(iv => ({
        user_id: userId,
        session_id: iv.session_id,
        trigger_type: iv.trigger_type,
        trigger_level: iv.trigger_level,
        trigger_reason: iv.trigger_reason,
        ui_mode: iv.ui_mode,
        message_text: iv.message_text,
        message_pool_key: iv.message_pool_key,
        user_action: iv.user_action,
        action_delay_seconds: iv.action_delay_seconds,
        effective_result: iv.effective_result,
      }));

      const { error } = await supabase
        .from('session_interventions')
        .insert(interventionRows);

      if (error) {
        console.error('[dataPipeline] session_interventions insert error:', error.message);
      }
    }
  } catch (e) {
    console.error('[dataPipeline] pushEmotionData error:', e);
    // 网络错误 → 加入重试队列
    if (tracker) {
      enqueueRetry({
        snapshots: tracker.snapshots,
        turning_points: [],
        interventions: tracker.interventions,
      });
    }
  }
}

// ============================================================
// 管道 4: 场次结束 → 计算成长画像并推送
// ============================================================

/**
 * 场次结束后调用：重新计算成长画像并推送到 growth_profiles
 */
export async function pushGrowthProfile(): Promise<void> {
  const userId = getCurrentUserId();
  if (!userId) return;

  try {
    const endedSessions = getEndedSessions();
    if (endedSessions.length < 2) return; // 至少2场才有意义

    const profile = generateProfile(endedSessions);

    // 推送到 growth_profiles
    const { error } = await supabase
      .from('growth_profiles')
      .upsert({
        user_id: userId,
        total_sessions: profile.totalSessions,
        total_hands: profile.totalHands,
        avg_discipline_score: profile.avgDisciplineScore,
        discipline_trend: profile.disciplineTrend,
        optimal_base_unit: profile.optimalBaseUnit,
        danger_zones: profile.dangerZones,
        common_errors: profile.commonErrors,
        turning_point_summary: profile.turningPointSummary,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (error) {
      console.error('[dataPipeline] growth_profiles upsert error:', error.message);
    }

    // 推送 user_pattern_stats（列名对齐 migration-memory-system.sql）
    const { error: statsError } = await supabase
      .from('user_pattern_stats')
      .upsert({
        user_id: userId,
        total_sessions: profile.totalSessions,
        total_hands: profile.totalHands,
        avg_discipline_score: profile.avgDisciplineScore,
        avg_turning_point_hand: profile.turningPointSummary.avgTimeToFirstTilt,
        most_common_turning_trigger: profile.turningPointSummary.mostCommonTrigger,
        most_common_rule_break: profile.commonErrors[0]?.type || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (statsError) {
      console.error('[dataPipeline] user_pattern_stats upsert error:', statsError.message);
    }
  } catch (e) {
    console.error('[dataPipeline] pushGrowthProfile error:', e);
  }
}

// ============================================================
// 管道 5: 场次结束 → 推送风控评估摘要（数据闭环）
//
// 用途：
//   1. 干预有效性分析（哪个级别/话术让用户停下）
//   2. 毒药组合验证（是否真的导致更大亏损）
//   3. 锁盈阈值校准（阈值是否合理）
//   4. 模板参数再学习（A/B/C参数优化依据）
// ============================================================

/**
 * 从 session events 的 risk_snapshot 聚合风控摘要，推送到 session_risk_summaries
 */
export async function pushRiskSummary(sessionId: string): Promise<void> {
  const userId = getCurrentUserId();
  if (!userId) return;

  const session = getSession(sessionId);
  if (!session) return;

  // 从 events 提取风控快照
  const snapshots = session.events
    .filter(e => e.risk_snapshot)
    .map((e, idx) => ({
      hand: idx + 1,
      level: e.risk_snapshot!.level,
      survivalProb: e.risk_snapshot!.survivalProb,
      etpProb: e.risk_snapshot!.etpProb,
      collapseProb: e.risk_snapshot!.collapseProb,
      profitLockStage: e.risk_snapshot!.profitLockStage,
    }));

  if (snapshots.length === 0) return;

  // 聚合统计
  const LEVEL_NUM: Record<string, number> = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4 };
  let maxLevel = 'L0';
  let interventionCount = 0;
  let maxProfitLockStage = 0;
  const allToxicCombos = new Set<string>();
  const allKeyMoments = new Set<string>();
  let minSurvival = 1;
  let maxEtp = 0;
  let maxCollapse = 0;

  for (const e of session.events) {
    if (!e.risk_snapshot) continue;
    const s = e.risk_snapshot;
    if (LEVEL_NUM[s.level] > LEVEL_NUM[maxLevel]) maxLevel = s.level;
    if (LEVEL_NUM[s.level] >= 2) interventionCount++;
    if (s.profitLockStage > maxProfitLockStage) maxProfitLockStage = s.profitLockStage;
    s.toxicCombos.forEach(tc => allToxicCombos.add(tc));
    s.keyMoments.forEach(km => allKeyMoments.add(km));
    if (s.survivalProb < minSurvival) minSurvival = s.survivalProb;
    if (s.etpProb > maxEtp) maxEtp = s.etpProb;
    if (s.collapseProb > maxCollapse) maxCollapse = s.collapseProb;
  }

  // 从 tracker 的 interventions 聚合干预有效性
  const tracker = trackers.get(sessionId);
  let complied = 0;
  let ignored = 0;
  let totalDelay = 0;
  let delayCount = 0;

  if (tracker) {
    for (const iv of tracker.interventions) {
      if (iv.effective_result === 'ended') complied++;
      else if (iv.effective_result === 'ignored') ignored++;
      if (iv.action_delay_seconds !== null) {
        totalDelay += iv.action_delay_seconds;
        delayCount++;
      }
    }
  }

  // 计算场次结果指标
  const metrics = computeMetricsFromSession(session);

  const row = {
    user_id: userId,
    session_id: sessionId,
    template_id: (session as unknown as Record<string, unknown>).template_id as string
      || (session.plan as unknown as Record<string, unknown>)?.template_id as string
      || null,
    entry_bank: session.plan.session_budget,
    final_pnl: metrics?.net_pnl ?? null,
    total_hands: metrics?.total_hands ?? session.events.filter(e => e.event_type === 'win' || e.event_type === 'loss').length,
    elapsed_min: metrics?.elapsed_minutes ?? null,

    max_level: maxLevel,
    intervention_count: interventionCount,
    max_profit_lock_stage: maxProfitLockStage,
    toxic_combos: [...allToxicCombos],
    key_moments: [...allKeyMoments],

    min_survival_prob: minSurvival,
    max_etp_prob: maxEtp,
    max_collapse_prob: maxCollapse,

    interventions_complied: complied,
    interventions_ignored: ignored,
    avg_response_delay_sec: delayCount > 0 ? Math.round(totalDelay / delayCount) : null,

    hand_snapshots: snapshots,
  };

  try {
    const { error } = await supabase
      .from('session_risk_summaries')
      .insert(row);

    if (error) {
      console.error('[dataPipeline] session_risk_summaries insert error:', error.message);
    } else {
      console.debug('[dataPipeline] 管道5: 风控摘要已推送', sessionId,
        `maxLevel=${maxLevel}`, `interventions=${interventionCount}`,
        `toxic=${[...allToxicCombos].join(',')||'无'}`);
    }
  } catch (e) {
    console.error('[dataPipeline] pushRiskSummary error:', e);
  }
}

/**
 * 从 session 计算基本指标（不依赖外部 computeMetrics，防循环依赖）
 */
function computeMetricsFromSession(session: FMSession): { net_pnl: number; total_hands: number; elapsed_minutes: number } | null {
  const handEvents = session.events.filter(e => e.event_type === 'win' || e.event_type === 'loss');
  if (handEvents.length === 0) return null;

  let netPnl = 0;
  for (const e of handEvents) {
    netPnl += e.amount ?? 0;
  }

  const startTime = new Date(session.start_time).getTime();
  const endTime = session.end_time ? new Date(session.end_time).getTime() : Date.now();
  const elapsedMin = (endTime - startTime) / 60000;

  return {
    net_pnl: netPnl,
    total_hands: handEvents.length,
    elapsed_minutes: Math.round(elapsedMin * 10) / 10,
  };
}

// ============================================================
// 场次生命周期钩子
// ============================================================

/**
 * 场次结束时的统一入口：串行执行所有管道
 * 由 fundManagerService.endSession 调用
 */
export async function onSessionEnd(sessionId: string): Promise<void> {
  try {
    // 管道 3: 推送情绪数据
    await pushEmotionData(sessionId);

    // 管道 4: 更新成长画像
    await pushGrowthProfile();

    // 管道 5: 推送风控评估摘要（数据闭环）
    await pushRiskSummary(sessionId);

    // 清理 tracker + checkpoint
    trackers.delete(sessionId);
    clearCheckpoint();
  } catch (e) {
    console.error('[dataPipeline] onSessionEnd error:', e);
  }
}

/** 场次开始时清理旧 tracker 或恢复上次的 checkpoint */
export function onSessionStart(sessionId: string): void {
  trackers.delete(sessionId);
  getTracker(sessionId); // 创建新的
  resetRiskEngine(); // 三维引擎状态重置
  restoreTrackerIfNeeded(sessionId); // 如果有上次未完成的数据则恢复
  // 异步消费上次失败的推送队列
  flushRetryQueue().catch(() => {});
}

/** 获取当前 tracker 的 lastIntervention（供干预冷却使用） */
export function getLastIntervention(sessionId: string): LastIntervention | null {
  return trackers.get(sessionId)?.lastIntervention ?? null;
}

// ============================================================
// Checkpoint: 定期保存 tracker 到 localStorage，防止刷新丢失
// ============================================================

const CHECKPOINT_KEY = 'fm_pipeline_checkpoint';

/** 保存当前 tracker + 风控引擎状态到 localStorage */
function checkpointTracker(sessionId: string): void {
  const tracker = trackers.get(sessionId);
  if (!tracker) return;
  try {
    const data = {
      sessionId: tracker.sessionId,
      lastState: tracker.lastState,
      snapshots: tracker.snapshots,
      turningPoints: tracker.turningPoints,
      interventions: tracker.interventions,
      lastIntervention: tracker.lastIntervention,
      riskEngineState: serializeEngineState(),
      savedAt: Date.now(),
    };
    localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(data));
  } catch {
    // localStorage 满时不阻断
  }
}

/** 从 localStorage 恢复 tracker（场次开始时调用） */
export function restoreTrackerIfNeeded(sessionId: string): void {
  try {
    const raw = localStorage.getItem(CHECKPOINT_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    // 只恢复同一个 session 的数据，且不超过 30 分钟
    if (data.sessionId !== sessionId) return;
    if (Date.now() - data.savedAt > 30 * 60 * 1000) return;

    const tracker = getTracker(sessionId);
    tracker.lastState = data.lastState || 'normal';
    tracker.snapshots = data.snapshots || [];
    tracker.turningPoints = data.turningPoints || [];
    tracker.interventions = data.interventions || [];
    tracker.lastIntervention = data.lastIntervention || null;
    // 同步恢复情绪引擎的 ETP 状态，防止引擎重新从 normal 开始
    restoreETPState(tracker.lastState as ETPState);
    // 恢复三维风控引擎状态（emaBet, currentLevel, stableHandsCount）
    if (data.riskEngineState) {
      restoreEngineState(data.riskEngineState);
    }
  } catch {
    // 解析失败忽略
  }
}

/** 清除 checkpoint（场次正常结束后调用） */
function clearCheckpoint(): void {
  try { localStorage.removeItem(CHECKPOINT_KEY); } catch { /* noop */ }
}
