// ============================================================
// AI 资金管家 — 词条定义 & Q&A
// 所有术语在此统一定义，确保全产品一致性
// ============================================================

export interface GlossaryTerm {
  id: string;
  term: string;              // 词条名
  definition: string;        // 定义
  formula?: string;          // 计算公式（如有）
  example?: string;          // 举例
  category: '资金相关' | '风险指标' | '操作行为' | '风控规则' | '报告状态' | '纪律指标';
  important?: boolean;       // 是否为关键词条
}

export interface GlossaryFAQ {
  id: string;
  question: string;
  answer: string;
  category: '资金' | '风险' | '操作' | '风控' | '报告' | '纪律';
}

/** 分类 emoji 映射 */
export const CATEGORY_EMOJI: Record<GlossaryTerm['category'], string> = {
  '资金相关': '💰',
  '风险指标': '📊',
  '操作行为': '🎯',
  '风控规则': '🛡️',
  '报告状态': '📋',
  '纪律指标': '🏅',
};

export const FAQ_CATEGORY_EMOJI: Record<GlossaryFAQ['category'], string> = {
  '资金': '💰',
  '风险': '📊',
  '操作': '🎯',
  '风控': '🛡️',
  '报告': '📋',
  '纪律': '🏅',
};

// ============================================================
// 词条定义
// ============================================================

