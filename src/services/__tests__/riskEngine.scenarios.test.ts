/**
 * 风控引擎 v1.2 — 13场景端到端验证
 * 模板A（标准防守），进场资金5000
 *
 * 验证 effectiveLimits 反断层设计、锁盈状态机、毒药组合、关键时刻、接近预警
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { evaluate, resetEngine } from '../riskEvaluationEngine';
import { getDefaultRiskConfig } from '../riskConfigService';
import type { RiskEvalInput, RiskConfig, EvaluationResult } from '../../types/riskConfig';

const ENTRY_BANK = 5000;
const BASE_UNIT = ENTRY_BANK * 0.08; // 400

let config: RiskConfig;

/** 构造一个干净的基础 RiskEvalInput */
function baseInput(overrides: Partial<RiskEvalInput> = {}): RiskEvalInput {
  return {
    currentBalance: ENTRY_BANK,
    entryBank: ENTRY_BANK,
    baseUnit: BASE_UNIT,
    currentBet: BASE_UNIT,
    stopLossAmount: ENTRY_BANK * 0.30, // 1500

    pnl: 0,
    peakProfit: 0,
    profitWentNegative: false,

    consecutiveLosses: 0,
    netLoss: 0,
    raiseAfterLoss: 0,
    consecutiveRaises: 0,
    recentBets: [BASE_UNIT, BASE_UNIT, BASE_UNIT, BASE_UNIT, BASE_UNIT],

    elapsedMinutes: 10,
    totalHands: 5,
    remainingMinutes: 50,

    grindHands: 0,
    grindCurrent: false,

    consecutiveWins: 0,

    streakLimit: 3,
    netLossLimit: 3,
    grindThreshold: 10,
    grindWarnThreshold: 8,

    selfCheckRiskLevel: 'safe',
    selfCheckHandsAgo: 999,

    streak: 0,
    betChange: 0,
    grindCount: 0,
    tableTime: 10,
    ...overrides,
  };
}

/**
 * 模拟多手序列 — 每次调用 evaluate 更新引擎状态
 * 返回最后一手的结果
 */
function simulateHands(hands: Partial<RiskEvalInput>[]): EvaluationResult {
  let result: EvaluationResult = null!;
  for (const h of hands) {
    result = evaluate(baseInput(h), config);
  }
  return result;
}

beforeEach(() => {
  resetEngine();
  config = getDefaultRiskConfig('A', ENTRY_BANK);
});

