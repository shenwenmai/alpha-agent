#!/usr/bin/env npx tsx
// ============================================================
// import-corpus.ts — 全量替换 kb_chunks，导入训练语料
//
// 用法:
//   OPENAI_API_KEY=sk-xxx SUPABASE_SERVICE_KEY=xxx npx tsx scripts/import-corpus.ts
//
// tag 存入 metadata.tag（无需 DDL）。
// 可选优化: 在 Supabase SQL Editor 执行 supabase-migration.sql 添加独立 tag 列
// ============================================================

import * as fs from "fs";
import * as path from "path";

// --- 配置 ---
const OPENAI_URL = "https://api.openai.com/v1/embeddings";
const EMBED_MODEL = "text-embedding-3-small";
const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://yuzvxmhdzhgdrygfqqkk.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const OPENAI_KEY = process.env.OPENAI_API_KEY || "";

const SAMPLES_DIR =
  process.env.SAMPLES_DIR || "C:/Users/keepe/Desktop/B角色训练过程样本";
const BACKUP_DIR =
  process.env.BACKUP_DIR || "C:/Users/keepe/Desktop/角色训练备用文件";
const PROJECT_DIR =
  process.env.PROJECT_DIR || "C:/Users/keepe/Desktop/b-side";

const BATCH_SIZE = 50; // OpenAI embedding batch size

// --- 类型 ---
interface RawEntry {
  id: string;
  user_input: string;
  best_response: string;
  logic: string;
  forbidden: any[];
  design_notes: string;
  metadata: Record<string, any>;
  secondary_response?: string;
  secondary_logic?: string;
}

interface ChunkToImport {
  id: string;
  content: string;
  embeddingText: string;
  metadata: Record<string, any>;
  tag: string;
}

// --- Tag 映射规则 ---

const RISK_CONTROL_AREAS =
  /stop_loss|take_profit|bankroll|checklist|bet_sizing|profit_zone|violation|pause_indicator|time_discipline|five_step|red_flag|intervention_framework|losing_streak|pre_session|pre_battle|no_momentum|winning_streak/;

const RELAPSE_AREAS =
  /emotional|body_danger|momentum_cycle|tilt|selective_memory|knowing_doing|hope_frustration|cognitive_evolution|post_covid|bpems|opening_probability|stalemate_danger|chasing_losses|road_accident/;

function getEducationTag(knowledgeArea: string): string {
  if (!knowledgeArea) return "mechanism_explain";
  if (RISK_CONTROL_AREAS.test(knowledgeArea)) return "risk_control";
  if (RELAPSE_AREAS.test(knowledgeArea)) return "relapse_prevention";
  return "mechanism_explain";
}

// --- Markdown 智能切分（大章节自动按 ### 拆细）---

