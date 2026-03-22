// ============================================================
// 风控评估引擎 — 类型定义
// 对应设计文档：OS风控系统-开发指导规格书
// ============================================================

import type { SessionPlan } from './fundManager';

// ---------- 模板体系 ----------

/** 模板 ID：A/B/C 固定预设，D 自主设置，E 数据进化 */
export type GoldenTemplateId = 'A' | 'B' | 'C' | 'D' | 'E';

/** 模板类别 */
export type TemplateCategory = 'preset' | 'custom' | 'data_driven';

/**
 * 黄金比例模板 — 完整参数集（v1.2 校准版）
 * 对应规格书 §8.2 + §8.5
 * 所有百分比参数以小数表示（0.08 = 8%）
 *
 * ⚠️ 参数之间是互相关联的链条，不是独立开关！
 * 核心关联链：
 *   baseUnitPct × streakLimit = 最大连输亏损
 *   stopLossPct 必须 > baseUnitPct × streakLimit（留出缓冲B）
 *   锁盈激活 → 收紧连输/净输阈值（lockStreakLimit/lockNetLimit）
 *   顺风转折 → 收紧连输/净输/缠斗阈值（poisonCombo.postWin*）
 *   两种收紧共享同一套 effectiveLimit 机制，取更紧的那个
 */
export interface GoldenTemplateParams {
  // ── 核心9维度 ──
  baseUnitPct: number;           // 基码占进场资金百分比 [锚点参数]；C模板为总赌本百分比
  streakLimit: number;           // 连输止损防线（手数）→ 关键时刻#1；0=不设
  streakWarn?: number;           // 连输告警手数（可选；默认 streakLimit-1）
  netLossLimit: number;          // 净输防线（手数）→ 关键时刻#2
  stopLossPct: number;           // 亏损止损线（独立维度，与连输逻辑自洽但分开）
  sessionBudgetRatio?: number;   // 进场资金占总赌本的比例（C模板专用，0.30=30%）
  maxTime: number;               // 时间防线（分钟）

  // ── 时间三段预警（关联：必须 timeWarn1 < timeWarn2 < timeWarn3 <= maxTime）──
  timeWarn1: number;             // 第一次L2提醒（A=45, B=45, C=30）
  timeWarn2: number;             // 第二次L2提醒（A=55, B=55, C=36）
  timeWarn3: number;             // 第三次L3提醒 = maxTime（A=60, B=60, C=40）

  // ── 缠斗参数（关联：warnHands < hands，hands = 关键时刻#3）──
  grindTrigger: {
    hands: number;               // 缠斗极限 → 关键时刻#3（A=10, B=8, C=8）
    netRange: number;            // 缠斗判定范围（基码倍数）（A=2, B=1, C=2）
    warnHands: number;           // 缠斗前兆 → L2预警（A=8, B=6, C=6）
  };

  // ── 锁盈机制（关联：激活后收紧连输/净输阈值）──
  profitLock: {
    activatePct: number;         // 激活阈值 → 触发后 streakLimit/netLossLimit 收紧
    tightenPct: number;          // 收紧阈值 → 更高级别保护
    drawdownPct: number;         // 从峰值回撤比 → L3
    lockStreakLimit: number;     // 锁盈后的连输容忍（< streakLimit）
    lockNetLimit: number;        // 锁盈后的净输容忍（< netLossLimit）
  };

  // ── 输后加注检测 ──
  forbidRaise: boolean;          // 纪律要求：输后不应加注（用户可以加注，系统检测违规）
  raiseFullAt: number;           // x₂信号达满分的违规次数
  streak2PlusRaise: boolean;     // 关键时刻#4开关：连输2手+第3手加注=L3

  // ── 盈利目标（独立于锁盈，基于风险收益比）──
  takeProfitPct: number;           // 盈利目标线 = stopLossPct × 风险收益比（强制提醒离场）

