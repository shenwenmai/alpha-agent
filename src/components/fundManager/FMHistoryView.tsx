import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Calendar, TrendingUp, TrendingDown,
  Filter, Award, Clock, ChevronRight, Trash2,
} from 'lucide-react';
import {
  subscribeFM, getAllSessions, deleteSession,
} from '../../services/fundManagerService';
import { computeMetrics } from '../../services/fundManagerEngine';
import { FM_COLORS } from '../../theme';
import type { FMSession } from '../../types/fundManager';

interface FMHistoryViewProps {
  detailSessionId: string | null;
  onBack: () => void;
  onDetail: (sessionId: string) => void;
  onReview: (sessionId: string) => void;
}

type HistoryFilter = 'all' | 'profit' | 'loss' | 'stop_loss' | 'lock_profit';

const FILTER_OPTIONS: { key: HistoryFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'profit', label: '盈利' },
  { key: 'loss', label: '亏损' },
];

// CURRENCY_SYMBOLS removed — 不再显示货币符号

export default function FMHistoryView({ detailSessionId, onBack, onDetail, onReview }: FMHistoryViewProps) {
  const [sessions, setSessions] = useState<FMSession[]>([]);
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [, setTick] = useState(0);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => {
      setSessions(getAllSessions().filter(s => s.status === 'ended'));
      setTick(t => t + 1);
    };
    refresh();
    const unsub = subscribeFM(refresh);
    return unsub;
  }, []);

  const filtered = sessions.filter(s => {
    if (filter === 'all') return true;
    const m = computeMetrics(s);
    if (filter === 'profit') return m.net_pnl >= 0;
    if (filter === 'loss') return m.net_pnl < 0;
    return true;
  });

  // 统计
  const totalProfit = sessions.reduce((sum, s) => {
    const m = computeMetrics(s);
    return sum + m.net_pnl;
  }, 0);
  const winCount = sessions.filter(s => computeMetrics(s).net_pnl >= 0).length;
  const winRate = sessions.length > 0 ? Math.round(winCount / sessions.length * 100) : 0;

  return (
    <div style={{ padding: '20px 16px 20px', maxWidth: 480, margin: '0 auto' }}>
      {/* 顶部 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
      }}>
        <button
          className="clickable"
          onClick={onBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6 }}
        >
          <ArrowLeft size={20} color={FM_COLORS.textPrimary} />
        </button>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: FM_COLORS.textPrimary }}>
          历史记录
        </h2>
      </div>

      {/* 汇总统计 */}
      {sessions.length > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10, marginBottom: 16,
        }}>
          <div style={{
            background: FM_COLORS.cardBg, borderRadius: 14,
            border: `1px solid ${FM_COLORS.border}`, padding: '12px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 10, color: FM_COLORS.textSecondary, marginBottom: 4 }}>总场次</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: FM_COLORS.textPrimary }}>
              {sessions.length}
            </div>
          </div>
          <div style={{
            background: FM_COLORS.cardBg, borderRadius: 14,
            border: `1px solid ${FM_COLORS.border}`, padding: '12px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 10, color: FM_COLORS.textSecondary, marginBottom: 4 }}>总盈亏</div>
            <div style={{
              fontSize: 20, fontWeight: 700,
              color: totalProfit >= 0 ? FM_COLORS.profit : FM_COLORS.loss,
            }}>
              {totalProfit >= 0 ? '+' : ''}{totalProfit}
            </div>
          </div>
          <div style={{
            background: FM_COLORS.cardBg, borderRadius: 14,
            border: `1px solid ${FM_COLORS.border}`, padding: '12px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 10, color: FM_COLORS.textSecondary, marginBottom: 4 }}>胜率</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: FM_COLORS.textPrimary }}>
              {winRate}%
            </div>
          </div>
        </div>
      )}

      {/* 筛选 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {FILTER_OPTIONS.map(opt => (
          <button
            key={opt.key}
            className="clickable"
            onClick={() => setFilter(opt.key)}
            style={{
              padding: '6px 14px', borderRadius: 20,
              fontSize: 13, fontWeight: 600,
              border: filter === opt.key ? `2px solid ${FM_COLORS.primary}` : `1px solid ${FM_COLORS.border}`,
              background: filter === opt.key ? `${FM_COLORS.primary}10` : FM_COLORS.cardBg,
              color: filter === opt.key ? FM_COLORS.primary : FM_COLORS.textSecondary,
              cursor: 'pointer',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* 列表 */}
      {filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '40px 20px',
          color: FM_COLORS.textSecondary, fontSize: 14,
        }}>
          {sessions.length === 0 ? '还没有历史记录' : '没有符合条件的记录'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(session => {
            const metrics = computeMetrics(session);
            return (
              <div
                key={session.id}
                className="clickable"
                onClick={() => onReview(session.id)}
                style={{
                  background: FM_COLORS.cardBg, borderRadius: 14,
                  border: `1px solid ${FM_COLORS.border}`, padding: '14px 16px',
                  cursor: 'pointer',
                }}
              >
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <div style={{
                      fontSize: 14, fontWeight: 600, color: FM_COLORS.textPrimary,
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <Calendar size={13} color={FM_COLORS.textSecondary} />
                      {new Date(session.start_time).toLocaleDateString('zh-CN', {
                        month: 'short', day: 'numeric',
                      })}
                      <span style={{ fontSize: 12, fontWeight: 400, color: FM_COLORS.textSecondary }}>
                        {new Date(session.start_time).toLocaleTimeString('zh-CN', {
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div style={{
                      fontSize: 11, color: FM_COLORS.textSecondary, marginTop: 4,
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <span>{metrics.total_hands} 手</span>
                      <span>·</span>
                      <span>{Math.round(metrics.elapsed_minutes)} 分钟</span>
                      {session.review && (
                        <>
                          <span>·</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Award size={10} /> {session.review.discipline_score}分
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <span style={{
                      fontSize: 18, fontWeight: 700,
                      color: metrics.net_pnl >= 0 ? FM_COLORS.profit : FM_COLORS.loss,
                    }}>
                      {metrics.net_pnl >= 0 ? '+' : '-'}{Math.abs(metrics.net_pnl).toLocaleString()}
                    </span>
                    <ChevronRight size={16} color={FM_COLORS.textSecondary} />
                    <button
                      className="clickable"
                      onClick={e => { e.stopPropagation(); setPendingDeleteId(session.id); }}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        padding: '4px', borderRadius: 6,
                        opacity: 0.35, display: 'flex', alignItems: 'center',
                      }}
                    >
                      <Trash2 size={14} color={FM_COLORS.loss} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 软删除确认弹窗 */}
      {pendingDeleteId && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
          onClick={() => setPendingDeleteId(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#1A1A1A', borderRadius: '20px 20px 0 0',
              padding: '24px 20px 36px',
              width: '100%', maxWidth: 480,
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div style={{
              width: 36, height: 4, borderRadius: 2,
              background: 'rgba(255,255,255,0.15)',
              margin: '0 auto 20px',
            }} />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: '0 0 10px' }}>
              从记录中移除
            </h3>
            <p style={{
              fontSize: 13, color: 'rgba(255,255,255,0.5)',
              lineHeight: 1.6, margin: '0 0 24px',
            }}>
              这场数据将从你的历史中隐藏，但系统会保留用于改善你的个性化分析。
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="clickable"
                onClick={() => setPendingDeleteId(null)}
                style={{
                  flex: 1, padding: '13px', borderRadius: 12,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.6)',
                  cursor: 'pointer',
                }}
              >
                取消
              </button>
              <button
                className="clickable"
                onClick={() => {
                  deleteSession(pendingDeleteId);
                  setPendingDeleteId(null);
                }}
                style={{
                  flex: 1, padding: '13px', borderRadius: 12,
                  background: 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  fontSize: 14, fontWeight: 700, color: '#EF4444',
                  cursor: 'pointer',
                }}
              >
                确认移除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
