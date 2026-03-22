// ============================================================
// 干预引擎 — Intervention Engine
// 根据情绪等级 + ETP 转折点 + 风控状态 → 决定是否弹出干预
// 统一使用 L0-L4 五级干预体系（对应 riskConfig.ts §6.4）
//   L0=正常  L1=轻提醒(toast)  L2=正式警告(modal)
//   L3=强警告(fullscreen)  L4=强制干预(forced+blocking)
// 冷却机制防止频繁打扰
// ============================================================

import type { FMMetrics, SessionPlan } from '../types/fundManager';
import type { EmotionLevel, ETPResult } from './emotionEngine';
import type { InterventionLevel, EvaluationResult } from '../types/riskConfig';

// Re-export for backward compatibility
export type { InterventionLevel };
export type InterventionUIMode = 'none' | 'toast' | 'modal' | 'fullscreen' | 'forced';

// ── 干预动作按钮 ──
export interface InterventionAction {
  key: string;
  text: string;
}

// ── 干预结果 ──
export interface InterventionResult {
  triggered: boolean;
  level: InterventionLevel;
  ui_mode: InterventionUIMode;
  title: string;
  message: string;
  actions: InterventionAction[];
  trigger_type: string;   // 触发原因分类，用于记录到 session_interventions
  pool_key: string;       // 消息池 key，用于记录
}

// ── 上次干预记录 ──
export interface LastIntervention {
  level: InterventionLevel;
  timestamp: number;      // Date.now()
  trigger_type: string;
}

// ── 冷却时间（毫秒） ──
const COOLDOWNS: Record<InterventionLevel, number> = {
  L0: 0,              // 正常无冷却
  L1: 90_000,         // 90 秒
  L2: 180_000,        // 180 秒
  L3: 300_000,        // 300 秒
  L4: 600_000,        // 600 秒
};

const LEVEL_ORDER: Record<InterventionLevel, number> = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4 };
// ── UI 模式映射 ──
const UI_MODES: Record<InterventionLevel, InterventionUIMode> = {
  L0: 'none',
  L1: 'toast',
  L2: 'modal',
  L3: 'fullscreen',
  L4: 'forced',
};

// ============================================================
// 消息池 — 每类至少 3 条，随机选取
// ============================================================

interface MessagePoolEntry {
  title: string;
  messages: string[];
  actions: InterventionAction[];
}

