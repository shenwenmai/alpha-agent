// ============================================================
// 三维评估引擎验算 — 对照算法规格书验算表
// 规格书 §3.7 survivalProb / §4.4 etpProb / §5.5 collapseProb
// ============================================================

import {
  computeSurvivalProb,
  computeEtpProb,
  computeCollapseProb,
  evaluate,
  resetEngine,
} from '../riskEvaluationEngine';
import type { RiskConfig, RiskEvalInput } from '../../types/riskConfig';
import { getDefaultRiskConfig } from '../riskConfigService';

// ── 测试用默认配置 ──
const config = getDefaultRiskConfig('A', 5000);

// ── 构造输入的工具函数 ──
function makeInput(overrides: Partial<RiskEvalInput>): RiskEvalInput {
  return {
    currentBalance: 5000,
    entryBank: 5000,
    baseUnit: 400,
    currentBet: 400,
    stopLossAmount: 1500,
    pnl: 0,
    peakProfit: 0,
    profitWentNegative: false,
    consecutiveLosses: 0,
    netLoss: 0,
    raiseAfterLoss: 0,
    consecutiveRaises: 0,
    recentBets: [400, 400, 400],
    elapsedMinutes: 10,
    totalHands: 12,
    remainingMinutes: 50,
    grindHands: 0,
    grindCurrent: false,
    consecutiveWins: 0,
    streakLimit: 3,
    netLossLimit: 3,
    grindThreshold: 10,
    grindWarnThreshold: 8,
    // 旧版兼容
    streak: 0,
    selfCheckRiskLevel: 'safe',
    selfCheckHandsAgo: 999,

    betChange: 0,
    grindCount: 0,
    tableTime: 10,
    ...overrides,
  };
}

// ── 验算辅助 ──
function assertApprox(actual: number, expected: number, tolerance: number, label: string) {
  const diff = Math.abs(actual - expected);
  const pass = diff <= tolerance;
  const icon = pass ? '✅' : '❌';
  console.log(`  ${icon} ${label}: 实际=${actual.toFixed(4)}, 期望=${expected.toFixed(4)}, 差=${diff.toFixed(4)} ${pass ? '' : '← 超差'}`);
  return pass;
}

// ============================================================
// 测试 1: survivalProb 验算表（规格书 §3.7）
// 进场 5000, 止损线 1500, 基码 400, 1.2手/分钟
// ============================================================

function testSurvivalProb() {
  console.log('\n═══ survivalProb 验算（§3.7）═══');
  resetEngine();

  // 期望值：A&S 26.2.17 精确计算（v1.1 修正后）
  const cases = [
    { label: '安全', balance: 4500, bet: 400, elapsed: 10, expected: 0.781, tol: 0.02 },
    { label: '正常', balance: 4000, bet: 400, elapsed: 20, expected: 0.767, tol: 0.02 },
    { label: '警戒', balance: 3000, bet: 600, elapsed: 35, expected: 0.569, tol: 0.02 },
    { label: '危险', balance: 2200, bet: 800, elapsed: 45, expected: 0.514, tol: 0.02 },
    { label: '极危', balance: 1800, bet: 1000, elapsed: 50, expected: 0.500, tol: 0.02 },
  ];

  let pass = 0;
  for (const c of cases) {
    resetEngine(); // 每次重置 EMA 状态
    const input = makeInput({
      currentBalance: c.balance,
      currentBet: c.bet,
      elapsedMinutes: c.elapsed,
      remainingMinutes: 60 - c.elapsed,
      recentBets: [c.bet, c.bet, c.bet],
    });
    const result = computeSurvivalProb(input, config);
    if (assertApprox(result, c.expected, c.tol, c.label)) pass++;
  }
  console.log(`  结果: ${pass}/${cases.length} 通过`);
}

// ============================================================
// 测试 2: etpProb 验算表（规格书 §4.4）
// ============================================================

