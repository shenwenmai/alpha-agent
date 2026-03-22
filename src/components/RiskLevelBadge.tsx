import React from 'react';
import type { RiskLevel } from '../types/schema';

const CONFIG: Record<string, { label: string; bg: string; color: string; pulse?: boolean }> = {
  L0: { label: '正常', bg: '#1a2e1a', color: '#22C55E' },
  L1: { label: '轻提醒', bg: 'var(--accent-lime)', color: '#2e7d32' },
  L2: { label: '警告', bg: 'var(--accent-orange)', color: '#c47600' },
  L3: { label: '强警告', bg: 'var(--accent-peach)', color: '#c0392b' },
  L4: { label: '强制干预', bg: '#E65C5C', color: '#fff', pulse: true },
};

export default function RiskLevelBadge({ level }: { level?: RiskLevel | string }) {
  const l = level || 'L0';
  const c = CONFIG[l];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 10px',
        borderRadius: 'var(--radius-full)',
        backgroundColor: c.bg,
        color: c.color,
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.05em',
        animation: c.pulse ? 'emotionPulse 2s ease-in-out infinite' : undefined,
      }}
    >
      {l} {c.label}
    </span>
  );
}
