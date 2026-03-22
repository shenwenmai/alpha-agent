// ============================================================
// 三维风控评估引擎 — riskEvaluationEngine.ts
// 对应设计文档：docs/design/risk-engine-algorithm-spec.md v1.2
//
// v1.2 新增：锁盈状态机 / effectiveLimits反断层 / 毒药组合 /
//           接近预警 / 关键时刻#5(streak2_raise) / 运行时不可重置变量
//
// AlphaGo 三组件映射：
//   Value Network  → survivalProb  （资金生存概率）
//   Policy Network → etpProb       （情绪崩盘概率）
//   MCTS           → collapseProb  （崩盘路径概率）
//
// 物理常数来源：
//   Feller (1968), Kahneman & Tversky (1979/1992),
//   Silver et al. (2016), Abramowitz & Stegun (1964)
// ============================================================

import type {
  RiskConfig,
  RiskEvalInput,
  EvaluationResult,
  InterventionLevel,
  RiskTier,
} from '../types/riskConfig';
import type { FMMetrics, FMSession, SessionPlan, FMEvent } from '../types/fundManager';

// ── 引擎内部状态（跨手数持久） ──
// 对应 types/riskConfig.ts → RiskEngineRuntimeState
//
// ⚠️ 关键设计：
//   maxGrindEver / hadWinStreak 是"不可重置"变量
//   → 精神消耗的印记不会因短暂好转而消失
//   → 这两个变量只在 resetEngine()（新场次）时才归零

interface EngineState {
  // EMA 注码追踪
  emaBet: number;

  // 干预防抖
  currentLevel: InterventionLevel;
  stableHandsCount: number;

  // 锁盈状态机（5阶段 → 影响 effectiveLimits）
  profitLockActive: boolean;       // 盈利≥activatePct时激活
  profitLockStage: number;         // 0=未锁 1=激活 2=收紧 3=回撤 4=归零 5=转亏
  peakProfit: number;              // 本场最高盈利

  // 毒药组合#1 高压疲劳（不可重置）
  maxGrindEver: number;            // 全场最大缠斗长度

  // 毒药组合#2 顺风转折（不可重置）
  hadWinStreak: boolean;           // 曾连赢≥winStreakMark手
  momentumReversed: boolean;       // hadWinStreak && 连赢归零 = 转折

  // 连赢追踪
  consecutiveWins: number;

  // 初始化标记
  initialized: boolean;
}

const DEFAULT_STATE: EngineState = {
  emaBet: 0,
  currentLevel: 'L0',
  stableHandsCount: 0,
  profitLockActive: false,
  profitLockStage: 0,
  peakProfit: 0,
  maxGrindEver: 0,
  hadWinStreak: false,
  momentumReversed: false,
  consecutiveWins: 0,
  initialized: false,
};

let state: EngineState = { ...DEFAULT_STATE };

/** 重置引擎状态（新场次开始时调用） */
export function resetEngine(): void {
  state = { ...DEFAULT_STATE };
}

/** 序列化引擎状态（用于 checkpoint 持久化） */
export function serializeEngineState(): string {
  return JSON.stringify(state);
}

/** 恢复引擎状态（从 checkpoint 恢复） */
export function restoreEngineState(serialized: string): void {
  try {
    const restored = JSON.parse(serialized);
    if (restored && typeof restored.emaBet === 'number') {
      state = {
        emaBet: restored.emaBet,
        currentLevel: restored.currentLevel || 'L0',
        stableHandsCount: restored.stableHandsCount || 0,
        profitLockActive: restored.profitLockActive ?? false,
        profitLockStage: restored.profitLockStage ?? 0,
        peakProfit: restored.peakProfit ?? 0,
        maxGrindEver: restored.maxGrindEver ?? 0,
        hadWinStreak: restored.hadWinStreak ?? false,
        momentumReversed: restored.momentumReversed ?? false,
        consecutiveWins: restored.consecutiveWins ?? 0,
        initialized: restored.initialized ?? true,
      };
    }
  } catch { /* 恢复失败静默忽略 */ }
}

// ============================================================
// §3.6 标准正态 CDF — Abramowitz & Stegun (1964)
// 精度 < 1.5×10⁻⁷
// ============================================================

function normalCDF(x: number): number {
  if (x < -8) return 0;
  if (x > 8) return 1;

  // Abramowitz & Stegun 26.2.17 — 直接用于标准正态CDF
  // 精度 |ε| < 7.5×10⁻⁸
  const absX = Math.abs(x);
  const t = 1 / (1 + 0.2316419 * absX);

  const b1 = 0.319381530;
  const b2 = -0.356563782;
  const b3 = 1.781477937;
  const b4 = -1.821255978;
  const b5 = 1.330274429;

  // φ(x) = (1/√2π) × e^(-x²/2)
  const phi = Math.exp(-0.5 * absX * absX) / Math.sqrt(2 * Math.PI);

  // Q(x) = 1 - Φ(x) for x ≥ 0
  const q = phi * (b1 * t + b2 * t ** 2 + b3 * t ** 3 + b4 * t ** 4 + b5 * t ** 5);

  return x >= 0 ? 1 - q : q;
}

// ============================================================
// §3 survivalProb（Value Network）— 资金生存概率
// Feller 随机游走 + CLT 正态近似 + EMA 方差平滑
// ============================================================

export function computeSurvivalProb(input: RiskEvalInput, config: RiskConfig): number {
  const { p, handsPerMinute, betAmplifierExponent } = config.constants;

  const B = input.currentBalance - input.stopLossAmount;
  if (B <= 0) return 0.05; // 下限 5% — 即使触及止损线也非绝对死亡

  const n = Math.max(1, input.remainingMinutes * handsPerMinute);
  const bet = input.currentBet;
  const baseUnit = input.baseUnit;

  // 单手统计量
  const mu = bet * (2 * p - 1);
  const sigma2 = bet * bet * 4 * p * (1 - p);

  // EMA 注码平滑（§3.4 — AlphaGo工程师建议#1）
  const emaAlpha = config.emaConfig.alpha;
  if (!state.initialized) {
    state.emaBet = bet;
    state.initialized = true;
  } else {
    state.emaBet = emaAlpha * bet + (1 - emaAlpha) * state.emaBet;
  }

  // betAmplifier 使用 EMA 平滑注码
  const betRatio = state.emaBet / baseUnit;
  const betAmplifier = betRatio > 1 ? Math.pow(betRatio, betAmplifierExponent) : 1;

  // 总期望和调整后标准差
  const totalMu = n * mu;
  const adjustedSigma = Math.sqrt(n * sigma2) * betAmplifier;

  if (adjustedSigma <= 0) return B > 0 ? 1 : 0;

  const z = (B + totalMu) / adjustedSigma;

  // Clamp: 最低 5%（不给用户绝望感），最高 95%（永远有风险意识）
  return Math.max(0.05, Math.min(0.95, normalCDF(z)));
}

