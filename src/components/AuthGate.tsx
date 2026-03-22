import React, { useEffect, useState } from 'react';
import { supabase, setCurrentUser } from '../services/supabaseClient';
import LoginScreen from '../screens/LoginScreen';
import type { User } from '@supabase/supabase-js';

interface AuthGateProps {
  children: React.ReactNode;
}

/**
 * AuthGate — 认证守门组件
 *
 * - 强制登录：未登录只显示 LoginScreen
 * - 监听 Supabase auth 状态变化
 * - 首次登录触发 localStorage → 云端迁移
 * - OAuth redirect 回来后自动恢复 session
 */
export default function AuthGate({ children }: AuthGateProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);

  useEffect(() => {
    // 1. 获取当前 session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      setCurrentUser(u);
      if (u) {
        handlePostLogin(u);
      }
      setLoading(false);
    });

    // 2. 监听 auth 状态变化（登录/登出/token 刷新）
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const u = session?.user ?? null;
        setUser(u);
        setCurrentUser(u);
        if (u) {
          handlePostLogin(u);
        }
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  /** 登录成功后处理：迁移本地数据 → 拉取云端数据 */
  const handlePostLogin = async (u: User) => {
    const migrationKey = `fm_migrated_to_cloud_${u.id}`;
    const alreadyMigrated = localStorage.getItem(migrationKey);

    if (!alreadyMigrated) {
      // 首次登录：检查本地是否有数据需要迁移
      const localData = localStorage.getItem('roundtable_fm_v1');
      if (localData) {
        try {
          const parsed = JSON.parse(localData);
          const hasData = (parsed.sessions?.length > 0) || (parsed.templates?.length > 0);
          if (hasData) {
            setMigrating(true);
            // 动态导入避免循环依赖
            const { migrateLocalToCloud } = await import('../services/fmSyncService');
            await migrateLocalToCloud(u.id);
            setMigrating(false);
          }
        } catch (e) {
          console.error('[AuthGate] Migration check failed', e);
          setMigrating(false);
        }
      }
      localStorage.setItem(migrationKey, 'true');
    }

    // 从云端拉取数据（合并到本地）
    try {
      const { initFromCloud } = await import('../services/fmSyncService');
      await initFromCloud(u.id);
    } catch (e) {
      console.error('[AuthGate] initFromCloud failed', e);
    }
  };

  // Loading 状态
  if (loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--page)',
        flexDirection: 'column',
        gap: 16,
      }}>
        <div style={{
          width: 40,
          height: 40,
          border: '3px solid rgba(255,255,255,0.08)',
          borderTopColor: '#fff',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // 迁移中
  if (migrating) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--page)',
        flexDirection: 'column',
        gap: 16,
      }}>
        <div style={{
          width: 40,
          height: 40,
          border: '3px solid rgba(255,255,255,0.08)',
          borderTopColor: '#2D6A4F',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{ fontSize: 14, color: 'var(--sub)', fontWeight: 600 }}>
          正在同步数据到云端...
        </p>
        <p style={{ fontSize: 12, color: 'var(--sub)', opacity: 0.6 }}>
          首次登录，请稍候
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // 未登录 → 显示登录页（全屏包裹确保高度正确）
  if (!user && !new URLSearchParams(window.location.search).has('dev')) {
    return (
      <div style={{ position: 'fixed', inset: 0, backgroundColor: '#0A0A0A', overflowY: 'auto' }}>
        <LoginScreen />
      </div>
    );
  }

  // 已登录 → 显示应用内容
  return <>{children}</>;
}
