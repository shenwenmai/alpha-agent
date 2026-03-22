// ============================================================
// 博弈圆桌 — 用户身份追踪 & FOMO 系统
// 跟踪用户行为模式，构建"群体身份"，管理错过恐惧机制
// 纯本地 localStorage，不调用任何 API
// ============================================================

import type {
  CharacterId,
  UserStanceType,
  UserIdentity,
  RoomMessage,
} from '../types/room';
import { CHARACTER_MAP } from '../characters';

// ============================================================
// 常量
// ============================================================

const STORAGE_KEY = 'roundtable_user_identity';
const MAX_STANCE_HISTORY = 100;

// 冲突检测关键词（用于 FOMO 摘要中扫描冲突）
const CONFLICT_KEYWORDS = [
  '你胡说', '你错了', '不同意', '放屁', '扯淡', '瞎说',
  '你懂什么', '少来', '闭嘴', '滚', '你别', '废话',
  '笑话', '扯', '忽悠', '骗人', '胡扯', '你算什么',
  '笑死', '可笑', '别搞笑', '吵', '怼',
];

// 戏剧性/高潮关键词（用于 FOMO 中检测精彩时刻）
const DRAMATIC_KEYWORDS = [
  '爆料', '真相', '其实', '告诉你们', '你们不知道',
  '秘密', '内幕', '我认输', '你赢了', '服了',
  '大家听我说', '我有证据', '数据说话', '血的教训',
];

// ============================================================
// 内存缓存
// ============================================================

let cachedIdentity: UserIdentity | null = null;

// ============================================================
// 订阅/通知模式
// ============================================================

type IdentityListener = (identity: UserIdentity) => void;
const listeners: Set<IdentityListener> = new Set();

/** 订阅用户身份变更 */
export function subscribeIdentity(fn: IdentityListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** 通知所有订阅者 */
function notify(identity: UserIdentity): void {
  listeners.forEach(fn => fn(identity));
}

// ============================================================
// 存储读写
// ============================================================

/** 保存身份数据到 localStorage */
function saveIdentity(identity: UserIdentity): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
    cachedIdentity = identity;
  } catch {
    console.warn('[userIdentityService] localStorage 写入失败，可能已满');
  }
}

/** 从 localStorage 加载身份数据 */
function loadIdentity(): UserIdentity | null {
  // 优先使用内存缓存
  if (cachedIdentity) return cachedIdentity;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      cachedIdentity = JSON.parse(raw);
      return cachedIdentity;
    }
    return null;
  } catch {
    return null;
  }
}

/** 创建空白身份 */
function createEmptyIdentity(): UserIdentity {
  return {
    totalMessages: 0,
    favoriteCharacter: null,
    identityTags: [],
    stanceHistory: [],
    characterRelations: {},
  };
}

// ============================================================
// 工具函数
// ============================================================

/** 获取角色显示短名 */
function charName(id: string): string {
  if (id === 'user') return '用户';
  return CHARACTER_MAP[id]?.shortName || id;
}

/** 确保角色关系条目存在 */
function ensureRelation(
  identity: UserIdentity,
  charId: CharacterId,
): void {
  if (!identity.characterRelations[charId]) {
    identity.characterRelations[charId] = {
      affinity: 0,
      interactionCount: 0,
      supportCount: 0,
      opposeCount: 0,
    };
  }
}

// ============================================================
// 1. initUserIdentity — 初始化或从 localStorage 加载
// ============================================================

/** 初始化用户身份，如果已有存档则加载，否则创建新的 */
export function initUserIdentity(): UserIdentity {
  const existing = loadIdentity();
  if (existing) return existing;

  const identity = createEmptyIdentity();
  saveIdentity(identity);
  notify(identity);
  return identity;
}

// ============================================================
// 2. getUserIdentity — 获取当前身份
// ============================================================

/** 获取当前用户身份（如未初始化则自动初始化） */
export function getUserIdentity(): UserIdentity {
  return loadIdentity() || initUserIdentity();
}

