// ============================================================
// 场景话术数据库 — Scene Message Pool
// 33场景 × 4话术（事实2 + 心理2）= 132条中文消息
// 设计哲学：场景是硬币，正面说事实，反面说心理
// 支持模板变量：{lossStreak} {netLoss} {elapsed} {balance}
//   {grindHands} {pnlAbs} {givebackRate} {timePercent}
//   {stopLoss} {baseBet} {betMultiple} {peakProfit}
//   {streakLimit} {netLossLimit} {consecutiveWins} {pnl}
// ============================================================

export interface SceneMessages {
  sceneId: string;
  label: string;              // 场景中文名
  level: 'L1' | 'L2' | 'L3' | 'L4';
  factMessages: [string, string];   // 事实层（看板）
  psychMessages: [string, string];  // 心理层（助手）
}

// ────────────────────────────────────────
// 一、单指标场景（17个）
// ────────────────────────────────────────

// ── 连输维度（4个） ──

const streak_approaching: SceneMessages = {
  sceneId: 'streak_approaching',
  label: '连输预警',
  level: 'L2',
  factMessages: [
    '已连输 {lossStreak} 手，距连输上限还剩1手',
    '连续 {lossStreak} 手未赢，接近你设定的连输止损线',
  ],
  psychMessages: [
    '越接近底线，"再来一把翻本"的冲动越强。这正是你最需要冷静的时候',
    '连输到这个程度，情绪已经不再中立。你接下来的判断，可能不再是理性的',
  ],
};

const streak_critical: SceneMessages = {
  sceneId: 'streak_critical',
  label: '连输触发',
  level: 'L3',
  factMessages: [
    '已连输 {lossStreak} 手，触发连输止损线',
    '连续输了 {lossStreak} 手，达到你进场前设定的上限',
  ],
  psychMessages: [
    '连输时最危险的不是输钱，是"再来一把就回本"的念头。你现在最该做的：什么都不做',
    '你的计划说到这里就该停了。现在继续打的每一手，都是在推翻清醒时的自己',
  ],
};


const stoploss_hit: SceneMessages = {
  sceneId: 'stoploss_hit',
  label: '止损触发',
  level: 'L4',
  factMessages: [
    '余额 {balance}，已触发止损线 {stopLoss}',
    '资金已降至止损线以下，累计亏损 {pnlAbs}',
  ],
  psychMessages: [
    '止损线是你清醒时给自己画的底线。突破它不叫勇气，叫失控',
    '每个大额亏损都是从"再打一把"开始的。你现在要做的，是信任清醒时的自己',
  ],
};

// ── 净输维度（3个） ──

const net_loss_approaching: SceneMessages = {
  sceneId: 'net_loss_approaching',
  label: '净输预警',
  level: 'L2',
  factMessages: [
    '净输 {netLoss} 手，距净输上限还剩1手',
    '整体已净输 {netLoss} 手，接近你设定的净输止损线',
  ],
  psychMessages: [
    '净输和连输不同——它意味着这一整场你的节奏都在被压制',
    '整体输多赢少的时候，大脑会自动开始找"翻盘"的理由。但理由越多，陷阱越深',
  ],
};

const net_loss_critical: SceneMessages = {
  sceneId: 'net_loss_critical',
  label: '净输触发',
  level: 'L3',
  factMessages: [
    '净输已达 {netLoss} 手，触发净输止损线',
    '全场净输 {netLoss} 手，到达你进场前设定的上限',
  ],
  psychMessages: [
    '净输达到上限意味着今天不是你的局。不是技术问题，是概率周期',
    '承认"今天不行"不是认输，是最需要勇气的理性决定',
  ],
};

