import React, { useState, useEffect, useRef } from 'react';
import { Eye } from 'lucide-react';
import { EmotionGauge } from '../ui';
import { theme } from '../../theme';
import type { EmotionLevel } from '../../theme';
import type { FMSession, FMMetrics } from '../../types/fundManager';
import type { EmotionState } from '../../services/emotionEngine';
import type { ActiveScene } from '../../services/sceneDetector';
import type { EvaluationResult } from '../../types/riskConfig';
import { recordScriptShown, attributeScriptResponse } from '../../services/fundManagerService';

const levelLabel: Record<EmotionLevel, string> = {
  calm: '平静',
  mild: '注意',
  moderate: '警惕',
  severe: '危险',
};

// 场景级别颜色
const sceneLevelColor: Record<string, string> = {
  L1: '#60a5fa',   // 蓝
  L2: '#E6B800',   // 黄
  L3: '#fb923c',   // 橙
  L4: '#ef4444',   // 红
};

const sceneLevelBg: Record<string, string> = {
  L1: 'rgba(96,165,250,0.10)',
  L2: 'rgba(230,184,0,0.10)',
  L3: 'rgba(251,146,60,0.10)',
  L4: 'rgba(239,68,68,0.12)',
};

const sceneLevelBorder: Record<string, string> = {
  L1: 'rgba(96,165,250,0.25)',
  L2: 'rgba(230,184,0,0.30)',
  L3: 'rgba(251,146,60,0.35)',
  L4: 'rgba(239,68,68,0.40)',
};

type TrajectoryPattern = 'stable' | 'deteriorating' | 'false_calm' | 'recovering' | 'volatile';

interface EmotionPanelProps {
  session: FMSession;
  metrics: FMMetrics;
  emotionState: EmotionState;
  activeScene: ActiveScene | null;
  riskResult?: EvaluationResult | null;
  trajectoryPattern?: TrajectoryPattern;
  onPause: () => void;
  onEnd: () => void;
}

