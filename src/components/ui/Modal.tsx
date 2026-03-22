import React, { useEffect } from 'react';
import { theme } from '../../theme';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
}) => {
  // 阻止背景滚动
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing.lg,
      }}
    >
      {/* 遮罩 */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
        }}
      />
      {/* 弹窗主体 */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 400,
          maxHeight: '80vh',
          background: theme.colors.card,
          borderRadius: theme.radius.lg,
          overflow: 'auto',
        }}
      >
        {/* 头部 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
            borderBottom: title ? `1px solid ${theme.colors.border}` : 'none',
          }}
        >
          {title && (
            <span style={{ fontSize: theme.fontSize.title, fontWeight: 700, color: theme.colors.white }}>
              {title}
            </span>
          )}
          <button
            onClick={onClose}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              color: theme.colors.gray,
              fontSize: 20,
              cursor: 'pointer',
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>
        {/* 内容 */}
        <div style={{ padding: theme.spacing.lg }}>{children}</div>
      </div>
    </div>
  );
};
