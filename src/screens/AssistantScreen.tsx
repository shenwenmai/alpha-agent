import React, { useState, useEffect } from 'react';
import { Zap, TrendingUp, CheckCircle, AlertTriangle, ChevronRight, Activity } from 'lucide-react';
import { theme } from '../theme';
import { generateCoachingDashboard, type CoachingDashboard, type CoachingTip } from '../services/coachingEngine';
import { subscribeFM, getActiveSession } from '../services/fundManagerService';
import { computeMetrics } from '../services/fundManagerEngine';
import { computeEmotion } from '../services/emotionEngine';

// ============================================================
// 助手 OS — 个人教练中心
// 整合成长画像 + ETP 建议 + 场次数据 → 个性化指导
// ============================================================

interface AssistantScreenProps {
  onStartPlan?: () => void;
  onEmotion?: () => void;
}

const GRADE_COLORS: Record<string, string> = {
  S: '#22C55E',
  A: '#60A5FA',
  B: theme.colors.gold,
  C: '#FF8C00',
  D: theme.colors.danger,
};

const PRIORITY_COLORS: Record<string, string> = {
  high: theme.colors.danger,
  medium: theme.colors.warning,
  low: theme.colors.gray,
};

export default function AssistantScreen({ onStartPlan, onEmotion }: AssistantScreenProps) {
  const [dashboard, setDashboard] = useState<CoachingDashboard | null>(null);
  const [liveEmotion, setLiveEmotion] = useState<{ score: number; level: string } | null>(null);

  useEffect(() => {
    setDashboard(generateCoachingDashboard());

    // 检测活跃场次的实时情绪
    const updateLive = () => {
      const active = getActiveSession();
      if (active) {
        const metrics = computeMetrics(active);
        const emotion = computeEmotion(active, metrics);
        setLiveEmotion({ score: emotion.score, level: emotion.level });
      } else {
        setLiveEmotion(null);
      }
    };
    updateLive();

    const unsub = subscribeFM(() => {
      setDashboard(generateCoachingDashboard());
      updateLive();
    });
    return unsub;
  }, []);

  if (!dashboard) return null;

  return (
    <div style={{
      backgroundColor: theme.colors.bg,
      color: theme.colors.white,
      paddingBottom: 20,
    }}>
      {/* 顶部 */}
      <div style={{
        paddingTop: 20,
        paddingLeft: 20, paddingRight: 20, paddingBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Zap size={22} color={theme.colors.gold} />
          <h1 style={{
            fontSize: theme.fontSize.hero, fontWeight: 800,
            margin: 0, color: theme.colors.white,
          }}>
            我的教练
          </h1>
        </div>
        <p style={{
          fontSize: theme.fontSize.caption, color: theme.colors.gray,
          margin: 0,
        }}>
          基于 {dashboard.totalSessions} 场实战数据的个性化指导
        </p>
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── 评级卡片 ── */}
        <div style={{
          background: theme.colors.card,
          borderRadius: theme.radius.lg,
          padding: '24px 20px',
          display: 'flex', alignItems: 'center', gap: 20,
          border: `1px solid ${GRADE_COLORS[dashboard.overallGrade]}22`,
        }}>
          {/* 评级圆 */}
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: `${GRADE_COLORS[dashboard.overallGrade]}15`,
            border: `2px solid ${GRADE_COLORS[dashboard.overallGrade]}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{
              fontSize: 28, fontWeight: 900,
              color: GRADE_COLORS[dashboard.overallGrade],
            }}>
              {dashboard.overallGrade}
            </span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: theme.fontSize.body, fontWeight: 700,
              color: theme.colors.white, marginBottom: 4,
            }}>
              {dashboard.gradeLabel}
            </div>
            <div style={{
              fontSize: theme.fontSize.caption, color: theme.colors.gray,
              lineHeight: 1.5,
            }}>
              {dashboard.currentStreak > 0
                ? `连续 ${dashboard.currentStreak} 场未崩盘`
                : dashboard.totalSessions > 0
                  ? '上场出现崩盘，本场注意控制'
                  : '完成第一场开始积累数据'}
            </div>
          </div>
        </div>

        {/* ── 实时情绪状态（场中显示） ── */}
        {liveEmotion && (
          <div style={{
            background: 'linear-gradient(135deg, #1A1A1A, #2A1A0A)',
            borderRadius: theme.radius.md,
            padding: '16px 18px',
            marginBottom: 16,
            border: `1px solid ${liveEmotion.level === 'severe' ? '#FF4444' : liveEmotion.level === 'moderate' ? '#FF8C00' : 'rgba(255,255,255,0.08)'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: liveEmotion.level === 'calm' ? '#22C55E' : liveEmotion.level === 'mild' ? '#E6B800' : liveEmotion.level === 'moderate' ? '#FF8C00' : '#FF4444',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 800, color: '#000',
                }}>
                  {liveEmotion.score}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>场中情绪监测</div>
                  <div style={{ fontSize: 12, color: '#888' }}>
                    {liveEmotion.level === 'calm' ? '状态良好' : liveEmotion.level === 'mild' ? '注意观察' : liveEmotion.level === 'moderate' ? '状态升温，考虑暂停' : '状态危险，建议离场'}
                  </div>
                </div>
              </div>
              <Activity size={20} color={liveEmotion.level === 'severe' ? '#FF4444' : '#E6B800'} />
            </div>
          </div>
        )}

        {/* ── 情绪追踪入口 ── */}
        {onEmotion && (
          <button
            onClick={onEmotion}
            style={{
              width: '100%', padding: '14px 18px',
              background: theme.colors.card,
              borderRadius: theme.radius.md,
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              cursor: 'pointer', marginBottom: 16, color: '#fff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Activity size={18} color="#E6B800" />
              <span style={{ fontSize: 14, fontWeight: 600 }}>情绪追踪</span>
              <span style={{ fontSize: 12, color: '#888' }}>查看历史情绪模式</span>
            </div>
            <ChevronRight size={16} color="#666" />
          </button>
        )}

        {/* ── 场前提醒 ── */}
        {dashboard.preGameTips.length > 0 && (
          <section>
            <SectionTitle icon="🎯" title="场前提醒" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {dashboard.preGameTips.map(tip => (
                <TipCard key={tip.id} tip={tip} />
              ))}
            </div>
          </section>
        )}

        {/* ── 上场回顾 + 改进清单 ── */}
        {dashboard.lastSessionSummary && (
          <section>
            <SectionTitle icon="📋" title="下一场改进清单" />
            <div style={{
              fontSize: theme.fontSize.caption, color: theme.colors.gray,
              marginBottom: 10, marginTop: -8,
            }}>
              {dashboard.lastSessionSummary}
            </div>
            <div style={{
              background: theme.colors.card,
              borderRadius: theme.radius.md,
              overflow: 'hidden',
            }}>
              {dashboard.improvements.length > 0 ? dashboard.improvements.map((item, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '14px 16px',
                  borderBottom: i < dashboard.improvements.length - 1
                    ? `1px solid ${theme.colors.border}` : 'none',
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                    marginTop: 1,
                    background: item.done ? theme.colors.success + '20' : 'transparent',
                    border: item.done ? `1.5px solid ${theme.colors.success}` : `1.5px solid ${theme.colors.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {item.done && <CheckCircle size={12} color={theme.colors.success} />}
                  </div>
                  <span style={{
                    fontSize: theme.fontSize.small,
                    color: item.done ? theme.colors.success : theme.colors.white,
                    lineHeight: 1.5,
                  }}>
                    {item.text}
                  </span>
                </div>
              )) : (
                <div style={{
                  padding: '20px 16px', textAlign: 'center',
                  color: theme.colors.success, fontSize: theme.fontSize.small,
                }}>
                  上场表现不错，继续保持！
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── 成长趋势 ── */}
        {dashboard.trend.length >= 2 && (
          <section>
            <SectionTitle icon="📈" title="成长趋势" />
            <div style={{
              background: theme.colors.card,
              borderRadius: theme.radius.md,
              padding: 16,
            }}>
              <TrendChart data={dashboard.trend} />
            </div>
          </section>
        )}

        {/* ── 模板建议 ── */}
        {dashboard.templateTip && (
          <section>
            <SectionTitle icon="🧩" title="模板建议" />
            <div style={{
              background: theme.colors.card,
              borderRadius: theme.radius.md,
              padding: '14px 16px',
              fontSize: theme.fontSize.small,
              color: theme.colors.gray,
              lineHeight: 1.6,
            }}>
              {dashboard.templateTip}
            </div>
          </section>
        )}

        {/* ── 开始新一场 ── */}
        {onStartPlan && (
          <button
            onClick={onStartPlan}
            style={{
              width: '100%', padding: '16px 0',
              background: theme.colors.gold,
              color: '#000', fontWeight: 700,
              fontSize: theme.fontSize.body,
              border: 'none', borderRadius: theme.radius.sm,
              cursor: 'pointer',
              marginTop: 8,
            }}
          >
            带着建议开始新一场
          </button>
        )}
      </div>
    </div>
  );
}

// ── 子组件 ──

function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      marginBottom: 12,
      fontSize: theme.fontSize.small, fontWeight: 700,
      color: theme.colors.white,
    }}>
      <span>{icon}</span>
      <span>{title}</span>
    </div>
  );
}

const TipCard: React.FC<{ tip: CoachingTip }> = ({ tip }) => {
  return (
    <div style={{
      background: theme.colors.card,
      borderRadius: theme.radius.md,
      padding: '14px 16px',
      borderLeft: `3px solid ${PRIORITY_COLORS[tip.priority]}`,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
      }}>
        <span style={{ fontSize: 16 }}>{tip.icon}</span>
        <span style={{
          fontSize: theme.fontSize.small, fontWeight: 700,
          color: theme.colors.white,
        }}>
          {tip.title}
        </span>
      </div>
      <p style={{
        fontSize: theme.fontSize.caption, color: theme.colors.gray,
        margin: 0, lineHeight: 1.5,
      }}>
        {tip.body}
      </p>
    </div>
  );
}

// ── SVG 趋势图 ──

function TrendChart({ data }: { data: CoachingDashboard['trend'] }) {
  if (data.length < 2) return null;

  const W = 320;
  const H = 120;
  const PAD = { top: 10, right: 10, bottom: 24, left: 30 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const n = data.length;
  const xStep = chartW / Math.max(1, n - 1);

  // 纪律分折线
  const points = data.map((d, i) => ({
    x: PAD.left + i * xStep,
    y: PAD.top + chartH - (d.disciplineScore / 100) * chartH,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      {/* Y轴参考线 */}
      {[25, 50, 75, 100].map(v => {
        const y = PAD.top + chartH - (v / 100) * chartH;
        return (
          <g key={v}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
              stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
            <text x={PAD.left - 4} y={y + 3} textAnchor="end"
              fill={theme.colors.gray} fontSize={8}>{v}</text>
          </g>
        );
      })}

      {/* 折线 */}
      <path d={linePath} fill="none" stroke={theme.colors.gold} strokeWidth={2} />

      {/* 数据点 */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={4}
            fill={data[i].collapsed ? theme.colors.danger : theme.colors.gold}
            stroke={theme.colors.card} strokeWidth={2} />
          {/* 崩盘标记 */}
          {data[i].collapsed && (
            <text x={p.x} y={p.y - 8} textAnchor="middle"
              fill={theme.colors.danger} fontSize={8} fontWeight={700}>崩</text>
          )}
          {/* X轴日期 */}
          <text x={p.x} y={H - 4} textAnchor="middle"
            fill={theme.colors.gray} fontSize={7}>{data[i].date}</text>
        </g>
      ))}

      {/* 图例 */}
      <text x={W - PAD.right} y={PAD.top - 2} textAnchor="end"
        fill={theme.colors.gray} fontSize={8}>纪律分</text>
    </svg>
  );
}
