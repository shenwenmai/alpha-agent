// ============================================================
// 话术匹配引擎 — Script Matching Engine
// 根据【场景 × 情绪级别】精准匹配干预话术
// 10 场景 × 3 级别 × 5 条 = 150 条话术
// ============================================================

import type { EmotionLevel, EmotionState } from './emotionEngine';
import type { FMSession, FMMetrics } from '../types/fundManager';

// ── 场景类型 ──
export type InterventionScene =
  | 'approaching_stop_loss'   // 接近止损
  | 'reached_stop_loss'       // 已达止损
  | 'profit_giveback'         // 盈利回吐
  | 'entering_lock_profit'    // 进入锁盈区
  | 'overtime'                // 超时
  | 'tilt_betting'            // 上头加码
  | 'loss_streak'             // 连败
  | 'win_streak_euphoria'     // 连赢后亢奋
  | 'rule_change'             // 中途改规则
  | 'idle_long';              // 长时间无操作

// ── 语气类型 ──
export type ScriptTone = 'gentle' | 'firm' | 'urgent' | 'empathetic';

// ── 输出结构 ──
export interface MatchedScript {
  text: string;
  scene: InterventionScene;
  level: EmotionLevel;
  tone: ScriptTone;
}

// ── 上下文（可选模板变量来源） ──
export interface ScriptContext {
  stopLoss?: number;
  currentLoss?: number;
  betMultiple?: number;
  givebackRate?: number;
  lossStreak?: number;
  elapsedMinutes?: number;
}

// ── 非 calm 级别 ──
type ActiveLevel = 'mild' | 'moderate' | 'severe';

// ── 语气映射 ──
const TONE_MAP: Record<InterventionScene, Record<ActiveLevel, ScriptTone>> = {
  approaching_stop_loss: { mild: 'gentle', moderate: 'firm', severe: 'urgent' },
  reached_stop_loss:     { mild: 'gentle', moderate: 'firm', severe: 'urgent' },
  profit_giveback:       { mild: 'gentle', moderate: 'firm', severe: 'urgent' },
  entering_lock_profit:  { mild: 'gentle', moderate: 'firm', severe: 'urgent' },
  overtime:              { mild: 'gentle', moderate: 'firm', severe: 'urgent' },
  tilt_betting:          { mild: 'gentle', moderate: 'firm', severe: 'urgent' },
  loss_streak:           { mild: 'empathetic', moderate: 'firm', severe: 'urgent' },
  win_streak_euphoria:   { mild: 'gentle', moderate: 'firm', severe: 'urgent' },
  rule_change:           { mild: 'gentle', moderate: 'firm', severe: 'urgent' },
  idle_long:             { mild: 'gentle', moderate: 'firm', severe: 'empathetic' },
};

// ── 150 条话术库 ──
// 每条支持模板变量：{stopLoss} {currentLoss} {betMultiple} {givebackRate} {lossStreak} {elapsedMinutes}

