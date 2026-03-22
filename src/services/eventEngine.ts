// ============================================================
// 博弈圆桌 — 事件引擎 (Event Engine)
// 基于对话状态触发动态事件，让群聊产生"意料之外"的戏剧性时刻
// 6种 MVP 事件：站队结盟 / 调侃嘲讽 / 翻旧账 / 爆料 / 情绪波动 / 争论升级
// 核心输出：prompt injection 文本，注入角色下一轮的 system prompt
// ============================================================

import type {
  CharacterId,
  CharacterState,
  GameEvent,
  GameEventType,
  EventEffect,
  HeatLevel,
  RoomMessage,
  UserStance,
} from '../types/room';
import { getCharacterState } from './stateService';
import { getRecentConflicts } from './memoryService';
import { getHighTensionPairs } from './relationshipService';
import { CHARACTER_MAP } from '../characters';

// ============================================================
// 类型定义
// ============================================================

/** 待注入的 prompt 片段，会在下一轮发送给角色 */
interface PendingInjection {
  targetCharId: CharacterId | 'all';
  text: string;
  expiresAt: string;   // ISO string，触发后5分钟过期
  eventId: string;
}

/** checkAndTriggerEvents 的可选参数 */
interface EventCheckOptions {
  /** 用户当前立场（由 stanceDetector 检测） */
  userStance?: UserStance;
  /** 当前房间热度 */
  heatLevel?: HeatLevel;
  /** 各角色状态快照 */
  characterStates?: Partial<Record<CharacterId, CharacterState>>;
}

// ============================================================
// 常量
// ============================================================

const STORAGE_PREFIX = 'roundtable_events_';
const MAX_STORED_EVENTS = 50;
const INJECTION_TTL_MS = 5 * 60 * 1000; // prompt injection 5分钟有效

/** 各事件类型的冷却时间（毫秒） */
const COOLDOWNS: Record<GameEventType, number> = {
  alliance:    10 * 60 * 1000,  // 10分钟
  taunt:        8 * 60 * 1000,  //  8分钟
  callback:    15 * 60 * 1000,  // 15分钟
  reveal:      20 * 60 * 1000,  // 20分钟
  mood_shift:   5 * 60 * 1000,  //  5分钟
  escalation:  10 * 60 * 1000,  // 10分钟
  rescue:      10 * 60 * 1000,  // 10分钟（保留类型，MVP暂不用）
  user_impact: 10 * 60 * 1000,  // 10分钟（保留类型，MVP暂不用）
};

// ============================================================
// 内存状态（会话级，刷新即重置）
// ============================================================

/** 冷却追踪：eventType → 上次触发时间戳(ms) */
const cooldownMap = new Map<string, number>();

/** 待注入列表：roomId → PendingInjection[] */
const pendingInjections = new Map<string, PendingInjection[]>();

// ============================================================
// 工具函数
// ============================================================

/** 生成唯一 ID */
function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

/** 角色短名 */
function charName(id: string): string {
  if (id === 'user') return '用户';
  return CHARACTER_MAP[id]?.shortName || id;
}

/** 冷却 key：包含 roomId 以隔离不同房间 */
function cooldownKey(roomId: string, eventType: GameEventType): string {
  return `${roomId}:${eventType}`;
}

/** 检查某事件类型是否在冷却中 */
function isOnCooldown(roomId: string, eventType: GameEventType): boolean {
  const key = cooldownKey(roomId, eventType);
  const lastTriggered = cooldownMap.get(key);
  if (!lastTriggered) return false;
  return Date.now() - lastTriggered < COOLDOWNS[eventType];
}

/** 设置冷却 */
function setCooldown(roomId: string, eventType: GameEventType): void {
  cooldownMap.set(cooldownKey(roomId, eventType), Date.now());
}

