import React from 'react';
import { theme } from '../../theme';

export interface CardProps {
  title?: React.ReactNode;
  footer?: React.ReactNode;
  padding?: number;
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  title,
  footer,
  padding = theme.spacing.lg,
  children,
}) => {
  return (
    <div
      style={{
        background: theme.colors.card,
        borderRadius: theme.radius.md,
        overflow: 'hidden',
      }}
    >
      {title && (
        <div
          style={{
            padding: `${theme.spacing.md}px ${padding}px`,
            fontSize: theme.fontSize.title,
            fontWeight: 700,
            color: theme.colors.white,
            borderBottom: `1px solid ${theme.colors.border}`,
          }}
        >
          {title}
        </div>
      )}
      <div style={{ padding }}>{children}</div>
      {footer && (
        <div
          style={{
            padding: `${theme.spacing.md}px ${padding}px`,
            borderTop: `1px solid ${theme.colors.border}`,
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
};
