// ============================================================
// 模板配置服务 — riskConfigService.ts
// 职责：模板查询、应用、校验、自定义组装、风控配置生成
// 对应设计文档：OS风控系统-开发指导规格书 §5 / §7.3
// ============================================================

import type { SessionPlan } from '../types/fundManager';
import type {
  GoldenTemplate,
  GoldenTemplateId,
  GoldenTemplateParams,
  TemplateRiskProfile,
  RiskConfig,
  Layer1Weights,
  TierBoundaries,
  FatigueConfig,
  ToxicComboRule,
  InterventionLevel,
  InterventionLevelConfig,
  LogisticWeights,
  EMAConfig,
  HysteresisConfig,
  DecisionMatrixThresholds,
} from '../types/riskConfig';
import { GOLDEN_TEMPLATES, TEMPLATE_E_UNLOCK_SESSIONS } from '../constants/goldenTemplates';

// ── 默认常量（规格书 §4.1 / §4.2 / §4.3 / §6.1）──

/** 第一层权重默认值 [HUMAN_TUNABLE] */
const DEFAULT_WEIGHTS: Layer1Weights = {
  netLossScore: 0.35,
  pnlDrawdown: 0.30,
  timeScore: 0.15,
  grindScore: 0.10,
  streakScore: 0.10,
};

/** 档位边界默认值 [HUMAN_TUNABLE] */
const DEFAULT_TIER_BOUNDARIES: TierBoundaries = {
  conservative: [0, 20],
  steady: [21, 50],
  aggressive: [51, 80],
  out_of_control: [81, 100],
};

/** 疲劳系数默认值 [HUMAN_TUNABLE] */
const DEFAULT_FATIGUE_CONFIG: FatigueConfig = {
  timeDecay: {
    breakpoints: [30, 45, 60, 90],
    values: [0, 0.1, 0.25, 0.5],
  },
  grindDecay: {
    breakpoints: [1, 2, 3, 5],
    values: [0.05, 0.15, 0.3, 0.5],
  },
};

/** 三大毒药组合默认规则 [HUMAN_TUNABLE] */
const DEFAULT_TOXIC_COMBOS: ToxicComboRule[] = [
  {
    name: '高压疲劳组合',
    id: 'fatigue_pressure',
    conditions: [
      { field: 'tableTime', operator: 'gte', value: 60, description: '在桌超过60分钟' },
      { field: 'netLoss', operator: 'gte', value: 5, description: '净输超过5手' },
      { field: 'grindCount', operator: 'gte', value: 2, description: '缠斗超过2次' },
    ],
    forcedTier: 'out_of_control',
    forcedLevel: 'L3',
  },
  {
    name: '上头追损组合',
    id: 'tilt_chasing',
    conditions: [
      { field: 'streak', operator: 'lte', value: -3, description: '连输3手以上' },
      { field: 'betChange', operator: 'gte', value: 1.5, description: '注码偏离基码1.5倍以上' },
      { field: 'pnl', operator: 'lt', value: 0, description: '当前亏损状态' },
    ],
    forcedTier: 'out_of_control',
    forcedLevel: 'L4',
  },
  {
    name: '顺风膨胀组合',
    id: 'winner_tilt',
    conditions: [
      { field: 'peakProfit', operator: 'gt', value: 0, description: '曾经有过盈利' },
      { field: 'betChange', operator: 'gte', value: 2.0, description: '注码偏离基码2倍以上' },
      { field: 'pnl', operator: 'trending_down', value: true, description: '盈亏走势下行' },
    ],
    forcedTier: 'aggressive',
    forcedLevel: 'L3',
  },
];

// ── 三维引擎默认配置（算法规格书 v1.1）──

/** Logistic 模型权重 [HUMAN_TUNABLE] — 规格书 §8.3 */
const DEFAULT_LOGISTIC_WEIGHTS: LogisticWeights = {
  beta0: -4.5,    // 基线截距（1.1% 黑天鹅概率）
  beta1: 2.0,     // 前景痛苦
  beta2: 2.5,     // 输后加码（最高权重）
  beta3: 2.0,     // 连输/净输
  beta4: 1.8,     // 盈利转亏
  beta5: 1.5,     // 缠斗疲劳
  beta6: 1.2,     // 时间疲劳
  beta7: 0.8,     // 注码波动（辅助信号）
  beta8: 1.5,     // 交互项 x₂×x₃ — AlphaGo工程师建议#2
};