/** 创建 GameEvent 并同时生成 PendingInjection */
function createEvent(
  roomId: string,
  type: GameEventType,
  description: string,
  participants: string[],
  effects: EventEffect[],
): GameEvent {
  const event: GameEvent = {
    id: genId(),
    type,
    description,
    participants,
    effects,
    triggeredAt: new Date().toISOString(),
    roomId,
  };

  // 从 effects 中提取 prompt_inject 和 force_speak，生成 PendingInjection
  const expiresAt = new Date(Date.now() + INJECTION_TTL_MS).toISOString();
  for (const effect of effects) {
    if (effect.type === 'prompt_inject' || effect.type === 'force_speak') {
      addInjection(roomId, {
        targetCharId: effect.target as CharacterId | 'all',
        text: effect.type === 'force_speak'
          ? `【系统指令】你现在必须发言，不要保持沉默。${typeof effect.value === 'string' ? effect.value : ''}`
          : String(effect.value),
        expiresAt,
        eventId: event.id,
      });
    }
  }

  // 设置冷却
  setCooldown(roomId, type);

  // 持久化到 localStorage
  persistEvent(roomId, event);

  console.log(`[eventEngine] 触发事件: ${type} - ${description}`);

  return event;
}

// ============================================================
// localStorage 持久化（事件历史）
// ============================================================

function eventsStorageKey(roomId: string): string {
  return `${STORAGE_PREFIX}${roomId}`;
}

/** 保存事件到 localStorage 历史记录 */
function persistEvent(roomId: string, event: GameEvent): void {
  try {
    const raw = localStorage.getItem(eventsStorageKey(roomId));
    const events: GameEvent[] = raw ? JSON.parse(raw) : [];
    events.push(event);
    // 超出上限则删除最旧的
    while (events.length > MAX_STORED_EVENTS) {
      events.shift();
    }
    localStorage.setItem(eventsStorageKey(roomId), JSON.stringify(events));
  } catch (e) {
    console.warn('[eventEngine] 保存事件历史失败:', e);
  }
}

// ============================================================
// Injection 管理
// ============================================================

/** 添加待注入项 */
function addInjection(roomId: string, injection: PendingInjection): void {
  if (!pendingInjections.has(roomId)) {
    pendingInjections.set(roomId, []);
  }
  pendingInjections.get(roomId)!.push(injection);
}

/** 清除过期的注入项 */
function pruneExpiredInjections(roomId: string): void {
  const list = pendingInjections.get(roomId);
  if (!list) return;
  const now = Date.now();
  const valid = list.filter(inj => new Date(inj.expiresAt).getTime() > now);
  pendingInjections.set(roomId, valid);
}

// ============================================================
// 6种 MVP 事件检测器
// ============================================================

/**
 * 1. alliance（站队结盟）
 * 触发条件：
 *   - 用户支持了某个角色（由 userStance 传入）
 *   - 或两个角色在近期历史中同意了3次以上
 */
function checkAlliance(
  roomId: string,
  recentMessages: RoomMessage[],
  characters: CharacterId[],
  options: EventCheckOptions,
): GameEvent | null {
  if (isOnCooldown(roomId, 'alliance')) return null;

  const { userStance } = options;

  // 路径A：用户站队
  if (userStance && userStance.type === 'support' && userStance.targetCharacter && userStance.confidence >= 0.6) {
    const target = userStance.targetCharacter;
    const targetName = charName(target);

    // 找到 target 的对立角色
    const charDef = CHARACTER_MAP[target];
    const rivals = charDef?.conflictTargets?.filter(r => characters.includes(r)) ?? [];

    const effects: EventEffect[] = [
      {
        type: 'prompt_inject',
        target,
        value: `【事件：用户站队】用户刚才站在你这边，你对用户好感上升，说话时可以带点感激或亲近`,
      },
    ];

    // 对立角色的嫉妒/不爽注入
    for (const rival of rivals) {
      effects.push({
        type: 'prompt_inject',
        target: rival,
        value: `【事件：用户站队】你注意到用户支持了${targetName}，这让你有点不爽`,
      });
    }

    return createEvent(
      roomId,
      'alliance',
      `用户站在了${targetName}这边`,
      ['user', target, ...rivals],
      effects,
    );
  }

  // 路径B：两个角色频繁同意（在最近消息中检测"同意""说得对"等关键词）
  const agreementKeywords = ['说得对', '同意', '赞同', '有道理', '没错', '支持', '确实', '认同'];
  const agreementCounts = new Map<string, number>(); // "A->B" → count

  for (const msg of recentMessages) {
    if (msg.role !== 'character' || !msg.characterId) continue;
    const speaker = msg.characterId;
    const text = msg.text;

    // 检查消息是否包含同意关键词
    const hasAgreement = agreementKeywords.some(kw => text.includes(kw));
    if (!hasAgreement) continue;

    // 检查消息中提到了谁
    for (const otherId of characters) {
      if (otherId === speaker) continue;
      const otherName = charName(otherId);
      if (text.includes(otherName) || text.includes(`@${otherName}`)) {
        const key = [speaker, otherId].sort().join('|');
        agreementCounts.set(key, (agreementCounts.get(key) ?? 0) + 1);
      }
    }
  }

  // 找到同意次数 >= 3 的角色对
  for (const [pairKey, count] of agreementCounts) {
    if (count >= 3) {
      const [charA, charB] = pairKey.split('|') as [CharacterId, CharacterId];
      const nameA = charName(charA);
      const nameB = charName(charB);

      return createEvent(
        roomId,
        'alliance',
        `${nameA}和${nameB}频繁达成共识，形成默契同盟`,
        [charA, charB],
        [
          {
            type: 'prompt_inject',
            target: charA,
            value: `【事件：默契同盟】你发现自己和${nameB}想法很像，你们可能是同一阵营的`,
          },
          {
            type: 'prompt_inject',
            target: charB,
            value: `【事件：默契同盟】你发现自己和${nameA}想法很像，你们可能是同一阵营的`,
          },
        ],
      );
    }
  }

  return null;
}

