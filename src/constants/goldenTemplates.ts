// ============================================================
// 黄金比例模板 — A/B/C/D/E 五套模板定义
// 对应设计文档：OS风控系统-开发指导规格书 §5
// 对应架构图：模板架构设计.png
//
// A/B/C：固定预设，不可修改（新手/懒人/长期认同者）
// D：自主设置，基于 ABC 结构自填参数
// E：数据进化，3 场后系统生成（MVP 阶段灰显锁定）
//
// [HUMAN_TUNABLE] 标记的参数值为占位值，由人类专家校准
// ============================================================

import type { GoldenTemplate, GoldenTemplateParams, GoldenTemplateId, TemplateRiskProfile } from '../types/riskConfig';
import type { SessionPlan } from '../types/fundManager';

// ── 共享物理常数（三个模板通用） ──
const SHARED_CONSTANTS: TemplateRiskProfile['constants'] = {
  p: 0.4876,
  handsPerMinute: 1.2,
  betAmplifierExponent: 1.5,
  prospectTheory: { alpha: 0.88, beta: 0.88, lambda: 2.25 },
};

const SHARED_EMA: TemplateRiskProfile['emaConfig'] = { alpha: 0.333, window: 5 };

// ════════════════════════════════════════════════════════════════
// 模板 A 风控参数集：标准防守
// 核心哲学：控制损失幅度
// 最大威胁：连输穿透止损线 → survivalProb 最敏感
// ════════════════════════════════════════════════════════════════
const RISK_PROFILE_A: TemplateRiskProfile = {
  logisticWeights: {
    beta0: -4.5,    // 基线 1.1%
    beta1: 2.0,     // 前景痛苦
    beta2: 2.5,     // 输后加码（最高）
    beta3: 2.0,     // 连输/净输
    beta4: 1.8,     // 盈利转亏
    beta5: 1.5,     // 缠斗疲劳
    beta6: 1.2,     // 时间疲劳
    beta7: 0.8,     // 注码波动
    beta8: 1.5,     // 交互项
  },
  decisionMatrix: {
    survivalProb: { high: 0.70, low: 0.30 },
    etpProb: { low: 0.20, high: 0.50 },
    collapseProb: { low: 0.20, high: 0.40 },
  },
  hysteresisConfig: {
    downgrade: {
      L4: { survivalProbMin: 0.60, etpProbMax: 0.40, sustainedHands: 3 },
      L3: { survivalProbMin: 0.75, etpProbMax: 0.30, sustainedHands: 3 },
      L2: { survivalProbMin: 0.80, etpProbMax: 0.20, sustainedHands: 2 },
      L1: { survivalProbMin: 0.85, etpProbMax: 0.15, sustainedHands: 2 },
    },
  },
  // maxTime=60 → 三段预警对齐：30=50%, 45=timeWarn1, 55=timeWarn2, 60=timeWarn3
  timeFatigueLadder: {
    minutes: [30, 45, 55, 60],
    values:  [0.2, 0.5, 0.8, 1.0],
  },
  grindFatigueLadder: {
    ratios: [0.50, 0.75, 1.00],
    values: [0.3, 0.6, 1.0],
  },
  raiseAfterLossFullAt: 2,
  consecutiveRaisesConfirmAt: 3,
  volatilityWindow: 5,
  volatilityFullStdDev: 1.0,
  constants: SHARED_CONSTANTS,
  emaConfig: SHARED_EMA,
};

