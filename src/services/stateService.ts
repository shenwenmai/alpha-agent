// ============================================================
// 博弈圆桌 — 角色状态 & 房间热度追踪服务
// 实时追踪每个角色的心理状态（精力/易怒/参与/自信）
// 以及房间整体"热度"（对话激烈程度）
// localStorage 持久化，subscribe/notify 响应式模式
// ============================================================

import type {
  CharacterId,
  CharacterMood,
  CharacterState,
  HeatLevel,
  RoomHeat,
  RoomMessage,
} from '../types/room';
import { CHARACTER_MAP } from '../characters';

// ============================================================
// 存储键
// ============================================================

const STORAGE_PREFIX = 'roundtable_state_';

function storageKey(roomId: string): string {
  return `${STORAGE_PREFIX}${roomId}`;
}

// ============================================================
// 内部数据结构
// ============================================================

interface RoomStateData {
  characters: Partial<Record<CharacterId, CharacterState>>;
  heat: RoomHeat;
}

// 内存缓存（避免频繁 JSON.parse）
const stateCache = new Map<string, RoomStateData>();

// ============================================================
// 持久化
// ============================================================

function loadState(roomId: string): RoomStateData | null {
  // 先查内存缓存
  if (stateCache.has(roomId)) {
    return stateCache.get(roomId)!;
  }

  try {
    const raw = localStorage.getItem(storageKey(roomId));
    if (raw) {
      const data: RoomStateData = JSON.parse(raw);
      stateCache.set(roomId, data);
      return data;
    }
  } catch (e) {
    console.error('[stateService] 加载状态失败', roomId, e);
  }
  return null;
}

function saveState(roomId: string, data: RoomStateData): void {
  stateCache.set(roomId, data);
  try {
    localStorage.setItem(storageKey(roomId), JSON.stringify(data));
  } catch (e) {
    console.error('[stateService] 保存状态失败', roomId, e);
  }
}

// ============================================================
// Subscribe / Notify 模式（与 roomService、creditsService 一致）
// ============================================================

type Listener = () => void;
const listeners: Listener[] = [];

export function subscribeState(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx > -1) listeners.splice(idx, 1);
  };
}

function notify(): void {
  listeners.forEach(l => l());
}

// ============================================================
// 工具函数
// ============================================================

/** 将数值限制在 [min, max] 范围内 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** 根据角色性格生成初始心理状态 */
function getInitialMood(charId: CharacterId): CharacterMood {
  const char = CHARACTER_MAP[charId];

  // 基于 typingSpeed 设置初始精力
  // fast = 高精力，说话多且快的角色天然精力旺盛
  let energy = 80;
  if (char?.typingSpeed === 'fast') energy = 90;
  else if (char?.typingSpeed === 'slow') energy = 70;

  // 基于角色个性设置易怒度
  // 阿强、小芳：容易激动/情绪化 → 高易怒
  // 老张、军师：稳重沉着 → 低易怒
  const irritabilityMap: Partial<Record<CharacterId, number>> = {
    aqiang: 60,
    xiaofang: 55,
    dashiwang: 50,
    xiaotian: 40,
    ajie: 45,
    gailv: 25,
    laoliu: 35,
    kellyprof: 20,
    junshi: 15,
    laozhang: 20,
  };

  // 自信度：专业人士/权威角色高，底层角色低
  const confidenceMap: Partial<Record<CharacterId, number>> = {
    junshi: 85,
    kellyprof: 80,
    gailv: 75,
    dashiwang: 70,
    xiaofang: 50,
    ajie: 55,
    aqiang: 45,
    xiaotian: 60,
    laozhang: 40,
    laoliu: 30,
  };

  return {
    energy,
    irritability: irritabilityMap[charId] ?? 40,
    engagement: 50,  // 中性起始，话题相关性驱动后续变化
    confidence: confidenceMap[charId] ?? 50,
  };
}

/** 生成默认的房间热度 */
function getDefaultHeat(): RoomHeat {
  return {
    level: 'cold',
    score: 10,
    recentMessageCount: 0,
    conflictScore: 0,
    dominantCharacter: null,
    lastActivityAt: new Date().toISOString(),
  };
}

/** 根据分数判定热度等级 */
function scoreToHeatLevel(score: number): HeatLevel {
  if (score >= 80) return 'boiling';
  if (score >= 55) return 'hot';
  if (score >= 30) return 'warm';
  return 'cold';
}

// ============================================================
// 角色名称/关键词检测映射（用于 onUserMessage 判断是否@某人）
// ============================================================