// ============================================================
// §4 etpProb（Policy Network）— 情绪崩盘概率
// 前景理论(Kahneman & Tversky 1992) + 7信号 Logistic + 交互项
// ============================================================

/** 计算七个信号值 */
function computeSignals(
  input: RiskEvalInput,
  config: RiskConfig,
): { x1: number; x2: number; x3: number; x4: number; x5: number; x6: number; x7: number } {
  const { alpha: ptAlpha, beta: ptBeta, lambda } = config.constants.prospectTheory;

  // ── Signal 1: 前景理论主观痛苦值 ──
  let x1 = 0;
  if (input.peakProfit > 0 && input.pnl < input.peakProfit) {
    // 情况A：有过盈利但回吐了
    const drawdown = input.peakProfit - input.pnl;
    const gainValue = Math.pow(input.peakProfit, ptAlpha);
    const lossValue = lambda * Math.pow(Math.max(0, drawdown), ptBeta);
    x1 = gainValue + lossValue > 0 ? lossValue / (gainValue + lossValue) : 0;
  } else if (input.pnl < 0) {
    // 情况B：从未盈利，一直亏损
    const lossRatio = Math.abs(input.pnl) / (input.stopLossAmount > 0 ? input.stopLossAmount : input.entryBank * 0.3);
    x1 = Math.min(1, Math.pow(lossRatio, ptAlpha));
  }
  // 情况C：当前盈利中 → x1 = 0

  // ── Signal 2: 输后加码强度 ──
  const rp = config.riskProfile;
  let x2: number;
  if (input.consecutiveRaises >= rp.consecutiveRaisesConfirmAt) {
    x2 = 1.0;  // 确认上头
  } else {
    x2 = Math.min(1, input.raiseAfterLoss / rp.raiseAfterLossFullAt);
  }

  // ── Signal 3: 连输/净输接近防线（指数型归一化） ──
  // 防护：streakLimit/netLossLimit 为 0 时视为未设置，信号归零
  const streakSignal = input.streakLimit > 0
    ? Math.min(1, Math.pow(input.consecutiveLosses / input.streakLimit, 2))
    : 0;
  const netLossSignal = input.netLossLimit > 0
    ? Math.min(1, Math.pow(input.netLoss / input.netLossLimit, 2))
    : 0;
  const x3 = Math.max(streakSignal, netLossSignal);

  // ── Signal 4: 盈利转亏关键时刻 ──
  const x4 = input.profitWentNegative ? 1.0 : 0;

  // ── Signal 5: 缠斗疲劳（从模板 riskProfile 读取阶梯） ──
  const grindRatio = input.grindThreshold > 0 ? input.grindHands / input.grindThreshold : 0;
  let x5 = 0;
  {
    const { ratios, values } = rp.grindFatigueLadder;
    for (let i = ratios.length - 1; i >= 0; i--) {
      if (grindRatio >= ratios[i]) { x5 = values[i]; break; }
    }
  }

  // ── Signal 6: 时间疲劳（从模板 riskProfile 读取阶梯） ──
  const t = input.elapsedMinutes;
  let x6 = 0;
  {
    const { minutes, values } = rp.timeFatigueLadder;
    for (let i = minutes.length - 1; i >= 0; i--) {
      if (t >= minutes[i]) { x6 = values[i]; break; }
    }
  }

  // ── Signal 7: 注码波动率（从模板 riskProfile 读取窗口和阈值） ──
  let x7 = 0;
  const minDataForVolatility = Math.max(3, Math.floor(rp.volatilityWindow * 0.6));
  if (input.recentBets.length >= minDataForVolatility) {
    const mean = input.recentBets.reduce((s, b) => s + b, 0) / input.recentBets.length;
    const variance = input.recentBets.reduce((s, b) => s + (b - mean) ** 2, 0) / input.recentBets.length;
    const stdDev = Math.sqrt(variance);
    x7 = Math.min(1, stdDev / (input.baseUnit * rp.volatilityFullStdDev));
  }

  return { x1, x2, x3, x4, x5, x6, x7 };
}

export function computeEtpProb(input: RiskEvalInput, config: RiskConfig): {
  etpProb: number;
  signals: EvaluationResult['signals'];
} {
  const w = config.logisticWeights;
  const { x1, x2, x3, x4, x5, x6, x7 } = computeSignals(input, config);

  // 交互项（AlphaGo工程师建议#2）
  const interaction = x2 * x3;

  // Logistic 回归
  const z = w.beta0
    + w.beta1 * x1
    + w.beta2 * x2
    + w.beta3 * x3
    + w.beta4 * x4
    + w.beta5 * x5
    + w.beta6 * x6
    + w.beta7 * x7
    + w.beta8 * interaction;

  let etpProb = 1 / (1 + Math.exp(-z));

  // ── 自检权重叠加（v1.3）──
  // 自检不是独立信号，而是"放大器"：用户自己承认状态差 → 放大etpProb
  // 衰减机制：每过5手boost减20%，25手后完全衰减
  const selfCheckBoost = computeSelfCheckBoost(input);
  if (selfCheckBoost > 0) {
    etpProb = Math.min(0.95, etpProb * (1 + selfCheckBoost));
  }

  return {
    etpProb,
    signals: {
      x1_pain: round4(x1),
      x2_raise: round4(x2),
      x3_streak: round4(x3),
      x4_profitGone: round4(x4),
      x5_grind: round4(x5),
      x6_time: round4(x6),
      x7_volatility: round4(x7),
      interaction: round4(interaction),
    },
  };
}

/**
 * 自检权重计算（v1.3）
 *
 * 用户做了自检 → 根据风险等级给出boost → 随手数衰减
 *
 * 设计思路：
 *   - 自检是用户主动承认"我状态不好"，这个信号比算法推测更可靠
 *   - safe = 0（不加权），caution = +10%，warning = +25%，danger = +50%
 *   - 每过5手衰减20%（25手后归零）——状态可能改善，不能永远惩罚
 *   - 如果用户做了自检但选safe，说明他有自我意识 → 反而是好信号，不加权
 */
function computeSelfCheckBoost(input: RiskEvalInput): number {
  const BASE_BOOST: Record<string, number> = {
    safe: 0,
    caution: 0.08,   // v1.3: 降低基础 boost（原0.10→0.08）
    warning: 0.18,    // v1.3: 降低（原0.25→0.18）
    danger: 0.35,     // v1.3: 降低（原0.50→0.35）
  };

  const base = BASE_BOOST[input.selfCheckRiskLevel] ?? 0;
  if (base === 0) return 0;

  // v1.3 加速衰减：每3手减25%，12手后归零（原每5手减20%，25手归零）
  // 原因：进场前自检是"起始状态"，不应长期惩罚。
  //        如果状态真的差，实战信号（连输/追损）会自然推高 etpProb。
  const decaySteps = Math.floor(input.selfCheckHandsAgo / 3);
  const decayFactor = Math.max(0, 1 - decaySteps * 0.25);

  return base * decayFactor;
}

