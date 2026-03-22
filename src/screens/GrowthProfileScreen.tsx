import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Card, Badge, ProfileStatCard, Button } from '../components/ui';
import { getEndedSessions } from '../services/fundManagerService';
import { generateProfile } from '../services/growthEngine';
import { analyzePatterns } from '../services/turningPointEngine';
import { computeMetrics } from '../services/fundManagerEngine';
import { computeEmotion } from '../services/emotionEngine';
import { theme } from '../theme';
import type { FMSession } from '../types/fundManager';

// 从 growthEngine 推导类型
type GrowthProfile = ReturnType<typeof generateProfile>;
type TurningPointPattern = ReturnType<typeof analyzePatterns>[number];

interface GrowthProfileScreenProps {
  onBack: () => void;
}

const riskBadgeVariant: Record<string, 'warning' | 'danger'> = {
  medium: 'warning',
  high: 'danger',
};

export default function GrowthProfileScreen({ onBack }: GrowthProfileScreenProps) {
  const [profile, setProfile] = useState<GrowthProfile | null>(null);
  const [patterns, setPatterns] = useState<TurningPointPattern[]>([]);
  const [endedSessions, setEndedSessions] = useState<FMSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sessions = getEndedSessions();
    setEndedSessions(sessions);
    if (sessions.length >= 1) {
      const p = generateProfile(sessions);
      setProfile(p);
      setPatterns(analyzePatterns(sessions));
    }
    setLoading(false);
  }, []);

  const trendMap: Record<string, 'up' | 'down' | 'flat'> = {
    improving: 'up',
    declining: 'down',
    stable: 'flat',
  };

  return (
    <div style={{
      backgroundColor: theme.colors.bg,
      color: theme.colors.white,
      paddingBottom: 20,
    }}>
      {/* 顶栏 */}
      <div style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 14px)',
        paddingLeft: 16, paddingRight: 16, paddingBottom: 14,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button
          className="clickable"
          onClick={onBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
        >
          <ArrowLeft size={20} color={theme.colors.white} />
        </button>
        <div>
          <h2 style={{
            fontSize: theme.fontSize.title, fontWeight: 700,
            margin: 0, color: theme.colors.white,
          }}>
            成长画像
          </h2>
          <p style={{
            fontSize: theme.fontSize.caption, color: theme.colors.gray,
            margin: 0,
          }}>
            了解你自己，成为更好的玩家
          </p>
        </div>
      </div>

      <div style={{ padding: '0 16px' }}>
        {loading ? (
          <div style={{
            textAlign: 'center', padding: 60,
            color: theme.colors.gray, fontSize: theme.fontSize.small,
          }}>
            加载中...
          </div>
        ) : !profile ? (
          /* 数据不足提示 */
          <div style={{
            textAlign: 'center', padding: '60px 20px',
            background: theme.colors.card,
            borderRadius: theme.radius.md,
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
            <p style={{
              fontSize: theme.fontSize.body, fontWeight: 600,
              color: theme.colors.white, margin: '0 0 8px',
            }}>
              完成第一场实战后即可生成画像
            </p>
            <p style={{
              fontSize: theme.fontSize.small, color: theme.colors.gray,
              margin: '0 0 24px', lineHeight: 1.5,
            }}>
              继续使用资金管家记录你的实战，系统会自动分析你的行为模式
            </p>
            <Button variant="primary" onClick={onBack}>
              返回管家
            </Button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.lg }}>

            {/* 统计卡片区 2x2 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: theme.spacing.md,
            }}>
              <ProfileStatCard
                icon="🎯"
                value={profile.totalSessions}
                label="总场次数"
              />
              <ProfileStatCard
                icon="📊"
                value={profile.avgDisciplineScore}
                label="平均纪律分"
                trend={trendMap[profile.disciplineTrend]}
              />
              <ProfileStatCard
                icon="🃏"
                value={profile.totalHands}
                label="总手数"
              />
              <ProfileStatCard
                icon="⏱️"
                value={profile.turningPointSummary.avgTimeToFirstTilt > 0
                  ? `${Math.round(profile.turningPointSummary.avgTimeToFirstTilt)}分`
                  : '—'}
                label="平均首次转折时间"
              />
            </div>

            {/* 纪律分趋势图 */}
            {profile.totalSessions >= 2 && (
              <Card title="纪律分趋势">
                <DisciplineTrendChart sessions={endedSessions} />
              </Card>
            )}

            {/* 最佳基码推荐 */}
            <Card title="最佳基码推荐">
              <div style={{
                display: 'flex', flexDirection: 'column', gap: theme.spacing.sm,
              }}>
                <div style={{
                  fontSize: theme.fontSize.hero, fontWeight: 800,
                  color: theme.colors.gold,
                }}>
                  推荐基码 ¥{profile.optimalBaseUnit.recommended}
                </div>
                <div style={{
                  fontSize: theme.fontSize.small, color: theme.colors.gray,
                }}>
                  安全区间 ¥{profile.optimalBaseUnit.range[0]}-{profile.optimalBaseUnit.range[1]}
                </div>
                <div style={{
                  fontSize: theme.fontSize.caption, color: theme.colors.gray,
                  lineHeight: 1.5, marginTop: 4,
                }}>
                  {profile.optimalBaseUnit.reasoning}
                </div>
              </div>
            </Card>

            {/* 危险时段分析 */}
            {(profile.dangerZones.timeWindows.length > 0 ||
              profile.dangerZones.lossThresholds.length > 0 ||
              profile.dangerZones.streakThresholds.length > 0) && (
              <Card title="危险时段分析">
                <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
                  {profile.dangerZones.timeWindows.map((tw, i) => (
                    <div key={`tw-${i}`} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: `${theme.spacing.sm}px 0`,
                      borderBottom: `1px solid ${theme.colors.border}`,
                    }}>
                      <div>
                        <div style={{ fontSize: theme.fontSize.small, color: theme.colors.white }}>
                          第 {tw.startMinute}-{tw.endMinute} 分钟
                        </div>
                        <div style={{ fontSize: theme.fontSize.caption, color: theme.colors.gray }}>
                          高危时间窗口
                        </div>
                      </div>
                      <Badge variant={riskBadgeVariant[tw.riskLevel] || 'warning'}>
                        {tw.riskLevel === 'high' ? '高危' : '中等'}
                      </Badge>
                    </div>
                  ))}
                  {profile.dangerZones.lossThresholds.map((lt, i) => (
                    <div key={`lt-${i}`} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: `${theme.spacing.sm}px 0`,
                      borderBottom: `1px solid ${theme.colors.border}`,
                    }}>
                      <div>
                        <div style={{ fontSize: theme.fontSize.small, color: theme.colors.white }}>
                          亏损 ¥{lt.amount} 时
                        </div>
                        <div style={{ fontSize: theme.fontSize.caption, color: theme.colors.gray }}>
                          亏损阈值
                        </div>
                      </div>
                      <Badge variant={riskBadgeVariant[lt.riskLevel] || 'warning'}>
                        {lt.riskLevel === 'high' ? '高危' : '中等'}
                      </Badge>
                    </div>
                  ))}
                  {profile.dangerZones.streakThresholds.map((st, i) => (
                    <div key={`st-${i}`} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: `${theme.spacing.sm}px 0`,
                      borderBottom: `1px solid ${theme.colors.border}`,
                    }}>
                      <div>
                        <div style={{ fontSize: theme.fontSize.small, color: theme.colors.white }}>
                          连败 {st.streak} 手后
                        </div>
                        <div style={{ fontSize: theme.fontSize.caption, color: theme.colors.gray }}>
                          连败阈值
                        </div>
                      </div>
                      <Badge variant={riskBadgeVariant[st.riskLevel] || 'warning'}>
                        {st.riskLevel === 'high' ? '高危' : '中等'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* 常见错误模式 */}
            {profile.commonErrors.length > 0 && (
              <div>
                <div style={{
                  fontSize: theme.fontSize.small, fontWeight: 600,
                  color: theme.colors.gray, marginBottom: theme.spacing.md,
                }}>
                  常见错误模式
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
                  {profile.commonErrors
                    .sort((a, b) => b.frequency - a.frequency)
                    .map((err, i) => (
                      <Card key={i}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs }}>
                          <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          }}>
                            <span style={{
                              fontSize: theme.fontSize.body, fontWeight: 600,
                              color: theme.colors.white,
                            }}>
                              {err.type}
                            </span>
                            <Badge variant="gold">出现 {err.frequency} 次</Badge>
                          </div>
                          <div style={{
                            fontSize: theme.fontSize.small, color: theme.colors.gray,
                            lineHeight: 1.5,
                          }}>
                            {err.description}
                          </div>
                          <div style={{
                            fontSize: theme.fontSize.caption, color: theme.colors.gold,
                            lineHeight: 1.5,
                          }}>
                            建议：{err.suggestion}
                          </div>
                        </div>
                      </Card>
                    ))}
                </div>
              </div>
            )}

            {/* 情绪转折点规律 */}
            {patterns.length > 0 && (
              <div>
                <div style={{
                  fontSize: theme.fontSize.small, fontWeight: 600,
                  color: theme.colors.gray, marginBottom: theme.spacing.md,
                }}>
                  情绪转折点规律
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
                  {patterns.map((p, i) => (
                    <Card key={i}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
                        <div style={{
                          fontSize: theme.fontSize.body, fontWeight: 600,
                          color: theme.colors.white, lineHeight: 1.5,
                        }}>
                          {p.description}
                        </div>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: theme.spacing.sm,
                        }}>
                          <Badge variant="gold">
                            置信度 {Math.round(p.confidence * 100)}%
                          </Badge>
                          <Badge variant="default">
                            {p.occurrences}/{p.totalSessions} 场
                          </Badge>
                        </div>
                        <div style={{
                          fontSize: theme.fontSize.caption, color: theme.colors.gold,
                          lineHeight: 1.5,
                        }}>
                          {p.recommendation}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 纪律分趋势 SVG 图 ──

function DisciplineTrendChart({ sessions }: { sessions: FMSession[] }) {
  if (sessions.length < 2) return null;

  const recent = sessions.slice(-15);
  const data = recent.map((s, i) => {
    const metrics = computeMetrics(s);
    const emotion = computeEmotion(s, metrics);
    // 纪律分：review 有就用，没有就从 metrics 推算
    const score = s.review?.discipline_score ?? Math.max(0, 100 - (emotion.score > 50 ? 30 : 0) - (metrics.net_pnl < 0 ? 15 : 0));
    const date = s.start_time
      ? new Date(s.start_time).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
      : `#${i + 1}`;
    return { score, date, collapsed: emotion.level === 'severe' };
  });

  const W = 320, H = 140;
  const PAD = { top: 16, right: 12, bottom: 28, left: 32 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;
  const n = data.length;
  const xStep = cW / Math.max(1, n - 1);

  const points = data.map((d, i) => ({
    x: PAD.left + i * xStep,
    y: PAD.top + cH - (d.score / 100) * cH,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  // 渐变区域
  const areaPath = `${linePath} L${points[points.length - 1].x},${PAD.top + cH} L${points[0].x},${PAD.top + cH} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      <defs>
        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={theme.colors.gold} stopOpacity="0.3" />
          <stop offset="100%" stopColor={theme.colors.gold} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* 参考线 */}
      {[25, 50, 75, 100].map(v => {
        const y = PAD.top + cH - (v / 100) * cH;
        return (
          <g key={v}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
              stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
            <text x={PAD.left - 4} y={y + 3} textAnchor="end"
              fill="#666" fontSize={8}>{v}</text>
          </g>
        );
      })}

      {/* 渐变区域 */}
      <path d={areaPath} fill="url(#trendFill)" />

      {/* 折线 */}
      <path d={linePath} fill="none" stroke={theme.colors.gold} strokeWidth={2} />

      {/* 数据点 */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={data[i].collapsed ? 5 : 3.5}
            fill={data[i].collapsed ? theme.colors.danger : theme.colors.gold}
            stroke="#1F1F1F" strokeWidth={2} />
          {data[i].collapsed && (
            <text x={p.x} y={p.y - 8} textAnchor="middle"
              fill={theme.colors.danger} fontSize={8} fontWeight={700}>崩</text>
          )}
          {/* X 轴日期（间隔显示） */}
          {(n <= 7 || i % Math.ceil(n / 7) === 0 || i === n - 1) && (
            <text x={p.x} y={H - 4} textAnchor="middle"
              fill="#666" fontSize={7}>{data[i].date}</text>
          )}
        </g>
      ))}

      <text x={W - PAD.right} y={PAD.top - 4} textAnchor="end"
        fill="#888" fontSize={8}>纪律分</text>
    </svg>
  );
}
