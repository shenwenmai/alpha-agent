import React from 'react';
import { theme, type EmotionLevel } from '../../theme';
import { Badge } from './Badge';

export interface ScriptCardProps {
  text: string;
  scene: string;
  level: EmotionLevel;
  onCopy?: () => void;
  onNext?: () => void;
  assistantMode?: boolean;
}

const levelVariantMap: Record<EmotionLevel, 'success' | 'gold' | 'warning' | 'danger'> = {
  calm: 'success',
  mild: 'gold',
  moderate: 'warning',
  severe: 'danger',
};

const levelLabelMap: Record<EmotionLevel, string> = {
  calm: '平静',
  mild: '注意',
  moderate: '警惕',
  severe: '危险',
};

// 场景标签 → 中文
const sceneLabelMap: Record<string, string> = {
  loss_streak: '连输',
  tilt_betting: '亏损加码',
  near_stop_loss: '接近止损',
  profit_giveback: '盈利回吐',
  overtime: '超时',
  near_timeout: '时间紧迫',
  bet_volatility: '注码波动',
  euphoria_raise: '连赢加码',
  idle_long: '久未操作',
  pre_entry_check: '进场自检',
  self_check: '即时自检',
  compound_danger: '复合危险',
};

export const ScriptCard: React.FC<ScriptCardProps> = ({
  text,
  scene,
  level,
  onCopy,
  onNext,
  assistantMode = false,
}) => {
  return (
    <div
      style={{
        background: theme.colors.card,
        borderRadius: theme.radius.md,
        overflow: 'hidden',
      }}
    >
      {/* 话术文本 */}
      <div style={{ padding: theme.spacing.lg }}>
        <p
          style={{
            color: theme.colors.white,
            fontSize: assistantMode ? 20 : theme.fontSize.body,
            fontWeight: assistantMode ? 500 : 400,
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          {text}
        </p>
        {/* 标签 */}
        <div style={{ display: 'flex', gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
          <Badge variant="default">{sceneLabelMap[scene] || scene}</Badge>
          <Badge variant={levelVariantMap[level]}>{levelLabelMap[level]}</Badge>
        </div>
      </div>
      {/* 底部操作栏 */}
      <div
        style={{
          display: 'flex',
          borderTop: `1px solid ${theme.colors.border}`,
        }}
      >
        <button
          onClick={onCopy}
          style={{
            flex: 1,
            height: 44,
            background: 'none',
            border: 'none',
            borderRight: `1px solid ${theme.colors.border}`,
            color: theme.colors.gray,
            fontSize: theme.fontSize.small,
            cursor: 'pointer',
          }}
        >
          📋 复制
        </button>
        <button
          onClick={onNext}
          style={{
            flex: 1,
            height: 44,
            background: 'none',
            border: 'none',
            color: theme.colors.gold,
            fontSize: theme.fontSize.small,
            cursor: 'pointer',
          }}
        >
          🔄 换一句
        </button>
      </div>
    </div>
  );
};