// ============================================================
// §5 collapseProb（MCTS 简化版）— 崩盘路径概率
// 3步前瞻，2³=8 条路径穷举
// ============================================================

export function computeCollapseProb(input: RiskEvalInput, config: RiskConfig): number {
  const p = config.constants.p;
  const q = 1 - p;

  // 输后注码预测
  const betAfterLoss = input.raiseAfterLoss > 0
    ? input.currentBet * 1.5  // 有加码倾向
    : input.currentBet;        // 保守估计

  let collapseWeightedProb = 0;

  // 穷举 8 条路径（3手，每手输/赢）
  // 每条路径的完整概率 = p^wins × q^losses（始终计算完整3步概率）
  for (let path = 0; path < 8; path++) {
    let balance = input.currentBalance;
    let consecutiveLosses = input.consecutiveLosses;
    let netLoss = input.netLoss;
    let bet = input.currentBet;
    let collapsed = false;

    // 计算完整路径概率（3步）
    let pathProb = 1;
    for (let step = 0; step < 3; step++) {
      const isWin = ((path >> (2 - step)) & 1) === 1;
      pathProb *= isWin ? p : q;
    }

    // 模拟路径（检查是否在任一步崩盘）
    for (let step = 0; step < 3; step++) {
      const isWin = ((path >> (2 - step)) & 1) === 1;

      if (isWin) {
        balance += bet;
        consecutiveLosses = 0;
        bet = input.currentBet;
      } else {
        balance -= bet;
        consecutiveLosses += 1;
        netLoss += 1;
        bet = betAfterLoss;
      }

      if (
        balance <= input.stopLossAmount ||
        (input.streakLimit > 0 && consecutiveLosses >= input.streakLimit) ||
        (input.netLossLimit > 0 && netLoss >= input.netLossLimit)
      ) {
        collapsed = true;
        break;
      }
    }

    if (collapsed) {
      collapseWeightedProb += pathProb;
    }
  }

  // Clamp: 最高 90% — 留一线生机，不给绝望感
  return Math.min(0.90, collapseWeightedProb);
}

// ============================================================
// §6 三维整合：决策矩阵 + 干预叠加 + 防抖
// ============================================================

/** 干预级别数值映射（用于比较和叠加） */
const LEVEL_ORDER: Record<InterventionLevel, number> = {
  L0: 0, L1: 1, L2: 2, L3: 3, L4: 4,
};
const ORDER_TO_LEVEL: InterventionLevel[] = ['L0', 'L1', 'L2', 'L3', 'L4'];

function maxLevel(a: InterventionLevel, b: InterventionLevel): InterventionLevel {
  return LEVEL_ORDER[a] >= LEVEL_ORDER[b] ? a : b;
}

function levelUp(level: InterventionLevel, steps: number): InterventionLevel {
  const idx = Math.min(4, LEVEL_ORDER[level] + steps);
  return ORDER_TO_LEVEL[idx];
}

/** §6.2 基础决策矩阵（survivalProb × etpProb） */
function baseDecisionMatrix(
  survivalProb: number,
  etpProb: number,
  thresholds: RiskConfig['decisionMatrix'],
): InterventionLevel {
  const sHigh = survivalProb > thresholds.survivalProb.high;
  const sLow = survivalProb < thresholds.survivalProb.low;

  const eLow = etpProb < thresholds.etpProb.low;
  const eHigh = etpProb > thresholds.etpProb.high;

  if (sHigh && eLow) return 'L0';       // 安全：资金充裕+心态好
  if (sHigh && !eHigh) return 'L1';      // 轻提醒：资金OK但情绪有波动
  if (sHigh && eHigh) return 'L2';       // 中度：资金OK但心态不好
  if (sLow && eLow) return 'L2';         // 中度：资金紧但心态好，提醒控制
  if (sLow && !eHigh) return 'L3';       // 重度：资金紧+情绪中等
  if (sLow && eHigh) return 'L3';        // 重度：资金紧+心态差

  // 中间区域
  if (eLow) return 'L1';                 // 轻提醒：心态好
  if (eHigh) return 'L3';               // 重度：心态差
  return 'L2';                           // 中度：一般状态
}

/** §6.3 collapseProb 叠加 */
function applyCollapseOverlay(
  baseLevel: InterventionLevel,
  collapseProb: number,
  thresholds: RiskConfig['decisionMatrix'],
): InterventionLevel {
  if (collapseProb > 0.60) return levelUp(baseLevel, 2);
  if (collapseProb > thresholds.collapseProb.high) return levelUp(baseLevel, 1);
  return baseLevel;
}

// ============================================================
// §7+ 运行时状态更新 / 有效阈值 / 毒药组合 / 接近预警
// 这四个函数构成"反断层"核心 —— 所有参数都通过
// effectiveLimits 汇聚，不存在独立生效的指标
// ============================================================

/**
 * 更新引擎运行时状态（每手调用一次）
 * 锁盈状态机 + 毒药组合变量 + 连赢追踪
 * 规则：阶段只升不降，不可重置变量一旦设置不回退
 */
function updateRuntimeState(input: RiskEvalInput, config: RiskConfig): void {
  const params = config.template.params;

  // ── 锁盈状态机 ──
  const profitPct = input.entryBank > 0 ? input.pnl / input.entryBank : 0;

  // 阶段1：盈利≥激活阈值 → 锁盈激活
  if (profitPct >= params.profitLock.activatePct && state.profitLockStage < 1) {
    state.profitLockStage = 1;
    state.profitLockActive = true;
  }

  // 阶段2：盈利≥收紧阈值 → 连输/净输阈值收紧
  if (profitPct >= params.profitLock.tightenPct && state.profitLockStage < 2) {
    state.profitLockStage = 2;
  }

  // 峰值追踪（回撤计算用）
  if (input.pnl > state.peakProfit) {
    state.peakProfit = input.pnl;
  }

  // 阶段3：从峰值回撤≥drawdownPct → L3
  if (state.profitLockActive && state.peakProfit > 0) {
    const drawdown = (state.peakProfit - input.pnl) / state.peakProfit;
    if (drawdown >= params.profitLock.drawdownPct && state.profitLockStage < 3) {
      state.profitLockStage = 3;
    }
  }

  // 阶段4：利润归零
  if (state.profitLockActive && input.pnl <= 0 && state.profitLockStage < 4) {
    state.profitLockStage = 4;
  }

  // 阶段5：转亏（锁盈后反而亏损）
  if (state.profitLockActive && input.pnl < 0 && state.profitLockStage < 5) {
    state.profitLockStage = 5;
  }

  // ── 毒药组合#1: 缠斗记忆（不可重置） ──
  state.maxGrindEver = Math.max(state.maxGrindEver, input.grindHands);

  // ── 毒药组合#2: 连赢标记（不可重置） ──
  if (input.consecutiveWins >= params.poisonCombo.winStreakMark) {
    state.hadWinStreak = true;
  }

  // 顺风转折：曾连赢 + 连赢归零且开始输 = 转折发生
  if (state.hadWinStreak && input.consecutiveWins === 0 && input.consecutiveLosses > 0) {
    state.momentumReversed = true;
  }

  // ── 连赢追踪 ──
  state.consecutiveWins = input.consecutiveWins;
}