const profit_gone: SceneMessages = {
  sceneId: 'profit_gone',
  label: '盈利转亏',
  level: 'L2',
  factMessages: [
    '你从盈利 {peakProfit} 转为当前亏损 {pnlAbs}',
    '曾经赢到 {peakProfit}，现在已经全部回吐并进入亏损',
  ],
  psychMessages: [
    '看着赢来的钱一点点还回去，比一开始就输更让人崩溃。你现在心里在想"刚才应该走的"',
    '"再赢回来就走"——这句话，每个输钱的人都说过。但从来没有人真的做到',
  ],
};

// ── 缠斗维度（2个） ──

const grind_approaching: SceneMessages = {
  sceneId: 'grind_approaching',
  label: '缠斗预警',
  level: 'L2',
  factMessages: [
    '已连续 {grindHands} 手在窄幅震荡，盈亏仅 {pnl}',
    '打了 {grindHands} 手，资金几乎没有变化，进入缠斗状态',
  ],
  psychMessages: [
    '缠斗是最容易被忽视的陷阱——你觉得"没输啊"，但耐心和精力已经消耗大半',
    '赢不到、输不出去的感觉，会让人想"搏一把打破僵局"。这恰恰是缠斗最想让你做的事',
  ],
};

const grind_critical: SceneMessages = {
  sceneId: 'grind_critical',
  label: '缠斗触发',
  level: 'L3',
  factMessages: [
    '缠斗已达 {grindHands} 手，触发缠斗上限',
    '连续 {grindHands} 手窄幅震荡，你的时间和注意力已经被大量消耗',
  ],
  psychMessages: [
    '缠斗到极限时判断力急剧下降，但你自己感觉不到。这时候做的任何决定，事后都会后悔',
    '职业玩家的规则：缠斗到这个程度，先离桌休息。不管输赢，先恢复清醒',
  ],
};

// ── 时间维度（3个） ──

const time_warn_1: SceneMessages = {
  sceneId: 'time_warn_1',
  label: '时间过半',
  level: 'L1',
  factMessages: [
    '已打 {elapsed} 分钟，用了计划时间的 {timePercent}%',
    '时间已过 {timePercent}%，剩余时间不多了',
  ],
  psychMessages: [
    '时间是你最容易忽略的维度。赌场没有钟，就是为了让你忘记时间',
    '45分钟后，人的判断力开始下降但自我感觉不会变差——你觉得还清醒，但决策质量已经在降',
  ],
};

const time_warn_2: SceneMessages = {
  sceneId: 'time_warn_2',
  label: '时间紧迫',
  level: 'L2',
  factMessages: [
    '已打 {elapsed} 分钟，时间已用 {timePercent}%',
    '距离你设定的时间上限只剩几分钟',
  ],
  psychMessages: [
    '快到时间了还在打，说明你已经不想走了。问问自己：是策略让你留下，还是不甘心？',
    '时间上限是清醒时的你设的保护线。现在破线，等于让疲劳的自己替清醒的自己做决定',
  ],
};

const time_warn_3: SceneMessages = {
  sceneId: 'time_warn_3',
  label: '超时警告',
  level: 'L3',
  factMessages: [
    '已超时！当前 {elapsed} 分钟，超出计划 {timePercent}%',
    '你设定的时间上限已到，目前已超时继续',
  ],
  psychMessages: [
    '超时后的每一分钟，你的失误概率都在指数级增长。不是吓你，是数据规律',
    '你进场时设了时间限制，是因为清醒时的你知道：打太久一定会犯错',
  ],
};

// ── 锁盈维度（3个） ──

const profit_lock_activated: SceneMessages = {
  sceneId: 'profit_lock_activated',
  label: '锁盈激活',
  level: 'L1',
  factMessages: [
    '盈利达到 {peakProfit}，锁盈保护已自动激活',
    '恭喜，利润触发锁盈线。系统已收紧风控阈值保护盈利',
  ],
  psychMessages: [
    '赢钱的时候最容易放松警惕。锁盈激活的意思是：赢到这里，已经很好了',
    '现在的每一手都是在拿已有利润冒险。系统帮你收紧了阈值，但最终决定在你',
  ],
};

