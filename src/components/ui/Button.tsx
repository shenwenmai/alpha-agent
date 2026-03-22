import React from 'react';
import { theme } from '../../theme';

export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}

const sizeMap = {
  sm: { height: 36, fontSize: theme.fontSize.small, padding: `0 ${theme.spacing.lg}px` },
  md: { height: 44, fontSize: theme.fontSize.body, padding: `0 ${theme.spacing.xl}px` },
  lg: { height: 52, fontSize: theme.fontSize.title, padding: `0 ${theme.spacing.xxl}px` },
} as const;

const variantMap = {
  primary: {
    background: theme.colors.gold,
    color: '#000000',
    border: 'none',
  },
  secondary: {
    background: 'transparent',
    color: theme.colors.gold,
    border: `1.5px solid ${theme.colors.gold}`,
  },
  danger: {
    background: theme.colors.danger,
    color: theme.colors.white,
    border: 'none',
  },
} as const;

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  children,
  onClick,
}) => {
  const s = sizeMap[size];
  const v = variantMap[variant];
  const isDisabled = disabled || loading;

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      style={{
        height: s.height,
        minHeight: 44,
        fontSize: s.fontSize,
        padding: s.padding,
        background: v.background,
        color: v.color,
        border: v.border,
        borderRadius: theme.radius.sm,
        fontWeight: 600,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.5 : 1,
        width: fullWidth ? '100%' : 'auto',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.sm,
        transition: 'opacity 0.15s',
        fontFamily: 'inherit',
      }}
    >
      {loading && <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span>}
      {children}
    </button>
  );
};
