const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1enZ4bWhkemhnZHJ5Z2ZxcWtrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ5MjYzOCwiZXhwIjoyMDg4MDY4NjM4fQ.YMOs7pwT57Ph-EoDkpVo5RpDxxByNLfrBLykywRlrIY';
const BASE = 'https://yuzvxmhdzhgdrygfqqkk.supabase.co';
const headers = { apikey: KEY, Authorization: 'Bearer ' + KEY };

const tables = ['chat_turns', 'extracted_events', 'profile_snapshots', 'user_feedback', 'rag_retrieval_logs'];

for (const t of tables) {
  const res = await fetch(BASE + '/rest/v1/' + t + '?select=*&limit=1', { headers });
  if (res.ok) {
    const data = await res.json();
    const cols = data.length > 0 ? Object.keys(data[0]).join(', ') : '(empty)';
    console.log('OK  ' + t + ' — columns: ' + cols);
  } else {
    console.log('FAIL ' + t + ' — ' + res.status);
  }
}
