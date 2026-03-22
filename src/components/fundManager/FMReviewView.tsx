import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, Award, TrendingUp, TrendingDown,
  Clock, AlertTriangle, CheckCircle, Star,
  BarChart3, Zap, Home, Loader, Shield, Activity,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import {
  getSession, saveReview,
} from '../../services/fundManagerService';
import {
  computeMetrics, computeDisciplineScore,
  identifyKeyMoments, computeExecution,
  generateRuleAnalysis, generateParamSuggestions,
  computeDisciplineExecutionRate, computeTriggerDensity,
  classifySessionType, computeDimensionScores, generateBehavioralAnalysis,
} from '../../services/fundManagerEngine';
import { FM_COLORS, theme } from '../../theme';
import { DANGER_SIGNALS } from './FMDangerCheckView';
import { buildSessionSelfCheckSummary } from '../../services/selfCheckService';
import type { FMSession, FMMetrics, FMReviewReport, FMRuleAnalysis, FMParamSuggestion, FMDimensionScores, SessionSelfCheckSummary, BehaviorNode } from '../../types/fundManager';

interface FMReviewViewProps {
  sessionId: string | null;
  onBack: () => void;
  onHome: () => void;
}

// CURRENCY_SYMBOLS removed — 不再显示货币符号

export default function FMReviewView({ sessionId, onBack, onHome }: FMReviewViewProps) {
  const [session, setSession] = useState<FMSession | null>(null);
  const [metrics, setMetrics] = useState<FMMetrics | null>(null);
  const [review, setReview] = useState<FMReviewReport | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    const s = getSession(sessionId);
    if (!s) return;
    setSession(s);


    const m = computeMetrics(s);
    setMetrics(m);

    // 如果已有复盘就直接用
    if (s.review) {
      setReview(s.review);
      return;
    }

    // 先本地生成基础报告（立刻显示）
    const disciplineScore = computeDisciplineScore(s, m);
    const keyMoments = identifyKeyMoments(s, m);
    const execution = computeExecution(s, m);

    const ruleAnalysis = generateRuleAnalysis(s, m);
    const paramSuggestions = generateParamSuggestions(s, m);

    const disciplineExecRate = computeDisciplineExecutionRate(ruleAnalysis);
    const triggerDensity = computeTriggerDensity(ruleAnalysis, m.total_hands);
    const sessionType = classifySessionType(s, m, ruleAnalysis);
    const dimensionScores = computeDimensionScores(s, m, ruleAnalysis);
    const behavioralAnalysis = generateBehavioralAnalysis(s, m);

    const localReview: FMReviewReport = {
      session_id: sessionId,
      generated_at: new Date().toISOString(),
      summary: generateLocalSummary(s, m, ruleAnalysis, sessionType, dimensionScores),
      metrics: m,
      discipline_score: disciplineScore,
      discipline_execution_rate: disciplineExecRate,
      trigger_density: triggerDensity,
      session_type: sessionType,
      dimension_scores: dimensionScores,
      behavioral_analysis: behavioralAnalysis,
      key_moments: keyMoments,
      execution,
      ai_advice: generateLocalAdvice(s, m, disciplineScore, execution),
      rule_analysis: ruleAnalysis,
      parameter_suggestions: paramSuggestions,
    };

    setReview(localReview);
    saveReview(sessionId, localReview);

    // 然后尝试异步调用 AI 生成更好的总结+建议
    setAiLoading(true);
    fetchAIReview(s, m, disciplineScore, keyMoments, execution).then(aiResult => {
      if (!mountedRef.current) return; // 组件已卸载则不更新
      setAiLoading(false);
      if (aiResult) {
        const enhancedReview: FMReviewReport = {
          ...localReview,
          summary: aiResult.summary || localReview.summary,
          ai_advice: aiResult.ai_advice || localReview.ai_advice,
          generated_at: new Date().toISOString(),
        };
        setReview(enhancedReview);
        saveReview(sessionId, enhancedReview);
      }
    }).catch(() => {
      if (mountedRef.current) setAiLoading(false);
    });
  }, [sessionId]);

  if (!session || !metrics || !review) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: FM_COLORS.textSecondary }}>
        未找到场次数据
      </div>
    );
  }

  const isProfit = metrics.net_pnl >= 0;

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
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: FM_COLORS.textPrimary, flex: 1 }}>
          本场复盘
        </h2>
        <button
          className="clickable"
          onClick={onHome}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6 }}
        >
          <Home size={20} color={FM_COLORS.textSecondary} />
        </button>
      </div>

      {/* 结果总览 */}
      <div style={{
        background: `linear-gradient(135deg, ${isProfit ? FM_COLORS.secondary : FM_COLORS.danger}, ${isProfit ? FM_COLORS.accent : '#C1121F'})`,
        borderRadius: 20, padding: '24px 20px', marginBottom: 16, color: '#fff', textAlign: 'center',
      }}>
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
          {new Date(session.start_time).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
          {session.end_time && ` · ${Math.round(metrics.elapsed_minutes)}分钟`}
        </div>
        <div style={{ fontSize: 40, fontWeight: 700, marginBottom: 8 }}>
          {isProfit ? '+' : '-'}{Math.abs(metrics.net_pnl).toLocaleString()}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,0.2)', borderRadius: 20,
            padding: '4px 14px',
          }}>
            <Award size={14} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              纪律分: {review.discipline_score}
            </span>
          </div>
          {review.session_type && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: 'rgba(255,255,255,0.15)', borderRadius: 20,
              padding: '4px 12px',
            }}>
              <span style={{ fontSize: 12, fontWeight: 500 }}>
                {review.session_type}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 指标卡 */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 10, marginBottom: 16,
      }}>
        <StatCard label="总手数" value={`${metrics.total_hands}`} />
        <StatCard label="胜率" value={metrics.total_hands > 0 ? `${Math.round(metrics.win_hands / metrics.total_hands * 100)}%` : '-'} />
        <StatCard label="最大回撤" value={metrics.drawdown_pct > 0 ? `${metrics.drawdown_pct}%` : '-'} color={FM_COLORS.loss} />
        <StatCard label="最高盈利" value={`${metrics.highest_profit.toLocaleString()}`} color={FM_COLORS.profit} />
        <StatCard label="盈利回吐率" value={metrics.profit_giveback_rate > 0 ? `${metrics.profit_giveback_rate}%` : '-'} color={metrics.profit_giveback_rate > 100 ? FM_COLORS.loss : FM_COLORS.warning} />
        <StatCard label="最大连赢" value={`${metrics.max_win_streak}`} color={FM_COLORS.profit} />
        <StatCard label="最大连输" value={`${metrics.max_loss_streak}`} color={FM_COLORS.loss} />
        <StatCard label="纪律执行率" value={review.discipline_execution_rate != null ? `${review.discipline_execution_rate}%` : '-'} color={review.discipline_execution_rate != null && review.discipline_execution_rate < 50 ? FM_COLORS.loss : FM_COLORS.profit} />
        <StatCard label="触发密度" value={review.trigger_density != null ? `${review.trigger_density}%` : '-'} color={review.trigger_density != null && review.trigger_density > 30 ? FM_COLORS.loss : FM_COLORS.textSecondary} />
      </div>

      {/* 逐手战况图（Module A） */}
      <SessionBarChart session={session} />

      {/* 四维评分 */}
      {review.dimension_scores && (
        <div style={{
          background: FM_COLORS.cardBg, borderRadius: 16,
          border: `1px solid ${FM_COLORS.border}`, padding: '16px',
          marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <BarChart3 size={16} color={FM_COLORS.primary} />
            <span style={{ fontSize: 14, fontWeight: 700, color: FM_COLORS.textPrimary }}>四维评分</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            <DimensionBar label="纪律" score={review.dimension_scores.discipline} />
            <DimensionBar label="利润管理" score={review.dimension_scores.profit_management} />
            <DimensionBar label="风险控制" score={review.dimension_scores.risk_control} />
            <DimensionBar label="情绪控制" score={review.dimension_scores.emotion_control} />
          </div>
        </div>
      )}

      {/* P&L 走势图 */}
      {session.events.filter(e => e.event_type === 'win' || e.event_type === 'loss').length >= 2 && (
        <PnLChart session={session} />
      )}

      {/* 行为节点时间线（AR方向1-P1） */}
      {session.behavior_nodes && session.behavior_nodes.length > 0 && (
        <BehaviorNodeTimeline nodes={session.behavior_nodes} startTime={session.start_time} />
      )}

      {/* AI 点评 */}
      <div style={{
        background: FM_COLORS.cardBg, borderRadius: 16,
        border: `1px solid ${FM_COLORS.border}`, padding: '16px',
        marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Zap size={16} color={FM_COLORS.primary} />
          <span style={{ fontSize: 14, fontWeight: 700, color: FM_COLORS.textPrimary }}>AI 点评</span>
          {aiLoading && (
            <Loader size={14} color={FM_COLORS.accent} style={{ animation: 'spin 1s linear infinite' }} />
          )}
        </div>
        <p style={{ fontSize: 13, color: FM_COLORS.textPrimary, lineHeight: 1.7, margin: 0, whiteSpace: 'pre-line' }}>
          {review.summary}
        </p>
      </div>

      {/* 关键时刻（移到规则之前，用户先看"发生了什么"） */}
      {review.key_moments.length > 0 && (
        <div style={{
          background: FM_COLORS.cardBg, borderRadius: 16,
          border: `1px solid ${FM_COLORS.border}`, padding: '16px',
          marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Star size={16} color={FM_COLORS.warning} />
            <span style={{ fontSize: 14, fontWeight: 700, color: FM_COLORS.textPrimary }}>关键时刻</span>
          </div>
          {review.key_moments.map((km, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '6px 0',
              borderBottom: i < review.key_moments.length - 1 ? `1px solid ${FM_COLORS.border}` : 'none',
            }}>
              <span style={{
                fontSize: 10, width: 20, height: 20, borderRadius: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, marginTop: 2,
                background: km.impact === 'positive' ? 'rgba(34,197,94,0.12)'
                  : km.impact === 'negative' ? 'rgba(230,57,70,0.12)' : 'rgba(255,255,255,0.06)',
                color: km.impact === 'positive' ? FM_COLORS.profit
                  : km.impact === 'negative' ? FM_COLORS.loss : FM_COLORS.textSecondary,
              }}>
                {km.impact === 'positive' ? '✓' : km.impact === 'negative' ? '✗' : '·'}
              </span>
              <span style={{ fontSize: 12, color: FM_COLORS.textPrimary, lineHeight: 1.5 }}>
                {km.description}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 陪伴历程时间线（Module B） */}
      <CompanionTimeline session={session} />


      {/* 风控引擎摘要（从事件的 risk_snapshot 聚合） */}
      <RiskEngineSummaryCard events={session.events} />

      {/* 风控规则分析（排除 🟡 预警，预警放到"系统监测"） */}
      {review.rule_analysis && review.rule_analysis.length > 0 && (() => {
        const ruleItems = review.rule_analysis!.filter(ra => ra.event_status !== 'alert');
        const alertItems = review.rule_analysis!.filter(ra => ra.event_status === 'alert');
        return (
          <>
            {/* 你的风控规则 */}
            {ruleItems.length > 0 && (
              <div style={{
                background: FM_COLORS.cardBg, borderRadius: 16,
                border: `1px solid ${FM_COLORS.border}`, padding: '16px',
                marginBottom: 16,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CheckCircle size={16} color={FM_COLORS.primary} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: FM_COLORS.textPrimary }}>你的风控规则</span>
                  </div>
                  {review.discipline_execution_rate != null && (
                    <span style={{
                      fontSize: 11, padding: '3px 8px', borderRadius: 8, fontWeight: 600,
                      background: review.discipline_execution_rate >= 75 ? 'rgba(34,197,94,0.15)' : review.discipline_execution_rate >= 50 ? 'rgba(217,119,6,0.15)' : 'rgba(230,57,70,0.15)',
                      color: review.discipline_execution_rate >= 75 ? '#22C55E' : review.discipline_execution_rate >= 50 ? '#D97706' : '#E63946',
                    }}>
                      执行率 {review.discipline_execution_rate}%
                    </span>
                  )}
                </div>
                {ruleItems.map((ra, i) => (
                  <React.Fragment key={i}><RuleAnalysisItem analysis={ra} /></React.Fragment>
                ))}
              </div>
            )}

            {/* 系统监测（🟡 接近阈值的预警） */}
            {alertItems.length > 0 && (
              <div style={{
                background: 'rgba(245,158,11,0.08)', borderRadius: 16,
                border: '1px solid rgba(245,158,11,0.2)', padding: '16px',
                marginBottom: 16,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <AlertTriangle size={16} color="#F59E0B" />
                  <span style={{ fontSize: 14, fontWeight: 700, color: FM_COLORS.textPrimary }}>系统监测</span>
                  <span style={{ fontSize: 11, color: FM_COLORS.textSecondary }}>接近触发线</span>
                </div>
                {alertItems.map((ra, i) => (
                  <React.Fragment key={i}><RuleAnalysisItem analysis={ra} /></React.Fragment>
                ))}
              </div>
            )}
          </>
        );
      })()}

      {/* 执行情况 */}
      <div style={{
        background: FM_COLORS.cardBg, borderRadius: 16,
        border: `1px solid ${FM_COLORS.border}`, padding: '16px',
        marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <BarChart3 size={16} color={FM_COLORS.primary} />
          <span style={{ fontSize: 14, fontWeight: 700, color: FM_COLORS.textPrimary }}>执行情况</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ExecutionItem
            label="止损执行"
            value={review.execution.stop_loss_triggered ? '已触发' : '未触发'}
            isGood={!review.execution.stop_loss_triggered}
          />
          <ExecutionItem
            label="锁盈保护"
            value={review.execution.lock_profit_triggered ? '已触发' : '未触发'}
            isGood={true}
          />
          <ExecutionItem
            label="超时"
            value={review.execution.time_exceeded ? '是' : '否'}
            isGood={!review.execution.time_exceeded}
          />
          <ExecutionItem
            label="加码记录"
            value={`${review.execution.unauthorized_raise_count} 次`}
            isGood={review.execution.unauthorized_raise_count === 0}
          />
        </div>
      </div>

      {/* 自检分析 */}
      <SelfCheckAnalysisCard session={session} metrics={metrics} />

      {/* 参数调整建议 */}
      {review.parameter_suggestions && review.parameter_suggestions.length > 0 && (
        <div style={{
          background: 'rgba(217,119,6,0.08)', borderRadius: 16,
          border: '1px solid rgba(217,119,6,0.2)', padding: '16px',
          marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Zap size={16} color="#D97706" />
            <span style={{ fontSize: 14, fontWeight: 700, color: FM_COLORS.textPrimary }}>指标调整建议</span>
          </div>
          {review.parameter_suggestions.map((ps, i) => (
            <React.Fragment key={i}><ParamSuggestionItem suggestion={ps} /></React.Fragment>
          ))}
        </div>
      )}

      {/* 行为分析 */}
      {review.behavioral_analysis && (
        <div style={{
          background: FM_COLORS.cardBg, borderRadius: 16,
          border: `1px solid ${FM_COLORS.border}`, padding: '16px',
          marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Zap size={16} color="#8B5CF6" />
            <span style={{ fontSize: 14, fontWeight: 700, color: FM_COLORS.textPrimary }}>行为分析</span>
          </div>
          <p style={{ fontSize: 13, color: FM_COLORS.textPrimary, lineHeight: 1.7, margin: 0, whiteSpace: 'pre-line' }}>
            {review.behavioral_analysis}
          </p>
        </div>
      )}

      {/* 改进建议 */}
      <div style={{
        background: `${FM_COLORS.primary}08`, borderRadius: 16,
        border: `1px solid ${FM_COLORS.border}`, padding: '16px',
        marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <AlertTriangle size={16} color={FM_COLORS.warning} />
          <span style={{ fontSize: 14, fontWeight: 700, color: FM_COLORS.textPrimary }}>改进建议</span>
          {aiLoading && (
            <Loader size={14} color={FM_COLORS.accent} style={{ animation: 'spin 1s linear infinite' }} />
          )}
        </div>
        <p style={{ fontSize: 13, color: FM_COLORS.textPrimary, lineHeight: 1.7, margin: 0, whiteSpace: 'pre-line' }}>
          {review.ai_advice}
        </p>
      </div>

      {/* 分享复盘 */}
      <button
        className="clickable"
        onClick={() => {
          if (!review || !metrics || !session) return;
          const text = [
            `📊 本场复盘报告`,
            ``,
            `💰 盈亏：${metrics.netPnL >= 0 ? '+' : ''}${metrics.netPnL}`,
            `📈 峰值盈利：${metrics.peakProfit} | 最深亏损：${metrics.deepestLoss}`,
            `🎯 纪律分：${review.discipline_score}/100 | 评级：${review.quality_rating}`,
            `⏱ ${metrics.totalHands}手 · ${metrics.elapsedMinutes || 0}分钟`,
            review.turning_point_count > 0 ? `⚡ 转折点：${review.turning_point_count}次` : '',
            ``,
            review.ai_advice ? `💡 AI建议：${review.ai_advice.slice(0, 100)}...` : '',
            ``,
            `— 资金管家 · 博弈操作系统`,
          ].filter(Boolean).join('\n');

          if (navigator.share) {
            navigator.share({ title: '本场复盘报告', text }).catch(() => {});
          } else {
            navigator.clipboard.writeText(text).then(() => alert('已复制到剪贴板'));
          }
        }}
        style={{
          width: '100%', padding: '14px', borderRadius: 30,
          border: `2px solid ${FM_COLORS.primary}`,
          fontSize: 15, fontWeight: 700, cursor: 'pointer',
          background: 'transparent',
          color: FM_COLORS.primary,
        }}
      >
        分享复盘
      </button>

      {/* 返回首页按钮 */}
      <button
        className="clickable"
        onClick={onHome}
        style={{
          width: '100%', padding: '14px', borderRadius: 30, border: 'none',
          fontSize: 15, fontWeight: 700, cursor: 'pointer',
          background: `linear-gradient(135deg, ${FM_COLORS.primary}, ${FM_COLORS.secondary})`,
          color: '#fff',
        }}
      >
        返回首页
      </button>
    </div>
  );
}

// ── 子组件 ──

// ─── Module A: 逐手战况图 ───────────────────────────────────────────────────
function SessionBarChart({ session }: { session: FMSession }) {
  const [animated, setAnimated] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── All hooks BEFORE any early return ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { setAnimated(true); obs.disconnect(); }
      },
      { threshold: 0.3 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const hands = session.events.filter(
    e => e.event_type === 'win' || e.event_type === 'loss',
  );

  // Early return AFTER hooks
  if (hands.length === 0) return null;

  const etpAlert = session.alerts?.find(
    a => a.rule_key === 'etp_triggered' || a.level === 'formal_alert',
  );

  const maxVal = Math.max(
    1,
    ...hands.map(h => h.bet_unit ?? Math.abs(h.amount ?? 0)),
  );

  const SVG_H = 90;
  const MAX_BAR_H = 72;
  const BAR_W = Math.max(5, Math.min(16, Math.floor(320 / hands.length) - 3));
  const GAP = Math.max(2, Math.min(5, Math.floor(80 / hands.length)));
  const totalW = Math.max(300, hands.length * (BAR_W + GAP));

  const handleReplay = () => {
    setAnimated(false);
    setTimeout(() => setAnimated(true), 60);
  };

  // Find ETP hand index
  let etpX: number | null = null;
  if (etpAlert) {
    const etpTime = new Date(etpAlert.timestamp).getTime();
    const idx = hands.findIndex(h => new Date(h.timestamp).getTime() >= etpTime);
    if (idx >= 0) etpX = idx * (BAR_W + GAP) + BAR_W / 2;
  }

  return (
    <div
      ref={containerRef}
      style={{
        background: FM_COLORS.cardBg, borderRadius: 16,
        border: `1px solid ${FM_COLORS.border}`, padding: '16px',
        marginBottom: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={16} color={FM_COLORS.primary} />
          <span style={{ fontSize: 14, fontWeight: 700, color: FM_COLORS.textPrimary }}>逐手战况</span>
          <span style={{ fontSize: 11, color: FM_COLORS.textSecondary }}>{hands.length}手</span>
        </div>
        <button
          onClick={handleReplay}
          style={{
            fontSize: 11, color: FM_COLORS.textSecondary, background: 'none',
            border: `1px solid ${FM_COLORS.border}`, borderRadius: 6,
            padding: '3px 8px', cursor: 'pointer',
          }}
        >
          ▶ 重播
        </button>
      </div>

      <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
        <svg
          width={totalW}
          height={SVG_H + 14}
          style={{ display: 'block' }}
        >
          {/* Zero baseline */}
          <line x1={0} y1={SVG_H} x2={totalW} y2={SVG_H} stroke="rgba(255,255,255,0.10)" strokeWidth={0.8} />

          {/* Bars — animated as a group via scaleY */}
          <g
            style={{
              transform: `scaleY(${animated ? 1 : 0})`,
              transformOrigin: `0 ${SVG_H}px`,
              transition: animated ? 'transform 1.5s ease-out' : 'none',
            }}
          >
            {hands.map((hand, i) => {
              const val = hand.bet_unit ?? Math.abs(hand.amount ?? 0);
              const barH = maxVal > 0 ? Math.max(4, (val / maxVal) * MAX_BAR_H) : 8;
              const x = i * (BAR_W + GAP);
              const y = SVG_H - barH;
              const color = hand.event_type === 'win' ? '#22C55E' : '#FF3B47';
              const isSelected = selected === i;

              // Ignored alert near this hand (within 90 seconds)
              const handMs = new Date(hand.timestamp).getTime();
              const hasIgnoredAlert = session.alerts?.some(
                a => a.dismissed && Math.abs(new Date(a.timestamp).getTime() - handMs) < 90_000,
              );

              return (
                <g key={i}>
                  <rect
                    x={x} y={y} width={BAR_W} height={barH}
                    fill={color} rx={1}
                    opacity={isSelected ? 1 : 0.82}
                    onClick={() => setSelected(selected === i ? null : i)}
                    style={{ cursor: 'pointer' }}
                  />
                  {hasIgnoredAlert && (
                    <circle cx={x + BAR_W / 2} cy={y - 5} r={3} fill="#FF3B47" />
                  )}
                </g>
              );
            })}
          </g>

          {/* ETP vertical marker (outside animated group) */}
          {etpX !== null && (
            <g>
              <line
                x1={etpX} y1={4} x2={etpX} y2={SVG_H}
                stroke="#F59E0B" strokeWidth={1.5} strokeDasharray="3,2"
              />
              <text x={etpX + 4} y={13} fontSize={8} fill="#F59E0B" fontWeight="600">转折点</text>
            </g>
          )}

          {/* Hand index labels (sparse, max 10) */}
          {hands.map((_, i) => {
            const step = Math.max(1, Math.ceil(hands.length / 8));
            if (i % step !== 0) return null;
            const x = i * (BAR_W + GAP) + BAR_W / 2;
            return (
              <text key={i} x={x} y={SVG_H + 11} fontSize={7} fill="rgba(255,255,255,0.25)" textAnchor="middle">
                {i + 1}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: '#22C55E', display: 'inline-block' }} />赢
        </span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: '#FF3B47', display: 'inline-block' }} />输
        </span>
        {session.alerts?.some(a => a.dismissed) && (
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FF3B47', display: 'inline-block' }} />忽视警告
          </span>
        )}
        {etpX !== null && (
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 2, background: '#F59E0B', display: 'inline-block' }} />转折点
          </span>
        )}
      </div>

      {/* Selected hand detail */}
      {selected !== null && hands[selected] && (
        <div style={{
          marginTop: 10, padding: '8px 12px',
          background: 'rgba(255,255,255,0.04)', borderRadius: 8,
          fontSize: 12, color: FM_COLORS.textSecondary,
        }}>
          第{selected + 1}手 ·{' '}
          {hands[selected].bet_unit != null ? `码量 ${hands[selected].bet_unit} · ` : ''}
          {hands[selected].event_type === 'win' ? '赢' : '输'}{' '}
          {Math.abs(hands[selected].amount ?? 0)}
        </div>
      )}
    </div>
  );
}

// ─── Module B: 陪伴历程时间线 ────────────────────────────────────────────────
interface TimelineItem {
  time: string;
  type: 'alert' | 'emotion' | 'self_check' | 'behavior_node';
  level?: string;
  message?: string;
  dismissed?: boolean;
  nodeType?: string;
  label?: string;
  note?: string;
  result?: string;
}

function CompanionTimeline({ session }: { session: FMSession }) {
  const [visibleCount, setVisibleCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const items: TimelineItem[] = [
    ...(session.alerts ?? []).map(a => ({
      time: a.timestamp,
      type: 'alert' as const,
      level: a.level,
      message: a.message,
      dismissed: a.dismissed,
    })),
    ...session.events
      .filter(e => e.event_type === 'emotion')
      .map(e => ({
        time: e.timestamp,
        type: 'emotion' as const,
        note: e.note,
      })),
    ...session.events
      .filter(e => e.event_type === 'self_check')
      .map(e => ({
        time: e.timestamp,
        type: 'self_check' as const,
        result: e.self_check_result?.risk_level,
      })),
    ...(session.behavior_nodes ?? []).map(n => ({
      time: n.timestamp,
      type: 'behavior_node' as const,
      nodeType: n.type,
      label: n.detail,
    })),
  ].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  const sessionStart = new Date(session.start_time).getTime();
  const itemCount = items.length;

  // ── All hooks BEFORE any early return ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el || itemCount === 0) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          obs.disconnect();
          let count = 0;
          timerRef.current = setInterval(() => {
            count++;
            setVisibleCount(count);
            if (count >= itemCount) clearInterval(timerRef.current!);
          }, 150);
        }
      },
      { threshold: 0.2 },
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [itemCount]);

  // Early return AFTER hooks
  if (itemCount === 0) return null;

  const handleReplay = () => {
    setVisibleCount(0);
    let count = 0;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      count++;
      setVisibleCount(count);
      if (count >= items.length) clearInterval(timerRef.current!);
    }, 150);
  };

  const getItemStyle = (item: TimelineItem) => {
    if (item.type === 'alert') {
      if (item.dismissed) return { color: '#EF4444', icon: '⚡✗', bg: 'rgba(239,68,68,0.06)', border: '1px dashed rgba(239,68,68,0.5)' };
      if (item.level === 'strong_alert') return { color: '#EF4444', icon: '🚨', bg: 'rgba(239,68,68,0.08)', border: '2px solid rgba(239,68,68,0.4)' };
      if (item.level === 'formal_alert') return { color: '#EF4444', icon: '⚡', bg: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.3)' };
      return { color: '#F59E0B', icon: '⚠', bg: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.3)' };
    }
    if (item.type === 'emotion') return { color: '#A78BFA', icon: '◎', bg: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.25)' };
    if (item.type === 'self_check') return { color: '#60A5FA', icon: '🛡', bg: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.25)' };
    // behavior_node
    if (item.nodeType === 'collapse') return { color: '#EF4444', icon: '▼', bg: 'rgba(239,68,68,0.08)', border: '1.5px solid rgba(239,68,68,0.4)' };
    if (item.nodeType === 'giveback') return { color: '#F59E0B', icon: '↩', bg: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.3)' };
    return { color: '#00D4AA', icon: '✓', bg: 'rgba(0,212,170,0.06)', border: '1px solid rgba(0,212,170,0.25)' };
  };

  const getLabel = (item: TimelineItem) => {
    if (item.type === 'alert') return item.message ?? '系统提醒';
    if (item.type === 'emotion') return item.note ? `情绪记录：${item.note}` : '情绪状态变化';
    if (item.type === 'self_check') return `即时自检 — ${item.result === 'danger' ? '危险' : item.result === 'warning' ? '警告' : '安全'}`;
    return item.label ?? item.nodeType ?? '行为节点';
  };

  const relMin = (t: string) =>
    Math.round((new Date(t).getTime() - sessionStart) / 60_000);

  return (
    <div
      ref={containerRef}
      style={{
        background: FM_COLORS.cardBg, borderRadius: 16,
        border: `1px solid ${FM_COLORS.border}`, padding: '16px',
        marginBottom: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={16} color={FM_COLORS.primary} />
          <span style={{ fontSize: 14, fontWeight: 700, color: FM_COLORS.textPrimary }}>陪伴历程</span>
        </div>
        <button
          onClick={handleReplay}
          style={{
            fontSize: 11, color: FM_COLORS.textSecondary, background: 'none',
            border: `1px solid ${FM_COLORS.border}`, borderRadius: 6,
            padding: '3px 8px', cursor: 'pointer',
          }}
        >
          重新回顾
        </button>
      </div>

      <div style={{ position: 'relative' }}>
        {/* Vertical line */}
        <div style={{
          position: 'absolute', left: 13, top: 8, bottom: 8,
          width: 1, background: 'rgba(255,255,255,0.07)',
        }} />

        {items.map((item, i) => {
          const { color, icon, bg, border } = getItemStyle(item);
          const label = getLabel(item);
          const visible = i < visibleCount;
          const isDismissed = item.type === 'alert' && item.dismissed;

          return (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                marginBottom: i < items.length - 1 ? 10 : 0,
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateX(0)' : 'translateX(-8px)',
                transition: `opacity 0.2s ease, transform 0.2s ease`,
                transitionDelay: isDismissed ? '0.3s' : '0s',
              }}
            >
              {/* Timeline dot */}
              <div style={{
                width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                background: bg, border,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, color,
                boxShadow: isDismissed && visible ? `0 0 8px rgba(239,68,68,0.4)` : 'none',
              }}>
                {icon}
              </div>

              {/* Content */}
              <div style={{
                flex: 1, padding: '5px 10px', borderRadius: 8,
                background: bg, border,
                minWidth: 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 12, color: FM_COLORS.textPrimary, lineHeight: 1.4, flex: 1 }}>
                    {label}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', whiteSpace: 'nowrap' }}>
                      第{relMin(item.time)}分钟
                    </span>
                    {isDismissed && (
                      <span style={{ fontSize: 9, color: 'rgba(239,68,68,0.6)', whiteSpace: 'nowrap' }}>
                        已忽视
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Discipline summary if no alerts */}
      {(session.alerts ?? []).length === 0 && (
        <div style={{
          marginTop: 10, padding: '8px 12px',
          background: 'rgba(34,197,94,0.06)', borderRadius: 8,
          border: '1px solid rgba(34,197,94,0.25)',
          fontSize: 12, color: '#22C55E', textAlign: 'center',
        }}>
          本场纪律良好，全程无系统预警
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      background: FM_COLORS.cardBg, borderRadius: 12,
      border: `1px solid ${FM_COLORS.border}`,
      padding: '10px 8px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 10, color: FM_COLORS.textSecondary, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: color || FM_COLORS.textPrimary }}>{value}</div>
    </div>
  );
}

function RuleAnalysisItem({ analysis }: { analysis: FMRuleAnalysis }) {
  const typeLabels = { basic: '基础', advanced: '进阶', custom: '自定义' };
  const typeColors = { basic: '#3B82F6', advanced: '#D97706', custom: '#8B5CF6' };

  // 六级事件状态配色
  const statusConfig: Record<string, { icon: string; bg: string; label: string; color: string }> = {
    violation:   { icon: '✕', bg: 'rgba(230,57,70,0.12)', label: '违规', color: '#E63946' },
    triggered:   { icon: '▲', bg: 'rgba(217,119,6,0.12)', label: '已触发', color: '#D97706' },
    safe:        { icon: '◈', bg: 'rgba(34,197,94,0.12)', label: '未触发', color: '#22C55E' },
    activated:   { icon: '◆', bg: 'rgba(59,130,246,0.12)', label: '已激活', color: '#3B82F6' },
    alert:       { icon: '◇', bg: 'rgba(245,158,11,0.12)', label: '接近阈值', color: '#F59E0B' },
    observation: { icon: '▪', bg: 'rgba(255,255,255,0.06)', label: '行为记录', color: '#AAAAAA' },
  };

  // 兼容旧数据（没有 event_status 的用旧逻辑）
  const status = analysis.event_status || (
    analysis.was_triggered
      ? (analysis.user_complied ? 'triggered' : 'violation')
      : 'safe'
  );
  const cfg = statusConfig[status] || statusConfig.triggered;

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 8,
      padding: '8px 10px', borderRadius: 10, marginBottom: 4,
      background: cfg.bg,
    }}>
      <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{cfg.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: FM_COLORS.textPrimary }}>
            {analysis.rule_name}
          </span>
          <span style={{
            fontSize: 9, padding: '1px 5px', borderRadius: 4,
            background: typeColors[analysis.rule_type] + '15',
            color: typeColors[analysis.rule_type], fontWeight: 600,
          }}>
            {typeLabels[analysis.rule_type]}
          </span>
          <span style={{
            fontSize: 9, padding: '1px 5px', borderRadius: 4,
            background: cfg.color + '15', color: cfg.color, fontWeight: 600,
          }}>
            {cfg.label}
          </span>
        </div>
        <div style={{ fontSize: 11, color: FM_COLORS.textSecondary, lineHeight: 1.4 }}>
          {analysis.note}
        </div>
      </div>
    </div>
  );
}

function ParamSuggestionItem({ suggestion }: { suggestion: FMParamSuggestion }) {
  const priorityColors = { high: '#E63946', medium: '#D97706', low: '#6B7280' };
  const priorityLabels = { high: '强烈建议', medium: '建议', low: '参考' };

  return (
    <div style={{
      padding: '10px 12px', borderRadius: 10,
      background: FM_COLORS.cardBg, marginBottom: 6,
      border: `1px solid ${priorityColors[suggestion.priority]}20`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{
          fontSize: 9, padding: '1px 6px', borderRadius: 4,
          background: priorityColors[suggestion.priority] + '15',
          color: priorityColors[suggestion.priority], fontWeight: 700,
        }}>
          {priorityLabels[suggestion.priority]}
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: FM_COLORS.textPrimary }}>
          {suggestion.parameter}
        </span>
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 12, marginBottom: 4,
      }}>
        <span style={{ color: FM_COLORS.textSecondary }}>{suggestion.current_value}</span>
        <span style={{ color: '#D97706' }}>→</span>
        <span style={{ color: '#D97706', fontWeight: 600 }}>{suggestion.suggested_value}</span>
      </div>
      <div style={{ fontSize: 11, color: FM_COLORS.textSecondary, lineHeight: 1.4 }}>
        {suggestion.reason}
      </div>
    </div>
  );
}

function ExecutionItem({ label, value, isGood }: { label: string; value: string; isGood: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <span style={{ fontSize: 13, color: FM_COLORS.textSecondary }}>{label}</span>
      <span style={{
        display: 'flex', alignItems: 'center', gap: 4,
        fontSize: 13, fontWeight: 600,
        color: isGood ? FM_COLORS.profit : FM_COLORS.loss,
      }}>
        {isGood ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
        {value}
      </span>
    </div>
  );
}

function DimensionBar({ label, score }: { label: string; score: number }) {
  const color = score >= 80 ? '#22C55E' : score >= 60 ? '#D97706' : '#E63946';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: FM_COLORS.textSecondary }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{score}</span>
      </div>
      <div style={{
        height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', borderRadius: 3, background: color,
          width: `${score}%`, transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  );
}

// ── 信号ID → 中文文本映射 ──
const signalTextMap = new Map(DANGER_SIGNALS.map(s => [s.id, s.text]));

// ── 风险等级颜色 ──
const RISK_LEVEL_COLORS: Record<string, string> = {
  safe: theme.colors.success,
  caution: theme.colors.warning,
  warning: '#FF8C00',
  danger: theme.colors.danger,
};

// ── 自检分析卡片 ──
// ── 风控引擎摘要卡片 ──
function RiskEngineSummaryCard({ events }: { events: FMSession['events'] }) {
  // 从事件的 risk_snapshot 聚合风控数据
  const snapshots = events
    .filter(e => e.risk_snapshot)
    .map(e => e.risk_snapshot!);

  if (snapshots.length === 0) return null;

  // 聚合统计
  const LEVEL_NUM: Record<string, number> = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4 };
  let maxLevel = 'L0';
  let interventionCount = 0;
  let maxProfitLockStage = 0;
  const allToxicCombos = new Set<string>();
  const allKeyMoments = new Set<string>();

  for (const s of snapshots) {
    if (LEVEL_NUM[s.level] > LEVEL_NUM[maxLevel]) maxLevel = s.level;
    if (LEVEL_NUM[s.level] >= 2) interventionCount++; // L2+ 算干预
    if (s.profitLockStage > maxProfitLockStage) maxProfitLockStage = s.profitLockStage;
    s.toxicCombos.forEach(tc => allToxicCombos.add(tc));
    s.keyMoments.forEach(km => allKeyMoments.add(km));
  }

  const levelLabels: Record<string, string> = {
    L0: '正常', L1: '轻提醒', L2: '正式警告', L3: '强警告', L4: '强制干预',
  };
  const levelColors: Record<string, string> = {
    L0: '#22C55E', L1: '#E6B800', L2: '#F97316', L3: '#E63946', L4: '#FF0040',
  };
  const stageLabels: Record<number, string> = {
    0: '未激活', 1: '已激活', 2: '收紧中', 3: '回撤', 4: '归零', 5: '转亏',
  };
  const comboLabels: Record<string, string> = {
    fatigue_pressure: '高压疲劳', momentum_reversal: '顺风转折',
  };
  const momentLabels: Record<string, string> = {
    streak_limit: '连输触线', net_loss_limit: '净输触线',
    streak_net_loss: '连输/净输触线', // 兼容旧数据
    grind: '缠斗', overtime: '超时',
    profit_gone: '盈利转亏', streak2_raise: '连输后加注',
  };

  return (
    <div style={{
      background: FM_COLORS.cardBg, borderRadius: 16,
      border: `1px solid ${FM_COLORS.border}`, padding: 16, marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Shield size={16} color={levelColors[maxLevel]} />
        <span style={{ fontSize: 14, fontWeight: 700, color: FM_COLORS.textPrimary }}>风控引擎摘要</span>
      </div>

      {/* 核心数据行 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
        <div style={{
          flex: 1, textAlign: 'center', padding: '8px 0',
          backgroundColor: `${levelColors[maxLevel]}15`, borderRadius: 8,
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: levelColors[maxLevel] }}>{maxLevel}</div>
          <div style={{ fontSize: 10, color: FM_COLORS.textSecondary }}>{levelLabels[maxLevel]}</div>
          <div style={{ fontSize: 9, color: FM_COLORS.textSecondary, marginTop: 2 }}>最高干预</div>
        </div>
        <div style={{
          flex: 1, textAlign: 'center', padding: '8px 0',
          backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8,
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: FM_COLORS.textPrimary }}>{interventionCount}</div>
          <div style={{ fontSize: 10, color: FM_COLORS.textSecondary }}>次干预</div>
          <div style={{ fontSize: 9, color: FM_COLORS.textSecondary, marginTop: 2 }}>L2+触发</div>
        </div>
        <div style={{
          flex: 1, textAlign: 'center', padding: '8px 0',
          backgroundColor: maxProfitLockStage >= 3 ? 'rgba(230,57,70,0.08)' : 'rgba(255,255,255,0.04)', borderRadius: 8,
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: maxProfitLockStage >= 3 ? '#E63946' : FM_COLORS.textPrimary }}>
            {stageLabels[maxProfitLockStage] || `阶段${maxProfitLockStage}`}
          </div>
          <div style={{ fontSize: 10, color: FM_COLORS.textSecondary }}>锁盈状态</div>
          <div style={{ fontSize: 9, color: FM_COLORS.textSecondary, marginTop: 2 }}>最高阶段</div>
        </div>
      </div>

      {/* 毒药组合 + 关键时刻 */}
      {(allToxicCombos.size > 0 || allKeyMoments.size > 0) && (
        <div style={{ fontSize: 11, color: FM_COLORS.textSecondary, lineHeight: 1.8 }}>
          {allToxicCombos.size > 0 && (
            <div>☠️ 毒药: {[...allToxicCombos].map(tc => comboLabels[tc] || tc).join('、')}</div>
          )}
          {allKeyMoments.size > 0 && (
            <div>⚡ 关键时刻: {[...allKeyMoments].map(km => momentLabels[km] || km).join('、')}</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 自检分析卡片 ──
function SelfCheckAnalysisCard({ session, metrics }: { session: FMSession; metrics: FMMetrics }) {
  // 从 session.events 中过滤出所有 self_check 事件
  const selfCheckEvents = session.events.filter(e => e.event_type === 'self_check' && e.self_check_result);
  if (selfCheckEvents.length === 0) return null;

  // 用 buildSessionSelfCheckSummary 生成摘要（如果可用），否则本地计算
  let summary: SessionSelfCheckSummary | null = null;
  try {
    summary = buildSessionSelfCheckSummary(session.id, session.events);
  } catch {
    // selfCheckService 可能还没就绪，降级为本地计算
  }

  // 本地降级计算
  if (!summary) {
    const preEntryChecks = selfCheckEvents.filter(e => e.self_check_result!.mode === 'pre_entry');
    const liveChecks = selfCheckEvents.filter(e => e.self_check_result!.mode === 'live');

    // 统计信号频次
    const signalCounts = new Map<string, number>();
    for (const evt of selfCheckEvents) {
      for (const id of evt.self_check_result!.checked_ids) {
        signalCounts.set(id, (signalCounts.get(id) || 0) + 1);
      }
    }
    const topSignals = [...signalCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);

    // 计算遵从分：danger/warning 时选择 end_session 或 pause 的比例
    const highRiskChecks = selfCheckEvents.filter(e => {
      const rl = e.self_check_result!.risk_level;
      return rl === 'danger' || rl === 'warning';
    });
    let complianceScore = 100;
    if (highRiskChecks.length > 0) {
      // 从 note 判断 action：包含 "结束" 表示 end_session
      const complied = highRiskChecks.filter(e => e.note?.includes('结束'));
      complianceScore = Math.round((complied.length / highRiskChecks.length) * 100);
    }

    // 计算手数：根据事件在 session.events 中的位置推算
    const liveCheckDetails = liveChecks.map(evt => {
      const idx = session.events.indexOf(evt);
      const handsBefore = session.events.slice(0, idx).filter(
        e => e.event_type === 'win' || e.event_type === 'loss'
      ).length;
      return {
        hand_number: handsBefore,
        risk_level: evt.self_check_result!.risk_level,
        checked_count: evt.self_check_result!.checked_ids.length,
        action_taken: evt.note?.includes('结束') ? 'end_session' : 'continue',
      };
    });

    summary = {
      total_checks: selfCheckEvents.length,
      pre_entry_risk_level: preEntryChecks.length > 0 ? preEntryChecks[0].self_check_result!.risk_level : '',
      live_checks: liveCheckDetails,
      top_signals: topSignals,
      compliance_score: complianceScore,
      ai_comment: '',
    };
  }

  // 遵从分颜色
  const complianceColor = summary.compliance_score >= 80
    ? theme.colors.success
    : summary.compliance_score >= 50
      ? theme.colors.warning
      : theme.colors.danger;

  return (
    <div style={{
      background: FM_COLORS.cardBg, borderRadius: 16,
      border: `1px solid ${FM_COLORS.border}`, padding: '16px',
      marginBottom: 16,
    }}>
      {/* 标题 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 16 }}>🛡️</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: FM_COLORS.textPrimary }}>自检分析</span>
      </div>

      {/* 本场自检次数 */}
      <div style={{ fontSize: 13, color: FM_COLORS.textPrimary, marginBottom: 8 }}>
        本场共 <span style={{ fontWeight: 700 }}>{summary.total_checks}</span> 次自检
      </div>

      {/* 各次自检明细 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
        {/* 进场前自检 */}
        {summary.pre_entry_risk_level && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 12, color: FM_COLORS.textSecondary,
            padding: '4px 8px', borderRadius: 6,
            background: 'rgba(255,255,255,0.03)',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: RISK_LEVEL_COLORS[summary.pre_entry_risk_level] || FM_COLORS.textSecondary,
              flexShrink: 0,
            }} />
            <span>进场前: <span style={{
              color: RISK_LEVEL_COLORS[summary.pre_entry_risk_level] || FM_COLORS.textSecondary,
              fontWeight: 600,
            }}>{summary.pre_entry_risk_level}</span></span>
          </div>
        )}

        {/* 即时自检 */}
        {summary.live_checks.map((lc, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 12, color: FM_COLORS.textSecondary,
            padding: '4px 8px', borderRadius: 6,
            background: 'rgba(255,255,255,0.03)',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: RISK_LEVEL_COLORS[lc.risk_level] || FM_COLORS.textSecondary,
              flexShrink: 0,
            }} />
            <span>
              第 {lc.hand_number} 手: <span style={{
                color: RISK_LEVEL_COLORS[lc.risk_level] || FM_COLORS.textSecondary,
                fontWeight: 600,
              }}>{lc.risk_level}</span> ({lc.checked_count}项)
              {' → '}
              <span style={{
                fontWeight: 600,
                color: lc.action_taken === 'end_session' ? theme.colors.success : FM_COLORS.textSecondary,
              }}>
                {lc.action_taken === 'end_session' ? '结束' : lc.action_taken === 'pause' ? '暂停' : '继续'}
              </span>
            </span>
          </div>
        ))}
      </div>

      {/* 最频繁信号 */}
      {summary.top_signals.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: FM_COLORS.textSecondary, marginBottom: 4 }}>
            最频繁信号
          </div>
          <div style={{ fontSize: 12, color: FM_COLORS.textPrimary, lineHeight: 1.6 }}>
            {summary.top_signals.map(id => signalTextMap.get(id) || id).join('、')}
          </div>
        </div>
      )}

      {/* 遵从分 */}
      <div style={{ marginBottom: summary.ai_comment ? 12 : 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 6,
        }}>
          <span style={{ fontSize: 11, color: FM_COLORS.textSecondary }}>自检遵从分</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: complianceColor }}>
            {summary.compliance_score}/100
          </span>
        </div>
        <div style={{
          height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: 2, background: complianceColor,
            width: `${summary.compliance_score}%`, transition: 'width 0.5s ease',
          }} />
        </div>
      </div>

      {/* AI 点评 */}
      {summary.ai_comment && (
        <div style={{
          marginTop: 10, padding: '8px 10px', borderRadius: 8,
          background: 'rgba(255,255,255,0.04)',
          borderLeft: `3px solid ${complianceColor}`,
        }}>
          <p style={{
            fontSize: 12, color: FM_COLORS.textSecondary,
            lineHeight: 1.6, margin: 0, whiteSpace: 'pre-line',
          }}>
            {summary.ai_comment}
          </p>
        </div>
      )}
    </div>
  );
}

/** 异步请求 AI 复盘 */
async function fetchAIReview(
  s: FMSession, m: FMMetrics, disciplineScore: number,
  keyMoments: FMReviewReport['key_moments'], execution: FMReviewReport['execution'],
): Promise<{ summary: string; ai_advice: string } | null> {
  try {
    const resp = await fetch('/api/fm-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session: s,
        metrics: m,
        disciplineScore,
        keyMoments,
        execution,
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data.summary || data.ai_advice) {
      return { summary: data.summary, ai_advice: data.ai_advice };
    }
    return null;
  } catch {
    return null;
  }
}

// ── 行为节点时间线（AR方向1-P1）──

const NODE_CONFIG: Record<string, { emoji: string; label: string; color: string; bg: string; border: string }> = {
  collapse:  { emoji: '🔴', label: '连损崩盘', color: '#ef4444', bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.25)' },
  giveback:  { emoji: '🟠', label: '盈利回吐', color: '#f97316', bg: 'rgba(249,115,22,0.10)', border: 'rgba(249,115,22,0.25)' },
  emotion:   { emoji: '🟡', label: '情绪预警', color: '#eab308', bg: 'rgba(234,179,8,0.10)',  border: 'rgba(234,179,8,0.25)'  },
  rebound:   { emoji: '🟢', label: '纪律离场', color: '#22c55e', bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.20)'  },
};

function BehaviorNodeTimeline({ nodes, startTime }: { nodes: BehaviorNode[]; startTime: string }) {
  const sorted = [...nodes].sort((a, b) => a.hand_index - b.hand_index);
  const negCount = nodes.filter(n => n.type === 'collapse' || n.type === 'giveback' || n.type === 'emotion').length;
  const posCount = nodes.filter(n => n.type === 'rebound').length;

  return (
    <div style={{
      background: FM_COLORS.cardBg, borderRadius: 16,
      border: `1px solid ${FM_COLORS.border}`, padding: '16px',
      marginBottom: 16,
    }}>
      {/* 标题 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Zap size={16} color={FM_COLORS.warning} />
          <span style={{ fontSize: 14, fontWeight: 700, color: FM_COLORS.textPrimary }}>关键行为节点</span>
          <span style={{
            fontSize: 11, padding: '2px 7px', borderRadius: 8,
            background: 'rgba(255,255,255,0.06)', color: FM_COLORS.textSecondary,
          }}>
            {nodes.length} 个
          </span>
        </div>
        {/* 摘要徽章 */}
        <div style={{ display: 'flex', gap: 6 }}>
          {negCount > 0 && (
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, fontWeight: 600, background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
              ⚠ {negCount} 个风险
            </span>
          )}
          {posCount > 0 && (
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, fontWeight: 600, background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>
              ✓ {posCount} 个亮点
            </span>
          )}
        </div>
      </div>

      {/* 时间线列表 */}
      <div style={{ position: 'relative' }}>
        {/* 竖线 */}
        <div style={{
          position: 'absolute', left: 15, top: 6, bottom: 6,
          width: 2, background: `linear-gradient(to bottom, ${FM_COLORS.border}, transparent)`,
          borderRadius: 2,
        }} />

        {sorted.map((node, i) => {
          const cfg = NODE_CONFIG[node.type] ?? NODE_CONFIG.emotion;
          const snap = node.metrics_snapshot;
          const elapsedMin = snap?.elapsed_minutes != null ? Math.round(snap.elapsed_minutes) : null;
          const isLast = i === sorted.length - 1;

          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              paddingBottom: isLast ? 0 : 14,
              position: 'relative',
            }}>
              {/* 节点圆点 */}
              <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: cfg.bg, border: `2px solid ${cfg.border}`,
                fontSize: 14, zIndex: 1,
              }}>
                {cfg.emoji}
              </div>

              {/* 内容卡 */}
              <div style={{
                flex: 1, background: cfg.bg,
                border: `1px solid ${cfg.border}`,
                borderRadius: 12, padding: '10px 12px',
              }}>
                {/* 顶行：类型标签 + 第X手 + 权重 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
                  <span style={{ fontSize: 11, color: FM_COLORS.textSecondary }}>第 {node.hand_index} 手</span>
                  {elapsedMin != null && (
                    <span style={{ fontSize: 11, color: FM_COLORS.textSecondary }}>· {elapsedMin} 分钟时</span>
                  )}
                  <span style={{
                    marginLeft: 'auto', fontSize: 10, padding: '1px 6px', borderRadius: 6,
                    background: 'rgba(255,255,255,0.06)', color: FM_COLORS.textSecondary,
                  }}>
                    权重 ×{node.weight.toFixed(1)}
                  </span>
                </div>

                {/* 详情文字 */}
                <p style={{ fontSize: 12, color: FM_COLORS.textPrimary, margin: 0, lineHeight: 1.5 }}>
                  {node.detail}
                </p>

                {/* 快照数据行（有的话） */}
                {snap && (
                  <div style={{
                    display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap',
                  }}>
                    {[
                      { label: '当时净盈亏', value: `${snap.net_pnl >= 0 ? '+' : ''}${snap.net_pnl}` },
                      snap.current_loss_streak > 0 && { label: '连输', value: `${snap.current_loss_streak} 手` },
                      snap.current_win_streak > 0 && { label: '连赢', value: `${snap.current_win_streak} 手` },
                    ].filter(Boolean).map((item: any, j) => (
                      <span key={j} style={{ fontSize: 11, color: FM_COLORS.textSecondary }}>
                        {item.label}：<strong style={{ color: FM_COLORS.textPrimary }}>{item.value}</strong>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── P&L 走势图 ──

function PnLChart({ session }: { session: FMSession }) {
  const dataPoints: { hand: number; pnl: number; label: string }[] = [
    { hand: 0, pnl: 0, label: '起点' },
  ];
  let running = 0;
  let handNum = 0;
  for (const evt of session.events) {
    if (evt.event_type === 'win' && evt.amount !== undefined) {
      running += evt.amount;
      handNum++;
      dataPoints.push({ hand: handNum, pnl: running, label: `#${handNum} +${evt.amount}` });
    } else if (evt.event_type === 'loss' && evt.amount !== undefined) {
      running -= evt.amount;
      handNum++;
      dataPoints.push({ hand: handNum, pnl: running, label: `#${handNum} -${evt.amount}` });
    }
  }

  if (dataPoints.length < 2) return null;

  const maxPnl = Math.max(...dataPoints.map(d => d.pnl));
  const minPnl = Math.min(...dataPoints.map(d => d.pnl));
  const absMax = Math.max(Math.abs(maxPnl), Math.abs(minPnl), 1);
  // 上下留 20% 空间
  const yDomain: [number, number] = [
    Math.floor(minPnl - absMax * 0.2),
    Math.ceil(maxPnl + absMax * 0.2),
  ];

  const finalPnl = dataPoints[dataPoints.length - 1].pnl;

  return (
    <div style={{
      background: FM_COLORS.cardBg, borderRadius: 16,
      border: `1px solid ${FM_COLORS.border}`, padding: '16px 12px 12px',
      marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingLeft: 4 }}>
        <TrendingUp size={16} color={FM_COLORS.primary} />
        <span style={{ fontSize: 14, fontWeight: 700, color: FM_COLORS.textPrimary }}>P&L 走势</span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={dataPoints} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={FM_COLORS.border} />
          <XAxis
            dataKey="hand"
            tick={{ fontSize: 10, fill: FM_COLORS.textSecondary }}
            axisLine={{ stroke: FM_COLORS.border }}
            tickLine={false}
            label={{ value: '手数', position: 'insideBottomRight', offset: -2, fontSize: 10, fill: FM_COLORS.textSecondary }}
          />
          <YAxis
            domain={yDomain}
            tick={{ fontSize: 10, fill: FM_COLORS.textSecondary }}
            axisLine={{ stroke: FM_COLORS.border }}
            tickLine={false}
          />
          <Tooltip
            formatter={(value: number) => [`${value >= 0 ? '+' : ''}${value}`, 'P&L']}
            labelFormatter={(label: number) => `第 ${label} 手`}
            contentStyle={{
              borderRadius: 10, border: `1px solid ${FM_COLORS.border}`,
              fontSize: 12, background: FM_COLORS.cardBg, color: FM_COLORS.textPrimary,
            }}
          />
          <ReferenceLine y={0} stroke={FM_COLORS.textSecondary} strokeDasharray="4 4" strokeOpacity={0.5} />
          {/* 止损线 */}
          <ReferenceLine
            y={-session.plan.stop_loss_amount}
            stroke={FM_COLORS.danger}
            strokeDasharray="6 3"
            strokeOpacity={0.6}
            label={{ value: '止损', position: 'right', fontSize: 10, fill: FM_COLORS.danger }}
          />
          {/* 止盈线 */}
          {session.plan.take_profit_amount > 0 && (
            <ReferenceLine
              y={session.plan.take_profit_amount}
              stroke={FM_COLORS.profit}
              strokeDasharray="6 3"
              strokeOpacity={0.6}
              label={{ value: '止盈', position: 'right', fontSize: 10, fill: FM_COLORS.profit }}
            />
          )}
          <Line
            type="monotone"
            dataKey="pnl"
            stroke={finalPnl >= 0 ? FM_COLORS.profit : FM_COLORS.loss}
            strokeWidth={2.5}
            dot={{ r: 3, fill: '#fff', strokeWidth: 2, stroke: finalPnl >= 0 ? FM_COLORS.profit : FM_COLORS.loss }}
            activeDot={{ r: 5, fill: finalPnl >= 0 ? FM_COLORS.profit : FM_COLORS.loss }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── 本地生成函数 ──

function generateLocalSummary(
  _session: FMSession, metrics: FMMetrics, ruleAnalysis: FMRuleAnalysis[],
  sessionType: string, dimensionScores: import('../../types/fundManager').FMDimensionScores,
): string {
  const isProfit = metrics.net_pnl >= 0;
  const isShort = metrics.total_hands <= 10;
  const sections: string[] = [];

  // ── 场次定性 ──
  let opening = '';
  if (isShort) {
    opening = `本场仅进行 ${metrics.total_hands} 手操作，属于${sessionType}场次。`;
  } else {
    opening = `本场共 ${metrics.total_hands} 手，属于${sessionType}场次。`;
  }
  sections.push(opening);

  // ── 资金走势分析（不复述数据，解读含义） ──
  if (metrics.highest_profit > 0 && metrics.profit_giveback_rate > 50) {
    sections.push(`在最高盈利 ${metrics.highest_profit.toLocaleString()} 后出现 ${metrics.drawdown_from_peak.toLocaleString()} 回撤，回吐率 ${metrics.profit_giveback_rate}%，说明盈利保护策略${metrics.profit_giveback_rate > 100 ? '严重不足，盈利已转为亏损' : '尚未建立'}。`);
  } else if (metrics.highest_profit > 0 && isProfit) {
    if (metrics.profit_giveback_rate < 20) {
      sections.push(`盈利保持稳定，回吐率仅 ${metrics.profit_giveback_rate}%，说明利润管理较为合理。`);
    }
  } else if (metrics.deepest_loss < 0) {
    sections.push(`最大亏损 ${Math.abs(metrics.deepest_loss).toLocaleString()}，占操盘资金 ${Math.round(Math.abs(metrics.deepest_loss) / _session.plan.session_budget * 100)}%。`);
  }

  // ── 纪律执行总评（一句话） ──
  const violations = ruleAnalysis.filter(ra => ra.event_status === 'violation');
  if (violations.length === 0) {
    sections.push('整体纪律执行良好：无违规行为记录。');
  } else {
    const names = violations.map(v => v.rule_name).join('、');
    sections.push(`纪律方面存在 ${violations.length} 处违规：${names}。`);
  }

  // ── 最薄弱维度点评 ──
  const dims = [
    { name: '利润管理', score: dimensionScores.profit_management },
    { name: '风险控制', score: dimensionScores.risk_control },
    { name: '情绪控制', score: dimensionScores.emotion_control },
    { name: '纪律', score: dimensionScores.discipline },
  ];
  const weakest = dims.reduce((a, b) => a.score < b.score ? a : b);
  if (weakest.score < 70) {
    sections.push(`本场最需关注的维度是「${weakest.name}」（${weakest.score}分）。`);
  }

  return sections.join('\n');
}

function generateLocalAdvice(
  session: FMSession, metrics: FMMetrics, _score: number,
  _execution: { unauthorized_raise_count: number; plan_modification_count: number },
): string {
  const tips: string[] = [];

  // ── 盈利回吐问题 → 具体可执行建议 ──
  if (metrics.profit_giveback_rate > 50 && metrics.highest_profit > 0) {
    const suggestedLock = Math.round(metrics.highest_profit * 0.7);
    const suggestedFloor = Math.round(metrics.highest_profit * 0.5);
    tips.push(`本场盈利回吐率 ${metrics.profit_giveback_rate}%，说明盈利后缺乏锁盈保护。\n建议设置：\n• 盈利 ${suggestedLock.toLocaleString()} 启动锁盈\n• 回撤 ${Math.round(metrics.highest_profit * 0.3).toLocaleString()} 自动提醒\n• 最低保留盈利 ${suggestedFloor.toLocaleString()}`);
  }

  // ── 加码问题 → 具体规则 ──
  if (_execution.unauthorized_raise_count > 0) {
    tips.push(`本场 ${_execution.unauthorized_raise_count} 次加码超出上限。\n建议：\n• 亏损区严格禁止加码\n• 最大码量限制为基码的 2 倍（${(session.plan.base_unit * 2).toLocaleString()}）\n• 加码前先暂停 30 秒确认状态`);
  }

  // ── 连输问题 → 调整参数 ──
  if (metrics.max_loss_streak >= session.plan.stop_loss_streak_warn && metrics.net_pnl < 0) {
    const suggestedStreak = Math.max(3, session.plan.stop_loss_streak - 1);
    tips.push(`最大连输 ${metrics.max_loss_streak} 手时亏损已较严重。\n建议：\n• 连输手数止损从 ${session.plan.stop_loss_streak} 手调至 ${suggestedStreak} 手\n• 连输 ${Math.max(2, suggestedStreak - 1)} 手时降码至基码`);
  }

  // ── 回撤问题 → 回撤规则 ──
  if (metrics.drawdown_pct > 30 && metrics.highest_profit > 0) {
    const suggestedDrawdown = Math.round((session.plan.session_budget + metrics.highest_profit) * 0.2);
    tips.push(`最大回撤 ${metrics.drawdown_pct}%，超过安全阈值。\n建议添加自定义规则：\n• 回撤 ${suggestedDrawdown.toLocaleString()} 提醒\n• 回撤超 25% 强制降码`);
  }

  // ── 超时 ──
  if (metrics.elapsed_minutes > session.plan.max_duration_minutes) {
    tips.push(`超时 ${Math.round(metrics.elapsed_minutes - session.plan.max_duration_minutes)} 分钟。长时间操作判断力下降，建议设置闹钟提醒并严格执行。`);
  }

  if (tips.length === 0) {
    tips.push('本场整体表现良好，继续保持！\n可以考虑：\n• 复盘每手的决策思路\n• 记录下次想尝试的调整');
  }

  return tips.join('\n\n');
}
