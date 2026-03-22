const queries = [
  '赌博成瘾心理', '凯利策略止损', '灰控算法操控',
  '赌场环境设计', '名人金句巴菲特', '情绪管理决策',
  '百家乐风控', '孙子兵法', '认知偏差', '复发预防',
  '真实经历家庭破碎', '赌徒谬误', '多巴胺奖赏',
  '借钱还债', '老虎机', '止损规则', '共情模板结尾',
];

const allIds = new Set();
const tagMap = {};
const allChunks = [];

for (const q of queries) {
  const res = await fetch('https://realcost-app.vercel.app/api/rag', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q, topK: 100 }),
  });
  const data = await res.json();
  for (const r of (data.results || [])) {
    if (!allIds.has(r.id)) {
      allIds.add(r.id);
      allChunks.push(r);
      const tag = r.metadata?.tag || 'unknown';
      tagMap[tag] = (tagMap[tag] || 0) + 1;
    }
  }
}

console.log('Total unique chunks found:', allIds.size);
console.log('\nBy tag:');
Object.entries(tagMap).sort((a, b) => b[1] - a[1]).forEach(([tag, count]) => {
  console.log(`  ${tag}: ${count}`);
});

// Check YouTube chunks
const ytIds = [...allIds].filter(id =>
  id.startsWith('dt_') || id.startsWith('kelly_paper_') ||
  id.startsWith('gc_') || id.startsWith('casino_psych_')
);
console.log(`\nYouTube chunks: ${ytIds.length} / 27`);
if (ytIds.length > 0) console.log(ytIds.join(', '));

// Check test chunks
const testIds = [...allIds].filter(id => id.startsWith('_test'));
console.log(`\nTest chunks: ${testIds.length}`);