// ════════════════════════════════════════════════════════════════
// 模板 B 风控参数集：进场即止损
// 核心哲学：控制心理预期（带多少输多少）
// 最大威胁：情绪崩盘（没有资金底线保护）→ etpProb 最敏感
// survivalProb 几乎无意义（止损=全部资金）→ 降权
// ════════════════════════════════════════════════════════════════
const RISK_PROFILE_B: TemplateRiskProfile = {
  logisticWeights: {
    beta0: -4.0,    // 基线略高（1.8%）— 本模板风险更高
    beta1: 2.5,     // 前景痛苦加重 — 没有止损线保护，亏损感更强
    beta2: 3.0,     // 输后加码最高权重 — 这类玩家一旦上头极难刹车
    beta3: 1.5,     // 连输/净输降权 — 防线宽(净输10手)，信号本身不太敏感
    beta4: 2.5,     // 盈利转亏加重 — "带多少输多少"心态下，回吐打击巨大
    beta5: 2.0,     // 缠斗疲劳加重 — 缠斗条件最敏感(±1基码)
    beta6: 1.2,     // 时间疲劳保持
    beta7: 1.0,     // 注码波动略升 — 这类玩家波动更大
    beta8: 1.5,     // 交互项保持
  },
  decisionMatrix: {
    survivalProb: { high: 0.60, low: 0.20 },  // 降敏：止损100%时生存概率天然偏高
    etpProb: { low: 0.15, high: 0.40 },        // 收紧：更早触发情绪警告
    collapseProb: { low: 0.20, high: 0.40 },
  },
  hysteresisConfig: {
    downgrade: {
      L4: { survivalProbMin: 0.50, etpProbMax: 0.35, sustainedHands: 4 },  // 更难降级
      L3: { survivalProbMin: 0.65, etpProbMax: 0.25, sustainedHands: 3 },
      L2: { survivalProbMin: 0.75, etpProbMax: 0.18, sustainedHands: 2 },
      L1: { survivalProbMin: 0.80, etpProbMax: 0.12, sustainedHands: 2 },
    },
  },
  // maxTime=60 → 三段预警对齐
  timeFatigueLadder: {
    minutes: [30, 45, 55, 60],
    values:  [0.2, 0.5, 0.8, 1.0],
  },
  grindFatigueLadder: {
    ratios: [0.50, 0.75, 1.00],
    values: [0.3, 0.6, 1.0],
  },
  raiseAfterLossFullAt: 2,
  consecutiveRaisesConfirmAt: 3,
  volatilityWindow: 5,
  volatilityFullStdDev: 1.0,
  constants: SHARED_CONSTANTS,
  emaConfig: SHARED_EMA,
};

// ════════════════════════════════════════════════════════════════
// 模板 C 风控参数集：快打速决
// 核心哲学：控制时间暴露
// 最大威胁：时间拖长后判断力下降 → 时间疲劳 + collapseProb 最敏感
// maxTime=40 → 时间阶梯全部压缩
// ════════════════════════════════════════════════════════════════
const RISK_PROFILE_C: TemplateRiskProfile = {
  logisticWeights: {
    beta0: -4.5,    // 基线保持
    beta1: 2.0,     // 前景痛苦保持
    beta2: 2.5,     // 输后加码保持
    beta3: 2.5,     // 连输/净输加重 — 防线极窄(净输5手)，靠近就很危险
    beta4: 2.0,     // 盈利转亏略升
    beta5: 1.0,     // 缠斗降权 — 快打模式不应该有缠斗，有就说明策略失败
    beta6: 2.0,     // 时间疲劳加重 — 核心威胁
    beta7: 0.8,     // 注码波动保持
    beta8: 2.0,     // 交互项加重 — 短线玩家同时连输+加码=极危险
  },
  decisionMatrix: {
    survivalProb: { high: 0.70, low: 0.30 },
    etpProb: { low: 0.20, high: 0.45 },        // 略收紧
    collapseProb: { low: 0.15, high: 0.35 },    // 收紧：短线更怕路径崩盘
  },
  hysteresisConfig: {
    downgrade: {
      L4: { survivalProbMin: 0.60, etpProbMax: 0.40, sustainedHands: 3 },
      L3: { survivalProbMin: 0.75, etpProbMax: 0.30, sustainedHands: 2 },  // 更容易降级（快打节奏快）
      L2: { survivalProbMin: 0.80, etpProbMax: 0.20, sustainedHands: 2 },
      L1: { survivalProbMin: 0.85, etpProbMax: 0.15, sustainedHands: 1 },
    },
  },
  // maxTime=40 → 三段预警对齐：15=37%, 30=timeWarn1, 36=timeWarn2, 40=timeWarn3
  timeFatigueLadder: {
    minutes: [15, 30, 36, 40],
    values:  [0.2, 0.5, 0.8, 1.0],
  },
  grindFatigueLadder: {
    ratios: [0.50, 0.75, 1.00],
    values: [0.3, 0.6, 1.0],
  },
  raiseAfterLossFullAt: 2,
  consecutiveRaisesConfirmAt: 3,
  volatilityWindow: 5,
  volatilityFullStdDev: 1.0,
  constants: SHARED_CONSTANTS,
  emaConfig: SHARED_EMA,
};

