import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft, Plus, Minus, Send, Mic, MicOff,
  AlertTriangle, Clock, TrendingUp, TrendingDown,
  X, Octagon, ChevronUp, ChevronDown,
} from 'lucide-react';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import {
  subscribeFM, getActiveSession, addEvent,
  endSession, pauseSession, resumeSession, addAlerts, dismissAlert, getSettings,
} from '../../services/fundManagerService';
import {
  computeMetrics, checkAlerts, generateEventFeedback,
} from '../../services/fundManagerEngine';
import {
  computeEmotion, resetEmotionCooldown, loadEmotionProfile,
  resetETPState,
} from '../../services/emotionEngine';
import { sendEmotionPush } from '../../services/pushService';
import type { EmotionState } from '../../services/emotionEngine';
import {
  evaluateLiveETP, recordInterventionShown, recordInterventionResponse,
  onSessionStart,
} from '../../services/dataPipeline';
import type { InterventionResult } from '../../services/interventionEngine';
import type { EvaluationResult } from '../../types/riskConfig';
import { resetInterventionFatigue } from '../../services/interventionEngine';
import EmotionIntervention from '../EmotionIntervention';
import EmotionPanel from './EmotionPanel';
import { detectActiveScene, resetSceneState, computeGrindingState } from '../../services/sceneDetector';
import type { ActiveScene } from '../../services/sceneDetector';
import FMDangerCheckView, { computeRiskLevel as computeSelfCheckRiskLevel } from './FMDangerCheckView';
import RiskControlPanel from './RiskControlPanel';
import { saveSelfCheckLog } from '../../services/selfCheckService';
import { getCurrentUserId } from '../../services/supabaseClient';
import { theme, FM_COLORS } from '../../theme';
import type { FMSession, FMAlert, FMMetrics, SelfCheckResult } from '../../types/fundManager';
import { callAgentRisk } from '../../services/agentRiskService';

interface FMRecordingViewProps {
  onBack: () => void;
  onEnd: (sessionId: string) => void;
}

const ALERT_COLORS: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  early_warning: { bg: 'rgba(253,224,71,0.10)', border: 'rgba(253,224,71,0.25)', text: '#FDE047', icon: '#D97706' },
  formal_alert:  { bg: 'rgba(251,146,60,0.10)', border: 'rgba(251,146,60,0.25)', text: '#FB923C', icon: '#EA580C' },
  strong_alert:  { bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.25)', text: '#F87171', icon: '#DC2626' },
};

// CURRENCY_SYMBOLS removed — 不再显示货币符号

// ── SBI 紧急刹车常量 ──

interface SBIReason {
  id: string;
  emoji: string;
  label: string;
  category: 'physical' | 'emotional' | 'environmental';
}

const SBI_REASONS: SBIReason[] = [
  { id: 'dizzy',     emoji: '🫨', label: '头晕 / 恶心',       category: 'physical' },
  { id: 'heartbeat', emoji: '🫀', label: '心跳加速',          category: 'physical' },
  { id: 'sweat',     emoji: '🫗', label: '手心出汗',          category: 'physical' },
  { id: 'anger',     emoji: '🔥', label: '情绪愤怒 / 冲动',   category: 'emotional' },
  { id: 'fatigue',   emoji: '🌫️', label: '注意力下降 / 疲劳', category: 'emotional' },
  { id: 'tilt',      emoji: '🌀', label: '想翻本 / 失去理性', category: 'emotional' },
  { id: 'provoke',   emoji: '🪬', label: '外界干扰 / 挑衅',   category: 'environmental' },
  { id: 'other',     emoji: '◌', label: '其他',              category: 'environmental' },
];

const CALMING_QUOTES = [
  '赌桌永远在那里，但你的冷静只有这一次。',
  '深呼吸，感受自己的心跳正在平稳下来。',
  '退一步，让理性重新掌控方向盘。',
  '能在关键时刻按下刹车，就是最大的赢。',
  '此刻的暂停，是对未来自己的最好投资。',
  '状态失控的玩家，永远是赌场最喜欢的玩家。',
];

const SBI_CATEGORY_LABELS: Record<string, string> = {
  physical: '身体信号',
  emotional: '情绪信号',
  environmental: '其他',
};

// ── AR方向2-P2: 情绪轨迹模式识别 ──

type TrajectoryPattern = 'stable' | 'deteriorating' | 'false_calm' | 'recovering' | 'volatile';

/**
 * 从情绪分数序列中识别轨迹模式。
 * scores: 从旧到新排列，每条是 emotion.score (0-100, 高=更激活)。
 * 至少需要 4 条才有意义；不足时返回 'stable'。
 */
function computeTrajectoryPattern(scores: number[]): TrajectoryPattern {
  if (scores.length < 4) return 'stable';

  const n = scores.length;
  const recent = scores.slice(-4);          // 最近4条
  const earlier = scores.slice(-8, -4);     // 前4条（若存在）

  // 计算最近趋势（线性斜率代理：后半均值 - 前半均值）
  const half = Math.floor(n / 2);
  const firstHalfAvg = scores.slice(0, half).reduce((s, v) => s + v, 0) / half;
  const secondHalfAvg = scores.slice(half).reduce((s, v) => s + v, 0) / (n - half);
  const trend = secondHalfAvg - firstHalfAvg;  // 正=上升(恶化), 负=下降(好转)

  // 波动率（标准差代理：最大差值）
  const max = Math.max(...scores);
  const min = Math.min(...scores);
  const range = max - min;

  // 假平静检测：整体分数在低区（<35），但近期刚出现大幅波动
  const recentMax = Math.max(...recent);
  const recentRange = Math.max(...recent) - Math.min(...recent);
  if (secondHalfAvg < 35 && recentMax >= 55 && recentRange >= 20) {
    return 'false_calm';
  }

  // 波动型：最大差值 >= 35 且近期仍有波动
  if (range >= 35 && recentRange >= 20) return 'volatile';

  // 恶化：明显上升趋势且近期均值偏高
  if (trend >= 15 && secondHalfAvg >= 50) return 'deteriorating';

  // 好转：明显下降趋势
  if (trend <= -15 && secondHalfAvg < 50) return 'recovering';

  // 之前高位，近期平复（早期均值高，近期低）
  if (earlier.length >= 4) {
    const earlierAvg = earlier.reduce((s, v) => s + v, 0) / earlier.length;
    const recentAvg = recent.reduce((s, v) => s + v, 0) / recent.length;
    if (earlierAvg >= 55 && recentAvg < 40) return 'recovering';
  }

  return 'stable';
}

// ── 解析用户下注输入 ──

interface PendingBet {
  type: 'win' | 'loss';
  amount: number;
  rawText: string;
}

function parseBetInput(text: string): PendingBet | null {
  const lower = text.trim().toLowerCase();
  const isWin = /赢|盈|win|\+[0-9]/.test(lower);
  const isLoss = /输|亏|lose|loss|\-[0-9]/.test(lower);
  if (!isWin && !isLoss) return null;

  // 提取金额
  const numMatch = lower.match(/[\d,]+(\.\d+)?/);
  let amount: number | null = null;
  if (numMatch) {
    amount = parseFloat(numMatch[0].replace(/,/g, ''));
  } else {
    // 中文数字
    const cnMap: Record<string, number> = {
      '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5,
      '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
      '百': 100, '千': 1000, '万': 10000,
    };
    const cnMatch = lower.match(/([一二两三四五六七八九十百千万]+)/);
    if (cnMatch) {
      let result = 0; let current = 0;
      for (const char of cnMatch[1]) {
        const val = cnMap[char];
        if (!val) continue;
        if (val >= 10) {
          if (current === 0) current = 1;
          if (val === 10000) { result = (result + current) * val; current = 0; }
          else { current *= val; result += current; current = 0; }
        } else { current = val; }
      }
      result += current;
      if (result > 0) amount = result;
    }
  }

  if (!amount || amount <= 0) return null;
  return { type: isWin ? 'win' : 'loss', amount, rawText: text.trim() };
}

// ── 风险等级 → 卡片渐变色 ──

function computeRiskLevel(
  m: FMMetrics,
  plan: { stop_loss_amount: number; stop_loss_streak_warn: number; max_duration_minutes: number; stop_loss_net_hands?: number },
): number {
  let risk = 0;
  // 距止损比例
  if (plan.stop_loss_amount > 0) {
    const lossRatio = 1 - m.distance_to_stop_loss / plan.stop_loss_amount;
    risk = Math.max(risk, Math.max(0, lossRatio));
  }
  // 连输比例
  if (plan.stop_loss_streak_warn > 0) {
    const streakRatio = m.current_loss_streak / plan.stop_loss_streak_warn;
    risk = Math.max(risk, Math.min(1, streakRatio * 0.7));
  }
  // 时间比例
  if (plan.max_duration_minutes > 0) {
    const timeRatio = m.elapsed_minutes / plan.max_duration_minutes;
    if (timeRatio > 0.8) risk = Math.max(risk, Math.min(1, (timeRatio - 0.8) * 3));
  }
  // 净输手数比例
  if (plan.stop_loss_net_hands && plan.stop_loss_net_hands > 0 && m.net_loss_hands > 0) {
    const netHandsRatio = m.net_loss_hands / plan.stop_loss_net_hands;
    risk = Math.max(risk, Math.min(1, netHandsRatio * 0.8));
  }
  return Math.min(1, Math.max(0, risk));
}

function getRiskGradient(risk: number): string {
  if (risk < 0.25) return 'linear-gradient(135deg, #1B3A4B, #2D6A4F)'; // 安全：蓝绿
  if (risk < 0.45) return 'linear-gradient(135deg, #3D5A3B, #5C7A2F)'; // 注意：黄绿
  if (risk < 0.60) return 'linear-gradient(135deg, #7A6B14, #A08C20)'; // 警告：琥珀
  if (risk < 0.75) return 'linear-gradient(135deg, #B5651D, #D2691E)'; // 危险：橙
  if (risk < 0.90) return 'linear-gradient(135deg, #C0392B, #E74C3C)'; // 高危：红
  return 'linear-gradient(135deg, #8B0000, #DC2626)';                  // 极度危险：深红
}