function getCharacterKeywords(charId: CharacterId): string[] {
  const char = CHARACTER_MAP[charId];
  if (!char) return [];
  // 用角色的 shortName、name、triggerKeywords 中任一匹配
  const keywords = [char.shortName, char.name, ...char.triggerKeywords];
  return keywords;
}

// ============================================================
// 1. 初始化房间状态
// ============================================================

export function initRoomState(roomId: string, characters: CharacterId[]): void {
  const existing = loadState(roomId);
  if (existing) {
    // 已有状态，补充新加入的角色
    let changed = false;
    for (const charId of characters) {
      if (!existing.characters[charId]) {
        existing.characters[charId] = {
          mood: getInitialMood(charId),
          lastSpokeAt: null,
          silentTurns: 0,
          messageCount: 0,
          currentFocus: '',
          recentTargets: [],
        };
        changed = true;
      }
    }
    if (changed) {
      saveState(roomId, existing);
      notify();
    }
    return;
  }

  // 全新初始化
  const charStates: Partial<Record<CharacterId, CharacterState>> = {};
  for (const charId of characters) {
    charStates[charId] = {
      mood: getInitialMood(charId),
      lastSpokeAt: null,
      silentTurns: 0,
      messageCount: 0,
      currentFocus: '',
      recentTargets: [],
    };
  }

  const data: RoomStateData = {
    characters: charStates,
    heat: getDefaultHeat(),
  };

  saveState(roomId, data);
  notify();
}

// ============================================================
// 2. 获取单个角色状态
// ============================================================

export function getCharacterState(roomId: string, charId: CharacterId): CharacterState | null {
  const data = loadState(roomId);
  if (!data) return null;
  return data.characters[charId] ?? null;
}

// ============================================================
// 3. 获取房间热度
// ============================================================

export function getRoomHeat(roomId: string): RoomHeat | null {
  const data = loadState(roomId);
  if (!data) return null;
  return data.heat;
}

// ============================================================
// 4. 获取房间内所有角色状态
// ============================================================

export function getAllCharacterStates(
  roomId: string,
): Partial<Record<CharacterId, CharacterState>> | null {
  const data = loadState(roomId);
  if (!data) return null;
  return data.characters;
}

// ============================================================
// 5. 角色发言后更新状态
// ============================================================

export function onCharacterSpoke(
  roomId: string,
  charId: CharacterId,
  messageText: string,
): void {
  const data = loadState(roomId);
  if (!data) return;

  const state = data.characters[charId];
  if (state) {
    // 发言消耗精力
    state.mood.energy = clamp(state.mood.energy - 3, 0, 100);
    // 发言后参与度小幅提升
    state.mood.engagement = clamp(state.mood.engagement + 5, 0, 100);
    // 重置沉默轮数
    state.silentTurns = 0;
    state.messageCount += 1;
    state.lastSpokeAt = new Date().toISOString();

    // 提取消息中的话题焦点（取前20字作为简要关注点）
    if (messageText.length > 0) {
      state.currentFocus = messageText.slice(0, 20);
    }
  }

  // 其他角色的沉默轮数递增
  for (const [id, otherState] of Object.entries(data.characters)) {
    if (id !== charId && otherState) {
      otherState.silentTurns += 1;
    }
  }

  // 更新房间活跃时间
  data.heat.lastActivityAt = new Date().toISOString();
  data.heat.recentMessageCount += 1;
  data.heat.dominantCharacter = charId;

  saveState(roomId, data);
  notify();
}

// ============================================================
// 6. 用户发消息后更新状态
// ============================================================

export function onUserMessage(
  roomId: string,
  messageText: string,
  roomCharacters: CharacterId[],
): void {
  const data = loadState(roomId);
  if (!data) return;

  const msg = messageText.toLowerCase();

  // 检测用户是否提及特定角色
  for (const charId of roomCharacters) {
    const state = data.characters[charId];
    if (!state) continue;

    const keywords = getCharacterKeywords(charId);
    const isTargeted = keywords.some(kw => msg.includes(kw.toLowerCase()));

    if (isTargeted) {
      // 被点名的角色参与度大幅提升
      state.mood.engagement = clamp(state.mood.engagement + 15, 0, 100);
      // 自信度微调（被关注 = 被重视）
      state.mood.confidence = clamp(state.mood.confidence + 3, 0, 100);
    }
  }

  // 更新房间热度指标
  data.heat.recentMessageCount += 1;
  data.heat.lastActivityAt = new Date().toISOString();

  // 用户发言使热度分数小幅上升
  data.heat.score = clamp(data.heat.score + 5, 0, 100);
  data.heat.level = scoreToHeatLevel(data.heat.score);

  saveState(roomId, data);
  notify();
}

// ============================================================
// 7. 两个角色发生冲突
// ============================================================

