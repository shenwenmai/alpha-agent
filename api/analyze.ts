import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fallbackConservative, fallbackBalanced, fallbackAggressive } from '../src/fallback';
import { runConsensus } from '../src/consensus';
import type { AgentPanelRequest, AgentAnalysis } from '../src/types';

// ============================================================
// /api/analyze — 三Agent并行分析入口
//
// POST body: AgentPanelRequest（见 src/types.ts）
// 返回: { agent_analysis: AgentAnalysis }
//
// 只在 L2+ 场景调用（约30%手次，~$0.01/场次）
// LLM 失败时自动降级为规则输出，永不沉默
// ============================================================

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4.1-mini';

// ── System Prompts ──────────────────────────────────────────

const SYSTEM_CONSERVATIVE = `你是博弈系统的风险官。你的唯一职责是评估当前资金安全状态。

你的分析框架：
1. 计算生存安全边际 = distance_to_stop_loss ÷ base_unit（还能承受几手基码的亏损）
2. 判断盘面状态：net_pnl > 0 = 顺风，net_pnl < 0 = 逆风
3. 读取 survival_prob（已由引擎计算，你直接解读）
4. 检查锁盈状态：is_in_lock_profit_zone = true 时，任何回撤都需要发声

进场前自检对你的影响：
- pre_entry_risk_level = warning 或 danger：收紧你的判断标准，更早发出警告
- pre_entry_lethal_signals 不为空：明确在分析中提及这是带病入场

否决条件（任意一条成立，veto = true）：
- survival_prob < 0.30
- distance_to_stop_loss ≤ base_unit × 2
- 锁盈区内 profit_giveback_rate > 50%

输出语气：冷静、精准、只说数字和事实。不评价用户行为，只描述盘面。一句事实 + 一句判断，总字数不超过40字。

输出格式（严格JSON，不加任何额外字段）：
{"safety_status":"safe"|"caution"|"critical","survival_margin":<number>,"survival_prob":<number>,"veto":<boolean>,"veto_reason":"<仅veto=true时填写，否则省略此key>","fact_line":"<事实一句话，含数字>","assessment":"<判断一句话>"}`;

const SYSTEM_BALANCED = `你是博弈系统的行为官。你的唯一职责是识别玩家行为是否偏离理性基准。

你不评价输赢，只看行为。

你的分析框架：
1. 注码偏差 bet_deviation_pct：正 = 加注，负 = 缩注
2. 识别模式：追损型（连输后加注>50%）/ 冲动型（单手>200%）/ 畏缩型（盈利时缩注<-50%连续3手）/ 忽视型（consecutive_ignored≥3且亏损）/ 顺风扩张型（连赢后加注>50%）
3. 检查违规：is_violation = true
4. followed_last_advice = false 计入忽视次数

否决条件（任意一条成立，veto = true）：
- consecutive_ignored ≥ 2 且 is_violation = true
- bet_deviation_pct > 300%
- consecutive_ignored ≥ 3 且 net_pnl < 0

输出语气：客观直接，像一面镜子。金融化表达（仓位/加仓/止损执行）。一句事实 + 一句建议，总字数不超过40字。

输出格式（严格JSON）：
{"behavior_status":"normal"|"deviating"|"critical","behavior_pattern":"追损型"|"冲动型"|"畏缩型"|"忽视型"|"顺风扩张型"|null,"deviation_index":<0-10>,"veto":<boolean>,"veto_reason":"<仅veto=true时填写>","fact_line":"<行为事实一句话>","assessment":"<建议一句话>"}`;