  // ── 毒药组合（关联：共享运行时状态 maxGrindEver/hadWinStreak）──
  poisonCombo: {
    fatigueTime: number;         // 高压疲劳-时间门槛（通常 = timeWarn1）
    fatigueGrind: number;        // 高压疲劳-缠斗记忆门槛（通常 = grindTrigger.warnHands）
    winStreakMark: number;        // 顺风标记门槛（连赢≥N手）
    postWinStreakLimit: number;  // 转折后连输收紧（< streakLimit）
    postWinGrindLimit: number;  // 转折后缠斗收紧（< grindTrigger.hands）
    postWinNetLimit: number;     // 转折后净输收紧（< netLossLimit）
  };
}

/**
 * 模板独立风控参数集 — 每个模板有自己的权重、阈值、阶梯
 * 引擎是纯函数，所有差异都在 riskProfile 里
 */
export interface TemplateRiskProfile {
  /** Logistic 模型权重 β₀-β₈ */
  logisticWeights: LogisticWeights;
  /** 决策矩阵阈值 */
  decisionMatrix: DecisionMatrixThresholds;
  /** 防抖降级条件 */
  hysteresisConfig: HysteresisConfig;
  /** 时间疲劳阶梯（分钟→信号值），长度必须相同 */
  timeFatigueLadder: { minutes: number[]; values: number[] };
  /** 缠斗疲劳阶梯（grindRatio→信号值） */
  grindFatigueLadder: { ratios: number[]; values: number[] };
  /** 输后加码满分阈值 */
  raiseAfterLossFullAt: number;
  /** 连续加码确认上头阈值 */
  consecutiveRaisesConfirmAt: number;
  /** 注码波动率窗口和满分标准差（基码倍数） */
  volatilityWindow: number;
  volatilityFullStdDev: number;
  /** 物理常数（一般三个模板相同，但保留覆盖能力） */
  constants: {
    p: number;
    handsPerMinute: number;
    betAmplifierExponent: number;
    prospectTheory: { alpha: number; beta: number; lambda: number };
  };
  /** EMA 配置 */
  emaConfig: EMAConfig;
}

/** 黄金比例模板完整定义 */
export interface GoldenTemplate {
  id: GoldenTemplateId;
  name: string;                  // 显示名："标准防守" / "进场即止损" / "快打速决"
  subtitle: string;              // 副标题："保守·防守型"
  description: string;           // 适用画像描述
  category: TemplateCategory;
  locked: boolean;               // true = 参数不可修改（A/B/C）
  params: GoldenTemplateParams;
  /** 模板独立的风控参数集 */
  riskProfile: TemplateRiskProfile;
  /** 模板参数映射为 SessionPlan 的部分字段（用于表单自动填充） */
  toPlanPartial: (entryBank: number) => Partial<SessionPlan>;
}

// ---------- 风险档位 ----------

/**
 * 四级风险档位
 * 对应规格书 §2 核心概念词典 riskTier
 */
export type RiskTier = 'conservative' | 'steady' | 'aggressive' | 'out_of_control';

/** 风险档位中文标签 */
export const RISK_TIER_LABELS: Record<RiskTier, string> = {
  conservative: '保守',
  steady: '稳健',
  aggressive: '激进',
  out_of_control: '失控',
};

/** 风险档位颜色 */
export const RISK_TIER_COLORS: Record<RiskTier, string> = {
  conservative: '#22C55E',   // 绿
  steady: '#E6B800',         // 金
  aggressive: '#F97316',     // 橙
  out_of_control: '#E63946', // 红
};

// ---------- 干预级别 ----------

/**
 * 五级干预体系（含 L0 正常状态）
 * 对应算法规格书 §6.4
 */
export type InterventionLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';

