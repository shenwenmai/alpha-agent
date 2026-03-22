import { B_ROLE_SYSTEM_PROMPT, STRATEGIST_SYSTEM_PROMPT } from "../prompts";
import { store } from "./extractionService";
import { persistEventPipeline } from "./pipelineService";
import { collectChatTurn, collectExtraction, collectProfileSnapshot, collectRAGLog } from "./collectService";
import { hasSingleActionQuestion, type ActionCheckResult } from "./actionValidator";
import { guardReply } from "./focusGuard";
import { getSafeFallback, type GuardReason } from "./safeFallback";
import { getRedirectResponse, resetOffTopicCount } from "./topicRedirect";
import { preClassify, routeModel, recordUsage, type ModelTier, type RouteDecision } from "./modelRouter";
import { compressHistory, getCompressionStats } from "./conversationSummarizer";
import { checkRateLimit } from "./rateLimiter";

// ============================================================
// AI Service — 通过 /api/* 代理 (API key 不再暴露在前端)
// 去重 · 指数退避 · 统一兜底
// ============================================================

// --- Feature Flags ---
const ENABLE_FEW_SHOT = true;
const ENABLE_RAG = true;
const ENABLE_ACTION_VALIDATOR = true;
const ENABLE_FOCUS_GUARD = true;
const __DEV__ = import.meta.env.DEV;

// --- 赌场知识话题软转向 ---
// 不拦截，但连续4轮后注入soft redirect指令
const KNOWLEDGE_TOPIC_RE =
  /(灰控|作弊|百家乐|老虎机|赌场.*机制|庄家.*优势|洗牌|RTP|RNG|抽水|概率.*赌|赌.*概率|赌场.*怎么.*赢|出老千|机器人|算牌|打码量)/i;
let knowledgeTopicStreak = 0;

function getKnowledgeRedirectHint(streak: number): string {
  if (streak < 4) return '';
  if (streak < 6) {
    return '\n\n⚠️ [系统提示] 用户已连续' + streak + '轮讨论赌场知识。可以继续回答，但请在回复中自然地引入风险控制角度（如"了解了这些机制，你觉得对你的止损策略有什么启发？"），把话题向数据化风控和保护行动过渡。不要强硬打断。';
  }
  return '\n\n⚠️ [系统提示] 用户已连续' + streak + '轮讨论赌场知识，请更积极地引导话题：回答知识问题后，用一个与用户个人情况相关的风控提问收尾（如"说到这里，你这个月的止损线是多少？"或"了解了赌场怎么赢钱，你打算怎么保护自己？"）。语气温和，不要说教。';
}

// --- Metadata 日志 (最近 100 条) ---
interface TurnMeta {
  ts: number;
  role: 'old_friend' | 'myself' | 'strategist';
  modelUsed: string;
  modelTier: ModelTier;
  routeReason: string;
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
  hasSingleAction: boolean;
  retryCount: number;
  validatorReason?: string;
  fallbackUsed: boolean;
  fallbackReason?: GuardReason;
}
const turnMetaLog: TurnMeta[] = [];
export function getTurnMetaLog(): readonly TurnMeta[] { return turnMetaLog; }
export { getUsageStats } from "./modelRouter";

// --- 统一兜底文案 ---
const FALLBACK_TEXT = "我在。刚刚网络抖了一下。你继续说。";

// --- P0-2: 去重 ---
const recentRequests = new Map<string, number>();
const DEDUP_WINDOW_MS = 5000;

function isDuplicate(uuid: string): boolean {
  const now = Date.now();
  for (const [key, ts] of recentRequests) {
    if (now - ts > DEDUP_WINDOW_MS) recentRequests.delete(key);
  }
  if (recentRequests.has(uuid)) {
    console.warn(`[AI] Duplicate blocked: ${uuid}`);
    return true;
  }
  recentRequests.set(uuid, now);
  return false;
}

// --- 请求ID ---
let reqCounter = 0;
function genReqId(): string {
  return `req_${Date.now().toString(36)}_${(++reqCounter).toString(36)}`;
}

// --- 超时/延迟 ---
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`Timeout ${ms}ms`)), ms)),
  ]);
}
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// --- 判断可重试 ---
function isRetryable(status: number, msg: string): boolean {
  return status === 429 || status >= 500 || msg.includes('rate') || msg.includes('timeout');
}