const MESSAGE_POOL: Record<string, MessagePoolEntry> = {
  // ── 连输后加码提醒（moderate） ──
  tilt_betting: {
    title: '注意：亏损区加码',
    messages: [
      '你刚输了 {lossStreak} 手，码量却在涨。这不是策略，是情绪在操作。',
      '连输后加码是最容易失控的操作。先停下来，看看你的计划写了什么。',
      '你的码量已经是基码的 {betMultiple} 倍。输钱时加码，越加越深。',
    ],
    actions: [
      { key: 'open_rules', text: '查看我的规则' },
      { key: 'reset_bet', text: '恢复基码' },
      { key: 'continue', text: '我知道了' },
    ],
  },

  // ── 接近止损提醒（moderate） ──
  near_stoploss: {
    title: '接近止损线',
    messages: [
      '你距止损只剩 {distanceToStopLoss} 了。你一开始说好的是到了就走。',
      '止损线快到了。现在是最考验纪律的时刻，也是最容易犯错的时刻。',
      '还剩 {distanceToStopLoss} 就触发止损。要不要现在就按计划收手？',
    ],
    actions: [
      { key: 'end_session', text: '按计划离场' },
      { key: 'open_rules', text: '看一眼规则' },
      { key: 'continue', text: '继续观察' },
    ],
  },

  // ── ④ 情绪转折点（moderate） ──
  turning_point: {
    title: '你已到达情绪转折点',
    messages: [
      '你到达了情绪转折点。从这里开始，继续下去的每一手都在考验你的纪律。建议暂停5分钟冷静一下。',
      '情绪转折点已触发。过去的经验告诉我们，这个节点最容易失控。先停下来，看看你的计划。',
      '你的情绪指标刚刚越过临界线。现在暂停，是保护自己最好的选择。',
    ],
    actions: [
      { key: 'pause', text: '暂停 5 分钟' },
      { key: 'open_rules', text: '查看我的计划' },
      { key: 'continue', text: '我了解，继续' },
    ],
  },

  // ── 严重失控警告（severe — 情绪分数超标） ──
  severe_tilt: {
    title: '严重警告',
    messages: [
      '停一下。你一开始说好的是输 {stopLoss} 就走。现在已经到了。',
      '这不是你定的计划。你现在在靠感觉打。你带了 {budget}，还剩 {balance}。',
      '你已经连输 {lossStreak} 手，码量还在涨。这场需要暂停。',
    ],
    actions: [
      { key: 'end_session', text: '结束这场' },
      { key: 'helper_mode', text: '开启陪护模式' },
      { key: 'continue', text: '我再打几手' },
    ],
  },

  // ── ⑤ 上头临界点（severe — ETP critical） ──
  tilt_critical: {
    title: '上头临界点',
    messages: [
      '你在情绪转折点后没有停手，并且出现了违规操作。你现在正在上头的边缘——再继续就是整场失控。',
      '从转折点到现在，你的码量在涨、亏损在扩大。这是你最后的窗口——停下来，还来得及。',
      '你带了 {budget}，还剩 {balance}。你已经越过转折点还在加码。这是上头的典型信号。',
    ],
    actions: [
      { key: 'end_session', text: '立即停手' },
      { key: 'pause', text: '暂停冷静' },
      { key: 'continue', text: '我清楚风险，继续' },
    ],
  },

  // ── ⑥ 整场失控（severe — ETP collapsed） ──
  etp_collapsed: {
    title: '整场失控',
    messages: [
      '整场已经失控。你带了 {budget}，还剩 {balance}。继续下去的结果你知道。停下来。',
      '从转折点到上头到现在——你的每一手都在偏离计划。这不是运气问题，是状态问题。必须停下来。',
      '你现在的状态就是赌场最喜欢的玩家。不要再给他们机会了——立即离场。',
    ],
    actions: [
      { key: 'end_session', text: '结束本场' },
      { key: 'pause', text: '强制冷静 60 秒' },
    ],
  },

  // ── 超时提醒（mild） ──
  overtime: {
    title: '时间提醒',
    messages: [
      '你的计划时间到了。赢的人知道什么时候离桌。',
      '已经超出计划时长了。多打的每一手，纪律都在打折。',
      '时间到了。你当初定计划的时候头脑最清醒——相信那时的自己。',
    ],
    actions: [
      { key: 'end_session', text: '准备离场' },
      { key: 'continue', text: '再打 10 分钟' },
    ],
  },

  // ── 盈利回吐警告（moderate） ──
  profit_giveback: {
    title: '盈利在回吐',
    messages: [
      '你从最高点回撤了 {drawdown}。盈利正在快速流失。',
      '你已经回吐了 {givebackRate}% 的盈利。再不锁，就全还回去了。',
      '赢了不走，等于没赢。你的锁盈线在那里是有道理的。',
    ],
    actions: [
      { key: 'end_session', text: '落袋为安' },
      { key: 'open_rules', text: '查看锁盈线' },
      { key: 'continue', text: '继续观察' },
    ],
  },

  // ── 注码波动（mild） ──
  bet_volatility: {
    title: '注码不稳',
    messages: [
      '你的码量忽大忽小，这通常意味着情绪在波动。',
      '稳定的码量 = 稳定的心态。你现在的注码变化有点大了。',
      '你的注码波动率偏高。回到基码，先稳住节奏。',
    ],
    actions: [
      { key: 'reset_bet', text: '恢复基码' },
      { key: 'continue', text: '我知道了' },
    ],
  },

  // ── 即时自检建议（moderate） ──
  self_check_recommended: {
    title: '建议即时自检',
    messages: [
      '你已经连输 {lossStreak} 手了。暂停一下，做个自检——确认你的身体和情绪还在线。',
      '打了 {elapsed} 分钟了，情绪指标在波动。花 30 秒做个自检，比盲目继续值。',
      '系统检测到多项变化信号。你现在的状态适合继续吗？做个自检看看。',
    ],
    actions: [
      { key: 'start_self_check', text: '🛡️ 立即自检' },
      { key: 'continue', text: '我没问题' },
    ],
  },

  // ── 止损触发（severe） ──
  stoploss_hit: {
    title: '止损触发',
    messages: [
      '止损线到了。这是你清醒时给自己定的底线——遵守它。',
      '你的止损金额已经触发。计划就是用来这个时候执行的。',
      '到止损了。走，是今天最赚的一手。',
    ],
    actions: [
      { key: 'end_session', text: '执行止损离场' },
      { key: 'continue', text: '我要继续' },
    ],
  },

  // ============================================================
  // v1.2 新增消息池 — 三维引擎专用
  // ============================================================

  // ── L4 强制离场 ──
  forced_leave: {
    title: '强制离场',
    messages: [
      '你已触发多重警告。系统判定继续下去风险极高——请立即离场。',
      '所有指标都在亮红灯。你带了 {budget}，还剩 {balance}。现在走是唯一正确的选择。',
      '这不是建议，是紧急制动。你的状态已经不适合继续——立即离开赌桌。',
    ],
    actions: [
      { key: 'end_session', text: '立即离场' },
      { key: 'forced_ack', text: '我理解风险' },
    ],
  },

  // ── 高压疲劳组合 ──
  poison_fatigue: {
    title: '高压疲劳警告',
    messages: [
      '你已经打了 {elapsed} 分钟，期间经历过激烈缠斗，现在还在亏损。三重压力叠加，判断力在下降。',
      '长时间 + 缠斗记忆 + 亏损——这是最容易做出错误决定的状态。建议暂停。',
      '你的身体和大脑都在疲劳区间了。缠斗消耗的精力不会因为暂时好转就恢复。',
    ],
    actions: [
      { key: 'end_session', text: '今天到此为止' },
      { key: 'pause', text: '暂停休息' },
      { key: 'continue', text: '我清楚，继续' },
    ],
  },

  // ── 顺风转折组合 ──
  poison_momentum: {
    title: '顺风转折警告',
    messages: [
      '你之前连赢了好几手，但现在风向变了。最危险的不是输——是你还以为自己"手感好"。',
      '连赢后的连输是最难接受的。你可能觉得"运气还在"——但数据说不在了。',
      '从连赢到连输，心理落差最大。这个时候最容易追损。先停下来看看全局。',
    ],
    actions: [
      { key: 'end_session', text: '见好就收' },
      { key: 'open_rules', text: '查看计划' },
      { key: 'continue', text: '我理解，继续' },
    ],
  },

  // ── 锁盈激活 ──
  profit_lock_activated: {
    title: '锁盈已激活',
    messages: [
      '你已经盈利达标！系统已启动锁盈保护。从现在起，容错空间会收紧。',
      '恭喜，盈利达到锁盈线！接下来系统会更敏感地保护你的利润。',
      '锁盈激活。你赚到的每一分钱都值得保护——系统已经在帮你盯着。',
    ],
    actions: [
      { key: 'end_session', text: '落袋为安' },
      { key: 'continue', text: '继续，我会小心' },
    ],
  },

  // ── 锁盈回撤 ──
  profit_lock_drawdown: {
    title: '利润大幅回撤',
    messages: [
      '你的利润从峰值回撤超过警戒线了。赢了不走，等于没赢。',
      '从最高点回撤了很多。你之前赚到的正在还回去——现在走还来得及。',
      '利润回撤严重。你辛苦赢来的筹码正在流失，建议立即止盈离场。',
    ],
    actions: [
      { key: 'end_session', text: '止盈离场' },
      { key: 'continue', text: '再观察' },
    ],
  },

  // ── 接近预警 ──
  approaching_limit: {
    title: '接近防线',
    messages: [
      '你距离防线只差一步了。下一手如果再输，就会触发关键时刻。',
      '快到限制了。现在是调整策略的最后窗口——要不要降码或暂停？',
      '接近防线。你当初定这条线是有道理的——提前准备好应对方案。',
    ],
    actions: [
      { key: 'reset_bet', text: '降回基码' },
      { key: 'open_rules', text: '查看规则' },
      { key: 'continue', text: '我知道了' },
    ],
  },

  // ── 连输后加注 ──
  streak2_raise: {
    title: '连输后加注警告',
    messages: [
      '你已经连输 {lossStreak} 手，但注码反而在涨。这是追损的典型信号。',
      '连输后加注是最危险的操作——你在用更大的筹码去追回亏损。停下来想想。',
      '输了还加？这不是策略调整，这是情绪在驱动。回到基码，先稳住。',
    ],
    actions: [
      { key: 'reset_bet', text: '恢复基码' },
      { key: 'pause', text: '暂停冷静' },
      { key: 'continue', text: '我清楚风险' },
    ],
  },

  // ============================================================
  // v1.3 全景场景覆盖 — 单指标专属消息池
  // 每个关键时刻/接近预警都有独立话术，不再共用通用池
  // ============================================================

  // ── 连输接近（再输1手就到防线）──
  streak_approaching: {
    title: '连输接近防线',
    messages: [
      '你已经连输 {lossStreak} 手了，再输1手就触及防线。现在是调整的最后窗口。',
      '连输 {lossStreak} 手，距防线只差1手。要不要降回基码，给自己留点缓冲？',
      '快到连输防线了。你当初设这条线是有道理的——提前想好下一手怎么应对。',
    ],
    actions: [
      { key: 'reset_bet', text: '降回基码' },
      { key: 'open_rules', text: '看一眼规则' },
      { key: 'continue', text: '我知道了' },
    ],
  },

  // ── 连输触发（到防线了）──
  streak_critical: {
    title: '连输触及防线',
    messages: [
      '连输 {lossStreak} 手，你自己定的防线到了。这不是运气差——是该暂停的信号。',
      '连输防线已触发。你带了 {budget}，还剩 {balance}。坚持纪律就是最好的策略。',
      '你说好连输到这里就停。现在就是那个时刻——遵守自己的承诺。',
    ],
    actions: [
      { key: 'end_session', text: '按计划停手' },
      { key: 'pause', text: '暂停5分钟' },
      { key: 'continue', text: '我要继续' },
    ],
  },

  // ── 净输接近 ──
  net_loss_approaching: {
    title: '净输接近防线',
    messages: [
      '净输已经 {netLoss} 手了，快到防线。虽然中间赢过几手，但整体在亏。',
      '净输接近防线。这种锯齿式亏损最容易被忽略——因为你觉得"还在赢"。',
      '净输 {netLoss} 手，离防线很近了。不要被中间的小赢迷惑，看总账。',
    ],
    actions: [
      { key: 'open_rules', text: '查看总账' },
      { key: 'reset_bet', text: '降码观察' },
      { key: 'continue', text: '继续观察' },
    ],
  },

  // ── 净输触发 ──
  net_loss_critical: {
    title: '净输触及防线',
    messages: [
      '净输 {netLoss} 手，防线到了。赢的手数填不回亏的金额——这是事实。',
      '净输防线触发。你可能觉得"赢了几手应该还好"——但总账说你该走了。',
      '总输减总赢 = {netLoss} 手，已到防线。继续下去只会让总账更难看。',
    ],
    actions: [
      { key: 'end_session', text: '按计划离场' },
      { key: 'pause', text: '暂停评估' },
      { key: 'continue', text: '我要继续' },
    ],
  },

  // ── 缠斗接近 ──
  grind_approaching: {
    title: '缠斗手数偏多',
    messages: [
      '你已经在缠斗区间打了 {grindHands} 手了，赢赢输输但总账没动。这很消耗精力。',
      '缠斗 {grindHands} 手，净盈亏几乎为零。你在用时间和精力换来……原地踏步。',
      '长时间缠斗最消耗判断力——你感觉还行，但其实已经在走下坡路了。',
    ],
    actions: [
      { key: 'pause', text: '暂停休息' },
      { key: 'open_rules', text: '看看计划' },
      { key: 'continue', text: '继续观察' },
    ],
  },

  // ── 缠斗触发 ──
  grind_critical: {
    title: '缠斗达到极限',
    messages: [
      '缠斗 {grindHands} 手了，这已经到了你计划的极限。再磨下去只会更累、更容易犯错。',
      '缠斗到极限了。你以为再多打几手能突破——但数据说你只是在消耗。',
      '缠斗 {grindHands} 手，净赚接近零。你的时间、精力都花了，不如换桌或离场。',
    ],
    actions: [
      { key: 'end_session', text: '结束这场' },
      { key: 'pause', text: '休息10分钟' },
      { key: 'continue', text: '我再观察' },
    ],
  },

  // ============================================================
  // v1.3 全景场景覆盖 — 双指标组合消息池
  // ============================================================

  // ── #18 追损螺旋：连输≥3 + 加码 + 亏损扩大 ──
  poison_chase: {
    title: '追损螺旋',
    messages: [
      '连输 {lossStreak} 手还在加码，亏损已达 {pnlAbs}。你在用更大的筹码追回亏损——这是赌场最喜欢的玩家行为。',
      '连输+加码+亏损扩大，三重信号同时亮红灯。你不是在策略调整，是在情绪驱动。立即恢复基码。',
      '每多输一手你就加一码——这个螺旋下去只有一个结果。停下来，看你的计划。',
    ],
    actions: [
      { key: 'reset_bet', text: '恢复基码' },
      { key: 'end_session', text: '立即停手' },
      { key: 'continue', text: '我清楚风险' },
    ],
  },

  // ── #19 疲劳回吐：时间≥80% + 盈利回吐>50% ──
  poison_fatigue_giveback: {
    title: '疲劳回吐',
    messages: [
      '打了 {elapsed} 分钟，盈利已经回吐 {givebackRate}%。你的判断力在下降，利润在流失——两件事同时发生。',
      '时间快到了，利润也快没了。你带着盈利打到现在，却要两手空空离开吗？',
      '疲劳+回吐是最隐蔽的组合——你感觉还能打，但数据说你已经在还钱了。',
    ],
    actions: [
      { key: 'end_session', text: '落袋为安' },
      { key: 'pause', text: '暂停评估' },
      { key: 'continue', text: '再观察' },
    ],
  },

  // ── #20 拐点上头：盈利转亏 + 立刻加码 ──
  poison_pivot_tilt: {
    title: '盈利转亏拐点',
    messages: [
      '你从盈利变成亏损，而且立刻加码了。这是最危险的心态拐点——你在试图立刻翻回来。',
      '从赚钱到亏钱的落差最容易让人上头。你刚才的加码就是证据。冷静下来。',
      '盈利转负+加码=追损的起点。现在止住，还只是亏了一点。继续下去可能清袋。',
    ],
    actions: [
      { key: 'reset_bet', text: '恢复基码' },
      { key: 'end_session', text: '立即离场' },
      { key: 'continue', text: '我清楚，继续' },
    ],
  },

  // ── #21 锁盈恐慌：锁盈后连输 + 加码 ──
  poison_lock_panic: {
    title: '锁盈后恐慌',
    messages: [
      '系统已经帮你锁住利润，但你连输 {lossStreak} 手后开始加码。你在用恐慌对抗保护机制。',
      '锁盈的意义是保护利润。你现在的操作正在瓦解这道保护线——停下来，想想你为什么设了这条线。',
      '盈利锁定后的连输最考验纪律。加码不会帮你赢回来，只会让保护线更快被击穿。',
    ],
    actions: [
      { key: 'reset_bet', text: '恢复基码' },
      { key: 'end_session', text: '保住利润' },
      { key: 'continue', text: '我清楚风险' },
    ],
  },

  // ── #22 连输+疲劳：连输≥2 + 时间75%+ ──
  poison_streak_time: {
    title: '连输+疲劳',
    messages: [
      '已经打了 {elapsed} 分钟，现在还在连输 {lossStreak} 手。疲劳会放大连输的心理冲击。',
      '时间已过 {timePercent}%，连输还在继续。你现在做的决定不如刚开始时理性——这是事实。',
      '长时间+连输=判断力最差的时候。你不是手气差，是体力和注意力都在透支。',
    ],
    actions: [
      { key: 'end_session', text: '今天到此为止' },
      { key: 'pause', text: '暂停休息' },
      { key: 'continue', text: '我清楚，继续' },
    ],
  },

  // ── #23 净输+疲劳：净输≥2 + 时间75%+ ──
  poison_netloss_time: {
    title: '净输+疲劳',
    messages: [
      '打了 {elapsed} 分钟，净输 {netLoss} 手。长时间的净亏损说明今天的桌况不适合你。',
      '时间过了 {timePercent}%，净输还在扩大。你在这张桌上花的时间越多，亏得越多。',
      '净亏损+长时间=该换战场了。继续磨下去不会改变今天的结果。',
    ],
    actions: [
      { key: 'end_session', text: '换桌或离场' },
      { key: 'pause', text: '暂停思考' },
      { key: 'continue', text: '继续观察' },
    ],
  },

  // ── #24 净输+追损：净输≥2 + 输后加注 ──
  poison_netloss_raise: {
    title: '净输+追损',
    messages: [
      '净输 {netLoss} 手了还在加码。你在用更大的赌注弥补整场的亏损——这只会让洞越来越大。',
      '总账在亏，注码在涨。你不是在调整策略，你是在跟自己的亏损较劲。',
      '净输时加码是最隐蔽的追损——因为你中间赢过几手，觉得"还有机会"。但总账不会骗你。',
    ],
    actions: [
      { key: 'reset_bet', text: '恢复基码' },
      { key: 'open_rules', text: '看总账' },
      { key: 'continue', text: '我知道了' },
    ],
  },

  // ── #25 连输+缠斗：连输中 + 正在缠斗 ──
  poison_streak_grind: {
    title: '连输+缠斗',
    messages: [
      '你在缠斗中连输了 {lossStreak} 手。缠斗本来就消耗精力，连输更让你急着想翻盘。',
      '缠斗 {grindHands} 手+连输 {lossStreak} 手——你被困在一个既磨人又亏钱的循环里。',
      '缠斗中连输是最容易冲动加码的场景。保持基码，别让焦虑替你做决定。',
    ],
    actions: [
      { key: 'reset_bet', text: '保持基码' },
      { key: 'end_session', text: '换桌或离场' },
      { key: 'continue', text: '继续观察' },
    ],
  },

  // ── #26 缠斗+加码：缠斗中 + 输后加注 ──
  poison_grind_raise: {
    title: '缠斗中加码',
    messages: [
      '缠斗 {grindHands} 手了还在加码——你想用大注打破僵局？缠斗局加码只会放大亏损。',
      '在缠斗中加码是最常见的失控起点。你以为是在"突破"，其实是在"赌气"。',
      '缠斗中加码 = 消耗精力 + 放大风险。保持基码，让概率替你工作。',
    ],
    actions: [
      { key: 'reset_bet', text: '恢复基码' },
      { key: 'pause', text: '暂停冷静' },
      { key: 'continue', text: '我清楚风险' },
    ],
  },

  // ── #27 止损接近+加码：距止损不足30% + 输后加注 → L4 ──
  poison_stoploss_raise: {
    title: '紧急：止损前加码',
    messages: [
      '距离止损只剩一点点了，你还在加码！这是最危险的操作——一手就可能穿透止损线。',
      '止损近在眼前 + 加码 = 灾难组合。你现在不是在翻盘，是在加速输光。',
      '还剩 {distanceToStopLoss} 就止损，码量却在涨。你在拿最后的筹码赌命。立即停手。',
    ],
    actions: [
      { key: 'end_session', text: '立即止损' },
      { key: 'reset_bet', text: '恢复基码' },
    ],
  },

  // ── #28 净输+缠斗：净输≥2 + 正在缠斗 ──
  poison_netloss_grind: {
    title: '净输+缠斗',
    messages: [
      '净输 {netLoss} 手，还在缠斗区间磨。你在用时间和精力换来的只是更深的亏损。',
      '缠斗 {grindHands} 手 + 净输 {netLoss} 手——你以为在"等机会"，其实在"耗资源"。',
      '缠斗+净亏损=消耗战。你在这场消耗战里不占优势，建议换桌或离场。',
    ],
    actions: [
      { key: 'end_session', text: '换桌或离场' },
      { key: 'pause', text: '暂停休息' },
      { key: 'continue', text: '继续观察' },
    ],
  },

  // ── #29 时间+加码：时间75%+ + 输后加注 ──
  poison_time_raise: {
    title: '疲劳+加码',
    messages: [
      '时间已过 {timePercent}%，你还在加码。疲劳让你高估自己的判断力——回到基码。',
      '打了 {elapsed} 分钟了还在涨码。越到后面越容易冲动，你现在的加码可能不是深思熟虑的。',
      '疲劳时加码=用最差的状态下最大的注。恢复基码，别在最后关头翻车。',
    ],
    actions: [
      { key: 'reset_bet', text: '恢复基码' },
      { key: 'end_session', text: '准备离场' },
      { key: 'continue', text: '我知道了' },
    ],
  },

  // ============================================================
  // v1.3 三维/多维组合消息池
  // ============================================================

  // ── #32 多维压力叠加：净输接近 + 连输中 + 时间50%+ ──
  poison_multi_pressure: {
    title: '多维压力叠加',
    messages: [
      '净输接近防线、连输还在继续、时间也过半了。三重压力叠加，你的决策质量在急剧下降。',
      '多个指标同时逼近极限——这不是巧合，是整体状态在恶化。建议立即暂停评估。',
      '净输 {netLoss} 手、连输 {lossStreak} 手、已打 {elapsed} 分钟。单看每个不算致命，但叠在一起就是高危信号。',
    ],
    actions: [
      { key: 'end_session', text: '立即暂停' },
      { key: 'pause', text: '暂停评估' },
      { key: 'continue', text: '我清楚风险' },
    ],
  },

  // ── #33 缠斗绝望：缠斗极限 + 亏损 + 时间60%+ ──
  poison_grind_despair: {
    title: '缠斗绝望',
    messages: [
      '你已经缠斗 {grindHands} 手了，还在亏损区，时间也过了大半。这种磨损最消耗判断力。',
      '长时间缠斗让你以为坚持就能翻盘——但数据说你只是在消耗体力和资金。',
      '缠斗+亏损+久坐，这个组合最容易催生"一把梭哈"的冲动。建议换桌或离场。',
    ],
    actions: [
      { key: 'end_session', text: '结束这场' },
      { key: 'pause', text: '休息10分钟' },
      { key: 'continue', text: '我再观察' },
    ],
  },
};

