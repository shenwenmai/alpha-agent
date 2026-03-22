import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');

// Accept optional file list from command line args, or default to all
const defaultFiles = [
  'data_thinking_chunks.jsonl',
  'kelly_paper_chunks.jsonl',
  'script_greycontrol_kelly_chunks.jsonl',
  'script_casino_psychology_chunks.jsonl',
  'gambler_cognition_v1.jsonl',
];

const argFiles = process.argv.slice(2);
const files = argFiles.length > 0 ? argFiles : defaultFiles;

/**
 * Fix unescaped ASCII double quotes inside JSON "text" values.
 */
function fixLine(raw) {
  const textStart = raw.indexOf('"text":"') + 8;
  const metaMarker = '","metadata"';
  const sceneMarker = '","scene"';
  // Find the end of text value - could be followed by metadata or scene
  let textEnd = raw.indexOf(metaMarker, textStart);
  if (textEnd < 0) textEnd = raw.indexOf(sceneMarker, textStart);
  // For files without metadata/scene, text ends at closing }
  if (textEnd < 0) {
    // Try to find the last " before }
    const lastBrace = raw.lastIndexOf('}');
    textEnd = raw.lastIndexOf('"', lastBrace - 1);
    if (textEnd <= textStart) return raw;
    // In this case, just return raw and hope for the best
    return raw;
  }

  const before = raw.slice(0, textStart);
  const textContent = raw.slice(textStart, textEnd);
  const after = raw.slice(textEnd);

  const fixed = textContent.replace(/(?<!\\)"/g, '\\"');
  return before + fixed + after;
}

// Read all chunks
const allChunks = [];
for (const f of files) {
  const filePath = f.includes('/') || f.includes('\\') ? f : join(dataDir, f);
  const lines = readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(l => l.trim());
  for (const line of lines) {
    const fixedLine = fixLine(line.trim());
    try {
      allChunks.push(JSON.parse(fixedLine));
    } catch (e) {
      console.error(`Parse error in ${f}:`);
      console.error(`  ${e.message}`);
      console.error(`  Line: ${fixedLine.slice(0, 100)}...`);
      process.exit(1);
    }
  }
  console.log(`Loaded ${lines.length} chunks from ${f}`);
}

console.log(`\nTotal chunks: ${allChunks.length}`);

// ============================================================
// ID 冲突检测：本地文件内 + 与线上数据库
// ============================================================

// 1. 本地文件内去重
const localIdMap = new Map(); // id → file
let localConflicts = 0;
for (const c of allChunks) {
  if (localIdMap.has(c.id)) {
    console.error(`[ID CONFLICT] "${c.id}" appears in multiple files!`);
    localConflicts++;
  }
  localIdMap.set(c.id, true);
}
if (localConflicts > 0) {
  console.error(`\n${localConflicts} local ID conflict(s) found. Fix before importing.`);
  process.exit(1);
}
console.log('Local ID check: no conflicts');

// 2. 查询线上数据库，检测是否会覆盖已有数据
const skipExisting = process.argv.includes('--skip-existing');
const forceOverwrite = process.argv.includes('--force');

if (!forceOverwrite) {
  console.log('Checking for existing IDs in database...');
  // Use multiple queries to find if any of our IDs already exist
  const existingIds = new Set();
  const prefixes = [...new Set(allChunks.map(c => c.id.split('_').slice(0, -1).join('_') || c.id))];
  for (const prefix of prefixes.slice(0, 5)) { // limit queries
    try {
      const res = await fetch('https://realcost-app.vercel.app/api/rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: prefix, topK: 100 }),
      });
      const data = await res.json();
      for (const r of (data.results || [])) {
        if (localIdMap.has(r.id)) existingIds.add(r.id);
      }
    } catch (e) { /* ignore query errors */ }
  }

  if (existingIds.size > 0) {
    console.log(`\n[WARNING] ${existingIds.size} ID(s) already exist in database:`);
    for (const id of existingIds) console.log(`  - ${id}`);
    if (skipExisting) {
      console.log('--skip-existing: these will be skipped');
      const skipSet = existingIds;
      const before = allChunks.length;
      for (let i = allChunks.length - 1; i >= 0; i--) {
        if (skipSet.has(allChunks[i].id)) allChunks.splice(i, 1);
      }
      console.log(`Skipped ${before - allChunks.length} existing chunks`);
    } else {
      console.log('Use --force to overwrite or --skip-existing to skip them.');
      console.log('Aborting to prevent accidental overwrites.');
      process.exit(1);
    }
  } else {
    console.log('DB check: no conflicts');
  }
}

if (allChunks.length === 0) {
  console.log('Nothing to import.');
  process.exit(0);
}

const API = 'https://realcost-app.vercel.app/api/kb-ingest';
const BATCH = 5;

for (let i = 0; i < allChunks.length; i += BATCH) {
  const batch = allChunks.slice(i, i + BATCH);
  console.log(`Pushing batch ${Math.floor(i/BATCH)+1}: ${batch.map(c=>c.id).join(', ')}`);

  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chunks: batch }),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`FAILED (${res.status}): ${text}`);
    process.exit(1);
  }
  console.log(`  OK: ${text}`);

  if (i + BATCH < allChunks.length) {
    await new Promise(r => setTimeout(r, 2000));
  }
}

console.log('\nAll chunks imported successfully!');
