// ============================================================
// 用户站队检测器 — 分析用户消息中的立场倾向
// ============================================================

import type { CharacterId, UserStance, UserStanceType } from '../types/room';
import { CHARACTER_MAP } from '../characters';

// 支持性关键词
const SUPPORT_KEYWORDS = [
  '说得对', '同意', '有道理', '赞同', '没错', '支持', '认同', '确实',
  '说的好', '靠谱', '牛', '厉害', '有料', '专业', '对对对', '真的',
  '我也觉得', '就是这样', '精辟', '学到了', '原来如此', '涨知识',
  '说到点上了', '说到我心坎', '你说得对', '我站', '挺你',
];

// 反对性关键词
const OPPOSE_KEYWORDS = [
  '不同意', '你错了', '胡说', '放屁', '扯淡', '瞎说', '不对', '别扯',
  '你懂什么', '少来', '不信', '骗人', '忽悠', '你这', '滚', '闭嘴',
  '算了吧', '得了吧', '我反对', '不认同', '有问题', '不靠谱',
  '你别', '不是这样', '你又来了', '你总是',
];

// 挑拨性关键词
const PROVOKE_KEYWORDS = [
  '你们继续吵', '打起来', '开撕', '互怼', '来来来', '有本事',
  '你敢不敢', '不服来战', '我倒要看看', '继续', '加油吵',
  '火药味', '别停', '精彩', '好看',
];

// 调停性关键词
const MEDIATE_KEYWORDS = [
  '别吵了', '都有道理', '各有各的', '冷静', '算了', '和气',
  '别急', '慢慢说', '理性讨论', '都对', '每个人', '理解',
  '站在他的角度', '换位思考', '两边都',
];

// 好奇性关键词
const CURIOUS_KEYWORDS = [
  '为什么', '怎么回事', '什么意思', '真的假的', '是吗',
  '展开说说', '详细说', '怎么看', '什么情况', '能解释',
  '好奇', '想知道', '然后呢', '后来呢',
];

// 检测消息中提到了哪些角色
function detectMentionedCharacters(
  message: string,
  roomCharacters: CharacterId[],
): CharacterId[] {
  const mentioned: CharacterId[] = [];
  for (const charId of roomCharacters) {
    const char = CHARACTER_MAP[charId];
    if (!char) continue;
    if (
      message.includes(char.shortName) ||
      message.includes(char.name) ||
      message.includes(`@${char.shortName}`)
    ) {
      mentioned.push(charId);
    }
  }
  return mentioned;
}

// 计算关键词匹配分数
function matchScore(message: string, keywords: string[]): number {
  let score = 0;
  for (const kw of keywords) {
    if (message.includes(kw)) score++;
  }
  return score;
}

/**
 * 分析用户消息中的立场倾向
 * 返回检测到的立场（可能为neutral）
 */
export function detectUserStance(
  message: string,
  roomCharacters: CharacterId[],
  recentCharacterMessages?: Array<{ characterId: CharacterId; text: string }>,
): UserStance {
  const mentioned = detectMentionedCharacters(message, roomCharacters);

  const supportScore = matchScore(message, SUPPORT_KEYWORDS);
  const opposeScore = matchScore(message, OPPOSE_KEYWORDS);
  const provokeScore = matchScore(message, PROVOKE_KEYWORDS);
  const mediateScore = matchScore(message, MEDIATE_KEYWORDS);
  const curiousScore = matchScore(message, CURIOUS_KEYWORDS);

  // 找出最高分
  const scores: Array<{ type: UserStanceType; score: number }> = [
    { type: 'support', score: supportScore },
    { type: 'oppose', score: opposeScore },
    { type: 'provoke', score: provokeScore },
    { type: 'mediate', score: mediateScore },
    { type: 'curious', score: curiousScore },
  ];

  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];

  // 如果没有明显立场
  if (best.score === 0) {
    // 检查是否在回复最近的角色消息（隐式互动）
    // 如果最近有角色发言且用户紧接着说话，可能是在回应
    if (recentCharacterMessages && recentCharacterMessages.length > 0) {
      const lastChar = recentCharacterMessages[recentCharacterMessages.length - 1];
      return {
        type: 'neutral',
        targetCharacter: lastChar.characterId,
        confidence: 0.2,
      };
    }
    return { type: 'neutral', confidence: 0.1 };
  }

  // 确定目标角色
  let targetCharacter: CharacterId | undefined;

  if (mentioned.length === 1) {
    // 明确提到一个角色
    targetCharacter = mentioned[0];
  } else if (mentioned.length === 0 && recentCharacterMessages && recentCharacterMessages.length > 0) {
    // 没提到角色名，但可能在回应最近发言的角色
    const lastChar = recentCharacterMessages[recentCharacterMessages.length - 1];
    targetCharacter = lastChar.characterId;
  }

  const totalScore = scores.reduce((sum, s) => sum + s.score, 0);
  const confidence = Math.min(best.score / Math.max(totalScore, 1), 1);

  return {
    type: best.type,
    targetCharacter,
    confidence: Math.max(confidence, 0.3),
  };
}

/**
 * 从一组消息中检测角色间的互动关系（同意/冲突）
 * 用于记忆和关系系统
 */
export function detectCharacterInteractions(
  messages: Array<{ characterId: CharacterId; text: string }>,
): Array<{
  type: 'conflict' | 'agreement';
  charA: CharacterId;
  charB: CharacterId;
  evidence: string;
}> {
  const interactions: Array<{
    type: 'conflict' | 'agreement';
    charA: CharacterId;
    charB: CharacterId;
    evidence: string;
  }> = [];

  for (let i = 1; i < messages.length; i++) {
    const current = messages[i];
    const prev = messages[i - 1];

    if (current.characterId === prev.characterId) continue;

    const text = current.text;

    // 检测冲突
    const conflictScore = matchScore(text, OPPOSE_KEYWORDS);
    if (conflictScore >= 1) {
      interactions.push({
        type: 'conflict',
        charA: current.characterId,
        charB: prev.characterId,
        evidence: text.slice(0, 50),
      });
      continue;
    }

    // 检测同意
    const agreeScore = matchScore(text, SUPPORT_KEYWORDS);
    if (agreeScore >= 1) {
      interactions.push({
        type: 'agreement',
        charA: current.characterId,
        charB: prev.characterId,
        evidence: text.slice(0, 50),
      });
    }
  }

  return interactions;
}
