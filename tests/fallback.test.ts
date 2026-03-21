// ============================================================
// 降级兜底模块测试
// 验证三个 fallback 函数在各场景下的输出是否正确
// ============================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fallbackConservative, fallbackBalanced, fallbackAggressive } from '../src/fallback';
import {
  SCENARIO_NORMAL,
  SCENARIO_CONSERVATIVE_VETO,
  SCENARIO_BALANCED_VETO,
  SCENARIO_AGGRESSIVE_VETO,
  SCENARIO_UPWIND_BEHAVIOR,
  SCENARIO_PRE_ENTRY_DANGER,
} from './scenarios';

// ── 风险官 (Conservative) ────────────────────────────────────

test('风险官 · 正常局面：safety_status=safe，veto=false', () => {
  const out = fallbackConservative(SCENARIO_NORMAL);
  assert.equal(out.safety_status, 'safe');
  assert.equal(out.veto, false);
  assert.ok(out.survival_prob > 0.7, `生存概率应>0.7，实际${out.survival_prob}`);
  assert.ok(out.survival_margin > 10, `安全边际应>10手，实际${out.survival_margin}`);
  assert.ok(out.fact_line.length > 0, 'fact_line 不能为空');
  assert.ok(out.assessment.length > 0, 'assessment 不能为空');
});

test('风险官 · 临近止损：触发否决，safety_status=critical', () => {
  const out = fallbackConservative(SCENARIO_CONSERVATIVE_VETO);
  assert.equal(out.veto, true, '应触发否决');
  assert.equal(out.safety_status, 'critical');
  assert.ok(out.veto_reason !== undefined, '否决时必须有 veto_reason');
  assert.ok(out.survival_margin < 2, `安全边际应<2手，实际${out.survival_margin}`);
});

test('风险官 · 行为否决场景：有空间但关注边际', () => {
  const out = fallbackConservative(SCENARIO_BALANCED_VETO);
  assert.equal(out.veto, false, '资金尚有空间，风险官不应否决');
  assert.ok(['safe', 'caution'].includes(out.safety_status));
  assert.ok(out.survival_margin > 5, `安全边际应>5手，实际${out.survival_margin}`);
});

test('风险官 · 顺风局：safe，不否决', () => {
  const out = fallbackConservative(SCENARIO_UPWIND_BEHAVIOR);
  assert.equal(out.safety_status, 'safe');
  assert.equal(out.veto, false);
});

// ── 行为官 (Balanced) ─────────────────────────────────────────

test('行为官 · 正常局面：behavior_status=normal，veto=false', () => {
  const out = fallbackBalanced(SCENARIO_NORMAL);
  assert.equal(out.behavior_status, 'normal');
  assert.equal(out.veto, false);
  assert.equal(out.behavior_pattern, null);
  assert.ok(out.deviation_index <= 3, `偏差指数应<=3，实际${out.deviation_index}`);
});

test('行为官 · 追损+350%偏差：触发否决，识别追损型', () => {
  const out = fallbackBalanced(SCENARIO_BALANCED_VETO);
  assert.equal(out.veto, true, '应触发行为否决');
  assert.equal(out.behavior_status, 'critical');
  assert.ok(out.veto_reason !== undefined);
  assert.ok(out.deviation_index >= 8, `偏差指数应>=8，实际${out.deviation_index}`);
  // 追损型或冲动型（连输后350%偏差）
  assert.ok(
    out.behavior_pattern === '追损型' || out.behavior_pattern === '冲动型',
    `行为模式应为追损型或冲动型，实际：${out.behavior_pattern}`,
  );
});

test('行为官 · 顺风扩张型：识别但不否决', () => {
  const out = fallbackBalanced(SCENARIO_UPWIND_BEHAVIOR);
  assert.equal(out.veto, false, '顺风扩张未超否决线');
  assert.ok(out.behavior_status !== 'normal', '行为有偏差应非normal');
  assert.ok(out.deviation_index > 0);
});

test('行为官 · 带病入场场景：行为正常（基码下注）', () => {
  const out = fallbackBalanced(SCENARIO_PRE_ENTRY_DANGER);
  assert.equal(out.behavior_status, 'normal');
  assert.equal(out.veto, false);
  assert.equal(out.behavior_pattern, null);
});

// ── 推演官 (Aggressive) ───────────────────────────────────────

test('推演官 · 正常局面：不否决，不存在退出窗口', () => {
  const out = fallbackAggressive(SCENARIO_NORMAL);
  assert.equal(out.veto, false);
  assert.equal(out.exit_window, false);
  assert.ok(out.collapse_prob_10h < 0.4, `崩盘概率应<0.4，实际${out.collapse_prob_10h}`);
  assert.ok(out.fatigue_coefficient < 0.5, `疲劳系数应<0.5，实际${out.fatigue_coefficient}`);
});

test('推演官 · 高崩盘概率+高疲劳：触发否决', () => {
  const out = fallbackAggressive(SCENARIO_AGGRESSIVE_VETO);
  assert.equal(out.veto, true, '崩盘67%+疲劳92%应触发否决');
  assert.ok(out.fatigue_coefficient > 0.8, `疲劳系数应>0.8，实际${out.fatigue_coefficient}`);
  assert.ok(out.veto_reason !== undefined);
});

test('推演官 · 带病入场（danger）：collapse_prob 上调修正', () => {
  const withoutDanger = fallbackAggressive(SCENARIO_NORMAL);
  const withDanger = fallbackAggressive(SCENARIO_PRE_ENTRY_DANGER);
  // danger 场景的原始 collapse_prob = 0.31，修正后应 > 原始值
  assert.ok(
    withDanger.collapse_prob_10h > 0.31,
    `danger修正后崩盘概率应>0.31，实际${withDanger.collapse_prob_10h}`,
  );
});

test('推演官 · 带病入场+亏损：触发否决', () => {
  const out = fallbackAggressive(SCENARIO_PRE_ENTRY_DANGER);
  assert.equal(out.veto, true, 'danger级别进场且亏损应触发否决');
  assert.ok(out.veto_reason !== undefined);
});

test('推演官 · 临近止损场景：否决+崩盘概率极高', () => {
  const out = fallbackAggressive(SCENARIO_CONSERVATIVE_VETO);
  assert.equal(out.veto, true);
  assert.ok(out.collapse_prob_10h > 0.6, `临近止损崩盘概率应>0.6，实际${out.collapse_prob_10h}`);
});

test('推演官 · 输出字段完整性检查', () => {
  for (const scenario of [SCENARIO_NORMAL, SCENARIO_AGGRESSIVE_VETO, SCENARIO_PRE_ENTRY_DANGER]) {
    const out = fallbackAggressive(scenario);
    assert.ok(typeof out.collapse_prob_10h === 'number');
    assert.ok(typeof out.fatigue_coefficient === 'number');
    assert.ok(typeof out.exit_window === 'boolean');
    assert.ok(typeof out.veto === 'boolean');
    assert.ok(out.fact_line.length > 0);
    assert.ok(out.assessment.length > 0);
    assert.ok(out.collapse_prob_10h >= 0 && out.collapse_prob_10h <= 1);
    assert.ok(out.fatigue_coefficient >= 0 && out.fatigue_coefficient <= 1);
  }
});