/** EMA 动态方差追踪配置 — 规格书 §3.4（AlphaGo工程师建议#1） */
const DEFAULT_EMA_CONFIG: EMAConfig = {
  alpha: 0.333,   // 2/(5+1)
  window: 5,      // 等效窗口 5 手
};

/** 防抖降级配置 — 规格书 §6.6（AlphaGo工程师建议#4） */
const DEFAULT_HYSTERESIS_CONFIG: HysteresisConfig = {
  downgrade: {
    L4: { survivalProbMin: 0.60, etpProbMax: 0.40, sustainedHands: 3 },
    L3: { survivalProbMin: 0.75, etpProbMax: 0.30, sustainedHands: 3 },
    L2: { survivalProbMin: 0.80, etpProbMax: 0.20, sustainedHands: 2 },
    L1: { survivalProbMin: 0.85, etpProbMax: 0.15, sustainedHands: 2 },
  },
};

/** 决策矩阵阈值 — 规格书 §6.1 */
const DEFAULT_DECISION_MATRIX: DecisionMatrixThresholds = {
  survivalProb: { high: 0.70, low: 0.30 },
  etpProb: { low: 0.20, high: 0.50 },
  collapseProb: { low: 0.20, high: 0.40 },
};

/** 五级干预配置 [HUMAN_TUNABLE] */
const DEFAULT_INTERVENTION_CONFIG: Record<InterventionLevel, InterventionLevelConfig> = {
  L0: {
    level: 'L0',
    name: '正常',
    uiMode: 'none',
    blocking: false,
    requireAck: false,
    cooldown: 0,
  },
  L1: {
    level: 'L1',
    name: '轻提醒',
    uiMode: 'toast',
    blocking: false,
    requireAck: false,
    cooldown: 120,
  },
  L2: {
    level: 'L2',
    name: '正式警告',
    uiMode: 'modal',
    blocking: false,
    requireAck: true,
    cooldown: 180,
  },
  L3: {
    level: 'L3',
    name: '强警告',
    uiMode: 'fullscreen',
    blocking: true,
    requireAck: true,
    cooldown: 300,
  },
  L4: {
    level: 'L4',
    name: '强制干预',
    uiMode: 'forced',
    blocking: true,
    requireAck: true,
    cooldown: 600,
  },
};

// ============================================================
// 公开 API
// ============================================================

/**
 * 根据 ID 返回完整模板定义
 */
export function getTemplate(id: GoldenTemplateId): GoldenTemplate {
  return GOLDEN_TEMPLATES[id];
}

/**
 * 将模板参数 + 进场资金 → 计算出 SessionPlan 的部分字段
 * 额外补充 total_bankroll / currency / reminder_mode 默认值
 */
export function applyTemplate(
  templateId: GoldenTemplateId,
  entryBank: number,
): Partial<SessionPlan> {
  const template = GOLDEN_TEMPLATES[templateId];
  const planPartial = template.toPlanPartial(entryBank);

  return {
    ...planPartial,
    total_bankroll: planPartial.total_bankroll ?? entryBank,
    currency: planPartial.currency ?? 'CNY',
    reminder_mode: planPartial.reminder_mode ?? ['popup'],
  };
}

/**
 * 校验 D 模板用户自填参数
 * 返回所有不合法字段的中文错误提示
 */
