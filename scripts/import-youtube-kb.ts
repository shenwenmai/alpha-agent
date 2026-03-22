#!/usr/bin/env npx tsx
// ============================================================
// import-youtube-kb.ts — 导入频道脚本知识块
//
// 导入:
//   1. data_thinking_chunks.jsonl      (数据思考 9条)
//   2. kelly_paper_chunks.jsonl        (凯利论文 8条)
//   3. script_greycontrol_kelly_chunks.jsonl (灰控+凯利对话 4条)
//   4. script_casino_psychology_chunks.jsonl (赌场心理学 6条)
//
// 用法:
//   OPENAI_API_KEY=sk-xxx SUPABASE_SERVICE_KEY=xxx npx tsx scripts/import-youtube-kb.ts
//
// 不删除现有数据，仅 upsert 新条目
// ============================================================

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OPENAI_URL = "https://api.openai.com/v1/embeddings";
const EMBED_MODEL = "text-embedding-3-small";
const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://yuzvxmhdzhgdrygfqqkk.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const OPENAI_KEY = process.env.OPENAI_API_KEY || "";
const DATA_DIR = path.join(__dirname, "..", "data");
const BATCH_SIZE = 50;

interface ChunkToImport {
  id: string;
  content: string;
  metadata: Record<string, any>;
  tag: string;
}

// --- 读取 JSONL (新格式: {id, text, metadata: {tag, source}}) ---
function readJsonl(filePath: string): any[] {
  if (!fs.existsSync(filePath)) {
    console.warn(`  WARN: ${filePath} not found, skipping`);
    return [];
  }
  const lines = fs.readFileSync(filePath, "utf8").split("\n").filter(l => l.trim());
  return lines.map((line, i) => {
    try { return JSON.parse(line); }
    catch { console.error(`  Parse error line ${i + 1}`); return null; }
  }).filter(Boolean);
}

// --- 加载所有频道脚本知识块 ---
function loadYoutubeKB(): ChunkToImport[] {
  const chunks: ChunkToImport[] = [];
  const files = [
    "data_thinking_chunks.jsonl",
    "kelly_paper_chunks.jsonl",
    "script_greycontrol_kelly_chunks.jsonl",
    "script_casino_psychology_chunks.jsonl",
  ];

  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);
    const data = readJsonl(filePath);
    for (const e of data) {
      chunks.push({
        id: e.id,
        content: e.text,
        metadata: e.metadata || {},
        tag: e.metadata?.tag || "intervention",
      });
    }
    console.log(`  ${file}: ${data.length} 条`);
  }

  return chunks;
}

// --- OpenAI 批量 embedding ---
async function batchEmbed(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    console.log(
      `  Embedding batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(texts.length / BATCH_SIZE)} (${batch.length} texts)...`
    );
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: EMBED_MODEL,
        input: batch.map(t => t.slice(0, 8000)),
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Embedding API ${res.status}: ${err.slice(0, 200)}`);
    }
    const data = await res.json();
    const embeddings = data.data
      .sort((a: any, b: any) => a.index - b.index)
      .map((d: any) => d.embedding);
    results.push(...embeddings);
    if (i + BATCH_SIZE < texts.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  return results;
}

// --- Supabase upsert ---
async function upsertChunks(
  chunks: ChunkToImport[],
  embeddings: number[][]
): Promise<{ ok: number; fail: number }> {
  let ok = 0, fail = 0;
  const UPSERT_BATCH = 20;
  for (let i = 0; i < chunks.length; i += UPSERT_BATCH) {
    const batch = chunks.slice(i, i + UPSERT_BATCH);
    const batchEmb = embeddings.slice(i, i + UPSERT_BATCH);
    const rows = batch.map((chunk, idx) => ({
      id: chunk.id,
      content: chunk.content,
      metadata: { ...chunk.metadata, tag: chunk.tag },
      embedding: JSON.stringify(batchEmb[idx]),
    }));
    const res = await fetch(`${SUPABASE_URL}/rest/v1/kb_chunks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(rows),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`  Upsert batch ${i}-${i + batch.length} failed:`, err.slice(0, 200));
      fail += batch.length;
    } else {
      ok += batch.length;
    }
    if (i + UPSERT_BATCH < chunks.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }
  return { ok, fail };
}

// --- 主流程 ---
async function main() {
  console.log("=== 频道脚本知识库 增量导入 ===\n");

  if (!OPENAI_KEY) { console.error("ERROR: OPENAI_API_KEY not set"); process.exit(1); }
  if (!SUPABASE_KEY) { console.error("ERROR: SUPABASE_SERVICE_KEY not set"); process.exit(1); }

  // 1. 读取
  console.log("[1/3] 读取知识库文件...");
  const chunks = loadYoutubeKB();
  console.log(`  共 ${chunks.length} 条\n`);
  if (chunks.length === 0) { console.error("ERROR: No data found"); process.exit(1); }

  // Tag 分布
  const tagCounts: Record<string, number> = {};
  for (const c of chunks) {
    tagCounts[c.tag] = (tagCounts[c.tag] || 0) + 1;
  }
  console.log("  Tag 分布:", JSON.stringify(tagCounts));

  // 2. Embedding
  console.log("\n[2/3] 生成 embedding...");
  const texts = chunks.map(c => c.content);
  const embeddings = await batchEmbed(texts);
  console.log(`  生成 ${embeddings.length} 个 embedding\n`);

  // 3. Upsert
  console.log("[3/3] 写入 Supabase (增量 upsert)...");
  const result = await upsertChunks(chunks, embeddings);
  console.log(`  成功: ${result.ok}, 失败: ${result.fail}\n`);

  console.log("=== 导入完成 ===");
  console.log(`  总条目: ${chunks.length}`);
  console.log(`  Tag 分布: ${JSON.stringify(tagCounts)}`);
}

main().catch(console.error);