describe('模板A 风控引擎 13场景验证', () => {
  // ═══════════════════════════════════════════════════════════
  // 场景1: 连输3手(400/手) → L3 关键时刻#1
  // ═══════════════════════════════════════════════════════════
  it('场景1: 连输3手 → L3 streak_net_loss', () => {
    // 先打3手正常的，让引擎初始化（前3手不干预）
    const warmup = [
      { totalHands: 1 },
      { totalHands: 2 },
      { totalHands: 3 },
    ];
    warmup.forEach(h => evaluate(baseInput(h), config));

    // 第4-6手连输
    evaluate(baseInput({
      totalHands: 4, consecutiveLosses: 1, netLoss: 1,
      pnl: -400, currentBalance: 4600,
    }), config);

    evaluate(baseInput({
      totalHands: 5, consecutiveLosses: 2, netLoss: 2,
      pnl: -800, currentBalance: 4200,
    }), config);

    const result = evaluate(baseInput({
      totalHands: 6, consecutiveLosses: 3, netLoss: 3,
      pnl: -1200, currentBalance: 3800,
    }), config);

    expect(result.keyMoments).toContain('streak_limit');
    expect(['L3', 'L4']).toContain(result.interventionLevel);
  });

  // ═══════════════════════════════════════════════════════════
  // 场景3: 连输2手+第3手加注600 → L3 streak2_raise
  // ═══════════════════════════════════════════════════════════
  it('场景3: 连输2手+加注 → L3 streak2_raise', () => {
    // warmup
    [1, 2, 3].forEach(n => evaluate(baseInput({ totalHands: n }), config));

    // 连输2手
    evaluate(baseInput({
      totalHands: 4, consecutiveLosses: 1, netLoss: 1,
      pnl: -400, currentBalance: 4600,
    }), config);

    evaluate(baseInput({
      totalHands: 5, consecutiveLosses: 2, netLoss: 2,
      pnl: -800, currentBalance: 4200,
    }), config);

    // 第6手: 连输2+加注
    const result = evaluate(baseInput({
      totalHands: 6, consecutiveLosses: 2, netLoss: 2,
      pnl: -800, currentBalance: 4200,
      currentBet: 600,
      raiseAfterLoss: 1,
      recentBets: [400, 400, 400, 400, 600],
    }), config);

    expect(result.keyMoments).toContain('streak2_raise');
    expect(['L3', 'L4']).toContain(result.interventionLevel);
  });

  // ═══════════════════════════════════════════════════════════
  // 场景4: 45分钟 → L2 时间提醒①
  // ═══════════════════════════════════════════════════════════
  it('场景4: 45分钟 → 至少L2 时间预警', () => {
    [1, 2, 3].forEach(n => evaluate(baseInput({ totalHands: n }), config));

    const result = evaluate(baseInput({
      totalHands: 4,
      elapsedMinutes: 45,
      remainingMinutes: 15,
      tableTime: 45,
    }), config);

    // 45分钟应该触发时间信号，至少 L1-L2
    // x₆ 时间疲劳信号应该非零
    expect(result.signals.x6_time).toBeGreaterThan(0);
  });

  // ═══════════════════════════════════════════════════════════
  // 场景6: 60分钟 → L3 时间提醒③（超时关键时刻）
  // ═══════════════════════════════════════════════════════════
  it('场景6: 60分钟 → 超时关键时刻 overtime', () => {
    [1, 2, 3].forEach(n => evaluate(baseInput({ totalHands: n }), config));

    const result = evaluate(baseInput({
      totalHands: 10,
      elapsedMinutes: 60,
      remainingMinutes: 0,
      tableTime: 60,
    }), config);

    expect(result.keyMoments).toContain('overtime');
    expect(['L3', 'L4']).toContain(result.interventionLevel);
  });

  // ═══════════════════════════════════════════════════════════
  // 场景7: 盈利20%(+1000) → 锁盈激活 profitLockStage=1
  // ═══════════════════════════════════════════════════════════
  it('场景7: 盈利20% → 锁盈激活 stage=1', () => {
    [1, 2, 3].forEach(n => evaluate(baseInput({ totalHands: n }), config));

    const result = evaluate(baseInput({
      totalHands: 5,
      pnl: 1000,
      peakProfit: 1000,
      currentBalance: 6000,
    }), config);

    expect(result.profitLockStage).toBeGreaterThanOrEqual(1);
  });

  // ═══════════════════════════════════════════════════════════
  // 场景8: 盈利30%(+1500) → 锁盈stage=2，effectiveLimits收紧
  // ═══════════════════════════════════════════════════════════
  it('场景8: 盈利30% → 锁盈stage=2，effectiveLimits streakLimit=2', () => {
    [1, 2, 3].forEach(n => evaluate(baseInput({ totalHands: n }), config));

    const result = evaluate(baseInput({
      totalHands: 5,
      pnl: 1500,
      peakProfit: 1500,
      currentBalance: 6500,
    }), config);

    expect(result.profitLockStage).toBeGreaterThanOrEqual(2);
    // 收紧后的阈值应该是 lockStreakLimit=2
    expect(result.effectiveLimits.streakLimit).toBe(2);
    expect(result.effectiveLimits.netLossLimit).toBe(2);
  });

  // ═══════════════════════════════════════════════════════════
  // 场景9: 从峰值回撤50% → 锁盈stage=3, L3
  // ═══════════════════════════════════════════════════════════
  it('场景9: 峰值回撤50% → profitLockStage=3, L3', () => {
    [1, 2, 3].forEach(n => evaluate(baseInput({ totalHands: n }), config));

    // 先盈利30%触发stage 1+2
    evaluate(baseInput({
      totalHands: 4, pnl: 1500, peakProfit: 1500, currentBalance: 6500,
    }), config);

    // 回撤到750（从峰值1500回撤50%）
    const result = evaluate(baseInput({
      totalHands: 8, pnl: 750, peakProfit: 1500, currentBalance: 5750,
      consecutiveLosses: 1, netLoss: 1,
    }), config);

    expect(result.profitLockStage).toBeGreaterThanOrEqual(3);
    expect(['L3', 'L4']).toContain(result.interventionLevel);
  });

  // ═══════════════════════════════════════════════════════════
  // 场景10: 连赢3手后连输2手 → L3 顺风转折(momentum_reversal)
  // ═══════════════════════════════════════════════════════════
  it('场景10: 连赢3→连输2 → 毒药组合 momentum_reversal', () => {
    [1, 2, 3].forEach(n => evaluate(baseInput({ totalHands: n }), config));

    // 连赢3手（设置hadWinStreak）
    evaluate(baseInput({
      totalHands: 4, consecutiveWins: 1, pnl: 400, currentBalance: 5400,
    }), config);
    evaluate(baseInput({
      totalHands: 5, consecutiveWins: 2, pnl: 800, currentBalance: 5800,
    }), config);
    evaluate(baseInput({
      totalHands: 6, consecutiveWins: 3, pnl: 1200, currentBalance: 6200,
    }), config);

    // 开始输，连赢归零 → momentumReversed
    evaluate(baseInput({
      totalHands: 7, consecutiveWins: 0, consecutiveLosses: 1, netLoss: 0,
      pnl: 800, currentBalance: 5800,
    }), config);

    // 连输2手 → momentum_reversal触发
    const result = evaluate(baseInput({
      totalHands: 8, consecutiveWins: 0, consecutiveLosses: 2, netLoss: 1,
      pnl: 400, currentBalance: 5400,
    }), config);

    expect(result.toxicCombos).toContain('momentum_reversal');
    expect(['L3', 'L4']).toContain(result.interventionLevel);
  });

  // ═══════════════════════════════════════════════════════════
  // 场景11: 45分+曾缠斗8手+亏损 → L3 高压疲劳(fatigue_pressure)
  // ═══════════════════════════════════════════════════════════
  it('场景11: 45分+曾缠斗8手+亏损 → 毒药组合 fatigue_pressure', () => {
    [1, 2, 3].forEach(n => evaluate(baseInput({ totalHands: n }), config));

    // 先经历缠斗（设置maxGrindEver=8）
    evaluate(baseInput({
      totalHands: 4, grindHands: 8, grindCurrent: true,
    }), config);

    // 缠斗结束，但maxGrindEver已记录
    // 45分钟 + 亏损
    const result = evaluate(baseInput({
      totalHands: 10, grindHands: 0, grindCurrent: false,
      elapsedMinutes: 45, remainingMinutes: 15, tableTime: 45,
      pnl: -400, currentBalance: 4600,
      consecutiveLosses: 1, netLoss: 1,
    }), config);

    expect(result.toxicCombos).toContain('fatigue_pressure');
    expect(['L3', 'L4']).toContain(result.interventionLevel);
  });

  // ═══════════════════════════════════════════════════════════
  // 场景12: 缠斗8手 → L2 接近预警
  // ═══════════════════════════════════════════════════════════
  it('场景12: 缠斗8手 → approaching_grind 接近预警', () => {
    [1, 2, 3].forEach(n => evaluate(baseInput({ totalHands: n }), config));

    const result = evaluate(baseInput({
      totalHands: 12, grindHands: 8, grindCurrent: true,
      grindWarnThreshold: 8,
    }), config);

    // grindHands=8 >= warnHands=8, 且 < grindLimit=10
    // 应触发 approaching_grind
    expect(result.interventionSource).toMatch(/缠斗/);
    expect(['L2', 'L3', 'L4']).toContain(result.interventionLevel);
  });

  // ═══════════════════════════════════════════════════════════
  // 场景13: 缠斗10手 → L3 关键时刻#3 grind
  // ═══════════════════════════════════════════════════════════
  it('场景13: 缠斗10手 → 关键时刻 grind L3', () => {
    [1, 2, 3].forEach(n => evaluate(baseInput({ totalHands: n }), config));

    const result = evaluate(baseInput({
      totalHands: 15, grindHands: 10, grindCurrent: true,
    }), config);

    expect(result.keyMoments).toContain('grind');
    expect(['L3', 'L4']).toContain(result.interventionLevel);
  });

  // ═══════════════════════════════════════════════════════════
  // 反断层验证: 锁盈收紧后，连输2手应触发streak_net_loss（因为effectiveLimit=2）
  // ═══════════════════════════════════════════════════════════
  it('反断层: 锁盈收紧后连输2手=触及防线', () => {
    [1, 2, 3].forEach(n => evaluate(baseInput({ totalHands: n }), config));

    // 盈利30%触发stage2
    evaluate(baseInput({
      totalHands: 4, pnl: 1500, peakProfit: 1500, currentBalance: 6500,
    }), config);

    // 连输2手（在收紧后effectiveLimit=2时应触发关键时刻）
    evaluate(baseInput({
      totalHands: 5, consecutiveLosses: 1, netLoss: 1,
      pnl: 1100, currentBalance: 6100,
    }), config);

    const result = evaluate(baseInput({
      totalHands: 6, consecutiveLosses: 2, netLoss: 2,
      pnl: 700, currentBalance: 5700,
    }), config);

    expect(result.effectiveLimits.streakLimit).toBe(2);
    expect(result.keyMoments).toContain('streak_limit');
    expect(['L3', 'L4']).toContain(result.interventionLevel);
  });

  // ═══════════════════════════════════════════════════════════
  // 反断层验证: 顺风转折收紧后effectiveLimits也生效
  // ═══════════════════════════════════════════════════════════
  it('反断层: 顺风转折收紧effectiveLimits', () => {
    [1, 2, 3].forEach(n => evaluate(baseInput({ totalHands: n }), config));

    // 连赢2手（触发hadWinStreak，winStreakMark=2）
    evaluate(baseInput({
      totalHands: 4, consecutiveWins: 2, pnl: 800, currentBalance: 5800,
    }), config);

    // 转折：连赢归零+开始输
    evaluate(baseInput({
      totalHands: 5, consecutiveWins: 0, consecutiveLosses: 1,
      pnl: 400, currentBalance: 5400,
    }), config);

    // 验证effectiveLimits已收紧
    const result = evaluate(baseInput({
      totalHands: 6, consecutiveWins: 0, consecutiveLosses: 2, netLoss: 2,
      pnl: 0, currentBalance: 5000,
    }), config);

    // postWinStreakLimit=2, postWinNetLimit=2
    expect(result.effectiveLimits.streakLimit).toBe(2);
    expect(result.effectiveLimits.netLossLimit).toBe(2);
    // 连输2手应触发关键时刻
    expect(result.keyMoments).toContain('streak_limit');
  });
});

