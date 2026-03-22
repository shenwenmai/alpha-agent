import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  ArrowLeft, Zap, AlertTriangle, Clock, TrendingDown, Activity,
  ChevronRight, Shield, ArrowUpRight, Layers, RotateCcw,
} from 'lucide-react';
import { theme } from '../theme';
import {
  getEmotionPreset, getDefaultEmotionProfile, loadEmotionProfile,
} from '../services/emotionEngine';
import { generateETPSuggestions, generateETPSuggestionsCloud } from '../services/etpSuggestionEngine';
import type { ETPHealthReport } from '../services/etpSuggestionEngine';
import type { EmotionProfile, EmotionSensitivity } from '../types/fundManager';
import { getSettings, updateSettings } from '../services/fundManagerService';

// ============================================================
// 关键时刻 — 情绪转折点（ETP）专属页面
// 业界首套 · 单点引爆概念教育 + 品牌宣言 + 参数设定
// ============================================================

interface KeyMomentScreenProps {
  onBack: () => void;
  onStartPlan?: () => void;
}

const C = {
  bg: theme.colors.bg,
  card: '#141414',
  cardBorder: 'rgba(255,255,255,0.06)',
  gold: '#F59E0B',
  red: '#EF4444',
  green: '#22C55E',
  blue: '#60A5FA',
  purple: '#A78BFA',
  orange: '#F97316',
  orangeRed: '#FB7185',
  sub: '#888',
  white: '#fff',
  dimWhite: 'rgba(255,255,255,0.7)',
};

