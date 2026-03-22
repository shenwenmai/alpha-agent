import React, { useState } from 'react';
import { ChevronUp, ChevronDown, Shield, Activity, Brain } from 'lucide-react';
import type { EvaluationResult, InterventionLevel, RiskTier } from '../../types/riskConfig';
import { RISK_TIER_LABELS, RISK_TIER_COLORS } from '../../types/riskConfig';
import { FM_COLORS } from '../../theme';

// ─── 干预级别配置 ───────────────────────────────────────────────
const LEVEL_CONFIG: Record<InterventionLevel, { label: string; color: string; bgAlpha: string }> = {
  L0: { label: '正常', color: '#22C55E', bgAlpha: 'rgba(34,197,94,0.12)' },
  L1: { label: '轻提醒', color: '#E6B800', bgAlpha: 'rgba(230,184,0,0.12)' },
  L2: { label: '正式警告', color: '#F97316', bgAlpha: 'rgba(249,115,22,0.12)' },
  L3: { label: '强警告', color: '#E63946', bgAlpha: 'rgba(230,57,70,0.12)' },
  L4: { label: '强制干预', color: '#FF0040', bgAlpha: 'rgba(255,0,64,0.15)' },
};

// ─── 七信号标签 ───────────────────────────────────────────────
const SIGNAL_LABELS: { key: keyof EvaluationResult['signals']; label: string; short: string }[] = [
  { key: 'x1_pain', label: '前景痛苦', short: 'x₁' },
  { key: 'x2_raise', label: '输后加码', short: 'x₂' },
  { key: 'x3_streak', label: '连输/净输', short: 'x₃' },
  { key: 'x4_profitGone', label: '盈利转亏', short: 'x₄' },
  { key: 'x5_grind', label: '缠斗疲劳', short: 'x₅' },
  { key: 'x6_time', label: '时间疲劳', short: 'x₆' },
  { key: 'x7_volatility', label: '注码波动', short: 'x₇' },
];

