import React from 'react';
import { theme, type EmotionLevel } from '../../theme';
import { Badge } from './Badge';

export interface TurningPointCardProps {
  timestamp: string;
  description: string;
  fromLevel: EmotionLevel;
  toLevel: EmotionLevel;
  signals: string[];
}

const levelLabel: Record<EmotionLevel, string> = {
  calm: '平静',
  mild: '注意',
  moderate: '警惕',
  severe: '危险',
};

// 信号类型 → 用户可读标签
const signalLabel: Record<string, string> = {
  loss_streak: '连输',
  tilt_betting: '亏损加码',
  near_stop_loss: '接近止损',
  profit_giveback: '盈利回吐',
  overtime: '超时',
  near_timeout: '时间紧迫',
  bet_volatility: '注码波动',
  euphoria_raise: '连赢加码',
  pre_entry_check: '进场自检',
  self_check: '即时自检',
  stagnation: '僵持',
  duration: '持续时间',
  compound_danger: '复合危险',
};

const levelVariant: Record<EmotionLevel, 'success' | 'gold' | 'warning' | 'danger'> = {
  calm: 'success',
  mild: 'gold',
  moderate: 'warning',
  severe: 'danger',
};

function formatTime(ts: string): string {
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  } catch {
    return ts;
  }
}

export const TurningPointCard: React.FC<TurningPointCardProps> = ({
  timestamp,
  description,
  fromLevel,
  toLevel,
  signals,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        gap: theme.spacing.md,
        background: theme.colors.card,
        borderRadius: theme.radius.md,
        padding: theme.spacing.lg,
        alignItems: 'flex-start',
      }}
    >
      {/* 左侧：时间标记 */}
      <div
        style={{
          flexShrink: 0,
          width: 52,
          textAlign: 'center',
          color: theme.colors.gray,
          fontSize: theme.fontSize.caption,
          lineHeight: 1.4,
        }}
      >
        {formatTime(timestamp)}
      </div>

      {/* 中间：事件描述 + 情绪变化 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            color: theme.colors.white,
            fontSize: theme.fontSize.small,
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          {description}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
          <Badge variant={levelVariant[fromLevel]} size="sm">{levelLabel[fromLevel]}</Badge>
          <span style={{ color: theme.colors.gray, fontSize: theme.fontSize.caption }}>→</span>
          <Badge variant={levelVariant[toLevel]} size="sm">{levelLabel[toLevel]}</Badge>
        </div>
      </div>

      {/* 右侧：触发信号标签 */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          alignItems: 'flex-end',
        }}
      >
        {signals.map((sig, i) => (
          <Badge key={i} variant="gold" size="sm">{signalLabel[sig] || sig}</Badge>
        ))}
      </div>
    </div>
  );
};