export const FM_GLOSSARY: GlossaryTerm[] = [
  // ── 💰 资金相关 ──
  {
    id: 'budget',
    term: '操盘资金',
    definition: '本场带上桌、用于操作的全部资金。无论赢输多少，这都是本场计算风险和回撤的基础。',
    example: '你本场带了 5000 元上桌，操盘资金就是 5000 元。',
    category: '资金相关',
    important: true,
  },
  {
    id: 'current_balance',
    term: '当前余额',
    definition: '本场结束时，你账户里剩余的资金。',
    formula: '当前余额 = 操盘资金 + 净输赢',
    example: '操盘资金 5000 元，最终盈利 200 元，当前余额 = 5200 元。',
    category: '资金相关',
  },
  {
    id: 'net_pnl',
    term: '净输赢',
    definition: '当前盈亏金额。正数表示盈利，负数表示亏损。',
    formula: '净输赢 = 赢的金额总和 − 输的金额总和',
    example: '赢了3手共 600 元，输了2手共 400 元，净输赢 = +200 元。',
    category: '资金相关',
  },
  {
    id: 'highest_profit',
    term: '最高盈利',
    definition: '本场操作过程中，你曾经达到过的最大盈利金额。即使后来回撤，最高盈利仍然记录你曾到达的最高点。',
    example: '你一度赢到 +700 元，但后来回撤到 +200 元。最高盈利 = 700 元。',
    category: '资金相关',
    important: true,
  },
  {
    id: 'peak_capital',
    term: '峰值资金',
    definition: '本场资金达到过的最高点，包含本金和已实现盈利。',
    formula: '峰值资金 = 操盘资金 + 最高盈利',
    example: '操盘资金 5000 元，最高盈利 700 元，峰值资金 = 5700 元。',
    category: '资金相关',
    important: true,
  },

  // ── 📊 风险指标 ──
  {
    id: 'max_drawdown',
    term: '最大回撤',
    definition: '从资金最高点开始，回落到最低点的幅度。回撤越大说明风险越高。',
    formula: '最大回撤 = (峰值资金 − 最低资金) ÷ 峰值资金 × 100%',
    example: '峰值资金 5700 元，最低资金 5200 元，最大回撤 = 500 ÷ 5700 ≈ 8.7%。',
    category: '风险指标',
    important: true,
  },
  {
    id: 'drawdown_amount',
    term: '回撤金额',
    definition: '从峰值资金下跌的绝对金额。',
    formula: '回撤金额 = 峰值资金 − 当前余额',
    example: '峰值资金 5700 元，当前余额 5200 元，回撤金额 = 500 元。',
    category: '风险指标',
  },
  {
    id: 'profit_giveback_rate',
    term: '盈利回吐率',
    definition: '你赚到的钱有多少被吐回去了。如果超过 100%，说明不仅吐掉了全部盈利，还出现了亏损。',
    formula: '盈利回吐率 = (最高盈利 − 当前盈利) ÷ 最高盈利 × 100%',
    example: '最高盈利 700 元，最终盈利 200 元，盈利回吐率 = 71%。',
    category: '风险指标',
    important: true,
  },
  {
    id: 'profit_retention_rate',
    term: '盈利保持率',
    definition: '你最终保住了多少盈利。这个指标越高，说明利润管理越好。',
    formula: '盈利保持率 = 最终盈利 ÷ 最高盈利 × 100%',
    example: '最高盈利 700 元，最终盈利 200 元，盈利保持率 = 29%。',
    category: '风险指标',
  },
  {
    id: 'win_rate',
    term: '胜率',
    definition: '赢的手数占总手数的百分比。',
    formula: '胜率 = 赢的手数 ÷ 总手数 × 100%',
    example: '28 手赢 14 手，胜率 = 50%。',
    category: '风险指标',
  },

  // ── 🎯 操作行为 ──
  {
    id: 'base_unit',
    term: '基码',
    definition: '每手操作的默认下注金额。不是上限也不是下限，只是你计划的常规下注额。',
    example: '基码设置为 200 元，表示你正常每手下注 200 元。',
    category: '操作行为',
  },
  {
    id: 'bet_change',
    term: '加码',
    definition: '下注金额高于你的基码。如果没有设置码量上限，加码只会被记录，不会算违规。',
    example: '基码 200 元，某一手下注 500 元，这就属于加码行为。',
    category: '操作行为',
  },
  {
    id: 'win_streak',
    term: '连赢',
    definition: '连续赢的手数。只要中间输一手，连赢就会重新计算。',
    example: '赢 → 赢 → 赢，这是连赢 3 手。',
    category: '操作行为',
  },
  {
    id: 'loss_streak',
    term: '连输',
    definition: '连续输的手数。连输常用于触发风险控制规则。',
    example: '输 → 输 → 输 → 输，这是连输 4 手。',
    category: '操作行为',
  },
  {
    id: 'net_loss_hands',
    term: '净输手数',
    definition: '输的手数减去赢的手数。帮助判断整体走势方向。',
    formula: '净输手数 = 输局数 − 赢局数',
    example: '赢 10 手、输 14 手，净输手数 = 4。',
    category: '操作行为',
  },
  {
    id: 'hands',
    term: '手数',
    definition: '下注的次数。每下注一次（无论赢输）算一手。',
    category: '操作行为',
  },
  {
    id: 'stagnation',
    term: '缠斗',
    definition: '连续多手内双方僵持不下、无法拉开差距的状态。判定标准有两种（满足任一即算缠斗）：\n① 基于基码与胜率：连续 8-10 手内，净输赢在 ±2 个基码以内，且胜率在 40%~60% 之间反复拉锯。\n② 基于资金水位：连续 8 手以上，资金曲线呈水平震荡，最高点与最低点落差不超过本场预算的 10%，始终无法拉开差距。',
    example: '基码 200 元，连打 10 手，赢5输5，净输赢只有 -100 元（在 ±400 范围内），资金在 4800~5200 之间反复——这就是缠斗。',
    category: '风险指标',
    important: true,
  },
  {
    id: 'session',
    term: '场次',
    definition: '从制定方案开始，到结束复盘为止的一个完整周期。',
    category: '操作行为',
  },

  // ── 🛡️ 风控规则 ──
  {
    id: 'stop_loss',
    term: '止损',
    definition: '你提前设定的最大可接受亏损。当亏损达到止损金额时，系统会提醒你停止操作，避免亏损扩大。',
    example: '止损设置 2000 元，当亏损达到 2000 元时系统提醒。',
    category: '风控规则',
    important: true,
  },
  {
    id: 'take_profit',
    term: '止盈',
    definition: '在盈利状态下主动结束操作，锁定当前利润的行为。止盈是人的决策行为，不是系统自动触发。核心目的是锁定已获利润，避免盈利大幅回吐。',
    example: '操盘资金 5000 元，盈利达到 700 元时选择停止操作，这就是止盈。',
    category: '风控规则',
    important: true,
  },
  {
    id: 'lock_profit',
    term: '锁盈（锁定盈利）',
    definition: '利润保护规则。当盈利达到触发线后启动保护，如果盈利回撤到保护线就触发提醒。锁盈是提醒机制，止盈是最终决策。两者关系：锁盈提醒可能促使你选择止盈。',
    example: '盈利达到 2000 元→启动锁盈。回撤到 800 元→触发提醒。',
    category: '风控规则',
    important: true,
  },
  {
    id: 'loss_streak_stop',
    term: '连输手数止损',
    definition: '预设的连续输掉手数上限。连续输的手数达到这个数字时，触发止损警报。',
    example: '连输手数止损设为 5 手，当连续输了第 5 手时触发警报。',
    category: '风控规则',
  },
  {
    id: 'net_loss_hands_stop',
    term: '净输手数止损',
    definition: '预设的净输手数上限。当净输手数达到这个数字时，触发止损警报。',
    example: '净输手数止损设为 8 手，当输的手数比赢的多了 8 手时触发。',
    category: '风控规则',
  },
  {
    id: 'sbi',
    term: '紧急刹车',
    definition: '用户主动暂停操作的按钮。常见触发原因：情绪波动、外界干扰、身体不适、被挑衅或刺激。触发后系统会记录该行为用于复盘分析。',
    example: '感到心跳加速、手心出汗时，按下紧急刹车暂停操作。',
    category: '风控规则',
  },

  // ── 📋 报告状态 ──
  {
    id: 'event_violation',
    term: '违规 ❌',
    definition: '你设置了规则，规则已触发，但你没有按规则执行。',
    example: '设置连输 5 手停止，连输 6 手仍继续操作，记录为违规。',
    category: '报告状态',
    important: true,
  },
  {
    id: 'event_triggered',
    term: '已触发 ⚠️',
    definition: '规则被触发，并且你按照规则执行了。说明风控运行正常。',
    example: '连赢 3 手后休息，触发后你确实暂停了。',
    category: '报告状态',
    important: true,
  },
  {
    id: 'event_safe',
    term: '未触发 ✅',
    definition: '你设置了规则，但本场没有达到触发条件。这是正常情况。',
    example: '设了净输手数止损 8 手，实际净输 0 手，状态为未触发。',
    category: '报告状态',
  },
  {
    id: 'event_activated',
    term: '已激活 ℹ️',
    definition: '状态发生变化，但不需要你执行任何动作。只是告知你某个机制已启动。',
    example: '盈利达到锁盈触发线，锁盈保护自动启动，状态为已激活。',
    category: '报告状态',
  },
  {
    id: 'event_alert',
    term: '风险预警 🟡',
    definition: '你接近某个风险阈值，系统提前提醒你注意风险。',
    example: '止损设置 2000 元，当前亏损 1800 元，系统提前预警。',
    category: '报告状态',
  },
  {
    id: 'event_observation',
    term: '行为记录 📝',
    definition: '系统观察到的行为，但你没有设置相关规则。只记录不判定违规。',
    example: '未设码量上限，但出现加码行为，系统只记录不标红。',
    category: '报告状态',
  },

  // ── 🏅 纪律指标 ──
  {
    id: 'discipline_score',
    term: '纪律得分',
    definition: '0-100 分的综合评分。衡量你对自己设定规则的执行程度，考虑违规、超时、加码、是否执行规则等。分数越高，说明操作越稳定。',
    category: '纪律指标',
  },
  {
    id: 'discipline_execution_rate',
    term: '纪律执行率',
    definition: '规则触发后你有多少次按规则执行。只统计需要你执行动作的规则（排除"已激活"等状态变化）。',
    formula: '纪律执行率 = 遵守规则次数 ÷ 触发规则次数 × 100%',
    example: '触发规则 4 次，遵守 3 次，纪律执行率 = 75%。',
    category: '纪律指标',
    important: true,
  },
  {
    id: 'trigger_density',
    term: '风控触发密度',
    definition: '触发的规则数占总手数的比例。密度越高说明策略越不稳定，风控频繁被触发。',
    formula: '风控触发密度 = 触发规则数 ÷ 总手数 × 100%',
    example: '28 手里触发了 6 条规则，触发密度 = 21%。超过 30% 说明策略不稳定。',
    category: '纪律指标',
    important: true,
  },
];