// ── 模板参数 → SessionPlan 部分字段的映射工具 ──

function buildPlanPartial(params: GoldenTemplateParams, entryBank: number): Partial<SessionPlan> {
  // C模板：entryBank = 总赌本，进场资金 = 总赌本 × sessionBudgetRatio
  const totalBankroll = entryBank;
  const sessionBudget = params.sessionBudgetRatio
    ? Math.round(entryBank * params.sessionBudgetRatio)
    : entryBank;

  // 基码：C模板按总赌本算，其他按进场资金算
  const baseUnit = Math.round(totalBankroll * params.baseUnitPct);

  // 止损：按进场资金比例
  const stopLoss = params.stopLossPct >= 1.0
    ? sessionBudget                              // 100% = 全额（C模板）
    : Math.round(sessionBudget * params.stopLossPct);

  // 锁盈触发（按进场资金）
  const lockTrigger = Math.round(sessionBudget * params.profitLock.activatePct);
  // 锁盈保底 = 触发额 × (1 - 回撤容忍) → 确保 lockFloor ≈ session × lockFloorPct
  const lockFloor = Math.round(lockTrigger * (1 - params.profitLock.drawdownPct));

  // 盈利目标（按进场资金）
  const takeProfit = Math.round(sessionBudget * params.takeProfitPct);

  // 连输告警：优先取 streakWarn，否则 streakLimit-1
  const streakWarn = params.streakWarn ?? Math.max(1, params.streakLimit - 1);

  return {
    total_bankroll: totalBankroll,
    session_budget: sessionBudget,
    base_unit: baseUnit,
    max_bet_unit: baseUnit * 3,              // 最大码量 = 3 倍基码
    stop_loss_amount: stopLoss,
    stop_loss_pct: Math.round(params.stopLossPct * 100),
    stop_loss_streak: params.streakLimit,
    stop_loss_streak_warn: streakWarn,
    stop_loss_net_hands: params.netLossLimit,
    max_duration_minutes: params.maxTime,
    lock_profit_trigger: lockTrigger,
    lock_profit_floor: lockFloor,
    take_profit_amount: takeProfit,
    take_profit_pct: Math.round(params.takeProfitPct * 100),
    take_profit_action: 'strong_suggest',
    allow_raise_bet: false,
    forbid_raise_in_loss: true,
    allow_raise_in_profit: false,
    idle_reminder: true,
    input_method: 'template',
  };
}

// ============================================================
// 模板 A：标准防守（保守·防守型）
// 适用画像：带总资金上桌，需严格保护本金的玩家
// 设计思路：宽松缠斗容忍(10手)、30%硬止损、锁盈门槛低(20%)但回撤容忍高(50%)
// ============================================================

const TEMPLATE_A_PARAMS: GoldenTemplateParams = {
  // ════════════════════════════════════════════════════════════
  // 模板A "标准防守" — 核心设计哲学：保守·防守型
  //   带全部资金上桌 → 保护本金优先 → 宽松博弈空间 → 25%硬止损兜底
  //
  // 参数联动：5% × 5手 = 25% = stopLossPct（无额外缓冲，靠连输止损先触发）
  //   连输告警3手（情绪预警） / 连输止损5手（硬终止）两层独立
  //   时间75分钟：三段预警 56/68/75
  // ════════════════════════════════════════════════════════════

  baseUnitPct: 0.05,              // 5% → 进场¥10000 基码¥500
  streakLimit: 5,                 // 连输止损：5手（硬终止）
  streakWarn: 3,                  // 连输告警：3手（情绪预警，独立于金额止损）
  netLossLimit: 5,                // 净输防线：5手
  stopLossPct: 0.25,              // 金额止损：25%（硬指标）
  takeProfitPct: 0.30,            // 盈利目标：30%（建议离场）
  maxTime: 75,                    // 最长时间：75分钟
  timeWarn1: 56,                  // 75% 位预警
  timeWarn2: 68,                  // 90% 位预警
  timeWarn3: 75,                  // 100% 超时
  grindTrigger: { hands: 10, netRange: 2, warnHands: 8 },  // 缠斗：10手内±2基码
  profitLock: {
    activatePct: 0.20,            // 盈利20%激活锁盈
    tightenPct: 0.25,             // 盈利25%收紧
    drawdownPct: 0.50,            // lockFloor = lockTrigger × 50% = 进场×10%
    lockStreakLimit: 2,
    lockNetLimit: 2,
  },
  forbidRaise: true,
  raiseFullAt: 2,
  streak2PlusRaise: true,
  poisonCombo: {
    fatigueTime: 56,              // = timeWarn1
    fatigueGrind: 8,              // = grindTrigger.warnHands
    winStreakMark: 2,
    postWinStreakLimit: 2,
    postWinGrindLimit: 4,
    postWinNetLimit: 2,
  },
};

