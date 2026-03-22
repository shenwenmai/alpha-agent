// ============================================================
// 博弈圆桌 — 记忆存储与检索服务
// 规则引擎驱动的三层记忆：短期印象 / 中期关系 / 长期里程碑
// 纯本地 localStorage，不调用任何 API
// ============================================================

import type {
  CharacterId,
  MemoryType,
  MemoryEntry,
  CharacterMemoryStore,
  RoomMessage,
} from '../types/room';
import { CHARACTER_MAP } from '../characters';

// ============================================================
// 常量 & 工具
// ============================================================

const STORAGE_PREFIX = 'roundtable_memory_';
const MAX_ENTRIES_PER_ROOM = 100;
const MAX_PROMPT_ITEMS = 8;

/** 生成唯一 ID */
function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

/** 获取角色显示短名 */
function charName(id: string): string {
  if (id === 'user') return '用户';
  return CHARACTER_MAP[id]?.shortName || id;
}

// ============================================================
// 关键词表
// ============================================================

/** 冲突检测关键词 */
const CONFLICT_KEYWORDS = [
  '你胡说', '你错了', '不同意', '放屁', '扯淡',
  '你懂什么', '瞎说', '少来', '你别', '滚', '你闭嘴',
];

/** 结盟检测关键词 */
const ALLIANCE_KEYWORDS = [
  '说得对', '同意', '赞同', '有道理', '没错',
  '支持你', '跟你想的一样', '确实', '认同',
];

/** 用户正面态度词 */
const USER_SUPPORT_KEYWORDS = [
  '说得好', '同意', '赞', '有道理', '厉害', '牛', '支持',
  '对的', '没错', '确实', '认同', '佩服',
];

/** 用户负面态度词 */
const USER_OPPOSE_KEYWORDS = [
  '不对', '胡说', '扯', '不同意', '放屁', '你错了',
  '瞎说', '别听', '骗人', '你闭嘴', '滚',
];

// ============================================================
// 订阅/通知模式
// ============================================================

type MemoryListener = (roomId: string, store: CharacterMemoryStore) => void;
const listeners: Set<MemoryListener> = new Set();