const SCRIPT_DB: Record<InterventionScene, Record<ActiveLevel, string[]>> = {

  // ──────────────────────────────────────────
  // 场景 1：接近止损
  // ──────────────────────────────────────────
  approaching_stop_loss: {
    mild: [
      '离止损线不远了，留意一下节奏。',
      '当前亏损 {currentLoss}，止损线 {stopLoss}，注意控制。',
      '止损线在靠近，别急，先稳住。',
      '提醒一下，你离止损线越来越近了。',
      '亏损还在走，离止损还有一段但别大意。',
    ],
    moderate: [
      '当前亏损 {currentLoss}，止损线 {stopLoss} 已经很近了，控制码量。',
      '你离止损没多少空间了，现在不是加码的时候。',
      '接近止损了，每一手都要严格按计划来。',
      '止损线 {stopLoss} 近在咫尺，不要心存侥幸。',
      '距离止损越来越近，需要你冷静下来。',
    ],
    severe: [
      '止损线 {stopLoss} 就在眼前，立刻停下来想想。',
      '你几乎已经到止损了，当前亏损 {currentLoss}。停一下。',
      '再亏一点就破止损了。你当初定这条线是有原因的。',
      '当前已经贴着止损线了，别再打了。',
      '停。止损线就在面前。你答应过自己的。',
    ],
  },

  // ──────────────────────────────────────────
  // 场景 2：已达止损
  // ──────────────────────────────────────────
  reached_stop_loss: {
    mild: [
      '止损线 {stopLoss} 已经到了，计划说好到这里就收。',
      '你定的止损金额到了，该停一停了。',
      '亏损已经到了 {currentLoss}，止损线触发了。',
      '止损到了，今天到此为止吧。',
      '你提前设好的止损 {stopLoss} 已经触发，休息一下。',
    ],
    moderate: [
      '止损线 {stopLoss} 已到。你需要现在就停下来。',
      '当前亏损 {currentLoss}，已经超过止损线了。别再继续。',
      '你定的规矩是亏 {stopLoss} 就走，现在到了。',
      '止损已触发。继续打下去不是勇气，是冲动。',
      '计划里写得清清楚楚，止损 {stopLoss}。执行它。',
    ],
    severe: [
      '停。止损 {stopLoss} 已经到了。离开桌子。',
      '你已经亏了 {currentLoss}，远超止损线。立刻停止。',
      '这场已经结束了。止损线不是建议，是你给自己的命令。',
      '不要再打了。你一开始说好的就是亏 {stopLoss} 就走。',
      '现在每多打一手都是在破坏你自己的规矩。停。',
    ],
  },

  // ──────────────────────────────────────────
  // 场景 3：盈利回吐
  // ──────────────────────────────────────────
  profit_giveback: {
    mild: [
      '盈利在回撤，已经回吐了 {givebackRate}%，留意一下。',
      '你赚到的钱正在缩水，看一眼锁盈线。',
      '回吐了 {givebackRate}% 的盈利，别让好局变坏局。',
      '盈利开始往回走了，注意节奏。',
      '赢来的在减少，想想是不是该调整一下。',
    ],
    moderate: [
      '你已经回吐了 {givebackRate}% 的盈利，再不锁住就全没了。',
      '盈利大幅缩水，从赚钱变成了保本战。清醒一下。',
      '回吐 {givebackRate}% 了，这时候最容易上头。控制住。',
      '你到手的利润正在快速流失，该认真考虑收手了。',
      '回撤太大了，别让赢变成输。',
    ],
    severe: [
      '盈利几乎全部回吐，你正在把赢来的钱还回去。停。',
      '{givebackRate}% 的盈利没了。再打下去你会从赢变成亏。',
      '你原来是赚钱的，现在快要倒亏了。立刻停手。',
      '盈利回吐 {givebackRate}%。这是最危险的时刻，先走。',
      '不要把赢来的全送回去。你有过利润的，现在保住它。',
    ],
  },

  // ──────────────────────────────────────────
  // 场景 4：进入锁盈区
  // ──────────────────────────────────────────
  entering_lock_profit: {
    mild: [
      '进入锁盈区了，好消息！记得守住底线。',
      '你已经触发锁盈，保底利润要守住。',
      '锁盈线到了，接下来打得轻松点也行。',
      '盈利不错，锁盈区已激活，注意保住战果。',
      '恭喜触发锁盈，现在最重要的是别把它还回去。',
    ],
    moderate: [
      '锁盈区已触发，最低要保住这些利润。别贪。',
      '你已经在锁盈区了，接下来的每一手要更谨慎。',
      '利润到了锁盈线，这时候最容易放松警惕。',
      '锁盈区的意义是保护利润，不要反过来冒更大风险。',
      '赚到这些不容易，锁盈线就是你的安全网，守住它。',
    ],
    severe: [
      '你在锁盈区但利润在快速缩水，再不走锁盈就白设了。',
      '锁盈线都快破了！你再不收手，利润一分不剩。',
      '你设锁盈就是为了这种时刻。利润在消失，立刻停。',
      '锁盈区的底线要守住。现在走，利润还在；再打，全没。',
      '再亏下去锁盈线就破了。你之前赚的不应该这样没掉。',
    ],
  },

  // ──────────────────────────────────────────
  // 场景 5：超时
  // ──────────────────────────────────────────
  overtime: {
    mild: [
      '时间差不多了，你计划的时长快到了。',
      '已经打了 {elapsedMinutes} 分钟了，注意一下时间。',
      '你定的时间快到了，准备收尾吧。',
      '提醒一下，计划时间已经过去大半了。',
      '时间在走，别忘了你设的时间限制。',
    ],
    moderate: [
      '你已经超时了，打了 {elapsedMinutes} 分钟。该停了。',
      '时间到了。打得越久，判断力越差，这是规律。',
      '已经超出计划时长了，久坐不离是失控的前兆。',
      '你定的时间限制不是随便说说的。到点了，该走了。',
      '超时意味着疲劳，疲劳意味着犯错概率翻倍。停一停。',
    ],
    severe: [
      '严重超时。你已经打了远超计划的时间，立刻离场。',
      '时间早就到了，你还在打。这不是坚持，是失控。',
      '超时太久了。你现在的判断力已经不如刚来的时候。走。',
      '计划时长早已过了。你在拖延离场，这是危险信号。停。',
      '每多待一分钟风险都在增长。现在就走。',
    ],
  },

  // ──────────────────────────────────────────
  // 场景 6：上头加码
  // ──────────────────────────────────────────
  tilt_betting: {
    mild: [
      '你刚才在亏损后加了码，是计划内的吗？',
      '码量变了，你确定这是策略调整而不是情绪？',
      '注意，你在输钱后提高了码量。想一想再决定。',
      '输了之后加码是最常见的情绪操作，留意一下。',
      '码量上去了，基码是多少来着？对比一下。',
    ],
    moderate: [
      '你在亏损后把码量加到了 {betMultiple} 倍基码。这不是策略，是情绪。',
      '亏损区加码是最危险的操作，你知道的。降回来。',
      '码量涨了 {betMultiple} 倍，这时候加码只会亏更多。',
      '你计划里说过亏损区不加码。现在你在做什么？',
      '每次上头都是从加码开始的。回到基码。',
    ],
    severe: [
      '停。你的码量已经是基码的 {betMultiple} 倍了。这是在赌气。',
      '你现在的加码行为完全是情绪驱动的。立刻降回基码。',
      '亏损加码等于加速爆仓。你正在走最危险的路。停。',
      '码量失控了。你带来的钱经不起这样打。马上降码。',
      '这不是你的计划，这是情绪在下注。降码，或者离场。',
    ],
  },

  // ──────────────────────────────────────────
  // 场景 7：连败
  // ──────────────────────────────────────────
  loss_streak: {
    mild: [
      '连输了 {lossStreak} 手了，先调整一下节奏。',
      '手气不好，连着输了几把。急不得。',
      '连败 {lossStreak} 手了，很正常，别因为这个改计划。',
      '输了几手不要紧，关键是别因为想翻本而乱来。',
      '连败 {lossStreak} 手，深呼吸，保持节奏。',
    ],
    moderate: [
      '已经连输 {lossStreak} 手了，这时候最容易冲动加码。忍住。',
      '连败 {lossStreak} 手不是运气差那么简单，先停下来想想。',
      '连败到这个程度，你需要暂停一下，别硬扛。',
      '连输 {lossStreak} 手后继续打，赢的概率没变，但你的判断力在变。',
      '先停两分钟。连败的时候做的决定往往是最差的。',
    ],
    severe: [
      '连输 {lossStreak} 手了。这已经不是正常波动了。停。',
      '连败 {lossStreak} 手，你的止损快要到了。现在停还来得及。',
      '连败这么多手，你还在打。这不是策略，是不服输。',
      '立刻停下来。连败 {lossStreak} 手后的每一个决定都不可靠。',
      '你在连败中越陷越深。没有人能靠硬打逆转连败。停。',
    ],
  },

  // ──────────────────────────────────────────
  // 场景 8：连赢后亢奋
  // ──────────────────────────────────────────
  win_streak_euphoria: {
    mild: [
      '赢了好几把了，不错，但别因此放松警惕。',
      '连赢的时候最容易觉得自己手感好。冷静。',
      '赢钱的感觉很好，但别因为这个就加码。',
      '连赢之后很多人会觉得怎么打都赢。提醒你，不会的。',
      '手气好的时候反而要更谨慎，好运不会永远持续。',
    ],
    moderate: [
      '连赢了但码量也跟着涨了，这很危险。回到基码。',
      '你在连赢后把码量提到了 {betMultiple} 倍。输一把就是大亏。',
      '现在觉得自己能一直赢？这正是你最该小心的时候。',
      '连赢不代表概率变了。码量涨了 {betMultiple} 倍，风险也涨了。',
      '赢钱时的膨胀和输钱时的冲动一样危险。控制码量。',
    ],
    severe: [
      '你在连赢后疯狂加码到 {betMultiple} 倍基码。一旦输一把就前功尽弃。',
      '连赢带来的不是实力，是幻觉。你的码量已经失控了。',
      '你的码量已经是开场的 {betMultiple} 倍了。一把就能回到原点。',
      '膨胀是最隐蔽的失控。你现在的状态就是。降码或离场。',
      '赢来的利润经不起一次大码翻车。现在降回基码。',
    ],
  },

  // ──────────────────────────────────────────
  // 场景 9：中途改规则
  // ──────────────────────────────────────────
  rule_change: {
    mild: [
      '你刚才改了规则，确认一下是深思熟虑还是临时起意？',
      '中途改规则往往是因为情绪，不是因为策略。想清楚了吗？',
      '你调整了计划。问问自己：如果现在是开场，我会这样定吗？',
      '提醒一下，你改了计划。回头看看是不是合理的。',
      '计划调整了，确保是理性决定，不是因为刚才输赢了。',
    ],
    moderate: [
      '你在实战中改了规则。大多数时候这是情绪决策的信号。',
      '计划改了，改得对吗？还是只想给自己更多空间继续打？',
      '你在场上改规则，这正是纪律崩坏的开始。考虑清楚。',
      '90% 的中途改规则都会让结果更差。你确定要改？',
      '如果改规则是为了再打一会儿或再追一点，那就是错的。',
    ],
    severe: [
      '你在情绪最激烈的时候改了规则。这等于没有规则。恢复原计划。',
      '中途改规则加上情绪波动等于失控。停下来，改回去。',
      '你的规则是冷静时定的，现在改它就是在否定冷静的自己。',
      '别改规则了。你现在做的每一个决定都被情绪污染了。',
      '恢复原计划。你现在不适合做任何调整。',
    ],
  },

  // ──────────────────────────────────────────
  // 场景 10：长时间无操作
  // ──────────────────────────────────────────
  idle_long: {
    mild: [
      '有一会儿没记录了，还在桌上吗？',
      '好久没更新了，状态怎么样？',
      '如果还在打的话，记得记录一下。',
      '提醒一下，有段时间没操作了。一切都好吧？',
      '在休息还是忘记记录了？更新一下状态。',
    ],
    moderate: [
      '已经很久没记录了。不记录等于无法追踪，容易失控。',
      '长时间没操作，是不是在打但没记录？这很危险。',
      '有好一阵子没更新了。不记录就是在盲打。',
      '不记录的时间段往往是最容易犯错的时间段。更新一下。',
      '系统帮不了一个不记录的人。同步一下你的状态。',
    ],
    severe: [
      '你已经失联太久了。如果还在打，你正在没有风控的状态下冒险。',
      '长时间无记录意味着最危险的状态。立刻更新或离场。',
      '你让系统帮你盯着，但你消失了。现在更新，或者承认这场已经失控。',
      '这段空白时间里发生了什么？不管怎样，先把数据同步了。',
      '没有记录的时间就是没有纪律的时间。马上回来更新。',
    ],
  },
};

