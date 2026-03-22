-- ============================================================
-- 自检日志表 (self_check_logs)
-- 存储用户进场前 + 实战中的自检记录
-- ============================================================

-- 自检日志表
create table if not exists self_check_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  session_id text not null,
  mode text not null check (mode in ('pre_entry', 'live')),
  trigger text not null check (trigger in ('manual', 'system', 'timer')),
  checked_ids text[] not null default '{}',
  risk_level text not null check (risk_level in ('safe', 'caution', 'warning', 'danger')),
  session_hand_count int not null default 0,
  session_pnl numeric not null default 0,
  session_elapsed_min int not null default 0,
  action_taken text not null check (action_taken in ('continue', 'pause', 'end_session')),
  created_at timestamptz not null default now()
);

-- 索引
create index if not exists idx_self_check_user on self_check_logs (user_id, created_at desc);
create index if not exists idx_self_check_session on self_check_logs (session_id);

-- RLS
alter table self_check_logs enable row level security;
create policy "Users can read own self_check_logs"
  on self_check_logs for select using (true);
create policy "Users can insert own self_check_logs"
  on self_check_logs for insert with check (true);