// --- Few-Shot (从原始数据导入) ---
import { FEW_SHOT_EXAMPLES } from "../data/fewShotExamples";

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  aiRole?: 'b' | 's';  // AI消息所属角色，用于显示角色标签
}

// --- 清理响应 ---
function cleanResponse(text: string | undefined | null): string {
  if (!text) return "";
  let c = text;
  c = c.replace(/^[\w\u4e00-\u9fa5]+[：:]\s*/, '');
  c = c.replace(/^\s*[（\(\[].*?[）\)\]]\s*/g, '');
  c = c.trim();
  const silenceMarkers = ['（沉默）', '(silence)', '...', '…', '。。。', '（点头）', '(nodding)'];
  if (silenceMarkers.some(m => c.includes(m)) && c.length < 10) return "";
  if (/^[:：.。…\s]*$/.test(c)) return "";
  return c;
}

// --- RAG 知识库检索（双轨：教育子轨 + 干预主轨）---
async function fetchRAGContext(query: string, mode: 'b' | 's' = 'b'): Promise<string> {
  try {
    const res = await withTimeout(
      fetch('/api/rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, topK: 8 }),
      }),
      5000
    );
    if (!res.ok) return '';
    const { results } = await res.json();
    if (!results || results.length === 0) return '';

    // 按 tag 分轨
    const knowledge: string[] = [];  // 教育子轨
    const quotes: string[] = [];     // 金句子轨
    const intervention: string[] = []; // 干预主轨

    // 教育类 tag（包含 relapse_prevention，之前漏掉导致灰控/赌场现象样片进不了教育轨道）
    const EDU_TAGS: Record<string, string> = {
      mechanism_explain: '机制教育', risk_control: '风控知识',
      kelly_strategy: '凯利风控', grey_control: '灰控揭秘',
      relapse_prevention: '行为预防',
    };

    for (const r of results) {
      if (r.score < 0.30) continue;
      const tag = r.metadata?.tag || 'intervention';
      const text = (r.text || '').slice(0, 1000);
      if (!text) continue;

      if (tag === 'quote_anchored') {
        const quoteName = r.metadata?.quote_used || '';
        quotes.push(`[金句] ${quoteName ? `(${quoteName}) ` : ''}${text}`);
      } else if (EDU_TAGS[tag]) {
        knowledge.push(`[${EDU_TAGS[tag]}] ${text}`);
      } else {
        intervention.push(`[干预参考] ${text}`);
      }
    }

    let ctx = '';

    // 金句子轨 — 鼓励自然融入名人金句
    if (quotes.length > 0) {
      ctx += '\n\n--- 名人金句参考（你必须在本轮回复中引用至少一句）---\n';
      ctx += '⚡ 直接引用，如"巴菲特说过：XXX"，然后落地到用户处境。不需要讲故事铺垫。\n';
      ctx += quotes.slice(0, 2).join('\n\n');
      ctx += '\n--- 金句参考结束 ---';
    }

    // 教育子轨 — 允许讲解，但必须追加保护提问
    if (knowledge.length > 0) {
      ctx += '\n\n--- 知识库参考（教育类）---\n';
      ctx += '⚠️ 可以讲解赌博机制/风控知识，但回复最后必须追加一个保护性提问把话题拉回用户当前状态\n';
      ctx += knowledge.slice(0, 3).join('\n\n');
      ctx += '\n--- 教育参考结束 ---';
    }

    // 干预主轨 — 启发回应方向
    if (intervention.length > 0) {
      ctx += '\n\n--- 知识库参考（干预类 — 仅供启发，不要直接复述）---\n';
      ctx += intervention.slice(0, 3).join('\n\n');
      ctx += '\n--- 干预参考结束 ---';
    }

    // 记录 RAG 检索日志 (非阻塞)
    const logChunks = results
      .filter((r: any) => r.score >= 0.30)
      .map((r: any) => ({ id: r.id || '', similarity: +(r.score || 0).toFixed(4), tag: r.metadata?.tag || 'unknown' }));
    collectRAGLog(query.slice(0, 80), mode, logChunks);

    return ctx;
  } catch {
    return ''; // RAG 失败不影响主流程
  }
}