// ── 轮转索引追踪（同场景同级别不重复） ──
const rotationIndex = new Map<string, number>();

function getKey(scene: InterventionScene, level: ActiveLevel): string {
  return `${scene}:${level}`;
}

/** 替换话术中的模板变量 */
function applyTemplate(text: string, ctx?: ScriptContext): string {
  if (!ctx) return text;
  return text
    .replace(/\{stopLoss\}/g, ctx.stopLoss != null ? String(ctx.stopLoss) : '--')
    .replace(/\{currentLoss\}/g, ctx.currentLoss != null ? String(ctx.currentLoss) : '--')
    .replace(/\{betMultiple\}/g, ctx.betMultiple != null ? String(ctx.betMultiple) : '--')
    .replace(/\{givebackRate\}/g, ctx.givebackRate != null ? String(Math.round(ctx.givebackRate)) : '--')
    .replace(/\{lossStreak\}/g, ctx.lossStreak != null ? String(ctx.lossStreak) : '--')
    .replace(/\{elapsedMinutes\}/g, ctx.elapsedMinutes != null ? String(Math.round(ctx.elapsedMinutes)) : '--');
}

/** 从 session + metrics 构建 ScriptContext */
function buildContext(session: FMSession, metrics: FMMetrics): ScriptContext {
  return {
    stopLoss: session.plan.stop_loss_amount,
    currentLoss: metrics.net_pnl < 0 ? Math.abs(metrics.net_pnl) : 0,
    betMultiple: session.plan.base_unit > 0
      ? Math.round((metrics.current_bet_unit / session.plan.base_unit) * 10) / 10
      : 1,
    givebackRate: metrics.profit_giveback_rate,
    lossStreak: metrics.current_loss_streak,
    elapsedMinutes: metrics.elapsed_minutes,
  };
}