/**
 * 计算有效阈值 —— 反断层核心机制
 *
 * 两种收紧来源共享同一套 effectiveLimits，取更紧的值：
 *   来源1: 锁盈收紧 (profitLockStage ≥ 2)
 *   来源2: 顺风转折 (momentumReversed)
 *
 * 所有下游检查（x₃信号、MCTS路径、关键时刻、接近预警）
 * 都使用 effectiveLimits，不直接读取原始模板参数
 */
function computeEffectiveLimits(
  input: RiskEvalInput,
  config: RiskConfig,
): { streakLimit: number; netLossLimit: number; grindLimit: number } {
  const params = config.template.params;

  // 起点：原始模板阈值
  let streakLimit = input.streakLimit;
  let netLossLimit = input.netLossLimit;
  let grindLimit = input.grindThreshold;

  // 来源1: 锁盈收紧（阶段≥1 = 锁盈激活即收紧，规格书v1.2确认）
  // 20%盈利激活 → 连输/净输容忍度从3收紧到2
  if (state.profitLockActive && state.profitLockStage >= 1) {
    streakLimit = Math.min(streakLimit, params.profitLock.lockStreakLimit);
    netLossLimit = Math.min(netLossLimit, params.profitLock.lockNetLimit);
  }

  // 来源2: 顺风转折收紧
  if (state.momentumReversed) {
    streakLimit = Math.min(streakLimit, params.poisonCombo.postWinStreakLimit);
    netLossLimit = Math.min(netLossLimit, params.poisonCombo.postWinNetLimit);
    grindLimit = Math.min(grindLimit, params.poisonCombo.postWinGrindLimit);
  }

  // 来源3: 自检danger → 防线收紧1（§九）
  // warning只影响etpProb权重，不收紧阈值（避免2手就触发streak2_raise）
  // danger才收紧，下限=2（防止1手连输就触发）
  // 仅在自检后25手内生效
  if (input.selfCheckHandsAgo < 25 && input.selfCheckRiskLevel === 'danger') {
    streakLimit = Math.min(streakLimit, streakLimit - 1);
    netLossLimit = Math.min(netLossLimit, netLossLimit - 1);
  }

  // 下限保护：下限提升到2，避免极端情况1手就触发
  return {
    streakLimit: Math.max(2, streakLimit),
    netLossLimit: Math.max(2, netLossLimit),
    grindLimit: Math.max(1, grindLimit),
  };
}

/**
 * 毒药组合检测 — 对应规格书 §7.6
 * 使用运行时"不可重置"变量，不是当前快照
 *
 * #1 高压疲劳：time ≥ fatigueTime + 曾缠斗 ≥ fatigueGrind + 亏损中
 * #2 顺风转折：hadWinStreak + 连输≥2（转折后开始输）
 */
function detectToxicCombos(input: RiskEvalInput, config: RiskConfig): string[] {
  const combos: string[] = [];
  const params = config.template.params;

  // 时间百分比（用于多个组合判断）
  const maxTime = input.elapsedMinutes + Math.max(0, input.remainingMinutes);
  const timePercent = maxTime > 0 ? input.elapsedMinutes / maxTime : 0;
  // 盈利回吐率
  const givebackRate = input.peakProfit > 0
    ? (input.peakProfit - input.pnl) / input.peakProfit
    : 0;

  // ════════════════════════════════════════════
  // 三维/多维组合（优先级最高）
  // ════════════════════════════════════════════

  // #1 高压疲劳组合（三条件与）：time + grind记忆 + 亏损
  if (
    input.elapsedMinutes >= params.poisonCombo.fatigueTime &&
    state.maxGrindEver >= params.poisonCombo.fatigueGrind &&
    input.pnl < 0
  ) {
    combos.push('fatigue_pressure');
  }

  // #2 顺风转折组合（规格书v1.2：转折后检测3条件任一）
  if (state.momentumReversed) {
    const postWin = params.poisonCombo;
    if (input.consecutiveLosses >= postWin.postWinStreakLimit ||
        input.grindHands >= postWin.postWinGrindLimit ||
        input.netLoss >= postWin.postWinNetLimit) {
      combos.push('momentum_reversal');
    }
  }

  // #3 多维压力叠加：净输接近防线 + 连输中 + 时间≥50%
  if (input.netLossLimit > 0 &&
      input.netLoss >= input.netLossLimit - 1 &&
      input.consecutiveLosses >= 1 &&
      timePercent >= 0.5) {
    combos.push('multi_pressure');
  }

  // #4 缠斗绝望：缠斗达到极限 + 亏损中 + 时间≥60%
  if (input.grindCurrent &&
      input.grindHands >= input.grindThreshold &&
      input.pnl < 0 &&
      timePercent >= 0.6) {
    combos.push('grind_despair');
  }

  // ════════════════════════════════════════════
  // 双指标组合（追损类）
  // ════════════════════════════════════════════

  // #5 追损螺旋：连输≥3 + 输后加注 + 亏损中
  if (input.consecutiveLosses >= 3 &&
      input.raiseAfterLoss >= 1 &&
      input.pnl < 0) {
    combos.push('chase_spiral');
  }

  // #6 净输+追损：净输≥2 + 输后加注
  if (input.netLoss >= 2 && input.raiseAfterLoss > 0) {
    combos.push('netloss_raise');
  }

  // #7 止损接近+加码：距止损不足30% + 输后加注 → L4级危险
  if (input.stopLossAmount > 0) {
    const totalBuffer = input.entryBank - input.stopLossAmount;
    const distToStopLoss = input.currentBalance - input.stopLossAmount;
    if (totalBuffer > 0 &&
        distToStopLoss / totalBuffer < 0.3 &&
        input.raiseAfterLoss > 0) {
      combos.push('stoploss_raise');
    }
  }

  // ════════════════════════════════════════════
  // 双指标组合（疲劳类）
  // ════════════════════════════════════════════

  // #8 疲劳回吐：时间≥80% + 盈利回吐>50%
  if (timePercent >= 0.8 &&
      input.peakProfit > 0 &&
      givebackRate > 0.5) {
    combos.push('fatigue_giveback');
  }

  // #9 连输+疲劳：连输≥2 + 时间≥75%
  if (input.consecutiveLosses >= 2 && timePercent >= 0.75) {
    combos.push('streak_time');
  }

  // #10 净输+疲劳：净输≥2 + 时间≥75%
  if (input.netLoss >= 2 && timePercent >= 0.75) {
    combos.push('netloss_time');
  }

  // #11 时间+加码：时间≥75% + 输后加注
  if (timePercent >= 0.75 && input.raiseAfterLoss > 0) {
    combos.push('time_raise');
  }

  // ════════════════════════════════════════════
  // 双指标组合（缠斗类）
  // ════════════════════════════════════════════

  // #12 连输+缠斗：连输≥2 + 正在缠斗
  if (input.consecutiveLosses >= 2 && input.grindCurrent) {
    combos.push('streak_grind');
  }

  // #13 净输+缠斗：净输≥2 + 正在缠斗
  if (input.netLoss >= 2 && input.grindCurrent) {
    combos.push('netloss_grind');
  }

  // #14 缠斗+加码：缠斗中 + 输后加注
  if (input.grindCurrent && input.raiseAfterLoss > 0) {
    combos.push('grind_raise');
  }

  // ════════════════════════════════════════════
  // 双指标组合（锁盈/拐点类）
  // ════════════════════════════════════════════

  // #15 拐点上头：盈利转亏 + 加码>1.3倍基码
  if (input.profitWentNegative && input.betChange > 1.3) {
    combos.push('pivot_tilt');
  }

  // #16 锁盈恐慌：锁盈激活 + 连输≥2 + 输后加注
  if (state.profitLockStage >= 1 &&
      input.consecutiveLosses >= 2 &&
      input.raiseAfterLoss > 0) {
    combos.push('lock_panic');
  }

  return combos;
}