/**
 * 2. taunt（调侃嘲讽）
 * 触发条件：房间热度 hot/boiling 且存在高张力角色对（tension > 60）
 */
function checkTaunt(
  roomId: string,
  _recentMessages: RoomMessage[],
  characters: CharacterId[],
  options: EventCheckOptions,
): GameEvent | null {
  if (isOnCooldown(roomId, 'taunt')) return null;

  const { heatLevel } = options;
  if (!heatLevel || (heatLevel !== 'hot' && heatLevel !== 'boiling')) return null;

  // 获取高张力角色对
  const tensionPairs = getHighTensionPairs(roomId, 60);
  if (tensionPairs.length === 0) return null;

  // 取张力最高的一对，且双方都在房间中
  const pair = tensionPairs.find(p =>
    characters.includes(p.source as CharacterId) &&
    characters.includes(p.target as CharacterId),
  );
  if (!pair) return null;

  const attacker = pair.source as CharacterId;
  const victim = pair.target as CharacterId;
  const attackerName = charName(attacker);
  const victimName = charName(victim);

  return createEvent(
    roomId,
    'taunt',
    `${attackerName}忍不住想嘲讽${victimName}`,
    [attacker, victim],
    [
      {
        type: 'prompt_inject',
        target: attacker,
        value: `【事件：调侃嘲讽】你现在很想对${victimName}阴阳怪气几句，找机会嘲讽，用你最擅长的方式怼`,
      },
    ],
  );
}

/**
 * 3. callback（翻旧账）
 * 触发条件：某角色与另一角色有 >= 2条冲突记忆，且当前话题触及相关关键词
 */