export default function KeyMomentScreen({ onBack, onStartPlan }: KeyMomentScreenProps) {
  const settings = getSettings();
  const [profile, setProfile] = useState<EmotionProfile>(() => ({
    ...getDefaultEmotionProfile(),
    ...settings.emotion_profile,
  }));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const localReport = useMemo(() => generateETPSuggestions(profile), [profile]);
  const [healthReport, setHealthReport] = useState<ETPHealthReport>(localReport);

  useEffect(() => {
    setHealthReport(localReport);
    generateETPSuggestionsCloud(profile).then(cloudReport => {
      if (cloudReport.sessions_analyzed > localReport.sessions_analyzed) {
        setHealthReport(cloudReport);
      }
    }).catch(() => { /* 云端不可用，保持本地 */ });
  }, [profile, localReport]);

  const updateParam = useCallback((key: keyof EmotionProfile, value: number) => {
    setProfile(prev => {
      const next = { ...prev, [key]: value };
      loadEmotionProfile(next);
      updateSettings({ emotion_profile: next });
      return next;
    });
  }, []);

  const adoptSuggestion = useCallback((param: string, value: number) => {
    updateParam(param as keyof EmotionProfile, value);
  }, [updateParam]);

  const adoptAll = useCallback(() => {
    let updated = { ...profile };
    for (const s of healthReport.suggestions) {
      (updated as any)[s.param] = s.suggested_value;
    }
    setProfile(updated);
    loadEmotionProfile(updated);
    updateSettings({ emotion_profile: updated });
  }, [profile, healthReport]);

  const handleConfirm = useCallback(() => {
    loadEmotionProfile(profile);
    updateSettings({ emotion_profile: profile });
    setConfirmed(true);
  }, [profile]);

  // ── 确认后的状态 ──
  if (confirmed) {
    return (
      <div style={{
        background: C.bg, color: C.white,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 32, textAlign: 'center',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'rgba(34,197,94,0.15)', border: `2px solid ${C.green}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 20,
        }}>
          <Shield size={28} color={C.green} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 900, margin: '0 0 8px' }}>情绪防线已生效</h2>
        <p style={{ fontSize: 14, color: C.sub, lineHeight: 1.8, margin: '0 0 8px', maxWidth: 300 }}>
          从现在起，每一场实战系统都会监测你的情绪转折点。
        </p>
        <div style={{
          background: C.card, borderRadius: 16, padding: 16, margin: '16px 0 24px',
          border: `1px solid ${C.cardBorder}`, textAlign: 'left', width: '100%', maxWidth: 320,
        }}>
          <div style={{ fontSize: 12, color: C.sub, marginBottom: 10 }}>你的防线参数：</div>
          <ConfirmLine label="连输预警" value={`${profile.etp_loss_streak} 手`} />
          <ConfirmLine label="缠斗预警" value={`${profile.etp_stagnation} 手`} />
          <ConfirmLine label="时间预警" value={`${profile.etp_duration} 分钟`} />
          <ConfirmLine label="连输加注预警" value={`连输 ${profile.loss_raise_streak ?? 2} 手后加注`} />
          <ConfirmLine label="盈利回撤预警" value={`回撤 ${profile.giveback_alert_pct ?? 80}%`} />
        </div>
        <p style={{ fontSize: 12, color: C.sub, margin: '0 0 24px' }}>
          随时可回到这里调整参数
        </p>
        <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 320 }}>
          <button
            onClick={onBack}
            style={{
              flex: 1, padding: '14px', borderRadius: 14,
              border: `1px solid ${C.cardBorder}`, background: 'transparent',
              color: C.sub, fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            返回
          </button>
          {onStartPlan && (
            <button
              onClick={onStartPlan}
              style={{
                flex: 2, padding: '14px', borderRadius: 14, border: 'none',
                background: `linear-gradient(135deg, ${C.red}, #DC2626)`,
                color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}
            >
              开始实战，启用保护
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: C.bg, color: C.white, paddingBottom: 20 }}>
      {/* ═══ 顶栏 ═══ */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px 12px', position: 'sticky', top: 0,
        background: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(12px)',
        zIndex: 10, borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
        <button onClick={onBack} style={{
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10, cursor: 'pointer', padding: '6px 8px',
          display: 'flex', alignItems: 'center',
        }}>
          <ArrowLeft size={18} color={C.white} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Zap size={15} color={C.red} />
          <h1 style={{ fontSize: 17, fontWeight: 900, margin: 0, letterSpacing: 1.5, color: C.white }}>
            关键时刻
          </h1>
        </div>
      </div>

      <div style={{ padding: '0 16px' }}>

        {/* ═══════════════════════════════════
            Section 1 — 品牌宣言
        ═══════════════════════════════════ */}
        <section style={{
          background: C.card, borderRadius: 20, padding: '16px 16px 14px', marginBottom: 16,
          border: `1px solid ${C.cardBorder}`, position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: -20, right: -20,
            width: 100, height: 100, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 70%)',
          }} />

          {/* 品牌标题行 */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.28)',
                color: C.gold, letterSpacing: 0.5,
              }}>首创</span>
            </div>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: C.gold, margin: 0, letterSpacing: 0.5 }}>
              情绪转折点追踪系统
            </h2>
          </div>

          {/* 叙述文案 — 紧凑版 */}
          <p style={{ fontSize: 13, color: C.dimWhite, lineHeight: 1.65, margin: '0 0 6px' }}>
            每一场崩盘清袋，都不是突然发生的。它总是藏在一个极难察觉的<strong style={{ color: C.red }}>临界点</strong>里——前一局你还在按计划打，下一秒情绪已经接管了操作。
          </p>
          <p style={{ fontSize: 13, color: C.dimWhite, lineHeight: 1.65, margin: '0 0 12px' }}>
            我们把这个临界点叫做<strong style={{ color: C.red }}>情绪转折点（ETP）</strong>。抓住它，能在失控前刹车；放任它，结局往往是<strong style={{ color: C.red }}>崩盘清袋</strong>。
          </p>

          {/* SVG — 逐手柱状动画（与首页一致） */}
          <div style={{
            background: '#0d0d0d', borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.06)', marginBottom: 10, overflow: 'hidden',
          }}>
            <svg viewBox="0 0 300 120" style={{ width: '100%', height: 110 }} preserveAspectRatio="xMidYMid meet">
              {/* 网格线 */}
              {([18, 46, 75, 95] as number[]).map(y => (
                <line key={y} x1={4} y1={y} x2={296} y2={y}
                  stroke="rgba(255,255,255,0.04)" strokeWidth="0.6" strokeDasharray="3,6" />
              ))}
              {/* 零线 */}
              <line x1={4} y1={52} x2={296} y2={52} stroke="rgba(255,255,255,0.15)" strokeWidth="0.8" />

              {/* Bar 1 — 赢 h=26 */}
              <rect x={8} y={52} width={13} height={0} fill="#22C55E" rx={1} opacity={0.88}>
                <animate attributeName="height" values="0;0;26;26;0" keyTimes="0;0.028;0.056;0.944;1" dur="18s" repeatCount="indefinite"/>
                <animate attributeName="y" values="52;52;26;26;52" keyTimes="0;0.028;0.056;0.944;1" dur="18s" repeatCount="indefinite"/>
              </rect>
              {/* Bar 2 — 输 h=20 */}
              <rect x={30} y={52} width={13} height={0} fill="#EF4444" rx={1} opacity={0.82}>
                <animate attributeName="height" values="0;0;20;20;0" keyTimes="0;0.072;0.100;0.944;1" dur="18s" repeatCount="indefinite"/>
              </rect>
              {/* Bar 3 — 赢 h=30 */}
              <rect x={52} y={52} width={13} height={0} fill="#22C55E" rx={1} opacity={0.88}>
                <animate attributeName="height" values="0;0;30;30;0" keyTimes="0;0.117;0.144;0.944;1" dur="18s" repeatCount="indefinite"/>
                <animate attributeName="y" values="52;52;22;22;52" keyTimes="0;0.117;0.144;0.944;1" dur="18s" repeatCount="indefinite"/>
              </rect>
              {/* Bar 4 — 输 h=17 */}
              <rect x={74} y={52} width={13} height={0} fill="#EF4444" rx={1} opacity={0.82}>
                <animate attributeName="height" values="0;0;17;17;0" keyTimes="0;0.161;0.189;0.944;1" dur="18s" repeatCount="indefinite"/>
              </rect>
              {/* Bar 5 — 赢 h=24 */}
              <rect x={96} y={52} width={13} height={0} fill="#22C55E" rx={1} opacity={0.88}>
                <animate attributeName="height" values="0;0;24;24;0" keyTimes="0;0.206;0.233;0.944;1" dur="18s" repeatCount="indefinite"/>
                <animate attributeName="y" values="52;52;28;28;52" keyTimes="0;0.206;0.233;0.944;1" dur="18s" repeatCount="indefinite"/>
              </rect>
              {/* Bar 6 — 输 h=11 缠斗 */}
              <rect x={118} y={52} width={13} height={0} fill="#EF4444" rx={1} opacity={0.70}>
                <animate attributeName="height" values="0;0;11;11;0" keyTimes="0;0.250;0.278;0.944;1" dur="18s" repeatCount="indefinite"/>
              </rect>
              {/* Bar 7 — 赢 h=10 缠斗 */}
              <rect x={140} y={52} width={13} height={0} fill="#22C55E" rx={1} opacity={0.70}>
                <animate attributeName="height" values="0;0;10;10;0" keyTimes="0;0.289;0.317;0.944;1" dur="18s" repeatCount="indefinite"/>
                <animate attributeName="y" values="52;52;42;42;52" keyTimes="0;0.289;0.317;0.944;1" dur="18s" repeatCount="indefinite"/>
              </rect>
              {/* Bar 8 — 输 h=13 缠斗 */}
              <rect x={162} y={52} width={13} height={0} fill="#EF4444" rx={1} opacity={0.70}>
                <animate attributeName="height" values="0;0;13;13;0" keyTimes="0;0.328;0.356;0.944;1" dur="18s" repeatCount="indefinite"/>
              </rect>
              {/* Bar 9 — 输 h=18 连输 */}
              <rect x={184} y={52} width={13} height={0} fill="#EF4444" rx={1} opacity={0.86}>
                <animate attributeName="height" values="0;0;18;18;0" keyTimes="0;0.367;0.394;0.944;1" dur="18s" repeatCount="indefinite"/>
              </rect>
              {/* Bar 10 — 输 h=15 ETP触发 */}
              <rect x={206} y={52} width={13} height={0} fill="#EF4444" rx={1} opacity={0.92}>
                <animate attributeName="height" values="0;0;15;15;0" keyTimes="0;0.406;0.433;0.944;1" dur="18s" repeatCount="indefinite"/>
              </rect>
              {/* Bar 11 — 输 h=30 追损 */}
              <rect x={228} y={52} width={13} height={0} fill="#EF4444" rx={1} opacity={0.96}>
                <animate attributeName="height" values="0;0;30;30;0" keyTimes="0;0.461;0.489;0.944;1" dur="18s" repeatCount="indefinite"/>
              </rect>
              {/* Bar 12 — 光晕 */}
              <rect x={248} y={52} width={22} height={0} fill="rgba(239,68,68,0.18)" rx={2}>
                <animate attributeName="height" values="0;0;65;65;0" keyTimes="0;0.517;0.711;0.944;1" dur="18s" repeatCount="indefinite"/>
              </rect>
              {/* Bar 12 — 主柱 h=62 整场失控 */}
              <rect x={250} y={52} width={16} height={0} fill="#EF4444" rx={1}>
                <animate attributeName="height" values="0;0;62;62;0" keyTimes="0;0.517;0.711;0.944;1" dur="18s" repeatCount="indefinite"/>
              </rect>

              {/* 情绪转折点 标签 */}
              <g opacity="0">
                <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.433;0.478;0.944;1" dur="18s" repeatCount="indefinite"/>
                <line x1={212} y1={26} x2={212} y2={51} stroke="#F59E0B" strokeWidth="0.8" strokeDasharray="2,2" opacity={0.55}/>
                <rect x={152} y={14} width={72} height={12} rx={4}
                  fill="rgba(245,158,11,0.14)" stroke="rgba(245,158,11,0.50)" strokeWidth="0.7"/>
                <text x={188} y={22.5} fontSize="8" fill="#F59E0B"
                  textAnchor="middle" fontWeight="800" letterSpacing="0.5">情绪转折点</text>
              </g>

              {/* 整场失控 标签 */}
              <g opacity="0">
                <animate attributeName="opacity" values="0;0;0;1;1;0" keyTimes="0;0.517;0.611;0.650;0.944;1" dur="18s" repeatCount="indefinite"/>
                <line x1={258} y1={36} x2={258} y2={51} stroke="#EF4444" strokeWidth="0.8" opacity={0.55}/>
                <rect x={232} y={25} width={52} height={11} rx={3}
                  fill="rgba(239,68,68,0.14)" stroke="rgba(239,68,68,0.50)" strokeWidth="0.7"/>
                <text x={258} y={33} fontSize="8" fill="#EF4444"
                  textAnchor="middle" fontWeight="800" letterSpacing="0.3">整场失控</text>
              </g>
            </svg>
          </div>

          {/* 状态流转 — L型布局，避免手机换行错位 */}
          <div style={{ marginTop: 6 }}>
            {/* 第一行：正常 → 监测中 → 转折点 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              <div style={{ padding: '5px 11px', borderRadius: 9, background: 'rgba(34,197,94,0.08)', border: '1.5px solid rgba(34,197,94,0.38)', fontSize: 11, fontWeight: 700, color: C.green, whiteSpace: 'nowrap' }}>正常</div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 2px' }}>
                <span style={{ fontSize: 8, color: '#555', whiteSpace: 'nowrap' }}>条件蓄能</span>
                <ChevronRight size={12} color="#444" />
              </div>
              <div style={{ padding: '5px 11px', borderRadius: 9, background: 'rgba(245,158,11,0.08)', border: '1.5px solid rgba(245,158,11,0.38)', fontSize: 11, fontWeight: 700, color: C.gold, whiteSpace: 'nowrap' }}>监测中</div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 2px' }}>
                <span style={{ fontSize: 8, color: '#555', whiteSpace: 'nowrap' }}>行为引爆</span>
                <ChevronRight size={12} color="#444" />
              </div>
              <div style={{ padding: '5px 11px', borderRadius: 9, background: 'rgba(255,140,0,0.18)', border: '1.5px solid #FF8C00', fontSize: 11, fontWeight: 700, color: '#FF8C00', whiteSpace: 'nowrap' }}>转折点</div>
            </div>
            {/* 第二行：继续恶化 ↓ 崩盘（右对齐，紧接转折点） */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4, marginTop: 4, paddingRight: 2 }}>
              <span style={{ fontSize: 8, color: '#555' }}>继续恶化</span>
              <span style={{ fontSize: 13, color: '#444', lineHeight: 1 }}>↓</span>
              <div style={{ padding: '5px 11px', borderRadius: 9, background: 'rgba(239,68,68,0.08)', border: '1.5px solid rgba(239,68,68,0.38)', fontSize: 11, fontWeight: 700, color: C.red, whiteSpace: 'nowrap' }}>崩盘</div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════
            Section 2 — 6个独立引爆点
        ═══════════════════════════════════ */}
        <section style={{
          background: C.card, borderRadius: 20, padding: '20px 0', marginBottom: 16,
          border: `1px solid ${C.cardBorder}`, overflow: 'hidden',
        }}>
          <div style={{ padding: '0 20px 16px' }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: C.white, margin: '0 0 4px' }}>
              6 个独立引爆点
            </h2>
            <p style={{ fontSize: 12, color: C.sub, lineHeight: 1.6, margin: 0 }}>
              每一项<strong style={{ color: C.dimWhite }}>单独</strong>触发即是你的关键时刻，无需叠加
            </p>
          </div>

          {/* 垂直列表 */}
          {[
            { icon: <TrendingDown size={15} color={C.red} />, title: '连输 / 净输', desc: '连续失利让判断力逐渐归零，越打越乱', threshold: `${profile.etp_loss_streak} 手`, color: C.red },
            { icon: <Clock size={15} color={C.blue} />, title: '在桌时间过长', desc: '超时后大脑进入自动驾驶，停损能力显著下降', threshold: `${profile.etp_duration} 分钟`, color: C.blue },
            { icon: <ArrowUpRight size={15} color={C.purple} />, title: '连输后加注', desc: '越输越大是情绪接管操作的经典失控信号', threshold: `连输 ${profile.loss_raise_streak ?? 2} 手后加注`, color: C.purple },
            { icon: <Activity size={15} color={C.gold} />, title: '手数缠斗', desc: '长期胶着消耗理性储备，焦虑逐渐积累至临界', threshold: `${profile.etp_stagnation} 手`, color: C.gold },
            { icon: <Layers size={15} color={C.orange} />, title: '资金缠斗', desc: '资金原地踏步，焦躁情绪悄悄蓄积到引爆阈值', threshold: `${profile.etp_stagnation} 手`, color: C.orange },
            { icon: <RotateCcw size={15} color={C.orangeRed} />, title: '盈利回撤至0', desc: '赢了再吐光是最危险的状态，追损急迫感最强', threshold: `回撤 ${profile.giveback_alert_pct ?? 30}%`, color: C.orangeRed },
          ].map(({ icon, title, desc, threshold, color }, idx) => (
            <div key={title} style={{
              display: 'flex', alignItems: 'flex-start', gap: 14,
              padding: '14px 20px',
              borderTop: idx === 0 ? 'none' : `1px solid rgba(255,255,255,0.04)`,
            }}>
              {/* 左色条 */}
              <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, background: color, opacity: 0.5, flexShrink: 0, marginTop: 2 }} />
              {/* 图标 */}
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: `${color}12`, border: `1px solid ${color}22`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>{icon}</div>
              {/* 内容 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.white }}>{title}</span>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                    background: `${color}15`, color, letterSpacing: 0.3, flexShrink: 0,
                  }}>单点引爆</span>
                </div>
                <p style={{ fontSize: 11, color: '#777', lineHeight: 1.6, margin: '0 0 6px' }}>{desc}</p>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 10px', borderRadius: 6,
                  background: `${color}10`, border: `1px solid ${color}20`,
                }}>
                  <span style={{ fontSize: 9, color: color, opacity: 0.7 }}>触发阈值</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color }}>{threshold}</span>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* ═══════════════════════════════════
            Section 3 — 引爆行为信号
        ═══════════════════════════════════ */}
        <section style={{
          background: C.card, borderRadius: 20, padding: 20, marginBottom: 16,
          border: `1px solid ${C.cardBorder}`,
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: C.white, margin: '0 0 4px' }}>
            引爆行为信号
          </h2>
          <p style={{ fontSize: 12, color: C.sub, lineHeight: 1.6, margin: '0 0 14px' }}>
            蓄能条件触发后，出现以下<strong style={{ color: C.dimWhite }}>任一行为</strong>→ 关键时刻立即引爆
          </p>

          {/* 行为列表（带内联描述，手机友好） */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: '加码', icon: '↑', desc: '连输时仍提高下注码量', color: '#EF4444' },
              { label: '追损', icon: '↻', desc: '连输后不停手，强行继续下注', color: '#F97316' },
              { label: '换策略', icon: '⇄', desc: '临时改变下注思路，换桌或换打法', color: '#F59E0B' },
              { label: '停后续打', icon: '⏸', desc: '暂停"冷静"后立即重新上桌', color: '#A78BFA' },
              { label: '超时继续', icon: '⏱', desc: '超出原定计划时间仍不离场', color: '#60A5FA' },
              { label: '无视提醒', icon: '⚠', desc: '系统预警弹出后直接关闭继续操作', color: '#FB7185' },
            ].map(({ label, icon, desc, color }) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', borderRadius: 12,
                background: `${color}08`, border: `1px solid ${color}18`,
              }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 8,
                  background: `${color}15`, border: `1px solid ${color}25`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, color, flexShrink: 0, fontWeight: 700,
                }}>{icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 11, color: '#666', lineHeight: 1.4 }}>{desc}</div>
                </div>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: color, opacity: 0.5, flexShrink: 0,
                }} />
              </div>
            ))}
          </div>

          <div style={{
            marginTop: 14, padding: '12px 14px', borderRadius: 12,
            background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.14)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <AlertTriangle size={12} color={C.red} />
              <span style={{ fontSize: 12, fontWeight: 700, color: C.red }}>引爆 → 转折点 → 崩盘</span>
            </div>
            <p style={{ fontSize: 12, color: '#aaa', lineHeight: 1.7, margin: 0 }}>
              危险点蓄能 + 任一行为信号 → 情绪转折点触发。
              继续恶化 → <strong style={{ color: C.red }}>整场清袋</strong>。
            </p>
          </div>
        </section>

        {/* ═══════════════════════════════════
            Section 4 — 你的情绪防线
        ═══════════════════════════════════ */}
        <section style={{
          background: C.card, borderRadius: 20, padding: 20, marginBottom: 16,
          border: `1px solid ${C.cardBorder}`,
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: C.white, margin: '0 0 6px' }}>
            你的情绪防线
          </h2>

          {/* 权威数据锚点 callout */}
          <div style={{
            padding: '12px 14px', borderRadius: 12, marginBottom: 16,
            background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 5,
                background: 'rgba(245,158,11,0.2)', color: C.gold,
              }}>权威数据锚点</span>
              <span style={{ fontSize: 12, color: C.gold, fontWeight: 600 }}>87.6% 玩家的关键时刻</span>
            </div>
            <p style={{ fontSize: 11, color: '#aaa', lineHeight: 1.7, margin: '0 0 4px' }}>
              以下锚点（<span style={{ color: C.gold }}>▲</span>）来自大量玩家数据统计，代表最常见的失控临界值。
            </p>
            <p style={{ fontSize: 11, color: '#666', lineHeight: 1.6, margin: 0 }}>
              你可以根据自身经验自由调整 · 完成 <strong style={{ color: '#aaa' }}>20 场</strong>实战后，分析引擎将为你生成更精准的专属数据
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
            <ThresholdSlider
              label="连输预警" unit="手" color={C.red}
              desc="连输几手开始监测"
              value={profile.etp_loss_streak} min={1} max={8} step={1}
              benchmark={[3, 4]}
              onChange={v => updateParam('etp_loss_streak', v)}
            />
            <ThresholdSlider
              label="缠斗预警" unit="手" color={C.gold}
              desc="缠斗几手开始监测"
              value={profile.etp_stagnation} min={4} max={16} step={1}
              benchmark={[8, 10]}
              onChange={v => updateParam('etp_stagnation', v)}
            />
            <ThresholdSlider
              label="时间预警" unit="分钟" color={C.blue}
              desc="在桌多久开始监测"
              value={profile.etp_duration} min={15} max={90} step={5}
              benchmark={[45, 60]}
              onChange={v => updateParam('etp_duration', v)}
            />
            <ThresholdSlider
              label="连输加注预警" unit="手" color={C.purple}
              desc="连输几手后加注视为信号"
              value={profile.loss_raise_streak ?? 2} min={1} max={5} step={1}
              benchmark={2}
              onChange={v => updateParam('loss_raise_streak', v)}
            />
            <ThresholdSlider
              label="盈利回撤预警" unit="%" color={C.orangeRed}
              desc="盈利回撤多少%触发监测"
              value={profile.giveback_alert_pct ?? 30} min={10} max={80} step={5}
              benchmark={30}
              onChange={v => updateParam('giveback_alert_pct', v)}
            />
          </div>

          {/* 展开更多参数 */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 12,
              border: `1px solid ${C.cardBorder}`, background: 'rgba(255,255,255,0.02)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              color: C.sub, fontSize: 13,
            }}
          >
            <span>更多参数（加码容忍、干预频率…）</span>
            <ChevronRight size={16} style={{ transform: showAdvanced ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>

          {showAdvanced && (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <ThresholdSlider
                label="加码容忍" unit="x" color="#A78BFA"
                desc="码量涨多少倍算异常"
                value={profile.bet_raise_tolerance} min={1.0} max={2.0} step={0.1}
                onChange={v => updateParam('bet_raise_tolerance', v)}
                format={v => `${v.toFixed(1)}x`}
              />
              <ThresholdSlider
                label="回吐容忍" unit="%" color="#F97316"
                desc="盈利回吐多少%开始计分"
                value={profile.giveback_tolerance} min={20} max={80} step={5}
                onChange={v => updateParam('giveback_tolerance', v)}
              />
              <ThresholdSlider
                label="干预冷却" unit="x" color="#6EE7B7"
                desc="提醒间隔倍率（越小越频繁）"
                value={profile.intervention_cooldown_multiplier} min={0.5} max={2.0} step={0.1}
                onChange={v => updateParam('intervention_cooldown_multiplier', v)}
                format={v => `${v.toFixed(1)}x`}
              />
            </div>
          )}
        </section>

        {/* ═══ 数据驱动建议 ═══ */}
        {healthReport.sessions_analyzed > 0 && (
          <section style={{
            background: C.card, borderRadius: 20, padding: 20, marginBottom: 16,
            border: `1px solid ${C.cardBorder}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <h2 style={{ fontSize: 15, fontWeight: 800, color: C.white, margin: 0 }}>
                系统观察
              </h2>
              <span style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 6,
                background: healthReport.overall_status === 'optimized' ? `${C.green}15` : `${C.gold}15`,
                color: healthReport.overall_status === 'optimized' ? C.green : C.gold,
                fontWeight: 600,
              }}>
                {healthReport.overall_status === 'no_data' ? '数据不足'
                  : healthReport.overall_status === 'learning' ? '学习中'
                  : healthReport.overall_status === 'optimized' ? '参数合理'
                  : `${healthReport.suggestions.length} 项建议`}
              </span>
            </div>
            <p style={{ fontSize: 12, color: C.sub, margin: '0 0 14px' }}>
              {healthReport.status_label}
            </p>

            {healthReport.suggestions.map((s, i) => (
              <div key={i} style={{
                padding: '14px', borderRadius: 14, marginBottom: 10,
                background: s.direction === 'tighten' ? 'rgba(239,68,68,0.06)' : 'rgba(34,197,94,0.06)',
                border: `1px solid ${s.direction === 'tighten' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.white }}>{s.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: s.direction === 'tighten' ? C.red : C.green }}>
                    {s.current_value} → {s.suggested_value}{s.param === 'bet_raise_tolerance' ? 'x' : ''}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: C.dimWhite, lineHeight: 1.6, margin: '0 0 10px' }}>
                  {s.evidence}
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => adoptSuggestion(s.param, s.suggested_value)}
                    style={{
                      padding: '6px 16px', borderRadius: 8, border: 'none',
                      background: s.direction === 'tighten' ? C.red : C.green,
                      color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    采纳
                  </button>
                  <button style={{
                    padding: '6px 16px', borderRadius: 8,
                    border: `1px solid ${C.cardBorder}`, background: 'transparent',
                    color: C.sub, fontSize: 12, cursor: 'pointer',
                  }}>
                    暂不调整
                  </button>
                </div>
                <div style={{ fontSize: 10, color: C.sub, marginTop: 8 }}>
                  基于 {s.sessions_analyzed} 场数据 · 置信度：{s.confidence === 'high' ? '高' : s.confidence === 'medium' ? '中' : '初步'}
                </div>
              </div>
            ))}

            {healthReport.suggestions.length > 1 && (
              <button
                onClick={adoptAll}
                style={{
                  width: '100%', padding: '10px', borderRadius: 12, border: 'none',
                  background: `${C.gold}18`, color: C.gold,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 4,
                }}
              >
                一键采纳全部建议
              </button>
            )}

            {healthReport.compliance_rate !== null && (
              <div style={{
                marginTop: 14, padding: '12px 14px', borderRadius: 12,
                background: 'rgba(255,255,255,0.02)', border: `1px solid ${C.cardBorder}`,
              }}>
                <div style={{ fontSize: 12, color: C.sub, marginBottom: 8 }}>干预有效性</div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: C.green }}>{healthReport.compliance_rate}%</div>
                    <div style={{ fontSize: 10, color: C.sub }}>你遵守了提醒</div>
                  </div>
                  {healthReport.collapse_after_ignore !== null && (
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: C.red }}>{healthReport.collapse_after_ignore}%</div>
                      <div style={{ fontSize: 10, color: C.sub }}>忽略后崩盘</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ═══ 无数据占位 ═══ */}
        {healthReport.sessions_analyzed === 0 && (
          <section style={{
            background: C.card, borderRadius: 20, padding: 20, marginBottom: 16,
            border: `1px solid ${C.cardBorder}`, opacity: 0.7,
          }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: C.white, margin: '0 0 6px' }}>系统观察</h2>
            <p style={{ fontSize: 12, color: C.sub, margin: 0, lineHeight: 1.6 }}>
              完成 3 场实战后，系统会开始学习你的情绪模式，并给出个性化调整建议。
            </p>
          </section>
        )}

        {/* ═══ 确认防线 ═══ */}
        <button
          onClick={handleConfirm}
          style={{
            width: '100%', padding: '18px', borderRadius: 16, border: 'none',
            background: `linear-gradient(135deg, #EF4444 0%, #DC2626 60%, #B91C1C 100%)`,
            color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer',
            letterSpacing: 1.5, marginBottom: 16,
            boxShadow: '0 4px 24px rgba(239,68,68,0.3)',
          }}
        >
          ⚡ 确认我的情绪防线
        </button>

      </div>
    </div>
  );
}