/**
 * "接近"预警检测 — threshold-1 触发 L2
 * 使用 effectiveLimits（不是原始参数！）
 *
 * 设计意图：在触及防线前一步给出黄灯
 * 比 L3 关键时刻早一手，让玩家有心理准备
 */
function detectApproachingWarnings(
  input: RiskEvalInput,
  effectiveLimits: { streakLimit: number; netLossLimit: number; grindLimit: number },
): string[] {
  const warnings: string[] = [];

  // 连输 = effectiveLimit - 1
  if (effectiveLimits.streakLimit > 1 &&
      input.consecutiveLosses === effectiveLimits.streakLimit - 1) {
    warnings.push('approaching_streak');
  }

  // 净输 = effectiveLimit - 1
  if (effectiveLimits.netLossLimit > 1 &&
      input.netLoss === effectiveLimits.netLossLimit - 1) {
    warnings.push('approaching_net_loss');
  }

  // 缠斗接近（grindWarnThreshold → grindLimit 之间）
  if (input.grindHands >= input.grindWarnThreshold &&
      input.grindHands < effectiveLimits.grindLimit) {
    warnings.push('approaching_grind');
  }

  // 锁盈后首次输（锁盈刚激活时任何亏损都是信号）
  if (state.profitLockActive && state.profitLockStage >= 1 &&
      state.profitLockStage < 3 && input.consecutiveLosses === 1) {
    warnings.push('approaching_profit_lock');
  }

  return warnings;
}

/**
 * §7 关键时刻检测（v1.2 重写 — 4个关键时刻）
 * 使用 effectiveLimits（不是原始 input.streakLimit！）
 *
 * 规格书v1.2定义的4个关键时刻：
 * #1 连输防线：连续输 ≥ effectiveStreakLimit → L3
 * #2 净输防线：总输 - 总赢 ≥ effectiveNetLossLimit → L3
 * #3 缠斗熔断：连续N手净盈亏在±2基码内 → L3
 * #4 输后加注模式：连输2手 + 第3手加注（无论输赢）→ L3
 *
 * 注意：盈利转亏(profit_gone)不是独立关键时刻！
 * 它是x₄信号，通过etpProb多维叠加自然达到L3/L4（规格书v1.2澄清）
 */
function detectKeyMoments(
  input: RiskEvalInput,
  effectiveLimits: { streakLimit: number; netLossLimit: number; grindLimit: number },
  config: RiskConfig,
): string[] {
  const moments: string[] = [];
  const params = config.template.params;

  // #1 连输防线（独立于净输，规格书v1.2分离）
  if (input.consecutiveLosses >= effectiveLimits.streakLimit) {
    moments.push('streak_limit');
  }

  // #2 净输防线（独立于连输，捕捉"锯齿式亏损"）
  if (input.netLoss >= effectiveLimits.netLossLimit) {
    moments.push('net_loss_limit');
  }

  // #3 缠斗熔断
  if (input.grindCurrent && input.grindHands >= effectiveLimits.grindLimit) {
    moments.push('grind');
  }

  // #4 连输2+加注（streak2PlusRaise开关控制）
  // "连输2手→还没到#1(需3手)，但第3手加注→行为暴露情绪失控"
  if (params.streak2PlusRaise &&
      input.consecutiveLosses >= 2 &&
      input.raiseAfterLoss > 0) {
    moments.push('streak2_raise');
  }

  // 超时（仍作为key moment但不在4个"关键时刻"之列）
  if (input.remainingMinutes <= 0) {
    moments.push('overtime');
  }

  // 盈利转亏 — 保留为信号但不再作为独立关键时刻（v1.2澄清）
  // 通过x₄信号推高etpProb，配合连输/缠斗/加注自然达到L3/L4
  // 但仍标记以便UI显示和数据记录
  if (input.profitWentNegative) {
    moments.push('profit_gone');
  }

  return moments;
}

/**
 * §6.5 干预叠加 — 关键时刻可叠加升级（v1.2 重写）
 *
 * 规格书铁律：
 * - 关键时刻触发 = L3（不经过L1/L2）
 * - 关键时刻后继续下注 = L4（不可跳过）
 * - 资金止损30% = 直接L4（最高优先级）
 * - 多维度同时触发 = 取最高级别
 *
 * profit_gone 不再独立提升级别（v1.2: 它通过x₄推高etpProb）
 */