const TEMPLATE_A: GoldenTemplate = {
  id: 'A',
  name: '标准防守',
  subtitle: '保守·防守型',
  description: '带总资金上桌，需严格保护本金的玩家。宽松的缠斗容忍给予充分博弈空间，30%硬止损确保本金安全底线。',
  category: 'preset',
  locked: true,
  params: TEMPLATE_A_PARAMS,
  riskProfile: RISK_PROFILE_A,
  toPlanPartial: (entryBank) => buildPlanPartial(TEMPLATE_A_PARAMS, entryBank),
};

// ============================================================
// 模板 B：进场即止损（平衡·攻守型）
// 适用画像：拿定额筹码、不留后路、高风险承受能力的玩家
// 设计思路：止损100%、风控重心转向"防回吐"、锁盈门槛高(50%)但回撤容忍低(30%)
// ============================================================

const TEMPLATE_B_PARAMS: GoldenTemplateParams = {
  // ════════════════════════════════════════════════════════════
  // 模板B "攻守平衡" — 核心设计哲学：平衡·攻守型
  //   正常带资金上桌 → 8%基码 → 30%止损 → 45%目标
  //   连输4手硬终止 / 连输3手情绪预警（独立两层）
  //   时间60分钟
  // ════════════════════════════════════════════════════════════

  baseUnitPct: 0.08,              // 8% → 进场¥10000 基码¥800
  streakLimit: 4,                 // 连输止损：4手（硬终止）
  streakWarn: 3,                  // 连输告警：3手（情绪预警）
  netLossLimit: 4,                // 净输防线：4手
  stopLossPct: 0.30,              // 金额止损：30%（硬指标）
  takeProfitPct: 0.45,            // 盈利目标：45%
  maxTime: 60,
  timeWarn1: 45, timeWarn2: 55, timeWarn3: 60,
  grindTrigger: { hands: 10, netRange: 2, warnHands: 8 },  // 缠斗：10手内±2基码
  profitLock: {
    activatePct: 0.30,            // 盈利30%激活锁盈
    tightenPct: 0.40,             // 盈利40%收紧
    drawdownPct: 0.50,            // lockFloor = lockTrigger × 50% = 进场×15%
    lockStreakLimit: 2,
    lockNetLimit: 2,
  },
  forbidRaise: true,
  raiseFullAt: 2,
  streak2PlusRaise: true,
  poisonCombo: {
    fatigueTime: 45,
    fatigueGrind: 8,
    winStreakMark: 2,
    postWinStreakLimit: 2,
    postWinGrindLimit: 4,
    postWinNetLimit: 2,
  },
};

const TEMPLATE_B: GoldenTemplate = {
  id: 'B',
  name: '攻守平衡',
  subtitle: '平衡·攻守型',
  description: '带全部资金上桌，8%基码攻守兼备。连输3手情绪预警，连输4手硬止损，30%金额止损线独立兜底。目标45%盈利，赢到30%启动锁盈保护。',
  category: 'preset',
  locked: true,
  params: TEMPLATE_B_PARAMS,
  riskProfile: RISK_PROFILE_B,
  toPlanPartial: (entryBank) => buildPlanPartial(TEMPLATE_B_PARAMS, entryBank),
};

// ============================================================
// 模板 C：快打速决（激进·速攻型）
// 适用画像：追求短线利润、极度厌恶回吐的玩家
// 设计思路：所有参数指向"速战速决"，时间最短、止损最紧、锁盈门槛最低
// ============================================================

