import React from 'react';
import { theme } from '../../theme';

export interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'gold';
  size?: 'sm' | 'md';
  children: React.ReactNode;
}

const colorMap = {
  default: { bg: theme.colors.border, color: theme.colors.gray },
  success: { bg: '#22C55E22', color: theme.colors.success },
  warning: { bg: '#F59E0B22', color: theme.colors.warning },
  danger: { bg: '#FF444422', color: theme.colors.danger },
  gold: { bg: '#E6B80022', color: theme.colors.gold },
} as const;

const sizeStyles = {
  sm: { fontSize: theme.fontSize.caption, padding: `2px ${theme.spacing.sm}px`, height: 22 },
  md: { fontSize: theme.fontSize.small, padding: `4px ${theme.spacing.md}px`, height: 28 },
} as const;

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  size = 'sm',
  children,
}) => {
  const c = colorMap[variant];
  const s = sizeStyles[size];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: s.height,
        fontSize: s.fontSize,
        padding: s.padding,
        background: c.bg,
        color: c.color,
        borderRadius: theme.radius.full,
        fontWeight: 500,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
};