function applyKeyMomentOverlay(
  level: InterventionLevel,
  moments: string[],
  input: RiskEvalInput,
): InterventionLevel {
  if (moments.length === 0) return level;

  // 4个关键时刻 = L3（规格书v1.2定义）
  const criticalMoments = ['streak_limit', 'net_loss_limit', 'grind', 'streak2_raise'];
  for (const cm of criticalMoments) {
    if (moments.includes(cm)) {
      level = maxLevel(level, 'L3');
    }
  }

  // 超时 = L3
  if (moments.includes('overtime')) {
    level = maxLevel(level, 'L3');
  }

  // profit_gone 不再单独升级（v1.2澄清：多维叠加自然达到L3/L4）
  // 但当 profit_gone + 加注行为 同时存在时，多维度爆红 → L4
  if (moments.includes('profit_gone') && input.raiseAfterLoss > 0) {
    level = 'L4';
  }

  // 资金止损穿透 = L4 铁律（独立维度，最高优先级）
  if (input.currentBalance <= input.stopLossAmount) {
    level = 'L4';
  }

  // 规格书§6.5叠加：中度+中度=重度, 中度+重度=极度, 重度+重度=极度
  const activeCritical = criticalMoments.filter(cm => moments.includes(cm));
  if (activeCritical.length >= 3) {
    level = 'L4';
  } else if (activeCritical.length >= 2) {
    level = maxLevel(level, 'L3');
  }

  return level;
}

/** §6.6 防抖（Hysteresis）— AlphaGo工程师建议#4 */
function applyHysteresis(
  rawLevel: InterventionLevel,
  survivalProb: number,
  etpProb: number,
  config: RiskConfig,
): InterventionLevel {
  const currentOrder = LEVEL_ORDER[state.currentLevel];
  const rawOrder = LEVEL_ORDER[rawLevel];

  // 升级一触即发
  if (rawOrder > currentOrder) {
    state.stableHandsCount = 0;
    state.currentLevel = rawLevel;
    return rawLevel;
  }

  // 同级 — 保持
  if (rawOrder === currentOrder) {
    state.stableHandsCount = 0;
    return state.currentLevel;
  }

  // 降级 — 需要持续改善
  if (state.currentLevel === 'L0') return 'L0';

  const rule = config.hysteresisConfig.downgrade[state.currentLevel as 'L1' | 'L2' | 'L3' | 'L4'];

  if (survivalProb >= rule.survivalProbMin && etpProb <= rule.etpProbMax) {
    state.stableHandsCount += 1;
    if (state.stableHandsCount >= rule.sustainedHands) {
      // 降一级
      state.currentLevel = ORDER_TO_LEVEL[currentOrder - 1];
      state.stableHandsCount = 0;
      return state.currentLevel;
    }
  } else {
    // 改善不稳定，重置计数
    state.stableHandsCount = 0;
  }

  // 保持当前级别
  return state.currentLevel;
}

/** 从三维概率映射 RiskTier（v1.3 修正 — 加权综合判断）
 *
 * 旧版问题：etpProb 阈值太严格（<0.2 才算保守），
 * 导致自检 boost 后即使 survivalProb 很高也被标为「激进」。
 *
 * 新版用综合风险分：riskScore = etpProb × 0.6 + (1 - survivalProb) × 0.4
 * 这样 survivalProb 高能拉低综合分，不会被单维度卡死。
 */
function mapToRiskTier(
  survivalProb: number,
  etpProb: number,
): RiskTier {
  // 综合风险分：0（最安全）→ 1（最危险）
  const riskScore = etpProb * 0.6 + (1 - survivalProb) * 0.4;

  if (riskScore < 0.25) return 'conservative';  // 保守
  if (riskScore < 0.45) return 'steady';         // 稳健
  if (riskScore < 0.70) return 'aggressive';     // 激进
  return 'out_of_control';                       // 失控
}

/** 从三维概率映射 0-100 分数（兼容旧版） */
function mapToScore(survivalProb: number, etpProb: number, collapseProb: number): number {
  // 加权映射：survivalProb 越高越安全 → 分数越低
  const dangerScore = (1 - survivalProb) * 0.4 + etpProb * 0.4 + collapseProb * 0.2;
  return Math.round(dangerScore * 100);
}

// ============================================================
// 主入口：evaluate()
// ============================================================

/**
 * ┌─────────────────────────────────────────────────────┐
 * │  🛠️  新模板开发清单（开发B/C/D模板时参考）          │
 * │                                                     │
 * │  1. 在 goldenTemplates.ts 创建 TEMPLATE_X_PARAMS    │
 * │     → 每个参数必须写 WHY 注释（参考A的格式）        │
 * │     → 参数联动关系必须在头部文档注明                 │
 * │                                                     │
 * │  2. 在 riskConfigService.ts 的                      │
 * │     getDefaultRiskConfig() 中注册模板映射            │
 * │                                                     │
 * │  3. 创建测试文件 riskEngine.templateX.test.ts        │
 * │     → 使用工厂函数：                                 │
 * │     createTemplateTestSuite('X', entryBank, {       │
 * │       baseUnitPct, streakLimit, netLossLimit,       │
 * │       stopLossPct, maxTime, lockStreakLimit          │
 * │     });                                             │
 * │                                                     │
 * │  4. 运行 npx vitest run 确认全绿                    │
 * │                                                     │
 * │  5. 本引擎 evaluate() 不需要修改                    │
 * │     → 所有模板差异通过 GoldenTemplateParams 注入     │
 * │     → 11步流程对所有模板通用                         │
 * └─────────────────────────────────────────────────────┘
 */

/**
 * 三维风控评估 — 每手结束后调用（v1.2 反断层版）
 *
 * 完整流程（11步，不可跳步）：
 *   ① 运行时状态更新（锁盈/毒药变量）
 *   ② 有效阈值计算（反断层核心 —— 两种收紧汇聚于此）
 *   ③ 构造 effectiveInput（下游统一使用收紧后的阈值）
 *   ④ 三维概率计算（survivalProb / etpProb / collapseProb）
 *   ⑤ 基础决策矩阵
 *   ⑥ collapseProb 叠加
 *   ⑦ "接近"预警（threshold-1 = L2 黄灯）
 *   ⑧ 关键时刻叠加（含新增 #5 streak2_raise）
 *   ⑨ 毒药组合（高压疲劳 / 顺风转折 → L3）
 *   ⑩ 锁盈阶段≥3 → L3/L4
 *   ⑪ 防抖（Hysteresis）
 *
 * ⚠️ 反断层设计：effectiveLimits 在步骤②计算一次，
 *    然后注入到步骤③的 effectiveInput，
 *    步骤④⑦⑧全部从 effectiveInput 读取阈值。
 *    没有任何下游代码直接读取原始模板参数做阈值判断。
 */