const TEMPLATE_C_PARAMS: GoldenTemplateParams = {
  // ════════════════════════════════════════════════════════════
  // 模板C "止损前置" — 核心设计哲学：激进·速攻型
  //   entryBank = 总赌本（UI提示改为"你的总资金"）
  //   进场资金 = 总赌本 × 30%（这就是止损上限，物理止损）
  //   基码 = 总赌本 × 10%（按总赌本算，激进感知）
  //   示例：总赌本¥10000 → 进场¥3000 → 基码¥1000 → 最多3手
  //   不设连输止损（进场资金=止损，钱没了自然停）
  //   只设连输告警2手：「你的子弹只剩1发了」
  //   专注目标：翻倍（100%）离场
  // ════════════════════════════════════════════════════════════

  baseUnitPct: 0.10,              // 10% of 总赌本 → ¥1000/手
  sessionBudgetRatio: 0.30,       // 进场资金 = 总赌本 × 30%
  streakLimit: 0,                 // 不设连输止损（物理止损兜底）
  streakWarn: 2,                  // 连输告警：2手（「子弹只剩1发」）
  netLossLimit: 0,                // 不设净输防线
  stopLossPct: 1.00,              // 进场资金全额止损（物理止损）
  takeProfitPct: 1.00,            // 盈利目标：100%（翻倍离场）
  maxTime: 30,                    // 快打速决：30分钟
  timeWarn1: 20,                  // 67% 位预警
  timeWarn2: 27,                  // 90% 位预警
  timeWarn3: 30,                  // 100% 超时
  grindTrigger: { hands: 8, netRange: 2, warnHands: 6 },  // 缠斗：6-8手适配
  profitLock: {
    activatePct: 0.60,            // 盈利60%激活锁盈
    tightenPct: 0.80,             // 盈利80%收紧
    drawdownPct: 0.50,            // lockFloor = lockTrigger × 50% = 进场×30%
    lockStreakLimit: 2,
    lockNetLimit: 2,
  },
  forbidRaise: true,
  raiseFullAt: 1,                 // 加注1次=满格（激进模板零容忍加码）
  streak2PlusRaise: true,
  poisonCombo: {
    fatigueTime: 20,              // = timeWarn1
    fatigueGrind: 6,              // = grindTrigger.warnHands
    winStreakMark: 2,
    postWinStreakLimit: 1,
    postWinGrindLimit: 3,
    postWinNetLimit: 1,
  },
};

const TEMPLATE_C: GoldenTemplate = {
  id: 'C',
  name: '止损前置',
  subtitle: '激进·速攻型',
  description: '只带你能承受亏损的那部分资金进场，钱没了就走，专注翻倍目标。基码按总资金10%设定，最多3手出局，专注盈利管理而非止损纪律。',
  category: 'preset',
  locked: true,
  params: TEMPLATE_C_PARAMS,
  riskProfile: RISK_PROFILE_C,
  toPlanPartial: (entryBank) => buildPlanPartial(TEMPLATE_C_PARAMS, entryBank),
};

// ============================================================
// 模板 D：专属战约（AI 问诊定策生成·个性化）
// 适用画像：通过 AI 问诊定策流程生成，含心理画像 + 个性化场景阈值
// 用户可自命名（如「龙王战约」），保存后在「我的战约」区块复用
// ============================================================

const TEMPLATE_D_PARAMS: GoldenTemplateParams = {
  // 默认值 = 模板A的v1.2校准参数（用户可全部覆盖）
  baseUnitPct: 0.08,
  streakLimit: 3,
  netLossLimit: 3,
  stopLossPct: 0.30,
  takeProfitPct: 0.45,            // 默认同A：30%×1.5=45%
  maxTime: 60,
  timeWarn1: 45, timeWarn2: 55, timeWarn3: 60,
  grindTrigger: { hands: 10, netRange: 2, warnHands: 8 },
  profitLock: {
    activatePct: 0.20, tightenPct: 0.30, drawdownPct: 0.50,
    lockStreakLimit: 2, lockNetLimit: 2,
  },
  forbidRaise: true,
  raiseFullAt: 2,
  streak2PlusRaise: true,
  poisonCombo: {
    fatigueTime: 45, fatigueGrind: 8,
    winStreakMark: 2, postWinStreakLimit: 2, postWinGrindLimit: 4, postWinNetLimit: 2,
  },
};

