import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowRight, ShieldCheck, Shield, Home, MessageCircle, User,
  LayoutTemplate, Lightbulb, LineChart, Zap, Plus, Layers,
} from 'lucide-react';
import {
  subscribeFM, getActiveSession, getEndedSessions,
} from '../services/fundManagerService';
import { computeMetrics } from '../services/fundManagerEngine';
import { computeEmotion } from '../services/emotionEngine';
import { CHARACTER_MAP, ALL_CHARACTER_IDS } from '../characters';
import type { FMSession } from '../types/fundManager';

// ============================================================
// 首页 v6 — 基于参考设计重写
// ============================================================

// ═══════════════════════════════════════════
// Slogan 轮播（浮现-停留-飘走）
// ═══════════════════════════════════════════
const SLOGANS = [
  '你只管判断，我来帮你盯着',
  '扫描你的情绪转折点',
  '从失控到掌控的操作系统',
  '越用 · 越懂 · 越帮你',
];

type SloganPhase = 'entering' | 'visible' | 'leaving';

function SloganCarousel() {
  const [cur, setCur] = useState(0);
  const [phase, setPhase] = useState<SloganPhase>('entering');

  const advance = useCallback(() => {
    setCur(p => (p + 1) % SLOGANS.length);
    setPhase('entering');
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (phase === 'entering') {
      timer = setTimeout(() => setPhase('visible'), 800);
    } else if (phase === 'visible') {
      // 最后一条（越用·越懂·越帮你）多停 0.5s，其余多停 0.3s
      const isLast = cur === SLOGANS.length - 1;
      const visibleDuration = isLast ? 3500 : 3300;
      timer = setTimeout(() => setPhase('leaving'), visibleDuration);
    } else {
      timer = setTimeout(advance, 800);
    }
    return () => clearTimeout(timer);
  }, [phase, cur, advance]);

  const style: React.CSSProperties = {
    color: 'rgba(255,255,255,0.5)',
    opacity: phase === 'visible' || phase === 'entering' && false ? 1 : 0,
    transform: phase === 'entering' ? 'translateY(8px)' : phase === 'leaving' ? 'translateY(-8px)' : 'translateY(0)',
    transition: phase === 'entering'
      ? 'opacity 800ms ease-out, transform 800ms ease-out'
      : phase === 'leaving'
        ? 'opacity 800ms ease-in, transform 800ms ease-in'
        : 'none',
  };

  // Fix: entering starts invisible, then we need a frame to trigger transition
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (phase === 'entering') {
      setMounted(false);
      const raf = requestAnimationFrame(() => setMounted(true));
      return () => cancelAnimationFrame(raf);
    }
  }, [phase, cur]);

  const computedStyle: React.CSSProperties = {
    color: 'rgba(255,255,255,0.5)',
    transition: 'opacity 800ms ease-out, transform 800ms ease-out',
    ...(phase === 'entering' && !mounted
      ? { opacity: 0, transform: 'translateY(8px)', transition: 'none' }
      : phase === 'entering' && mounted
        ? { opacity: 1, transform: 'translateY(0)', transition: 'opacity 800ms ease-out, transform 800ms ease-out' }
        : phase === 'visible'
          ? { opacity: 1, transform: 'translateY(0)', transition: 'none' }
          : { opacity: 0, transform: 'translateY(-8px)', transition: 'opacity 800ms ease-in, transform 800ms ease-in' }
    ),
  };

  return (
    <div className="flex items-center justify-center mb-2">
      <div className="h-7 flex items-center overflow-hidden">
        <span className="font-medium tracking-[3px]" style={{ ...computedStyle, fontSize: '17.6px' }}>
          {SLOGANS[cur]}
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// 角色人气榜数据（固定评分展示用）
// ═══════════════════════════════════════════
const CHAR_RATINGS: Record<string, number> = {
  junshi: 5, aqiang: 4.5, gailv: 4, ajie: 4, laoliu: 3.5,
  xiaofang: 4, dashiwang: 3.5, kellyprof: 4.5, xiaotian: 3, laozhang: 4,
};

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  return (
    <span className="text-[10px] tracking-tight" style={{ color: 'rgba(212,175,55,0.25)' }}>
      {'★'.repeat(full)}{half ? '☆' : ''}
    </span>
  );
}

