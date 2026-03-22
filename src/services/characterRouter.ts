import type { CharacterId, RouterDecision, RoomMessage, ConflictScenario } from '../types/room';
import { CHARACTER_MAP } from '../characters';
import { matchScenario } from '../data/scenarios';
import { getCharacterState } from './stateService';
import { getRelation } from './relationshipService';
import { getRoomHeat } from './stateService';

// ============================================================
// 博弈圆桌 — 加权评分路由器 v2
// 替代旧版四层级路由，使用综合评分公式选角色
// ============================================================

// ---- 权重配置 ----
const WEIGHTS = {
  topicRelevance:       0.20,  // 触发关键词匹配
  mentionBonus:         0.15,  // 消息中提到角色名
  emotionalTrigger:     0.15,  // 情绪状态（易怒+参与度）
  relationshipInterest: 0.15,  // 与近期活跃角色的张力
  dramaPotential:       0.15,  // 冲突目标近期发言
  silenceRecovery:      0.10,  // 沉默角色复苏奖励
  scenarioMatch:        0.10,  // 场景匹配加成
} as const;

// 军师评分惩罚系数（非触发条件时降权）
const JUNSHI_PENALTY = 0.5;

// ---- 单角色评分明细 ----
interface ScoreBreakdown {
  id: CharacterId;
  total: number;
  factors: {
    topicRelevance: number;
    mentionBonus: number;
    emotionalTrigger: number;
    relationshipInterest: number;
    dramaPotential: number;
    silenceRecovery: number;
    scenarioMatch: number;
  };
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 检测用户 @某角色
 * 支持 @短名、@全名、纯短名 三种匹配
 */
function detectMentions(message: string, roomCharacters: CharacterId[]): CharacterId[] {
  const mentioned: CharacterId[] = [];
  for (const charId of roomCharacters) {
    const char = CHARACTER_MAP[charId];
    if (!char) continue;
    const patterns = [
      `@${char.shortName}`,
      `@${char.name}`,
      char.shortName,
    ];
    for (const p of patterns) {
      if (message.includes(p)) {
        mentioned.push(charId);
        break;
      }
    }
  }
  return Array.from(new Set(mentioned));
}

/**
 * 计算争论轮数（连续角色消息数）
 * 从最后一条消息往前数，直到遇到非角色消息
 */
function countArgumentRounds(recentMessages: RoomMessage[]): number {
  let rounds = 0;
  for (let i = recentMessages.length - 1; i >= 0; i--) {
    if (recentMessages[i].role === 'character') rounds++;
    else break;
  }
  return rounds;
}

/**
 * 军师是否应该主动回复
 * 满足任一条件即触发：@提及、争论≥3轮、危机关键词、严重错误认知
 */
function shouldJunshiRespond(
  userMessage: string,
  recentMessages: RoomMessage[],
  wasMentioned: boolean,
): boolean {
  if (wasMentioned) return true;
  if (countArgumentRounds(recentMessages) >= 3) return true;

  // 危机检测（需同时包含情绪相关上下文词汇，避免误触）
  const crisisRe = /不想活|想死|自杀|跳楼|割腕|崩溃|绝望|走投无路/;
  const crisisContextRe = /赌|输|钱|债|活不|受不了|撑不|怎么办|没希望|完了/;
  if (crisisRe.test(userMessage) && crisisContextRe.test(userMessage)) return true;

  // 严重错误认知
  const misconceptionRe = /必赢|稳赚|包赢|保证赢|100%|一定能赢/;
  if (misconceptionRe.test(userMessage)) return true;

  return false;
}

/**
 * 提取近期活跃角色（最后 N 条消息中发过言的角色）
 */
function getRecentlyActiveCharacters(
  recentMessages: RoomMessage[],
  lookback: number = 3,
): CharacterId[] {
  const active: Set<CharacterId> = new Set();
  const slice = recentMessages.slice(-lookback);
  for (const msg of slice) {
    if (msg.role === 'character' && msg.characterId) {
      active.add(msg.characterId);
    }
  }
  return Array.from(active);
}

/**
 * 随机选择2个非军师角色（兜底用）
 */
function fallbackSelection(roomCharacters: CharacterId[]): CharacterId[] {
  const nonJunshi = roomCharacters.filter(c => c !== 'junshi');
  if (nonJunshi.length <= 2) return nonJunshi;
  const shuffled = [...nonJunshi].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 2);
}

// ============================================================
// 评分因子计算
// ============================================================

