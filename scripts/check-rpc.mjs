const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1enZ4bWhkemhnZHJ5Z2ZxcWtrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ5MjYzOCwiZXhwIjoyMDg4MDY4NjM4fQ.YMOs7pwT57Ph-EoDkpVo5RpDxxByNLfrBLykywRlrIY';

const res = await fetch('https://yuzvxmhdzhgdrygfqqkk.supabase.co/rest/v1/', {
  headers: { apikey: KEY }
});
const j = await res.json();
const paths = Object.keys(j.paths || {});
const rpc = paths.filter(p => p.includes('/rpc/'));
const tables = paths.filter(p => p.startsWith('/') && !p.includes('/rpc/'));
console.log('RPC functions:', rpc);
console.log('Tables:', tables);