interface DashboardHomePageProps {
  onStartPlan: () => void;
  onResume: () => void;
  onReview: (sessionId: string) => void;
  onHistory: () => void;
  onTemplates: () => void;
  onGlossary: () => void;
  onGoToRoundtable: () => void;
  onGrowth?: () => void;
  onKeyMoment?: () => void;
  onCharacterTap?: (charId: string) => void;
  onFindAdvisor?: () => void;
  onCreateRoom?: () => void;
}

export default function DashboardHomePage({
  onStartPlan, onResume, onReview, onHistory, onTemplates, onGlossary,
  onGoToRoundtable, onGrowth, onKeyMoment, onCharacterTap, onFindAdvisor, onCreateRoom,
}: DashboardHomePageProps) {
  const [activeSession, setActiveSession] = useState<FMSession | null>(null);
  const [endedSessions, setEndedSessions] = useState<FMSession[]>([]);
  const [, setTick] = useState(0);

  useEffect(() => {
    const refresh = () => {
      setActiveSession(getActiveSession());
      setEndedSessions(getEndedSessions());
      setTick(t => t + 1);
    };
    refresh();
    return subscribeFM(refresh);
  }, []);

  const lastEnded = endedSessions[0] || null;
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  const isActive = activeSession && activeSession.status !== 'ended';
  const isJustEnded = lastEnded && lastEnded.end_time &&
    new Date(lastEnded.end_time).getTime() > twoHoursAgo;
  const activeMetrics = isActive ? computeMetrics(activeSession!) : null;
  const lastMetrics = lastEnded ? computeMetrics(lastEnded) : null;

  // ── 能量道数据（从实战记录计算） ──
  const energyData = React.useMemo(() => {
    const allSessions = [...endedSessions];
    if (isActive && activeSession) allSessions.unshift(activeSession);

    // 当前能量：最近一场的 tilt 反转（100 - tiltScore）
    let currentEnergy = 0;
    if (allSessions.length > 0) {
      const latest = allSessions[0];
      const m = computeMetrics(latest);
      const emo = computeEmotion(latest, m);
      currentEnergy = Math.max(0, 100 - emo.score);
    }

    // 完成场次
    const completedCount = endedSessions.length;

    // 连续天数：从今天往前数，每天至少1场
    let streakDays = 0;
    if (endedSessions.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dayMs = 86400000;
      const sessionDates = new Set(
        endedSessions.map(s => {
          const d = new Date(s.start_time);
          d.setHours(0, 0, 0, 0);
          return d.getTime();
        })
      );
      for (let i = 0; i < 365; i++) {
        const checkDay = today.getTime() - i * dayMs;
        if (sessionDates.has(checkDay)) {
          streakDays++;
        } else if (i > 0) {
          break; // 昨天开始检查，断了就停
        }
      }
    }

    return { currentEnergy, completedCount, streakDays };
  }, [endedSessions, activeSession, isActive]);

  return (
    <div className="bg-[#080808] text-gray-100 pb-24 selection:bg-teal-500/20" style={{ fontFamily: 'system-ui, -apple-system, "Helvetica Neue", sans-serif' }}>

      <div className="max-w-md mx-auto px-4 pt-8 relative z-10">

        {/* ═══ Header ═══ */}
        <header className="mb-5">
          <div className="flex items-center justify-between mb-1">
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 3,
              color: '#00D4AA', fontFamily: 'system-ui, -apple-system, sans-serif',
              textTransform: 'uppercase',
            }}>Baccarat OS</span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 9, color: 'rgba(0,212,170,0.7)',
              padding: '2px 8px', borderRadius: 4,
              border: '1px solid rgba(0,212,170,0.2)',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              letterSpacing: 1.5,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#00D4AA', display: 'inline-block' }}/>
              LIVE
            </span>
          </div>
          <h1 style={{
            fontSize: 28, fontWeight: 800, letterSpacing: -0.5,
            color: '#FFFFFF', lineHeight: 1.1, margin: 0,
            fontFamily: 'system-ui, -apple-system, "Helvetica Neue", sans-serif',
          }}>
            博弈操作系统
          </h1>
        </header>

        {/* ═══ Slogan 轮播 ═══ */}
        <SloganCarousel />

        <main className="space-y-4">

          {/* ═══ 建立系统 / Active Session Hero ═══ */}
          {isActive && activeMetrics && activeSession ? (
            <HeroActive metrics={activeMetrics} session={activeSession} onResume={onResume} />
          ) : isJustEnded && lastEnded && lastMetrics ? (
            <HeroJustEnded session={lastEnded} metrics={lastMetrics} onReview={() => onReview(lastEnded.id)} />
          ) : (
            <section
              className="p-4 cursor-pointer"
              style={{
                background: '#111111',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 12,
              }}
              onClick={onStartPlan}>

              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2.5">
                  <div style={{
                    width: 28, height: 28, borderRadius: 7,
                    background: 'rgba(0,212,170,0.10)', border: '1px solid rgba(0,212,170,0.20)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Layers className="w-3.5 h-3.5" style={{ color: '#00D4AA' }} />
                  </div>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: 0.3, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                    构建实战博弈系统
                  </h2>
                </div>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>进场前 →</span>
              </div>

              {/* 3列图标网格 */}
              <div className="grid grid-cols-3 gap-2 py-2">
                {[
                  { icon: LayoutTemplate, title: '风格模板', desc: '基础框架', color: '#F59E0B', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.22)' },
                  { icon: Lightbulb,      title: '注入想法', desc: '个性定制', color: '#00D4AA', bg: 'rgba(0,212,170,0.10)',  border: 'rgba(0,212,170,0.22)'  },
                  { icon: LineChart,      title: '策略优化', desc: '认知迭代', color: '#60A5FA', bg: 'rgba(96,165,250,0.10)', border: 'rgba(96,165,250,0.22)' },
                ].map(({ icon: Icon, title, desc, color, bg, border }, i) => (
                  <div key={i} style={{
                    background: bg, border: `1px solid ${border}`,
                    borderRadius: 8, padding: '12px 8px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
                  }}>
                    <Icon style={{ color, width: 20, height: 20, marginBottom: 8 }} strokeWidth={1.8} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#e5e5e5', marginBottom: 2 }}>{title}</span>
                    <span style={{ fontSize: 9, color: '#666' }}>{desc}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ═══ 关键时刻 ═══ */}
          <section
            className="relative overflow-hidden cursor-pointer"
            style={{
              background: '#111111',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 12,
            }}
            onClick={onKeyMoment}
          >

            <div className="p-4 relative">
              {/* 标题行 */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div style={{
                      width: 28, height: 28, borderRadius: 8,
                      background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.18)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Zap className="w-3.5 h-3.5" style={{ color: '#00D4AA' }} />
                    </div>
                    <h2 className="text-xl font-serif-cn tracking-widest" style={{ fontWeight: 900, color: '#fff' }}>关键时刻</h2>
                  </div>
                  <div className="flex items-center gap-2 ml-9">
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
                      background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.25)',
                      color: '#F59E0B', letterSpacing: 0.5,
                    }}>首创</span>
                    <span className="text-[10px] tracking-wider" style={{ color: 'rgba(0,212,170,0.6)' }}>情绪转折点追踪系统</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-1 shrink-0">
                  <span className="text-[10px] text-gray-500">进入</span>
                  <span className="text-[10px]" style={{ color: 'rgba(0,212,170,0.6)' }}>→</span>
                </div>
              </div>

              {/* SVG图表 — 逐手柱状动画（风控事故版）
                  每根柱 = 一手输赢结果，正数(绿)=赢，负数(红)=输
                  第10格柱出现后 → 情绪转折点标签淡入
                  第12格柱（巨型红柱）缓慢长出 → 整场失控标签淡入
                  18s循环播放
              */}
              <div className="w-full relative overflow-hidden mb-3"
                style={{ height: 96, borderRadius: 14, background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.06)' }}>
                <svg viewBox="0 0 340 90" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
                {/* 辅助网格线 */}
                {([14, 55, 72] as number[]).map(y => (
                  <line key={y} x1={6} y1={y} x2={334} y2={y}
                    stroke="rgba(255,255,255,0.04)" strokeWidth="0.6" strokeDasharray="3,6" />
                ))}
                {/* 零线（输赢分界） */}
                <line x1={6} y1={35} x2={334} y2={35} stroke="rgba(255,255,255,0.14)" strokeWidth="0.8" />

                {/* Bar 1 — 赢 h=20 */}
                <rect x={16} y={35} width={11} height={0} fill="#22C55E" rx={1} opacity={0.88}>
                  <animate attributeName="height" values="0;0;20;20;0" keyTimes="0;0.028;0.056;0.944;1" dur="18s" repeatCount="indefinite"/>
                  <animate attributeName="y" values="35;35;15;15;35" keyTimes="0;0.028;0.056;0.944;1" dur="18s" repeatCount="indefinite"/>
                </rect>

                {/* Bar 2 — 输 h=15 */}
                <rect x={42} y={35} width={11} height={0} fill="#EF4444" rx={1} opacity={0.82}>
                  <animate attributeName="height" values="0;0;15;15;0" keyTimes="0;0.072;0.100;0.944;1" dur="18s" repeatCount="indefinite"/>
                </rect>

                {/* Bar 3 — 赢 h=22 */}
                <rect x={68} y={35} width={11} height={0} fill="#22C55E" rx={1} opacity={0.88}>
                  <animate attributeName="height" values="0;0;22;22;0" keyTimes="0;0.117;0.144;0.944;1" dur="18s" repeatCount="indefinite"/>
                  <animate attributeName="y" values="35;35;13;13;35" keyTimes="0;0.117;0.144;0.944;1" dur="18s" repeatCount="indefinite"/>
                </rect>

                {/* Bar 4 — 输 h=13 */}
                <rect x={94} y={35} width={11} height={0} fill="#EF4444" rx={1} opacity={0.82}>
                  <animate attributeName="height" values="0;0;13;13;0" keyTimes="0;0.161;0.189;0.944;1" dur="18s" repeatCount="indefinite"/>
                </rect>

                {/* Bar 5 — 赢 h=18 */}
                <rect x={120} y={35} width={11} height={0} fill="#22C55E" rx={1} opacity={0.88}>
                  <animate attributeName="height" values="0;0;18;18;0" keyTimes="0;0.206;0.233;0.944;1" dur="18s" repeatCount="indefinite"/>
                  <animate attributeName="y" values="35;35;17;17;35" keyTimes="0;0.206;0.233;0.944;1" dur="18s" repeatCount="indefinite"/>
                </rect>

                {/* Bar 6 — 输 h=9 缠斗 */}
                <rect x={146} y={35} width={11} height={0} fill="#EF4444" rx={1} opacity={0.72}>
                  <animate attributeName="height" values="0;0;9;9;0" keyTimes="0;0.250;0.278;0.944;1" dur="18s" repeatCount="indefinite"/>
                </rect>

                {/* Bar 7 — 赢 h=8 缠斗 */}
                <rect x={172} y={35} width={11} height={0} fill="#22C55E" rx={1} opacity={0.72}>
                  <animate attributeName="height" values="0;0;8;8;0" keyTimes="0;0.289;0.317;0.944;1" dur="18s" repeatCount="indefinite"/>
                  <animate attributeName="y" values="35;35;27;27;35" keyTimes="0;0.289;0.317;0.944;1" dur="18s" repeatCount="indefinite"/>
                </rect>

                {/* Bar 8 — 输 h=10 缠斗 */}
                <rect x={198} y={35} width={11} height={0} fill="#EF4444" rx={1} opacity={0.72}>
                  <animate attributeName="height" values="0;0;10;10;0" keyTimes="0;0.328;0.356;0.944;1" dur="18s" repeatCount="indefinite"/>
                </rect>

                {/* Bar 9 — 输 h=13 连输 */}
                <rect x={224} y={35} width={11} height={0} fill="#EF4444" rx={1} opacity={0.86}>
                  <animate attributeName="height" values="0;0;13;13;0" keyTimes="0;0.367;0.394;0.944;1" dur="18s" repeatCount="indefinite"/>
                </rect>

                {/* Bar 10 — 输 h=11 ETP触发 */}
                <rect x={250} y={35} width={11} height={0} fill="#EF4444" rx={1} opacity={0.92}>
                  <animate attributeName="height" values="0;0;11;11;0" keyTimes="0;0.406;0.433;0.944;1" dur="18s" repeatCount="indefinite"/>
                </rect>

                {/* Bar 11 — 输 h=22 上头追损 */}
                <rect x={276} y={35} width={11} height={0} fill="#EF4444" rx={1} opacity={0.96}>
                  <animate attributeName="height" values="0;0;22;22;0" keyTimes="0;0.461;0.489;0.944;1" dur="18s" repeatCount="indefinite"/>
                </rect>

                {/* Bar 12 — 整场失控 光晕 */}
                <rect x={300} y={35} width={18} height={0} fill="rgba(239,68,68,0.18)" rx={2}>
                  <animate attributeName="height" values="0;0;54;54;0" keyTimes="0;0.517;0.711;0.944;1" dur="18s" repeatCount="indefinite"/>
                </rect>
                {/* Bar 12 — 主柱 h=50 缓慢生长 */}
                <rect x={302} y={35} width={14} height={0} fill="#EF4444" rx={1}>
                  <animate attributeName="height" values="0;0;50;50;0" keyTimes="0;0.517;0.711;0.944;1" dur="18s" repeatCount="indefinite"/>
                </rect>

                {/* 情绪转折点 标签 — Bar 10结束后淡入 */}
                <g opacity="0">
                  <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.433;0.478;0.944;1" dur="18s" repeatCount="indefinite"/>
                  <line x1={255} y1={18} x2={255} y2={34}
                    stroke="#F59E0B" strokeWidth="0.8" strokeDasharray="2,2" opacity={0.55}/>
                  <rect x={223} y={7} width={64} height={11} rx={3}
                    fill="rgba(245,158,11,0.14)" stroke="rgba(245,158,11,0.50)" strokeWidth="0.7"/>
                  <text x={255} y={15} fontSize="7" fill="#F59E0B"
                    textAnchor="middle" fontWeight="700" letterSpacing="0.5">情绪转折点</text>
                </g>

                {/* 整场失控 标签 — Bar 12半程时淡入 */}
                <g opacity="0">
                  <animate attributeName="opacity" values="0;0;0;1;1;0" keyTimes="0;0.517;0.611;0.650;0.944;1" dur="18s" repeatCount="indefinite"/>
                  <line x1={309} y1={31} x2={309} y2={34}
                    stroke="#EF4444" strokeWidth="0.8" opacity={0.55}/>
                  <rect x={294} y={21} width={30} height={10} rx={2}
                    fill="rgba(239,68,68,0.14)" stroke="rgba(239,68,68,0.50)" strokeWidth="0.7"/>
                  <text x={309} y={28} fontSize="7" fill="#EF4444"
                    textAnchor="middle" fontWeight="700" letterSpacing="0.3">整场失控</text>
                </g>
              </svg>
              </div>

              {/* Mini 统计 — 横向数据行 */}
              <div style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 10, gap: 0 }}>
                {[
                  { label: '连输即崩', value: '3手', color: '#FF3B47' },
                  { label: '回撤比例', value: '35%', color: '#F59E0B' },
                  { label: '失控时长', value: '45′', color: '#00D4AA' },
                ].map(({ label, value, color }, i) => (
                  <div key={label} style={{
                    flex: 1, textAlign: 'center',
                    borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                    padding: '0 8px',
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{value}</div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginTop: 3, letterSpacing: 0.3 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ═══ 博弈圆桌模块（整合卡片） ═══ */}
          <section
            className="p-4"
            style={{
              background: '#111111',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 12,
            }}
          >
            {/* 标题行 */}
            <div
              className="flex items-start gap-3 cursor-pointer group mb-3"
              onClick={onGoToRoundtable}
            >
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20 mt-0.5">
                <MessageCircle className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-serif-cn font-bold text-white tracking-wide">博弈圆桌</h2>
                <span className="text-xs text-white/40">与 AI 专家聊聊 · 解闷 / 解乏 / 涨知识</span>
              </div>
            </div>

            {/* 分割线 */}
            <div className="border-t border-white/5 my-3" />

            {/* 快捷入口 */}
            <div className="flex justify-between px-2 mb-3">
              <button
                className="rounded-xl p-3 flex items-center justify-center gap-2.5 transition-colors bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 hover:from-emerald-500/15 hover:to-emerald-500/8"
                style={{ width: '42%' }}
                onClick={(e) => { e.stopPropagation(); onFindAdvisor?.(); }}
              >
                <span className="text-lg">🪪</span>
                <div className="text-center">
                  <div className="text-xs font-medium text-gray-100">找军师</div>
                  <div className="text-[9px] text-gray-500">一对一 · 免费</div>
                </div>
              </button>
              <button
                className="rounded-xl p-3 flex items-center justify-center gap-2.5 transition-colors bg-gradient-to-r from-amber-500/10 to-amber-500/5 border border-amber-500/20 hover:from-amber-500/15 hover:to-amber-500/8"
                style={{ width: '42%' }}
                onClick={(e) => { e.stopPropagation(); onCreateRoom?.(); }}
              >
                <div className="w-6 h-6 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Plus className="w-3.5 h-3.5 text-amber-300" />
                </div>
                <div className="text-center">
                  <div className="text-xs font-medium text-gray-100">创建房间</div>
                  <div className="text-[9px] text-gray-500">自选角色 · 定制</div>
                </div>
              </button>
            </div>

            {/* 分割线 */}
            <div className="border-t border-white/5 my-3" />

            {/* 角色人气榜 */}
            <div className="flex items-center justify-between mb-2 px-0.5">
              <h3 className="text-xs font-medium text-gray-400 tracking-wide">◈ 人气榜</h3>
              <span className="text-[9px] text-gray-500">{ALL_CHARACTER_IDS.length} 位角色</span>
            </div>
            <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
              {ALL_CHARACTER_IDS.map(id => {
                const char = CHARACTER_MAP[id];
                if (!char) return null;
                return (
                  <div
                    key={id}
                    className="shrink-0 rounded-xl p-2.5 flex flex-col items-center text-center cursor-pointer hover:bg-white/[0.06] transition-colors"
                    style={{ backgroundColor: '#1a1a1a', minWidth: 72, border: '1px solid rgba(255,255,255,0.05)' }}
                    onClick={() => onCharacterTap?.(id)}
                  >
                    <img
                      src={char.avatar}
                      alt={char.shortName}
                      className="w-10 h-10 rounded-full object-cover mb-1"
                      style={{ border: `2px solid ${char.color}` }}
                    />
                    <span className="text-[10px] text-gray-200 font-medium mb-0.5">{char.shortName}</span>
                    <StarRating rating={CHAR_RATINGS[id] ?? 3} />
                  </div>
                );
              })}
            </div>
          </section>

          {/* ═══ 能量道状态卡（严格参考原型） ═══ */}
          <section>
            <h3
              className="text-center mb-3"
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: 'rgba(255,255,255,0.5)',
                letterSpacing: 4,
                fontFamily: 'system-ui, -apple-system, sans-serif',
                textTransform: 'uppercase',
              }}
            >
              能量道 · Energy Path
            </h3>
            <p style={{
              textAlign: 'center',
              fontSize: 12,
              color: '#888',
              marginTop: -6,
              marginBottom: 10,
              letterSpacing: 1,
            }}>
              实时检测能量状态
            </p>
            <div
              className="relative overflow-hidden cursor-pointer"
              onClick={onGrowth}
              style={{
                height: 140,
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.07)',
                background: '#111111',
              }}
            >
              {/* 背景日出光晕 SVG */}
              <div className="absolute inset-0 z-0" style={{ filter: 'blur(2px) saturate(1.05)' }}>
                <svg viewBox="0 0 500 160" preserveAspectRatio="none" className="w-full h-full">
                  <defs>
                    <radialGradient id="sunGrad" cx="40%" cy="15%">
                      <stop offset="0%" stopColor="#FFD98A" />
                      <stop offset="45%" stopColor="#FF9248" />
                      <stop offset="100%" stopColor="#7B1212" />
                    </radialGradient>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#sunGrad)" />
                </svg>
              </div>

              {/* 山峦剪影 */}
              <svg
                className="absolute bottom-0 left-0 w-full z-[1]"
                style={{ height: 50 }}
                viewBox="0 0 500 80"
                preserveAspectRatio="none"
              >
                <path d="M0,60 C40,30 90,70 150,55 C200,40 260,75 320,50 C380,25 440,65 500,55 L500,80 L0,80 Z" fill="#0d122e" />
              </svg>

              {/* 主内容区 */}
              <div className="relative z-[2] flex flex-col h-full px-3">
                {/* 圆环区 */}
                <div className="flex justify-around items-center flex-1 pt-2.5 pb-1">
                  {/* 当前能量（大圆环 96px） */}
                  <div className="flex items-center justify-center">
                    <div
                      className="rounded-full flex items-center justify-center"
                      style={{
                        width: 96, height: 96,
                        background: `conic-gradient(#00C896 0deg, #00C896 ${Math.round(energyData.currentEnergy * 3.6)}deg, rgba(255,255,255,0.06) ${Math.round(energyData.currentEnergy * 3.6)}deg)`,
                        boxShadow: 'inset 0 0 20px rgba(0,200,150,0.06), 0 4px 15px rgba(0,0,0,0.2)',
                        border: '1px solid rgba(0,200,150,0.1)',
                      }}
                    >
                      <div
                        className="rounded-full flex items-center justify-center"
                        style={{
                          width: 74, height: 74,
                          background: 'rgba(10,14,39,0.7)',
                          boxShadow: '0 6px 20px rgba(7,10,22,0.8), inset 0 0 8px rgba(0,200,150,0.1)',
                          color: '#00C896', fontSize: 22, fontWeight: 700,
                        }}
                      >
                        {energyData.currentEnergy > 0 ? `${energyData.currentEnergy}%` : '--'}
                      </div>
                    </div>
                  </div>

                  {/* 测试进度（小圆环 74px） */}
                  <div className="flex items-center justify-center">
                    <div
                      className="rounded-full flex items-center justify-center"
                      style={{
                        width: 74, height: 74,
                        background: `conic-gradient(#00C896 0deg, #00C896 ${Math.round(Math.min(energyData.completedCount, 20) / 20 * 360)}deg, rgba(255,255,255,0.06) ${Math.round(Math.min(energyData.completedCount, 20) / 20 * 360)}deg)`,
                        boxShadow: 'inset 0 0 20px rgba(0,200,150,0.06), 0 4px 15px rgba(0,0,0,0.2)',
                        border: '1px solid rgba(0,200,150,0.1)',
                      }}
                    >
                      <div
                        className="rounded-full flex items-center justify-center"
                        style={{
                          width: 56, height: 56,
                          background: 'rgba(10,14,39,0.7)',
                          boxShadow: '0 6px 20px rgba(7,10,22,0.8), inset 0 0 8px rgba(0,200,150,0.1)',
                          color: '#00C896', fontSize: 14, fontWeight: 700,
                        }}
                      >
                        {Math.min(energyData.completedCount, 20)}/20
                      </div>
                    </div>
                  </div>

                  {/* 连续天数（小圆环 74px） */}
                  <div className="flex items-center justify-center">
                    <div
                      className="rounded-full flex items-center justify-center"
                      style={{
                        width: 74, height: 74,
                        background: `conic-gradient(#00C896 0deg, #00C896 ${Math.round(Math.min(energyData.streakDays, 30) / 30 * 360)}deg, rgba(255,255,255,0.06) ${Math.round(Math.min(energyData.streakDays, 30) / 30 * 360)}deg)`,
                        boxShadow: 'inset 0 0 20px rgba(0,200,150,0.06), 0 4px 15px rgba(0,0,0,0.2)',
                        border: '1px solid rgba(0,200,150,0.1)',
                      }}
                    >
                      <div
                        className="rounded-full flex flex-col items-center justify-center"
                        style={{
                          width: 56, height: 56,
                          background: 'rgba(10,14,39,0.7)',
                          boxShadow: '0 6px 20px rgba(7,10,22,0.8), inset 0 0 8px rgba(0,200,150,0.1)',
                        }}
                      >
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 400, lineHeight: 1.2, marginBottom: 2 }}>连续</span>
                        <span style={{ fontSize: 22, fontWeight: 700, color: '#00C896', textShadow: '0 0 8px rgba(0,200,150,0.5)', lineHeight: 1.2 }}>{energyData.streakDays}天</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 底部标签行 */}
                <div className="flex justify-around items-center" style={{ height: 50 }}>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>当前能量</span>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>测试进度</span>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>连续天数</span>
                </div>
              </div>
            </div>
          </section>

        </main>
      </div>

      {/* 底部导航由 AppNavigator 统一管理 */}
    </div>
  );
}