// ============================================================
// 子组件
// ============================================================

function TriggerCard({ icon, title, desc, threshold, color }: {
  icon: React.ReactNode; title: string; desc: string; threshold: string; color: string;
}) {
  return (
    <div style={{
      padding: '12px', borderRadius: 14,
      background: `${color}08`, border: `1px solid ${color}20`,
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {icon}
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{title}</span>
      </div>
      <p style={{ fontSize: 10, color: '#888', lineHeight: 1.5, margin: 0 }}>{desc}</p>
      <span style={{
        fontSize: 10, fontWeight: 600, color,
        padding: '2px 8px', borderRadius: 6, background: `${color}12`,
        alignSelf: 'flex-start',
      }}>
        触发阈值：{threshold}
      </span>
    </div>
  );
}

const BehaviorTag: React.FC<{ label: string; desc: string }> = ({ label, desc }) => {
  return (
    <div
      title={desc}
      style={{
        padding: '6px 14px', borderRadius: 20,
        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
        fontSize: 12, fontWeight: 700, color: '#EF4444',
        cursor: 'default', userSelect: 'none',
      }}
    >
      {label}
    </div>
  );
}

function ThresholdSlider({ label, unit, color, desc, value, min, max, step, onChange, format, benchmark }: {
  label: string; unit: string; color: string; desc: string;
  value: number; min: number; max: number; step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  benchmark?: number | [number, number];
}) {
  const display = format ? format(value) : `${value}${unit}`;
  const fillPct = ((value - min) / (max - min)) * 100;

  // 计算锚点信息
  const benchmarkInfo = (() => {
    if (benchmark === undefined) return null;
    if (Array.isArray(benchmark)) {
      const lowPct  = ((benchmark[0] - min) / (max - min)) * 100;
      const highPct = ((benchmark[1] - min) / (max - min)) * 100;
      return { lowPct, highPct, isSingle: false as const, label: `▲ ${benchmark[0]}~${benchmark[1]}${unit}` };
    }
    const pct = ((benchmark - min) / (max - min)) * 100;
    const lbl = `▲ ${format ? format(benchmark) : `${benchmark}${unit}`}`;
    return { lowPct: pct, highPct: pct, isSingle: true as const, label: lbl };
  })();

  return (
    <div>
      {/* 标签行 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{label}</span>
          <span style={{ fontSize: 11, color: '#555', marginLeft: 8 }}>{desc}</span>
        </div>
        <div style={{
          padding: '3px 10px', borderRadius: 8,
          background: `${color}18`, border: `1px solid ${color}30`,
        }}>
          <span style={{ fontSize: 14, fontWeight: 800, color }}>{display}</span>
        </div>
      </div>

      {/* 自定义滑块轨道 */}
      <div style={{ position: 'relative', height: 36 }}>
        {/* 轨道背景 */}
        <div style={{
          position: 'absolute', top: 10, left: 0, right: 0, height: 4,
          borderRadius: 2, background: 'rgba(255,255,255,0.08)',
        }} />
        {/* 填充段 */}
        <div style={{
          position: 'absolute', top: 10, left: 0, height: 4,
          width: `${fillPct}%`, borderRadius: 2,
          background: `linear-gradient(to right, ${color}60, ${color})`,
          transition: 'width 0.08s',
        }} />
        {/* 锚点区域（范围时是一段，单点时是一条线） */}
        {benchmarkInfo && (
          <div style={{
            position: 'absolute', top: 8, height: 8,
            left: `clamp(0%, ${benchmarkInfo.lowPct}%, 100%)`,
            width: benchmarkInfo.isSingle
              ? 2
              : `${Math.max(benchmarkInfo.highPct - benchmarkInfo.lowPct, 2)}%`,
            background: '#F59E0B',
            borderRadius: benchmarkInfo.isSingle ? 1 : '0 1px 1px 0',
            opacity: 0.7,
          }} />
        )}
        {/* 原生 range input（透明，仅用于交互） */}
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, width: '100%', height: 24,
            opacity: 0, cursor: 'pointer', zIndex: 2, margin: 0,
          }}
        />
        {/* 自定义拇指 */}
        <div style={{
          position: 'absolute', top: 5,
          left: `clamp(0%, ${fillPct}%, 100%)`,
          transform: 'translateX(-50%)',
          width: 14, height: 14, borderRadius: '50%',
          background: color, border: '2px solid rgba(255,255,255,0.9)',
          boxShadow: `0 0 8px ${color}60`,
          transition: 'left 0.08s',
          pointerEvents: 'none',
        }} />
        {/* 锚点文字标签 */}
        {benchmarkInfo && (
          <div style={{
            position: 'absolute', top: 20,
            left: `clamp(5%, ${(benchmarkInfo.lowPct + benchmarkInfo.highPct) / 2}%, 90%)`,
            transform: 'translateX(-50%)',
            fontSize: 9, fontWeight: 700, color: '#F59E0B',
            whiteSpace: 'nowrap', letterSpacing: 0.3,
          }}>
            {benchmarkInfo.label}
          </div>
        )}
      </div>

      {/* 端值 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#444', marginTop: 4 }}>
        <span>{format ? format(min) : `${min}${unit}`}</span>
        <span>{format ? format(max) : `${max}${unit}`}</span>
      </div>
    </div>
  );
}

function StateNode({ label, color, active }: { label: string; color: string; active?: boolean }) {
  return (
    <div style={{
      padding: '6px 14px', borderRadius: 10,
      background: active ? `${color}20` : `${color}0A`,
      border: `1.5px solid ${active ? color : color + '40'}`,
      fontSize: 12, fontWeight: 700, color, textAlign: 'center', whiteSpace: 'nowrap',
    }}>
      {label}
    </div>
  );
}

function StateArrow({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 4px' }}>
      <span style={{ fontSize: 9, color: '#666', marginBottom: 2, whiteSpace: 'nowrap' }}>{label}</span>
      <ChevronRight size={14} color="#555" />
    </div>
  );
}

function ConfirmLine({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span style={{ fontSize: 13, color: '#999' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{value}</span>
    </div>
  );
}