const profit_lock_drawdown: SceneMessages = {
  sceneId: 'profit_lock_drawdown',
  label: '锁盈回撤',
  level: 'L3',
  factMessages: [
    '盈利从最高 {peakProfit} 回撤超过50%，锁盈保护升级',
    '利润已大幅回吐，从峰值回撤超过一半',
  ],
  psychMessages: [
    '你之前赚到的是真钱，不是筹码。回撤超过一半，说明局势已经完全逆转了',
    '利润回吐的痛苦比同等金额的亏损更强烈。这种心理状态下，你更容易做出冲动决定',
  ],
};

const profit_lock_approaching: SceneMessages = {
  sceneId: 'profit_lock_approaching',
  label: '锁盈后首输',
  level: 'L2',
  factMessages: [
    '锁盈激活后首次亏损，盈利从 {peakProfit} 开始回落，当前盈利 {pnl}',
    '已赢到 {peakProfit} 并触发锁盈，但出现亏损，保护窗口收窄',
  ],
  psychMessages: [
    '锁盈后首输是心理拐点——从"赚着钱"变成"在亏钱"。注意你的心态变化',
    '赢的时候建立的自信，会让你在刚开始输的时候更不愿意走',
  ],
};

// ── 自检维度 — 已从场景链移除（§三/§七）──
// self_check_warning 和 self_check_danger 不再是场景
// 自检结果只显示在"你的状态与环境"常驻区（EmotionPanel.tsx）
// 话术内容保留备用，但不进入 SCENE_POOL 和 POOL_KEY_TO_SCENE_ID

const near_stoploss: SceneMessages = {
  sceneId: 'near_stoploss',
  label: '接近止损',
  level: 'L2',
  factMessages: [
    '距止损线仅剩 {distanceToStopLoss}，再输1手可能触发止损',
    '当前亏损 {pnlAbs}，距止损线 {distanceToStopLoss}',
  ],
  psychMessages: [
    '你离止损线只有一步之遥。止损线是你清醒时给自己画的底线，不要在这里动摇',
    '这个距离你心里清楚意味着什么。现在停下来是纪律，突破底线是失控',
  ],
};

// ────────────────────────────────────────
// 二、双指标毒药组合（12个）
// ────────────────────────────────────────

const poison_chase: SceneMessages = {
  sceneId: 'poison_chase',
  label: '追损螺旋',
  level: 'L3',
  factMessages: [
    '连输 {lossStreak} 手 + 码量升至 {betMultiple} 倍基码',
    '输了 {lossStreak} 手后加码到 {betMultiple} 倍，追损模式激活',
  ],
  psychMessages: [
    '追损螺旋是赌场利润的第一大来源。你正在做的，正是赌场最希望你做的事',
    '输钱后加注不是策略，是情绪在替你下注。加码翻本是所有玩家最常见的失控起点，职业玩家输的时候只做一件事：缩码或离场',
  ],
};

const poison_fatigue: SceneMessages = {
  sceneId: 'poison_fatigue',
  label: '疲劳高压',
  level: 'L3',
  factMessages: [
    '时间超 {timePercent}% + 曾缠斗 + 当前亏损 {pnlAbs}',
    '已打 {elapsed} 分钟，亏损 {pnlAbs}，三重压力叠加',
  ],
  psychMessages: [
    '你已经在三重压力下：时间消耗体力，缠斗消耗耐心，亏损带来焦虑。这是失控的标准前兆',
    '职业玩家在这个状态下只做一件事：离场。不是因为怕输，是因为知道这个状态下赢了也是侥幸',
  ],
};