// ============================================================
// 3. onUserMessage — 追踪用户消息
// ============================================================

/**
 * 用户发送消息后调用，更新消息总数和角色互动计数
 * @param _roomId 房间ID（保留参数，未来可做房间级统计）
 * @param message 消息文本
 * @param characters 当前房间中的角色列表
 */
export function onUserMessage(
  _roomId: string,
  message: string,
  characters: CharacterId[],
): void {
  const identity = getUserIdentity();

  // 总消息数+1
  identity.totalMessages++;

  // 检测消息中提到了哪些角色，增加互动计数
  for (const charId of characters) {
    const char = CHARACTER_MAP[charId];
    if (!char) continue;

    // 检测是否提到该角色（角色名、短名、@提及）
    const mentioned =
      message.includes(char.shortName) ||
      message.includes(char.name) ||
      message.includes(`@${char.shortName}`);

    if (mentioned) {
      ensureRelation(identity, charId);
      identity.characterRelations[charId]!.interactionCount++;
    }
  }

  // 如果没有明确提到任何角色，但房间只有少数角色，给所有角色加微小互动
  // （用户发言本身就是一种参与）
  const mentionedAny = characters.some(cid => {
    const c = CHARACTER_MAP[cid];
    return c && (message.includes(c.shortName) || message.includes(c.name));
  });

  if (!mentionedAny && characters.length > 0) {
    // 给最近发言的角色加互动（简化：给第一个角色加）
    // 实际场景中应该配合 recentCharacterMessages 来判断
  }

  // 重新计算最爱角色
  recalculateFavoriteCharacter(identity);

  // 重新计算身份标签
  recalculateIdentityTags(identity);

  // 保存并通知
  saveIdentity(identity);
  notify(identity);
}

// ============================================================
// 4. recordStance — 记录用户立场
// ============================================================

/**
 * 记录用户的一次立场表达
 * @param stance 立场类型
 * @param target 针对的角色（可选）
 */
export function recordStance(
  stance: UserStanceType,
  target?: CharacterId,
): void {
  const identity = getUserIdentity();

  // 添加到立场历史（保留最近 100 条）
  identity.stanceHistory.push({
    stance,
    target,
    timestamp: new Date().toISOString(),
  });
  if (identity.stanceHistory.length > MAX_STANCE_HISTORY) {
    identity.stanceHistory = identity.stanceHistory.slice(-MAX_STANCE_HISTORY);
  }

  // 更新角色关系中的支持/反对计数
  if (target) {
    ensureRelation(identity, target);
    const relation = identity.characterRelations[target]!;

    if (stance === 'support') {
      relation.supportCount++;
      relation.affinity = Math.min(100, relation.affinity + 2);
    } else if (stance === 'oppose') {
      relation.opposeCount++;
      relation.affinity = Math.max(-100, relation.affinity - 2);
    } else if (stance === 'provoke') {
      // 拱火对好感影响较小，但增加互动
      relation.affinity = Math.max(-100, relation.affinity - 1);
    } else if (stance === 'mediate') {
      // 调停微微增加好感
      relation.affinity = Math.min(100, relation.affinity + 1);
    }

    // 所有有目标的立场都算一次互动
    relation.interactionCount++;
  }

  // 重新计算最爱角色
  recalculateFavoriteCharacter(identity);

  // 重新计算身份标签
  recalculateIdentityTags(identity);

  // 保存并通知
  saveIdentity(identity);
  notify(identity);
}

// ============================================================
// 身份标签计算
// ============================================================

/**
 * 根据立场历史和消息数据重新计算身份标签
 * 规则：
 *   "拱火王" — provoke >= 5
 *   "调停者" — mediate >= 5
 *   "理性派" — support junshi/gailv/kellyprof >= 5
 *   "经验党" — support aqiang >= 5
 *   "正义使者" — oppose dashiwang/xiaotian >= 5
 *   "暖心人" — support laoliu/xiaofang/laozhang >= 5
 *   "好奇宝宝" — curious >= 8
 *   "老玩家" — totalMessages >= 100
 *   "话题达人" — totalMessages >= 50
 */