// ============================================================
// 核心函数
// ============================================================

/**
 * 判断是否应该抑制干预（冷却中）
 * 更高等级可以覆盖低等级的冷却
 */
// ── 干预疲劳追踪 ──
let _interventionCount = 0;
let _interventionWindowStart = 0;
const FATIGUE_WINDOW = 30 * 60 * 1000; // 30分钟窗口
const FATIGUE_THRESHOLD = 5; // 5次后升级
// 前N手不触发干预弹窗（开局早期数据不稳定，防止误触发）
const MIN_HANDS_BEFORE_INTERVENTION = 5;

/** 重置干预计数器（新场次时调用） */
export function resetInterventionFatigue(): void {
  _interventionCount = 0;
  _interventionWindowStart = Date.now();
}

/** 记录一次干预触发 */
export function trackInterventionShown(): void {
  const now = Date.now();
  if (now - _interventionWindowStart > FATIGUE_WINDOW) {
    _interventionCount = 0;
    _interventionWindowStart = now;
  }
  _interventionCount++;
}

/** 检查是否达到疲劳阈值 */
export function isInterventionFatigued(): boolean {
  return _interventionCount >= FATIGUE_THRESHOLD;
}

export function shouldSuppress(
  level: InterventionLevel,
  lastIntervention: LastIntervention | null,
): boolean {
  if (!lastIntervention) return false;

  const now = Date.now();
  const elapsed = now - lastIntervention.timestamp;
  const cooldown = COOLDOWNS[level];

  // 更高等级可以覆盖低等级冷却
  if (LEVEL_ORDER[level] > LEVEL_ORDER[lastIntervention.level]) {
    return false;
  }

  return elapsed < cooldown;
}