const poison_momentum: SceneMessages = {
  sceneId: 'poison_momentum',
  label: '顺风转折',
  level: 'L3',
  factMessages: [
    '之前连赢 {consecutiveWins} 手后转折，利润回撤超50%',
    '顺风期已结束，从高点大幅回落',
  ],
  psychMessages: [
    '连赢时你觉得"今天手气好"。但百家乐没有手气——每手都是独立的。转折不是运气用完，是概率回归',
    '赢钱时建立的自信，会让你在输的时候更不愿意走。"刚才还赢那么多"这个想法，是回吐的开始',
  ],
};

const poison_fatigue_giveback: SceneMessages = {
  sceneId: 'poison_fatigue_giveback',
  label: '疲劳回吐',
  level: 'L3',
  factMessages: [
    '时间已过 {timePercent}% + 盈利回撤超50%',
    '打了很久，赢到的钱正在快速回吐',
  ],
  psychMessages: [
    '打久了回吐是最常见的亏损路径——前半场的利润，后半场全部还给赌场',
    '疲劳会让你对回吐的痛感麻木。你觉得"再打几把就回来"，但体力已经不支持好的判断了',
  ],
};

const poison_pivot_tilt: SceneMessages = {
  sceneId: 'poison_pivot_tilt',
  label: '转折上头',
  level: 'L3',
  factMessages: [
    '曾赢到 {peakProfit}，现亏损 {pnlAbs}，同时码量已升至 {betMultiple} 倍基码',
    '从最高点 {peakProfit} 转亏 {pnlAbs}，追损加码已启动',
  ],
  psychMessages: [
    '从赢到输最让人不甘心——"刚才还赢着呢"是最危险的想法。不甘心加码翻本，是最快的亏损路径',
    '盈利转亏后加码，是情绪在喊"不服"。但赌桌不在乎你服不服，概率不会因为你不甘心而改变',
  ],
};

const poison_lock_panic: SceneMessages = {
  sceneId: 'poison_lock_panic',
  label: '锁盈恐慌',
  level: 'L3',
  factMessages: [
    '锁盈后连输 {lossStreak} 手，从峰值 {peakProfit} 回落至当前盈利 {pnl}',
    '锁盈保护已启动，但连续亏损正在快速侵蚀，当前盈利仅剩 {pnl}',
  ],
  psychMessages: [
    '刚锁住利润就连输，恐慌感会比正常亏损强3倍。你现在最想做的是"抢回来"，但这正是最危险的',
    '利润在手时的安全感被瞬间打破，这种落差感会严重扭曲你的判断。先停下来，让情绪平复',
  ],
};

const poison_streak_time: SceneMessages = {
  sceneId: 'poison_streak_time',
  label: '连输超时',
  level: 'L3',
  factMessages: [
    '连输 {lossStreak} 手 + 时间已过 {timePercent}%',
    '连输 {lossStreak} 手，已打 {elapsed} 分钟，亏损 {pnlAbs}',
  ],
  psychMessages: [
    '连输加超时，你的身心都在催你"最后搏一把"。这个念头出现的时候，就是该走的时候',
    '又输又累的时候继续打，不是坚持，是赌桌上最常见的自我伤害',
  ],
};

const poison_netloss_time: SceneMessages = {
  sceneId: 'poison_netloss_time',
  label: '净输超时',
  level: 'L3',
  factMessages: [
    '净输 {netLoss} 手 + 时间已过 {timePercent}%',
    '净输 {netLoss} 手，已打 {elapsed} 分钟，亏损 {pnlAbs}',
  ],
  psychMessages: [
    '打了这么久还在亏，说明今天真的不是你的局。继续熬下去只会亏更多',
    '超时+净输，身体疲劳叠加心理压力。你已经不在最佳状态了，别用最差的自己去搏翻本',
  ],
};

const poison_netloss_raise: SceneMessages = {
  sceneId: 'poison_netloss_raise',
  label: '净输加注',
  level: 'L3',
  factMessages: [
    '全场净输 {netLoss} 手 + 码量升至 {betMultiple} 倍',
    '整体亏损状态下加码，风险正在放大',
  ],
  psychMessages: [
    '整场都在输的情况下加码，不是策略调整，是情绪失控的信号',
    '净输时加注等于用更大的赌注去对抗一个不利的局面。聪明的做法恰恰相反：缩码或离场',
  ],
};

