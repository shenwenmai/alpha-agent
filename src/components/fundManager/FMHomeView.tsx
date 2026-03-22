import React, { useState, useEffect } from 'react';
import {
  Shield, Plus, History, BookOpen, Play,
  TrendingUp, ChevronRight, Sparkles,
  AlertTriangle, CheckCircle, HelpCircle, Zap, X,
} from 'lucide-react';
import {
  subscribeFM, getActiveSession,
  getEndedSessions, getTemplates,
} from '../../services/fundManagerService';
import { computeMetrics, getRiskLevel, fillDefaults } from '../../services/fundManagerEngine';
import type { FMSession, SessionPlan } from '../../types/fundManager';
import { FM_COLORS } from '../../theme';

interface FMHomeViewProps {
  onNewPlan: () => void;
  onResume: () => void;
  onHistory: () => void;
  onTemplates: () => void;
  onGlossary?: () => void;
  onGrowth?: () => void;
  onReview: (sessionId: string) => void;
  onQuickStart?: (plan: Partial<SessionPlan>) => void;
}

export default function FMHomeView({
  onNewPlan, onResume, onHistory, onTemplates, onGlossary, onGrowth, onReview, onQuickStart,
}: FMHomeViewProps) {
  const [activeSession, setActiveSession] = useState<FMSession | null>(null);
  const [endedSessions, setEndedSessions] = useState<FMSession[]>([]);
  const [showQuickSheet, setShowQuickSheet] = useState(false);
  const [quickBudget, setQuickBudget] = useState<string>('');
  const [, setTick] = useState(0);

  useEffect(() => {
    const refresh = () => {
      setActiveSession(getActiveSession());
      setEndedSessions(getEndedSessions().slice(0, 3));
      setTick(t => t + 1);
    };
    refresh();
    const unsub = subscribeFM(refresh);
    return unsub;
  }, []);

  const activeMetrics = activeSession ? computeMetrics(activeSession) : null;
  const hasHistory = endedSessions.length > 0;

  return (
    <div style={{ padding: '0 0 32px', maxWidth: 480, margin: '0 auto' }}>

      {/* ── 顶部 Hero 区域 ── */}
      <div style={{
        padding: '32px 20px 28px',
        background: `linear-gradient(180deg, ${FM_COLORS.primary}22 0%, transparent 100%)`,
        borderBottom: `1px solid ${FM_COLORS.border}`,
        marginBottom: 20,
      }}>
        {/* Logo + 品牌 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: `linear-gradient(135deg, ${FM_COLORS.primary}, ${FM_COLORS.secondary})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 4px 16px ${FM_COLORS.primary}55`,
            flexShrink: 0,
          }}>
            <Shield size={22} color="#fff" strokeWidth={2} />
          </div>
          <div>
            <h1 style={{
              fontSize: 22, fontWeight: 800, margin: 0,
              color: FM_COLORS.textPrimary,
              letterSpacing: '-0.3px',
            }}>
              AI 资金管家
            </h1>
            <p style={{ fontSize: 12, color: FM_COLORS.textSecondary, margin: 0, marginTop: 1 }}>
              你只管判断，我来帮你盯着
            </p>
          </div>
        </div>

        {/* 进行中的场次 — Hero 卡 */}
        {activeSession && activeSession.status !== 'ended' ? (
          <div
            className="clickable"
            onClick={() => onResume()}
            style={{
              background: `linear-gradient(135deg, ${FM_COLORS.primary}, ${FM_COLORS.secondary})`,
              borderRadius: 22, padding: '20px 20px 18px',
              color: '#fff', cursor: 'pointer',
              boxShadow: `0 8px 32px ${FM_COLORS.primary}55`,
              position: 'relative', overflow: 'hidden',
            }}
          >
            {/* 背景装饰纹 */}
            <div style={{
              position: 'absolute', top: -20, right: -20,
              width: 120, height: 120, borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)',
              pointerEvents: 'none',
            }} />
            <div style={{
              position: 'absolute', bottom: -30, right: 30,
              width: 80, height: 80, borderRadius: '50%',
              background: 'rgba(255,255,255,0.04)',
              pointerEvents: 'none',
            }} />

            {/* 状态栏 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* 脉冲点 */}
                <div style={{ position: 'relative', width: 10, height: 10 }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: activeSession.status === 'paused' ? '#facc15' : '#4ade80',
                  }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, opacity: 0.95 }}>
                  {activeSession.status === 'paused' ? '已暂停' : '进行中'}
                </span>
              </div>
              <div style={{
                fontSize: 12, padding: '4px 12px', borderRadius: 20,
                backgroundColor: 'rgba(255,255,255,0.18)',
                fontWeight: 600, letterSpacing: '0.2px',
              }}>
                点击返回 →
              </div>
            </div>

            {/* 三栏指标 */}
            {activeMetrics && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <LiveMetric
                  label="净输赢"
                  value={activeMetrics.net_pnl >= 0 ? `+${activeMetrics.net_pnl}` : `${activeMetrics.net_pnl}`}
                  color={activeMetrics.net_pnl >= 0 ? '#4ade80' : '#ff6b6b'}
                />
                <LiveMetric
                  label="总手数"
                  value={`${activeMetrics.total_hands}`}
                  color="rgba(255,255,255,0.9)"
                />
                <LiveMetric
                  label="距止损"
                  value={`${activeMetrics.distance_to_stop_loss}`}
                  color={activeMetrics.distance_to_stop_loss < activeSession.plan.stop_loss_amount * 0.2
                    ? '#ff6b6b' : 'rgba(255,255,255,0.9)'}
                />
              </div>
            )}
          </div>
        ) : (
          /* 无活跃场次时：主 CTA */
          <button
            className="clickable"
            onClick={onNewPlan}
            style={{
              width: '100%', padding: '17px 20px', borderRadius: 22, border: 'none',
              background: `linear-gradient(135deg, ${FM_COLORS.primary}, ${FM_COLORS.secondary})`,
              color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              boxShadow: `0 6px 24px ${FM_COLORS.primary}44`,
              fontSize: 16, fontWeight: 700,
              letterSpacing: '-0.1px',
            }}
          >
            <Plus size={20} strokeWidth={2.5} />
            制定新方案
          </button>
        )}
      </div>

      {/* ── 快速操作区 ── */}
      <div style={{ padding: '0 16px' }}>

        {/* 进行中场次存在时 也显示新建按钮（次级）*/}
        {activeSession && activeSession.status !== 'ended' && (
          <button
            className="clickable"
            onClick={onNewPlan}
            style={{
              width: '100%', padding: '14px 20px', borderRadius: 16, marginBottom: 12,
              border: `1.5px solid ${FM_COLORS.border}`,
              background: FM_COLORS.cardBg, color: FM_COLORS.textSecondary,
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 9,
              fontSize: 15, fontWeight: 600,
            }}
          >
            <Plus size={17} strokeWidth={2.5} color={FM_COLORS.textSecondary} />
            制定新方案
          </button>
        )}

        {/* ⚡ 快速开局 */}
        {onQuickStart && hasHistory && (() => {
          const last = endedSessions[0];
          const riskLabel = getRiskLevel(last.plan);
          const lastPnl = computeMetrics(last).net_pnl;
          return (
            <div
              className="clickable"
              onClick={() => {
                setQuickBudget(String(last.plan.session_budget));
                setShowQuickSheet(true);
              }}
              style={{
                background: `${FM_COLORS.primary}12`,
                borderRadius: 16, padding: '15px 18px', marginBottom: 12,
                border: `1.5px solid ${FM_COLORS.primary}50`,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 14,
              }}
            >
              <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: `linear-gradient(135deg, ${FM_COLORS.primary}CC, ${FM_COLORS.secondary}CC)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Zap size={18} color="#fff" fill="#fff" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: FM_COLORS.primary, marginBottom: 2 }}>
                  快速开局
                </div>
                <div style={{ fontSize: 12, color: FM_COLORS.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  沿用上次 · {riskLabel}模式 · 上次{lastPnl >= 0 ? `+${lastPnl}` : lastPnl}
                </div>
              </div>
              <ChevronRight size={15} color={FM_COLORS.primary} />
            </div>
          );
        })()}

        {/* ── 功能入口 ── */}
        <SectionLabel>功能</SectionLabel>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 10, marginBottom: 24,
        }}>
          <ActionCard
            icon={<History size={17} color={FM_COLORS.primary} />}
            iconBg={`${FM_COLORS.primary}18`}
            label="历史记录"
            sub={`${getEndedSessions().length} 场`}
            onClick={onHistory}
          />
          <ActionCard
            icon={<BookOpen size={17} color="#8b5cf6" />}
            iconBg="rgba(139,92,246,0.12)"
            label="方案模板"
            sub={`${getTemplates().length} 个`}
            onClick={onTemplates}
          />
          {onGrowth && (
            <ActionCard
              icon={<TrendingUp size={17} color="#10b981" />}
              iconBg="rgba(16,185,129,0.12)"
              label="成长画像"
              sub="了解你自己"
              onClick={onGrowth}
            />
          )}
          {onGlossary && (
            <ActionCard
              icon={<HelpCircle size={17} color="#f59e0b" />}
              iconBg="rgba(245,158,11,0.12)"
              label="词条说明"
              sub="帮助 & Q&A"
              onClick={onGlossary}
            />
          )}
        </div>

        {/* ── 最近场次 ── */}
        {hasHistory && (
          <div style={{ marginBottom: 24 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 12,
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: FM_COLORS.textPrimary, letterSpacing: '0.3px' }}>
                最近场次
              </span>
              <button
                className="clickable"
                onClick={onHistory}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 12, color: FM_COLORS.textSecondary,
                  display: 'flex', alignItems: 'center', gap: 2, padding: 0,
                }}
              >
                查看全部 <ChevronRight size={13} />
              </button>
            </div>

            <div style={{
              background: FM_COLORS.cardBg, borderRadius: 18,
              border: `1px solid ${FM_COLORS.border}`, overflow: 'hidden',
            }}>
              {endedSessions.map((session, idx) => {
                const metrics = computeMetrics(session);
                const isLast = idx === endedSessions.length - 1;
                const pnlPos = metrics.net_pnl >= 0;
                return (
                  <div
                    key={session.id}
                    className="clickable"
                    onClick={() => onReview(session.id)}
                    style={{
                      padding: '14px 16px', cursor: 'pointer',
                      borderBottom: isLast ? 'none' : `1px solid ${FM_COLORS.border}`,
                      display: 'flex', alignItems: 'center', gap: 14,
                    }}
                  >
                    {/* P&L 色块 */}
                    <div style={{
                      width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                      background: pnlPos ? 'rgba(74,222,128,0.12)' : 'rgba(255,107,107,0.10)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{
                        fontSize: 13, fontWeight: 800,
                        color: pnlPos ? FM_COLORS.profit : FM_COLORS.loss,
                      }}>
                        {pnlPos ? '↑' : '↓'}
                      </span>
                    </div>

                    {/* 信息 */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: FM_COLORS.textPrimary }}>
                        {new Date(session.start_time).toLocaleDateString('zh-CN', {
                          month: 'short', day: 'numeric',
                        })} · {new Date(session.start_time).toLocaleTimeString('zh-CN', {
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                        <span style={{ fontSize: 11, color: FM_COLORS.textSecondary }}>
                          {metrics.total_hands} 手 · {Math.round(metrics.elapsed_minutes)} 分钟
                        </span>
                        {session.review && (
                          <>
                            <span style={{ fontSize: 10, color: FM_COLORS.border }}>·</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                              {session.review.discipline_score >= 80
                                ? <CheckCircle size={10} color={FM_COLORS.profit} />
                                : <AlertTriangle size={10} color={FM_COLORS.warning} />
                              }
                              <span style={{ fontSize: 11, color: FM_COLORS.textSecondary }}>
                                纪律 {session.review.discipline_score}
                              </span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* P&L 数字 */}
                    <div style={{
                      fontSize: 17, fontWeight: 800,
                      color: pnlPos ? FM_COLORS.profit : FM_COLORS.loss,
                      letterSpacing: '-0.3px',
                    }}>
                      {pnlPos ? '+' : ''}{metrics.net_pnl}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 空状态 */}
        {!activeSession && !hasHistory && (
          <div style={{
            textAlign: 'center', padding: '48px 24px 44px',
            background: FM_COLORS.cardBg, borderRadius: 22,
            border: `1px solid ${FM_COLORS.border}`,
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 20, margin: '0 auto 18px',
              background: `linear-gradient(135deg, ${FM_COLORS.primary}18, ${FM_COLORS.secondary}14)`,
              border: `1px solid ${FM_COLORS.primary}22`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Sparkles size={28} color={FM_COLORS.primary} />
            </div>
            <p style={{ fontSize: 17, fontWeight: 700, color: FM_COLORS.textPrimary, margin: '0 0 8px', letterSpacing: '-0.2px' }}>
              还没有任何记录
            </p>
            <p style={{ fontSize: 13, color: FM_COLORS.textSecondary, margin: '0 0 24px', lineHeight: 1.65 }}>
              每一次上桌前，先花 30 秒制定方案<br />
              我会全程帮你守住底线
            </p>
            <button
              className="clickable"
              onClick={onNewPlan}
              style={{
                background: `linear-gradient(135deg, ${FM_COLORS.primary}, ${FM_COLORS.secondary})`,
                color: '#fff', border: 'none', borderRadius: 30,
                padding: '13px 36px', fontSize: 15, fontWeight: 700,
                cursor: 'pointer', letterSpacing: '-0.1px',
                boxShadow: `0 4px 16px ${FM_COLORS.primary}44`,
              }}
            >
              开始制定方案
            </button>
          </div>
        )}
      </div>

      {/* ── 快速开局底部弹窗 ── */}
      {showQuickSheet && hasHistory && (() => {
        const last = endedSessions[0];
        const riskLabel = getRiskLevel(last.plan);
        const budgetNum = parseInt(quickBudget, 10);
        const isValid = !isNaN(budgetNum) && budgetNum >= 100;
        return (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            zIndex: 999, padding: '0 0 env(safe-area-inset-bottom, 0px)',
          }}>
            <div style={{
              background: FM_COLORS.cardBg, borderRadius: '24px 24px 0 0',
              padding: '8px 0 0', width: '100%', maxWidth: 480,
              boxShadow: '0 -8px 40px rgba(0,0,0,0.4)',
            }}>
              {/* 拖把手 */}
              <div style={{
                width: 36, height: 4, borderRadius: 2,
                background: FM_COLORS.border,
                margin: '0 auto 20px',
              }} />

              <div style={{ padding: '0 20px 32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: FM_COLORS.textPrimary, letterSpacing: '-0.2px' }}>
                    快速开局
                  </h3>
                  <button onClick={() => setShowQuickSheet(false)}
                    style={{
                      background: `${FM_COLORS.border}88`, border: 'none', cursor: 'pointer',
                      width: 28, height: 28, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                    <X size={15} color={FM_COLORS.textSecondary} />
                  </button>
                </div>

                {/* 上次方案参数摘要 */}
                <div style={{
                  background: `${FM_COLORS.primary}0D`,
                  borderRadius: 16, padding: '14px 16px', marginBottom: 22,
                  border: `1px solid ${FM_COLORS.primary}20`,
                  display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14,
                }}>
                  <SheetStat label="风险模式" value={riskLabel} color={FM_COLORS.textPrimary} />
                  <SheetStat label="止损线" value={last.plan.stop_loss_amount.toLocaleString()} color={FM_COLORS.danger} />
                  <SheetStat label="基码" value={last.plan.base_unit.toLocaleString()} color={FM_COLORS.textPrimary} />
                </div>

                {/* 今日资金 */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 12, color: FM_COLORS.textSecondary, display: 'block', marginBottom: 8, fontWeight: 600, letterSpacing: '0.3px' }}>
                    今日操盘资金
                  </label>
                  <input
                    type="number"
                    value={quickBudget}
                    onChange={e => setQuickBudget(e.target.value)}
                    placeholder="输入金额"
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '14px 16px', borderRadius: 14, fontSize: 20, fontWeight: 700,
                      border: `1.5px solid ${isValid ? FM_COLORS.primary : FM_COLORS.border}`,
                      background: FM_COLORS.inputBg, color: FM_COLORS.textPrimary,
                      outline: 'none', transition: 'border-color 0.2s',
                    }}
                  />
                </div>

                <button
                  className="clickable"
                  disabled={!isValid}
                  onClick={() => {
                    if (!isValid || !onQuickStart) return;
                    const plan = fillDefaults({
                      ...last.plan,
                      session_budget: budgetNum,
                      input_method: 'template',
                    });
                    setShowQuickSheet(false);
                    onQuickStart(plan);
                  }}
                  style={{
                    width: '100%', padding: '15px', borderRadius: 16, border: 'none',
                    background: isValid
                      ? `linear-gradient(135deg, ${FM_COLORS.primary}, ${FM_COLORS.secondary})`
                      : FM_COLORS.border,
                    color: isValid ? '#fff' : FM_COLORS.textSecondary,
                    fontSize: 16, fontWeight: 700,
                    cursor: isValid ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s',
                    letterSpacing: '-0.1px',
                    boxShadow: isValid ? `0 4px 16px ${FM_COLORS.primary}44` : 'none',
                  }}
                >
                  一键开始
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── 小组件 ──

function LiveMetric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.10)',
      borderRadius: 12, padding: '9px 10px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 10, opacity: 0.65, marginBottom: 4, fontWeight: 600, letterSpacing: '0.3px' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color, letterSpacing: '-0.5px' }}>{value}</div>
    </div>
  );
}

function ActionCard({ icon, iconBg, label, sub, onClick }: {
  icon: React.ReactNode; iconBg: string; label: string; sub: string; onClick: () => void;
}) {
  return (
    <div
      className="clickable"
      onClick={onClick}
      style={{
        background: FM_COLORS.cardBg,
        borderRadius: 16, padding: '16px 16px 14px',
        border: `1px solid ${FM_COLORS.border}`,
        cursor: 'pointer',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: iconBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: FM_COLORS.textPrimary, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 11, color: FM_COLORS.textSecondary }}>{sub}</div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 12, fontWeight: 700, color: FM_COLORS.textSecondary,
      letterSpacing: '0.5px', marginBottom: 10, textTransform: 'uppercase' as const,
    }}>
      {children}
    </div>
  );
}

function SheetStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: FM_COLORS.textSecondary, marginBottom: 5, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}