// --- 通过 /api/chat 代理调用 ---
interface ChatResult {
  text: string;
  usage: { inputTokens: number; outputTokens: number };
  model: string;
}

async function callChat(
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  temperature: number,
  model?: string,
  maxTokens?: number,
): Promise<ChatResult> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ systemPrompt, messages, temperature, model, maxTokens }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw Object.assign(new Error(`API ${res.status}: ${errData.error || ''}`), { status: res.status });
  }

  const data = await res.json();
  return {
    text: data.text || '',
    usage: data.usage || { inputTokens: 0, outputTokens: 0 },
    model: data.model || model || 'unknown',
  };
}

// ============================================================
// 主聊天函数
// ============================================================
export async function sendMessageToB(
  history: ChatMessage[],
  newMessage: string,
  mode: 'b' | 's' = 'b',
  messageUuid?: string
): Promise<string> {
  const requestId = genReqId();
  const uuid = messageUuid || `auto_${Date.now()}`;

  if (isDuplicate(uuid)) return FALLBACK_TEXT;

  // 限流检查
  const rateCheck = checkRateLimit();
  if (!rateCheck.allowed) {
    console.warn(`[AI] ${requestId} | RATE LIMITED: ${rateCheck.reason}`);
    return rateCheck.friendlyMessage || '稍等一下，等会继续。';
  }

  __DEV__ && console.log(`[AI] ${requestId} | uuid=${uuid} | mode=${mode} | msg="${newMessage.slice(0, 30)}..."`);

  let systemPrompt = mode === 'b' ? B_ROLE_SYSTEM_PROMPT : STRATEGIST_SYSTEM_PROMPT;
  const temperature = mode === 'b' ? 0.7 : 0.4;

  // 语言自适应：只看当前消息，输入什么体回复什么体
  const hasTraditional = /[這們來說對經過還請時東後從點開關書學電話認為應該資訊體與議題處理單據異動輸贏賺賠壓註買賣輪盤準備聯繫問題運動環際區廳號圖軟網訊麼裡個種車門見長風雲馬魚鳥龍達實際備確業導層標係統濟發優質華論壇遊戲腦線資料庫]/.test(newMessage);
  if (hasTraditional) {
    systemPrompt += '\n\n【语言要求】这条消息使用繁体中文，你必须用繁体中文回复。所有汉字用繁体字形，标点用全角。硬性要求。';
  }

  // --- 模型路由: 预分类 → 选模型 ---
  const preClass = preClassify(newMessage);
  let route: RouteDecision = routeModel({ preClass, validatorFailCount: 0, mode });
  __DEV__ && console.log(`[AI] ${requestId} | preClass=${preClass} | model=${route.model} | reason=${route.reason} | maxTokens=${route.maxTokens}`);

  // RAG: 检索知识库，注入参考上下文 (老朋友 + 博弈军师)
  if (ENABLE_RAG && (mode === 'b' || mode === 's')) {
    const ragContext = await fetchRAGContext(newMessage, mode);
    if (ragContext) {
      systemPrompt += ragContext;
      __DEV__ && console.log(`[AI] ${requestId} | RAG context injected`);
    }
  }

  // 赌场知识话题软转向：计数 + 注入redirect hint
  if (mode === 'b') {
    if (KNOWLEDGE_TOPIC_RE.test(newMessage)) {
      knowledgeTopicStreak++;
      __DEV__ && console.log(`[AI] ${requestId} | knowledge streak=${knowledgeTopicStreak}`);
    } else {
      knowledgeTopicStreak = 0;
    }
    const redirectHint = getKnowledgeRedirectHint(knowledgeTopicStreak);
    if (redirectHint) {
      systemPrompt += redirectHint;
      __DEV__ && console.log(`[AI] ${requestId} | knowledge redirect hint injected (streak=${knowledgeTopicStreak})`);
    }
  }

  // 构建消息列表
  const chatMessages: Array<{ role: string; content: string }> = [];

  // Few-shot (B角)
  if (ENABLE_FEW_SHOT && mode === 'b') {
    FEW_SHOT_EXAMPLES.forEach(ex => {
      chatMessages.push({ role: 'user', content: ex.input });
      chatMessages.push({ role: 'assistant', content: ex.output });
    });
  }

  // 对话历史 (压缩: 最近8条原文 + 更早的摘要)
  const compressed = compressHistory(history);
  const stats = getCompressionStats(history.length, compressed.length);
  if (stats.saved > 0) {
    __DEV__ && console.log(`[AI] ${requestId} | history compressed: ${stats.original}→${stats.compressed} (saved ${stats.ratio}%)`);
  }
  compressed.forEach(msg => {
    chatMessages.push({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.text,
    });
  });

  // 当前消息
  chatMessages.push({ role: 'user', content: newMessage });

  // P0-2: 指数退避 2s/4s/8s, 最多3次
  const MAX_RETRIES = 3;
  const BASE_DELAY = 2000;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = BASE_DELAY * Math.pow(2, attempt - 1);
      __DEV__ && console.log(`[AI] ${requestId} | retry=${attempt} | delay=${delay}ms`);
      await sleep(delay);
    }

    try {
      const chatResult = await withTimeout(
        callChat(systemPrompt, chatMessages, temperature, route.model, route.maxTokens),
        15000
      );

      // 记录 token 使用
      const usageRecord = recordUsage(
        route.model, route.tier, route.reason,
        chatResult.usage.inputTokens, chatResult.usage.outputTokens,
      );
      __DEV__ && console.log(`[AI] ${requestId} | tokens: in=${chatResult.usage.inputTokens} out=${chatResult.usage.outputTokens} cost=$${usageRecord.costUSD.toFixed(4)}`);

      let cleaned = cleanResponse(chatResult.text);

      if (!cleaned) {
        console.warn(`[AI] ${requestId} | attempt=${attempt} | empty response`);
        if (attempt < MAX_RETRIES) continue;
        return FALLBACK_TEXT;
      }

      // 危机切换 (优先级最高 — 博弈军师支持)
      if (mode === 's' && cleaned.includes('__CRISIS_HANDOFF__')) {
        collectChatTurn(newMessage, cleaned, mode);
        return '__CRISIS_HANDOFF__';
      }

      // ========== 出站管线 (仅老朋友模式) ==========
      let fallbackUsed = false;
      let fallbackReason: GuardReason | undefined;
      let validatorResult: ActionCheckResult = { ok: true };
      let retryCount = 0;

      if (mode === 'b') {
        // --- ① focusGuard: 语义拦截 ---
        if (ENABLE_FOCUS_GUARD) {
          const recentHistory = history.slice(-10).map(m => ({
            role: m.role,
            text: m.text,
          }));
          const guard = guardReply(newMessage, cleaned, recentHistory);

          if (guard.blocked && guard.reason) {
            console.warn(`[AI] ${requestId} | focusGuard BLOCKED: ${guard.reason}`);
            fallbackUsed = true;
            fallbackReason = guard.reason;

            // 跑题/策略/抗拒 → topicRedirect (3步状态机+升级)
            // 其余 → safeFallback (固定模板)
            if (guard.reason === "off_topic") {
              cleaned = getRedirectResponse("off_topic", guard.offTopicHint);
            } else if (guard.reason === "gambling_strategy") {
              cleaned = getRedirectResponse("strategy");
            } else if (guard.reason === "resistance") {
              cleaned = getRedirectResponse("resistance");
            } else {
              cleaned = getSafeFallback(guard.reason);
            }
          } else {
            // 未命中跑题 → 重置连续跑题计数
            resetOffTopicCount();
          }
        }

        // --- ② actionValidator: 格式检测 (仅未被 focusGuard 拦截时) ---
        if (!fallbackUsed && ENABLE_ACTION_VALIDATOR) {
          validatorResult = hasSingleActionQuestion(cleaned);

          if (!validatorResult.ok) {
            console.warn(`[AI] ${requestId} | validator FAIL: ${validatorResult.reason} | retrying...`);
            retryCount = 1;

            // 升级模型路由 (validatorFailCount=1)
            const retryRoute = routeModel({ preClass, validatorFailCount: 1, mode });

            try {
              const retryRes = await withTimeout(
                callChat(systemPrompt, chatMessages, Math.max(temperature - 0.2, 0.1), retryRoute.model, retryRoute.maxTokens),
                15000
              );
              // 记录重试 token
              recordUsage(retryRoute.model, retryRoute.tier, 'validator_retry',
                retryRes.usage.inputTokens, retryRes.usage.outputTokens);

              const retryCleaned = cleanResponse(retryRes.text);
              if (retryCleaned) {
                const retryCheck = hasSingleActionQuestion(retryCleaned);
                if (retryCheck.ok) {
                  cleaned = retryCleaned;
                  validatorResult = retryCheck;
                  __DEV__ && console.log(`[AI] ${requestId} | validator retry OK (model=${retryRoute.model})`);
                } else {
                  console.warn(`[AI] ${requestId} | validator retry still FAIL: ${retryCheck.reason} | using original`);
                  validatorResult = retryCheck;
                }
              }
            } catch {
              console.warn(`[AI] ${requestId} | validator retry error, using original`);
            }
          }
        }
      }

      // --- 记录 metadata ---
      const meta: TurnMeta = {
        ts: Date.now(),
        role: mode === 'b' ? 'old_friend' : 'strategist',
        modelUsed: route.model,
        modelTier: route.tier,
        routeReason: route.reason,
        inputTokens: chatResult.usage.inputTokens,
        outputTokens: chatResult.usage.outputTokens,
        costUSD: +(chatResult.usage.inputTokens * 0.4 / 1e6 + chatResult.usage.outputTokens * 1.6 / 1e6).toFixed(6),
        hasSingleAction: fallbackUsed ? true : validatorResult.ok,
        retryCount,
        validatorReason: validatorResult.reason,
        fallbackUsed,
        fallbackReason,
      };
      turnMetaLog.push(meta);
      if (turnMetaLog.length > 100) turnMetaLog.shift();
      __DEV__ && console.log(`[AI] ${requestId} | meta:`, JSON.stringify(meta));

      __DEV__ && console.log(`[AI] ${requestId} | attempt=${attempt} | ok | len=${cleaned.length}`);

      // 上报对话到服务器 (非阻塞)
      collectChatTurn(newMessage, cleaned, mode);

      return cleaned;

    } catch (err: any) {
      const status = err?.status || 0;
      const msg = (err?.message || '').toLowerCase();
      console.error(`[AI] ${requestId} | attempt=${attempt} | error: ${err?.message?.slice(0, 80)}`);

      if (isRetryable(status, msg) && attempt < MAX_RETRIES) continue;

      return FALLBACK_TEXT;
    }
  }

  return FALLBACK_TEXT;
}