/**
 * 评估是否需要干预
 *
 * @param metrics 当前实时指标
 * @param etpResult ETP 评估结果
 * @param sessionPlan 本场计划
 * @param lastIntervention 上次干预记录（null = 本场没干预过）
 */
export function evaluateIntervention(
  metrics: FMMetrics,
  etpResult: ETPResult,
  sessionPlan: SessionPlan,
  lastIntervention: LastIntervention | null,
): InterventionResult {
  // 按优先级从高到低检查触发条件
  let candidate = determineTrigger(metrics, etpResult, sessionPlan);

  if (!candidate) {
    return makeNoTrigger();
  }

  // 干预疲劳：如果30分钟内已弹出5+次，升级到 severe
  if (isInterventionFatigued() && LEVEL_ORDER[candidate.level] < LEVEL_ORDER['L3']) {
    candidate = {
      level: 'L3',
      triggerType: 'fatigue',
      poolKey: 'etp_collapsed', // 用崩盘消息池，语气最强
    };
  }

  // 冷却检查
  if (shouldSuppress(candidate.level, lastIntervention)) {
    return makeNoTrigger();
  }

  // 从消息池取消息
  const pool = MESSAGE_POOL[candidate.poolKey];
  if (!pool) {
    return makeNoTrigger();
  }

  // 记录干预次数（在确认消息池有效后再计数，避免幻影干预膨胀疲劳计数器）
  trackInterventionShown();

  const message = fillTemplate(
    pool.messages[Math.floor(Math.random() * pool.messages.length)],
    metrics,
    sessionPlan,
  );

  return {
    triggered: true,
    level: candidate.level,
    ui_mode: UI_MODES[candidate.level],
    title: pool.title,
    message,
    actions: pool.actions,
    trigger_type: candidate.triggerType,
    pool_key: candidate.poolKey,
  };
}

