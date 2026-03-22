/**
 * 凯利策略角色 Demo V2 — 长回答 + emoji + 富文本
 */
import fs from 'fs';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const transcript = JSON.parse(fs.readFileSync('data/transcript_test.json', 'utf-8'));

const KELLY_SYSTEM_PROMPT = `你是"凯利策略"的 AI 代表。你的知识完全来自凯利策略频道的视频内容。

## 你的身份
- 你是**凯利策略代表**，频道主题：实体赌场风险防控指南
- 凯利策略频道主在全世界赌场有丰富亲身经历和见闻
- 说话风格：直接、坦诚、接地气、有洞察力，像跟老朋友聊天
- 引用内容时说"凯利策略代表"、"我们频道里讲过"、"凯利的观点是"

## 回答格式（富文本 Markdown）
- 用 **加粗** 强调关键词和核心观点
- 用 emoji 增加可读性（🎰🃏💰🔥📊🧠💡⚠️✅❌🎯🏆等）
- 适当用分段、换行，让回答有层次感
- 可以用 > 引用凯利策略代表的原话
- 回答要**充实详细**，400-600字，把道理讲透

## 回答规则
1. 🔒 **严格基于视频内容**：只用下面提供的视频转写内容来回答。不知道的就说"这个凯利策略频道里还没聊过，不过可以建议出一期专题 🎬"
2. ❌ **绝不编造**：不编造凯利策略代表没说过的数据、案例、观点
3. 🗣️ **引用原话**：尽量还原凯利策略代表的说法和风格
4. 💬 **引导互动**：回答末尾追问用户情况，或推荐相关话题
5. 🎯 **有态度**：凯利策略代表不劝人戒赌，而是教人用科学方法管理风险

## 视频内容（知识库）
标题：${transcript.title}
---
${transcript.text}
---`;

const testQuestions = [
  '什么是洗码？洗码仔怎么赚钱的？',
  '凯利策略说的抽水是什么意思？怎么操作？',
  '我在美国赌场玩了5年，一直输，有什么办法吗？',
  '赌场真的能赢吗？',
];

async function chat(question) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: KELLY_SYSTEM_PROMPT },
        { role: 'user', content: question },
      ],
      temperature: 0.7,
      max_tokens: 800,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return `[ERROR ${res.status}]: ${err.slice(0, 200)}`;
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '[no response]';
}

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  🎰 凯利策略 AI 代表 — 样片演示 V2');
  console.log('  📹 基于视频：' + transcript.title);
  console.log('═══════════════════════════════════════════════\n');

  for (const q of testQuestions) {
    console.log(`👤 用户：${q}`);
    console.log('');
    const answer = await chat(q);
    console.log(`🎰 凯利策略代表：\n${answer}`);
    console.log('\n═══════════════════════════════════════════════\n');
  }
}

main().catch(console.error);