// ============================================================
// 后台提取 — 通过 /api/extract 代理
// ============================================================
export async function analyzeAndExtractBill(
  history: ChatMessage[],
  newMessage: string,
  messageId: string
): Promise<void> {
  __DEV__ && console.log("[Extraction] Starting...");
  try {
    const messages = history.slice(-5).map(m => ({
      role: m.role,
      text: m.text,
    }));

    const res = await withTimeout(
      fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, userText: newMessage, msgId: messageId }),
      }),
      15000
    );

    if (!res.ok) {
      console.error(`[Extraction] API ${res.status}`);
      return;
    }

    const { toolCalls } = await res.json();

    if (toolCalls && toolCalls.length > 0) {
      __DEV__ && console.log(`[Extraction] Found ${toolCalls.length} tool calls`);
      for (const tc of toolCalls) {
        try {
          // 走 pipeline: validate → confidence split → save → linkEvidence → recomputeProfile
          const event = await persistEventPipeline(tc, messageId);
          __DEV__ && console.log(`[Extraction] ${tc.name} → ${event.status}`);

          // 上报提取事件到服务器 (非阻塞)
          collectExtraction(
            tc.name,
            tc.arguments,
            tc.arguments?.confidence || 0,
            event.status,
            messageId
          );

          // 如果 profile 更新了，也上报
          if (event.status === 'saved' && store.userProfile) {
            collectProfileSnapshot(store.userProfile);
          }
        } catch (err) {
          console.error(`[Extraction] ${tc.name} failed:`, err);
        }
      }
    } else {
      __DEV__ && console.log("[Extraction] No relevant data.");
    }
  } catch (e) {
    console.error("[Extraction] Failed:", e);
  }
}
