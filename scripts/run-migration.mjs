#!/usr/bin/env node
// 一次性脚本：连接 Supabase PostgreSQL 并执行建表 SQL
import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlFile = join(__dirname, 'chat-tables-migration.sql');
const sql = readFileSync(sqlFile, 'utf-8');

const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1enZ4bWhkemhnZHJ5Z2ZxcWtrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ5MjYzOCwiZXhwIjoyMDg4MDY4NjM4fQ.YMOs7pwT57Ph-EoDkpVo5RpDxxByNLfrBLykywRlrIY';

const PROJECT_REF = 'yuzvxmhdzhgdrygfqqkk';

// 尝试不同的连接方式
const connectionConfigs = [
  {
    name: 'Supavisor Session (us-east-1)',
    host: `aws-0-us-east-1.pooler.supabase.com`,
    port: 5432,
    database: 'postgres',
    user: `postgres.${PROJECT_REF}`,
    password: SERVICE_KEY,
    ssl: { rejectUnauthorized: false },
  },
  {
    name: 'Direct Connection',
    host: `db.${PROJECT_REF}.supabase.co`,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: SERVICE_KEY,
    ssl: { rejectUnauthorized: false },
  },
  {
    name: 'Supavisor Transaction (us-east-1)',
    host: `aws-0-us-east-1.pooler.supabase.com`,
    port: 6543,
    database: 'postgres',
    user: `postgres.${PROJECT_REF}`,
    password: SERVICE_KEY,
    ssl: { rejectUnauthorized: false },
  },
];

async function tryConnect(config) {
  const { name, ...pgConfig } = config;
  console.log(`\n[尝试] ${name} (${pgConfig.host}:${pgConfig.port})...`);

  const client = new pg.Client(pgConfig);
  try {
    await client.connect();
    console.log(`[成功] 已连接: ${name}`);
    return client;
  } catch (err) {
    console.log(`[失败] ${name}: ${err.message}`);
    return null;
  }
}

async function main() {
  console.log('=== Supabase 建表迁移 ===');
  console.log(`SQL 文件: ${sqlFile}`);
  console.log(`SQL 长度: ${sql.length} chars`);

  let client = null;

  for (const config of connectionConfigs) {
    client = await tryConnect(config);
    if (client) break;
  }

  if (!client) {
    console.error('\n所有连接方式都失败了。');
    process.exit(1);
  }

  try {
    console.log('\n[执行] 运行建表 SQL...');
    await client.query(sql);
    console.log('[完成] 所有表已创建！');

    // 验证表是否存在
    const result = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('chat_turns', 'extracted_events', 'profile_snapshots', 'user_feedback', 'rag_retrieval_logs')
      ORDER BY table_name;
    `);

    console.log('\n[验证] 公共表:');
    for (const row of result.rows) {
      console.log(`  ✓ ${row.table_name}`);
    }
    console.log(`\n共 ${result.rows.length} 张表确认创建成功。`);

  } catch (err) {
    console.error('[错误] SQL 执行失败:', err.message);
  } finally {
    await client.end();
  }
}

main();
