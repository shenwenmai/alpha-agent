import React, { useState, useEffect } from 'react';
import { subscribeSyncStatus, type SyncStatus } from '../services/fmSyncService';

/**
 * 同步状态指示器 — 浮动在右上角
 * idle: 不显示
 * syncing: 旋转圆圈
 * success: 短暂显示绿色勾 → 消失
 * error: 红色感叹号 + 点击重试提示（持续显示直到下次成功）
 */
export default function SyncStatusIndicator() {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [lastError, setLastError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    return subscribeSyncStatus(state => {
      setStatus(state.status);
      setLastError(state.lastError);

      if (state.status === 'error') {
        setVisible(true);
      } else {
        // 同步中和成功都不打扰用户
        setVisible(false);
      }
    });
  }, []);

  if (!visible || status === 'idle') return null;

  return (
    <div style={{
      position: 'fixed',
      top: 'calc(env(safe-area-inset-top, 0px) + 8px)',
      right: '12px',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '6px 12px',
      borderRadius: '20px',
      fontSize: '11px',
      fontWeight: 600,
      backdropFilter: 'blur(12px)',
      transition: 'all 0.3s ease',
      ...getStatusStyle(status),
    }}>
      {status === 'syncing' && (
        <>
          <span style={{
            display: 'inline-block',
            width: '12px',
            height: '12px',
            border: '2px solid rgba(255,255,255,0.3)',
            borderTop: '2px solid #fff',
            borderRadius: '50%',
            animation: 'sync-spin 0.8s linear infinite',
          }} />
          同步中...
        </>
      )}
      {status === 'success' && (
        <>
          <span style={{ fontSize: '13px' }}>✓</span>
          已同步
        </>
      )}
      {status === 'error' && (
        <>
          <span style={{ fontSize: '13px' }}>!</span>
          {lastError || '同步失败'}
        </>
      )}
      <style>{`
        @keyframes sync-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function getStatusStyle(status: SyncStatus): React.CSSProperties {
  switch (status) {
    case 'syncing':
      return {
        backgroundColor: 'rgba(255,255,255,0.12)',
        color: 'rgba(255,255,255,0.8)',
      };
    case 'success':
      return {
        backgroundColor: 'rgba(34,197,94,0.2)',
        color: '#22c55e',
      };
    case 'error':
      return {
        backgroundColor: 'rgba(239,68,68,0.2)',
        color: '#ef4444',
        cursor: 'default',
      };
    default:
      return {};
  }
}