/**
 * 话题相关度：关键词匹配数 / max(3, 总关键词数)，上限 1.0
 */
function calcTopicRelevance(message: string, charId: CharacterId): number {
  const char = CHARACTER_MAP[charId];
  if (!char || !char.triggerKeywords.length) return 0;

  const msg = message.toLowerCase();
  let matches = 0;
  for (const kw of char.triggerKeywords) {
    if (msg.includes(kw)) matches++;
  }
  const denominator = Math.max(3, char.triggerKeywords.length);
  return Math.min(matches / denominator, 1.0);
}

/**
 * 名字提及加成：消息中包含角色短名或全名 → 1.0，否则 0
 */
function calcMentionBonus(message: string, charId: CharacterId): number {
  const char = CHARACTER_MAP[charId];
  if (!char) return 0;
  if (message.includes(char.shortName) || message.includes(char.name)) {
    return 1.0;
  }
  return 0;
}

/**
 * 情绪触发度：(易怒度 + 参与度) / 200
 * 无状态数据时默认 0.3
 */
function calcEmotionalTrigger(charId: CharacterId, roomId?: string): number {
  if (!roomId) return 0.3;
  const state = getCharacterState(roomId, charId);
  if (!state) return 0.3;
  return (state.mood.irritability + state.mood.engagement) / 200;
}

/**
 * 关系张力：与近期活跃角色中张力最高者 / 100
 * 无数据时默认 0.2
 */
function calcRelationshipInterest(
  charId: CharacterId,
  recentlyActive: CharacterId[],
  roomId?: string,
): number {
  if (!roomId || recentlyActive.length === 0) return 0.2;

  let maxTension = 0;
  for (const activeId of recentlyActive) {
    if (activeId === charId) continue;
    const edge = getRelation(roomId, charId, activeId);
    if (edge && edge.tension > maxTension) {
      maxTension = edge.tension;
    }
  }

  return maxTension > 0 ? maxTension / 100 : 0.2;
}

/**
 * 戏剧冲突潜力：冲突目标在最近3条消息中发言 → 0.8，否则 0.2
 */
function calcDramaPotential(
  charId: CharacterId,
  recentlyActive: CharacterId[],
): number {
  const char = CHARACTER_MAP[charId];
  if (!char || !char.conflictTargets.length) return 0.2;

  for (const target of char.conflictTargets) {
    if (recentlyActive.includes(target)) {
      return 0.8;
    }
  }
  return 0.2;
}

/**
 * 沉默复苏奖励：min(沉默轮数 / 5, 1.0)
 * 无数据时默认 0.3
 */
function calcSilenceRecovery(charId: CharacterId, roomId?: string): number {
  if (!roomId) return 0.3;
  const state = getCharacterState(roomId, charId);
  if (!state || state.silentTurns === undefined) return 0.3;
  return Math.min(state.silentTurns / 5, 1.0);
}

/**
 * 场景匹配加成：角色在匹配场景的 characters 列表中 → 1.0，否则 0
 */
function calcScenarioMatch(
  charId: CharacterId,
  scenario: ConflictScenario | null,
): number {
  if (!scenario) return 0;
  return scenario.characters.includes(charId) ? 1.0 : 0;
}

// ============================================================
// 综合评分
// ============================================================

/**
 * 计算单个角色的综合 speakScore
 */
function scoreCharacter(
  charId: CharacterId,
  message: string,
  recentlyActive: CharacterId[],
  scenario: ConflictScenario | null,
  roomId?: string,
): ScoreBreakdown {
  const factors = {
    topicRelevance:       calcTopicRelevance(message, charId),
    mentionBonus:         calcMentionBonus(message, charId),
    emotionalTrigger:     calcEmotionalTrigger(charId, roomId),
    relationshipInterest: calcRelationshipInterest(charId, recentlyActive, roomId),
    dramaPotential:       calcDramaPotential(charId, recentlyActive),
    silenceRecovery:      calcSilenceRecovery(charId, roomId),
    scenarioMatch:        calcScenarioMatch(charId, scenario),
  };

  const total =
    factors.topicRelevance       * WEIGHTS.topicRelevance +
    factors.mentionBonus         * WEIGHTS.mentionBonus +
    factors.emotionalTrigger     * WEIGHTS.emotionalTrigger +
    factors.relationshipInterest * WEIGHTS.relationshipInterest +
    factors.dramaPotential       * WEIGHTS.dramaPotential +
    factors.silenceRecovery      * WEIGHTS.silenceRecovery +
    factors.scenarioMatch        * WEIGHTS.scenarioMatch;

  return { id: charId, total, factors };
}