export function evaluate(input: RiskEvalInput, config: RiskConfig): EvaluationResult {
  // 无学习期 — 第1手就完整计算三维概率
  // EMA没有历史时用当前值作为初始值，概率照算

  // ① 更新运行时状态（锁盈状态机 + 毒药变量）
  updateRuntimeState(input, config);

  // ② 计算有效阈值 — 反断层核心
  //    锁盈收紧 + 顺风转折 → 取 min → 统一输出
  const effectiveLimits = computeEffectiveLimits(input, config);

  // ③ 构造有效输入 — 所有下游函数使用此对象
  //    关键：streakLimit/netLossLimit/grindThreshold 被替换为收紧后的值
  //    这保证了 x₃信号、MCTS路径、关键时刻 全部感知到收紧
  const effectiveInput: RiskEvalInput = {
    ...input,
    streakLimit: effectiveLimits.streakLimit,
    netLossLimit: effectiveLimits.netLossLimit,
    grindThreshold: effectiveLimits.grindLimit,
  };

  // ④ 三维概率计算 — 全部使用 effectiveInput
  const survivalProb = computeSurvivalProb(effectiveInput, config);
  const { etpProb, signals } = computeEtpProb(effectiveInput, config);
  const collapseProb = computeCollapseProb(effectiveInput, config);

  // ⑤ 基础决策矩阵（survivalProb × etpProb）
  let level = baseDecisionMatrix(survivalProb, etpProb, config.decisionMatrix);
  const sourceReasons: string[] = [];

  if (survivalProb < 0.3) sourceReasons.push('资金缓冲区较小');
  if (etpProb > 0.5) sourceReasons.push('情绪压力偏高');

  // ⑥ collapseProb 叠加
  const preCollapseLevel = level;
  level = applyCollapseOverlay(level, collapseProb, config.decisionMatrix);
  if (level !== preCollapseLevel) {
    sourceReasons.push('后续几手风险偏高');
  }

  // ⑦ "接近"预警（threshold-1 = 至少L2 黄灯）
  const approachingWarnings = detectApproachingWarnings(effectiveInput, effectiveLimits);
  if (approachingWarnings.length > 0) {
    level = maxLevel(level, 'L2');
    const warnLabels: Record<string, string> = {
      approaching_streak: '连输接近防线',
      approaching_net_loss: '净输接近防线',
      approaching_grind: '缠斗手数偏多',
      approaching_profit_lock: '锁盈后出现亏损',
    };
    sourceReasons.push(...approachingWarnings.map(w => warnLabels[w] || w));
  }

  // ⑧ 关键时刻叠加（使用 effectiveInput + effectiveLimits）
  const keyMoments = detectKeyMoments(effectiveInput, effectiveLimits, config);
  const preMomentLevel = level;
  level = applyKeyMomentOverlay(level, keyMoments, effectiveInput);
  if (level !== preMomentLevel) {
    const momentLabels: Record<string, string> = {
      streak_limit: '连输触及防线',
      net_loss_limit: '净输触及防线',
      streak_net_loss: '连输/净输触及防线', // 兼容
      grind: '进入缠斗状态',
      overtime: '在桌时间超限',
      profit_gone: '盈利已回吐',
      streak2_raise: '连输后加注',
    };
    sourceReasons.push(...keyMoments.map(m => momentLabels[m] || m));
  }

  // ⑨ 毒药组合（使用运行时不可重置变量 + 组合指标检测）
  const toxicCombos = detectToxicCombos(effectiveInput, config);
  if (toxicCombos.length > 0) {
    // stoploss_raise → L4，其余 → L3
    if (toxicCombos.includes('stoploss_raise')) {
      level = 'L4';
    } else {
      level = maxLevel(level, 'L3');
    }
    const comboLabels: Record<string, string> = {
      // 三维组合
      fatigue_pressure: '高压疲劳组合',
      momentum_reversal: '顺风转折组合',
      multi_pressure: '多维压力叠加',
      grind_despair: '缠斗绝望',
      // 追损类
      chase_spiral: '追损螺旋',
      netloss_raise: '净输+追损',
      stoploss_raise: '止损接近+加码',
      // 疲劳类
      fatigue_giveback: '疲劳回吐',
      streak_time: '连输+疲劳',
      netloss_time: '净输+疲劳',
      time_raise: '疲劳+加码',
      // 缠斗类
      streak_grind: '连输+缠斗',
      netloss_grind: '净输+缠斗',
      grind_raise: '缠斗+加码',
      // 锁盈/拐点类
      pivot_tilt: '拐点上头',
      lock_panic: '锁盈恐慌',
    };
    sourceReasons.push(...toxicCombos.map(c => comboLabels[c] || c));
  }

  // ⑩ 锁盈阶段升级
  if (state.profitLockStage >= 4) {
    // 阶段4/5: 锁盈利润归零/转亏 → 至少L3（极端情况可能已是L4）
    level = maxLevel(level, 'L3');
    sourceReasons.push(state.profitLockStage >= 5 ? '锁盈后反转亏损' : '锁盈利润已归零');
  } else if (state.profitLockStage === 3) {
    // 阶段3: 大幅回撤 → 至少L3
    level = maxLevel(level, 'L3');
    sourceReasons.push('利润大幅回撤');
  }

  // ⑪ 防抖（Hysteresis）— 升级一触即发，降级需持续改善
  level = applyHysteresis(level, survivalProb, etpProb, config);

  // 组装人话来源
  const source = sourceReasons.length > 0 ? sourceReasons.join('，') : '综合评估正常';

  return {
    timestamp: new Date().toISOString(),
    handNumber: input.totalHands,

    survivalProb: round4(survivalProb),
    etpProb: round4(etpProb),
    collapseProb: round4(collapseProb),

    signals,

    interventionLevel: level,
    interventionSource: source,

    keyMoments,
    toxicCombos,
    profitLockStage: state.profitLockStage,
    effectiveLimits: {
      ...effectiveLimits,
      // 原始模板阈值（用于UI对比显示 "3→2"）
      originalStreakLimit: input.streakLimit,
      originalNetLossLimit: input.netLossLimit,
      originalGrindLimit: input.grindThreshold,
    },

    hysteresis: {
      stableHandsCount: state.stableHandsCount,
      pendingDowngrade: state.stableHandsCount > 0 && LEVEL_ORDER[state.currentLevel] > LEVEL_ORDER[level],
    },

    finalTier: mapToRiskTier(survivalProb, etpProb),
    finalScore: mapToScore(survivalProb, etpProb, collapseProb),
  };
}

// ============================================================
// FMMetrics → RiskEvalInput 转换器
// 从现有系统数据构造三维引擎所需的标准输入
// ============================================================