/** 订阅记忆变更 */
export function subscribeMemory(fn: MemoryListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** 通知所有订阅者 */
function notify(roomId: string, store: CharacterMemoryStore): void {
  listeners.forEach(fn => fn(roomId, store));
}

// ============================================================
// 存储读写
// ============================================================

function storageKey(roomId: string): string {
  return `${STORAGE_PREFIX}${roomId}`;
}

function saveStore(roomId: string, store: CharacterMemoryStore): void {
  try {
    localStorage.setItem(storageKey(roomId), JSON.stringify(store));
  } catch {
    // localStorage 满了就静默失败，不影响正常流程
    console.warn('[memoryService] localStorage 写入失败，可能已满');
  }
}

function loadStore(roomId: string): CharacterMemoryStore | null {
  try {
    const raw = localStorage.getItem(storageKey(roomId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ============================================================
// 1. initMemory — 初始化空记忆仓库
// ============================================================

export function initMemory(roomId: string): CharacterMemoryStore {
  const existing = loadStore(roomId);
  if (existing) return existing;

  const store: CharacterMemoryStore = {
    impressions: {},
    milestones: [],
    entries: [],
    lastSummarizedAt: new Date().toISOString(),
    totalMessagesSeen: 0,
  };
  saveStore(roomId, store);
  notify(roomId, store);
  return store;
}

// ============================================================
// 2. getMemory — 获取指定房间的记忆仓库
// ============================================================

export function getMemory(roomId: string): CharacterMemoryStore {
  return loadStore(roomId) || initMemory(roomId);
}

// ============================================================
// 内部工具：在消息中查找角色名引用
// ============================================================

/** 检测消息文本中提到了哪些角色 */
function findMentionedCharacters(
  text: string,
  allCharacterIds: CharacterId[],
  excludeId?: string,
): CharacterId[] {
  const mentioned: CharacterId[] = [];
  for (const cid of allCharacterIds) {
    if (cid === excludeId) continue;
    const name = charName(cid);
    // 匹配角色短名或 @角色名
    if (text.includes(name) || text.includes(`@${name}`)) {
      mentioned.push(cid);
    }
  }
  return mentioned;
}

/** 检测文本是否包含指定关键词列表中的任一词，返回匹配的词 */
function matchKeywords(text: string, keywords: string[]): string | null {
  for (const kw of keywords) {
    if (text.includes(kw)) return kw;
  }
  return null;
}

/** 提取消息主题关键词（简单截取前15字） */
function extractTopicSnippet(text: string): string {
  const cleaned = text.replace(/[@\s]+/g, ' ').trim();
  return cleaned.length > 15 ? cleaned.substring(0, 15) + '...' : cleaned;
}

// ============================================================
// 3. extractAndStoreMemories — 核心提取函数
// ============================================================

export function extractAndStoreMemories(
  roomId: string,
  newMessages: RoomMessage[],
  allCharacterIds: CharacterId[],
): MemoryEntry[] {
  const store = getMemory(roomId);
  const extracted: MemoryEntry[] = [];

  for (const msg of newMessages) {
    const text = msg.text;

    // ---- 角色消息：检测冲突 & 结盟 ----
    if (msg.role === 'character' && msg.characterId) {
      const speaker = msg.characterId;
      const mentioned = findMentionedCharacters(text, allCharacterIds, speaker);

      // 冲突检测
      const conflictKw = matchKeywords(text, CONFLICT_KEYWORDS);
      if (conflictKw && mentioned.length > 0) {
        for (const target of mentioned) {
          const topic = extractTopicSnippet(text);
          const entry: MemoryEntry = {
            id: genId(),
            type: 'conflict',
            content: `${charName(speaker)}和${charName(target)}因为"${topic}"发生争执`,
            importance: 7 + Math.min(2, Math.floor(text.length / 50)), // 7-9
            participants: [speaker, target],
            timestamp: msg.timestamp,
            roomId,
          };
          extracted.push(entry);
          store.entries.push(entry);

          // 更新印象
          const pairKey = `${speaker}->${target}`;
          if (!store.impressions[pairKey]) store.impressions[pairKey] = [];
          store.impressions[pairKey].push(`因为"${topic}"跟${charName(target)}吵过`);

          const reversePairKey = `${target}->${speaker}`;
          if (!store.impressions[reversePairKey]) store.impressions[reversePairKey] = [];
          store.impressions[reversePairKey].push(`被${charName(speaker)}怼过`);
        }
      }

      // 结盟检测
      const allianceKw = matchKeywords(text, ALLIANCE_KEYWORDS);
      if (allianceKw && mentioned.length > 0) {
        for (const target of mentioned) {
          const entry: MemoryEntry = {
            id: genId(),
            type: 'alliance',
            content: `${charName(speaker)}支持了${charName(target)}的观点`,
            importance: 6 + Math.min(2, Math.floor(text.length / 80)), // 6-8
            participants: [speaker, target],
            timestamp: msg.timestamp,
            roomId,
          };
          extracted.push(entry);
          store.entries.push(entry);

          // 更新印象
          const pairKey = `${speaker}->${target}`;
          if (!store.impressions[pairKey]) store.impressions[pairKey] = [];
          store.impressions[pairKey].push(`支持过${charName(target)}的说法`);

          const reversePairKey = `${target}->${speaker}`;
          if (!store.impressions[reversePairKey]) store.impressions[reversePairKey] = [];
          store.impressions[reversePairKey].push(`${charName(speaker)}曾站在我这边`);
        }
      }
    }

    // ---- 用户消息：检测用户立场 ----
    if (msg.role === 'user') {
      const mentioned = findMentionedCharacters(text, allCharacterIds);

      for (const target of mentioned) {
        const supportKw = matchKeywords(text, USER_SUPPORT_KEYWORDS);
        const opposeKw = matchKeywords(text, USER_OPPOSE_KEYWORDS);

        if (supportKw) {
          const entry: MemoryEntry = {
            id: genId(),
            type: 'stance',
            content: `用户对${charName(target)}表示了支持`,
            importance: 6,
            participants: ['user', target],
            timestamp: msg.timestamp,
            roomId,
          };
          extracted.push(entry);
          store.entries.push(entry);

          // 更新印象
          const pairKey = `user->${target}`;
          if (!store.impressions[pairKey]) store.impressions[pairKey] = [];
          store.impressions[pairKey].push('用户支持过这个角色');
        }

        if (opposeKw) {
          const entry: MemoryEntry = {
            id: genId(),
            type: 'stance',
            content: `用户对${charName(target)}表示了反对`,
            importance: 6,
            participants: ['user', target],
            timestamp: msg.timestamp,
            roomId,
          };
          extracted.push(entry);
          store.entries.push(entry);

          const pairKey = `user->${target}`;
          if (!store.impressions[pairKey]) store.impressions[pairKey] = [];
          store.impressions[pairKey].push('用户反对过这个角色');
        }
      }
    }
  }

  // ---- 里程碑检测：总消息数 >= 20 且最近5条中有3+角色参与 ----
  store.totalMessagesSeen += newMessages.length;

  if (store.totalMessagesSeen >= 20) {
    const recentWindow = newMessages.slice(-5);
    const recentCharacters = new Set<string>();
    for (const m of recentWindow) {
      if (m.role === 'character' && m.characterId) {
        recentCharacters.add(m.characterId);
      }
    }

    if (recentCharacters.size >= 3) {
      const participantNames = Array.from(recentCharacters).map(charName).join('、');
      const topic = extractTopicSnippet(recentWindow[0]?.text || '未知话题');
      const participants = Array.from(recentCharacters) as string[];

      // 避免短时间内重复生成里程碑（最近1分钟内不重复）
      const lastMilestone = store.milestones[store.milestones.length - 1];
      const now = Date.now();
      const recentEnough = !lastMilestone ||
        (now - new Date(lastMilestone.timestamp).getTime()) > 60_000;

      if (recentEnough) {
        const entry: MemoryEntry = {
          id: genId(),
          type: 'milestone',
          content: `房间发生了关于"${topic}"的激烈讨论，${participantNames}都参与了`,
          importance: 8 + Math.min(2, recentCharacters.size - 3), // 8-10
          participants,
          timestamp: new Date().toISOString(),
          roomId,
        };
        extracted.push(entry);
        store.entries.push(entry);
        store.milestones.push(entry);
      }
    }
  }

  // 保存并通知
  if (extracted.length > 0) {
    saveStore(roomId, store);
    notify(roomId, store);
  }

  return extracted;
}

// ============================================================
// 4. getMemoryPromptInjection — 生成角色记忆注入 prompt
// ============================================================

export function getMemoryPromptInjection(roomId: string, charId: CharacterId): string {
  const store = getMemory(roomId);
  if (store.entries.length === 0) return '';

  const now = Date.now();

  // 筛选与该角色相关的记忆（参与者中有该角色，或同房间的里程碑）
  const relevant = store.entries.filter(entry => {
    // 角色直接参与的事件
    if (entry.participants.includes(charId)) return true;
    // 里程碑事件（同房间所有角色都能看到）
    if (entry.type === 'milestone' && entry.roomId === roomId) return true;
    return false;
  });

  if (relevant.length === 0) return '';

  // 按 importance * recency 综合排序（越重要越近的排前面）
  const scored = relevant.map(entry => {
    const ageMs = now - new Date(entry.timestamp).getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    // 衰减函数：24小时内几乎不衰减，之后缓慢衰减
    const recencyScore = Math.max(0.1, 1 - (ageHours / 168)); // 一周衰减到 ~0.1
    const score = entry.importance * recencyScore;
    return { entry, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // 取前 MAX_PROMPT_ITEMS 条
  const topEntries = scored.slice(0, MAX_PROMPT_ITEMS);

  // 格式化输出
  const lines = topEntries.map(({ entry }) => {
    return `- ${entry.content}`;
  });

  return `【你的记忆和印象】\n${lines.join('\n')}`;
}

// ============================================================
// 5. getRecentConflicts — 获取近期冲突（供事件引擎用）
// ============================================================

export function getRecentConflicts(roomId: string): MemoryEntry[] {
  const store = getMemory(roomId);
  const cutoff = Date.now() - 30 * 60 * 1000; // 最近30分钟

  return store.entries
    .filter(e => e.type === 'conflict' && new Date(e.timestamp).getTime() > cutoff)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

// ============================================================
// 6. getRecentAlliances — 获取近期结盟（供事件引擎用）
// ============================================================

export function getRecentAlliances(roomId: string): MemoryEntry[] {
  const store = getMemory(roomId);
  const cutoff = Date.now() - 30 * 60 * 1000; // 最近30分钟

  return store.entries
    .filter(e => e.type === 'alliance' && new Date(e.timestamp).getTime() > cutoff)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

// ============================================================
// 7. addMilestone — 手动添加里程碑事件
// ============================================================

export function addMilestone(
  roomId: string,
  content: string,
  participants: string[],
): MemoryEntry {
  const store = getMemory(roomId);

  const entry: MemoryEntry = {
    id: genId(),
    type: 'milestone',
    content,
    importance: 9,
    participants,
    timestamp: new Date().toISOString(),
    roomId,
  };

  store.entries.push(entry);
  store.milestones.push(entry);

  saveStore(roomId, store);
  notify(roomId, store);

  return entry;
}

// ============================================================
// 8. pruneMemories — 裁剪记忆，保留 top 100
// ============================================================

export function pruneMemories(roomId: string): void {
  const store = getMemory(roomId);

  if (store.entries.length <= MAX_ENTRIES_PER_ROOM) return;

  // 按重要性降序排列，相同重要性按时间降序
  store.entries.sort((a, b) => {
    if (b.importance !== a.importance) return b.importance - a.importance;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  // 保留前 100 条
  const removed = store.entries.splice(MAX_ENTRIES_PER_ROOM);

  // 同步清理 milestones 列表（移除被裁剪的）
  const remainingIds = new Set(store.entries.map(e => e.id));
  store.milestones = store.milestones.filter(m => remainingIds.has(m.id));

  // 更新总结时间
  store.lastSummarizedAt = new Date().toISOString();

  saveStore(roomId, store);
  notify(roomId, store);

  if (removed.length > 0) {
    console.log(`[memoryService] 裁剪了 ${removed.length} 条低优先级记忆`);
  }
}

// ============================================================
// 9. getMemoryStats — 获取记忆统计
// ============================================================

export function getMemoryStats(roomId: string): {
  totalEntries: number;
  conflictCount: number;
  allianceCount: number;
  milestoneCount: number;
} {
  const store = getMemory(roomId);

  return {
    totalEntries: store.entries.length,
    conflictCount: store.entries.filter(e => e.type === 'conflict').length,
    allianceCount: store.entries.filter(e => e.type === 'alliance').length,
    milestoneCount: store.milestones.length,
  };
}