// ── 内部：判断触发条件和等级 ──
interface TriggerCandidate {
  level: InterventionLevel;
  triggerType: string;
  poolKey: string;
}

function determineTrigger(
  metrics: FMMetrics,
  etpResult: ETPResult,
  plan: SessionPlan,
): TriggerCandidate | null {
  const tiltLevel = scoreTiltLevel(metrics);

  // ══════════════════════════════════════════════
  // ⑥ 整场失控 (collapsed) → SEVERE 全屏遮罩
  // ══════════════════════════════════════════════

  // 止损触发
  if (plan.stop_loss_amount > 0 && metrics.distance_to_stop_loss <= 0) {
    return { level: 'L3', triggerType: 'stoploss', poolKey: 'stoploss_hit' };
  }

  // ETP collapsed = 整场失控
  if (etpResult.etpState === 'collapsed') {
    return { level: 'L3', triggerType: 'turning_point', poolKey: 'etp_collapsed' };
  }

  // 情绪分 severe
  if (tiltLevel === 'severe') {
    return { level: 'L3', triggerType: 'tilt', poolKey: 'severe_tilt' };
  }

  // ══════════════════════════════════════════════
  // ⑤ 上头临界点 (critical) → SEVERE 大屏弹窗
  // ══════════════════════════════════════════════

  if (etpResult.etpState === 'critical') {
    return { level: 'L3', triggerType: 'turning_point', poolKey: 'tilt_critical' };
  }

  // ══════════════════════════════════════════════
  // ④ 情绪转折点 (triggered) → MODERATE 半屏弹窗
  // ══════════════════════════════════════════════

  if (etpResult.etpState === 'triggered') {
    return { level: 'L2', triggerType: 'turning_point', poolKey: 'turning_point' };
  }

  // ══════════════════════════════════════════════
  // ③ 接近触发 (elevated) → MODERATE 浮条/建议自检
  // ══════════════════════════════════════════════

  if (etpResult.etpState === 'elevated') {
    // 接近止损
    if (plan.stop_loss_amount > 0) {
      const distRatio = metrics.distance_to_stop_loss / plan.stop_loss_amount;
      if (distRatio < 0.3) {
        return { level: 'L2', triggerType: 'drawdown', poolKey: 'near_stoploss' };
      }
    }
    // 建议自检
    return { level: 'L2', triggerType: 'self_check', poolKey: 'self_check_recommended' };
  }

  // tilt_level moderate（情绪分高但 ETP 还没到 elevated）
  if (tiltLevel === 'moderate') {
    if (metrics.net_pnl < 0 && metrics.current_bet_unit > plan.base_unit * 1.3) {
      return { level: 'L2', triggerType: 'tilt', poolKey: 'tilt_betting' };
    }
    if (plan.stop_loss_amount > 0 && metrics.distance_to_stop_loss / plan.stop_loss_amount < 0.3) {
      return { level: 'L2', triggerType: 'drawdown', poolKey: 'near_stoploss' };
    }
    if (metrics.profit_giveback_rate > 50 && metrics.highest_profit > 0) {
      return { level: 'L2', triggerType: 'drawdown', poolKey: 'profit_giveback' };
    }
    return { level: 'L2', triggerType: 'self_check', poolKey: 'self_check_recommended' };
  }

  // 连输4+手 建议自检
  if (metrics.current_loss_streak >= 4 && tiltLevel === 'mild') {
    return { level: 'L2', triggerType: 'self_check', poolKey: 'self_check_recommended' };
  }

  // ══════════════════════════════════════════════
  // ② 波动 (rising) → MILD 底部浮条
  // ══════════════════════════════════════════════

  if (etpResult.etpState === 'rising') {
    return { level: 'L1', triggerType: 'turning_point', poolKey: 'bet_volatility' };
  }

  // 超时 → L3 重度（规格书v1.2：时间60分=L3，继续下注=L4）
  if (metrics.remaining_minutes <= 0 && plan.max_duration_minutes > 0) {
    return { level: 'L3', triggerType: 'overtime', poolKey: 'overtime' };
  }

  // tilt_level mild
  if (tiltLevel === 'mild') {
    return { level: 'L1', triggerType: 'tilt', poolKey: 'bet_volatility' };
  }

  // ══════════════════════════════════════════════
  // ① 正常 (normal) → 无干预
  // ══════════════════════════════════════════════

  return null;
}