// ============================================================
// 常见问题 Q&A
// ============================================================

export const FM_FAQ: GlossaryFAQ[] = [
  // ── 💰 资金 ──
  {
    id: 'faq_peak_capital',
    question: '峰值资金和最高盈利有什么区别？',
    answer: '最高盈利是你赚到的最多的钱，峰值资金 = 操盘资金 + 最高盈利。比如带了 5000 元，最多赚到 700 元，峰值资金就是 5700 元。',
    category: '资金',
  },

  // ── 📊 风险 ──
  {
    id: 'faq_drawdown_vs_loss',
    question: '回撤和亏损有什么区别？',
    answer: '亏损是你相对于操盘资金的净亏损额。回撤是从你盈利最高点往下跌的幅度。你可能当前仍然盈利（没有亏损），但回撤已经很大——这说明你赚到的钱正在快速回吐。',
    category: '风险',
  },
  {
    id: 'faq_drawdown_formula',
    question: '回撤百分比是怎么算的？',
    answer: '最大回撤 = (峰值资金 − 最低资金) ÷ 峰值资金 × 100%。例如：操盘资金 5000 元，最高赚到 5700 元，之后跌到 5200 元，回撤 = (5700 − 5200) ÷ 5700 = 8.7%。',
    category: '风险',
  },
  {
    id: 'faq_giveback_over_100',
    question: '盈利回吐率超过 100% 是什么意思？',
    answer: '说明你不仅吐掉了全部盈利，还出现了亏损。比如最高盈利 700 元，最终亏损 500 元，回吐率 = (700 − (−500)) ÷ 700 = 171%。',
    category: '风险',
  },

  // ── 🎯 操作 ──
  {
    id: 'faq_base_unit_meaning',
    question: '基码就是最大下注额吗？',
    answer: '不是。基码是你计划的每手常规下注额，不是上限也不是下限。如果你想限制最大下注额，需要单独设置"单手码量上限"指标。',
    category: '操作',
  },
  {
    id: 'faq_net_hands_vs_streak',
    question: '净输手数和连输手数有什么区别？',
    answer: '连输是连续输的手数（中间不能有赢），净输是总输手数减总赢手数。连输 3 手可能发生在任何时候，但净输 3 手意味着整场你输的比赢的多 3 手。',
    category: '操作',
  },

  // ── 🛡️ 风控 ──
  {
    id: 'faq_lock_vs_take_profit',
    question: '锁盈和止盈有什么区别？',
    answer: '止盈 = 收手（人的决策行为）；锁盈 = 利润保护机制（系统规则）。锁盈不会自动结束操作，但锁盈提醒可能促使你选择止盈。简单说：锁盈是提醒机制，止盈是最终决策。',
    category: '风控',
  },
  {
    id: 'faq_lock_profit',
    question: '锁盈的两个步骤是什么？',
    answer: '① 盈利达到触发线 → 启动锁盈保护（状态显示 ℹ️ 已激活）。② 盈利回撤到保护线 → 触发提醒（根据是否遵守显示 ⚠️ 或 ❌）。两步分开计算，触发锁盈启动不需要你做任何操作。',
    category: '风控',
  },
  {
    id: 'faq_sbi',
    question: '紧急刹车有什么用？',
    answer: '紧急刹车是你主动暂停操作的按钮。触发一次说明你有自我觉察能力（好事），但如果多次触发，说明你的状态已不适合继续。系统会在复盘中分析你的紧急刹车行为模式。',
    category: '风控',
  },
  {
    id: 'faq_approaching',
    question: '风险预警在什么时候出现？',
    answer: '当你的数据接近触发规则（通常达到阈值的 50%-80%）时出现。比如止损 2500 元，亏到 1250 元时出现预警。这是提醒你注意，不是要求你立刻停手。',
    category: '风控',
  },
  {
    id: 'faq_custom_rules',
    question: '我能设自己的规则吗？',
    answer: '可以。在基础方案确认后，进阶表单里有多种预设指标可以选填，你也可以在底部输入自定义规则文字描述。有阈值的规则系统会自动监测，纯文字描述的规则会记录在报告中。',
    category: '风控',
  },

  // ── 📋 报告 ──
  {
    id: 'faq_alert_levels',
    question: '报告里的图标分别代表什么？',
    answer: '❌ 违规 = 规则触发但没遵守；⚠️ 已触发 = 规则触发且遵守了；✅ 未触发 = 规则没被触发（安全）；ℹ️ 已激活 = 状态变化（如锁盈启动），无需执行；🟡 接近阈值 = 接近规则触发线；📝 行为记录 = 没设规则但出现了异常行为。',
    category: '报告',
  },
  {
    id: 'faq_violation_vs_observation',
    question: '什么情况算违规，什么只算行为记录？',
    answer: '只有你事先设了规则、规则被触发、你又没遵守，才算违规。如果你没设这个规则，出现的异常行为只会记录下来供你复盘参考，不会标红。',
    category: '报告',
  },
  {
    id: 'faq_four_dimensions',
    question: '四维评分是什么？',
    answer: '系统从四个维度给你打分：纪律（是否遵守规则）、利润管理（盈利保护能力）、风险控制（回撤和止损行为）、情绪控制（冲动行为和紧急刹车情况）。每个维度 0-100 分，帮你找到最需改进的方面。',
    category: '报告',
  },

  // ── 🏅 纪律 ──
  {
    id: 'faq_discipline_score',
    question: '纪律得分是怎么计算的？',
    answer: '满分 100 分。违规行为扣分（强警报 -10 分、正式提醒 -5 分），止损后继续打 -15 分，违规加码 -10 分。主动在安全区结束 +10 分，在锁盈区结束 +5 分。',
    category: '纪律',
  },
  {
    id: 'faq_exec_rate_vs_score',
    question: '纪律执行率和纪律得分有什么区别？',
    answer: '纪律执行率只看"触发的规则你遵守了多少"，纯粹的执行比例。纪律得分是综合评分，还考虑了超时、加码、主动结束等行为。执行率 100% 不一定得分满分（可能有超时等扣分）。',
    category: '纪律',
  },
];