/**
 * 对所有房间角色评分并排序
 */
function scoreAllCharacters(
  roomCharacters: CharacterId[],
  message: string,
  recentMessages: RoomMessage[],
  scenario: ConflictScenario | null,
  roomId?: string,
): ScoreBreakdown[] {
  const recentlyActive = getRecentlyActiveCharacters(recentMessages, 3);

  const breakdowns = roomCharacters.map(charId =>
    scoreCharacter(charId, message, recentlyActive, scenario, roomId),
  );

  return breakdowns.sort((a, b) => b.total - a.total);
}

// ============================================================
// 选角逻辑
// ============================================================

/**
 * 根据房间热度决定选几个角色
 * cold/warm → 2，hot/boiling → 3
 */
function getSelectionCount(roomId?: string): number {
  if (!roomId) return 2;
  const heat = getRoomHeat(roomId);
  if (!heat) return 2;
  return (heat.level === 'hot' || heat.level === 'boiling') ? 3 : 2;
}

/**
 * 基于加权评分的选角（Tier 1）
 */
function selectByScore(
  scores: ScoreBreakdown[],
  userMessage: string,
  recentMessages: RoomMessage[],
  roomCharacters: CharacterId[],
  roomId?: string,
): { selected: CharacterId[]; reason: string } {
  const selectionCount = getSelectionCount(roomId);

  // 应用军师惩罚：如果军师不应主动回复，评分 × 0.5
  const adjustedScores = scores.map(s => {
    if (s.id === 'junshi') {
      const junshiMentioned = detectMentions(userMessage, ['junshi']).length > 0;
      const shouldSpeak = shouldJunshiRespond(userMessage, recentMessages, junshiMentioned);
      if (!shouldSpeak) {
        return { ...s, total: s.total * JUNSHI_PENALTY };
      }
    }
    return s;
  });

  // 重新按调整后的分数排序
  adjustedScores.sort((a, b) => b.total - a.total);

  // 选择 top N
  let selected = adjustedScores.slice(0, selectionCount).map(s => s.id);

  // 保证至少2个角色
  if (selected.length < 2) {
    const remaining = roomCharacters.filter(c => !selected.includes(c) && c !== 'junshi');
    const shuffled = [...remaining].sort(() => Math.random() - 0.5);
    while (selected.length < 2 && shuffled.length > 0) {
      selected.push(shuffled.shift()!);
    }
  }

  // 构建原因说明（用于调试）
  const topChar = adjustedScores[0];
  const reason = topChar
    ? `weighted_score(top=${topChar.id}:${topChar.total.toFixed(3)})`
    : 'weighted_score';

  return { selected, reason };
}

// ============================================================
// 旧版层级路由（向后兼容，无 roomId 时使用）
// ============================================================

/**
 * 旧版关键词亲和度打分（仅在无 roomId 时回退使用）
 */
function legacyKeywordScore(
  message: string,
  roomCharacters: CharacterId[],
): Array<{ id: CharacterId; score: number }> {
  const msg = message.toLowerCase();
  const scores: Array<{ id: CharacterId; score: number }> = [];

  for (const charId of roomCharacters) {
    const char = CHARACTER_MAP[charId];
    if (!char) continue;
    let score = 0;
    for (const kw of char.triggerKeywords) {
      if (msg.includes(kw)) score += 1;
    }
    scores.push({ id: charId, score });
  }

  return scores.sort((a, b) => b.score - a.score);
}

/**
 * @deprecated 旧版路由逻辑，将在 v3.0 移除。
 * 新代码请使用 routeCharacters() 并传入 roomId。
 *
 * 旧版层级路由（Tier 2→3→4，向后兼容用）
 * 当没有 roomId 时回退到此逻辑
 */