/** 干预级别配置 */
export interface InterventionLevelConfig {
  level: InterventionLevel;
  name: string;                  // "正常" / "轻提醒" / "正式警告" / "强警告" / "强制干预"
  uiMode: 'none' | 'toast' | 'modal' | 'fullscreen' | 'forced';
  blocking: boolean;             // 是否阻断操作
  requireAck: boolean;           // 是否需要用户确认
  cooldown: number;              // 同级干预最小间隔（秒）[HUMAN_TUNABLE]
}

// ---------- 毒药组合 ----------

/**
 * 毒药组合规则
 * 对应规格书 §4.3 Layer3_ToxicComboBreaker
 */
export interface ToxicComboRule {
  name: string;                  // "高压疲劳组合" / "上头追损组合" / "顺风膨胀组合"
  id: string;                    // "fatigue_pressure" / "tilt_chasing" / "winner_tilt"
  /** 条件判定函数（运行时由引擎调用） */
  conditions: ToxicCondition[];
  forcedTier: RiskTier;          // 命中后强制设定的档位
  forcedLevel: InterventionLevel; // 命中后强制设定的干预级别
}

/** 毒药组合单个条件 */
export interface ToxicCondition {
  field: string;                 // 指标字段名
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'trending_down';
  value: number | boolean;       // 阈值
  description: string;           // 人可读描述
}

// ---------- 评估引擎配置（旧三层结构，保留兼容） ----------

/**
 * 第一层权重配置（旧版，保留兼容）
 * 对应旧规格书 §4.1 权重分配
 */
export interface Layer1Weights {
  netLossScore: number;          // 净输/连输 — 0.35
  pnlDrawdown: number;           // 盈亏回吐 — 0.30
  timeScore: number;             // 时间 — 0.15
  grindScore: number;            // 缠斗 — 0.10
  streakScore: number;           // 连串 — 0.10
}

/**
 * 第二层疲劳配置（旧版，保留兼容）
 * 对应旧规格书 §4.2 疲劳系数
 */
export interface FatigueConfig {
  timeDecay: {
    breakpoints: number[];       // [30, 45, 60, 90]
    values: number[];            // [0, 0.1, 0.25, 0.5]
  };
  grindDecay: {
    breakpoints: number[];       // [1, 2, 3, 5]
    values: number[];            // [0.05, 0.15, 0.3, 0.5]
  };
}

/** 档位边界 */
export type TierBoundaries = Record<RiskTier, [number, number]>;

// ---------- 三维评估引擎配置（新 — 算法规格书 v1.1） ----------

/**
 * Logistic 模型权重
 * 对应算法规格书 §4.3 + §8.3
 * β₀ 基线, β₁-β₇ 七信号, β₈ 交互项(x₂×x₃)
 */
export interface LogisticWeights {
  beta0: number;                 // 基线截距 -4.5
  beta1: number;                 // 前景痛苦 2.0
  beta2: number;                 // 输后加码 2.5（最高权重）
  beta3: number;                 // 连输/净输 2.0
  beta4: number;                 // 盈利转亏 1.8
  beta5: number;                 // 缠斗疲劳 1.5
  beta6: number;                 // 时间疲劳 1.2
  beta7: number;                 // 注码波动 0.8
  beta8: number;                 // 交互项(x₂×x₃) 1.5 — AlphaGo工程师建议#2
}

/**
 * EMA 动态方差追踪配置
 * 对应算法规格书 §3.4 — AlphaGo工程师建议#1
 */
export interface EMAConfig {
  alpha: number;                 // EMA 平滑系数 0.333
  window: number;                // 等效窗口 5 手
}

/**
 * 防抖（Hysteresis）降级配置
 * 对应算法规格书 §6.6 — AlphaGo工程师建议#4
 * 升级一触即发，降级需持续改善
 */
export interface HysteresisConfig {
  /** 每个级别的降级条件 */
  downgrade: Record<'L4' | 'L3' | 'L2' | 'L1', {
    survivalProbMin: number;     // survivalProb 需高于此值
    etpProbMax: number;          // etpProb 需低于此值
    sustainedHands: number;      // 需持续的手数
  }>;
}