const poison_streak_grind: SceneMessages = {
  sceneId: 'poison_streak_grind',
  label: '连输缠斗',
  level: 'L3',
  factMessages: [
    '连输 {lossStreak} 手 + 处于缠斗状态（{grindHands}手震荡）',
    '缠斗中又开始连输，局面正在恶化',
  ],
  psychMessages: [
    '缠斗磨光耐心后又遇连输——这是精神消耗最大的组合。你现在的判断力已经打了很大折扣',
    '磨不动还在输，挫败感翻倍。这种情绪下的任何决定都不可靠',
  ],
};

const poison_grind_raise: SceneMessages = {
  sceneId: 'poison_grind_raise',
  label: '缠斗加注',
  level: 'L3',
  factMessages: [
    '缠斗 {grindHands} 手后加注到 {betMultiple} 倍基码',
    '缠斗 {grindHands} 手 + 码量升至 {betMultiple} 倍，企图强行打破僵局',
  ],
  psychMessages: [
    '缠斗后加码是"磨烦了想大搞"。这不是突破，是失控',
    '缠斗消耗的是耐心。耐心用完后做的第一个决定，几乎都是错的',
  ],
};

const poison_stoploss_raise: SceneMessages = {
  sceneId: 'poison_stoploss_raise',
  label: '止损加注',
  level: 'L4',
  factMessages: [
    '接近止损线 + 码量升至 {betMultiple} 倍。极度危险',
    '距止损线仅剩 {distanceToStopLoss}，码量 {betMultiple} 倍，资金即将耗尽',
  ],
  psychMessages: [
    '止损线附近加码是最接近"爆仓"的操作。你必须立刻停下来',
    '赌场看到过无数人在最后一刻加码搏命——没有一个有好结果。你不能成为其中之一',
  ],
};

// ────────────────────────────────────────
// 三、多维组合（4个）
// ────────────────────────────────────────

const poison_multi_pressure: SceneMessages = {
  sceneId: 'poison_multi_pressure',
  label: '多维高压',
  level: 'L3',
  factMessages: [
    '时间超限 + 缠斗 {grindHands} 手 + 亏损 {pnlAbs}，三重压力叠加',
    '超时、缠斗、亏损三个维度同时亮红灯',
  ],
  psychMessages: [
    '三重压力叠加时，你的决策能力已降到平时的30%以下。现在做的任何决定，事后你都不会认同',
    '时间耗体力、缠斗耗耐心、亏损带焦虑——三者相乘，不是相加。你已经处于失控的临界点',
  ],
};

const poison_grind_despair: SceneMessages = {
  sceneId: 'poison_grind_despair',
  label: '缠斗绝望',
  level: 'L3',
  factMessages: [
    '缠斗达极限 {grindHands} 手 + 亏损 {pnlAbs} + 时间过 {timePercent}%',
    '打到极限手数，还在亏，时间也快用完了',
  ],
  psychMessages: [
    '缠斗绝望是最危险的心理状态——磨了这么久什么也没得到。你现在唯一正确的操作是：离场',
    '到了这个阶段，"绝不空手而归"的想法会特别强烈。但空手离场远比倾家荡产离场好一万倍',
  ],
};

const poison_netloss_grind: SceneMessages = {
  sceneId: 'poison_netloss_grind',
  label: '净输缠斗',
  level: 'L3',
  factMessages: [
    '净输 {netLoss} 手 + 处于缠斗状态',
    '净输 {netLoss} 手，缠斗 {grindHands} 手，亏损 {pnlAbs}，锯齿式下滑',
  ],
  psychMessages: [
    '净输加缠斗是最折磨人的组合——赢不到钱，输也输不痛快。这种煎熬会把人逼向极端操作',
    '锯齿亏损比一次大亏更消耗心理能量。你现在需要的不是"再试试"，是休息',
  ],
};