function legacyRoute(
  userMessage: string,
  roomCharacters: CharacterId[],
  recentMessages: RoomMessage[],
): RouterDecision {
  // 旧版 Tier 2: 冲突场景匹配
  const scenario = matchScenario(userMessage, roomCharacters, recentMessages);
  if (scenario) {
    let chars = scenario.characters.filter(c =>
      roomCharacters.includes(c as CharacterId),
    ) as CharacterId[];

    if (chars.includes('junshi') && !shouldJunshiRespond(userMessage, recentMessages, false)) {
      chars = chars.filter(c => c !== 'junshi');
    }

    if (chars.length > 0) {
      return {
        respondingCharacters: chars.slice(0, 3),
        scenario,
        reason: 'legacy_scenario',
      };
    }
  }

  // 旧版 Tier 3: 关键词打分
  const scores = legacyKeywordScore(userMessage, roomCharacters);
  const topScores = scores.filter(s => s.score > 0);

  if (topScores.length > 0) {
    let selected = topScores.slice(0, 3).map(s => s.id);

    if (selected.includes('junshi') && !shouldJunshiRespond(userMessage, recentMessages, false)) {
      selected = selected.filter(c => c !== 'junshi');
    }

    if (selected.length < 2) {
      const remaining = roomCharacters.filter(c => !selected.includes(c) && c !== 'junshi');
      if (remaining.length > 0) {
        selected.push(remaining[Math.floor(Math.random() * remaining.length)]);
      }
    }

    return {
      respondingCharacters: selected.slice(0, 3),
      scenario: null,
      reason: 'legacy_keyword',
    };
  }

  // 旧版 Tier 4: 兜底随机
  const fallback = fallbackSelection(roomCharacters);

  if (shouldJunshiRespond(userMessage, recentMessages, false) && roomCharacters.includes('junshi')) {
    if (!fallback.includes('junshi')) {
      fallback.push('junshi');
    }
  }

  return {
    respondingCharacters: fallback.slice(0, 3),
    scenario: null,
    reason: 'legacy_fallback',
  };
}

// ============================================================
// 主路由函数
// ============================================================

/**
 * 角色路由主入口
 *
 * 路由策略：
 *   Tier 0 — @提及覆盖：用户显式 @角色，直接返回
 *   Tier 1 — 加权评分：综合7维因子，选出最适合回复的角色
 *   Fallback — 无 roomId 时回退到旧版层级路由（向后兼容）
 *
 * @param userMessage      用户发送的消息
 * @param roomCharacters   房间内的角色列表
 * @param recentMessages   近期消息记录
 * @param roomId           房间ID（可选，提供后启用状态感知路由）
 */
export function routeCharacters(
  userMessage: string,
  roomCharacters: CharacterId[],
  recentMessages: RoomMessage[],
  roomId?: string,
): RouterDecision {
  // 空房间保护
  if (roomCharacters.length === 0) {
    return { respondingCharacters: [], scenario: null, reason: 'no_characters' };
  }

  // ---- Tier 0: @提及覆盖 ----
  const mentioned = detectMentions(userMessage, roomCharacters);
  if (mentioned.length > 0) {
    // @提及是最高优先级，直接返回被提及角色
    // 军师如果被 @，也必须回复
    return {
      respondingCharacters: mentioned.slice(0, 3),
      scenario: null,
      reason: 'mention',
    };
  }

  // ---- 无 roomId 时回退到旧版路由（向后兼容） ----
  if (!roomId) {
    return legacyRoute(userMessage, roomCharacters, recentMessages);
  }

  // ---- Tier 1: 加权评分路由 ----

  // 先做场景匹配，用于 scenarioMatch 因子加成
  const scenario = matchScenario(userMessage, roomCharacters, recentMessages);

  // 计算所有角色的综合评分
  const scores = scoreAllCharacters(
    roomCharacters,
    userMessage,
    recentMessages,
    scenario,
    roomId,
  );

  // 检查是否所有评分都为 0（无关键词、无状态数据等极端情况）
  const allZero = scores.every(s => s.total === 0);

  if (allZero) {
    // 全零兜底：随机选2个 + 场景检查
    const fallback = fallbackSelection(roomCharacters);

    // 军师特殊规则：如果满足触发条件，强制加入
    if (
      shouldJunshiRespond(userMessage, recentMessages, false) &&
      roomCharacters.includes('junshi') &&
      !fallback.includes('junshi')
    ) {
      fallback.push('junshi');
    }

    return {
      respondingCharacters: fallback.slice(0, 3),
      scenario,
      reason: 'fallback_all_zero',
    };
  }

  // 正常选角
  const { selected, reason } = selectByScore(
    scores,
    userMessage,
    recentMessages,
    roomCharacters,
    roomId,
  );

  // 军师强制介入检查：满足触发条件但未被选中时，追加军师
  if (
    roomCharacters.includes('junshi') &&
    !selected.includes('junshi') &&
    shouldJunshiRespond(userMessage, recentMessages, false)
  ) {
    selected.push('junshi');
  }

  return {
    respondingCharacters: selected.slice(0, 3),
    scenario,
    reason,
  };
}