function recalculateIdentityTags(identity: UserIdentity): void {
  const tags: string[] = [];
  const history = identity.stanceHistory;

  // 统计各种立场出现次数
  let provokeCount = 0;
  let mediateCount = 0;
  let curiousCount = 0;

  // 统计对特定角色的支持/反对
  const supportByChar: Partial<Record<CharacterId, number>> = {};
  const opposeByChar: Partial<Record<CharacterId, number>> = {};

  for (const entry of history) {
    if (entry.stance === 'provoke') provokeCount++;
    if (entry.stance === 'mediate') mediateCount++;
    if (entry.stance === 'curious') curiousCount++;

    if (entry.target) {
      if (entry.stance === 'support') {
        supportByChar[entry.target] = (supportByChar[entry.target] || 0) + 1;
      }
      if (entry.stance === 'oppose') {
        opposeByChar[entry.target] = (opposeByChar[entry.target] || 0) + 1;
      }
    }
  }

  // 拱火王：provoke 立场 >= 5 次
  if (provokeCount >= 5) tags.push('拱火王');

  // 调停者：mediate 立场 >= 5 次
  if (mediateCount >= 5) tags.push('调停者');

  // 理性派：支持军师/概率哥/Kelly教授 总计 >= 5 次
  const rationalSupport =
    (supportByChar['junshi'] || 0) +
    (supportByChar['gailv'] || 0) +
    (supportByChar['kellyprof'] || 0);
  if (rationalSupport >= 5) tags.push('理性派');

  // 经验党：支持阿强 >= 5 次
  if ((supportByChar['aqiang'] || 0) >= 5) tags.push('经验党');

  // 正义使者：反对大师王/小天 总计 >= 5 次
  const justiceOppose =
    (opposeByChar['dashiwang'] || 0) +
    (opposeByChar['xiaotian'] || 0);
  if (justiceOppose >= 5) tags.push('正义使者');

  // 暖心人：支持老刘/小芳/老张 总计 >= 5 次
  const warmSupport =
    (supportByChar['laoliu'] || 0) +
    (supportByChar['xiaofang'] || 0) +
    (supportByChar['laozhang'] || 0);
  if (warmSupport >= 5) tags.push('暖心人');

  // 好奇宝宝：curious 立场 >= 8 次
  if (curiousCount >= 8) tags.push('好奇宝宝');

  // 老玩家：总消息数 >= 100
  if (identity.totalMessages >= 100) tags.push('老玩家');

  // 话题达人：总消息数 >= 50
  if (identity.totalMessages >= 50) tags.push('话题达人');

  identity.identityTags = tags;
}

/** 根据互动次数重新计算最爱角色 */
function recalculateFavoriteCharacter(identity: UserIdentity): void {
  let maxInteraction = 0;
  let favorite: CharacterId | null = null;

  const relations = identity.characterRelations;
  for (const charId of Object.keys(relations) as CharacterId[]) {
    const rel = relations[charId];
    if (rel && rel.interactionCount > maxInteraction) {
      maxInteraction = rel.interactionCount;
      favorite = charId;
    }
  }

  identity.favoriteCharacter = favorite;
}

// ============================================================
// 5. generateFOMOSummary — 错过恐惧摘要生成
// ============================================================

/**
 * 根据用户不在时的消息生成 FOMO 摘要（纯本地文本拼接，不调用 API）
 * @param _roomId 房间ID（保留参数）
 * @param missedMessages 用户离开期间的消息列表
 * @returns 中文摘要字符串，如果不值得提醒则返回 null
 */