export default function EmotionPanel({
  session,
  metrics,
  emotionState,
  activeScene,
  riskResult,
  trajectoryPattern = 'stable',
  onPause,
  onEnd,
}: EmotionPanelProps) {
  const [assistantMode, setAssistantMode] = useState(false);
  const [showRules, setShowRules] = useState(false);

  const plan = session.plan;
  const isSevere = emotionState.level === 'severe';

  // ── 专属战约话术：有 talk_scripts 且当前有场景时，选一句最相关的 ──
  const activeScriptEntry = React.useMemo<{ index: number; text: string } | null>(() => {
    const scripts = plan.talk_scripts;
    if (!scripts?.length || !activeScene) return null;
    const key = activeScene.poolKey || '';
    let index = 2;
    if (key.includes('streak') || key.includes('chase') || key.includes('loss')) index = 0;
    else if (key.includes('profit') || key.includes('giveback') || key.includes('lock')) index = 1;
    const text = scripts[index] ?? scripts[0];
    return { index: scripts[index] ? index : 0, text };
  }, [plan.talk_scripts, activeScene]);

  const activeTalkScript = activeScriptEntry?.text ?? null;

  // AR方向3 Phase 1: 话术展示记录（每次 activeScriptEntry 变化且有值时记录一次）
  const lastRecordedScriptRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeScriptEntry || !activeScene) return;
    const key = `${activeScriptEntry.index}:${activeScriptEntry.text}:${activeScene.poolKey}`;
    if (lastRecordedScriptRef.current === key) return; // 同一条话术不重复记录
    lastRecordedScriptRef.current = key;
    recordScriptShown(
      session.id,
      activeScriptEntry.index,
      activeScriptEntry.text,
      activeScene.poolKey || '',
      activeScene.level as 'L1' | 'L2' | 'L3' | 'L4',
    );
  }, [activeScriptEntry, activeScene, session.id]);

  // ── 无场景时的联合状态级别（§八）──
  // 情绪级别映射到数字
  const emotionRank = { calm: 0, mild: 1, moderate: 2, severe: 3 }[emotionState.level] ?? 0;
  // 引擎级别映射到数字
  const engineLevel = riskResult?.interventionLevel ?? 'L0';
  const engineRank = { L0: 0, L1: 0, L2: 1, L3: 2, L4: 3 }[engineLevel] ?? 0;
  // 取较高级别
  const noSceneRank = Math.max(emotionRank, engineRank);
  // AR方向2-P2: 轨迹模式覆盖 noSceneConfig 文案（当无活跃场景时显示轨迹提示）
  const trajectoryOverride: Record<string, { text: string; color: string; wave: string; border: string }> = {
    deteriorating: { text: '情绪持续上升，留意', color: '#fb923c', wave: '#fb923c', border: 'rgba(251,146,60,0.25)' },
    false_calm:    { text: '⚠ 假平静，近期有波动', color: '#fbbf24', wave: '#fbbf24', border: 'rgba(251,191,36,0.25)' },
    volatile:      { text: '情绪波动较大', color: '#f87171', wave: '#f87171', border: 'rgba(248,113,113,0.25)' },
    recovering:    { text: '状态逐步平稳', color: '#34d399', wave: '#34d399', border: 'rgba(52,211,153,0.20)' },
    stable:        { text: '节奏正常', color: '#4ade80', wave: '#4ade80', border: 'rgba(74,222,128,0.15)' },
  };

  const noSceneBaseConfig = [
    { text: '节奏正常', color: '#4ade80', wave: '#4ade80', border: 'rgba(74,222,128,0.15)' },
    { text: '留意节奏', color: '#E6B800', wave: '#E6B800', border: 'rgba(230,184,0,0.20)' },
    { text: '注意状态', color: '#fb923c', wave: '#fb923c', border: 'rgba(251,146,60,0.25)' },
    { text: '状态紧张', color: '#ef4444', wave: '#ef4444', border: 'rgba(239,68,68,0.30)' },
  ][noSceneRank];

  // 轨迹模式提示：仅在 deteriorating/false_calm/volatile/recovering 时替换文案
  const noSceneConfig = (trajectoryPattern !== 'stable' && noSceneRank < 2)
    ? { ...noSceneBaseConfig, text: trajectoryOverride[trajectoryPattern]?.text ?? noSceneBaseConfig.text, color: trajectoryOverride[trajectoryPattern]?.color ?? noSceneBaseConfig.color }
    : noSceneBaseConfig;

  // ── 进场/即时自检结果 ──
  const selfCheckEvents = session.events.filter(e => e.event_type === 'self_check');
  const preEntryCheck = selfCheckEvents.find(e => e.self_check_result?.mode === 'pre_entry') ?? null;
  const liveChecks = selfCheckEvents.filter(e => e.self_check_result?.mode !== 'pre_entry');
  const latestLiveCheck = liveChecks.length > 0 ? liveChecks[liveChecks.length - 1] : null;

  // 进场自检摘要
  const preResult = preEntryCheck?.self_check_result;
  const preRiskLevel = preResult?.risk_level;
  const preCount = preResult?.checked_ids?.length ?? 0;
  // safe 或未做自检 → null（走下方fallback提醒），有风险才显示
  const preText = !preResult || preRiskLevel === 'safe'
    ? null
    : preRiskLevel === 'caution'
      ? `注意：进场自检提示${preCount}项轻微风险`
      : preRiskLevel === 'warning'
        ? `警告：进场自检提示${preCount}项风险信号`
        : `高危：进场自检提示${preCount}项高危信号`;

  // 即时自检摘要
  const liveResult = latestLiveCheck?.self_check_result;
  const liveRiskLevel = liveResult?.risk_level;
  const liveCount = liveResult?.checked_ids?.length ?? 0;
  const liveTimestamp = latestLiveCheck?.timestamp;
  const liveMinutesAgo = liveTimestamp
    ? Math.floor((Date.now() - new Date(liveTimestamp).getTime()) / 60000)
    : null;
  // safe → null 不显示，有风险才显示
  const liveText = !liveResult || liveRiskLevel === 'safe'
    ? null
    : liveRiskLevel === 'caution'
      ? `注意：即时自检提示${liveCount}项轻微风险（${liveMinutesAgo}分钟前）`
      : liveRiskLevel === 'warning'
        ? `警告：即时自检提示${liveCount}项风险信号（${liveMinutesAgo}分钟前）`
        : `高危：即时自检提示${liveCount}项高危信号（${liveMinutesAgo}分钟前）`;

  // 自检超时提醒
  const lastCheckTime = latestLiveCheck?.timestamp ?? preEntryCheck?.timestamp ?? null;
  const minutesSinceLastCheck = lastCheckTime
    ? Math.floor((Date.now() - new Date(lastCheckTime).getTime()) / 60000)
    : Infinity;
  const selfCheckOverdue = selfCheckEvents.length > 0 && minutesSinceLastCheck >= 15;
  const selfCheckEventTrigger = activeScene && (activeScene.level === 'L2' || activeScene.level === 'L3' || activeScene.level === 'L4');

  const hasRisk = preRiskLevel === 'warning' || preRiskLevel === 'danger'
    || liveRiskLevel === 'warning' || liveRiskLevel === 'danger';

  function checkColorFn(level?: string) {
    if (!level || level === 'safe') return '#4ade80';
    if (level === 'caution') return '#E6B800';
    if (level === 'warning') return '#fb923c';
    return '#ef4444';
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.lg }}>

      {/* ═══ 1. 顶部状态栏 ═══ */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
          <EmotionGauge
            score={emotionState.score}
            level={emotionState.level}
            size="sm"
          />
          <span style={{
            fontSize: theme.fontSize.small,
            fontWeight: 600,
            color: theme.colors.emotion[emotionState.level],
          }}>
            {levelLabel[emotionState.level]}
          </span>
        </div>
        <button
          onClick={() => setAssistantMode(prev => !prev)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: theme.radius.full,
            border: `1.5px solid ${assistantMode ? theme.colors.gold : theme.colors.border}`,
            background: assistantMode ? theme.colors.gold + '22' : 'transparent',
            color: assistantMode ? theme.colors.gold : theme.colors.gray,
            fontSize: theme.fontSize.caption,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Eye size={14} />
          助手模式{assistantMode ? ' ON' : ''}
        </button>
      </div>

      {/* ═══ 2. 场景感知卡 — 硬币的两面 ═══ */}
      {activeScene ? (
        <div style={{
          borderRadius: 16,
          border: `2px solid ${sceneLevelBorder[activeScene.level]}`,
          background: sceneLevelBg[activeScene.level],
          overflow: 'hidden',
        }}>
          {/* 场景标签 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            borderBottom: `1px solid ${sceneLevelBorder[activeScene.level]}`,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: sceneLevelColor[activeScene.level],
              boxShadow: `0 0 6px ${sceneLevelColor[activeScene.level]}`,
            }} />
            <span style={{
              fontSize: 13,
              fontWeight: 700,
              color: sceneLevelColor[activeScene.level],
              letterSpacing: 1,
            }}>
              {activeScene.label}
            </span>
            <span style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.35)',
              marginLeft: 'auto',
            }}>
              {activeScene.level}
            </span>
          </div>

          {/* 事实层 */}
          <div style={{ padding: '12px 16px 8px' }}>
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
            }}>
              <span style={{ fontSize: 16, lineHeight: '20px', flexShrink: 0 }}>📊</span>
              <span style={{
                fontSize: assistantMode ? 18 : 14,
                fontWeight: 600,
                color: '#fff',
                lineHeight: 1.5,
              }}>
                {activeScene.factMessage}
              </span>
            </div>
          </div>

          {/* 分隔线 */}
          <div style={{
            height: 1,
            background: 'rgba(255,255,255,0.06)',
            margin: '0 16px',
          }} />

          {/* 心理层 */}
          <div style={{ padding: '8px 16px', paddingBottom: activeTalkScript ? 8 : 14 }}>
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
            }}>
              <span style={{ fontSize: 16, lineHeight: '20px', flexShrink: 0 }}>🧠</span>
              <span style={{
                fontSize: assistantMode ? 17 : 13,
                color: 'rgba(255,255,255,0.75)',
                lineHeight: 1.6,
              }}>
                {activeScene.psychMessage}
              </span>
            </div>
          </div>

          {/* 专属战约话术（L2+ 且有 talk_scripts 才显示）*/}
          {activeTalkScript && (activeScene.level === 'L2' || activeScene.level === 'L3' || activeScene.level === 'L4') && (
            <div style={{
              margin: '0 16px 14px',
              padding: '10px 12px',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.06)',
              border: `1px solid ${sceneLevelBorder[activeScene.level]}`,
            }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 5, letterSpacing: 1 }}>
                🔖 {plan.template_name ?? '专属战约'} 提醒
              </div>
              <span style={{
                fontSize: assistantMode ? 16 : 13,
                color: sceneLevelColor[activeScene.level],
                fontWeight: 600,
                lineHeight: 1.6,
              }}>
                {activeTalkScript}
              </span>
            </div>
          )}
        </div>
      ) : (
        /* 无活跃场景：呼吸脉搏线 + 联合状态文字（§八） */
        <div style={{
          padding: '16px 20px',
          background: theme.colors.card,
          borderRadius: 16,
          border: `1.5px solid ${noSceneConfig.border}`,
          overflow: 'hidden',
          position: 'relative',
        }}>
          {/* 脉搏波形动画 */}
          <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            opacity: 0.12,
            overflow: 'hidden',
          }}>
            <svg
              viewBox="0 0 400 60"
              preserveAspectRatio="none"
              style={{ width: '200%', height: '100%' }}
            >
              <path
                d="M0,30 Q25,30 50,30 T100,30 L110,30 L115,10 L120,50 L125,20 L130,35 L135,30 Q160,30 200,30 Q225,30 250,30 T300,30 L310,30 L315,10 L320,50 L325,20 L330,35 L335,30 Q360,30 400,30"
                fill="none"
                stroke={noSceneConfig.wave}
                strokeWidth="2"
                style={{ animation: 'pulseWave 4s linear infinite' }}
              />
            </svg>
          </div>
          {/* 状态文字 */}
          <div style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: noSceneConfig.color,
              boxShadow: `0 0 8px ${noSceneConfig.color}80`,
              animation: 'breathe 3s ease-in-out infinite',
              display: 'inline-block',
            }} />
            <span style={{
              fontSize: assistantMode ? 18 : 14,
              fontWeight: 600,
              color: noSceneConfig.color,
              letterSpacing: 0.5,
            }}>
              已打{metrics.total_hands}手 · {metrics.net_pnl >= 0 ? '+' : ''}{metrics.net_pnl} · {noSceneConfig.text}
            </span>
          </div>
        </div>
      )}

      {/* ═══ 3. 自检常驻区 ═══ */}
      <div>
        <div style={{
          padding: '12px 16px',
          background: theme.colors.card,
          borderRadius: theme.radius.md,
          border: `1.5px solid ${hasRisk ? 'rgba(251,146,60,0.3)' : 'rgba(255,255,255,0.06)'}`,
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {/* 进场自检（基线，常驻） */}
          {preText ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14 }}>📋</span>
              <span style={{
                fontSize: 13, fontWeight: 600,
                color: checkColorFn(preRiskLevel),
                lineHeight: 1.5,
              }}>
                {preText}
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14 }}>⚠️</span>
              <span style={{
                fontSize: 13, fontWeight: 600, color: '#E6B800', lineHeight: 1.5,
              }}>
                警告：请随时进行自检和注意身心警报
              </span>
            </div>
          )}

          {/* 即时自检（最近一次，有就显示） */}
          {liveText && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14 }}>🔄</span>
              <span style={{
                fontSize: 13, fontWeight: 600,
                color: checkColorFn(liveRiskLevel),
                lineHeight: 1.5,
              }}>
                {liveText}
              </span>
            </div>
          )}

          {/* 自检超时提醒 */}
          {selfCheckOverdue && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14 }}>⚡</span>
              <span style={{
                fontSize: 13, fontWeight: 600,
                color: '#fb923c', lineHeight: 1.5,
              }}>
                已{minutesSinceLastCheck}分钟未自检，建议确认当前状态
              </span>
            </div>
          )}

          {/* 场景事件触发自检提醒 */}
          {!selfCheckOverdue && selfCheckEventTrigger && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14 }}>⚡</span>
              <span style={{
                fontSize: 13, fontWeight: 600,
                color: '#E6B800', lineHeight: 1.5,
              }}>
                当前处于{activeScene.label}场景，建议自检确认你的状态
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ═══ 4. 统一操作栏 ═══ */}
      <div style={{
        background: 'rgba(255,255,255,0.05)',
        padding: 16,
        borderRadius: 16,
        backdropFilter: 'blur(10px)',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {/* 操作行：查看规则 / 暂停一下 / 立即结束 */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="clickable" onClick={() => setShowRules(prev => !prev)} style={{
            flex: 1, height: 44, borderRadius: 8,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#aaa',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          }}>
            {showRules ? '收起规则' : 'ⓘ 查看规则'}
          </button>
          <div style={{ flex: 1, position: 'relative' }}>
            <button className="clickable" onClick={() => {
              attributeScriptResponse(session.id, 'pause');
              onPause();
            }} style={{
              width: '100%', height: 44, borderRadius: 8,
              background: 'transparent',
              border: '1px solid #444', color: '#fff',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: isSevere ? 1 : 0.6,
            }}>
              暂停一下
            </button>
            {isSevere && (
              <div style={{
                position: 'absolute', inset: -2, borderRadius: 10,
                border: '2px solid #E63946',
                animation: 'emotionPulse 1s ease-in-out infinite',
                pointerEvents: 'none',
              }} />
            )}
          </div>
          <button className="clickable" onClick={() => {
            attributeScriptResponse(session.id, 'end');
            onEnd();
          }} style={{
            flex: 1, height: 44, borderRadius: 8,
            background: '#e74c3c', border: 'none', color: '#fff',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            立即结束
          </button>
        </div>
      </div>

      {showRules && (
        <div style={{
          background: theme.colors.card,
          borderRadius: theme.radius.md,
          padding: '14px 16px',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: theme.colors.white, marginBottom: 4 }}>
            我的规则
          </div>

          <RuleRow
            label="止损"
            ruleValue={`-${plan.stop_loss_amount}`}
            currentValue={`${metrics.net_pnl < 0 ? metrics.net_pnl : 0}`}
            progress={plan.stop_loss_amount > 0 ? Math.min(1, Math.abs(Math.min(0, metrics.net_pnl)) / plan.stop_loss_amount) : 0}
            alert={plan.stop_loss_amount > 0 && metrics.distance_to_stop_loss < plan.stop_loss_amount * 0.3}
          />
          <RuleRow
            label="止盈"
            ruleValue={`+${plan.take_profit_amount}`}
            currentValue={`${metrics.net_pnl > 0 ? '+' + metrics.net_pnl : 0}`}
            progress={plan.take_profit_amount > 0 ? Math.min(1, Math.max(0, metrics.net_pnl) / plan.take_profit_amount) : 0}
            good={metrics.net_pnl > 0}
          />
          <RuleRow
            label="连输止损"
            ruleValue={`${plan.stop_loss_streak}手`}
            currentValue={`${metrics.current_loss_streak}手`}
            progress={plan.stop_loss_streak > 0 ? Math.min(1, metrics.current_loss_streak / plan.stop_loss_streak) : 0}
            alert={metrics.current_loss_streak >= plan.stop_loss_streak_warn}
          />
          <RuleRow
            label="时间限制"
            ruleValue={`${plan.max_duration_minutes}分`}
            currentValue={`${Math.floor(metrics.elapsed_minutes)}分`}
            progress={plan.max_duration_minutes > 0 ? Math.min(1, metrics.elapsed_minutes / plan.max_duration_minutes) : 0}
            alert={metrics.remaining_minutes <= 0}
          />
          <RuleRow
            label="最大码量"
            ruleValue={`${plan.max_bet_unit}`}
            currentValue={`${metrics.current_bet_unit}`}
            progress={plan.max_bet_unit > 0 ? Math.min(1, metrics.current_bet_unit / plan.max_bet_unit) : 0}
            alert={metrics.current_bet_unit >= plan.max_bet_unit}
          />

          {plan.lock_profit_trigger > 0 && (
            <RuleRow
              label="锁盈线"
              ruleValue={`+${plan.lock_profit_trigger}`}
              currentValue={metrics.is_in_lock_profit_zone ? '已触发' : '未触发'}
              progress={Math.min(1, Math.max(0, metrics.net_pnl) / plan.lock_profit_trigger)}
              good={metrics.is_in_lock_profit_zone}
            />
          )}

          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 8,
            paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)',
          }}>
            {plan.forbid_raise_in_loss && (
              <span style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6,
                background: 'rgba(34,197,94,0.12)', color: '#4ade80' }}>
                亏损禁加码
              </span>
            )}
            {plan.idle_reminder && (
              <span style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6,
                background: 'rgba(34,197,94,0.12)', color: '#4ade80' }}>
                闲置提醒
              </span>
            )}
            {!plan.allow_raise_bet && (
              <span style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6,
                background: 'rgba(34,197,94,0.12)', color: '#4ade80' }}>
                禁止加码
              </span>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes emotionPulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        @keyframes pulseWave {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes breathe {
          0%, 100% { opacity: 0.4; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}

// ── RuleRow 子组件 ──
function RuleRow({ label, ruleValue, currentValue, progress, alert, good }: {
  label: string;
  ruleValue: string;
  currentValue: string;
  progress: number;
  alert?: boolean;
  good?: boolean;
}) {
  const barColor = alert ? '#ef4444' : good ? '#4ade80' : '#E6B800';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{label}</span>
        <span style={{ fontSize: 12 }}>
          <span style={{ color: alert ? '#ef4444' : good ? '#4ade80' : '#fff', fontWeight: 600 }}>
            {currentValue}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.3)', margin: '0 4px' }}>/</span>
          <span style={{ color: 'rgba(255,255,255,0.5)' }}>{ruleValue}</span>
        </span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }}>
        <div style={{
          height: '100%', borderRadius: 2,
          width: `${Math.round(progress * 100)}%`,
          background: barColor,
          transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  );
}
