// ============================================================
// topicRedirect — 跑题回主线 3步状态机 + 升级规则
//
// 首次跑题: ACK → REDIRECT → MICRO-ACTION (完整3步合一轮输出)
// 连续第2次: 跳ACK，直接 REDIRECT → MICRO-ACTION (更短)
// 连续第3次+: 不自由生成，固定安全模板（强回主线）
// 任意时刻命中危机词: 中断，进危机流程（由 focusGuard 处理）
// ============================================================

// --- 三个单步问题备选（轮换） ---
const MICRO_ACTIONS = [
  // 金额槽位
  "这轮到现在净赚还是净亏？大概多少？",
  // 时间槽位
  "这是昨天一次性发生，还是这周反复发生？",
  // 触发器槽位
  "刚才最先触发你的是哪一个：看到盘口、情绪上来、还是还债压力？",
];

// --- 会话级计数 ---
let consecutiveOffTopicCount = 0;
let microActionIndex = 0;

/** 重置计数（用户回到主线时调用） */
export function resetOffTopicCount(): void {
  consecutiveOffTopicCount = 0;
}

/** 获取当前连续跑题次数 */
export function getOffTopicCount(): number {
  return consecutiveOffTopicCount;
}

/** 递增跑题计数 */
function bumpCount(): void {
  consecutiveOffTopicCount++;
}

/** 轮换取下一个 micro-action 问题 */
function nextMicroAction(): string {
  const q = MICRO_ACTIONS[microActionIndex % MICRO_ACTIONS.length];
  microActionIndex++;
  return q;
}

// ============================================================
// 按场景生成转弯回复
// ============================================================

export type RedirectScenario = "off_topic" | "resistance" | "strategy";

/**
 * 生成跑题/抗拒/策略场景的转弯回复
 * @param scenario 场景类型
 * @param offTopicHint 用户跑到的话题（可选，用于ACK）
 */
export function getRedirectResponse(
  scenario: RedirectScenario,
  offTopicHint?: string,
): string {
  bumpCount();
  const count = consecutiveOffTopicCount;

  // --- 策略场景（凯利/翻本等）：固定硬拒 ---
  if (scenario === "strategy") {
    return [
      "我不能讨论任何赌博策略。",
      "我们只做保护动作：今晚先暂停24小时不入场。",
      "你现在能确认吗？",
    ].join("\n");
  }

  // --- 抗拒场景（不想聊损失）：给最小选项题 ---
  if (scenario === "resistance") {
    return [
      "可以不细聊细节，我们先做最小一步就好。",
      "给我一个范围，这次大概是亏了 1k内 / 1k\u20131w / 1w+ ？",
    ].join("\n");
  }

  // --- 普通跑题 ---

  // 连续第3次+：固定安全模板，不自由生成
  if (count >= 3) {
    return [
      "我先把话题拉回你现在最重要的事：把这次波动稳住。",
      "先不展开别的话题，我们只做一步：" + nextMicroAction(),
    ].join("\n");
  }

  // 连续第2次：跳ACK，直接 REDIRECT + MICRO-ACTION
  if (count === 2) {
    return [
      "先把这次状态稳住更重要。",
      "现在先确认一件事：" + nextMicroAction(),
    ].join("\n");
  }

  // 首次：完整 ACK → REDIRECT → MICRO-ACTION
  const topic = offTopicHint || "这个话题";
  return [
    `${topic}我记住了，但先把你这次状态稳住更重要。`,
    "现在先确认一件事：" + nextMicroAction(),
  ].join("\n");
}
