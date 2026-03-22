import React, { useEffect, useState } from 'react';
import { theme } from '../../theme';

export interface ToastProps {
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
  onDismiss?: () => void;
}

const typeColorMap = {
  info: theme.colors.gray,
  success: theme.colors.success,
  warning: theme.colors.warning,
  error: theme.colors.danger,
} as const;

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  duration = 3000,
  onDismiss,
}) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  if (!visible) return null;

  const accentColor = typeColorMap[type];

  return (
    <div
      style={{
        position: 'fixed',
        bottom: theme.spacing.xxl,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 2000,
        maxWidth: 400,
        width: 'calc(100% - 32px)',
      }}
    >
      <div
        style={{
          background: theme.colors.card,
          border: `1px solid ${accentColor}`,
          borderRadius: theme.radius.sm,
          padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
          color: theme.colors.white,
          fontSize: theme.fontSize.small,
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing.sm,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: accentColor,
            flexShrink: 0,
          }}
        />
        {message}
      </div>
    </div>
  );
};
