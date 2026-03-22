/**
 * 管道5: pushRiskSummary — 风控摘要数据闭环测试
 *
 * 测试策略：
 *   - Mock Supabase 和 fundManagerService
 *   - 验证聚合逻辑（max_level, intervention_count, toxic_combos 等）
 *   - 验证空数据和边界情况
 *   - 验证干预有效性统计
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock Supabase ──
const mockInsert = vi.fn().mockResolvedValue({ error: null });
vi.mock('../supabaseClient', () => ({
  supabase: {
    from: () => ({ insert: mockInsert }),
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
  },
  getCurrentUserId: () => 'test-user-123',
}));

// ── Mock fundManagerService ──
let mockSession: Record<string, unknown> | null = null;
vi.mock('../fundManagerService', () => ({
  getSession: () => mockSession,
  getEndedSessions: () => [],
  addEvent: vi.fn(),
}));

// ── Mock other engines (prevent import errors) ──
vi.mock('../emotionEngine', () => ({
  evaluateETP: vi.fn(),
  restoreETPState: vi.fn(),
}));
vi.mock('../interventionEngine', () => ({
  evaluateIntervention: vi.fn(),
  evaluateInterventionFromRisk: vi.fn(),
}));
vi.mock('../turningPointEngine', () => ({
  detectTurningPoints: vi.fn().mockReturnValue([]),
}));
vi.mock('../growthEngine', () => ({
  generateProfile: vi.fn(),
}));
vi.mock('../riskEvaluationEngine', () => ({
  evaluate: vi.fn(),
  metricsToRiskInput: vi.fn(),
  resetEngine: vi.fn(),
  serializeEngineState: vi.fn().mockReturnValue('{}'),
  restoreEngineState: vi.fn(),
}));
vi.mock('../riskConfigService', () => ({
  getDefaultRiskConfig: vi.fn(),
}));
vi.mock('../../constants/goldenTemplates', () => ({
  GOLDEN_TEMPLATES: {},
}));

import { pushRiskSummary } from '../dataPipeline';

// ── Helper: 构造带 risk_snapshot 的 session ──
function createMockSession(overrides: {
  events?: Array<{
    event_type: string;
    amount?: number;
    timestamp: string;
    risk_snapshot?: {
      level: string;
      tier: string;
      profitLockStage: number;
      toxicCombos: string[];
      keyMoments: string[];
      survivalProb: number;
      etpProb: number;
      collapseProb: number;
    };
  }>;
  template_id?: string;
} = {}) {
  return {
    id: 'session-001',
    template_id: overrides.template_id || 'A',
    plan: {
      session_budget: 5000,
      template_id: overrides.template_id || 'A',
    },
    status: 'ended',
    start_time: '2026-03-14T10:00:00Z',
    end_time: '2026-03-14T10:45:00Z',
    events: overrides.events || [],
    alerts: [],
    is_archived: false,
  };
}

function makeEvent(hand: number, overrides: Partial<{
  event_type: string;
  amount: number;
  level: string;
  survivalProb: number;
  etpProb: number;
  collapseProb: number;
  profitLockStage: number;
  toxicCombos: string[];
  keyMoments: string[];
}> = {}) {
  return {
    event_type: overrides.event_type || (overrides.amount && overrides.amount > 0 ? 'win' : 'loss'),
    amount: overrides.amount ?? -400,
    timestamp: `2026-03-14T10:${String(hand).padStart(2, '0')}:00Z`,
    risk_snapshot: {
      level: overrides.level || 'L0',
      tier: 'steady',
      profitLockStage: overrides.profitLockStage ?? 0,
      toxicCombos: overrides.toxicCombos || [],
      keyMoments: overrides.keyMoments || [],
      survivalProb: overrides.survivalProb ?? 0.75,
      etpProb: overrides.etpProb ?? 0.05,
      collapseProb: overrides.collapseProb ?? 0.10,
    },
  };
}

describe('管道5: pushRiskSummary 风控摘要聚合', () => {
  beforeEach(() => {
    mockInsert.mockClear();
    mockSession = null;
  });

  // ═══ 场景1: 无风控快照 → 不推送 ═══
  it('无 risk_snapshot 事件时不推送', async () => {
    mockSession = createMockSession({
      events: [
        { event_type: 'win', amount: 400, timestamp: '2026-03-14T10:01:00Z' },
        { event_type: 'loss', amount: -400, timestamp: '2026-03-14T10:02:00Z' },
      ],
    });

    await pushRiskSummary('session-001');
    expect(mockInsert).not.toHaveBeenCalled();
  });

  // ═══ 场景2: 正常场次 → 正确聚合 max_level, intervention_count ═══
  it('正常场次聚合 max_level=L3, intervention_count=2', async () => {
    mockSession = createMockSession({
      events: [
        makeEvent(1, { level: 'L0', amount: 400, event_type: 'win' }),
        makeEvent(2, { level: 'L0', amount: 400, event_type: 'win' }),
        makeEvent(3, { level: 'L1', amount: -400 }),
        makeEvent(4, { level: 'L2', amount: -400 }),  // L2+ = intervention
        makeEvent(5, { level: 'L3', amount: -400, keyMoments: ['streak_limit'] }), // L2+ = intervention
      ],
    });

    await pushRiskSummary('session-001');

    expect(mockInsert).toHaveBeenCalledTimes(1);
    const row = mockInsert.mock.calls[0][0];

    expect(row.max_level).toBe('L3');
    expect(row.intervention_count).toBe(2); // L2 + L3
    expect(row.key_moments).toContain('streak_limit');
    expect(row.total_hands).toBe(5);
    expect(row.template_id).toBe('A');
    expect(row.entry_bank).toBe(5000);
  });

  // ═══ 场景3: 毒药组合 + 锁盈 → 正确聚合 ═══
  it('毒药组合 + 锁盈阶段正确聚合', async () => {
    mockSession = createMockSession({
      events: [
        makeEvent(1, { level: 'L0', amount: 400, event_type: 'win', profitLockStage: 1 }),
        makeEvent(2, { level: 'L0', amount: 400, event_type: 'win', profitLockStage: 2 }),
        makeEvent(3, { level: 'L2', amount: -400, profitLockStage: 3, toxicCombos: ['fatigue_pressure'] }),
        makeEvent(4, { level: 'L3', amount: -400, profitLockStage: 3, toxicCombos: ['momentum_reversal'] }),
      ],
    });

    await pushRiskSummary('session-001');

    const row = mockInsert.mock.calls[0][0];
    expect(row.max_profit_lock_stage).toBe(3);
    expect(row.toxic_combos).toContain('fatigue_pressure');
    expect(row.toxic_combos).toContain('momentum_reversal');
    expect(row.toxic_combos).toHaveLength(2);
  });

  // ═══ 场景4: 三维概率极值 ═══
  it('三维概率极值正确提取', async () => {
    mockSession = createMockSession({
      events: [
        makeEvent(1, { survivalProb: 0.80, etpProb: 0.10, collapseProb: 0.05, amount: -400 }),
        makeEvent(2, { survivalProb: 0.45, etpProb: 0.60, collapseProb: 0.30, amount: -400 }),
        makeEvent(3, { survivalProb: 0.30, etpProb: 0.85, collapseProb: 0.70, amount: -400 }),
      ],
    });

    await pushRiskSummary('session-001');

    const row = mockInsert.mock.calls[0][0];
    expect(row.min_survival_prob).toBe(0.30);
    expect(row.max_etp_prob).toBe(0.85);
    expect(row.max_collapse_prob).toBe(0.70);
  });

  // ═══ 场景5: hand_snapshots 序列完整 ═══
  it('hand_snapshots 包含完整时间线', async () => {
    mockSession = createMockSession({
      events: [
        makeEvent(1, { level: 'L0', survivalProb: 0.80, amount: -400 }),
        makeEvent(2, { level: 'L2', survivalProb: 0.50, amount: -400 }),
        makeEvent(3, { level: 'L3', survivalProb: 0.30, amount: -400 }),
      ],
    });

    await pushRiskSummary('session-001');

    const row = mockInsert.mock.calls[0][0];
    expect(row.hand_snapshots).toHaveLength(3);
    expect(row.hand_snapshots[0].hand).toBe(1);
    expect(row.hand_snapshots[0].level).toBe('L0');
    expect(row.hand_snapshots[2].level).toBe('L3');
    expect(row.hand_snapshots[2].survivalProb).toBe(0.30);
  });

  // ═══ 场景6: 盈亏计算 ═══
  it('final_pnl 正确汇总输赢', async () => {
    mockSession = createMockSession({
      events: [
        makeEvent(1, { amount: 400, event_type: 'win' }),
        makeEvent(2, { amount: 400, event_type: 'win' }),
        makeEvent(3, { amount: -400 }),
        makeEvent(4, { amount: -400 }),
        makeEvent(5, { amount: -400 }),
      ],
    });

    await pushRiskSummary('session-001');

    const row = mockInsert.mock.calls[0][0];
    // 400 + 400 - 400 - 400 - 400 = -400
    expect(row.final_pnl).toBe(-400);
  });

  // ═══ 场景7: L4 强制干预场景 ═══
  it('L4 场次 max_level=L4', async () => {
    mockSession = createMockSession({
      events: [
        makeEvent(1, { level: 'L2', amount: -400 }),
        makeEvent(2, { level: 'L3', amount: -400, keyMoments: ['streak_limit'] }),
        makeEvent(3, { level: 'L4', amount: -400, toxicCombos: ['fatigue_pressure'], keyMoments: ['grind', 'overtime'] }),
      ],
    });

    await pushRiskSummary('session-001');

    const row = mockInsert.mock.calls[0][0];
    expect(row.max_level).toBe('L4');
    expect(row.intervention_count).toBe(3); // all L2+
    expect(row.key_moments).toEqual(expect.arrayContaining(['streak_limit', 'grind', 'overtime']));
  });

  // ═══ 场景8: session不存在 → 静默退出 ═══
  it('session不存在时不崩溃', async () => {
    mockSession = null;
    await pushRiskSummary('nonexistent');
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
