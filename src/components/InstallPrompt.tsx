import React, { useState, useEffect } from 'react';
import { X, Share, Plus, Download } from 'lucide-react';
import { theme } from '../theme';

/**
 * PWA 安装提示组件
 * - Android Chrome: 用原生 beforeinstallprompt 弹安装
 * - iOS Safari: 显示手动操作引导（分享 → 添加到主屏幕）
 * - 已安装 / 已关闭过 → 不再显示
 */
export default function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // 已经是 standalone 模式（已安装）→ 不显示
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    // @ts-ignore
    if (window.navigator.standalone) return;

    // 用户之前关闭过 → 24小时内不再弹
    const dismissed = localStorage.getItem('pwa_install_dismissed');
    if (dismissed && Date.now() - Number(dismissed) < 24 * 60 * 60 * 1000) return;

    // 检测 iOS
    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(ios);

    if (ios) {
      // iOS 延迟 2 秒显示引导
      const timer = setTimeout(() => setShow(true), 2000);
      return () => clearTimeout(timer);
    }

    // Android / Chrome: 监听 beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShow(true), 1500);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === 'accepted') {
        setShow(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem('pwa_install_dismissed', String(Date.now()));
  };

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '80px',
      left: '12px',
      right: '12px',
      zIndex: 9999,
      backgroundColor: theme.colors.ink,
      color: theme.colors.white,
      borderRadius: '20px',
      padding: '16px 20px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
    }}>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      {/* 关闭按钮 */}
      <button
        onClick={handleDismiss}
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          background: 'none',
          border: 'none',
          color: 'rgba(255,255,255,0.5)',
          cursor: 'pointer',
          padding: '4px',
        }}
      >
        <X size={18} />
      </button>

      {isIOS ? (
        /* iOS 引导 */
        <div>
          <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '10px' }}>
            添加到主屏幕，获得 App 体验
          </div>
          <div style={{ fontSize: '13px', lineHeight: '1.6', color: 'rgba(255,255,255,0.75)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: '22px', height: '22px', borderRadius: '6px',
                backgroundColor: 'rgba(255,255,255,0.15)', fontSize: '12px', fontWeight: 700, flexShrink: 0
              }}>1</span>
              <span>点击底部的 <Share size={14} style={{ verticalAlign: 'middle', margin: '0 2px' }} /> 分享按钮</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: '22px', height: '22px', borderRadius: '6px',
                backgroundColor: 'rgba(255,255,255,0.15)', fontSize: '12px', fontWeight: 700, flexShrink: 0
              }}>2</span>
              <span>选择「<Plus size={14} style={{ verticalAlign: 'middle', margin: '0 2px' }} /> 添加到主屏幕」</span>
            </div>
          </div>
        </div>
      ) : (
        /* Android / Chrome 一键安装 */
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>
              安装 博弈圆桌
            </div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)' }}>
              添加到主屏幕，全屏体验
            </div>
          </div>
          <button
            onClick={handleInstall}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 18px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: '#4CAF50',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <Download size={16} />
            安装
          </button>
        </div>
      )}
    </div>
  );
}