// ── 告警声音 + 震动 ──

function playAlarmSound(level: string) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'square';
    gain.gain.value = 0.3;

    if (level === 'strong_alert') {
      osc.frequency.value = 880;
      osc.start();
      // 3段急促蜂鸣
      setTimeout(() => (gain.gain.value = 0), 200);
      setTimeout(() => (gain.gain.value = 0.3), 300);
      setTimeout(() => (gain.gain.value = 0), 500);
      setTimeout(() => (gain.gain.value = 0.3), 600);
      setTimeout(() => (gain.gain.value = 0), 900);
      setTimeout(() => (gain.gain.value = 0.3), 1000);
      setTimeout(() => { osc.stop(); ctx.close(); }, 1300);
    } else if (level === 'formal_alert') {
      osc.frequency.value = 660;
      osc.start();
      setTimeout(() => (gain.gain.value = 0), 200);
      setTimeout(() => (gain.gain.value = 0.3), 300);
      setTimeout(() => { osc.stop(); ctx.close(); }, 600);
    } else {
      osc.frequency.value = 440;
      osc.start();
      setTimeout(() => { osc.stop(); ctx.close(); }, 300);
    }
  } catch (_e) { /* AudioContext not available */ }
}

function triggerVibration(level: string) {
  try {
    if ('vibrate' in navigator) {
      if (level === 'strong_alert') {
        navigator.vibrate([200, 100, 200, 100, 400]); // 长强震
      } else if (level === 'formal_alert') {
        navigator.vibrate([200, 100, 200]); // 双震
      } else {
        navigator.vibrate([150]); // 短震
      }
    }
  } catch (_e) { /* vibration not available */ }
}

