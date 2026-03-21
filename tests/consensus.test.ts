// ============================================================
// 合议引擎测试
// 验证六个场景下合议结论是否符合设计规则
// ============================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runConsensus } from '../src/consensus';
import { fallbackConservative, fallbackBalanced, fallbackAggressive } from '../src/fallback';
import {
  SCENARIO_NORMAL,
  SCENARIO_CONSERVATIVE_VETO,
  SCENARIO_BALANCED_VETO,
  SCENARIO_AGGRESSIVE_VETO,
  SCENARIO_UPWIND_BEHAVIOR,
  SCENARIO_PRE_ENTRY_DANGER,
  ALL_SCENARIOS,
} from './scenarios';

// ── 辅助：用 fallback 运行完整 pipeline ─────────────────────

function runPipeline(input: typeof SCENARIO_NORMAL) {
  const conservative = fallbackConservative(input);
  const balanced = fallbackBalanced(input);
  const aggressive = fallbackAggressive(input);
  const consensus = runConsensus(conservative, balanced, aggressive, input);
  return { conservative, balanced, aggressive, consensus };
}

// ── 场景1：正常局面 ─────────────────────────────────────────

test('合议 · 场景1 正常局面：directive=continue，无否决', () => {
  const { consensus, conservative, balanced, aggressive } = runPipeline(SCENARIO_NORMAL);

  assert.equal(conservative.veto, false);
  assert.equal(balanced.veto, false);
  assert.equal(aggressive.veto, false);

  assert.equal(consensus.directive_key, 'continue', `期望 continue，实际 ${consensus.directive_key}`);
  assert.ok(consensus.directive.includes('继续'), `指令文本应含"继续"，实际：${consensus.directive}`);
  assert.equal(consensus.key_metrics.survival_prob, conservative.survival_prob);
  assert.equal(consensus.key_metrics.collapse_prob, aggressive.collapse_prob_10h);
});

// ── 场景2：风险官否决 ────────────────────────────────────────

test('合议 · 场景2 风险官否决：directive=stop_loss，lead=conservative', () => {
  const { consensus, conservative } = runPipeline(SCENARIO_CONSERVATIVE_VETO);

  assert.equal(conservative.veto, true, '风险官应否决');
  assert.equal(consensus.directive_key, 'stop_loss', `期望 stop_loss，实际 ${consensus.directive_key}`);
  assert.equal(consensus.lead_agent, 'conservative');
  assert.ok(consensus.directive.includes('止损'), `指令文本应含"止损"，实际：${consensus.directive}`);
});

// ── 场景3：行为官否决 ────────────────────────────────────────

test('合议 · 场景3 行为官否决：directive=pause，lead=balanced', () => {
  const { consensus, balanced } = runPipeline(SCENARIO_BALANCED_VETO);

  assert.equal(balanced.veto, true, '行为官应否决');
  // deviation_index > 7 → pause
  assert.ok(
    consensus.directive_key === 'pause' || consensus.directive_key === 'reduce_bet',
    `期望 pause 或 reduce_bet，实际 ${consensus.directive_key}`,
  );
});

// ── 场景4：推演官否决 ────────────────────────────────────────

test('合议 · 场景4 推演官否决：directive=pause，veto触发', () => {
  const { consensus, aggressive } = runPipeline(SCENARIO_AGGRESSIVE_VETO);

  assert.equal(aggressive.veto, true, '推演官应否决');
  assert.ok(
    consensus.directive_key === 'pause' || consensus.directive_key === 'lock_profit',
    `期望 pause 或 lock_profit，实际 ${consensus.directive_key}`,
  );
});

// ── 场景5：顺风局行为偏差，行为官主导 ───────────────────────

test('合议 · 场景5 顺风局：net_pnl>0，行为官主导，降注或观望', () => {
  const { consensus, conservative, balanced, aggressive } = runPipeline(SCENARIO_UPWIND_BEHAVIOR);

  // 无否决
  assert.equal(conservative.veto, false);
  // net_pnl > 0 → 顺风局，行为官主导
  assert.ok(
    consensus.directive_key === 'reduce_bet' || consensus.directive_key === 'observe',
    `顺风局有行为偏差应降注或观望，实际 ${consensus.directive_key}`,
  );
  assert.equal(consensus.lead_agent, 'balanced', '顺风局应由行为官主导');
});

