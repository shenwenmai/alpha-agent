import React from 'react';
import { theme } from '../../theme';

export interface ProfileStatCardProps {
  icon: string;                           // emoji
  value: string | number;
  label: string;
  trend?: 'up' | 'down' | 'flat';
  subtitle?: string;
}

const trendDisplay: Record<string, { symbol: string; color: string }> = {
  up: { symbol: '↑', color: theme.colors.success },
  down: { symbol: '↓', color: theme.colors.danger },
  flat: { symbol: '→', color: theme.colors.gray },
};

export const ProfileStatCard: React.FC<ProfileStatCardProps> = ({
  icon,
  value,
  label,
  trend,
  subtitle,
}) => {
  return (
    <div
      style={{
        background: theme.colors.card,
        borderRadius: theme.radius.md,
        padding: theme.spacing.lg,
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing.md,
      }}
    >
      {/* 图标 */}
      <span style={{ fontSize: 28, lineHeight: 1 }}>{icon}</span>

      {/* 文字区 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: theme.spacing.sm }}>
          <span
            style={{
              fontSize: theme.fontSize.hero,
              fontWeight: 800,
              color: theme.colors.white,
            }}
          >
            {value}
          </span>
          {trend && (
            <span
              style={{
                fontSize: theme.fontSize.small,
                color: trendDisplay[trend].color,
                fontWeight: 600,
              }}
            >
              {trendDisplay[trend].symbol}
            </span>
          )}
        </div>
        <div style={{ color: theme.colors.gray, fontSize: theme.fontSize.caption, marginTop: 2 }}>
          {label}
        </div>
        {subtitle && (
          <div style={{ color: theme.colors.gray, fontSize: theme.fontSize.caption, marginTop: 2, opacity: 0.7 }}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
};