/**
 * 三维引擎决策矩阵阈值
 * 对应算法规格书 §6.1
 */
export interface DecisionMatrixThresholds {
  survivalProb: { high: number; low: number };   // >70%, <30%
  etpProb: { low: number; high: number };         // <20%, >50%
  collapseProb: { low: number; high: number };    // <20%, >40%
}

/**
 * 风险评估引擎完整配置
 * 对应算法规格书全篇
 * 所有 [HUMAN_TUNABLE] 参数从此配置读取，支持热更新
 */
export interface RiskConfig {
  template: GoldenTemplate;
  /** 模板独立风控参数集（便捷引用，= template.riskProfile） */
  riskProfile: TemplateRiskProfile;

  // 旧三层结构（保留兼容）
  weights: Layer1Weights;
  tierBoundaries: TierBoundaries;
  fatigueConfig: FatigueConfig;
  toxicCombos: ToxicComboRule[];
  interventionConfig: Record<InterventionLevel, InterventionLevelConfig>;

  // 新三维引擎配置（算法规格书 v1.1）
  logisticWeights: LogisticWeights;
  emaConfig: EMAConfig;
  hysteresisConfig: HysteresisConfig;
  decisionMatrix: DecisionMatrixThresholds;

  // 物理常数
  constants: {
    p: number;                   // 闲家胜率 0.4876
    handsPerMinute: number;      // 每分钟手数 1.2
    betAmplifierExponent: number; // 注码放大指数 1.5
    prospectTheory: {
      alpha: number;             // 0.88
      beta: number;              // 0.88
      lambda: number;            // 2.25
    };
  };
}

// ---------- 引擎运行时状态（跨手数持久化） ----------

/**
 * 风控引擎运行时状态
 * 这些变量在整个场次内累积，不随单手结算重置
 *
 * ⚠️ 关键设计：maxGrindEver 和 hadWinStreak 是"不可重置"变量
 * 它们记录的是"曾经发生过"，不是"当前正在发生"
 * 这是毒药组合检测的基础——精神消耗的印记不会因为短暂好转而消失
 */
export interface RiskEngineRuntimeState {
  // EMA 注码追踪
  emaBet: number;
  emaVariance: number;

  // 干预防抖
  currentLevel: InterventionLevel;
  stableHandsCount: number;

  // 锁盈状态机（5阶段，关联：影响 effectiveStreakLimit/effectiveNetLimit）
  profitLockActive: boolean;     // 盈利≥activatePct时激活
  profitLockStage: number;       // 0=未盈利, 1=激活, 2=收紧, 3=回撤, 4=归零, 5=转亏
  peakProfit: number;            // 本场最高盈利（回撤计算用）

  // 毒药组合#1 高压疲劳（不可重置变量）
  maxGrindEver: number;          // 全局最大缠斗长度 = Math.max(maxGrindEver, grindHands)

  // 毒药组合#2 顺风转折（不可重置变量）
  hadWinStreak: boolean;         // 曾连赢≥winStreakMark手（一旦true不重置）
  momentumReversed: boolean;     // hadWinStreak && 连赢归零 = 转折发生

  // 连赢追踪
  consecutiveWins: number;       // 当前连赢手数

  // 初始化标记
  initialized: boolean;
}

// ---------- 评估结果 ----------

/**
 * 三维评估引擎结果
 * 对应算法规格书 §6
 */
export interface EvaluationResult {
  timestamp: string;             // ISO
  handNumber: number;

  // 三维概率输出（算法规格书核心）
  survivalProb: number;          // 资金生存概率 0-1（§3 Value Network）
  etpProb: number;               // 情绪崩盘概率 0-1（§4 Policy Network）
  collapseProb: number;          // 崩盘路径概率 0-1（§5 MCTS）

