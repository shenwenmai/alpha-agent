import React from 'react';
import { theme, type EmotionLevel } from '../../theme';

export interface EmotionGaugeProps {
  score: number;          // 0-100
  level: EmotionLevel;    // calm | mild | moderate | severe
  size?: 'sm' | 'lg';
}

const levelLabel: Record<EmotionLevel, string> = {
  calm: '平静',
  mild: '注意',
  moderate: '警惕',
  severe: '危险',
};

export const EmotionGauge: React.FC<EmotionGaugeProps> = ({
  score,
  level,
  size = 'lg',
}) => {
  const dim = size === 'sm' ? 120 : 180;
  const strokeWidth = size === 'sm' ? 10 : 14;
  const r = (dim - strokeWidth) / 2;
  const cx = dim / 2;
  const cy = dim / 2;
  const color = theme.colors.emotion[level];

  // 半环形：从左(180°)到右(0°)，即底部开口的半圆
  const startAngle = 180;
  const endAngle = 0;
  const totalArc = 180; // degrees
  const clampedScore = Math.max(0, Math.min(100, score));
  // SVG arc 命令在起点=终点时不渲染，score=100 时 clamp 到 99.9 避免弧线消失
  const sweepAngle = (Math.min(clampedScore, 99.9) / 100) * totalArc;

  const toRad = (deg: number) => (deg * Math.PI) / 180;

  // 起点(左侧)
  const sx = cx + r * Math.cos(toRad(startAngle));
  const sy = cy - r * Math.sin(toRad(startAngle));

  // 背景弧终点(右侧)
  const bgEx = cx + r * Math.cos(toRad(endAngle));
  const bgEy = cy - r * Math.sin(toRad(endAngle));

  // 前景弧终点
  const fgAngle = startAngle - sweepAngle;
  const fgEx = cx + r * Math.cos(toRad(fgAngle));
  const fgEy = cy - r * Math.sin(toRad(fgAngle));

  const bgArc = `M ${sx} ${sy} A ${r} ${r} 0 0 1 ${bgEx} ${bgEy}`;
  const fgArc = `M ${sx} ${sy} A ${r} ${r} 0 0 1 ${fgEx} ${fgEy}`;

  const numSize = size === 'sm' ? theme.fontSize.hero : 32;
  const labelSize = size === 'sm' ? theme.fontSize.caption : theme.fontSize.small;

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width={dim} height={dim / 2 + strokeWidth} viewBox={`0 0 ${dim} ${dim / 2 + strokeWidth}`}>
        {/* 背景弧 */}
        <path
          d={bgArc}
          fill="none"
          stroke={theme.colors.border}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* 前景弧 */}
        {clampedScore > 0 && (
          <path
            d={fgArc}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        )}
        {/* 中心数字 */}
        <text
          x={cx}
          y={dim / 2 - 6}
          textAnchor="middle"
          fill={color}
          fontSize={numSize}
          fontWeight={800}
        >
          {clampedScore}
        </text>
      </svg>
      {/* 级别文字 */}
      <span
        style={{
          color,
          fontSize: labelSize,
          fontWeight: 500,
          marginTop: -4,
        }}
      >
        {levelLabel[level]}
      </span>
    </div>
  );
};
