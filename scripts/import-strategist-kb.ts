#!/usr/bin/env npx tsx
// ============================================================
// import-strategist-kb.ts — 增量导入博弈军师知识库
//
// 导入:
//   1. kelly_qrc_samples_v1.jsonl  (凯利策略实战量化风控 30条)
//   2. sunzi_36_samples_v1.jsonl   (孙子兵法+36计 60条)
//   3. grey_control_samples_v1.jsonl (赌场灰控/作弊教育 20条)
//   4. gambler_cognition_v1.jsonl  (赌徒真实认知/群聊提炼 5条)
//
// 用法:
//   OPENAI_API_KEY=sk-xxx SUPABASE_SERVICE_KEY=xxx npx tsx scripts/import-strategist-kb.ts
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
  embeddingText: string;
  metadata: Record<string, any>;
  tag: string;
}

// --- 读取 JSONL ---
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

// --- 加载博弈军师知识库 ---
function loadStrategistKB(): ChunkToImport[] {
  const chunks: ChunkToImport[] = [];

  // 1. 凯利策略 (30条)
  const kellyPath = path.join(DATA_DIR, "kelly_qrc_samples_v1.jsonl");
  const kellyData = readJsonl(kellyPath);
  for (const e of kellyData) {
    chunks.push({
      id: e.id,
      content: e.response,
      embeddingText: `${e.title} ${e.局面维度} ${e.时间维度} ${e.action} ${e.response}`,
      metadata: {
        source: "kelly_quant_risk_control",
        framework: e.framework,
        title: e.title,
        scene: e.局面维度,
        time: e.时间维度,
        emotion: e.情绪维度,
        finance: e.资金维度,
        behavior: e.行为维度,
        environment: e.环境维度,
        trigger: e.trigger,
        risk_level: e.risk_level,
        action: e.action,
        copyright: e.copyright,
        version: e.version,
      },
      tag: "risk_control",
    });
  }
  console.log(`  凯利策略: ${kellyData.length} 条`);

  // 2. 孙子兵法+36计 (60条)
  const sunziPath = path.join(DATA_DIR, "sunzi_36_samples_v1.jsonl");
  const sunziData = readJsonl(sunziPath);
  for (const e of sunziData) {
    chunks.push({
      id: e.id,
      content: e.text,
      embeddingText: `${e.scene} ${e.text}`,
      metadata: {
        source: "sunzi_36_stratagems",
        scene: e.scene,
      },
      tag: "risk_control",
    });
  }
  console.log(`  孙子兵法+36计: ${sunziData.length} 条`);

  // 3. 赌场灰控/作弊教育 (20条)
  const gcPath = path.join(DATA_DIR, "grey_control_samples_v1.jsonl");
  const gcData = readJsonl(gcPath);
  for (const e of gcData) {
    chunks.push({
      id: e.id,
      content: e.text,
      embeddingText: `${e.category} ${e.topic} ${e.text}`,
      metadata: {
        source: "grey_control_education",
        category: e.category,
        topic: e.topic,
      },
      tag: "mechanism_explain",
    });
  }
  console.log(`  灰控教育: ${gcData.length} 条`);

  // 4. 赌徒真实认知 (群聊提炼)
  const cognitionPath = path.join(DATA_DIR, "gambler_cognition_v1.jsonl");
  const cognitionData = readJsonl(cognitionPath);
  for (const e of cognitionData) {
    chunks.push({
      id: e.id,
      content: e.text,
      embeddingText: `${e.scene} 赌徒认知 赌圈真实 ${e.text}`,
      metadata: {
        source: "gambler_cognition",
        scene: e.scene,
      },
      tag: "mechanism_explain",
    });
  }
  console.log(`  赌徒认知: ${cognitionData.length} 条`);

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
  console.log("=== 博弈军师知识库 增量导入 ===\n");

  if (!OPENAI_KEY) { console.error("ERROR: OPENAI_API_KEY not set"); process.exit(1); }
  if (!SUPABASE_KEY) { console.error("ERROR: SUPABASE_SERVICE_KEY not set"); process.exit(1); }

  // 1. 读取
  console.log("[1/3] 读取知识库文件...");
  const chunks = loadStrategistKB();
  console.log(`  共 ${chunks.length} 条\n`);
  if (chunks.length === 0) { console.error("ERROR: No data found"); process.exit(1); }

  // Tag 分布
  const tagCounts: Record<string, number> = {};
  const sourceCounts: Record<string, number> = {};
  for (const c of chunks) {
    tagCounts[c.tag] = (tagCounts[c.tag] || 0) + 1;
    const src = c.metadata.source || 'unknown';
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
  }
  console.log("  Tag 分布:", JSON.stringify(tagCounts));
  console.log("  来源分布:", JSON.stringify(sourceCounts));

  // 2. Embedding
  console.log("\n[2/3] 生成 embedding...");
  const texts = chunks.map(c => c.embeddingText);
  const embeddings = await batchEmbed(texts);
  console.log(`  生成 ${embeddings.length} 个 embedding\n`);

  // 3. Upsert (增量，不删除现有数据)
  console.log("[3/3] 写入 Supabase (增量 upsert)...");
  const result = await upsertChunks(chunks, embeddings);
  console.log(`  成功: ${result.ok}, 失败: ${result.fail}\n`);

  // 汇总
  console.log("=== 导入完成 ===");
  console.log(`  总条目: ${chunks.length}`);
  console.log(`  来源: ${JSON.stringify(sourceCounts)}`);
  console.log(`  写入成功: ${result.ok}`);
  console.log(`  写入失败: ${result.fail}`);

  if (result.fail > 0) process.exit(1);
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