// ─── 工具函数 ───────────────────────────────────────────────
function probColor(value: number, invert = false): string {
  // invert=true: 高值=好(绿)  invert=false: 高值=坏(红)
  const v = invert ? 1 - value : value;
  if (v < 0.3) return '#22C55E';
  if (v < 0.5) return '#E6B800';
  if (v < 0.7) return '#F97316';
  return '#E63946';
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

// ─── 概率圆弧仪表 ───────────────────────────────────────────
function ProbGauge({
  value,
  label,
  icon,
  invert,
}: {
  value: number;
  label: string;
  icon: React.ReactNode;
  invert?: boolean; // survivalProb: 高=好, 需要invert
}) {
  const color = invert
    ? probColor(value, true)  // survivalProb: 高=绿
    : probColor(value);       // etp/collapse: 高=红
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const dashLen = circumference * 0.75; // 270° arc
  const offset = dashLen * (1 - value);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
      <svg width={76} height={76} viewBox="0 0 76 76" style={{ transform: 'rotate(135deg)' }}>
        {/* 底弧 */}
        <circle
          cx={38} cy={38} r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={5}
          strokeDasharray={`${dashLen} ${circumference}`}
          strokeLinecap="round"
        />
        {/* 值弧 */}
        <circle
          cx={38} cy={38} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeDasharray={`${dashLen} ${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.4s ease' }}
        />
      </svg>
      {/* 中间数字 — 覆盖在 SVG 上 */}
      <div
        style={{
          position: 'relative',
          marginTop: -60,
          textAlign: 'center',
          pointerEvents: 'none',
        }}
      >
        <div style={{ color, fontSize: 18, fontWeight: 800, lineHeight: 1 }}>{pct(value)}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, marginTop: 2 }}>
          {icon}
        </div>
      </div>
      <div
        style={{
          fontSize: 11,
          color: FM_COLORS.textSecondary,
          marginTop: 4,
          textAlign: 'center',
          lineHeight: 1.2,
        }}
      >
        {label}
      </div>
    </div>
  );
}

// ─── 信号条 ───────────────────────────────────────────────
function SignalBar({ label, short, value }: { label: string; short: string; value: number; key?: string }) {
  const clamped = Math.min(1, Math.max(0, value));
  const color = probColor(clamped);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
      <span style={{ fontSize: 10, color: FM_COLORS.textSecondary, width: 18, textAlign: 'right', flexShrink: 0 }}>
        {short}
      </span>
      <div
        style={{
          flex: 1,
          height: 6,
          borderRadius: 3,
          backgroundColor: 'rgba(255,255,255,0.06)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${clamped * 100}%`,
            height: '100%',
            borderRadius: 3,
            backgroundColor: color,
            transition: 'width 0.5s ease, background-color 0.4s ease',
          }}
        />
      </div>
      <span style={{ fontSize: 10, color, width: 28, textAlign: 'right', fontWeight: 600, flexShrink: 0 }}>
        {pct(clamped)}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// RiskControlPanel — 主组件
// ═══════════════════════════════════════════════════════════════
export default function RiskControlPanel({ result }: { result: EvaluationResult | null }) {
  const [expanded, setExpanded] = useState(false);

  if (!result) {
    return (
      <div
        style={{
          backgroundColor: FM_COLORS.cardBg,
          borderRadius: 12,
          padding: '12px 16px',
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Shield size={14} color={FM_COLORS.textSecondary} />
          <span style={{ fontSize: 13, color: FM_COLORS.textSecondary }}>风控引擎等待数据...</span>
        </div>
      </div>
    );
  }

  const lv = result.interventionLevel || 'L0';
  const lvCfg = LEVEL_CONFIG[lv];
  const tier = result.finalTier;
  const tierColor = RISK_TIER_COLORS[tier] || FM_COLORS.textSecondary;
  const tierLabel = RISK_TIER_LABELS[tier] || tier;

  return (
    <div
      style={{
        backgroundColor: FM_COLORS.cardBg,
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 12,
        border: lv >= 'L3' ? `1px solid ${lvCfg.color}33` : `1px solid ${FM_COLORS.border}`,
      }}
    >
      {/* ── 头部：干预级别 + 档位 + 展开按钮 ── */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          cursor: 'pointer',
          backgroundColor: lvCfg.bgAlpha,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Shield size={14} color={lvCfg.color} />
          <span style={{ fontSize: 13, fontWeight: 700, color: lvCfg.color }}>
            {`${lv} ${lvCfg.label}`}
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: 4,
              backgroundColor: `${tierColor}20`,
              color: tierColor,
            }}
          >
            {tierLabel}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* 迷你三维数字 — 折叠状态也可见 */}
          <span style={{ fontSize: 10, color: probColor(result.survivalProb, true), fontWeight: 600 }}>
            S{pct(result.survivalProb)}
          </span>
          <span style={{ fontSize: 10, color: probColor(result.etpProb), fontWeight: 600 }}>
            E{pct(result.etpProb)}
          </span>
          <span style={{ fontSize: 10, color: probColor(result.collapseProb), fontWeight: 600 }}>
            C{pct(result.collapseProb)}
          </span>
          {expanded ? (
            <ChevronUp size={14} color={FM_COLORS.textSecondary} />
          ) : (
            <ChevronDown size={14} color={FM_COLORS.textSecondary} />
          )}
        </div>
      </div>

      {/* ── 展开内容 ── */}
      {expanded && (
        <div style={{ padding: '12px 14px 16px' }}>
          {/* 三维概率仪表 */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <ProbGauge
              value={result.survivalProb}
              label="资金生存"
              icon={<Shield size={12} color={probColor(result.survivalProb, true)} />}
              invert
            />
            <ProbGauge
              value={result.etpProb}
              label="情绪崩盘"
              icon={<Brain size={12} color={probColor(result.etpProb)} />}
            />
            <ProbGauge
              value={result.collapseProb}
              label="崩盘路径"
              icon={<Activity size={12} color={probColor(result.collapseProb)} />}
            />
          </div>

          {/* 七信号 */}
          <div style={{ marginBottom: 12 }}>
            <div
              style={{
                fontSize: 11,
                color: FM_COLORS.textSecondary,
                marginBottom: 8,
                fontWeight: 600,
                letterSpacing: '0.05em',
              }}
            >
              七信号分析
            </div>
            {SIGNAL_LABELS.map(({ key, short, label }) => (
              <SignalBar
                key={key}
                short={short}
                label={label}
                value={result.signals[key] as number}
              />
            ))}
            {/* 交互项 */}
            <SignalBar short="β₈" label="交互项" value={result.signals.interaction} />
          </div>

          {/* v1.2: 锁盈状态 + 有效阈值 */}
          {result.profitLockStage > 0 && (
            <div
              style={{
                fontSize: 11,
                borderRadius: 6,
                padding: '8px 10px',
                marginBottom: 8,
                backgroundColor: result.profitLockStage >= 3
                  ? 'rgba(230,57,70,0.1)' : 'rgba(34,197,94,0.08)',
                border: `1px solid ${result.profitLockStage >= 3 ? '#E6394630' : '#22C55E20'}`,
              }}
            >
              <div style={{
                fontWeight: 700, marginBottom: 4,
                color: result.profitLockStage >= 3 ? '#E63946' : '#22C55E',
              }}>
                {result.profitLockStage === 1 && '🔒 锁盈已激活'}
                {result.profitLockStage === 2 && '🔒 锁盈收紧中'}
                {result.profitLockStage === 3 && '⚠️ 利润回撤'}
                {result.profitLockStage === 4 && '❌ 利润归零'}
                {result.profitLockStage === 5 && '🔴 锁盈后转亏'}
              </div>
              <div style={{ color: FM_COLORS.textSecondary, fontSize: 10, display: 'flex', flexWrap: 'wrap', gap: '4px 8px' }}>
                {(['streak', 'netLoss', 'grind'] as const).map(key => {
                  const labelMap = { streak: '连输', netLoss: '净输', grind: '缠斗' } as const;
                  const effective = key === 'streak' ? result.effectiveLimits.streakLimit
                    : key === 'netLoss' ? result.effectiveLimits.netLossLimit
                    : result.effectiveLimits.grindLimit;
                  const original = key === 'streak' ? result.effectiveLimits.originalStreakLimit
                    : key === 'netLoss' ? result.effectiveLimits.originalNetLossLimit
                    : result.effectiveLimits.originalGrindLimit;
                  const tightened = effective < original;
                  return (
                    <span key={key}>
                      {labelMap[key]}≤
                      {tightened ? (
                        <span style={{ color: '#E63946', fontWeight: 700 }}>{original}→{effective}</span>
                      ) : (
                        <span>{effective}</span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* v1.2: 毒药组合 */}
          {result.toxicCombos.length > 0 && (
            <div
              style={{
                fontSize: 11,
                color: '#FF0040',
                backgroundColor: 'rgba(255,0,64,0.08)',
                border: '1px solid rgba(255,0,64,0.2)',
                borderRadius: 6,
                padding: '8px 10px',
                marginBottom: 8,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 2 }}>☠️ 毒药组合触发</div>
              {result.toxicCombos.map(tc => (
                <div key={tc} style={{ fontSize: 10, opacity: 0.9 }}>
                  {tc === 'fatigue_pressure' && '高压疲劳: 长时间+缠斗记忆+亏损'}
                  {tc === 'momentum_reversal' && '顺风转折: 连赢后连输确认'}
                </div>
              ))}
            </div>
          )}

          {/* 防抖状态 + 关键时刻 */}
          <div style={{ display: 'flex', gap: 12 }}>
            {/* 防抖 */}
            {result.hysteresis.pendingDowngrade && (
              <div
                style={{
                  flex: 1,
                  fontSize: 11,
                  color: '#22C55E',
                  backgroundColor: 'rgba(34,197,94,0.08)',
                  borderRadius: 6,
                  padding: '6px 8px',
                }}
              >
                降级观察中 — 已稳定 {result.hysteresis.stableHandsCount} 手
              </div>
            )}

            {/* 关键时刻 */}
            {result.keyMoments.length > 0 && (
              <div
                style={{
                  flex: 1,
                  fontSize: 11,
                  color: '#F97316',
                  backgroundColor: 'rgba(249,115,22,0.08)',
                  borderRadius: 6,
                  padding: '6px 8px',
                }}
              >
                {result.keyMoments.map((km) => {
                  const kmLabels: Record<string, string> = {
                    streak_limit: '连输触线',
                    net_loss_limit: '净输触线',
                    streak_net_loss: '连输/净输触线', // 兼容旧数据
                    grind: '缠斗',
                    overtime: '超时',
                    profit_gone: '盈利转亏',
                    streak2_raise: '连输后加注',
                  };
                  return <div key={km} style={{ marginBottom: 2 }}>⚡ {kmLabels[km] || km}</div>;
                })}
              </div>
            )}
          </div>

          {/* 评估来源 */}
          {result.interventionSource && (
            <div
              style={{
                fontSize: 10,
                color: FM_COLORS.textSecondary,
                marginTop: 8,
                opacity: 0.7,
              }}
            >
              触发: {result.interventionSource}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