// ── 核心函数 ──

/**
 * 根据当前场景和情绪匹配话术
 * calm 级别返回 null（不干预）
 */
export function matchScript(
  scene: InterventionScene,
  level: EmotionLevel,
  context?: ScriptContext,
): MatchedScript | null {
  if (level === 'calm') return null;

  const activeLevel = level as ActiveLevel;
  const pool = SCRIPT_DB[scene][activeLevel];
  const key = getKey(scene, activeLevel);

  // 取当前索引位置的话术
  const idx = rotationIndex.get(key) ?? 0;
  const rawText = pool[idx % pool.length];

  return {
    text: applyTemplate(rawText, context),
    scene,
    level,
    tone: TONE_MAP[scene][activeLevel],
  };
}

/**
 * 换一句（同场景同级别的下一条）
 */
export function nextScript(
  scene: InterventionScene,
  level: EmotionLevel,
  context?: ScriptContext,
): MatchedScript | null {
  if (level === 'calm') return null;

  const activeLevel = level as ActiveLevel;
  const key = getKey(scene, activeLevel);
  const pool = SCRIPT_DB[scene][activeLevel];

  const current = rotationIndex.get(key) ?? 0;
  const next = (current + 1) % pool.length;
  rotationIndex.set(key, next);

  const rawText = pool[next];

  return {
    text: applyTemplate(rawText, context),
    scene,
    level,
    tone: TONE_MAP[scene][activeLevel],
  };
}

