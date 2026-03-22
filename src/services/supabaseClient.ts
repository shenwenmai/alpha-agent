// ============================================================
// Supabase 浏览器端客户端
// 使用 anon key（公开密钥），配合 RLS 实现行级安全
// ============================================================

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

export const supabase: SupabaseClient = createClient(
  SUPABASE_URL || '',
  SUPABASE_ANON_KEY || '',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,   // OAuth redirect 回来时自动处理 token
    },
  },
);

// ============================================================
// 当前用户管理
// ============================================================

let currentUser: User | null = null;

export function setCurrentUser(user: User | null) {
  currentUser = user;
}

export function getCurrentUser(): User | null {
  return currentUser;
}

export function getCurrentUserId(): string | null {
  return currentUser?.id ?? null;
}

export function isAuthenticated(): boolean {
  return currentUser !== null;
}