const poison_time_raise: SceneMessages = {
  sceneId: 'poison_time_raise',
  label: '超时加注',
  level: 'L3',
  factMessages: [
    '时间过 {timePercent}% + 码量升至 {betMultiple} 倍',
    '快结束了还在加码，风险急剧上升',
  ],
  psychMessages: [
    '快到时间了还在加码，说明你已经进入"最后一搏"心态。但"最后一把"从来不是最后一把',
    '超时加注 = 用最疲劳的状态做最大的赌注。这是赌场最喜欢的玩家行为',
  ],
};

// ────────────────────────────────────────
// 导出：场景池
// ────────────────────────────────────────

export const SCENE_POOL: Record<string, SceneMessages> = {
  // 单指标 - 连输
  streak_approaching,
  streak_critical,
  stoploss_hit,
  // 单指标 - 净输
  net_loss_approaching,
  net_loss_critical,
  profit_gone,
  // 单指标 - 缠斗
  grind_approaching,
  grind_critical,
  // 单指标 - 时间
  time_warn_1,
  time_warn_2,
  time_warn_3,
  // 单指标 - 锁盈
  profit_lock_activated,
  profit_lock_drawdown,
  profit_lock_approaching,
  // 单指标 - 接近止损
  near_stoploss,
  // 注：self_check_warning / self_check_danger 已从池中移除（§三）
  // 双指标毒药组合
  poison_chase,
  poison_fatigue,
  poison_momentum,
  poison_fatigue_giveback,
  poison_pivot_tilt,
  poison_lock_panic,
  poison_streak_time,
  poison_netloss_time,
  poison_netloss_raise,
  poison_streak_grind,
  poison_grind_raise,
  poison_stoploss_raise,
  // 多维组合
  poison_multi_pressure,
  poison_grind_despair,
  poison_netloss_grind,
  poison_time_raise,
};

// ── 从 poolKey 到 sceneId 的映射 ──
// interventionEngine 的 selectPoolFromRisk 返回 poolKey
// 有些 poolKey 与 sceneId 不同，需要映射
export const POOL_KEY_TO_SCENE_ID: Record<string, string> = {
  // 直接匹配的不需要映射
  // 以下是 interventionEngine 中 poolKey 与 sceneId 不一致的
  forced_leave: 'stoploss_hit',
  overtime: 'time_warn_3',
  profit_giveback: 'profit_gone',
  // 通用兜底类 → 没有专属场景，不触发场景卡
  severe_tilt: '',
  tilt_betting: '',
  tilt_critical: '',
  etp_collapsed: '',
  near_stoploss: 'near_stoploss',
  bet_volatility: '',
  self_check_recommended: '',
  approaching_limit: '',
  turning_point: '',
};

/**
 * 根据 interventionEngine 的 poolKey 获取场景消息
 * 如果没有对应的场景，返回 null
 */
export function getSceneByPoolKey(poolKey: string): SceneMessages | null {
  // 先查映射表
  if (poolKey in POOL_KEY_TO_SCENE_ID) {
    const sceneId = POOL_KEY_TO_SCENE_ID[poolKey];
    if (!sceneId) return null; // 通用兜底类，无专属场景
    return SCENE_POOL[sceneId] ?? null;
  }
  // 直接匹配
  return SCENE_POOL[poolKey] ?? null;
}

/**
 * 随机选取一组话术（事实1条 + 心理1条）
 */
export function pickRandomMessages(scene: SceneMessages): {
  factMessage: string;
  psychMessage: string;
} {
  const fi = Math.random() < 0.5 ? 0 : 1;
  const pi = Math.random() < 0.5 ? 0 : 1;
  return {
    factMessage: scene.factMessages[fi],
    psychMessage: scene.psychMessages[pi],
  };
}