// ── 从 metrics 推断 tilt level ──
function scoreTiltLevel(metrics: FMMetrics): EmotionLevel {
  const score = metrics.tilt_score_snapshot ?? 0;
  if (score <= 30) return 'calm';
  if (score <= 50) return 'mild';
  if (score <= 75) return 'moderate';
  return 'severe';
}

// ── 模板变量替换 ──
function fillTemplate(template: string, metrics: FMMetrics, plan: SessionPlan): string {
  const maxTime = plan.max_duration_minutes || 60;
  const timePercent = Math.round((metrics.elapsed_minutes / maxTime) * 100);
  const betMultiple = Math.round((metrics.current_bet_unit / Math.max(1, plan.base_unit)) * 10) / 10;
  return template
    .replaceAll('{lossStreak}', String(metrics.current_loss_streak))
    .replaceAll('{betMultiple}', String(betMultiple))
    .replaceAll('{distanceToStopLoss}', String(metrics.distance_to_stop_loss))
    .replaceAll('{drawdown}', String(metrics.drawdown_from_peak))
    .replaceAll('{givebackRate}', String(Math.round(metrics.profit_giveback_rate)))
    .replaceAll('{stopLoss}', String(plan.stop_loss_amount))
    .replaceAll('{budget}', String(plan.session_budget))
    .replaceAll('{balance}', String(metrics.current_balance))
    .replaceAll('{elapsed}', String(Math.floor(metrics.elapsed_minutes)))
    .replaceAll('{netLoss}', String(metrics.net_loss_hands ?? 0))
    .replaceAll('{pnlAbs}', String(Math.abs(metrics.net_pnl ?? 0)))
    .replaceAll('{timePercent}', String(timePercent))
    .replaceAll('{grindHands}', String(metrics.total_hands));
}