export function generateFOMOSummary(
  _roomId: string,
  missedMessages: RoomMessage[],
): string | null {
  // 只看角色消息（排除 system 和 user）
  const charMessages = missedMessages.filter(
    m => m.role === 'character' && m.characterId,
  );

  // 少于 3 条角色消息，不值得提醒
  if (charMessages.length < 3) return null;

  // 统计各角色发言数
  const charCounts: Partial<Record<CharacterId, number>> = {};
  for (const msg of charMessages) {
    const cid = msg.characterId as CharacterId;
    charCounts[cid] = (charCounts[cid] || 0) + 1;
  }

  // 找出最活跃的角色（按发言数排序）
  const activeChars = (Object.entries(charCounts) as [CharacterId, number][])
    .sort((a, b) => b[1] - a[1]);
  const topChars = activeChars.slice(0, 3);
  const topCharNames = topChars.map(([cid]) => charName(cid));

  // 检测冲突：扫描消息文本中的冲突关键词
  const conflictPairs: Array<{ charA: string; charB: string; keyword: string }> = [];
  for (let i = 1; i < charMessages.length; i++) {
    const current = charMessages[i];
    const prev = charMessages[i - 1];
    if (current.characterId === prev.characterId) continue;

    for (const kw of CONFLICT_KEYWORDS) {
      if (current.text.includes(kw)) {
        conflictPairs.push({
          charA: charName(current.characterId!),
          charB: charName(prev.characterId!),
          keyword: kw,
        });
        break; // 每对只记一次
      }
    }
  }

  // 检测戏剧性时刻
  let dramaticMoment: { charName: string; snippet: string } | null = null;
  for (const msg of charMessages) {
    for (const kw of DRAMATIC_KEYWORDS) {
      if (msg.text.includes(kw)) {
        const snippet = msg.text.length > 30
          ? msg.text.substring(0, 30) + '...'
          : msg.text;
        dramaticMoment = {
          charName: charName(msg.characterId!),
          snippet,
        };
        break;
      }
    }
    if (dramaticMoment) break; // 只取第一个戏剧性时刻
  }

  // 提取话题关键词（取第一条消息的前10个字作为话题线索）
  const topicHint = charMessages[0].text.length > 10
    ? charMessages[0].text.substring(0, 10) + '...'
    : charMessages[0].text;

  const count = charMessages.length;

  // ---- 3-6 条消息：简短提醒 ----
  if (count <= 6) {
    const charList = topCharNames.join('和');
    if (conflictPairs.length > 0) {
      const cp = conflictPairs[0];
      return `你不在时，${cp.charA}和${cp.charB}起了点小摩擦，${charList}聊了几句关于"${topicHint}"的话题。`;
    }
    return `你不在时，${charList}聊了几句关于"${topicHint}"的话题。`;
  }

  // ---- 7-15 条消息：中等详细，提及冲突/共识 ----
  if (count <= 15) {
    let summary = `你不在的时候，`;

    if (conflictPairs.length > 0) {
      const cp = conflictPairs[0];
      summary += `${cp.charA}和${cp.charB}又吵起来了！`;

      // 尝试找到冲突消息的具体内容
      const conflictMsg = charMessages.find(m =>
        m.text.includes(cp.keyword) &&
        charName(m.characterId!) === cp.charA,
      );
      if (conflictMsg) {
        const snippet = conflictMsg.text.length > 25
          ? conflictMsg.text.substring(0, 25) + '...'
          : conflictMsg.text;
        summary += `${cp.charA}说"${snippet}"，`;
      }

      // 找调停者（如果有军师或老刘发言）
      const mediators = charMessages.filter(m =>
        m.characterId === 'junshi' || m.characterId === 'laoliu',
      );
      if (mediators.length > 0) {
        summary += `${charName(mediators[0].characterId!)}最后出来说了句公道话。`;
      } else {
        summary += `场面一度很热闹。`;
      }
    } else {
      const charList = topCharNames.join('、');
      summary += `${charList}围绕"${topicHint}"聊了不少。`;
      if (dramaticMoment) {
        summary += `${dramaticMoment.charName}还说了句"${dramaticMoment.snippet}"。`;
      }
    }

    return summary;
  }

  // ---- 15+ 条消息：大讨论提醒，高亮最精彩时刻 ----
  let summary = `你错过了一场大讨论！${count}条消息的激烈交锋。`;

  // 参与者总览
  const allParticipants = activeChars.map(([cid]) => charName(cid)).join('、');
  summary += `参与者有${allParticipants}。`;

  // 冲突高亮
  if (conflictPairs.length > 0) {
    const cp = conflictPairs[0];
    summary += `其中${cp.charA}和${cp.charB}的争论最激烈。`;
  }

  // 戏剧性时刻
  if (dramaticMoment) {
    summary += `最精彩的是${dramaticMoment.charName}说的"${dramaticMoment.snippet}"。`;
  }

  // 多次冲突
  if (conflictPairs.length > 1) {
    summary += `一共发生了${conflictPairs.length}次冲突，火药味十足！`;
  }

  return summary;
}