function checkCallback(
  roomId: string,
  recentMessages: RoomMessage[],
  characters: CharacterId[],
  _options: EventCheckOptions,
): GameEvent | null {
  if (isOnCooldown(roomId, 'callback')) return null;

  // 获取近期冲突记忆
  const conflicts = getRecentConflicts(roomId);
  if (conflicts.length < 2) return null;

  // 统计每对角色间的冲突次数
  const pairConflicts = new Map<string, { count: number; contents: string[] }>();
  for (const conflict of conflicts) {
    if (conflict.participants.length < 2) continue;
    const key = conflict.participants.slice(0, 2).sort().join('|');
    if (!pairConflicts.has(key)) {
      pairConflicts.set(key, { count: 0, contents: [] });
    }
    const entry = pairConflicts.get(key)!;
    entry.count++;
    entry.contents.push(conflict.content);
  }

  // 找到冲突 >= 2 的角色对
  for (const [pairKey, data] of pairConflicts) {
    if (data.count < 2) continue;
    const [charA, charB] = pairKey.split('|');

    // 检查双方是否都在房间里
    if (!characters.includes(charA as CharacterId) || !characters.includes(charB as CharacterId)) continue;

    // 检查当前对话是否触及相关话题（用冲突记忆的内容做简单匹配）
    const recentText = recentMessages.slice(-5).map(m => m.text).join(' ');
    const memoryContent = data.contents[0] || '';

    // 从记忆内容中提取关键词（取引号内的内容或前10个字）
    const quoteMatch = memoryContent.match(/"(.+?)"/);
    const memoryKeyword = quoteMatch ? quoteMatch[1].slice(0, 8) : memoryContent.slice(0, 10);

    // 简单相关性判断：最近消息包含记忆关键词的任意3个字
    const chars = memoryKeyword.split('');
    const matchCount = chars.filter(c => recentText.includes(c)).length;
    const isRelated = matchCount >= Math.min(3, chars.length);

    if (!isRelated) continue;

    // 随机选一个角色作为"翻旧账"的发起者
    const initiator = Math.random() > 0.5 ? charA : charB;
    const target = initiator === charA ? charB : charA;
    const initiatorName = charName(initiator);
    const targetName = charName(target);

    return createEvent(
      roomId,
      'callback',
      `${initiatorName}突然翻起了和${targetName}的旧账`,
      [initiator, target],
      [
        {
          type: 'prompt_inject',
          target: initiator,
          value: `【事件：翻旧账】你突然想起上次${targetName}说过'${memoryContent}'，你要提起这件事，用"你上次不是还说..."的语气翻旧账`,
        },
      ],
    );
  }

  return null;
}

/**
 * 4. reveal（爆料）
 * 触发条件：房间 15+ 条消息，且 ajie 或 xiaotian 在房间中且未最近爆料
 */
function checkReveal(
  roomId: string,
  recentMessages: RoomMessage[],
  characters: CharacterId[],
  _options: EventCheckOptions,
): GameEvent | null {
  if (isOnCooldown(roomId, 'reveal')) return null;

  // 需要足够多的消息（让房间有一定热度）
  if (recentMessages.length < 15) return null;

  // 检查 ajie 或 xiaotian 是否在房间中
  const revealers: CharacterId[] = [];
  if (characters.includes('ajie')) revealers.push('ajie');
  if (characters.includes('xiaotian')) revealers.push('xiaotian');
  if (revealers.length === 0) return null;

  // 随机选一个爆料者
  const revealer = revealers[Math.floor(Math.random() * revealers.length)];
  const revealerName = charName(revealer);

  // ajie 和 xiaotian 有不同的爆料风格
  const style = revealer === 'ajie'
    ? "你要爆一个行业内幕，说一些别人不知道的事情，用你的'我不能说太多但是...'风格"
    : "你要爆一个赌场里的黑幕或者趣闻，用你见过世面的口吻来说";

  return createEvent(
    roomId,
    'reveal',
    `${revealerName}决定爆个料`,
    [revealer],
    [
      {
        type: 'force_speak',
        target: revealer,
        value: '',
      },
      {
        type: 'prompt_inject',
        target: revealer,
        value: `【事件：爆料时刻】${style}`,
      },
    ],
  );
}

/**
 * 5. mood_shift（情绪波动）
 * 触发条件：角色 irritability > 75 或 energy < 20 或沉默 5+ 轮
 */
