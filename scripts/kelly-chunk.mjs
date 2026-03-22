/**
 * 用 GPT 把视频转写内容智能切块 — 生成知识库条目
 */
import fs from 'fs';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const transcript = JSON.parse(fs.readFileSync('data/transcript_test.json', 'utf-8'));

const CHUNK_PROMPT = `你是一个知识库编辑。你的任务是把下面的视频转写内容切成独立的知识块，每块可以单独回答一个用户问题。

## 切块规则
1. 每块 300-800 字，内容完整，能独立理解
2. 去掉口语重复、口误、无意义填充词（"啊"、"嗯"、"那个"），但保留说话风格
3. 每块必须有一个明确的主题
4. 保留关键数字、案例、具体操作步骤
5. 如果原文有计算/演示过程，整理成清晰的步骤

## 输出格式（JSON数组）
[
  {
    "chunk_id": "kelly_vid01_01",
    "title": "这块内容的标题（10字以内）",
    "topic": "主题关键词（用于检索）",
    "content": "整理后的知识块内容",
    "value_tags": ["这块能回答什么类型的问题"],
    "timestamp_range": "大概的视频时间范围，如 0:00-1:30"
  }
]

## 视频信息
标题：${transcript.title}
时长：${Math.round(transcript.duration / 60)}分钟

## 视频转写全文
${transcript.text}

请输出切好的 JSON 数组，尽量切 6-10 块。`;

async function main() {
  console.log('🔪 正在用 GPT 智能切块...\n');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: '你是知识库内容编辑，输出纯 JSON，不加 markdown 代码块标记。' },
        { role: 'user', content: CHUNK_PROMPT },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('❌ API error:', err.slice(0, 300));
    return;
  }

  const data = await res.json();
  let raw = data.choices?.[0]?.message?.content || '';

  // 清理可能的 markdown 代码块
  raw = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  const chunks = JSON.parse(raw);

  // 保存
  fs.writeFileSync('data/chunks_test.json', JSON.stringify(chunks, null, 2), 'utf-8');

  // 打印预览
  console.log(`✅ 切出 ${chunks.length} 块知识条目\n`);
  console.log('═══════════════════════════════════════════════\n');

  for (const c of chunks) {
    console.log(`📌 [${c.chunk_id}] ${c.title}`);
    console.log(`   主题: ${c.topic}`);
    console.log(`   时间: ${c.timestamp_range}`);
    console.log(`   可回答: ${c.value_tags.join(' / ')}`);
    console.log(`   ── 内容 ──`);
    console.log(`   ${c.content}`);
    console.log(`\n───────────────────────────────────────────────\n`);
  }
}

main().catch(console.error);