function splitMarkdownSmart(
  text: string,
  maxChunkChars: number = 1500
): { title: string; content: string }[] {
  const result: { title: string; content: string }[] = [];
  const majorSections = text.split(/^##\s+/gm);

  for (const section of majorSections) {
    if (section.trim().length < 50) continue;
    const firstLine = section.split("\n")[0].trim();
    const content = section.trim();

    if (content.length <= maxChunkChars) {
      result.push({ title: firstLine, content });
    } else {
      // 大章节 → 按 ### 子标题拆分
      const subSections = content.split(/^###\s+/gm);
      for (const sub of subSections) {
        if (sub.trim().length < 30) continue;
        const subFirstLine = sub.split("\n")[0].trim();
        const subContent = sub.trim();
        // 第一段（## 标题到第一个 ### 之间的内容）用章标题
        const title =
          subFirstLine === firstLine
            ? firstLine
            : `${firstLine} > ${subFirstLine}`;
        result.push({ title, content: subContent });
      }
    }
  }
  return result;
}

// --- 读取语料 ---

function loadCorpus(): ChunkToImport[] {
  const chunks: ChunkToImport[] = [];

  // 1. baccarat_education_samples
  const eduPath = path.join(SAMPLES_DIR, "baccarat_education_samples_v10.json");
  if (fs.existsSync(eduPath)) {
    const entries: RawEntry[] = JSON.parse(fs.readFileSync(eduPath, "utf8"));
    for (const e of entries) {
      const tag = getEducationTag(e.metadata?.knowledge_area || "");
      chunks.push({
        id: e.id,
        content: e.best_response,
        embeddingText: `${e.user_input}\n${e.best_response}`,
        metadata: {
          source: "baccarat_education",
          module: e.metadata?.module,
          knowledge_area: e.metadata?.knowledge_area,
          chapter_ref: e.metadata?.chapter_ref,
          b_role_realtime_use: e.metadata?.b_role_realtime_use,
          trigger_scenario: e.metadata?.trigger_scenario,
          user_input: e.user_input,
          logic: e.logic,
          forbidden: e.forbidden,
          design_notes: e.design_notes,
        },
        tag,
      });
    }
    console.log(`  baccarat_education: ${entries.length} entries loaded`);
  }

  // 2. baccarat_risk_control_samples
  const rcPath = path.join(
    SAMPLES_DIR,
    "baccarat_risk_control_samples_v2.json"
  );
  if (fs.existsSync(rcPath)) {
    const entries: RawEntry[] = JSON.parse(fs.readFileSync(rcPath, "utf8"));
    for (const e of entries) {
      chunks.push({
        id: e.id,
        content: e.best_response,
        embeddingText: `${e.user_input}\n${e.best_response}`,
        metadata: {
          source: "baccarat_risk_control",
          module: e.metadata?.module,
          knowledge_area: e.metadata?.knowledge_area,
          chapter_ref: e.metadata?.chapter_ref,
          b_role_realtime_use: e.metadata?.b_role_realtime_use,
          trigger_scenario: e.metadata?.trigger_scenario,
          user_input: e.user_input,
          logic: e.logic,
          forbidden: e.forbidden,
          design_notes: e.design_notes,
        },
        tag: "risk_control",
      });
    }
    console.log(`  baccarat_risk_control: ${entries.length} entries loaded`);
  }

  // 3. p6_real_corpus
  const p6Path = path.join(SAMPLES_DIR, "p6_real_corpus_fixed.json");
  if (fs.existsSync(p6Path)) {
    const entries: RawEntry[] = JSON.parse(fs.readFileSync(p6Path, "utf8"));
    for (const e of entries) {
      chunks.push({
        id: e.id,
        content: e.best_response,
        embeddingText: `${e.user_input}\n${e.best_response}`,
        metadata: {
          source: "p6_real_corpus",
          module: e.metadata?.module,
          gambling_type: e.metadata?.gambling_type,
          stage: e.metadata?.stage,
          emotion: e.metadata?.emotion,
          emotion_intensity: e.metadata?.emotion_intensity,
          danger_signals: e.metadata?.danger_signals,
          user_input: e.user_input,
          logic: e.logic,
          forbidden: e.forbidden,
          design_notes: e.design_notes,
          secondary_response: e.secondary_response,
          secondary_logic: e.secondary_logic,
        },
        tag: "intervention",
      });
    }
    console.log(`  p6_real_corpus: ${entries.length} entries loaded`);
  }

  // ============================================================
  // 4. rag_knowledge_base_v8 — 综合知识库（含金句锚定样本）
  // ============================================================
  const ragKbPath = path.join(BACKUP_DIR, "rag_knowledge_base_v8.json");
  if (fs.existsSync(ragKbPath)) {
    const entries: RawEntry[] = JSON.parse(fs.readFileSync(ragKbPath, "utf8"));
    for (const e of entries) {
      const isQuote = e.metadata?.training_method === "金句锚定";
      const tag = isQuote
        ? "quote_anchored"
        : e.metadata?.training_method
          ? `kb_${e.metadata.training_method}`
          : "knowledge_base";
      chunks.push({
        id: e.id,
        content: e.best_response,
        embeddingText: `${e.user_input}\n${e.best_response}`,
        metadata: {
          source: "rag_knowledge_base_v8",
          gambling_type: e.metadata?.gambling_type,
          stage: e.metadata?.stage,
          emotion_intensity: e.metadata?.emotion_intensity,
          primary_emotion: e.metadata?.primary_emotion,
          danger_signals: e.metadata?.danger_signals,
          training_method: e.metadata?.training_method,
          target_value: e.metadata?.target_value,
          quote_used: e.metadata?.quote_used,
          quote_scenario: e.metadata?.quote_scenario,
          user_input: e.user_input,
          logic: e.logic,
          design_notes: e.design_notes,
        },
        tag,
      });
    }
    console.log(`  rag_knowledge_base_v8: ${entries.length} entries loaded`);
  }

  // ============================================================
  // 5. mirror_training_samples_v3 — 清醒的我训练样本
  // ============================================================
  const mirrorPath = path.join(BACKUP_DIR, "mirror_training_samples_v3.json");
  if (fs.existsSync(mirrorPath)) {
    const entries: any[] = JSON.parse(fs.readFileSync(mirrorPath, "utf8"));
    for (const e of entries) {
      const userText = e.trigger || e.user_data?.user_quote || "";
      const responseText = e.mirror_output || "";
      if (!responseText) continue;
      chunks.push({
        id: e.id,
        content: responseText,
        embeddingText: `${userText}\n${responseText}`,
        metadata: {
          source: "mirror_training_v3",
          scenario_type: e.scenario_type,
          trigger_type: e.metadata?.trigger_type,
          pattern_type: e.metadata?.pattern_type,
          emotion_intensity: e.metadata?.emotion_intensity,
          trigger: e.trigger,
          logic: e.logic,
        },
        tag: "mirror_interaction",
      });
    }
    console.log(`  mirror_training_samples_v3: ${entries.length} entries loaded`);
  }

  // ============================================================
  // 6. b_role_high_temp_empathy_30 — 高情绪共情模板
  // ============================================================
  const empathyPath = path.join(BACKUP_DIR, "b_role_high_temp_empathy_30.json");
  if (fs.existsSync(empathyPath)) {
    const data = JSON.parse(fs.readFileSync(empathyPath, "utf8"));
    const templates: any[] = data.templates || [];
    for (const t of templates) {
      chunks.push({
        id: `empathy_${t.id}`,
        content: t.text,
        embeddingText: `${t.type} 高情绪共情 ${t.tags?.join(" ") || ""}\n${t.text}`,
        metadata: {
          source: "b_role_empathy",
          emotion_type: t.type,
          tags: t.tags,
        },
        tag: "empathy_template",
      });
    }
    console.log(`  b_role_high_temp_empathy: ${templates.length} entries loaded`);
  }

  // ============================================================
  // 7. b_role_ending_templates_tagged — 结尾话术模板
  // ============================================================
  const endingPath = path.join(BACKUP_DIR, "b_role_ending_templates_tagged.json");
  if (fs.existsSync(endingPath)) {
    const data = JSON.parse(fs.readFileSync(endingPath, "utf8"));
    const templates: any[] = data.templates || [];
    for (const t of templates) {
      chunks.push({
        id: `ending_${t.id}`,
        content: t.text,
        embeddingText: `结尾 ${t.tier || ""} ${t.tags?.join(" ") || ""}\n${t.text}`,
        metadata: {
          source: "b_role_ending",
          tier: t.tier,
          tags: t.tags,
        },
        tag: "ending_template",
      });
    }
    console.log(`  b_role_ending_templates: ${templates.length} entries loaded`);
  }

  // ============================================================
  // 8. quote_anchored_extra — 新增名人金句（巴菲特/芒格/现代名人）
  // ============================================================
  const quoteExtraPath = path.join(PROJECT_DIR, "data/quote_anchored_extra.json");
  if (fs.existsSync(quoteExtraPath)) {
    const entries: RawEntry[] = JSON.parse(fs.readFileSync(quoteExtraPath, "utf8"));
    for (const e of entries) {
      chunks.push({
        id: e.id,
        content: e.best_response,
        embeddingText: `${e.user_input}\n${e.best_response}`,
        metadata: {
          source: "quote_anchored_extra",
          gambling_type: e.metadata?.gambling_type,
          stage: e.metadata?.stage,
          emotion_intensity: e.metadata?.emotion_intensity,
          primary_emotion: e.metadata?.primary_emotion,
          danger_signals: e.metadata?.danger_signals,
          training_method: e.metadata?.training_method,
          target_value: e.metadata?.target_value,
          quote_used: e.metadata?.quote_used,
          quote_scenario: e.metadata?.quote_scenario,
          user_input: e.user_input,
          logic: e.logic,
          design_notes: e.design_notes,
        },
        tag: "quote_anchored",
      });
    }
    console.log(`  quote_anchored_extra: ${entries.length} entries loaded`);
  }

  // ============================================================
  // 9. p11_source_extraction — 凯利策略量化风控知识
  // ============================================================
  const kellyPath = path.join(SAMPLES_DIR, "p11_source_extraction.md");
  if (fs.existsSync(kellyPath)) {
    const text = fs.readFileSync(kellyPath, "utf8");
    // 智能切分：大章节自动按 ### 子标题拆细，提高 RAG 命中率
    const sections = splitMarkdownSmart(text, 1500);
    let kellyCount = 0;
    for (const section of sections) {
      chunks.push({
        id: `kelly_${kellyCount++}`,
        content: section.content,
        embeddingText: `凯利策略 量化风控 ${section.title}\n${section.content.slice(0, 2000)}`,
        metadata: {
          source: "kelly_strategy",
          section_title: section.title,
        },
        tag: "kelly_strategy",
      });
    }
    console.log(`  p11_source_extraction (Kelly): ${kellyCount} sections loaded`);
  }

  // ============================================================
  // 10. p11_grey_control_extraction — 赌场灰控技术揭秘
  // ============================================================
  const greyPath = path.join(SAMPLES_DIR, "p11_grey_control_extraction.md");
  if (fs.existsSync(greyPath)) {
    const text = fs.readFileSync(greyPath, "utf8");
    // 智能切分：大章节自动按 ### 子标题拆细
    const sections = splitMarkdownSmart(text, 1500);
    let greyCount = 0;
    for (const section of sections) {
      chunks.push({
        id: `grey_ctrl_${greyCount++}`,
        content: section.content,
        embeddingText: `灰控 赌场操控 ${section.title}\n${section.content.slice(0, 2000)}`,
        metadata: {
          source: "grey_control",
          section_title: section.title,
        },
        tag: "grey_control",
      });
    }
    console.log(`  p11_grey_control_extraction: ${greyCount} sections loaded`);
  }

  // ============================================================
  // 11. clean_samples/ — 79个真实成瘾叙述+心理标注
  // ============================================================
  const cleanDir = path.join(SAMPLES_DIR, "clean_samples");
  if (fs.existsSync(cleanDir)) {
    const files = fs.readdirSync(cleanDir).filter(f => f.endsWith(".md")).sort();
    let cleanCount = 0;
    for (const file of files) {
      const text = fs.readFileSync(path.join(cleanDir, file), "utf8");
      // 提取原始叙述 + 情绪分析 + 术语
      const content = text.trim();
      if (content.length < 50) continue;
      const sampleId = file.replace(".md", "");
      chunks.push({
        id: `clean_${sampleId}`,
        content: content.slice(0, 4000), // 截取前4000字符（embedding限制）
        embeddingText: content.slice(0, 4000),
        metadata: {
          source: "clean_samples",
          filename: file,
        },
        tag: "real_narrative",
      });
      cleanCount++;
    }
    console.log(`  clean_samples: ${cleanCount} files loaded`);
  }

  return chunks;
}

// --- OpenAI 批量 embedding ---

async function batchEmbed(
  texts: string[]
): Promise<number[][]> {
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
        input: batch.map((t) => t.slice(0, 8000)),
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

    // Rate limit: small delay between batches
    if (i + BATCH_SIZE < texts.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  return results;
}

// --- Supabase 操作 ---

async function deleteAllChunks(): Promise<number> {
  // PostgREST DELETE with a filter that matches all rows
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/kb_chunks?id=neq.___NONE___`,
    {
      method: "DELETE",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Prefer: "count=exact",
      },
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Delete failed: ${err.slice(0, 200)}`);
  }

  const count = res.headers.get("content-range");
  const match = count?.match(/\*\/(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

async function upsertChunks(
  chunks: ChunkToImport[],
  embeddings: number[][]
): Promise<{ ok: number; fail: number }> {
  let ok = 0;
  let fail = 0;

  // Upsert in batches of 20
  const UPSERT_BATCH = 20;
  for (let i = 0; i < chunks.length; i += UPSERT_BATCH) {
    const batch = chunks.slice(i, i + UPSERT_BATCH);
    const batchEmbeddings = embeddings.slice(i, i + UPSERT_BATCH);

    const rows = batch.map((chunk, idx) => ({
      id: chunk.id,
      content: chunk.content,
      metadata: { ...chunk.metadata, tag: chunk.tag },
      embedding: JSON.stringify(batchEmbeddings[idx]),
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
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return { ok, fail };
}

// --- 主流程 ---

async function main() {
  console.log("=== RealCost KB 全量导入 ===\n");

  // 检查环境变量
  if (!OPENAI_KEY) {
    console.error("ERROR: OPENAI_API_KEY not set");
    process.exit(1);
  }
  if (!SUPABASE_KEY) {
    console.error("ERROR: SUPABASE_SERVICE_KEY not set");
    process.exit(1);
  }

  // 1. 读取语料
  console.log("[1/4] 读取语料文件...");
  const chunks = loadCorpus();
  console.log(`  共 ${chunks.length} 条\n`);

  if (chunks.length === 0) {
    console.error("ERROR: No corpus files found in", SAMPLES_DIR);
    process.exit(1);
  }

  // 打印 tag 分布
  const tagCounts: Record<string, number> = {};
  for (const c of chunks) {
    tagCounts[c.tag] = (tagCounts[c.tag] || 0) + 1;
  }
  console.log("  Tag 分布:", JSON.stringify(tagCounts));

  // 2. 删除现有数据
  console.log("\n[2/4] 清空现有 kb_chunks...");
  const deleted = await deleteAllChunks();
  console.log(`  已删除 ${deleted} 条\n`);

  // 3. 批量生成 embedding
  console.log("[3/4] 生成 embedding...");
  const texts = chunks.map((c) => c.embeddingText);
  const embeddings = await batchEmbed(texts);
  console.log(`  生成 ${embeddings.length} 个 embedding\n`);

  // 4. 批量写入 Supabase
  console.log("[4/4] 写入 Supabase...");
  const result = await upsertChunks(chunks, embeddings);
  console.log(`  成功: ${result.ok}, 失败: ${result.fail}\n`);

  // 汇总
  console.log("=== 导入完成 ===");
  console.log(`  总条目: ${chunks.length}`);
  console.log(`  Tag 分布: ${JSON.stringify(tagCounts)}`);
  console.log(`  写入成功: ${result.ok}`);
  console.log(`  写入失败: ${result.fail}`);

  if (result.fail > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