function testEtpProb() {
  console.log('\n═══ etpProb 验算（§4.4）═══');

  const cases = [
    {
      label: '安全：赢着,20分',
      overrides: { pnl: 500, peakProfit: 500, elapsedMinutes: 20 },
      expected: 0.011,
      tol: 0.01,
    },
    {
      label: '轻微：小亏,30分',
      overrides: {
        pnl: -200, peakProfit: 0, elapsedMinutes: 30,
        consecutiveLosses: 1, netLoss: 1,
        recentBets: [400, 420, 380],
      },
      expected: 0.036,
      tol: 0.03,
    },
    {
      label: '中度：连输3,加码1次,40分',
      overrides: {
        pnl: -800, peakProfit: 0, elapsedMinutes: 40,
        consecutiveLosses: 3, netLoss: 3, raiseAfterLoss: 1,
        recentBets: [400, 500, 600],
      },
      expected: 0.40,  // 从未盈利，x1基于lossRatio
      tol: 0.15,
    },
    {
      label: '重度：亏20%,连输4,缠斗,50分',
      overrides: {
        pnl: -1000, peakProfit: 0, elapsedMinutes: 50,
        consecutiveLosses: 4, netLoss: 5,
        grindHands: 6, grindCurrent: true,
        recentBets: [400, 400, 500, 400, 400],
      },
      expected: 0.475,
      tol: 0.15,
    },
    {
      label: '极危：盈利转亏+缠斗+加码2次',
      overrides: {
        pnl: -500, peakProfit: 1000, profitWentNegative: true,
        elapsedMinutes: 50, consecutiveLosses: 4, netLoss: 6,
        raiseAfterLoss: 2, grindHands: 10, grindCurrent: true,
        recentBets: [400, 600, 800, 1000, 600],
      },
      expected: 0.997,
      tol: 0.05,
    },
  ];

  let pass = 0;
  for (const c of cases) {
    const input = makeInput(c.overrides);
    const { etpProb, signals } = computeEtpProb(input, config);
    console.log(`  信号: x1=${signals.x1_pain} x2=${signals.x2_raise} x3=${signals.x3_streak} x4=${signals.x4_profitGone} x5=${signals.x5_grind} x6=${signals.x6_time} x7=${signals.x7_volatility} int=${signals.interaction}`);
    if (assertApprox(etpProb, c.expected, c.tol, c.label)) pass++;
  }
  console.log(`  结果: ${pass}/${cases.length} 通过`);
}

// ============================================================
// 测试 3: collapseProb 验算（规格书 §5.5）
// 场景：余额 2000，止损线 1500，注码 400，输后加码600，已连输 2 手
// ============================================================

function testCollapseProb() {
  console.log('\n═══ collapseProb 验算（§5.5）═══');

  const input = makeInput({
    currentBalance: 2000,
    currentBet: 400,
    stopLossAmount: 1500,
    consecutiveLosses: 2,
    raiseAfterLoss: 1,
    streakLimit: 4,
  });

  const result = computeCollapseProb(input, config);
  assertApprox(result, 0.391, 0.05, '余额2000/注码400/连输2/加码到600');
}

// ============================================================
// 测试 4: 完整 evaluate() + 防抖
// ============================================================

function testEvaluateAndHysteresis() {
  console.log('\n═══ evaluate() 完整流程 + 防抖 ═══');
  resetEngine();

  // 第1手：安全状态
  const input1 = makeInput({ currentBalance: 4500, pnl: 500, peakProfit: 500 });
  const r1 = evaluate(input1, config);
  console.log(`  手1: survival=${r1.survivalProb} etp=${r1.etpProb} collapse=${r1.collapseProb} → ${r1.interventionLevel} (${r1.interventionSource})`);

  // 第2手：危险状态 — 应该立刻升级
  const input2 = makeInput({
    currentBalance: 2200, currentBet: 800, pnl: -800,
    consecutiveLosses: 3, netLoss: 4, raiseAfterLoss: 2,
    elapsedMinutes: 45, remainingMinutes: 15, totalHands: 20,
    recentBets: [400, 600, 800],
  });
  const r2 = evaluate(input2, config);
  console.log(`  手2: survival=${r2.survivalProb} etp=${r2.etpProb} collapse=${r2.collapseProb} → ${r2.interventionLevel}`);
  console.log(`    ${r2.interventionLevel !== 'L0' ? '✅' : '❌'} 应该升级（非L0）`);

  // 第3手：回到安全 — 防抖应保持高级别
  const input3 = makeInput({ currentBalance: 4500, pnl: 500, peakProfit: 500, totalHands: 21 });
  const r3 = evaluate(input3, config);
  console.log(`  手3: survival=${r3.survivalProb} etp=${r3.etpProb} → ${r3.interventionLevel}`);
  console.log(`    ${LEVEL_ORDER[r3.interventionLevel] > 0 ? '✅' : '❌'} 防抖应保持非L0（实际: ${r3.interventionLevel}, 稳定手数: ${r3.hysteresis.stableHandsCount}）`);
}

const LEVEL_ORDER: Record<string, number> = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4 };

// ── 运行 ──
console.log('╔══════════════════════════════════════╗');
console.log('║  三维评估引擎验算 — 规格书 v1.1    ║');
console.log('╚══════════════════════════════════════╝');

testSurvivalProb();
testEtpProb();
testCollapseProb();
testEvaluateAndHysteresis();

console.log('\n── 验算完成 ──');
