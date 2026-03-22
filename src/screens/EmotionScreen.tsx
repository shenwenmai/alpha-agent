import React, { useState, useEffect } from 'react';
import { Activity, TrendingDown, TrendingUp, Zap, Clock, AlertTriangle, ArrowLeft } from 'lucide-react';
import { getEndedSessions } from '../services/fundManagerService';
import { detectTurningPoints } from '../services/turningPointEngine';
import { computeEmotion } from '../services/emotionEngine';
import { computeMetrics } from '../services/fundManagerEngine';
import type { FMSession } from '../types/fundManager';

interface EmotionScreenProps {
  onBack?: () => void;
}

interface SessionEmotionSummary {
  sessionIndex: number;
  date: string;
  finalScore: number;
  finalLevel: string;
  turningPoints: number;
  peakTilt: number;
  duration: number;
  collapsed: boolean;
}

const LEVEL_COLORS: Record<string, string> = {
  calm: '#22C55E',
  mild: '#E6B800',
  moderate: '#FF8C00',
  severe: '#FF4444',
};

const LEVEL_LABELS: Record<string, string> = {
  calm: '平静',
  mild: '注意',
  moderate: '警惕',
  severe: '危险',
};

export default function EmotionScreen({ onBack }: EmotionScreenProps) {
  const [summaries, setSummaries] = useState<SessionEmotionSummary[]>([]);
  const [stats, setStats] = useState({
    avgScore: 0,
    collapseRate: 0,
    avgTurningPoints: 0,
    mostCommonTrigger: '',
    calmSessions: 0,
    totalSessions: 0,
  });

  useEffect(() => {
    const sessions = getEndedSessions();
    if (!sessions.length) return;

    const triggerCounts: Record<string, number> = {};
    const results: SessionEmotionSummary[] = [];

    sessions.slice(-20).forEach((s: FMSession, i: number) => {
      const metrics = computeMetrics(s);
      const emotion = computeEmotion(s, metrics);
      const tps = detectTurningPoints(s);

      tps.forEach(tp => {
        const trigger = tp.triggerEvent?.event_type || 'unknown';
        triggerCounts[trigger] = (triggerCounts[trigger] || 0) + 1;
      });

      results.push({
        sessionIndex: i + 1,
        date: s.start_time ? new Date(s.start_time).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) : `#${i + 1}`,
        finalScore: emotion.score,
        finalLevel: emotion.level,
        turningPoints: tps.length,
        peakTilt: emotion.score,
        duration: metrics.elapsed_minutes || 0,
        collapsed: emotion.level === 'severe',
      });
    });

    setSummaries(results);

    const totalSessions = results.length;
    const avgScore = totalSessions > 0 ? Math.round(results.reduce((a, b) => a + b.finalScore, 0) / totalSessions) : 0;
    const collapseRate = totalSessions > 0 ? Math.round(results.filter(r => r.collapsed).length / totalSessions * 100) : 0;
    const avgTP = totalSessions > 0 ? +(results.reduce((a, b) => a + b.turningPoints, 0) / totalSessions).toFixed(1) : 0;
    const calmSessions = results.filter(r => r.finalLevel === 'calm').length;

    const topTrigger = Object.entries(triggerCounts).sort((a, b) => b[1] - a[1])[0];

    setStats({
      avgScore,
      collapseRate,
      avgTurningPoints: avgTP,
      mostCommonTrigger: topTrigger ? topTrigger[0] : '无',
      calmSessions,
      totalSessions,
    });
  }, []);

  if (summaries.length === 0) {
    return (
      <div style={{ padding: '40px 24px', color: '#888' }}>
        {onBack && (
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, marginBottom: 24 }}>
            <ArrowLeft size={20} color="#fff" />
          </button>
        )}
        <div style={{ textAlign: 'center' }}>
          <Activity size={48} strokeWidth={1.5} style={{ marginBottom: 16, opacity: 0.4 }} />
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>暂无情绪数据</div>
          <div style={{ fontSize: 13 }}>完成第一场实战后，情绪追踪数据将在这里显示</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 16px 20px', maxWidth: 480, margin: '0 auto' }}>
      {/* 标题栏 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        {onBack && (
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <ArrowLeft size={20} color="#fff" />
          </button>
        )}
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: 0 }}>情绪追踪</h1>
          <p style={{ fontSize: 13, color: '#888', marginTop: 4 }}>了解你的情绪模式，预防失控</p>
        </div>
      </div>

      {/* 总览卡片 */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20,
      }}>
        <StatBox label="平均情绪分" value={`${stats.avgScore}`} color={stats.avgScore < 30 ? '#22C55E' : stats.avgScore < 50 ? '#E6B800' : '#FF4444'} />
        <StatBox label="崩盘率" value={`${stats.collapseRate}%`} color={stats.collapseRate > 30 ? '#FF4444' : '#22C55E'} />
        <StatBox label="平静场次" value={`${stats.calmSessions}/${stats.totalSessions}`} color="#22C55E" />
      </div>

      {/* 洞察卡片 */}
      <div style={{
        background: '#1F1F1F', borderRadius: 14, padding: 16, marginBottom: 20,
        border: '1px solid #2A2A2A',
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Zap size={16} color="#E6B800" /> 情绪洞察
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <InsightRow
            icon={<AlertTriangle size={14} />}
            text={`平均每场 ${stats.avgTurningPoints} 个转折点`}
            color={stats.avgTurningPoints > 2 ? '#FF8C00' : '#22C55E'}
          />
          <InsightRow
            icon={<TrendingDown size={14} />}
            text={`最常见触发：${stats.mostCommonTrigger}`}
            color="#E6B800"
          />
          <InsightRow
            icon={<TrendingUp size={14} />}
            text={stats.collapseRate <= 20 ? '情绪控制良好，继续保持' : stats.collapseRate <= 40 ? '崩盘率偏高，注意止损纪律' : '崩盘率过高，建议降低基码'}
            color={stats.collapseRate <= 20 ? '#22C55E' : '#FF8C00'}
          />
        </div>
      </div>

      {/* 情绪时间线 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 12 }}>
          近期情绪走势
        </div>

        {/* SVG 折线图 */}
        <div style={{ background: '#1F1F1F', borderRadius: 14, padding: '16px 12px', border: '1px solid #2A2A2A' }}>
          <svg viewBox="0 0 320 120" style={{ width: '100%', height: 120 }}>
            {/* 参考线 */}
            <line x1="0" y1="30" x2="320" y2="30" stroke="rgba(255,255,255,0.08)" strokeDasharray="4" />
            <line x1="0" y1="66" x2="320" y2="66" stroke="rgba(255,255,255,0.08)" strokeDasharray="4" />
            <text x="2" y="27" fill="#666" fontSize="9">危险</text>
            <text x="2" y="63" fill="#666" fontSize="9">警惕</text>
            <text x="2" y="110" fill="#666" fontSize="9">平静</text>

            {/* 折线 */}
            {summaries.length > 1 && (
              <polyline
                fill="none"
                stroke="#E6B800"
                strokeWidth="2"
                points={summaries.map((s, i) => {
                  const x = 30 + (i / (summaries.length - 1)) * 280;
                  const y = 110 - (s.finalScore / 100) * 100;
                  return `${x},${y}`;
                }).join(' ')}
              />
            )}

            {/* 数据点 */}
            {summaries.map((s, i) => {
              const x = summaries.length === 1 ? 160 : 30 + (i / (summaries.length - 1)) * 280;
              const y = 110 - (s.finalScore / 100) * 100;
              return (
                <g key={i}>
                  <circle cx={x} cy={y} r={s.collapsed ? 5 : 3.5} fill={LEVEL_COLORS[s.finalLevel] || '#666'} />
                  {s.collapsed && <circle cx={x} cy={y} r={8} fill="none" stroke="#FF4444" strokeWidth="1.5" opacity="0.5" />}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* 场次列表 */}
      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 12 }}>
        场次详情
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[...summaries].reverse().map((s, i) => (
          <div key={i} style={{
            background: '#1F1F1F', borderRadius: 12, padding: '12px 14px',
            border: '1px solid #2A2A2A',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
                第{s.sessionIndex}场 · {s.date}
              </div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 2, display: 'flex', gap: 8 }}>
                <span><Clock size={10} /> {s.duration}分钟</span>
                {s.turningPoints > 0 && <span><Zap size={10} /> {s.turningPoints}个转折</span>}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontSize: 13, fontWeight: 700,
                color: LEVEL_COLORS[s.finalLevel] || '#888',
              }}>
                {LEVEL_LABELS[s.finalLevel] || s.finalLevel}
              </div>
              <div style={{ fontSize: 11, color: '#666' }}>
                {s.finalScore}分
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      background: '#1F1F1F', borderRadius: 12, padding: '12px 8px', textAlign: 'center',
      border: '1px solid #2A2A2A',
    }}>
      <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function InsightRow({ icon, text, color }: { icon: React.ReactNode; text: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color }}>
      {icon}
      <span style={{ fontSize: 13 }}>{text}</span>
    </div>
  );
}