const SYSTEM_AGGRESSIVE = `你是博弈系统的推演官。你的唯一职责是向前推演，预判当前趋势继续10手后的风险路径。

你不评价当下对错，你只看前方走向哪里。

你的分析框架：
1. 疲劳系数 = elapsed_minutes ÷ max_duration_minutes（>0.8 = 高疲劳）
2. 解读 collapse_prob（引擎已计算）
3. 退出窗口判断：顺风局+疲劳>0.6 OR 已达盈利目标80%
4. 情绪临界点估算：基于 etp_prob + 疲劳趋势

进场前 danger 修正：collapse_prob ×1.3；即时致命信号：+20个百分点。

否决条件（任意一条成立，veto = true）：
- collapse_prob > 0.60
- 疲劳系数 > 0.90 且 net_pnl < 0
- pre_entry_risk_level = danger 且 net_pnl < 0

输出语气：向前看，金融语言（窗口/路径/概率/临界点）。一句预判 + 一句建议，总字数不超过40字。

输出格式（严格JSON）：
{"collapse_prob_10h":<number>,"fatigue_coefficient":<number>,"exit_window":<boolean>,"exit_window_reason":"<仅exit_window=true时填写>","critical_hand_estimate":<number|null>,"veto":<boolean>,"veto_reason":"<仅veto=true时填写>","fact_line":"<前方风险一句话>","assessment":"<建议一句话>"}`;

// ── 速率限制（内存，冷启动重置） ────────────────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function rateLimit(req: VercelRequest, res: VercelResponse, max: number, windowMs: number): boolean {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string'
    ? forwarded.split(',')[0].trim()
    : req.socket?.remoteAddress || 'unknown';
  const key = `${ip}:analyze`;
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count++;
  if (entry.count > max) {
    res.status(429).json({ error: '请求过于频繁，请稍后再试' });
    return true;
  }
  return false;
}

// ── 单个 Agent LLM 调用 ──────────────────────────────────────

async function callAgent(systemPrompt: string, inputJson: string, apiKey: string): Promise<string> {
  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `请分析以下实战数据：\n${inputJson}` },
      ],
      temperature: 0.4,
      max_tokens: 280,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '{}';
}

// ── 主处理器 ─────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('[analyze] Missing OPENAI_API_KEY');
    return res.status(503).json({ error: 'Service configuration error' });
  }

  // 每IP每分钟最多6次（三Agent并行，成本控制）
  if (rateLimit(req, res, 6, 60_000)) return;

  try {
    if (!req.body) {
      return res.status(400).json({ error: 'Missing request body' });
    }

    const input: AgentPanelRequest = req.body;

    if (!input.session_plan || !input.metrics || !input.engine_output) {
      return res.status(400).json({
        error: 'Missing required fields: session_plan, metrics, engine_output',
      });
    }

    const inputJson = JSON.stringify(input, null, 2);

    // 三Agent并行调用
    const [rawC, rawB, rawA] = await Promise.allSettled([
      callAgent(SYSTEM_CONSERVATIVE, inputJson, apiKey),
      callAgent(SYSTEM_BALANCED, inputJson, apiKey),
      callAgent(SYSTEM_AGGRESSIVE, inputJson, apiKey),
    ]);

    // 解析各Agent结果，失败自动降级兜底
    let conservative: any;
    let balanced: any;
    let aggressive: any;

    try {
      conservative = rawC.status === 'fulfilled'
        ? JSON.parse(rawC.value)
        : fallbackConservative(input);
    } catch {
      conservative = fallbackConservative(input);
    }

    try {
      balanced = rawB.status === 'fulfilled'
        ? JSON.parse(rawB.value)
        : fallbackBalanced(input);
    } catch {
      balanced = fallbackBalanced(input);
    }

    try {
      aggressive = rawA.status === 'fulfilled'
        ? JSON.parse(rawA.value)
        : fallbackAggressive(input);
    } catch {
      aggressive = fallbackAggressive(input);
    }

    // 合议引擎（纯规则）
    const consensus = runConsensus(conservative, balanced, aggressive, input);

    const agent_analysis: AgentAnalysis = {
      conservative,
      balanced,
      aggressive,
      consensus,
    };

    return res.status(200).json({ agent_analysis });

  } catch (err: any) {
    console.error('[api/analyze] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