// ═══════════════════════════════════════════
// Hero 状态组件（保留 FMSession 逻辑）
// ═══════════════════════════════════════════
function HeroActive({ metrics, session, onResume }: {
  metrics: ReturnType<typeof computeMetrics>; session: FMSession; onResume: () => void;
}) {
  return (
    <section className="premium-card rounded-3xl p-7 cursor-pointer" onClick={onResume}>
      <div className="flex items-center gap-2 mb-5">
        <div className="w-2 h-2 rounded-full bg-emerald-400" style={{ animation: 'emotionPulse 2s ease-in-out infinite' }} />
        <span className="text-xs tracking-widest text-gray-400">实战进行中</span>
      </div>
      <div className="text-center mb-4">
        <div className="text-5xl font-extrabold font-serif-cn" style={{ color: metrics.net_pnl >= 0 ? '#D4AF37' : '#EF4444' }}>
          {metrics.net_pnl >= 0 ? '+' : ''}{metrics.net_pnl}
        </div>
      </div>
      <div className="flex justify-center gap-4 text-xs mb-6 text-gray-400">
        <span>{metrics.total_hands}手</span>
        <span className="text-gray-600">·</span>
        <span>{Math.round(metrics.elapsed_minutes)}分钟</span>
        <span className="text-gray-600">·</span>
        <span>距止损 {metrics.distance_to_stop_loss}</span>
      </div>
      <button
        className="v4-btn-shine w-full font-bold py-4 rounded-xl active:scale-[0.98] transition-all"
        style={{
          background: 'linear-gradient(to right, #D4AF37, #CA8A04)',
          color: '#000', letterSpacing: 6, fontSize: 16,
          border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          boxShadow: '0 4px 20px rgba(212,175,55,0.3)',
        }}
      >
        回到本场
      </button>
    </section>
  );
}