/**
 * 从当前状态自动判断处于哪些场景
 */
export function detectActiveScenes(
  session: FMSession,
  metrics: FMMetrics,
  emotion: EmotionState,
): InterventionScene[] {
  const scenes: InterventionScene[] = [];

  // 止损相关
  if (session.plan.stop_loss_amount > 0) {
    const ratio = metrics.distance_to_stop_loss / session.plan.stop_loss_amount;
    if (ratio <= 0) {
      scenes.push('reached_stop_loss');
    } else if (ratio < 0.3) {
      scenes.push('approaching_stop_loss');
    }
  }

  // 盈利回吐
  if (metrics.profit_giveback_rate > 50 && metrics.highest_profit > 0) {
    scenes.push('profit_giveback');
  }

  // 锁盈区
  if (metrics.is_in_lock_profit_zone) {
    scenes.push('entering_lock_profit');
  }

  // 超时
  if (session.plan.max_duration_minutes > 0 && metrics.remaining_minutes <= 0) {
    scenes.push('overtime');
  }

  // 上头加码（从情绪信号判断）
  if (emotion.signals.some(s => s.type === 'tilt_betting')) {
    scenes.push('tilt_betting');
  }

  // 连败
  if (metrics.current_loss_streak >= 3) {
    scenes.push('loss_streak');
  }

  // 连赢亢奋
  if (metrics.current_win_streak >= 4 && emotion.signals.some(s => s.type === 'euphoria_raise')) {
    scenes.push('win_streak_euphoria');
  }

  // 中途改规则（最近 5 个事件中有 rule_change）
  const recentEvents = session.events.slice(-5);
  if (recentEvents.some(e => e.event_type === 'rule_change')) {
    scenes.push('rule_change');
  }

  // 长时间无操作（超过 10 分钟无事件）
  if (session.events.length > 0 && session.plan.idle_reminder) {
    const lastEvent = session.events[session.events.length - 1];
    const lastTime = new Date(lastEvent.timestamp).getTime();
    const now = Date.now();
    if (now - lastTime > 10 * 60 * 1000) {
      scenes.push('idle_long');
    }
  }

  return scenes;
}

/**
 * 批量获取当前可用话术（实时面板用）
 * 自动检测场景 + 匹配话术
 */
export function getActiveScripts(
  session: FMSession,
  metrics: FMMetrics,
  emotion: EmotionState,
): MatchedScript[] {
  if (emotion.level === 'calm') return [];

  const scenes = detectActiveScenes(session, metrics, emotion);
  const ctx = buildContext(session, metrics);

  return scenes
    .map(scene => matchScript(scene, emotion.level, ctx))
    .filter((s): s is MatchedScript => s !== null);
}

/** 重置话术轮转（新场次开始时调用） */
export function resetScriptRotation(): void {
  rotationIndex.clear();
}