/** 从 session 事件中提取输后加码和缠斗信号 */
function extractBehaviorSignals(events: FMEvent[], baseUnit: number, grindNetRange: number = 2): {
  raiseAfterLoss: number;
  consecutiveRaises: number;
  recentBets: number[];
  grindHands: number;
  grindCurrent: boolean;
  profitWentNegative: boolean;
} {
  const handTypes = new Set(['win', 'loss']);
  const handEvents = events.filter(e => handTypes.has(e.event_type));

  // 最近 5 手注码
  const recentBets: number[] = [];
  for (let i = Math.max(0, handEvents.length - 5); i < handEvents.length; i++) {
    recentBets.push(handEvents[i].amount ?? baseUnit);
  }

  // 输后加码：连续在输后加注的次数
  let raiseAfterLoss = 0;
  let consecutiveRaises = 0;
  let lastWasLoss = false;
  let lastBet = baseUnit;

  for (const e of handEvents) {
    const bet = e.amount ?? baseUnit;
    if (lastWasLoss && bet > lastBet) {
      raiseAfterLoss++;
    } else if (!lastWasLoss || bet <= lastBet) {
      raiseAfterLoss = 0;
    }

    if (bet > lastBet) {
      consecutiveRaises++;
    } else {
      consecutiveRaises = 0;
    }

    lastWasLoss = e.event_type === 'loss';
    lastBet = bet;
  }

  // 缠斗检测（v1.3 修正 — 双重判定）
  // 旧版问题：从尾部倒扫，中间任何一手累计超范围就 break，
  // 导致"整场看是缠斗但中间有波动"的情况漏检。
  //
  // 新版双重判定：
  //   方法A（全局视角）：总手数 ≥ 5 且 整场净盈亏在 ±netRange 基码内
  //   方法B（尾部连续段）：从最后一手倒扫连续段（保留旧逻辑）
  // 取两者最大值 → 更准确捕捉"打了很多手但赢不动"的缠斗本质
  let grindHands = 0;
  let grindCurrent = false;

  // 方法A：全局缠斗判定
  const totalPnl = handEvents.reduce((sum, e) => {
    const amt = e.amount ?? baseUnit;
    return sum + (e.event_type === 'win' ? amt : -amt);
  }, 0);
  const globalGrind = handEvents.length >= 5 && Math.abs(totalPnl) <= grindNetRange * baseUnit;
  const globalGrindHands = globalGrind ? handEvents.length : 0;

  // 方法B：尾部连续段（旧逻辑）
  let tailGrindHands = 0;
  let runningPnl = 0;
  for (let i = handEvents.length - 1; i >= 0; i--) {
    const e = handEvents[i];
    const amt = e.amount ?? baseUnit;
    runningPnl += e.event_type === 'win' ? amt : -amt;
    if (Math.abs(runningPnl) <= grindNetRange * baseUnit) {
      tailGrindHands++;
    } else {
      break;
    }
  }

  // 取两者最大值
  grindHands = Math.max(globalGrindHands, tailGrindHands);
  grindCurrent = grindHands >= 5; // 5手以上才算进入缠斗

  // 盈利转亏：检测是否曾盈利后转负
  let peakPnl = 0;
  let currentPnl = 0;
  let profitWentNegative = false;

  for (const e of handEvents) {
    const amt = e.amount ?? baseUnit;
    currentPnl += e.event_type === 'win' ? amt : -amt;
    if (currentPnl > peakPnl) peakPnl = currentPnl;
    if (peakPnl > 0 && currentPnl <= 0) {
      profitWentNegative = true;
    }
  }

  return { raiseAfterLoss, consecutiveRaises, recentBets, grindHands, grindCurrent, profitWentNegative };
}

/**
 * 从 FMMetrics + Session 构造三维引擎标准输入
 * 在 dataPipeline.evaluateLiveETP() 中调用
 */
export function metricsToRiskInput(
  metrics: FMMetrics,
  session: FMSession,
  plan: SessionPlan,
  templateParams?: import('../types/riskConfig').GoldenTemplateParams,
): RiskEvalInput {
  const baseUnit = plan.base_unit || Math.round(plan.session_budget * 0.08);
  // 从模板参数读取缠斗配置，不再硬编码
  const grindNetRange = templateParams?.grindTrigger?.netRange ?? 2;
  const behavior = extractBehaviorSignals(session.events, baseUnit, grindNetRange);
  const grindThreshold = templateParams?.grindTrigger?.hands ?? (plan.stop_loss_streak >= 8 ? 10 : 8);

  // v1.3: 提取最近一次自检结果
  const selfCheck = extractLatestSelfCheck(session.events, metrics.total_hands);

  return {
    // 资金状态
    currentBalance: metrics.current_balance,
    entryBank: plan.session_budget,
    baseUnit,
    currentBet: metrics.current_bet_unit || baseUnit,
    stopLossAmount: plan.stop_loss_amount,

    // 盈亏状态
    pnl: metrics.net_pnl,
    peakProfit: metrics.highest_profit,
    profitWentNegative: behavior.profitWentNegative,

    // 行为信号
    consecutiveLosses: metrics.current_loss_streak,
    netLoss: metrics.net_loss_hands,
    raiseAfterLoss: behavior.raiseAfterLoss,
    consecutiveRaises: behavior.consecutiveRaises,
    recentBets: behavior.recentBets,

    // 时间/疲劳
    elapsedMinutes: metrics.elapsed_minutes,
    totalHands: metrics.total_hands,
    remainingMinutes: metrics.remaining_minutes,

    // 缠斗状态
    grindHands: behavior.grindHands,
    grindCurrent: behavior.grindCurrent,

    // 连赢状态
    consecutiveWins: metrics.current_win_streak,

    // 模板参数
    streakLimit: plan.stop_loss_streak,
    netLossLimit: plan.stop_loss_net_hands,
    grindThreshold,
    grindWarnThreshold: templateParams?.grindTrigger?.warnHands ?? (grindThreshold - 2),

    // 自检信号（v1.3）
    selfCheckRiskLevel: selfCheck.riskLevel,
    selfCheckHandsAgo: selfCheck.handsAgo,

    // 旧版兼容
    streak: -metrics.current_loss_streak || metrics.current_win_streak,
    betChange: metrics.current_bet_unit / baseUnit,
    grindCount: behavior.grindCurrent ? 1 : 0,
    tableTime: metrics.elapsed_minutes,
  };
}

/**
 * 从 session events 中提取最近一次自检结果
 * 返回风险等级和距离当前手数的距离（用于衰减计算）
 */
function extractLatestSelfCheck(
  events: FMEvent[],
  currentTotalHands: number,
): { riskLevel: 'safe' | 'caution' | 'warning' | 'danger'; handsAgo: number } {
  // 倒序查找最近的 self_check 事件
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.event_type === 'self_check' && e.self_check_result) {
      // 计算自检后打了多少手
      const handTypes = new Set(['win', 'loss']);
      let handsAfterCheck = 0;
      for (let j = i + 1; j < events.length; j++) {
        if (handTypes.has(events[j].event_type)) handsAfterCheck++;
      }
      return {
        riskLevel: e.self_check_result.risk_level,
        handsAgo: handsAfterCheck,
      };
    }
  }
  // 没做过自检 → safe，距离无穷大（不生效）
  return { riskLevel: 'safe', handsAgo: 999 };
}

// ── 工具函数 ──

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