  // 七信号快照（etpProb 的输入明细）
  signals: {
    x1_pain: number;             // 前景痛苦值
    x2_raise: number;            // 输后加码强度
    x3_streak: number;           // 连输/净输接近防线
    x4_profitGone: number;       // 盈利转亏
    x5_grind: number;            // 缠斗疲劳
    x6_time: number;             // 时间疲劳
    x7_volatility: number;      // 注码波动率
    interaction: number;         // β₈(x₂×x₃) 交互项
  };

  // 决策矩阵输出
  interventionLevel: InterventionLevel;
  interventionSource: string;    // 触发来源描述

  // 关键时刻
  keyMoments: string[];          // 当前激活的关键时刻 ID

  // 毒药组合
  toxicCombos: string[];         // 当前触发的毒药组合 ID（'fatigue_pressure'/'momentum_reversal'）

  // 锁盈状态
  profitLockStage: number;       // 当前锁盈阶段 0-5

  // 有效阈值（经锁盈收紧/顺风转折收紧后的实际生效值）
  effectiveLimits: {
    streakLimit: number;         // 实际连输防线（可能被收紧）
    netLossLimit: number;        // 实际净输防线（可能被收紧）
    grindLimit: number;          // 实际缠斗极限（可能被收紧）
    // 原始模板阈值（用于UI对比显示 "3→2"）
    originalStreakLimit: number;
    originalNetLossLimit: number;
    originalGrindLimit: number;
  };

  // 防抖状态（Hysteresis）
  hysteresis: {
    stableHandsCount: number;    // 当前已稳定手数
    pendingDowngrade: boolean;   // 是否正在降级观察期
  };

  // 旧版兼容字段
  finalTier: RiskTier;
  finalScore: number;            // 0-100（从三维概率映射）
}

// ---------- 评估引擎输入 ----------

/**
 * 评估引擎标准输入
 * 对应算法规格书全篇 — 三维引擎的统一输入
 */
export interface RiskEvalInput {
  // 资金状态
  currentBalance: number;        // 当前余额
  entryBank: number;             // 进场资金
  baseUnit: number;              // 基码金额
  currentBet: number;            // 当前注码
  stopLossAmount: number;        // 止损线金额

  // 盈亏状态
  pnl: number;                   // 当前盈亏金额
  peakProfit: number;            // 本场最高盈利额
  profitWentNegative: boolean;   // 是否已发生盈利转亏（关键时刻#4）

  // 行为信号
  consecutiveLosses: number;     // 当前连输手数（≥0）
  netLoss: number;               // 净输手数(输-赢，≥0)
  raiseAfterLoss: number;        // 连续输后加码次数
  consecutiveRaises: number;     // 连续加码次数（无论输赢）
  recentBets: number[];          // 最近5手的注码记录

  // 时间/疲劳
  elapsedMinutes: number;        // 已在桌时间（分钟）
  totalHands: number;            // 本场总手数
  remainingMinutes: number;      // 预估剩余时间（分钟）

  // 缠斗状态
  grindHands: number;            // 当前缠斗连续手数
  grindCurrent: boolean;         // 当前是否处于缠斗中

  // 连赢状态
  consecutiveWins: number;       // 当前连赢手数

  // 模板参数（从 GoldenTemplateParams 传入，引擎用于阈值判定）
  streakLimit: number;           // 连输防线
  netLossLimit: number;          // 净输防线
  grindThreshold: number;        // 缠斗熔断手数
  grindWarnThreshold: number;    // 缠斗前兆手数

  // 自检信号（v1.3 — 自检结果喂入三维引擎）
  selfCheckRiskLevel: 'safe' | 'caution' | 'warning' | 'danger';  // 最近一次自检风险等级
  selfCheckHandsAgo: number;     // 距上次自检过了多少手（用于衰减）

  // 旧版兼容
  streak: number;                // 当前连输/连赢(负=连输, 正=连赢)
  betChange: number;             // 注码变化率
  grindCount: number;            // 本场缠斗累计次数
  tableTime: number;             // 同 elapsedMinutes
}