function HeroJustEnded({ session, metrics, onReview }: {
  session: FMSession; metrics: ReturnType<typeof computeMetrics>; onReview: () => void;
}) {
  const score = session.review?.discipline_score;
  return (
    <section className="premium-card rounded-3xl p-7 cursor-pointer" onClick={onReview}>
      <p className="text-lg font-bold mb-5 font-serif-cn text-gray-100 tracking-wide">
        这一场结束了
      </p>
      <div className="flex justify-center gap-10 mb-5">
        <div className="text-center">
          <div className="text-xs mb-1.5 text-gray-400 tracking-wide">净结果</div>
          <div className="text-4xl font-extrabold font-serif-cn" style={{ color: metrics.net_pnl >= 0 ? '#D4AF37' : '#EF4444' }}>
            {metrics.net_pnl >= 0 ? '+' : ''}{metrics.net_pnl}
          </div>
        </div>
        {score != null && (
          <div className="text-center">
            <div className="text-xs mb-1.5 text-gray-400 tracking-wide">纪律分</div>
            <div className="text-4xl font-extrabold font-serif-cn" style={{ color: score >= 80 ? '#D4AF37' : score >= 60 ? '#F59E0B' : '#EF4444' }}>
              {score}
            </div>
          </div>
        )}
      </div>
      <button
        className="v4-btn-shine w-full font-bold py-4 rounded-xl active:scale-[0.98] transition-all"
        style={{
          background: 'linear-gradient(to right, #D4AF37, #CA8A04)',
          color: '#000', letterSpacing: 6, fontSize: 16,
          border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          boxShadow: '0 4px 20px rgba(212,175,55,0.3)',
        }}
      >
        查看本场复盘
      </button>
    </section>
  );
}
