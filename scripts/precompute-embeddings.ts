/**
 * precompute-embeddings.ts
 *
 * 读取 data/corpus.json → 每条调 OpenAI text-embedding-3-small → 输出 data/embeddings.json
 *
 * 用法: npx tsx scripts/precompute-embeddings.ts
 * 需要环境变量: OPENAI_API_KEY
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const OPENAI_URL = 'https://api.openai.com/v1/embeddings';
const EMBED_MODEL = 'text-embedding-3-small';
const BATCH_SIZE = 20; // OpenAI supports batch embeddings

interface CorpusEntry {
  id: string;
  text: string;
  type: string;
  metadata?: Record<string, any>;
  [key: string]: any;
}

interface EmbeddingEntry {
  id: string;
  text: string;
  metadata: Record<string, any>;
  vector: number[];
}

async function getEmbeddings(texts: string[], apiKey: string): Promise<number[][]> {
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: texts,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI Embedding API ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.data.map((d: any) => d.embedding);
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY environment variable is required');
    process.exit(1);
  }

  const corpusPath = join(process.cwd(), 'data', 'corpus.json');
  console.log(`Reading corpus from ${corpusPath}...`);

  const corpus: CorpusEntry[] = JSON.parse(readFileSync(corpusPath, 'utf-8'));
  console.log(`Loaded ${corpus.length} entries`);

  // Prepare text for embedding (use the main text field)
  const textsToEmbed = corpus.map(entry => {
    // For clean_samples, combine raw_text + cognitive_summary for richer embedding
    if (entry.type === 'clean_sample') {
      const parts = [entry.raw_text || entry.text];
      if (entry.cognitive_summary) parts.push(entry.cognitive_summary);
      return parts.join('\n');
    }
    return entry.text || '';
  });

  const results: EmbeddingEntry[] = [];
  let processed = 0;

  // Process in batches
  for (let i = 0; i < textsToEmbed.length; i += BATCH_SIZE) {
    const batchTexts = textsToEmbed.slice(i, i + BATCH_SIZE);
    const batchEntries = corpus.slice(i, i + BATCH_SIZE);

    console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(textsToEmbed.length / BATCH_SIZE)}...`);

    try {
      const vectors = await getEmbeddings(batchTexts, apiKey);

      for (let j = 0; j < vectors.length; j++) {
        const entry = batchEntries[j];
        results.push({
          id: entry.id,
          text: batchTexts[j].slice(0, 500), // Truncate for storage
          metadata: {
            type: entry.type,
            ...(entry.metadata || {}),
            ...(entry.emotion ? { emotion: entry.emotion } : {}),
            ...(entry.b_role_advice ? { b_role_advice: entry.b_role_advice } : {}),
          },
          vector: vectors[j],
        });
      }

      processed += batchTexts.length;
      console.log(`  Embedded ${processed}/${textsToEmbed.length}`);

      // Rate limit: small delay between batches
      if (i + BATCH_SIZE < textsToEmbed.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    } catch (err) {
      console.error(`  Batch failed:`, err);
      // Continue with next batch
    }
  }

  const outputPath = join(process.cwd(), 'data', 'embeddings.json');
  writeFileSync(outputPath, JSON.stringify(results, null, 0));
  console.log(`\nDone! Wrote ${results.length} embeddings to ${outputPath}`);

  const sizeKB = Math.round(readFileSync(outputPath).length / 1024);
  console.log(`File size: ${sizeKB} KB`);
}

main().catch(console.error);