// ============================================================
// v1.2 三维引擎 → 干预评估
// 从 EvaluationResult 直接生成干预，不走旧 ETP 通道
// 优先级规则：三维引擎结果 > ETP 结果，取更高级别
// ============================================================

/**
 * 从三维引擎的 EvaluationResult 生成干预
 * 这是 v1.2 的核心入口——三维引擎已经做了所有判断，
 * 这里只需要：选消息池 + 冷却检查 + 组装结果
 */
export function evaluateInterventionFromRisk(
  riskResult: EvaluationResult,
  metrics: FMMetrics,
  sessionPlan: SessionPlan,
  lastIntervention: LastIntervention | null,
): InterventionResult {
  const level = riskResult.interventionLevel;

  // L0 = 不干预
  if (level === 'L0') return makeNoTrigger();

  // 开局保护期：前N手不触发干预弹窗
  if (metrics.total_hands < MIN_HANDS_BEFORE_INTERVENTION) return makeNoTrigger();

  // 选择消息池（基于触发来源）
  const { poolKey, triggerType } = selectPoolFromRisk(riskResult);

  // 冷却检查
  if (shouldSuppress(level, lastIntervention)) {
    return makeNoTrigger();
  }

  const pool = MESSAGE_POOL[poolKey];
  if (!pool) return makeNoTrigger();

  // 记录干预次数
  trackInterventionShown();

  const message = fillTemplate(
    pool.messages[Math.floor(Math.random() * pool.messages.length)],
    metrics,
    sessionPlan,
  );

  return {
    triggered: true,
    level,
    ui_mode: UI_MODES[level],
    title: pool.title,
    message,
    actions: pool.actions,
    trigger_type: triggerType,
    pool_key: poolKey,
  };
}

/**
 * 从 EvaluationResult 选择最匹配的消息池
 *
 * 场景优先级路由（从最危险到最轻）：
 *   L4强制 > L4组合(stoploss_raise) > 三维组合 > 双维组合
 *   > 锁盈 > 关键时刻 > 接近预警 > 通用兜底
 *
 * 原则：优先选最具体的场景，而不是通用消息
 */