export function onConflict(
  roomId: string,
  charA: CharacterId,
  charB: CharacterId,
): void {
  const data = loadState(roomId);
  if (!data) return;

  // 双方易怒度上升、参与度上升
  const stateA = data.characters[charA];
  const stateB = data.characters[charB];

  if (stateA) {
    stateA.mood.irritability = clamp(stateA.mood.irritability + 10, 0, 100);
    stateA.mood.engagement = clamp(stateA.mood.engagement + 15, 0, 100);
    // 记录最近互动目标
    stateA.recentTargets = [charB, ...stateA.recentTargets.filter(t => t !== charB)].slice(0, 5);
  }

  if (stateB) {
    stateB.mood.irritability = clamp(stateB.mood.irritability + 10, 0, 100);
    stateB.mood.engagement = clamp(stateB.mood.engagement + 15, 0, 100);
    stateB.recentTargets = [charA, ...stateB.recentTargets.filter(t => t !== charA)].slice(0, 5);
  }

  // 房间冲突分数上升
  data.heat.conflictScore = clamp(data.heat.conflictScore + 20, 0, 100);
  data.heat.score = clamp(data.heat.score + 15, 0, 100);
  data.heat.level = scoreToHeatLevel(data.heat.score);

  saveState(roomId, data);
  notify();
}

// ============================================================
// 8. 根据最近消息重新计算房间热度
// ============================================================

export function updateRoomHeat(roomId: string, messages: RoomMessage[]): void {
  const data = loadState(roomId);
  if (!data) return;

  const now = Date.now();
  const FIVE_MINUTES_MS = 5 * 60 * 1000;

  // 统计最近5分钟内的消息数
  const recentMessages = messages.filter(m => {
    const msgTime = new Date(m.timestamp).getTime();
    return now - msgTime <= FIVE_MINUTES_MS;
  });

  const count = recentMessages.length;
  data.heat.recentMessageCount = count;

  // 根据消息密度计算热度分数
  let densityScore: number;
  if (count >= 13) {
    densityScore = 90;  // boiling
  } else if (count >= 7) {
    densityScore = 65;  // hot
  } else if (count >= 3) {
    densityScore = 40;  // warm
  } else {
    densityScore = 15;  // cold
  }

  // 综合冲突分数和消息密度
  data.heat.score = clamp(
    Math.round(densityScore * 0.6 + data.heat.conflictScore * 0.4),
    0,
    100,
  );
  data.heat.level = scoreToHeatLevel(data.heat.score);

  // 找出最活跃的角色（最近5分钟发言最多的）
  const charCounts = new Map<CharacterId, number>();
  for (const msg of recentMessages) {
    if (msg.role === 'character' && msg.characterId) {
      const cid = msg.characterId as CharacterId;
      charCounts.set(cid, (charCounts.get(cid) ?? 0) + 1);
    }
  }

  let dominant: CharacterId | null = null;
  let maxCount = 0;
  charCounts.forEach((cnt, cid) => {
    if (cnt > maxCount) {
      maxCount = cnt;
      dominant = cid;
    }
  });
  data.heat.dominantCharacter = dominant;
  data.heat.lastActivityAt = new Date().toISOString();

  saveState(roomId, data);
  notify();
}

// ============================================================
// 9. 状态自然衰减（定时调用，建议每30-60秒一次）
// ============================================================

export function decayStates(roomId: string): void {
  const data = loadState(roomId);
  if (!data) return;

  for (const state of Object.values(data.characters)) {
    if (!state) continue;

    // 沉默角色精力缓慢恢复
    if (state.silentTurns > 0) {
      state.mood.energy = clamp(state.mood.energy + 2, 0, 100);
    }

    // 易怒度自然衰减（冷静下来）
    state.mood.irritability = clamp(state.mood.irritability - 3, 0, 100);

    // 参与度自然衰减（若无人互动则兴趣降低）
    state.mood.engagement = clamp(state.mood.engagement - 5, 0, 100);

    // 自信度缓慢回归中值（极高/极低都会慢慢修正）
    if (state.mood.confidence > 60) {
      state.mood.confidence = clamp(state.mood.confidence - 1, 0, 100);
    } else if (state.mood.confidence < 40) {
      state.mood.confidence = clamp(state.mood.confidence + 1, 0, 100);
    }
  }

  // 房间热度自然冷却
  data.heat.score = clamp(data.heat.score - 5, 0, 100);
  data.heat.conflictScore = clamp(data.heat.conflictScore - 3, 0, 100);
  data.heat.level = scoreToHeatLevel(data.heat.score);

  saveState(roomId, data);
  notify();
}

// ============================================================
// 10. 生成角色心理状态提示词注入
// ============================================================

