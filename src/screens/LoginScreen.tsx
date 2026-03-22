import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Mail, Lock, Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';

type AuthMode = 'login' | 'signup';

export default function LoginScreen() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleEmailAuth = async () => {
    if (!email.trim() || !password.trim()) {
      setError('请填写邮箱和密码');
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');

    try {
      if (mode === 'signup') {
        const { error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
        });
        if (signUpError) throw signUpError;
        setMessage('注册成功！请检查邮箱确认链接');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        });
        if (signInError) throw signInError;
        // AuthGate 会自动检测到 session 变化
      }
    } catch (e: any) {
      const msg = e?.message || '操作失败';
      // 友好化错误信息
      if (msg.includes('Invalid login credentials')) {
        setError('邮箱或密码错误');
      } else if (msg.includes('User already registered')) {
        setError('该邮箱已注册，请直接登录');
      } else if (msg.includes('Password should be at least')) {
        setError('密码至少需要 6 个字符');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (oauthError) throw oauthError;
    } catch (e: any) {
      setError(e?.message || 'Google 登录失败');
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#0A0A0A',
      padding: '40px 24px',
    }}>
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <h1 style={{
          fontSize: 36,
          fontWeight: 900,
          color: '#fff',
          marginBottom: 8,
          letterSpacing: '0.06em',
        }}>
          资金管家
        </h1>
        <p style={{
          color: '#E6B800',
          fontSize: 14,
          fontWeight: 600,
          marginBottom: 6,
        }}>
          你只管判断，我来帮你盯着
        </p>
        <p style={{
          color: '#666',
          fontSize: 12,
          lineHeight: 1.8,
        }}>
          博弈操作系统 · 情绪转折点
        </p>
      </div>

      {/* Login Card */}
      <div style={{
        width: '100%',
        maxWidth: 360,
        background: '#1A1A1A',
        borderRadius: 20,
        padding: '32px 24px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
      }}>
        {/* Google 登录 */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px 0',
            borderRadius: 12,
            border: '1px solid rgba(0,0,0,0.1)',
            background: '#fff',
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            fontSize: 15,
            fontWeight: 600,
            color: '#333',
            transition: 'all 0.2s',
            opacity: loading ? 0.6 : 1,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          使用 Google 登录
        </button>

        {/* 分隔线 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          margin: '24px 0',
        }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
          <span style={{ fontSize: 12, color: '#888' }}>或使用邮箱</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
        </div>

        {/* 邮箱输入 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: '#111',
          borderRadius: 12,
          padding: '0 14px',
          marginBottom: 12,
        }}>
          <Mail size={16} color="#888" />
          <input
            type="email"
            placeholder="邮箱地址"
            value={email}
            onChange={e => setEmail(e.target.value)}
            disabled={loading}
            style={{
              flex: 1,
              border: 'none',
              background: 'none',
              outline: 'none',
              padding: '14px 0',
              fontSize: 15,
              color: '#fff',
            }}
          />
        </div>

        {/* 密码输入 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: '#111',
          borderRadius: 12,
          padding: '0 14px',
          marginBottom: 16,
        }}>
          <Lock size={16} color="#888" />
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="密码（至少6位）"
            value={password}
            onChange={e => setPassword(e.target.value)}
            disabled={loading}
            onKeyDown={e => e.key === 'Enter' && handleEmailAuth()}
            style={{
              flex: 1,
              border: 'none',
              background: 'none',
              outline: 'none',
              padding: '14px 0',
              fontSize: 15,
              color: '#fff',
            }}
          />
          <button
            onClick={() => setShowPassword(!showPassword)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
            }}
          >
            {showPassword
              ? <EyeOff size={16} color="#888" />
              : <Eye size={16} color="#888" />
            }
          </button>
        </div>

        {/* 错误提示 */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '10px 12px',
            background: 'rgba(220,38,38,0.1)',
            borderRadius: 10,
            marginBottom: 16,
            fontSize: 13,
            color: '#FF6B6B',
          }}>
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {/* 成功提示 */}
        {message && (
          <div style={{
            padding: '10px 12px',
            background: 'rgba(34,197,94,0.1)',
            borderRadius: 10,
            marginBottom: 16,
            fontSize: 13,
            color: '#22C55E',
          }}>
            {message}
          </div>
        )}

        {/* 登录/注册按钮 */}
        <button
          onClick={handleEmailAuth}
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px 0',
            borderRadius: 12,
            border: 'none',
            background: '#E6B800',
            color: '#000',
            fontSize: 15,
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity: loading ? 0.6 : 1,
            transition: 'all 0.2s',
          }}
        >
          <LogIn size={16} />
          {loading ? '处理中...' : mode === 'login' ? '登录' : '注册'}
        </button>

        {/* 切换模式 */}
        <div style={{
          textAlign: 'center',
          marginTop: 20,
          fontSize: 13,
          color: '#888',
        }}>
          {mode === 'login' ? '没有账号？' : '已有账号？'}
          <button
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setError('');
              setMessage('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#E6B800',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: 13,
              marginLeft: 4,
              textDecoration: 'underline',
            }}
          >
            {mode === 'login' ? '立即注册' : '去登录'}
          </button>
        </div>
      </div>

      {/* 底部 */}
      <p style={{
        color: '#666',
        fontSize: 11,
        opacity: 0.4,
        marginTop: 40,
        textAlign: 'center',
        lineHeight: 1.6,
      }}>
        登录即表示同意服务条款和隐私政策<br />
        数据安全存储在云端
      </p>
    </div>
  );
}