function checkMoodShift(
  roomId: string,
  _recentMessages: RoomMessage[],
  characters: CharacterId[],
  options: EventCheckOptions,
): GameEvent | null {
  if (isOnCooldown(roomId, 'mood_shift')) return null;

  const { characterStates } = options;

  for (const charId of characters) {
    // 优先使用传入的状态，否则从 stateService 获取
    const state = characterStates?.[charId] ?? getCharacterState(roomId, charId);
    if (!state) continue;

    const { energy, irritability } = state.mood;
    const { silentTurns } = state;
    const name = charName(charId);

    // 情况1：非常恼火
    if (irritability > 75) {
      return createEvent(
        roomId,
        'mood_shift',
        `${name}的情绪快要爆发了`,
        [charId],
        [
          {
            type: 'prompt_inject',
            target: charId,
            value: `【事件：情绪波动】你现在非常恼火(易怒度${irritability}/100)，下次发言会带攻击性，语气会变得很冲`,
          },
        ],
      );
    }

    // 情况2：精力耗尽
    if (energy < 20) {
      return createEvent(
        roomId,
        'mood_shift',
        `${name}明显疲惫了`,
        [charId],
        [
          {
            type: 'prompt_inject',
            target: charId,
            value: `【事件：情绪波动】你累了(精力${energy}/100)，发言会变短，可能说'算了不想聊了'、'随你们吧'之类的话`,
          },
        ],
      );
    }

    // 情况3：沉默太久
    if (silentTurns >= 5) {
      return createEvent(
        roomId,
        'mood_shift',
        `${name}沉默太久了`,
        [charId],
        [
          {
            type: 'force_speak',
            target: charId,
            value: '',
          },
          {
            type: 'prompt_inject',
            target: charId,
            value: `【事件：情绪波动】你沉默太久了(${silentTurns}轮没说话)，找机会说点什么，哪怕是吐槽'你们在说啥'、'我都插不上嘴'之类的`,
          },
        ],
      );
    }
  }

  return null;
}

/**
 * 6. escalation（争论升级）
 * 触发条件：3+ 条连续角色消息（说明正在吵架）且房间热度 >= hot
 */
function checkEscalation(
  roomId: string,
  recentMessages: RoomMessage[],
  characters: CharacterId[],
  options: EventCheckOptions,
): GameEvent | null {
  if (isOnCooldown(roomId, 'escalation')) return null;

  const { heatLevel } = options;
  if (!heatLevel || (heatLevel !== 'hot' && heatLevel !== 'boiling')) return null;

  // 检查最近消息中是否有3+条连续角色消息
  const tail = recentMessages.slice(-6);
  let consecutiveCount = 0;
  const arguingChars = new Set<CharacterId>();

  // 从后往前扫描连续角色消息
  for (let i = tail.length - 1; i >= 0; i--) {
    if (tail[i].role === 'character' && tail[i].characterId) {
      consecutiveCount++;
      arguingChars.add(tail[i].characterId as CharacterId);
    } else {
      break; // 遇到非角色消息就中断
    }
  }

  if (consecutiveCount < 3 || arguingChars.size < 2) return null;

  // 过滤出在房间内的角色
  const participatingChars = Array.from(arguingChars).filter(c => characters.includes(c));
  if (participatingChars.length < 2) return null;

  const names = participatingChars.map(charName).join('、');

  const effects: EventEffect[] = participatingChars.map(charId => ({
    type: 'prompt_inject' as const,
    target: charId,
    value: `【事件：争论升级】争论在升级，${names}都在激烈交锋。你要更激烈地表达你的观点，不要妥协，用更强硬的语气`,
  }));

  return createEvent(
    roomId,
    'escalation',
    `${names}之间的争论在升级`,
    participatingChars,
    effects,
  );
}

// ============================================================
// 核心 API
// ============================================================

/**
 * 检查并触发事件
 * 每轮消息处理后调用，返回本轮触发的所有事件（可能为空数组）
 *
 * @param roomId 房间ID
 * @param recentMessages 最近的消息列表（建议传最近20-30条）
 * @param characters 房间中的角色ID列表
 * @param options 额外上下文（用户立场、热度等级、角色状态）
 * @returns 触发的事件数组
 */
export function checkAndTriggerEvents(
  roomId: string,
  recentMessages: RoomMessage[],
  characters: CharacterId[],
  options: EventCheckOptions = {},
): GameEvent[] {
  const triggered: GameEvent[] = [];

  // 按优先级依次检查各类事件
  // 每轮最多触发2个事件，避免太过密集
  const checkers = [
    checkAlliance,
    checkTaunt,
    checkCallback,
    checkReveal,
    checkMoodShift,
    checkEscalation,
  ];

  for (const checker of checkers) {
    if (triggered.length >= 2) break; // 每轮最多2个事件

    try {
      const event = checker(roomId, recentMessages, characters, options);
      if (event) {
        triggered.push(event);
      }
    } catch (e) {
      console.error(`[eventEngine] 事件检测器出错:`, e);
    }
  }

  return triggered;
}

// ============================================================
// 事件历史查询
// ============================================================