// ============================================================
// 参数化工厂函数 — 供 B/C 模板复用
// 用法：
//   createTemplateTestSuite('B', 10000, {
//     baseUnitPct: 0.05,
//     streakLimit: 3,
//     stopLossPct: 1.00,
//     expectedStreakL3: true,
//   });
// ============================================================

export interface TemplateTestExpectations {
  baseUnitPct: number;
  streakLimit: number;
  netLossLimit: number;
  stopLossPct: number;
  maxTime: number;
  /** 连输=streakLimit后是否期望L3 */
  expectedStreakL3?: boolean;
  /** 锁盈收紧后的连输阈值 */
  lockStreakLimit?: number;
}

/**
 * 为指定模板生成标准化测试套件
 *
 * @param templateId - 模板ID ('A' | 'B' | 'C')
 * @param entryBank - 进场资金
 * @param expectations - 期望值（基于模板参数）
 *
 * 使用示例（新建 riskEngine.templateB.test.ts）:
 * ```ts
 * import { createTemplateTestSuite } from './riskEngine.scenarios.test';
 * createTemplateTestSuite('B', 10000, {
 *   baseUnitPct: 0.05, streakLimit: 3, netLossLimit: 5,
 *   stopLossPct: 1.00, maxTime: 60,
 *   expectedStreakL3: true, lockStreakLimit: 2,
 * });
 * ```
 */