function selectPoolFromRisk(result: EvaluationResult): { poolKey: string; triggerType: string } {
  const combos = result.toxicCombos;
  const moments = result.keyMoments;

  // ════════════════════════════════════════════
  // 第一层：L4 级别（强制干预）
  // ════════════════════════════════════════════

  if (result.interventionLevel === 'L4') {
    // L4 中最具体的场景：止损接近+加码
    if (combos.includes('stoploss_raise')) {
      return { poolKey: 'poison_stoploss_raise', triggerType: 'toxic_combo' };
    }
    return { poolKey: 'forced_leave', triggerType: 'forced_leave' };
  }

  // ════════════════════════════════════════════
  // 第二层：三维/多维组合（最复杂的场景）
  // ════════════════════════════════════════════

  if (combos.includes('fatigue_pressure')) {
    return { poolKey: 'poison_fatigue', triggerType: 'toxic_combo' };
  }
  if (combos.includes('momentum_reversal')) {
    return { poolKey: 'poison_momentum', triggerType: 'toxic_combo' };
  }
  if (combos.includes('multi_pressure')) {
    return { poolKey: 'poison_multi_pressure', triggerType: 'toxic_combo' };
  }
  if (combos.includes('grind_despair')) {
    return { poolKey: 'poison_grind_despair', triggerType: 'toxic_combo' };
  }

  // ════════════════════════════════════════════
  // 第三层：双指标组合（追损类优先）
  // ════════════════════════════════════════════

  // 追损类（最危险的行为模式）
  if (combos.includes('chase_spiral')) {
    return { poolKey: 'poison_chase', triggerType: 'toxic_combo' };
  }
  if (combos.includes('lock_panic')) {
    return { poolKey: 'poison_lock_panic', triggerType: 'toxic_combo' };
  }
  if (combos.includes('pivot_tilt')) {
    return { poolKey: 'poison_pivot_tilt', triggerType: 'toxic_combo' };
  }
  if (combos.includes('netloss_raise')) {
    return { poolKey: 'poison_netloss_raise', triggerType: 'toxic_combo' };
  }

  // 缠斗类组合
  if (combos.includes('streak_grind')) {
    return { poolKey: 'poison_streak_grind', triggerType: 'toxic_combo' };
  }
  if (combos.includes('netloss_grind')) {
    return { poolKey: 'poison_netloss_grind', triggerType: 'toxic_combo' };
  }
  if (combos.includes('grind_raise')) {
    return { poolKey: 'poison_grind_raise', triggerType: 'toxic_combo' };
  }

  // 疲劳类组合
  if (combos.includes('fatigue_giveback')) {
    return { poolKey: 'poison_fatigue_giveback', triggerType: 'toxic_combo' };
  }
  if (combos.includes('streak_time')) {
    return { poolKey: 'poison_streak_time', triggerType: 'toxic_combo' };
  }
  if (combos.includes('netloss_time')) {
    return { poolKey: 'poison_netloss_time', triggerType: 'toxic_combo' };
  }
  if (combos.includes('time_raise')) {
    return { poolKey: 'poison_time_raise', triggerType: 'toxic_combo' };
  }

  // ════════════════════════════════════════════
  // 第四层：锁盈相关
  // ════════════════════════════════════════════

  if (result.profitLockStage >= 3) {
    return { poolKey: 'profit_lock_drawdown', triggerType: 'profit_lock' };
  }
  if ((result.profitLockStage === 1 || result.profitLockStage === 2) &&
      result.interventionLevel === 'L1') {
    return { poolKey: 'profit_lock_activated', triggerType: 'profit_lock' };
  }

  // ════════════════════════════════════════════
  // 第五层：单指标关键时刻（各自专属消息池）
  // ════════════════════════════════════════════

  if (moments.includes('streak2_raise')) {
    return { poolKey: 'streak2_raise', triggerType: 'key_moment' };
  }
  // 连输和净输分开 — 不再共用 stoploss_hit
  if (moments.includes('streak_limit')) {
    return { poolKey: 'streak_critical', triggerType: 'key_moment' };
  }
  if (moments.includes('net_loss_limit')) {
    return { poolKey: 'net_loss_critical', triggerType: 'key_moment' };
  }
  // 缠斗专属消息池 — 不再用 self_check_recommended
  if (moments.includes('grind')) {
    return { poolKey: 'grind_critical', triggerType: 'key_moment' };
  }
  if (moments.includes('overtime')) {
    return { poolKey: 'overtime', triggerType: 'key_moment' };
  }
  if (moments.includes('profit_gone')) {
    return { poolKey: 'profit_giveback', triggerType: 'key_moment' };
  }

  // ════════════════════════════════════════════
  // 第六层：接近预警（各自专属消息池）
  // ════════════════════════════════════════════

  if (result.interventionSource.includes('连输接近')) {
    return { poolKey: 'streak_approaching', triggerType: 'approaching' };
  }
  if (result.interventionSource.includes('净输接近')) {
    return { poolKey: 'net_loss_approaching', triggerType: 'approaching' };
  }
  if (result.interventionSource.includes('缠斗手数')) {
    return { poolKey: 'grind_approaching', triggerType: 'approaching' };
  }
  // 锁盈后首次亏损
  if (result.interventionSource.includes('锁盈后')) {
    return { poolKey: 'profit_lock_activated', triggerType: 'approaching' };
  }
  // 通用接近
  if (result.interventionSource.includes('接近')) {
    return { poolKey: 'approaching_limit', triggerType: 'approaching' };
  }

  // ════════════════════════════════════════════
  // 第七层：通用兜底（按风险级别分流）
  // ════════════════════════════════════════════

  if (result.interventionLevel === 'L3') {
    return { poolKey: 'severe_tilt', triggerType: 'risk_evaluation' };
  }
  if (result.interventionLevel === 'L2') {
    // 接近止损时用专属消息
    if (result.interventionSource.includes('资金缓冲区')) {
      return { poolKey: 'near_stoploss', triggerType: 'risk_evaluation' };
    }
    return { poolKey: 'self_check_recommended', triggerType: 'risk_evaluation' };
  }
  return { poolKey: 'bet_volatility', triggerType: 'risk_evaluation' };
}

// ── 空结果 ──
function makeNoTrigger(): InterventionResult {
  return {
    triggered: false,
    level: 'L0',
    ui_mode: 'none',
    title: '',
    message: '',
    actions: [],
    trigger_type: '',
    pool_key: '',
  };
}
