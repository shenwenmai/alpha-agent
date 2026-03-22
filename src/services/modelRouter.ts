// ============================================================
// modelRouter — 模型分级调度
//
// 路由优先级: crisis > financial_danger > validator_upgrade > main
// 模型分层:
//   full  = gpt-4.1       ($2.00/$8.00 per 1M) — 危机/高风险/升级
//   mini  = gpt-4.1-mini  ($0.40/$1.60 per 1M) — 日常对话
//   nano  = gpt-4.1-nano  ($0.10/$0.40 per 1M) — 提取/分类/摘要
// ============================================================

export type ModelTier = 'full' | 'mini' | 'nano';

export interface RouteDecision {
  model: string;
  tier: ModelTier;
  reason: string;
  maxTokens: number;
}

// --- 模型常量 ---
const MODEL_FULL = 'gpt-4.1';
const MODEL_MINI = 'gpt-4.1-mini';
const MODEL_NANO = 'gpt-4.1-nano';

// --- 成本追踪 (USD per 1M tokens) ---
export const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'gpt-4.1':      { input: 2.00, output: 8.00 },
  'gpt-4.1-mini': { input: 0.40, output: 1.60 },
  'gpt-4.1-nano': { input: 0.10, output: 0.40 },
};

// --- 预分类: 用户输入 → 风险等级 (在模型调用前执行) ---

const CRISIS_RE =
  /不想活|想死|自杀|去死|活不下去|死了算了|跳楼|割腕|吞药|结束生命|没有意义|杀了|弄死|同归于尽/;

const HIGH_DISTRESS_RE =
  /硬扛|扛不住|受不了|崩溃|撑不下去|绝望|走投无路|没有出路|完了|毁了|废了|天塌了|喘不过气/;

const FINANCIAL_DANGER_RE =
  /借[了过]|贷[了过]|信用[卡]?.*[刷透爆]|网贷|高利贷|卖房|卖车|抵押|挪用|公款|偷了|骗了|欠[了了].*[万十百千]|生活费.*[没花完用]|房租.*[没交付]|吃饭.*钱[都没]|断粮|揭不开锅/;

export type PreClass = 'crisis' | 'high_distress' | 'financial_danger' | 'normal';

export function preClassify(userText: string): PreClass {
  if (CRISIS_RE.test(userText)) return 'crisis';
  if (HIGH_DISTRESS_RE.test(userText)) return 'high_distress';
  if (FINANCIAL_DANGER_RE.test(userText)) return 'financial_danger';
  return 'normal';
}

// --- 路由决策 ---

interface RouteContext {
  preClass: PreClass;
  validatorFailCount: number;  // 当前轮 validator 连续失败次数
  mode: 'b' | 's';
}

export function routeModel(ctx: RouteContext): RouteDecision {
  // P0: 危机 → full + 安全优先
  if (ctx.preClass === 'crisis') {
    return { model: MODEL_FULL, tier: 'full', reason: 'crisis', maxTokens: 500 };
  }

  // P1: 高风险情绪 / 财务危险 → full
  if (ctx.preClass === 'high_distress' || ctx.preClass === 'financial_danger') {
    return { model: MODEL_FULL, tier: 'full', reason: ctx.preClass, maxTokens: 400 };
  }

  // P2: validator 连续失败 ≥2 → 升级 full 一次
  if (ctx.validatorFailCount >= 2) {
    return { model: MODEL_FULL, tier: 'full', reason: 'validator_upgrade', maxTokens: 400 };
  }

  // P3: 博弈军师模式用稍高 token（分析需要空间）
  if (ctx.mode === 's') {
    return { model: MODEL_MINI, tier: 'mini', reason: 'main', maxTokens: 350 };
  }

  // P4: 常规 → mini
  return { model: MODEL_MINI, tier: 'mini', reason: 'main', maxTokens: 300 };
}

// --- 提取/分类专用 ---
export function getExtractionModel(): { model: string; maxTokens: number } {
  return { model: MODEL_NANO, maxTokens: 500 };
}

// --- 会话成本追踪 ---
interface UsageRecord {
  ts: number;
  model: string;
  tier: ModelTier;
  reason: string;
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
}

const usageLog: UsageRecord[] = [];
let sessionCostUSD = 0;

export function recordUsage(
  model: string,
  tier: ModelTier,
  reason: string,
  inputTokens: number,
  outputTokens: number,
): UsageRecord {
  const costs = MODEL_COSTS[model] || MODEL_COSTS['gpt-4.1-mini'];
  const costUSD = (inputTokens * costs.input + outputTokens * costs.output) / 1_000_000;

  const record: UsageRecord = {
    ts: Date.now(),
    model,
    tier,
    reason,
    inputTokens,
    outputTokens,
    costUSD,
  };

  usageLog.push(record);
  sessionCostUSD += costUSD;
  if (usageLog.length > 200) usageLog.shift();

  return record;
}

export function getUsageStats() {
  const tierCounts = { full: 0, mini: 0, nano: 0 };
  const tierCosts = { full: 0, mini: 0, nano: 0 };

  for (const r of usageLog) {
    tierCounts[r.tier]++;
    tierCosts[r.tier] += r.costUSD;
  }

  const total = usageLog.length || 1;

  return {
    totalCalls: usageLog.length,
    sessionCostUSD: +sessionCostUSD.toFixed(4),
    fullRate: +(tierCounts.full / total * 100).toFixed(1),
    tierCounts,
    tierCosts: {
      full: +tierCosts.full.toFixed(4),
      mini: +tierCosts.mini.toFixed(4),
      nano: +tierCosts.nano.toFixed(4),
    },
    recentLog: usageLog.slice(-20),
  };
}
