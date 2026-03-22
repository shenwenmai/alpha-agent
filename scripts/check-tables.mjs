const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1enZ4bWhkemhnZHJ5Z2ZxcWtrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ5MjYzOCwiZXhwIjoyMDg4MDY4NjM4fQ.YMOs7pwT57Ph-EoDkpVo5RpDxxByNLfrBLykywRlrIY';
const BASE = 'https://yuzvxmhdzhgdrygfqqkk.supabase.co';
const headers = { apikey: KEY, Authorization: 'Bearer ' + KEY };

async function checkTable(table) {
  try {
    const res = await fetch(BASE + '/rest/v1/' + table + '?select=*&limit=3', { headers });
    if (res.ok) {
      const data = await res.json();
      console.log(table + ': ' + data.length + ' rows (sample)');
      if (data.length > 0) console.log('  columns:', Object.keys(data[0]).join(', '));
    } else {
      console.log(table + ': HTTP ' + res.status + ' ' + await res.text());
    }
  } catch (e) {
    console.log(table + ': ERROR ' + e.message);
  }
}

async function main() {
  console.log('=== 检查现有表 ===');
  await checkTable('chat_turns');
  await checkTable('extracted_events');
  await checkTable('profile_snapshots');
  await checkTable('user_feedback');
  await checkTable('rag_retrieval_logs');

  // Count total rows
  console.log('\n=== 数据统计 ===');
  for (const t of ['chat_turns', 'extracted_events', 'profile_snapshots']) {
    const res = await fetch(BASE + '/rest/v1/' + t + '?select=id', {
      headers: { ...headers, 'Range': '0-0', 'Prefer': 'count=exact' }
    });
    const count = res.headers.get('content-range');
    console.log(t + ': ' + count);
  }
}

main();
