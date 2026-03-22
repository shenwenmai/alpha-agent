// ============================================================
// conversationSummarizer — 会话历史压缩
//
// 策略：最近 RAW_WINDOW 轮保留原文，更早的消息滚动摘要
// 目标：token 成本降 40-60%（20 轮原文 → 8 轮原文 + 1 段摘要）
// ============================================================

import type { ChatMessage } from './geminiService';

const RAW_WINDOW = 8;          // 保留最近 8 条原文
const SUMMARY_MAX_CHARS = 600; // 摘要最大字符数

// --- 滚动摘要 (本地压缩，不调 LLM) ---
// 从较旧的消息中提取关键事实，拼接为简短上下文

function extractKeyFacts(msg: ChatMessage): string {
  const text = msg.text;
  const facts: string[] = [];

  // 金额
  const moneyMatch = text.match(/([亏输赢赚损失花借贷充值]了?)\s*(\d[\d,.]*)\s*([万千百块元美金美元港币]?)/);
  if (moneyMatch) {
    facts.push(`${moneyMatch[1]}${moneyMatch[2]}${moneyMatch[3]}`);
  }

  // 时间
  const timeMatch = text.match(/(昨[天晚]|今[天晚]|上周|这周|前天|大前天|[上下]午|凌晨|半夜|\d+[天月年号日])/);
  if (timeMatch) {
    facts.push(timeMatch[0]);
  }

  // 行为
  const behaviorMatch = text.match(/(追[了损]|加[了码注]|借[了钱]|停[不了下]|梭哈|翻本|戒[了赌]|封[了盘号]|离[了场桌])/);
  if (behaviorMatch) {
    facts.push(behaviorMatch[0]);
  }

  // 情绪
  const emotionMatch = text.match(/(崩溃|绝望|后悔|害怕|焦虑|愤怒|麻木|不甘|想死|扛不住|受不了)/);
  if (emotionMatch) {
    facts.push(`情绪:${emotionMatch[0]}`);
  }

  return facts.join('·');
}

/**
 * 压缩会话历史
 * @param fullHistory 完整对话历史
 * @returns 压缩后的消息数组 (摘要 + 最近原文)
 */
export function compressHistory(
  fullHistory: ChatMessage[],
): ChatMessage[] {
  // 不超过 RAW_WINDOW 条，直接返回
  if (fullHistory.length <= RAW_WINDOW) {
    return fullHistory;
  }

  const olderMessages = fullHistory.slice(0, fullHistory.length - RAW_WINDOW);
  const recentMessages = fullHistory.slice(-RAW_WINDOW);

  // 从旧消息提取关键事实
  const summaryParts: string[] = [];
  for (const msg of olderMessages) {
    const prefix = msg.role === 'user' ? 'U' : 'A';
    const facts = extractKeyFacts(msg);
    if (facts) {
      summaryParts.push(`[${prefix}]${facts}`);
    }
  }

  // 如果没有提取到任何事实，做最简摘要
  let summaryText: string;
  if (summaryParts.length === 0) {
    summaryText = `[对话摘要] 前${olderMessages.length}轮对话，用户在讨论赌博相关经历。`;
  } else {
    summaryText = `[对话摘要·前${olderMessages.length}轮关键事实] ${summaryParts.join(' | ')}`;
  }

  // 限制摘要长度
  if (summaryText.length > SUMMARY_MAX_CHARS) {
    summaryText = summaryText.slice(0, SUMMARY_MAX_CHARS - 3) + '...';
  }

  // 摘要作为第一条 system-like user message
  const summaryMessage: ChatMessage = {
    id: '__summary__',
    role: 'user',
    text: summaryText,
  };

  return [summaryMessage, ...recentMessages];
}

/**
 * 获取压缩统计
 */
export function getCompressionStats(fullLength: number, compressedLength: number) {
  return {
    original: fullLength,
    compressed: compressedLength,
    saved: fullLength - compressedLength,
    ratio: fullLength > 0 ? +((1 - compressedLength / fullLength) * 100).toFixed(1) : 0,
  };
}