const TEMPLATE_D: GoldenTemplate = {
  id: 'D',
  name: '专属战约',
  subtitle: 'AI 问诊定策生成',
  description: '通过「AI 问诊定策」对话生成，融合你的心理画像与个性化场景阈值。可自命名保存，下次直接复用。',
  category: 'custom',
  locked: false,
  params: TEMPLATE_D_PARAMS,
  riskProfile: RISK_PROFILE_A,  // 自定义默认继承模板A的风控参数，后续可覆盖
  toPlanPartial: (entryBank) => buildPlanPartial(TEMPLATE_D_PARAMS, entryBank),
};

// ============================================================
// 模板 E：数据进化（系统生成·智能适配型）
// 适用画像：使用了多次模板 ABC 的用户，系统据行为数据生成个性化模板
// MVP 阶段：灰显锁定，标"完成 3 场后解锁"
// ============================================================

const TEMPLATE_E_PARAMS: GoldenTemplateParams = {
  // 占位参数（实际由系统根据用户数据动态生成，初始=模板A）
  baseUnitPct: 0.08,
  streakLimit: 3,
  netLossLimit: 3,
  stopLossPct: 0.30,
  takeProfitPct: 0.45,            // 默认同A，系统后续根据数据调整
  maxTime: 60,
  timeWarn1: 45, timeWarn2: 55, timeWarn3: 60,
  grindTrigger: { hands: 10, netRange: 2, warnHands: 8 },
  profitLock: {
    activatePct: 0.20, tightenPct: 0.30, drawdownPct: 0.50,
    lockStreakLimit: 2, lockNetLimit: 2,
  },
  forbidRaise: true,
  raiseFullAt: 2,
  streak2PlusRaise: true,
  poisonCombo: {
    fatigueTime: 45, fatigueGrind: 8,
    winStreakMark: 2, postWinStreakLimit: 2, postWinGrindLimit: 4, postWinNetLimit: 2,
  },
};

const TEMPLATE_E: GoldenTemplate = {
  id: 'E',
  name: '数据进化',
  subtitle: '系统生成·智能适配型',
  description: '基于你的历史实战数据，系统自动分析并生成最适合你的风控方案。完成 3 场有效实战后解锁。',
  category: 'data_driven',
  locked: false,
  params: TEMPLATE_E_PARAMS,
  riskProfile: RISK_PROFILE_A,  // 占位，实际由 growthEngine 动态生成
  toPlanPartial: (entryBank) => buildPlanPartial(TEMPLATE_E_PARAMS, entryBank),
};

// ============================================================
// 导出
// ============================================================

/** 全部 5 套模板 */
export const GOLDEN_TEMPLATES: Record<GoldenTemplateId, GoldenTemplate> = {
  A: TEMPLATE_A,
  B: TEMPLATE_B,
  C: TEMPLATE_C,
  D: TEMPLATE_D,
  E: TEMPLATE_E,
};

/** 预设模板列表（A/B/C，固定不可改） */
export const PRESET_TEMPLATES: GoldenTemplate[] = [TEMPLATE_A, TEMPLATE_B, TEMPLATE_C];

/** 个性化模板列表（D/E） */
export const PERSONAL_TEMPLATES: GoldenTemplate[] = [TEMPLATE_D, TEMPLATE_E];

/** 全部模板有序列表（用于 UI 渲染） */
export const ALL_TEMPLATES: GoldenTemplate[] = [
  TEMPLATE_A, TEMPLATE_B, TEMPLATE_C,
  TEMPLATE_D, TEMPLATE_E,
];

/** E 模板解锁所需最低场次数 */
export const TEMPLATE_E_UNLOCK_SESSIONS = 3;

/** 根据 ID 获取模板 */
export function getGoldenTemplate(id: GoldenTemplateId): GoldenTemplate {
  return GOLDEN_TEMPLATES[id];
}

/** 检查 E 模板是否已解锁 */
export function isTemplateEUnlocked(completedSessions: number): boolean {
  return completedSessions >= TEMPLATE_E_UNLOCK_SESSIONS;
}