export function getStatePromptInjection(roomId: string, charId: CharacterId): string {
  const state = getCharacterState(roomId, charId);
  if (!state) return '';

  const { energy, irritability, engagement, confidence } = state.mood;

  // 精力描述
  let energyDesc: string;
  if (energy >= 80) energyDesc = `精力充沛(${energy}/100)，你现在很想发言`;
  else if (energy >= 50) energyDesc = `精力尚可(${energy}/100)，状态正常`;
  else if (energy >= 25) energyDesc = `有些疲惫(${energy}/100)，话可以少说一点`;
  else energyDesc = `精力不足(${energy}/100)，你现在不太想说话`;

  // 易怒描述
  let irritDesc: string;
  if (irritability >= 70) irritDesc = `非常烦躁(${irritability}/100)，说话会很冲，容易发火`;
  else if (irritability >= 45) irritDesc = `有点被激怒了(${irritability}/100)，说话可能带刺`;
  else if (irritability >= 20) irritDesc = `情绪平稳(${irritability}/100)，说话比较正常`;
  else irritDesc = `心态平和(${irritability}/100)，语气温和`;

  // 参与度描述
  let engageDesc: string;
  if (engagement >= 75) engageDesc = `对当前话题很感兴趣(${engagement}/100)`;
  else if (engagement >= 45) engageDesc = `对话题有一定关注(${engagement}/100)`;
  else if (engagement >= 20) engageDesc = `对话题兴趣一般(${engagement}/100)，可能会走神`;
  else engageDesc = `对话题不太感兴趣(${engagement}/100)，可能会跑题或沉默`;

  // 自信度描述
  let confDesc: string;
  if (confidence >= 75) confDesc = `自信满满(${confidence}/100)`;
  else if (confidence >= 45) confDesc = `自信度正常(${confidence}/100)`;
  else if (confidence >= 20) confDesc = `有点没底气(${confidence}/100)，说话可能犹豫`;
  else confDesc = `很不自信(${confidence}/100)，可能会附和别人或退缩`;

  // 沉默轮数提示
  let silentHint = '';
  if (state.silentTurns >= 5) {
    silentHint = `\n- 你已经沉默了${state.silentTurns}轮，如果有想说的就说`;
  } else if (state.silentTurns >= 3) {
    silentHint = `\n- 你已经${state.silentTurns}轮没说话了`;
  }

  return [
    '【你当前的心理状态】',
    `- ${energyDesc}`,
    `- ${irritDesc}`,
    `- ${engageDesc}`,
    `- ${confDesc}`,
    silentHint,
  ].filter(Boolean).join('\n');
}

// ============================================================
// 11. 生成房间气氛提示词注入
// ============================================================

export function getHeatPromptInjection(roomId: string): string {
  const heat = getRoomHeat(roomId);
  if (!heat) return '';

  const dominantName = heat.dominantCharacter
    ? (CHARACTER_MAP[heat.dominantCharacter]?.shortName ?? heat.dominantCharacter)
    : null;

  let atmosphereDesc: string;
  switch (heat.level) {
    case 'boiling':
      atmosphereDesc = '当前气氛沸腾，所有人都在激烈争论，火药味很浓！';
      break;
    case 'hot':
      atmosphereDesc = '当前气氛火热，大家都在激烈讨论。';
      break;
    case 'warm':
      atmosphereDesc = '当前气氛温和，有一些讨论但不算激烈。';
      break;
    case 'cold':
    default:
      atmosphereDesc = '当前气氛冷清，需要有人活跃一下气氛。';
      break;
  }

  let conflictHint = '';
  if (heat.conflictScore >= 60) {
    conflictHint = '冲突指数很高，有明显的对立阵营。';
  } else if (heat.conflictScore >= 30) {
    conflictHint = '有一些争议，但还算可控。';
  }

  let dominantHint = '';
  if (dominantName && heat.level !== 'cold') {
    dominantHint = `最活跃的人是${dominantName}。`;
  }

  const parts = [
    `【房间气氛】${atmosphereDesc}`,
  ];
  if (conflictHint) parts.push(conflictHint);
  if (dominantHint) parts.push(dominantHint);
  parts.push(`(最近5分钟消息数: ${heat.recentMessageCount}，热度分: ${heat.score}/100)`);

  return parts.join('');
}

// ============================================================
// 辅助：清除房间状态（房间删除时调用）
// ============================================================

export function clearRoomState(roomId: string): void {
  stateCache.delete(roomId);
  try {
    localStorage.removeItem(storageKey(roomId));
  } catch (e) {
    console.error('[stateService] 清除状态失败', roomId, e);
  }
}