// ============================================================
// 事件分类定义（用于引擎和报告）
// ============================================================

/** 六级事件状态 */
export type EventStatus = 'violation' | 'triggered' | 'safe' | 'activated' | 'alert' | 'observation';

export const EVENT_STATUS_CONFIG: Record<EventStatus, {
  icon: string;
  label: string;
  color: string;
  bgColor: string;
  description: string;
}> = {
  violation: {
    icon: '❌',
    label: '违规',
    color: '#E63946',
    bgColor: 'rgba(230,57,70,0.15)',
    description: '有规则 + 触发 + 未执行',
  },
  triggered: {
    icon: '⚠️',
    label: '已触发',
    color: '#D97706',
    bgColor: 'rgba(230,184,0,0.12)',
    description: '有规则 + 触发 + 已执行',
  },
  safe: {
    icon: '✅',
    label: '未触发',
    color: '#22C55E',
    bgColor: 'rgba(34,197,94,0.15)',
    description: '有规则 + 未触发',
  },
  activated: {
    icon: 'ℹ️',
    label: '已激活',
    color: '#3B82F6',
    bgColor: 'rgba(59,130,246,0.15)',
    description: '状态变化（无需执行动作）',
  },
  alert: {
    icon: '🟡',
    label: '接近阈值',
    color: '#F59E0B',
    bgColor: 'rgba(245,158,11,0.15)',
    description: '系统监测 + 接近触发线',
  },
  observation: {
    icon: '📝',
    label: '行为记录',
    color: '#AAAAAA',
    bgColor: '#1F1F1F',
    description: '无规则 + 异常行为',
  },
};