export function createTemplateTestSuite(
  templateId: string,
  entryBank: number,
  exp: TemplateTestExpectations,
): void {
  const baseUnit = entryBank * exp.baseUnitPct;

  describe(`模板${templateId} 风控引擎参数化验证 (进场${entryBank})`, () => {
    let tConfig: RiskConfig;

    beforeEach(() => {
      resetEngine();
      tConfig = getDefaultRiskConfig(templateId as 'A' | 'B' | 'C', entryBank);
    });

    function tBaseInput(overrides: Partial<RiskEvalInput> = {}): RiskEvalInput {
      return {
        currentBalance: entryBank,
        entryBank,
        baseUnit,
        currentBet: baseUnit,
        stopLossAmount: entryBank * exp.stopLossPct,
        pnl: 0, peakProfit: 0, profitWentNegative: false,
        consecutiveLosses: 0, netLoss: 0, raiseAfterLoss: 0, consecutiveRaises: 0,
        recentBets: Array(5).fill(baseUnit),
        elapsedMinutes: 10, totalHands: 5, remainingMinutes: exp.maxTime - 10,
        grindHands: 0, grindCurrent: false, consecutiveWins: 0,
        streakLimit: exp.streakLimit, netLossLimit: exp.netLossLimit,
        grindThreshold: 10, grindWarnThreshold: 8,
        selfCheckRiskLevel: 'safe', selfCheckHandsAgo: 999,
        streak: 0, betChange: 0, grindCount: 0, tableTime: 10,
        ...overrides,
      };
    }

    function warmup(): void {
      [1, 2, 3].forEach(i => evaluate(tBaseInput({ totalHands: i }), tConfig));
    }

    it('第1手就正常计算（无学习期）', () => {
      const r = evaluate(tBaseInput({ totalHands: 1 }), tConfig);
      // 第1手正常输入应该产生合理的概率值，不再硬编码L0
      expect(r.handNumber).toBe(1);
      expect(r.survivalProb).toBeGreaterThan(0);
      expect(r.etpProb).toBeGreaterThanOrEqual(0);
    });

    if (exp.expectedStreakL3 !== false) {
      it(`连输${exp.streakLimit}手 → L3`, () => {
        warmup();
        for (let i = 1; i <= exp.streakLimit; i++) {
          evaluate(tBaseInput({
            totalHands: 3 + i,
            consecutiveLosses: i,
            netLoss: i,
            pnl: -baseUnit * i,
            currentBalance: entryBank - baseUnit * i,
          }), tConfig);
        }
        const r = evaluate(tBaseInput({
          totalHands: 3 + exp.streakLimit + 1,
          consecutiveLosses: exp.streakLimit,
          netLoss: exp.streakLimit,
          pnl: -baseUnit * exp.streakLimit,
          currentBalance: entryBank - baseUnit * exp.streakLimit,
        }), tConfig);
        expect(['L3', 'L4']).toContain(r.interventionLevel);
      });
    }

    it(`超时${exp.maxTime}分钟 → L3`, () => {
      warmup();
      const r = evaluate(tBaseInput({
        totalHands: 20,
        elapsedMinutes: exp.maxTime + 1,
        remainingMinutes: 0,
        tableTime: exp.maxTime + 1,
      }), tConfig);
      expect(['L3', 'L4']).toContain(r.interventionLevel);
      expect(r.keyMoments).toContain('overtime');
    });
  });
}