// ============================================================
// 6. getUserPromptInjection — 生成通用用户画像注入
// ============================================================

/**
 * 生成关于用户的通用描述，注入到角色 prompt 中
 * 注意：这是通用版本，不区分角色。角色特定版本用 getUserPromptForCharacter
 */
export function getUserPromptInjection(): string {
  const identity = getUserIdentity();

  // 如果用户还没有足够的互动，返回空
  if (identity.totalMessages < 3) return '';

  const lines: string[] = ['【关于用户的了解】'];

  // 活跃度描述
  if (identity.totalMessages >= 100) {
    lines.push(`- 这个用户非常活跃(发了${identity.totalMessages}条消息)，是个老玩家了`);
  } else if (identity.totalMessages >= 50) {
    lines.push(`- 这个用户比较活跃(发了${identity.totalMessages}条消息)`);
  } else if (identity.totalMessages >= 20) {
    lines.push(`- 这个用户参与了一段时间(发了${identity.totalMessages}条消息)`);
  } else {
    lines.push(`- 这个用户还比较新(发了${identity.totalMessages}条消息)`);
  }

  // 最爱角色
  if (identity.favoriteCharacter) {
    lines.push(`- 他最喜欢和${charName(identity.favoriteCharacter)}互动`);
  }

  // 身份标签
  if (identity.identityTags.length > 0) {
    const tagStr = identity.identityTags.map(t => `"${t}"`).join('、');
    lines.push(`- 他的标签：${tagStr}`);
  }

  // 主要立场倾向
  const stanceSummary = getMostCommonStance(identity);
  if (stanceSummary) {
    const stanceLabels: Record<UserStanceType, string> = {
      support: '经常支持别人',
      oppose: '经常反对别人',
      provoke: '喜欢拱火看热闹',
      mediate: '喜欢调停和事',
      curious: '充满好奇心',
      neutral: '态度比较中立',
    };
    lines.push(`- 他${stanceLabels[stanceSummary]}`);
  }

  return lines.join('\n');
}

// ============================================================
// 7. getUserPromptForCharacter — 角色特定的用户描述
// ============================================================

/**
 * 生成针对特定角色的用户关系描述
 * 不同角色看到的用户画像不同，取决于用户与该角色的互动历史
 * @param charId 目标角色ID
 */