// ── 场景6：带病入场，推演官否决 ─────────────────────────────

test('合议 · 场景6 带病入场（danger+亏损）：推演官否决触发', () => {
  const { consensus, aggressive } = runPipeline(SCENARIO_PRE_ENTRY_DANGER);

  assert.equal(aggressive.veto, true, '带病入场+亏损，推演官应否决');
  assert.ok(
    consensus.directive_key !== 'continue',
    '带病入场不应输出 continue',
  );
});

// ── 合议规则：否决优先级测试 ─────────────────────────────────

test('合议规则 · 多否决并发：取最高级别指令', () => {
  // 手动构造多否决场景：风险官+行为官同时否决
  const conservative = {
    ...fallbackConservative(SCENARIO_CONSERVATIVE_VETO),
    veto: true,
    survival_prob: 0.18,  // < 0.20 → stop_loss
  };
  const balanced = {
    ...fallbackBalanced(SCENARIO_BALANCED_VETO),
    veto: true,
    deviation_index: 9,   // > 7 → pause
  };
  const aggressive = fallbackAggressive(SCENARIO_NORMAL);

  const consensus = runConsensus(conservative, balanced, aggressive, SCENARIO_CONSERVATIVE_VETO);

  // stop_loss 优先于 pause
  assert.equal(
    consensus.directive_key,
    'stop_loss',
    `多否决时应取最高级 stop_loss，实际 ${consensus.directive_key}`,
  );
  assert.equal(consensus.lead_agent, 'conservative');
});

test('合议规则 · 否决存在时必须有 lead_agent', () => {
  const { consensus } = runPipeline(SCENARIO_CONSERVATIVE_VETO);
  assert.ok(
    ['conservative', 'balanced', 'aggressive'].includes(consensus.lead_agent),
    `lead_agent 值无效：${consensus.lead_agent}`,
  );
});

// ── 输出格式完整性 ───────────────────────────────────────────

test('合议输出 · 所有场景的 key_metrics 字段完整', () => {
  for (const { name, input } of ALL_SCENARIOS) {
    const { consensus } = runPipeline(input);
    assert.ok(
      typeof consensus.key_metrics.survival_prob === 'number',
      `${name}: survival_prob 应为 number`,
    );
    assert.ok(
      typeof consensus.key_metrics.collapse_prob === 'number',
      `${name}: collapse_prob 应为 number`,
    );
    assert.ok(
      typeof consensus.key_metrics.behavior_deviation === 'number',
      `${name}: behavior_deviation 应为 number`,
    );
  }
});

test('合议输出 · 所有场景 directive 文本不为空', () => {
  for (const { name, input } of ALL_SCENARIOS) {
    const { consensus } = runPipeline(input);
    assert.ok(consensus.directive.length > 0, `${name}: directive 文本不能为空`);
    assert.ok(
      ['continue', 'reduce_bet', 'observe', 'pause', 'lock_profit', 'stop_loss'].includes(
        consensus.directive_key,
      ),
      `${name}: directive_key 值无效：${consensus.directive_key}`,
    );
  }
});

// ── 全场景端到端断言 ─────────────────────────────────────────

test('端到端 · 六场景预期指令对照', () => {
  const results = ALL_SCENARIOS.map(({ name, input, expected_directive }) => {
    const { consensus } = runPipeline(input);
    return { name, expected: expected_directive, actual: consensus.directive_key };
  });

  console.log('\n── 六场景指令输出 ──');
  for (const r of results) {
    const pass = r.actual === r.expected;
    console.log(`  ${pass ? '✅' : '❌'} ${r.name}`);
    console.log(`     期望: ${r.expected}  实际: ${r.actual}`);
  }

  const failures = results.filter(r => r.actual !== r.expected);
  assert.equal(failures.length, 0, `${failures.length} 个场景指令不符预期`);
});
