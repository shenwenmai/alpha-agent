import { store, handleToolCall } from './extractionService';
import type { PipelineEvent } from './extractionService';
import type { UserProfile, RiskLevel } from '../types/schema';

// ============================================================
// persistEventPipeline — 结构化数据提取管线
// validate → confidence split → save → linkEvidence → recomputeProfile
// 状态机: pending → saved | failed
// ============================================================

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function logPipelineEvent(event: PipelineEvent) {
  store.pipelineLog.push(event);
  if (store.pipelineLog.length > 100) store.pipelineLog.shift();
}

/**
 * persistEventPipeline
 * Wraps handleToolCall with pipeline status tracking and profile recomputation
 */
export async function persistEventPipeline(
  toolCall: { name: string; arguments: Record<string, any> },
  sourceMessageId: string
): Promise<PipelineEvent> {
  const eventId = generateId();
  const event: PipelineEvent = {
    id: eventId,
    status: 'pending',
    event_type: toolCall.name,
    sourceMessageId,
  };

  logPipelineEvent(event);

  try {
    // Validate basic structure
    if (!toolCall.name || !toolCall.arguments) {
      event.status = 'failed';
      event.error = 'invalid_schema';
      return event;
    }

    // Ensure sourceMessageId is set
    const args: Record<string, any> = { ...toolCall.arguments, sourceMessageId };

    // Confidence gating is handled inside handleToolCall
    const confidence = args.confidence || 0;

    if (confidence < 0.6) {
      event.status = 'failed';
      event.error = 'low_confidence';
      console.log(`[Pipeline] ${eventId} | ${toolCall.name} | dropped (confidence=${confidence})`);
      return event;
    }

    // Delegate to existing handleToolCall (which does the actual persist + confidence split)
    const result = await handleToolCall(toolCall.name, args);

    if (result.status === 'dropped') {
      event.status = 'failed';
      event.error = 'low_confidence';
    } else if (result.status === 'skipped') {
      event.status = 'failed';
      event.error = result.reason || 'dedup_skipped';
      console.log(`[Pipeline] ${eventId} | ${toolCall.name} | skipped (${result.reason})`);
      return event;
    } else if (result.status === 'error') {
      event.status = 'failed';
      event.error = result.message || 'unknown_tool';
    } else {
      event.status = 'saved';
      event.savedAt = new Date().toISOString();

      // Auto link evidence for financial and collapse events
      if (toolCall.name === 'recordFinancialRecord' || toolCall.name === 'recordCollapseEvent') {
        if (result.id) {
          await handleToolCall('linkEvidence', {
            sourceMessageId,
            targetId: result.id,
            type: 'self_report',
          });
        }
      }

      // Recompute user profile after successful save
      recomputeProfile();
    }

    console.log(`[Pipeline] ${eventId} | ${toolCall.name} | ${event.status}${event.error ? ` (${event.error})` : ''}`);
    return event;

  } catch (err: any) {
    event.status = 'failed';
    event.error = err.message || 'exception';
    console.error(`[Pipeline] ${eventId} | ${toolCall.name} | error:`, err);
    return event;
  }
}

/**
 * recomputeProfile — 基于当前数据重新计算用户画像
 * 规则引擎: 频率+金额+情绪 → type/stage/riskLevel/triggers
 */
export function recomputeProfile(): UserProfile {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Recent data windows
  const recentCollapses = store.collapses.filter(c => new Date(c.date) > thirtyDaysAgo);
  const recentFinancials = store.financials.filter(f => new Date(f.date) > thirtyDaysAgo);
  const recentEmotions = store.emotions.filter(e => new Date(e.date) > sevenDaysAgo);
  const recentInputs30d = recentFinancials.filter(f => f.direction === '投入');

  // --- Determine type ---
  let type: UserProfile['type'] = 'cycler';

  // Chaser: frequent inputs + collapses, trying to win back
  if (recentInputs30d.length >= 3 && recentCollapses.length >= 2) {
    type = 'chaser';
  }
  // Sober: no collapses in 30 days, few inputs
  else if (recentCollapses.length === 0 && recentInputs30d.length <= 1) {
    type = 'sober';
  }
  // Researcher: low emotion intensity, asks questions (heuristic)
  else if (recentEmotions.length > 0 && recentEmotions.every(e => e.intensity <= 4)) {
    type = 'researcher';
  }

  // --- Determine stage ---
  let stage: UserProfile['stage'] = 'construction';

  const highEmotions = recentEmotions.filter(e => e.intensity >= 8);
  if (highEmotions.length >= 2 || recentCollapses.length >= 3) {
    stage = 'crisis';
  } else if (recentCollapses.length === 0 && recentInputs30d.length === 0) {
    stage = 'maintenance';
  }

  // --- Risk level L1-L4 ---
  let riskLevel: RiskLevel = 'L1';

  const recentInputs = recentFinancials.filter(f => f.direction === '投入');
  const totalRecentInput = recentInputs.reduce((sum, f) => sum + f.amount, 0);
  const hasBorrowing = recentFinancials.some(f => f.direction === '投入' && f.fundSource === '借贷');
  const hasLivingFundUsed = recentFinancials.some(f => f.direction === '投入' && f.fundSource === '生活金');
  const highEmotionCount = highEmotions.length;

  // L4 红线: 借贷投入 OR (借贷+生活金同时) OR 危机+高情绪≥3
  if (hasBorrowing || (stage === 'crisis' && highEmotionCount >= 3)) {
    riskLevel = 'L4';
  }
  // L3 止损: 动用生活金 OR 危机阶段 OR 总投入>10000 OR 崩塌≥3次
  else if (hasLivingFundUsed || stage === 'crisis' || totalRecentInput > 10000 || recentCollapses.length >= 3) {
    riskLevel = 'L3';
  }
  // L2 警告: 有崩塌 OR 频繁投入(≥3次)
  else if (recentCollapses.length >= 1 || recentInputs.length >= 3) {
    riskLevel = 'L2';
  }
  // L1 观察: 其他

  // --- Triggers ---
  const triggers: string[] = [];
  if (recentCollapses.some(c => c.trigger.includes('深夜') || c.trigger.includes('晚'))) {
    triggers.push('深夜时段');
  }
  if (recentCollapses.some(c => c.trigger.includes('赌场') || c.trigger.includes('casino'))) {
    triggers.push('赌场环境');
  }
  if (recentCollapses.some(c => c.trigger.includes('工资') || c.trigger.includes('发钱'))) {
    triggers.push('发薪日');
  }
  if (recentCollapses.some(c => c.trigger.includes('赢') || c.trigger.includes('win'))) {
    triggers.push('赢钱后不满足');
  }

  const profile: UserProfile = {
    type,
    stage,
    riskLevel,
    lastActive: now.toISOString(),
    triggers,
  };

  store.userProfile = profile;

  // Save is handled by the caller (handleToolCall already calls saveStore)
  console.log(`[Profile] Recomputed:`, profile);
  return profile;
}