export function getUserPromptForCharacter(charId: CharacterId): string {
  const identity = getUserIdentity();

  // 互动不够，返回空
  if (identity.totalMessages < 3) return '';

  const relation = identity.characterRelations[charId];
  const lines: string[] = [];

  if (!relation || relation.interactionCount === 0) {
    // 从未互动过
    lines.push(`用户和你还没有太多互动，你对他还不了解。`);
    return lines.join('\n');
  }

  // 根据好感度描述关系
  if (relation.affinity >= 20) {
    lines.push(`用户是你的支持者，对你好感度高（互动${relation.interactionCount}次，支持${relation.supportCount}次）。`);
  } else if (relation.affinity <= -20) {
    lines.push(`用户经常反对你，你们关系紧张（互动${relation.interactionCount}次，反对${relation.opposeCount}次）。`);
  } else {
    lines.push(`用户对你态度一般，还在观察（互动${relation.interactionCount}次）。`);
  }

  // 补充支持/反对细节
  if (relation.supportCount > 0 && relation.opposeCount > 0) {
    lines.push(`他有时支持你(${relation.supportCount}次)，有时反对你(${relation.opposeCount}次)，态度摇摆。`);
  } else if (relation.supportCount > relation.opposeCount + 3) {
    lines.push(`他是你的铁杆支持者。`);
  } else if (relation.opposeCount > relation.supportCount + 3) {
    lines.push(`他几乎总是跟你唱反调，要小心应对。`);
  }

  // 用户的总体身份标签（让角色知道用户是什么类型的人）
  if (identity.identityTags.length > 0) {
    const tagStr = identity.identityTags.map(t => `"${t}"`).join('、');
    lines.push(`这个用户的风格标签：${tagStr}。`);
  }

  return lines.join('\n');
}

// ============================================================
// 8. getUserStats — 汇总统计
// ============================================================

export interface UserStats {
  totalMessages: number;
  favoriteCharacter: CharacterId | null;
  identityTags: string[];
  topSupportedCharacters: Array<{ charId: CharacterId; count: number }>;
  topOpposedCharacters: Array<{ charId: CharacterId; count: number }>;
  mostCommonStance: UserStanceType | null;
}

/** 获取用户统计摘要 */
export function getUserStats(): UserStats {
  const identity = getUserIdentity();

  // 提取支持排行
  const supportList: Array<{ charId: CharacterId; count: number }> = [];
  const opposeList: Array<{ charId: CharacterId; count: number }> = [];

  const relations = identity.characterRelations;
  for (const charId of Object.keys(relations) as CharacterId[]) {
    const rel = relations[charId];
    if (!rel) continue;

    if (rel.supportCount > 0) {
      supportList.push({ charId, count: rel.supportCount });
    }
    if (rel.opposeCount > 0) {
      opposeList.push({ charId, count: rel.opposeCount });
    }
  }

  // 按次数降序排列
  supportList.sort((a, b) => b.count - a.count);
  opposeList.sort((a, b) => b.count - a.count);

  return {
    totalMessages: identity.totalMessages,
    favoriteCharacter: identity.favoriteCharacter,
    identityTags: [...identity.identityTags],
    topSupportedCharacters: supportList,
    topOpposedCharacters: opposeList,
    mostCommonStance: getMostCommonStance(identity),
  };
}

// ============================================================
// 内部工具：最常见立场
// ============================================================

/** 从立场历史中计算最常见的立场类型 */
function getMostCommonStance(identity: UserIdentity): UserStanceType | null {
  if (identity.stanceHistory.length === 0) return null;

  const counts: Record<UserStanceType, number> = {
    support: 0,
    oppose: 0,
    provoke: 0,
    mediate: 0,
    curious: 0,
    neutral: 0,
  };

  for (const entry of identity.stanceHistory) {
    counts[entry.stance]++;
  }

  // 找出最多的立场（排除 neutral，因为 neutral 不够有信息量）
  let maxCount = 0;
  let maxStance: UserStanceType | null = null;

  for (const stance of Object.keys(counts) as UserStanceType[]) {
    if (stance === 'neutral') continue;
    if (counts[stance] > maxCount) {
      maxCount = counts[stance];
      maxStance = stance;
    }
  }

  // 如果所有非 neutral 立场都是 0，返回 neutral
  if (maxCount === 0 && counts.neutral > 0) return 'neutral';

  return maxStance;
}

// ============================================================
// 导出便捷方法：重置身份（调试用）
// ============================================================

/** 重置用户身份数据（仅用于调试/测试） */
export function resetUserIdentity(): void {
  const identity = createEmptyIdentity();
  saveIdentity(identity);
  notify(identity);
  console.log('[userIdentityService] 用户身份已重置');
}