export default function FMRecordingView({ onBack, onEnd }: FMRecordingViewProps) {
  const [session, setSession] = useState<FMSession | null>(null);
  const [metrics, setMetrics] = useState<FMMetrics | null>(null);
  const [betAmount, setBetAmount] = useState<number>(0);
  const [betStep, setBetStep] = useState<number>(0); // 0 = 未初始化，init时设为 base_unit
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [endNote, setEndNote] = useState('');
  const [departureReason, setDepartureReason] = useState<string | null>(null);
  const [activeAlert, setActiveAlert] = useState<FMAlert | null>(null);
  const alertQueueRef = useRef<FMAlert[]>([]);
  const [stopLossIntercept, setStopLossIntercept] = useState<FMAlert | null>(null);
  const [stopLossReason, setStopLossReason] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [, setTick] = useState(0);

  // ── 情绪引擎状态 ──
  const [emotionState, setEmotionState] = useState<EmotionState | null>(null);
  const [interventionResult, setInterventionResult] = useState<InterventionResult | null>(null);
  const [riskResult, setRiskResult] = useState<EvaluationResult | null>(null);
  const [activeScene, setActiveScene] = useState<ActiveScene | null>(null);
  const [showEmotionIntervention, setShowEmotionIntervention] = useState(false);
  const [emotionPanelOpen, setEmotionPanelOpen] = useState(true);
  const [dashboardExpanded, setDashboardExpanded] = useState(false);

  // ── AR方向2-P1: 情绪快照队列（最近20条，30秒采样）──
  const emotionSnapshotsRef = useRef<number[]>([]);
  const [trajectoryPattern, setTrajectoryPattern] = useState<'stable' | 'deteriorating' | 'false_calm' | 'recovering' | 'volatile'>('stable');
  const planCardRef = useRef<HTMLDivElement>(null);

  // ── 语音/文字输入状态 ──
  const [voiceInputText, setVoiceInputText] = useState('');
  const [pendingBet, setPendingBet] = useState<PendingBet | null>(null);

  // 语音
  const {
    transcript, interimTranscript, isListening, isSupported,
    startListening, stopListening, resetTranscript,
    error: speechError,
  } = useSpeechRecognition('zh-CN');

  // ── SBI 状态 ──
  const [showSBI, setShowSBI] = useState(false);
  const [sbiReason, setSbiReason] = useState<string | null>(null);
  const [sbiCustomText, setSbiCustomText] = useState('');
  const [sbiCooldown, setSbiCooldown] = useState(0);
  const [sbiCooldownActive, setSbiCooldownActive] = useState(false);
  const [sbiPostCooldown, setSbiPostCooldown] = useState(false);
  const [sbiQuote, setSbiQuote] = useState('');
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wasPausedBeforeSBIRef = useRef(false); // 记录SBI前是否已暂停

  // ── 即时自检状态 ──
  const [showLiveCheck, setShowLiveCheck] = useState(false);
  const wasPausedBeforeCheckRef = useRef(false);


  // 新场次时重置情绪冷却 + ETP 状态 + 加载用户情绪 profile + 初始化管道
  useEffect(() => {
    resetEmotionCooldown();
    resetETPState();
    resetInterventionFatigue();
    resetSceneState();
    const settings = getSettings();
    if (settings.emotion_profile) {
      loadEmotionProfile(settings.emotion_profile);
    }
    // 初始化数据管道 tracker
    const active = getActiveSession();
    if (active) {
      onSessionStart(active.id);
    }
  }, []);

  // 定时刷新（每秒更新，倒计时实时走）
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // AR方向2-P1: 每30秒采集情绪快照，维护最近20条
  useEffect(() => {
    const timer = setInterval(() => {
      if (!emotionState) return;
      const q = emotionSnapshotsRef.current;
      q.push(emotionState.score);
      if (q.length > 20) q.shift();
      setTrajectoryPattern(computeTrajectoryPattern(q));
    }, 30_000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emotionState]);

  useEffect(() => {
    let isRefreshing = false; // 防递归：evaluateLiveETP 内部 addEvent 会同步触发 subscribeFM
    const refresh = () => {
      if (isRefreshing) return; // 跳过递归调用
      isRefreshing = true;
      try {
      const active = getActiveSession();
      setSession(active);
      if (active) {
        const m = computeMetrics(active);
        setMetrics(m);
        setBetAmount(prev => prev || active.plan.base_unit);
        setBetStep(prev => prev || 100);

        // 检查新告警
        const newAlerts = checkAlerts(active, m);
        if (newAlerts.length > 0) {
          addAlerts(active.id, newAlerts);
          // 按优先级排序，建立告警队列
          const sorted = [...newAlerts].sort((a, b) => {
            const order = { strong_alert: 3, formal_alert: 2, early_warning: 1 };
            return (order[b.level] || 0) - (order[a.level] || 0);
          });
          // 存储完整队列，显示最高级别
          alertQueueRef.current = sorted;
          setActiveAlert(sorted[0]);
          playAlarmSound(sorted[0].level);
          triggerVibration(sorted[0].level);
        }

        // 情绪引擎计算（报警级别回灌：强烈警告→情绪底分60，正式提醒→底分40）
        const emo = computeEmotion(active, m);
        const highestAlertLevel = (() => {
          const allAlerts = [...(newAlerts || []), ...(active.alerts || [])];
          if (allAlerts.some(a => a.level === 'strong_alert')) return 'strong_alert';
          if (allAlerts.some(a => a.level === 'formal_alert')) return 'formal_alert';
          return null;
        })();
        const alertFloor = highestAlertLevel === 'strong_alert' ? 60
          : highestAlertLevel === 'formal_alert' ? 40
          : 0;
        if (emo.score < alertFloor) {
          emo.score = alertFloor;
          emo.level = emo.score <= 30 ? 'calm' : emo.score <= 50 ? 'mild' : emo.score <= 75 ? 'moderate' : 'severe';
        }
        setEmotionState(emo);

        // 管道 1+2: 实时 ETP 评估 + 干预评估（原始引擎先跑，得到基线 level）
        const { interventionResult: iv, riskResult: rr } = evaluateLiveETP(active, m, emo);
        if (rr) {
          setRiskResult(rr);
        }
        // 场景识别 — 从原始数据直接判断，引擎结果只升级级别
        const scene = detectActiveScene(rr ?? null, m, active.plan, active);
        setActiveScene(scene);

        // emotion level >= mild 时自动展开情绪面板
        if (emo.level !== 'calm') {
          setEmotionPanelOpen(true);
        }

        // ── 三Agent系统：L2+ 时异步调用，覆盖干预结果 ──────────
        const baseLevel = rr?.interventionLevel ?? iv.level;
        if (['L2', 'L3', 'L4'].includes(baseLevel)) {
          // 先用原始引擎结果展示（避免用户等待空白）
          setInterventionResult(iv);
          if (iv.triggered) {
            setShowEmotionIntervention(true);
          }
          // 异步调用三Agent，完成后更新为更丰富的 AI 分析
          callAgentRisk(m, active.plan, active.events, baseLevel).then(agentResult => {
            if (agentResult) {
              setInterventionResult(agentResult.interventionResult);
              // 同步更新 riskResult 的关键指标（供 RiskControlPanel 显示）
              if (rr) {
                setRiskResult({
                  ...rr,
                  survivalProb: agentResult.keyMetrics.survivalProb,
                  collapseProb: agentResult.keyMetrics.collapseProb,
                  interventionLevel: agentResult.level,
                });
              }
              if (agentResult.triggered && !showEmotionIntervention) {
                recordInterventionShown(active.id, agentResult.interventionResult);
                setShowEmotionIntervention(true);
              }
            }
          }).catch(() => {/* 静默失败，保持原始引擎结果 */});
        } else {
          // L0/L1：直接使用原始引擎结果
          setInterventionResult(iv);
          if (iv.triggered) {
            recordInterventionShown(active.id, iv);
            setShowEmotionIntervention(true);
          }
        }

        // 后台推送：app 不在前台时发送情绪预警
        if (emo.level === 'moderate' || emo.level === 'severe') {
          sendEmotionPush(emo.level, emo.intervention || emo.signals[0]?.description || '情绪波动，请注意控制');
        }
      }
      } finally {
        isRefreshing = false;
      }
    };
    refresh();
    const unsub = subscribeFM(refresh);
    return unsub;
  }, []);

  // ── 语音停止后自动解析 ──
  useEffect(() => {
    if (!isListening && transcript.trim()) {
      const parsed = parseBetInput(transcript.trim());
      if (parsed) {
        setPendingBet(parsed);
      } else {
        setFeedback(`没听懂"${transcript.trim()}"，请说"赢XX"或"输XX"`);
        setTimeout(() => setFeedback(null), 3000);
      }
      resetTranscript();
    }
  }, [isListening, transcript, resetTranscript]);

  // ── 文字发送 ──
  const handleVoiceSend = () => {
    const text = voiceInputText.trim();
    if (!text) return;
    setVoiceInputText('');
    const parsed = parseBetInput(text);
    if (parsed) {
      // 同步码量显示，避免语音录入金额与界面显示不一致
      setBetAmount(parsed.amount);
      setPendingBet(parsed);
    } else {
      setFeedback(`没理解"${text}"，请输入"赢200"或"输100"`);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  // 止损线拦截：这三个 rule_key 触碰后不能直接关闭，需要写理由
  const STOP_LOSS_KEYS = ['stop_loss_hit', 'streak_hit', 'net_hands_hit'];

  const doDismissAlert = useCallback((alert: FMAlert) => {
    if (session) dismissAlert(session.id, alert.id);
    const queue = alertQueueRef.current.filter(a => a.id !== alert.id);
    alertQueueRef.current = queue;
    setActiveAlert(queue.length > 0 ? queue[0] : null);
  }, [session]);

  // ── 告警关闭回调（修复Bug: 标记dismissed + 队列弹出下一个）──
  const handleDismissAlert = useCallback((alert: FMAlert) => {
    // 止损线告警：拦截，先要求写理由才能继续
    if (alert.level === 'strong_alert' && STOP_LOSS_KEYS.includes(alert.rule_key || '')) {
      setStopLossIntercept(alert);
      setStopLossReason('');
      return;
    }
    doDismissAlert(alert);
  }, [doDismissAlert]);

  // ── 确认语音下注 ──
  const handleBetConfirm = useCallback(() => {
    if (!session || !pendingBet) return;
    addEvent(session.id, {
      event_type: pendingBet.type,
      amount: pendingBet.amount,
      bet_unit: betAmount,
      timestamp: new Date().toISOString(),
    });
    const refreshed = getActiveSession();
    if (refreshed) {
      const m = computeMetrics(refreshed);
      const lastEvt = refreshed.events[refreshed.events.length - 1];
      if (lastEvt) {
        setFeedback(generateEventFeedback(lastEvt, m, refreshed.plan));
        setTimeout(() => setFeedback(null), 3000);
      }

    }
    setPendingBet(null);
  }, [session, pendingBet, betAmount, riskResult, activeScene]);

  const handleBetCancel = () => setPendingBet(null);

  // Fix: 先记录事件再改状态，避免状态检测反转
  const handlePause = () => {
    if (!session) return;
    if (session.status === 'paused') {
      addEvent(session.id, {
        event_type: 'resume',
        timestamp: new Date().toISOString(),
      });
      resumeSession(session.id);
    } else {
      addEvent(session.id, {
        event_type: 'pause',
        timestamp: new Date().toISOString(),
      });
      pauseSession(session.id);
    }
  };

  const handleEnd = () => {
    if (!session) return;
    // 记录离场动机（如果用户选择了继续后又决定离场）
    const note = [departureReason ? `离场动机: ${departureReason}` : '', endNote].filter(Boolean).join(' | ');
    endSession(session.id, note || undefined);
    setShowEndConfirm(false);
    setDepartureReason(null);
    onEnd(session.id);
  };

  const handleContinueAfterFriction = () => {
    // 用户选择继续，记录动机事件后关闭弹窗
    if (!session || !departureReason) return;
    addEvent(session.id, {
      event_type: 'note',
      note: `选择继续: ${departureReason}`,
      timestamp: new Date().toISOString(),
    });
    setShowEndConfirm(false);
    setDepartureReason(null);
  };

  // ── SBI 处理函数 ──

  const handleSBITrigger = useCallback(() => {
    if (!session) return;
    // 记录SBI前是否已暂停
    wasPausedBeforeSBIRef.current = session.status === 'paused';
    // 1. 自动暂停
    if (session.status !== 'paused') {
      addEvent(session.id, {
        event_type: 'pause',
        timestamp: new Date().toISOString(),
        note: 'SBI_AUTO_PAUSE',
      });
      pauseSession(session.id);
    }
    // 2. 打开选择面板
    setShowSBI(true);
    setSbiReason(null);
    setSbiCustomText('');
  }, [session]);

  const handleSBIConfirm = useCallback(() => {
    if (!session || !sbiReason) return;
    const reasonObj = SBI_REASONS.find(r => r.id === sbiReason);
    const reasonText = sbiReason === 'other'
      ? (sbiCustomText.trim() || '其他')
      : (reasonObj?.label || sbiReason);

    // 3. 记录 emotion 事件
    addEvent(session.id, {
      event_type: 'emotion',
      note: `紧急刹车: ${reasonText}`,
      timestamp: new Date().toISOString(),
    });

    // 3.5 记录到 dataPipeline（SBI 作为 severe 干预）
    recordInterventionShown(session.id, {
      triggered: true,
      level: 'L3',
      ui_mode: 'fullscreen',
      title: '紧急刹车',
      message: `身心信号: ${reasonText}`,
      pool_key: 'sbi_emergency',
      trigger_type: 'sbi_emergency',
      actions: [
        { key: 'sbi_confirm', text: '确认刹车' },
      ],
    });
    recordInterventionResponse(session.id, 'sbi_confirm');

    // 4. 进入冷静期
    setShowSBI(false);
    setSbiQuote(CALMING_QUOTES[Math.floor(Math.random() * CALMING_QUOTES.length)]);
    setSbiCooldown(60);
    setSbiCooldownActive(true);
  }, [session, sbiReason, sbiCustomText]);

  const handleSBIContinue = useCallback(() => {
    if (!session) return;
    addEvent(session.id, {
      event_type: 'resume',
      timestamp: new Date().toISOString(),
      note: 'SBI_COOLDOWN_RESUME',
    });
    // 记录 SBI 冷静后继续的选择
    recordInterventionResponse(session.id, 'sbi_continue');
    resumeSession(session.id);
    setSbiPostCooldown(false);
    setSbiCooldownActive(false);
  }, [session]);

  const handleSBIEnd = useCallback(() => {
    // 记录 SBI 后选择结束
    if (session) recordInterventionResponse(session.id, 'sbi_end_session');
    setSbiPostCooldown(false);
    setSbiCooldownActive(false);
    setShowEndConfirm(true);
  }, [session]);

  // ── 即时自检处理 ──

  const handleLiveCheckOpen = useCallback(() => {
    if (!session) return;
    // 记录当前是否已暂停
    wasPausedBeforeCheckRef.current = session.status === 'paused';
    // 自动暂停
    if (session.status !== 'paused') {
      addEvent(session.id, {
        event_type: 'pause',
        timestamp: new Date().toISOString(),
        note: 'SELF_CHECK_AUTO_PAUSE',
      });
      pauseSession(session.id);
    }
    setShowLiveCheck(true);
  }, [session]);

  const handleLiveCheckConfirm = useCallback((checkedIds: string[]) => {
    if (!session) return;
    const riskLvl = computeSelfCheckRiskLevel(checkedIds, 'live');
    const result: SelfCheckResult = {
      mode: 'live',
      trigger: 'manual',
      checked_ids: checkedIds,
      risk_level: riskLvl,
      timestamp: new Date().toISOString(),
    };
    addEvent(session.id, {
      event_type: 'self_check',
      note: `即时自检: ${checkedIds.length} 项 [${checkedIds.join(',')}]`,
      self_check_result: result,
      timestamp: new Date().toISOString(),
    });
    // 写入结构化自检日志
    saveSelfCheckLog({
      user_id: getCurrentUserId() || 'local',
      session_id: session.id,
      mode: 'live',
      trigger: 'manual',
      checked_ids: checkedIds,
      risk_level: riskLvl,
      session_hand_count: metrics?.total_hands ?? 0,
      session_pnl: metrics?.net_pnl ?? 0,
      session_elapsed_min: Math.floor(metrics?.elapsed_minutes ?? 0),
      action_taken: 'continue',
      created_at: new Date().toISOString(),
    });
    setShowLiveCheck(false);
    // 恢复之前非暂停状态
    if (!wasPausedBeforeCheckRef.current) {
      addEvent(session.id, {
        event_type: 'resume',
        timestamp: new Date().toISOString(),
        note: 'SELF_CHECK_RESUME',
      });
      resumeSession(session.id);
    }
  }, [session, metrics]);

  const handleLiveCheckBack = useCallback(() => {
    if (!session) return;
    setShowLiveCheck(false);
    // 恢复之前非暂停状态
    if (!wasPausedBeforeCheckRef.current) {
      addEvent(session.id, {
        event_type: 'resume',
        timestamp: new Date().toISOString(),
        note: 'SELF_CHECK_RESUME',
      });
      resumeSession(session.id);
    }
  }, [session]);

  const handleLiveCheckEndSession = useCallback((checkedIds: string[]) => {
    // 用户在自检中直接选择结束本场 → action_taken = 'end_session'
    if (session) {
      const riskLvl = computeSelfCheckRiskLevel(checkedIds, 'live');
      const result: SelfCheckResult = {
        mode: 'live',
        trigger: 'manual',
        checked_ids: checkedIds,
        risk_level: riskLvl,
        timestamp: new Date().toISOString(),
      };
      addEvent(session.id, {
        event_type: 'self_check',
        note: `即时自检(结束): ${checkedIds.length} 项 [${checkedIds.join(',')}]`,
        self_check_result: result,
        timestamp: new Date().toISOString(),
      });
      saveSelfCheckLog({
        user_id: getCurrentUserId() || 'local',
        session_id: session.id,
        mode: 'live',
        trigger: 'manual',
        checked_ids: checkedIds,
        risk_level: riskLvl,
        session_hand_count: metrics?.total_hands ?? 0,
        session_pnl: metrics?.net_pnl ?? 0,
        session_elapsed_min: Math.floor(metrics?.elapsed_minutes ?? 0),
        action_taken: 'end_session',
        created_at: new Date().toISOString(),
      });
    }
    setShowLiveCheck(false);
    setShowEndConfirm(true);
  }, [session, metrics]);

  // 冷静期倒计时
  useEffect(() => {
    if (!sbiCooldownActive) {
      if (cooldownRef.current) {
        clearInterval(cooldownRef.current);
        cooldownRef.current = null;
      }
      return;
    }
    cooldownRef.current = setInterval(() => {
      setSbiCooldown(prev => {
        if (prev <= 1) {
          // 提前清除定时器，防止多余 tick
          if (cooldownRef.current) {
            clearInterval(cooldownRef.current);
            cooldownRef.current = null;
          }
          setSbiCooldownActive(false);
          setSbiPostCooldown(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, [sbiCooldownActive]);

  if (!session || !metrics) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: FM_COLORS.textSecondary }}>
        没有进行中的场次
        <button onClick={onBack} style={{
          display: 'block', margin: '20px auto', padding: '10px 24px',
          borderRadius: 20, border: 'none', background: FM_COLORS.primary,
          color: '#fff', cursor: 'pointer',
        }}>
          返回首页
        </button>
      </div>
    );
  }

  const isPaused = session.status === 'paused';
  // L4 强制离场时阻断录入
  const isForced = showEmotionIntervention && riskResult?.interventionLevel === 'L4';
  const isBlocked = isPaused || isForced;
  const riskLevel = computeRiskLevel(metrics, session.plan);
  const riskGradient = getRiskGradient(riskLevel);

  // 情绪干预回调（管道 2: 记录用户响应）
  const handleEmotionDismiss = () => {
    if (session) recordInterventionResponse(session.id, 'dismiss');
    setShowEmotionIntervention(false);
  };
  const handleEmotionViewRules = () => {
    if (session) recordInterventionResponse(session.id, 'view_rules');
    setShowEmotionIntervention(false);
    planCardRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  const handleEmotionAction = (actionKey: string) => {
    if (!session) return;
    recordInterventionResponse(session.id, actionKey);
    // 按钮行为分发
    if (actionKey === 'end_session') {
      setShowEmotionIntervention(false);
      setShowEndConfirm(true);
    } else if (actionKey === 'pause') {
      setShowEmotionIntervention(false);
      if (session.status !== 'paused') handlePause();
    } else if (actionKey === 'reset_bet') {
      setShowEmotionIntervention(false);
      setBetAmount(session.plan.base_unit);
      addEvent(session.id, {
        event_type: 'bet_change',
        bet_unit: session.plan.base_unit,
        timestamp: new Date().toISOString(),
        note: '干预后恢复基码',
      });
    } else if (actionKey === 'start_self_check') {
      setShowEmotionIntervention(false);
      handleLiveCheckOpen();
    } else if (actionKey === 'forced_ack') {
      // L4 二次确认后放行（记录用户明确选择继续）
      setShowEmotionIntervention(false);
      addEvent(session.id, {
        event_type: 'emotion',
        timestamp: new Date().toISOString(),
        note: '⚠️ L4强制离场：用户选择继续（二次确认通过）',
      });
    }
    // open_rules / view_rules 由 onViewRules 处理
    // continue / dismiss 由 onDismiss 处理
  };

  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      {/* 情绪干预覆盖层 */}
      {showEmotionIntervention && emotionState && (
        <EmotionIntervention
          emotion={emotionState}
          intervention={interventionResult}
          onDismiss={handleEmotionDismiss}
          onViewRules={handleEmotionViewRules}
          onAction={handleEmotionAction}
        />
      )}

      {/* 即时自检弹窗 */}
      {showLiveCheck && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 9999,
          background: 'rgba(0,0,0,0.85)',
          overflowY: 'auto',
        }}>
          <FMDangerCheckView
            mode="live"
            onBack={handleLiveCheckBack}
            onConfirm={handleLiveCheckConfirm}
            onEndSession={handleLiveCheckEndSession}
          />
        </div>
      )}

      {/* ══════ 顶部栏（sticky） ══════ */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: FM_COLORS.bg,
        borderBottom: `1px solid ${FM_COLORS.border}`,
        display: 'flex', alignItems: 'center',
        padding: '6px 16px', height: 54,
        gap: 10,
      }}>
        {/* 返回 */}
        <button
          className="clickable"
          onClick={onBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', flexShrink: 0 }}
        >
          <ArrowLeft size={18} color={FM_COLORS.textSecondary} />
        </button>

        {/* 计时器 — 靠左，紧贴返回键 */}
        {(() => {
          const maxMin = session.plan.max_duration_minutes;
          const remainSec = Math.max(0, Math.round((maxMin - metrics.elapsed_minutes) * 60));
          const rMin = Math.floor(remainSec / 60);
          const rSec = remainSec % 60;
          const isLow = remainSec < 600;
          const timerColor = isLow ? '#ef4444' : '#4ade80';
          const glowColor = isLow ? 'rgba(239,68,68,0.55)' : 'rgba(74,222,128,0.55)';
          return (
            <div style={{
              background: 'rgba(0,0,0,0.35)',
              border: `1px solid ${isLow ? 'rgba(239,68,68,0.3)' : 'rgba(74,222,128,0.25)'}`,
              borderRadius: 10,
              padding: '3px 10px',
              display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6,
              flexShrink: 0,
            }}>
              <span style={{
                fontSize: 9, fontWeight: 600, color: `${timerColor}80`,
                writingMode: 'vertical-lr', textOrientation: 'upright',
                letterSpacing: '0.1em', lineHeight: 1,
              }}>剩余</span>
              <span style={{
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: 20, fontWeight: 900,
                color: timerColor,
                letterSpacing: '0.08em',
                lineHeight: 1,
                textShadow: `0 0 10px ${glowColor}`,
              }}>
                {String(rMin).padStart(2, '0')}:{String(rSec).padStart(2, '0')}
              </span>
            </div>
          );
        })()}

        {/* 弹性空间 */}
        <div style={{ flex: 1 }} />

        {/* 三个按钮 — 独立容器，右侧与卡片对齐 */}
        <div style={{
          display: 'flex', gap: 14, alignItems: 'center',
          padding: '6px 14px',
          background: 'rgba(255,255,255,0.04)',
          borderRadius: 32,
          border: `1px solid ${FM_COLORS.border}`,
        }}>
          {/* 自检 */}
          <button
            className="clickable"
            onClick={handleLiveCheckOpen}
            style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'radial-gradient(circle at 40% 35%, rgba(230,184,0,0.22), rgba(230,184,0,0.08))',
              border: '2.5px solid rgba(230,184,0,0.85)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 10px rgba(230,184,0,0.25), inset 0 1px 0 rgba(255,255,255,0.1)',
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 800, color: '#F0C800', letterSpacing: 0.3, textShadow: '0 0 6px rgba(230,184,0,0.6)' }}>自检</span>
          </button>

          {/* 身心警报 */}
          <button
            className="clickable"
            onClick={handleSBITrigger}
            disabled={showSBI || sbiCooldownActive || sbiPostCooldown}
            style={{
              width: 40, height: 40, borderRadius: '50%',
              background: (showSBI || sbiCooldownActive || sbiPostCooldown)
                ? 'rgba(255,255,255,0.04)'
                : 'radial-gradient(circle at 40% 35%, rgba(230,57,70,0.28), rgba(230,57,70,0.10))',
              border: `2.5px solid ${(showSBI || sbiCooldownActive || sbiPostCooldown) ? FM_COLORS.border : 'rgba(230,57,70,0.9)'}`,
              cursor: (showSBI || sbiCooldownActive || sbiPostCooldown) ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: (showSBI || sbiCooldownActive || sbiPostCooldown) ? 0.35 : 1,
              boxShadow: (showSBI || sbiCooldownActive || sbiPostCooldown) ? 'none' : '0 0 12px rgba(230,57,70,0.30), inset 0 1px 0 rgba(255,255,255,0.1)',
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 800, color: '#FF4D57', letterSpacing: 0.2, textAlign: 'center', lineHeight: 1.3, textShadow: '0 0 6px rgba(230,57,70,0.5)' }}>
              身心<br />警报
            </span>
          </button>

          {/* 暂停/继续 */}
          <button
            className="clickable"
            onClick={handlePause}
            style={{
              width: 40, height: 40, borderRadius: '50%',
              background: isPaused
                ? 'radial-gradient(circle at 40% 35%, rgba(34,197,94,0.28), rgba(34,197,94,0.10))'
                : 'radial-gradient(circle at 40% 35%, rgba(255,255,255,0.12), rgba(255,255,255,0.04))',
              border: `2.5px solid ${isPaused ? 'rgba(74,222,128,0.9)' : 'rgba(255,255,255,0.28)'}`,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: isPaused ? '0 0 10px rgba(74,222,128,0.25), inset 0 1px 0 rgba(255,255,255,0.1)' : 'inset 0 1px 0 rgba(255,255,255,0.08)',
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 800, color: isPaused ? '#4ade80' : 'rgba(255,255,255,0.65)', letterSpacing: 0.3 }}>
              {isPaused ? '继续' : '暂停'}
            </span>
          </button>
        </div>
      </div>

      {/* ══════ 主滚动区 ══════ */}
      <div style={{ padding: '12px 16px 80px' }}>

      {/* ══════ 状态助手面板（常驻展开） ══════ */}
      {emotionState && (() => {
        const lvl = emotionState.level;
        const panelBorder = lvl === 'severe' ? '#E63946'
          : lvl === 'moderate' ? '#FF8C00'
          : lvl === 'mild' ? '#E6B800'
          : FM_COLORS.border;
        const panelBg = lvl === 'severe' ? 'rgba(230,57,70,0.08)'
          : lvl === 'moderate' ? 'rgba(255,140,0,0.06)'
          : lvl === 'mild' ? 'rgba(230,184,0,0.06)'
          : FM_COLORS.cardBg;
        return (
          <div style={{
            background: panelBg, borderRadius: 18,
            border: `1.5px solid ${panelBorder}`,
            marginBottom: 14, overflow: 'hidden',
            transition: 'border-color 0.4s ease, background 0.4s ease',
          }}>
            <div style={{ padding: '14px 18px 18px' }}>
              <EmotionPanel
                session={session}
                metrics={metrics}
                emotionState={emotionState}
                activeScene={activeScene}
                riskResult={riskResult}
                trajectoryPattern={trajectoryPattern}
                onPause={handlePause}
                onEnd={() => setShowEndConfirm(true)}
              />
            </div>
          </div>
        );
      })()}

      {/* 核心指标看板 — 已移至固定底部dock */}
      {false && <div ref={planCardRef} style={{
        background: riskGradient,
        borderRadius: 20, padding: '18px', marginBottom: 14, color: '#fff',
        position: 'relative',
      }}>

        {/* 计时 — 大数字（取代净输赢） */}
        <div style={{ textAlign: 'center', marginBottom: 10 }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'center',
            gap: 4,
          }}>
            <Clock size={16} style={{ opacity: 0.45, alignSelf: 'center' }} />
            <span style={{ fontSize: 32, fontWeight: 700 }}>
              {Math.floor(metrics.elapsed_minutes)}:{String(Math.floor((metrics.elapsed_minutes % 1) * 60)).padStart(2, '0')}
            </span>
            <span style={{ fontSize: 12, opacity: 0.4, fontWeight: 500 }}>
              / {session.plan.max_duration_minutes}分
            </span>
          </div>
        </div>

        {/* 输赢（左） + 余额（右） — 底部对齐 */}
        <div style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          marginBottom: 10, padding: '0 4px',
        }}>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 500, marginBottom: 2 }}>
              净输赢
            </div>
            <div style={{
              fontSize: 32, fontWeight: 700, lineHeight: 1,
              color: metrics.net_pnl >= 0 ? '#4ade80' : '#ff6b6b',
              display: 'flex', alignItems: 'baseline',
            }}>
              <span style={{ fontSize: 20, marginRight: 3 }}>{metrics.net_pnl >= 0 ? '+' : '-'}</span>
              {Math.abs(metrics.net_pnl).toLocaleString()}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 500, marginBottom: 2 }}>
              余额
            </div>
            <div style={{
              fontSize: 16, fontWeight: 600, lineHeight: 1,
              color: 'rgba(255,255,255,0.85)',
            }}>
              {metrics.current_balance.toLocaleString()}
            </div>
          </div>
        </div>

        {/* 指标网格 — 默认4格关键数据，可展开全8格 */}
        {(() => {
          const plan = session.plan;
          const { handGrinding, moneyGrinding, netHandDiff, grindWarnHands, grindLimitHands } = computeGrindingState(metrics, plan);
          const grindLevel = (grind: boolean) => {
            if (!grind) return 'none';
            if (metrics.total_hands >= grindLimitHands) return 'critical';
            if (metrics.total_hands >= grindWarnHands) return 'warn';
            return 'mild';
          };
          const handGrindLevel = grindLevel(handGrinding);
          const moneyGrindLevel = grindLevel(moneyGrinding);
          const streakLabel = metrics.current_win_streak > 0
            ? `连赢${metrics.current_win_streak}`
            : metrics.current_loss_streak > 0
              ? `连输${metrics.current_loss_streak}`
              : '0';
          return (
          <div style={{ position: 'relative' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {/* 默认4格：当前连线 / 止损线 / 止盈线 / 净赢输 */}
            <MiniMetric
              label="当前连线"
              value={streakLabel}
              good={metrics.current_win_streak > 0}
              warn={metrics.current_loss_streak >= plan.stop_loss_streak_warn && metrics.current_loss_streak < plan.stop_loss_streak}
              alert={metrics.current_loss_streak >= plan.stop_loss_streak}
            />
            <MiniMetric
              label="止损线"
              value={(plan.session_budget - plan.stop_loss_amount).toLocaleString()}
              warn={metrics.distance_to_stop_loss < plan.stop_loss_amount * 0.5 && metrics.distance_to_stop_loss >= plan.stop_loss_amount * 0.3}
              alert={metrics.distance_to_stop_loss < plan.stop_loss_amount * 0.3}
            />
            <MiniMetric
              label={metrics.is_in_lock_profit_zone ? '🔐止盈线' : '止盈线'}
              value={metrics.is_in_lock_profit_zone
                ? (plan.session_budget + plan.lock_profit_floor).toLocaleString()
                : (plan.session_budget + plan.lock_profit_trigger).toLocaleString()}
              good={metrics.is_in_lock_profit_zone}
            />
            <MiniMetric
              label="净赢/输"
              value={netHandDiff === 0 ? '0手' : netHandDiff > 0 ? `+${netHandDiff}手` : `${netHandDiff}手`}
              good={netHandDiff > 0}
              warn={netHandDiff === 0 && metrics.total_hands >= 4}
              alert={netHandDiff < 0 && metrics.net_loss_hands >= (plan.stop_loss_net_hands > 0 ? plan.stop_loss_net_hands : 999)}
            />
            {/* 展开后额外4格 */}
            {dashboardExpanded && (
              <>
                <MiniMetric
                  label="赢手"
                  value={`${metrics.win_hands}`}
                  good={metrics.win_hands > 0 && metrics.win_hands >= metrics.loss_hands}
                />
                <MiniMetric
                  label="输手"
                  value={`${metrics.loss_hands}`}
                  alert={metrics.net_loss_hands >= (plan.stop_loss_net_hands > 0 ? plan.stop_loss_net_hands : 999)}
                  warn={metrics.loss_hands > metrics.win_hands}
                />
                <MiniMetric
                  label="手数缠斗"
                  value={handGrinding ? `${metrics.total_hands}手` : '--'}
                  good={false}
                  warn={handGrindLevel === 'mild' || handGrindLevel === 'warn'}
                  alert={handGrindLevel === 'critical'}
                />
                <MiniMetric
                  label="资金缠斗"
                  value={moneyGrinding ? `${metrics.total_hands}手` : '--'}
                  good={false}
                  warn={moneyGrindLevel === 'mild' || moneyGrindLevel === 'warn'}
                  alert={moneyGrindLevel === 'critical'}
                />
              </>
            )}
          </div>
          {/* 展开/收起切换 */}
          <button
            onClick={() => setDashboardExpanded(prev => !prev)}
            style={{
              display: 'block', width: '100%', marginTop: 8,
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 11, color: 'rgba(255,255,255,0.35)', textAlign: 'center',
              padding: '2px 0',
            }}
          >
            {dashboardExpanded ? '▲ 收起' : '▼ 展开完整数据'}
          </button>

          {/* ══════ 告警悬浮层 — 覆盖在指标网格上 ══════ */}
          {activeAlert && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 12,
                backdropFilter: 'blur(4px)',
                background: 'rgba(0,0,0,0.15)',
                animation: 'pageEnter 0.25s ease',
              }}
              onClick={() => handleDismissAlert(activeAlert)}
            >
              <DashboardAlert alert={activeAlert} onDismiss={() => handleDismissAlert(activeAlert)} />
            </div>
          )}
        </div>
          );
        })()}

        {/* ══════ 场景悬浮条 — L3/L4 高危，在stats网格下方，不遮挡 ══════ */}
        {!activeAlert && activeScene && (activeScene.level === 'L3' || activeScene.level === 'L4') && (
          <div
            style={{
              marginTop: 8,
              padding: '8px 14px',
              background: activeScene.level === 'L4'
                ? 'linear-gradient(135deg, rgba(239,68,68,0.92), rgba(185,28,28,0.92))'
                : 'linear-gradient(135deg, rgba(251,146,60,0.88), rgba(234,88,12,0.88))',
              backdropFilter: 'blur(8px)',
              borderRadius: 10,
              animation: 'pageEnter 0.3s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>
                {activeScene.level === 'L4' ? '🛑' : '⚠️'}
              </span>
              <span style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#fff',
                lineHeight: 1.4,
              }}>
                {activeScene.label}：{activeScene.factMessage}
              </span>
            </div>
          </div>
        )}
      </div>}

      {/* ══════ 录入区（滚动区内卡片，状态助手下方） ══════ */}
      {session && metrics && (() => {
        // 固定筹码面值：100/200/500/1000（加减号每次按步进/退一个面值）
        const steps = [100, 200, 500, 1000];
        const max = session.plan.max_bet_unit || session.plan.base_unit * 10;
        const plan = session.plan;
        const { handGrinding, moneyGrinding, netHandDiff, grindWarnHands, grindLimitHands } = computeGrindingState(metrics, plan);
        const streakLabel = metrics.current_win_streak > 0
          ? `连赢${metrics.current_win_streak}`
          : metrics.current_loss_streak > 0
            ? `连输${metrics.current_loss_streak}`
            : '持平';
        const showVoice = isListening || voiceInputText.length > 0;
        return (
          <div style={{
            borderRadius: 18,
            border: `1px solid ${FM_COLORS.border}`,
            background: FM_COLORS.bg,
            marginBottom: 14,
            overflow: 'hidden',
          }}>
            <div style={{ padding: '12px 16px 16px' }}>
              {/* 语音展开区（isListening 或有文字时显示） */}
              {showVoice && (
                <div style={{
                  marginBottom: 10,
                  background: 'rgba(99,179,237,0.08)',
                  border: `1px solid ${FM_COLORS.accent}40`,
                  borderRadius: 12, padding: '8px 12px',
                  display: 'flex', alignItems: 'center', gap: 8,
                  animation: 'pageEnter 0.2s ease',
                }}>
                  {isListening && (
                    <span style={{ fontSize: 12, color: '#FBBF24', flexShrink: 0 }}>🎙️</span>
                  )}
                  {isListening && (interimTranscript || transcript) && (
                    <span style={{ fontSize: 13, color: '#FBBF24', flex: 1, minWidth: 0 }}>
                      {transcript}{interimTranscript && <span style={{ opacity: 0.5 }}>{interimTranscript}</span>}
                    </span>
                  )}
                  <input
                    value={voiceInputText}
                    onChange={e => setVoiceInputText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleVoiceSend()}
                    placeholder="赢200 / 输100"
                    disabled={isPaused}
                    autoFocus
                    style={{
                      flex: 1, padding: '6px 10px', borderRadius: 8,
                      border: `1px solid ${FM_COLORS.border}`,
                      background: FM_COLORS.inputBg, fontSize: 14,
                      color: FM_COLORS.textPrimary, outline: 'none',
                      opacity: isPaused ? 0.4 : 1,
                    }}
                  />
                  <button
                    className="clickable"
                    onClick={handleVoiceSend}
                    disabled={!voiceInputText.trim() || isPaused}
                    style={{
                      width: 34, height: 34, borderRadius: 10, border: 'none', flexShrink: 0,
                      background: voiceInputText.trim() && !isPaused
                        ? `linear-gradient(135deg, ${FM_COLORS.primary}, ${FM_COLORS.secondary})`
                        : 'rgba(255,255,255,0.1)',
                      cursor: voiceInputText.trim() && !isPaused ? 'pointer' : 'not-allowed',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  ><Send size={15} color="#fff" /></button>
                  <button
                    onClick={() => { stopListening(); setVoiceInputText(''); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: FM_COLORS.textSecondary, fontSize: 16, padding: '0 2px', flexShrink: 0 }}
                  >✕</button>
                </div>
              )}
              {speechError && (
                <div style={{ fontSize: 11, color: FM_COLORS.danger, marginBottom: 6 }}>⚠ {speechError}</div>
              )}

              {/* 码量行：[−] 数字 [+]  居中  + 右侧🎤大按钮 */}
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
                  <button
                    className="clickable"
                    onClick={() => setBetAmount(prev => Math.max(0, prev - betStep))}
                    style={{
                      width: 42, height: 42, borderRadius: 12,
                      border: `1.5px solid ${FM_COLORS.border}`, background: FM_COLORS.cardBg,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  ><Minus size={18} color={FM_COLORS.textSecondary} /></button>
                  <div style={{ textAlign: 'center', minWidth: 90 }}>
                    <div style={{ fontSize: 11, color: FM_COLORS.textSecondary, marginBottom: 2 }}>当前码量</div>
                    <div style={{ fontSize: 30, fontWeight: 800, color: FM_COLORS.textPrimary, letterSpacing: '-0.03em', lineHeight: 1 }}>
                      {betAmount.toLocaleString()}
                    </div>
                  </div>
                  <button
                    className="clickable"
                    onClick={() => setBetAmount(prev => Math.min(max, prev + betStep))}
                    style={{
                      width: 42, height: 42, borderRadius: 12,
                      border: `1.5px solid ${FM_COLORS.border}`, background: FM_COLORS.cardBg,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  ><Plus size={18} color={FM_COLORS.textSecondary} /></button>
                </div>
                {/* 麦克风大按钮 + 小字标注 */}
                {isSupported && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                    <button
                      className="clickable"
                      onClick={() => {
                        if (isListening) { stopListening(); }
                        else { resetTranscript(); startListening(); }
                      }}
                      disabled={isPaused}
                      style={{
                        width: 54, height: 54, borderRadius: 16,
                        background: isListening
                          ? `linear-gradient(135deg, ${FM_COLORS.danger}, #FF6B6B)`
                          : 'rgba(99,179,237,0.15)',
                        border: `2px solid ${isListening ? FM_COLORS.danger : FM_COLORS.accent}70`,
                        cursor: isPaused ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: isListening ? '0 0 18px rgba(230,57,70,0.5)' : `0 0 10px rgba(99,179,237,0.15)`,
                        transition: 'all 0.2s ease',
                        opacity: isPaused ? 0.4 : 1,
                      } as React.CSSProperties}
                    >
                      {isListening
                        ? <MicOff size={24} color="#fff" />
                        : <Mic size={24} color={FM_COLORS.accent} />
                      }
                    </button>
                    <span style={{ fontSize: 9, color: FM_COLORS.textSecondary, letterSpacing: 0.3, opacity: 0.7 }}>
                      {isListening ? '录入中' : '语音录入'}
                    </span>
                  </div>
                )}
              </div>

              {/* 步长行：选面值，+/- 按此步进 */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                  <span style={{ fontSize: 10, color: FM_COLORS.textSecondary, flexShrink: 0 }}>
                    面值（±每步）
                  </span>
                  <span style={{ fontSize: 10, color: FM_COLORS.textSecondary, opacity: 0.5 }}>
                    — 选好后用 +/− 调整码量
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {steps.map(s => (
                    <button
                      key={s}
                      className="clickable"
                      onClick={() => setBetStep(s)}
                      style={{
                        flex: 1, padding: '7px 0', borderRadius: 9, fontSize: 13, fontWeight: 700,
                        border: `1.5px solid ${betStep === s ? FM_COLORS.accent : FM_COLORS.border}`,
                        background: betStep === s ? 'rgba(99,179,237,0.18)' : FM_COLORS.cardBg,
                        color: betStep === s ? FM_COLORS.accent : FM_COLORS.textSecondary,
                        cursor: 'pointer',
                        boxShadow: betStep === s ? `0 0 8px rgba(99,179,237,0.20)` : 'none',
                        transition: 'all 0.15s ease',
                      }}
                    >{s >= 1000 ? `${s/1000}k` : s}</button>
                  ))}
                  <input
                    type="number" min={1} placeholder="自定"
                    value={steps.includes(betStep) ? '' : betStep}
                    onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v > 0) setBetStep(v); }}
                    style={{
                      width: 52, padding: '7px 4px', borderRadius: 9, fontSize: 12, textAlign: 'center',
                      border: `1.5px solid ${!steps.includes(betStep) ? FM_COLORS.accent : FM_COLORS.border}`,
                      background: FM_COLORS.cardBg, color: FM_COLORS.textPrimary, outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* 赢/输 或 确认/取消 */}
              {pendingBet ? (
                <div style={{
                  background: pendingBet.type === 'win' ? 'rgba(34,197,94,0.12)' : 'rgba(230,57,70,0.10)',
                  borderRadius: 14, border: `2px solid ${pendingBet.type === 'win' ? '#86EFAC' : '#FECACA'}`,
                  padding: '12px 14px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontSize: 22, fontWeight: 800, color: pendingBet.type === 'win' ? FM_COLORS.profit : FM_COLORS.loss }}>
                      {pendingBet.type === 'win' ? '+' : '-'}{pendingBet.amount.toLocaleString()}
                    </span>
                    <span style={{ fontSize: 12, color: FM_COLORS.textSecondary }}>"{pendingBet.rawText}"</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <button className="clickable" onClick={handleBetConfirm} style={{ padding: '12px', borderRadius: 12, border: 'none', background: pendingBet.type === 'win' ? FM_COLORS.profit : FM_COLORS.loss, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>✓ 确认</button>
                    <button className="clickable" onClick={handleBetCancel} style={{ padding: '12px', borderRadius: 12, border: `1px solid ${FM_COLORS.border}`, background: FM_COLORS.cardBg, color: FM_COLORS.textPrimary, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>✕ 取消</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <button
                    className="clickable"
                    onClick={() => setPendingBet({ type: 'win', amount: betAmount, rawText: `赢${betAmount}` })}
                    disabled={isBlocked}
                    style={{
                      padding: '16px', borderRadius: 16, border: 'none',
                      background: isBlocked ? '#374151' : FM_COLORS.profit,
                      color: '#fff', fontSize: 18, fontWeight: 800,
                      cursor: isBlocked ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      letterSpacing: '0.04em',
                    }}
                  ><TrendingUp size={20} /> 赢</button>
                  <button
                    className="clickable"
                    onClick={() => setPendingBet({ type: 'loss', amount: betAmount, rawText: `输${betAmount}` })}
                    disabled={isBlocked}
                    style={{
                      padding: '16px', borderRadius: 16, border: 'none',
                      background: isBlocked ? '#374151' : FM_COLORS.loss,
                      color: '#fff', fontSize: 18, fontWeight: 800,
                      cursor: isBlocked ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      letterSpacing: '0.04em',
                    }}
                  ><TrendingDown size={20} /> 输</button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ══════ 实时数据（录入区下方，下滑可见） ══════ */}
      {session && metrics && (() => {
        const plan2 = session.plan;
        const { handGrinding: hg, moneyGrinding: mg, netHandDiff: nd, grindWarnHands: gw, grindLimitHands: gl } = computeGrindingState(metrics, plan2);
        const sk = metrics.current_win_streak > 0 ? `连赢${metrics.current_win_streak}` : metrics.current_loss_streak > 0 ? `连输${metrics.current_loss_streak}` : '持平';
        return (
          <div style={{ borderRadius: 16, overflow: 'hidden', border: `1px solid ${FM_COLORS.border}` }}>
            <div style={{ background: riskGradient, padding: '10px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: '0.06em' }}>实时数据</span>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80', flexShrink: 0 }} />
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: metrics.net_pnl >= 0 ? '#4ade80' : '#ff6b6b' }}>
                  {metrics.net_pnl >= 0 ? '+' : ''}{metrics.net_pnl.toLocaleString()}
                </span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>余{metrics.current_balance.toLocaleString()}</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{sk}</span>
              </div>
            </div>
            <div style={{ padding: '10px 14px 14px', background: riskGradient }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 8 }}>
                <MiniMetric label="止损线" value={(plan2.session_budget - plan2.stop_loss_amount).toLocaleString()} warn={metrics.distance_to_stop_loss < plan2.stop_loss_amount * 0.5} alert={metrics.distance_to_stop_loss < plan2.stop_loss_amount * 0.3} />
                <MiniMetric label={metrics.is_in_lock_profit_zone ? '🔐止盈' : '止盈线'} value={metrics.is_in_lock_profit_zone ? (plan2.session_budget + plan2.lock_profit_floor).toLocaleString() : (plan2.session_budget + plan2.lock_profit_trigger).toLocaleString()} good={metrics.is_in_lock_profit_zone} />
                <MiniMetric label="当前连线" value={sk} good={metrics.current_win_streak > 0} warn={metrics.current_loss_streak >= plan2.stop_loss_streak_warn && metrics.current_loss_streak < plan2.stop_loss_streak} alert={metrics.current_loss_streak >= plan2.stop_loss_streak} />
                <MiniMetric label="净赢/输" value={nd === 0 ? '0手' : nd > 0 ? `+${nd}手` : `${nd}手`} good={nd > 0} alert={nd < 0 && metrics.net_loss_hands >= (plan2.stop_loss_net_hands > 0 ? plan2.stop_loss_net_hands : 999)} />
                <MiniMetric label="赢手" value={`${metrics.win_hands}`} good={metrics.win_hands >= metrics.loss_hands} />
                <MiniMetric label="输手" value={`${metrics.loss_hands}`} warn={metrics.loss_hands > metrics.win_hands} />
                <MiniMetric label="手数缠斗" value={hg ? `${metrics.total_hands}手` : '--'} warn={metrics.total_hands >= gw && metrics.total_hands < gl} alert={metrics.total_hands >= gl} />
                <MiniMetric label="资金缠斗" value={mg ? `${metrics.total_hands}手` : '--'} warn={metrics.total_hands >= gw && metrics.total_hands < gl} alert={metrics.total_hands >= gl} />
              </div>
              <RiskControlPanel result={riskResult} />
              {feedback && (
                <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(34,197,94,0.12)', borderRadius: 10, border: '1px solid rgba(34,197,94,0.22)', fontSize: 12, color: '#4ADE80', lineHeight: 1.5 }}>
                  🧿 {feedback}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      </div>{/* close main scroll area */}

      {/* ══════ SBI 选择面板 ══════ */}
      {showSBI && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.6)', zIndex: 1001,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16, animation: 'pageEnter 0.25s ease',
        }}>
          <div style={{
            background: FM_COLORS.cardBg, borderRadius: 24, padding: 24,
            maxWidth: 380, width: '100%', maxHeight: '85vh', overflowY: 'auto',
          }}>
            {/* 标题 */}
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <Octagon size={36} color={FM_COLORS.danger} style={{ marginBottom: 8 }} />
              <h3 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 6px', color: FM_COLORS.textPrimary }}>
                紧急刹车
              </h3>
              <p style={{ fontSize: 13, color: FM_COLORS.textSecondary, margin: 0, lineHeight: 1.5 }}>
                当身体或情绪出现异常时，<br />任何策略都将失效。
              </p>
            </div>

            {/* 原因选择 — 按分类 */}
            {(['physical', 'emotional', 'environmental'] as const).map(cat => (
              <div key={cat} style={{ marginBottom: 14 }}>
                <div style={{
                  fontSize: 11, fontWeight: 600, color: FM_COLORS.textSecondary,
                  marginBottom: 8, paddingLeft: 2,
                }}>
                  {SBI_CATEGORY_LABELS[cat]}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {SBI_REASONS.filter(r => r.category === cat).map(reason => (
                    <button
                      key={reason.id}
                      className="clickable"
                      onClick={() => setSbiReason(reason.id)}
                      style={{
                        padding: '10px 14px', borderRadius: 14,
                        border: `2px solid ${sbiReason === reason.id ? FM_COLORS.danger : FM_COLORS.border}`,
                        background: sbiReason === reason.id ? FM_COLORS.danger + '12' : FM_COLORS.inputBg,
                        cursor: 'pointer', fontSize: 13, fontWeight: 500,
                        color: sbiReason === reason.id ? FM_COLORS.danger : FM_COLORS.textPrimary,
                        display: 'flex', alignItems: 'center', gap: 6,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span style={{ fontSize: 16 }}>{reason.emoji}</span>
                      {reason.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* "其他"自定义输入 */}
            {sbiReason === 'other' && (
              <textarea
                value={sbiCustomText}
                onChange={e => setSbiCustomText(e.target.value)}
                placeholder="描述一下你的状况..."
                rows={2}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 12,
                  border: `1px solid ${FM_COLORS.border}`, background: FM_COLORS.inputBg,
                  fontSize: 14, resize: 'none', outline: 'none',
                  boxSizing: 'border-box', marginBottom: 14,
                }}
              />
            )}

            {/* 确认按钮 */}
            <button
              className="clickable"
              onClick={handleSBIConfirm}
              disabled={!sbiReason}
              style={{
                width: '100%', padding: '14px', borderRadius: 16,
                border: 'none',
                background: sbiReason ? FM_COLORS.danger : '#D1D5DB',
                color: '#fff', fontSize: 16, fontWeight: 700,
                cursor: sbiReason ? 'pointer' : 'not-allowed',
                marginBottom: 14,
              }}
            >
              确认紧急刹车
            </button>

            {/* 底部名言 */}
            <p style={{
              fontSize: 12, color: FM_COLORS.textSecondary, textAlign: 'center',
              margin: 0, fontStyle: 'italic', lineHeight: 1.5,
            }}>
              状态失控的玩家，<br />永远是赌场最喜欢的玩家。
            </p>

            {/* 取消 — 恢复被自动暂停的场次 */}
            <button
              className="clickable"
              onClick={() => {
                setShowSBI(false);
                // 只有在 SBI 前不是暂停状态时才恢复
                if (session && session.status === 'paused' && !wasPausedBeforeSBIRef.current) {
                  addEvent(session.id, {
                    event_type: 'resume',
                    timestamp: new Date().toISOString(),
                    note: 'SBI_CANCELLED',
                  });
                  resumeSession(session.id);
                }
              }}
              style={{
                width: '100%', padding: '10px', marginTop: 10,
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 13, color: FM_COLORS.textSecondary,
              }}
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* ══════ SBI 冷静期界面 ══════ */}
      {sbiCooldownActive && (
        <div style={{
          position: 'fixed', inset: 0,
          background: `linear-gradient(180deg, ${FM_COLORS.primary}, #0D1B2A)`,
          zIndex: 1002, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: 32, color: '#fff',
          animation: 'pageEnter 0.4s ease',
        }}>
          <div style={{ fontSize: 13, opacity: 0.5, marginBottom: 8, letterSpacing: 2 }}>
            ⏸️ 冷静期
          </div>
          <div style={{
            fontSize: 72, fontWeight: 700, lineHeight: 1,
            marginBottom: 8,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {sbiCooldown}
          </div>
          <div style={{ fontSize: 14, opacity: 0.4, marginBottom: 40 }}>秒</div>

          <p style={{
            fontSize: 16, lineHeight: 1.8, textAlign: 'center',
            maxWidth: 280, opacity: 0.8, fontStyle: 'italic',
            margin: '0 0 60px',
          }}>
            "{sbiQuote}"
          </p>

          <button
            className="clickable"
            onClick={handleSBIEnd}
            style={{
              padding: '12px 28px', borderRadius: 20,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
              fontSize: 13, fontWeight: 500,
            }}
          >
            提前结束场次
          </button>
        </div>
      )}

      {/* ══════ SBI 冷静期结束选择 ══════ */}
      {sbiPostCooldown && (
        <div style={{
          position: 'fixed', inset: 0,
          background: `linear-gradient(180deg, ${FM_COLORS.primary}, ${FM_COLORS.secondary})`,
          zIndex: 1002, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: 32, color: '#fff',
          animation: 'pageEnter 0.4s ease',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>◉</div>
          <h3 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>
            冷静期结束
          </h3>
          <p style={{ fontSize: 15, opacity: 0.7, margin: '0 0 40px', textAlign: 'center' }}>
            感觉怎么样？准备好了吗？
          </p>

          <button
            className="clickable"
            onClick={handleSBIContinue}
            style={{
              width: 260, padding: '14px', borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.3)',
              background: 'rgba(255,255,255,0.1)',
              color: '#fff', fontSize: 16, fontWeight: 600,
              cursor: 'pointer', marginBottom: 12,
            }}
          >
            继续本场
          </button>
          <button
            className="clickable"
            onClick={handleSBIEnd}
            style={{
              width: 260, padding: '14px', borderRadius: 16,
              border: 'none', background: FM_COLORS.danger,
              color: '#fff', fontSize: 16, fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            结束场次（推荐）
          </button>
        </div>
      )}

      {/* 止损线拦截面板 — 必须写理由才能继续 */}
      {stopLossIntercept && metrics && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          zIndex: 1000, padding: '0 0 env(safe-area-inset-bottom, 0px)',
        }}>
          <div style={{
            background: FM_COLORS.cardBg, borderRadius: '20px 20px 0 0',
            padding: '24px 20px 32px', width: '100%', maxWidth: 480,
          }}>
            {/* 标题 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 20 }}>🔴</span>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: '#ef4444' }}>
                已触碰止损线
              </h3>
            </div>

            {/* 止损数据 */}
            <div style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 14, padding: '14px 16px', marginBottom: 16,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: FM_COLORS.textSecondary }}>当前亏损</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#ef4444' }}>
                  -{Math.abs(Math.min(0, metrics.net_pnl)).toLocaleString()}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: FM_COLORS.textSecondary }}>连输手数</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: metrics.current_loss_streak > 0 ? '#ef4444' : FM_COLORS.textPrimary }}>
                  {metrics.current_loss_streak} 手
                </span>
              </div>
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(239,68,68,0.2)' }}>
                <span style={{ fontSize: 12, color: '#ef4444', opacity: 0.8 }}>
                  {stopLossIntercept.message}
                </span>
              </div>
            </div>

            {/* 主动作：立即止损 */}
            <button
              className="clickable"
              onClick={() => {
                setStopLossIntercept(null);
                setShowEndConfirm(true);
              }}
              style={{
                width: '100%', padding: '14px', borderRadius: 14, border: 'none',
                background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
                color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 16,
              }}
            >
              立即止损，保护今日本金
            </button>

            {/* 分割线 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1, height: 1, background: FM_COLORS.border }} />
              <span style={{ fontSize: 12, color: FM_COLORS.textSecondary }}>如果要继续打，请写下你的理由</span>
              <div style={{ flex: 1, height: 1, background: FM_COLORS.border }} />
            </div>

            {/* 理由输入 */}
            <textarea
              value={stopLossReason}
              onChange={e => setStopLossReason(e.target.value)}
              placeholder="我继续是因为……（写完才能关闭此提示）"
              rows={2}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 12,
                border: `1px solid ${stopLossReason.trim().length >= 5 ? FM_COLORS.primary : FM_COLORS.border}`,
                background: FM_COLORS.inputBg, fontSize: 14, resize: 'none',
                outline: 'none', boxSizing: 'border-box', marginBottom: 10,
                color: FM_COLORS.textPrimary, transition: 'border-color 0.2s',
              }}
            />

            {/* 继续按钮 */}
            <button
              className="clickable"
              disabled={stopLossReason.trim().length < 5}
              onClick={() => {
                if (!session || stopLossReason.trim().length < 5) return;
                addEvent(session.id, {
                  event_type: 'note',
                  note: `止损后继续理由: ${stopLossReason.trim()}`,
                  timestamp: new Date().toISOString(),
                });
                doDismissAlert(stopLossIntercept);
                setStopLossIntercept(null);
                setStopLossReason('');
              }}
              style={{
                width: '100%', padding: '12px', borderRadius: 14,
                border: `1px solid ${FM_COLORS.border}`,
                background: stopLossReason.trim().length >= 5 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                color: stopLossReason.trim().length >= 5 ? FM_COLORS.textPrimary : FM_COLORS.textSecondary,
                fontSize: 14, fontWeight: 600,
                cursor: stopLossReason.trim().length >= 5 ? 'pointer' : 'not-allowed',
                opacity: stopLossReason.trim().length >= 5 ? 1 : 0.4,
                transition: 'all 0.2s ease',
              }}
            >
              {stopLossReason.trim().length >= 5 ? '已写好理由，继续打' : `还需写 ${Math.max(0, 5 - stopLossReason.trim().length)} 个字`}
            </button>
          </div>
        </div>
      )}

      {/* 结束确认弹窗 — 离场摩擦机制 */}
      {showEndConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          zIndex: 999, padding: '0 0 env(safe-area-inset-bottom, 0px)',
        }}>
          <div style={{
            background: FM_COLORS.cardBg, borderRadius: '20px 20px 0 0', padding: '24px 20px 32px',
            width: '100%', maxWidth: 480,
          }}>
            {/* 标题 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: FM_COLORS.textPrimary }}>
                🏁 准备离场
              </h3>
              <button
                onClick={() => { setShowEndConfirm(false); setDepartureReason(null); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
              >
                <X size={18} color={FM_COLORS.textSecondary} />
              </button>
            </div>

            {/* 本局数据 */}
            <div style={{
              background: 'rgba(255,255,255,0.06)', borderRadius: 14,
              padding: '14px 16px', marginBottom: 16,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: FM_COLORS.textSecondary, marginBottom: 4 }}>本局盈亏</div>
                <div style={{
                  fontSize: 22, fontWeight: 700,
                  color: metrics.net_pnl >= 0 ? FM_COLORS.profit : FM_COLORS.loss,
                }}>
                  {metrics.net_pnl >= 0 ? '+' : ''}{metrics.net_pnl.toLocaleString()}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: FM_COLORS.textSecondary, marginBottom: 4 }}>已打手数</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: FM_COLORS.textPrimary }}>
                  {metrics.total_hands} 手
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: FM_COLORS.textSecondary, marginBottom: 4 }}>
                  {metrics.net_pnl >= (session?.plan.take_profit_amount ?? 0) ? '已超目标' : '距盈利目标'}
                </div>
                <div style={{
                  fontSize: 22, fontWeight: 700,
                  color: metrics.net_pnl >= (session?.plan.take_profit_amount ?? 0) ? FM_COLORS.profit : FM_COLORS.textSecondary,
                }}>
                  {metrics.net_pnl >= (session?.plan.take_profit_amount ?? 0)
                    ? `+${(metrics.net_pnl - (session?.plan.take_profit_amount ?? 0)).toLocaleString()}`
                    : `¥${((session?.plan.take_profit_amount ?? 0) - metrics.net_pnl).toLocaleString()}`
                  }
                </div>
              </div>
            </div>

            {/* 主动作：确认离场 */}
            <button
              className="clickable"
              onClick={handleEnd}
              style={{
                width: '100%', padding: '14px', borderRadius: 14,
                border: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                background: metrics.net_pnl >= 0
                  ? `linear-gradient(135deg, ${FM_COLORS.profit}, #16a34a)`
                  : `linear-gradient(135deg, ${FM_COLORS.danger}, #b91c1c)`,
                color: '#fff', marginBottom: 16,
              }}
            >
              确认离场，带走 {metrics.net_pnl >= 0 ? '+' : ''}{metrics.net_pnl.toLocaleString()}
            </button>

            {/* 分割线 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1, height: 1, background: FM_COLORS.border }} />
              <span style={{ fontSize: 12, color: FM_COLORS.textSecondary }}>如果你选择继续打，是因为？</span>
              <div style={{ flex: 1, height: 1, background: FM_COLORS.border }} />
            </div>

            {/* 动机选项 */}
            {[
              '状态好，想趁势多赢',
              '还没到目标，不甘心',
              '想把刚才那手赢回来',
              '就是想继续，没有理由',
            ].map(reason => (
              <button
                key={reason}
                className="clickable"
                onClick={() => setDepartureReason(reason)}
                style={{
                  width: '100%', textAlign: 'left', padding: '11px 14px',
                  borderRadius: 12, marginBottom: 8, cursor: 'pointer', fontSize: 14,
                  background: departureReason === reason ? `${FM_COLORS.primary}20` : 'rgba(255,255,255,0.05)',
                  border: departureReason === reason ? `1.5px solid ${FM_COLORS.primary}` : `1px solid ${FM_COLORS.border}`,
                  color: departureReason === reason ? FM_COLORS.primary : FM_COLORS.textSecondary,
                  fontWeight: departureReason === reason ? 600 : 400,
                  transition: 'all 0.15s ease',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}
              >
                <span style={{
                  width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${departureReason === reason ? FM_COLORS.primary : FM_COLORS.border}`,
                  background: departureReason === reason ? FM_COLORS.primary : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {departureReason === reason && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                </span>
                {reason}
              </button>
            ))}

            {/* 继续按钮（需选择原因才解锁） */}
            <button
              className="clickable"
              onClick={handleContinueAfterFriction}
              disabled={!departureReason}
              style={{
                width: '100%', padding: '12px', borderRadius: 14, marginTop: 4,
                border: `1px solid ${departureReason ? FM_COLORS.border : FM_COLORS.border}`,
                background: departureReason ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                color: departureReason ? FM_COLORS.textPrimary : FM_COLORS.textSecondary,
                fontSize: 14, fontWeight: 600, cursor: departureReason ? 'pointer' : 'not-allowed',
                opacity: departureReason ? 1 : 0.4, transition: 'all 0.2s ease',
              }}
            >
              {departureReason ? '选好了，继续打' : '选择原因后可继续'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 子组件 ──

function MiniMetric({ label, value, alert, warn, good }: {
  label: string; value: string; alert?: boolean; warn?: boolean; good?: boolean;
}) {
  const bg = alert ? 'rgba(255,107,107,0.15)' : warn ? 'rgba(251,146,60,0.12)' : good ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.08)';
  const color = alert ? '#ff6b6b' : warn ? '#fb923c' : good ? '#4ade80' : 'rgba(255,255,255,0.9)';
  return (
    <div style={{ background: bg, borderRadius: 10, padding: '8px 6px', textAlign: 'center' }}>
      <div style={{ fontSize: 10, opacity: 0.6, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

/** 悬浮在指标看板上的告警组件 — 覆盖8格数据，强制可见 */
function DashboardAlert({ alert, onDismiss }: { alert: FMAlert; onDismiss: () => void }) {
  const colors = ALERT_COLORS[alert.level] || ALERT_COLORS.early_warning;
  const isStrong = alert.level === 'strong_alert';

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        background: colors.bg,
        border: `${isStrong ? 3 : 2}px solid ${colors.border}`,
        borderRadius: 14,
        padding: '14px 16px',
        width: '94%',
        maxWidth: 340,
        boxShadow: isStrong
          ? `0 6px 28px rgba(230,57,70,0.4), 0 0 0 4px ${colors.border}30`
          : `0 4px 20px rgba(0,0,0,0.15)`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <AlertTriangle
          size={isStrong ? 24 : 20}
          color={colors.icon}
          style={{ marginTop: 1, flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: isStrong ? 15 : 13, fontWeight: 800,
            color: colors.text, marginBottom: 4,
          }}>
            {isStrong ? '▲ 强烈警告' : alert.level === 'formal_alert' ? '◆ 正式提醒' : '◇ 预警提示'}
          </div>
          <p style={{
            fontSize: isStrong ? 13 : 12,
            color: colors.text, margin: 0, lineHeight: 1.5,
            fontWeight: isStrong ? 600 : 400,
          }}>
            {alert.message}
          </p>
        </div>
        <button
          onClick={onDismiss}
          style={{
            background: `${colors.border}30`,
            border: 'none', cursor: 'pointer',
            borderRadius: 10, padding: '4px 6px',
            flexShrink: 0,
          }}
        >
          <X size={14} color={colors.text} />
        </button>
      </div>
      <div style={{
        textAlign: 'center', marginTop: 8,
        fontSize: 11, color: colors.text, opacity: 0.5,
      }}>
        点击空白区域消除
      </div>
    </div>
  );
}