export function validateCustomParams(
  params: Partial<GoldenTemplateParams>,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (params.baseUnitPct !== undefined) {
    if (params.baseUnitPct < 0.01 || params.baseUnitPct > 0.10) {
      errors.push('基码比例必须在 1%~10% 之间');
    }
  }

  if (params.streakLimit !== undefined) {
    if (!Number.isInteger(params.streakLimit) || params.streakLimit < 1 || params.streakLimit > 10) {
      errors.push('连输防线必须在 1~10 手之间（整数）');
    }
  }

  if (params.netLossLimit !== undefined) {
    if (!Number.isInteger(params.netLossLimit) || params.netLossLimit < 1 || params.netLossLimit > 20) {
      errors.push('净输防线必须在 1~20 手之间（整数）');
    }
  }

  if (params.stopLossPct !== undefined) {
    if (params.stopLossPct < 0.10 || params.stopLossPct > 1.00) {
      errors.push('止损比例必须在 10%~100% 之间');
    }
  }

  if (params.maxTime !== undefined) {
    if (params.maxTime < 15 || params.maxTime > 180) {
      errors.push('时间防线必须在 15~180 分钟之间');
    }
  }

  if (params.grindTrigger !== undefined) {
    if (params.grindTrigger.hands !== undefined) {
      if (!Number.isInteger(params.grindTrigger.hands) || params.grindTrigger.hands < 3 || params.grindTrigger.hands > 20) {
        errors.push('缠斗手数必须在 3~20 手之间（整数）');
      }
    }
    if (params.grindTrigger.netRange !== undefined) {
      if (params.grindTrigger.netRange < 1 || params.grindTrigger.netRange > 5) {
        errors.push('缠斗净输赢范围必须在 1~5 倍基码之间');
      }
    }
  }

  if (params.profitLock !== undefined) {
    if (params.profitLock.activatePct !== undefined) {
      if (params.profitLock.activatePct < 0.05 || params.profitLock.activatePct > 1.00) {
        errors.push('锁盈激活阈值必须在 5%~100% 之间');
      }
    }
    if (params.profitLock.drawdownPct !== undefined) {
      if (params.profitLock.drawdownPct < 0.05 || params.profitLock.drawdownPct > 1.00) {
        errors.push('锁盈回撤容忍度必须在 5%~100% 之间');
      }
    }
    // v1.2: 锁盈收紧值必须 < 原始值
    if (params.profitLock.lockStreakLimit !== undefined && params.streakLimit !== undefined) {
      if (params.profitLock.lockStreakLimit >= params.streakLimit) {
        errors.push('锁盈后连输容忍必须小于原始连输防线');
      }
    }
    if (params.profitLock.lockNetLimit !== undefined && params.netLossLimit !== undefined) {
      if (params.profitLock.lockNetLimit >= params.netLossLimit) {
        errors.push('锁盈后净输容忍必须小于原始净输防线');
      }
    }
    // v1.2: 激活 < 收紧（阶段递进）
    if (params.profitLock.activatePct !== undefined && params.profitLock.tightenPct !== undefined) {
      if (params.profitLock.activatePct >= params.profitLock.tightenPct) {
        errors.push('锁盈激活阈值必须小于收紧阈值');
      }
    }
  }

  // v1.2: 时间预警链 timeWarn1 < timeWarn2 < timeWarn3 <= maxTime
  if (params.timeWarn1 !== undefined && params.timeWarn2 !== undefined && params.timeWarn3 !== undefined) {
    if (!(params.timeWarn1 < params.timeWarn2 && params.timeWarn2 < params.timeWarn3)) {
      errors.push('时间预警必须递增：timeWarn1 < timeWarn2 < timeWarn3');
    }
    if (params.maxTime !== undefined && params.timeWarn3 > params.maxTime) {
      errors.push('timeWarn3 不能超过 maxTime');
    }
  }

  // v1.2: 缠斗预警 < 缠斗极限
  if (params.grindTrigger?.warnHands !== undefined && params.grindTrigger?.hands !== undefined) {
    if (params.grindTrigger.warnHands >= params.grindTrigger.hands) {
      errors.push('缠斗预警手数必须小于缠斗极限手数');
    }
  }

  // v1.2: 毒药组合参数关联校验
  if (params.poisonCombo !== undefined) {
    if (params.poisonCombo.postWinStreakLimit !== undefined && params.streakLimit !== undefined) {
      if (params.poisonCombo.postWinStreakLimit >= params.streakLimit) {
        errors.push('顺风转折后连输收紧必须小于原始连输防线');
      }
    }
    if (params.poisonCombo.postWinGrindLimit !== undefined && params.grindTrigger?.hands !== undefined) {
      if (params.poisonCombo.postWinGrindLimit >= params.grindTrigger.hands) {
        errors.push('顺风转折后缠斗收紧必须小于原始缠斗极限');
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * D 模板：用户选一个 ABC 为底，覆盖部分参数
 * 未覆盖的参数保留 base 模板的值
 */
export function buildCustomTemplate(
  baseTemplateId: 'A' | 'B' | 'C',
  overrides: Partial<GoldenTemplateParams>,
): GoldenTemplate {
  const base = GOLDEN_TEMPLATES[baseTemplateId];
  const mergedParams: GoldenTemplateParams = {
    baseUnitPct: overrides.baseUnitPct ?? base.params.baseUnitPct,
    streakLimit: overrides.streakLimit ?? base.params.streakLimit,
    netLossLimit: overrides.netLossLimit ?? base.params.netLossLimit,
    stopLossPct: overrides.stopLossPct ?? base.params.stopLossPct,
    takeProfitPct: overrides.takeProfitPct ?? base.params.takeProfitPct,
    maxTime: overrides.maxTime ?? base.params.maxTime,
    timeWarn1: overrides.timeWarn1 ?? base.params.timeWarn1,
    timeWarn2: overrides.timeWarn2 ?? base.params.timeWarn2,
    timeWarn3: overrides.timeWarn3 ?? base.params.timeWarn3,
    grindTrigger: {
      hands: overrides.grindTrigger?.hands ?? base.params.grindTrigger.hands,
      netRange: overrides.grindTrigger?.netRange ?? base.params.grindTrigger.netRange,
      warnHands: overrides.grindTrigger?.warnHands ?? base.params.grindTrigger.warnHands,
    },
    profitLock: {
      activatePct: overrides.profitLock?.activatePct ?? base.params.profitLock.activatePct,
      tightenPct: overrides.profitLock?.tightenPct ?? base.params.profitLock.tightenPct,
      drawdownPct: overrides.profitLock?.drawdownPct ?? base.params.profitLock.drawdownPct,
      lockStreakLimit: overrides.profitLock?.lockStreakLimit ?? base.params.profitLock.lockStreakLimit,
      lockNetLimit: overrides.profitLock?.lockNetLimit ?? base.params.profitLock.lockNetLimit,
    },
    forbidRaise: overrides.forbidRaise ?? base.params.forbidRaise,
    raiseFullAt: overrides.raiseFullAt ?? base.params.raiseFullAt,
    streak2PlusRaise: overrides.streak2PlusRaise ?? base.params.streak2PlusRaise,
    poisonCombo: {
      fatigueTime: overrides.poisonCombo?.fatigueTime ?? base.params.poisonCombo.fatigueTime,
      fatigueGrind: overrides.poisonCombo?.fatigueGrind ?? base.params.poisonCombo.fatigueGrind,
      winStreakMark: overrides.poisonCombo?.winStreakMark ?? base.params.poisonCombo.winStreakMark,
      postWinStreakLimit: overrides.poisonCombo?.postWinStreakLimit ?? base.params.poisonCombo.postWinStreakLimit,
      postWinGrindLimit: overrides.poisonCombo?.postWinGrindLimit ?? base.params.poisonCombo.postWinGrindLimit,
      postWinNetLimit: overrides.poisonCombo?.postWinNetLimit ?? base.params.poisonCombo.postWinNetLimit,
    },
  };

  // 动态导入 buildPlanPartial 逻辑：直接复用模板 D 的 toPlanPartial 结构
  const customTemplate: GoldenTemplate = {
    id: 'D',
    name: `自主设置（基于${base.name}）`,
    subtitle: '个性化·自定义型',
    description: `基于「${base.name}」模板自定义参数。${base.description}`,
    category: 'custom',
    locked: false,
    params: mergedParams,
    riskProfile: base.riskProfile,  // 继承底座模板的风控参数集
    toPlanPartial: (entryBank: number) => {
      // 复用 GOLDEN_TEMPLATES.D 的映射逻辑（实际调用 goldenTemplates.ts 中的 buildPlanPartial）
      // 由于 buildPlanPartial 是模块内私有函数，这里使用模板 D 的 toPlanPartial 作为代理
      // 先临时替换 D 的 params，调用后恢复 — 但这不安全
      // 更好的方式：直接内联计算
      const baseUnit = Math.round(entryBank * mergedParams.baseUnitPct);
      const stopLoss = Math.round(entryBank * mergedParams.stopLossPct);
      const takeProfitTrigger = Math.round(entryBank * mergedParams.profitLock.activatePct);
      const lockProfitFloor = Math.round(takeProfitTrigger * (1 - mergedParams.profitLock.drawdownPct));

      return {
        session_budget: entryBank,
        base_unit: baseUnit,
        max_bet_unit: baseUnit * 2,
        stop_loss_amount: stopLoss,
        stop_loss_pct: Math.round(mergedParams.stopLossPct * 100),
        stop_loss_streak: mergedParams.streakLimit,
        stop_loss_streak_warn: Math.max(1, mergedParams.streakLimit - 1),
        stop_loss_net_hands: mergedParams.netLossLimit,
        max_duration_minutes: mergedParams.maxTime,
        lock_profit_trigger: takeProfitTrigger,
        lock_profit_floor: lockProfitFloor,
        take_profit_amount: takeProfitTrigger,
        take_profit_pct: Math.round(mergedParams.profitLock.activatePct * 100),
        take_profit_action: 'strong_suggest' as const,
        allow_raise_bet: false,
        forbid_raise_in_loss: true,
        allow_raise_in_profit: false,
        idle_reminder: true,
        input_method: 'template' as const,
      };
    },
  };

  return customTemplate;
}

/**
 * 判断 E 模板是否解锁（需 >= 3 场有效实战）
 */
export function isTemplateEAvailable(completedSessions: number): boolean {
  return completedSessions >= TEMPLATE_E_UNLOCK_SESSIONS;
}

/**
 * 组装完整的 RiskConfig
 * 核心改动：从模板的 riskProfile 读取风控参数，不再使用全局硬编码默认值
 * 每个模板有自己的权重、阈值、阶梯
 */
export function getDefaultRiskConfig(
  templateId: GoldenTemplateId,
  entryBank: number,
): RiskConfig {
  const template = GOLDEN_TEMPLATES[templateId];
  const rp = template.riskProfile; // 模板独立风控参数集

  return {
    template,
    riskProfile: rp,
    weights: { ...DEFAULT_WEIGHTS },
    tierBoundaries: {
      conservative: [...DEFAULT_TIER_BOUNDARIES.conservative],
      steady: [...DEFAULT_TIER_BOUNDARIES.steady],
      aggressive: [...DEFAULT_TIER_BOUNDARIES.aggressive],
      out_of_control: [...DEFAULT_TIER_BOUNDARIES.out_of_control],
    },
    fatigueConfig: {
      timeDecay: {
        breakpoints: [...DEFAULT_FATIGUE_CONFIG.timeDecay.breakpoints],
        values: [...DEFAULT_FATIGUE_CONFIG.timeDecay.values],
      },
      grindDecay: {
        breakpoints: [...DEFAULT_FATIGUE_CONFIG.grindDecay.breakpoints],
        values: [...DEFAULT_FATIGUE_CONFIG.grindDecay.values],
      },
    },
    toxicCombos: DEFAULT_TOXIC_COMBOS.map((rule) => ({
      ...rule,
      conditions: rule.conditions.map((c) => ({ ...c })),
    })),
    interventionConfig: {
      L0: { ...DEFAULT_INTERVENTION_CONFIG.L0 },
      L1: { ...DEFAULT_INTERVENTION_CONFIG.L1 },
      L2: { ...DEFAULT_INTERVENTION_CONFIG.L2 },
      L3: { ...DEFAULT_INTERVENTION_CONFIG.L3 },
      L4: { ...DEFAULT_INTERVENTION_CONFIG.L4 },
    },

    // ── 从模板 riskProfile 读取（每个模板独立） ──
    logisticWeights: { ...rp.logisticWeights },
    emaConfig: { ...rp.emaConfig },
    hysteresisConfig: {
      downgrade: {
        L4: { ...rp.hysteresisConfig.downgrade.L4 },
        L3: { ...rp.hysteresisConfig.downgrade.L3 },
        L2: { ...rp.hysteresisConfig.downgrade.L2 },
        L1: { ...rp.hysteresisConfig.downgrade.L1 },
      },
    },
    decisionMatrix: { ...rp.decisionMatrix },
    constants: { ...rp.constants },
  };
}