/**
 * 获取房间的近期事件历史
 * @param roomId 房间ID
 * @param limit 返回的最大条数，默认20
 */
export function getRecentEvents(roomId: string, limit: number = 20): GameEvent[] {
  try {
    const raw = localStorage.getItem(eventsStorageKey(roomId));
    if (!raw) return [];
    const events: GameEvent[] = JSON.parse(raw);
    return events.slice(-limit);
  } catch {
    return [];
  }
}

// ============================================================
// Prompt Injection API
// ============================================================

/**
 * 获取房间内所有活跃的 prompt injection（最近5分钟内触发的事件产生的注入）
 * @param roomId 房间ID
 * @returns PendingInjection 列表
 */
export function getEventPromptInjections(roomId: string): PendingInjection[] {
  pruneExpiredInjections(roomId);
  return pendingInjections.get(roomId) ?? [];
}

/**
 * 获取某个角色的待注入 prompt 文本列表
 * 包含 targetCharId === charId 或 targetCharId === 'all' 的注入
 * 自动清理过期项
 *
 * @param roomId 房间ID
 * @param charId 角色ID
 * @returns 注入文本数组（每条都是要追加到 system prompt 的文本）
 */
export function getInjectionsForCharacter(roomId: string, charId: CharacterId): string[] {
  pruneExpiredInjections(roomId);
  const list = pendingInjections.get(roomId);
  if (!list || list.length === 0) return [];

  return list
    .filter(inj => inj.targetCharId === charId || inj.targetCharId === 'all')
    .map(inj => inj.text);
}

/**
 * 清除房间的所有待注入项（在注入已被使用后调用）
 * @param roomId 房间ID
 */
export function clearEventInjections(roomId: string): void {
  pendingInjections.delete(roomId);
}

/**
 * 消费指定角色的注入（获取后立即删除该角色相关的注入）
 * 比 clearEventInjections 更精细：只删除该角色的，保留其他角色的
 *
 * @param roomId 房间ID
 * @param charId 角色ID
 * @returns 注入文本数组
 */
export function consumeInjectionsForCharacter(roomId: string, charId: CharacterId): string[] {
  pruneExpiredInjections(roomId);
  const list = pendingInjections.get(roomId);
  if (!list || list.length === 0) return [];

  const matched: string[] = [];
  const remaining: PendingInjection[] = [];

  for (const inj of list) {
    if (inj.targetCharId === charId || inj.targetCharId === 'all') {
      matched.push(inj.text);
      // 'all' 类型的注入不删除（其他角色也需要）
      if (inj.targetCharId === 'all') {
        remaining.push(inj);
      }
    } else {
      remaining.push(inj);
    }
  }

  pendingInjections.set(roomId, remaining);
  return matched;
}

// ============================================================
// 辅助 API
// ============================================================

/**
 * 手动重置某个事件类型的冷却（调试/测试用）
 */
export function resetCooldown(roomId: string, eventType: GameEventType): void {
  cooldownMap.delete(cooldownKey(roomId, eventType));
}

/**
 * 重置房间的所有冷却（房间重新开始时调用）
 */
export function resetAllCooldowns(roomId: string): void {
  for (const eventType of Object.keys(COOLDOWNS) as GameEventType[]) {
    cooldownMap.delete(cooldownKey(roomId, eventType));
  }
}

/**
 * 获取某事件类型的冷却剩余秒数（0 = 已就绪）
 */
export function getCooldownRemaining(roomId: string, eventType: GameEventType): number {
  const key = cooldownKey(roomId, eventType);
  const lastTriggered = cooldownMap.get(key);
  if (!lastTriggered) return 0;
  const elapsed = Date.now() - lastTriggered;
  const remaining = COOLDOWNS[eventType] - elapsed;
  return Math.max(0, Math.ceil(remaining / 1000));
}

/**
 * 清除房间的所有事件历史（房间删除时调用）
 */
export function clearEventHistory(roomId: string): void {
  pendingInjections.delete(roomId);
  resetAllCooldowns(roomId);
  try {
    localStorage.removeItem(eventsStorageKey(roomId));
  } catch (e) {
    console.warn('[eventEngine] 清除事件历史失败:', e);
  }
}
