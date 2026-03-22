/**
 * 将 corpus.json 导入 Supabase 向量知识库
 *
 * 使用方法（二选一）：
 *
 * 方式1: 在浏览器 Console 中运行（推荐，最简单）
 *   打开 https://realcost-app.vercel.app/
 *   F12 → Console → 粘贴并运行下面的 fetch 代码
 *
 * 方式2: 用 Node.js 运行此脚本
 *   npx tsx scripts/ingest-corpus.ts
 */

import corpus from '../data/corpus.json';

const API_URL = process.env.API_URL || 'https://realcost-app.vercel.app';

async function main() {
  console.log(`Ingesting ${corpus.length} chunks...`);

  // 分批发送，每批 5 条（避免超时）
  const BATCH_SIZE = 5;

  for (let i = 0; i < corpus.length; i += BATCH_SIZE) {
    const batch = corpus.slice(i, i + BATCH_SIZE).map(c => ({
      id: c.id,
      text: c.text,
      metadata: {
        type: c.type,
        emotion: c.emotion,
        cognitive_summary: c.cognitive_summary,
        b_role_advice: c.b_role_advice,
        danger_signals: c.danger_signals,
        vocabulary: c.vocabulary,
      },
    }));

    console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: chunks ${i + 1}-${Math.min(i + BATCH_SIZE, corpus.length)}`);

    const res = await fetch(`${API_URL}/api/kb-ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chunks: batch }),
    });

    const data = await res.json();
    console.log(`  → imported: ${data.imported}/${data.total}`);

    if (data.results) {
      data.results.forEach((r: any) => {
        if (r.status !== 'ok') console.log(`  ⚠ ${r.id}: ${r.status}`);
      });
    }

    // 等 1 秒避免 rate limit
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('Done!');
}

main().catch(console.error);
