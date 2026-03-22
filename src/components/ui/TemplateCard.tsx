import React from 'react';
import { theme } from '../../theme';

export interface TemplateCardProps {
  template: {
    id: string;
    name: string;
    subtitle: string;
    description: string;
    category: 'preset' | 'custom' | 'data_driven';
    locked: boolean;
    params: {
      baseUnitPct: number;
      stopLossPct: number;
      maxTime: number;
      streakLimit: number;
      profitLock: { activatePct: number; tightenPct: number; drawdownPct: number };
    };
  };
  selected?: boolean;
  disabled?: boolean;
  completedSessions?: number;
  onSelect: (id: string) => void;
}

/** 参数标签组件 */
const ParamTag: React.FC<{ label: string }> = ({ label }) => (
  <span
    style={{
      display: 'inline-block',
      background: 'rgba(230,184,0,0.08)',
      color: 'rgba(230,184,0,0.7)',
      fontSize: 9,
      borderRadius: 3,
      padding: '1px 5px',
      whiteSpace: 'nowrap',
    }}
  >
    {label}
  </span>
);

/** 预设模板卡片（A/B/C） */
const PresetCard: React.FC<TemplateCardProps> = ({ template, selected, onSelect }) => (
  <div
    onClick={() => onSelect(template.id)}
    style={{
      position: 'relative',
      background: theme.colors.card,
      borderRadius: theme.radius.md,
      border: selected
        ? `1px solid ${theme.colors.gold}`
        : `1px solid ${theme.colors.border}`,
      overflow: 'hidden',
      cursor: 'pointer',
      transition: 'border-color 0.2s',
    }}
  >
    {/* 选中态顶部金色条 */}
    {selected && (
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: theme.colors.gold,
        }}
      />
    )}

    {/* 右上角"不可修改"标签 */}
    <span
      style={{
        position: 'absolute',
        top: 6,
        right: 6,
        background: 'rgba(255,255,255,0.06)',
        color: '#666',
        fontSize: 8,
        padding: '1px 4px',
        borderRadius: 3,
      }}
    >
      固定
    </span>

    <div style={{ padding: '10px 12px' }}>
      {/* 标题 */}
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: theme.colors.white,
          marginBottom: 2,
        }}
      >
        {template.name}
      </div>

      {/* 副标题 */}
      <div
        style={{
          fontSize: 11,
          color: theme.colors.gold,
          marginBottom: 6,
        }}
      >
        {template.subtitle}
      </div>

      {/* 参数标签 */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
        <ParamTag label={`${Math.round(template.params.baseUnitPct * 100)}%基码`} />
        <ParamTag label={`${Math.round(template.params.stopLossPct * 100)}%止损`} />
        <ParamTag label={`${template.params.maxTime}分钟`} />
      </div>

      {/* 描述 */}
      <div
        style={{
          fontSize: 10,
          color: theme.colors.gray,
          lineHeight: 1.4,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {template.description}
      </div>
    </div>
  </div>
);

/** 自定义模板卡片（D） */
const CustomCard: React.FC<TemplateCardProps> = ({ template, selected, onSelect }) => (
  <div
    onClick={() => onSelect(template.id)}
    style={{
      position: 'relative',
      background: 'transparent',
      borderRadius: theme.radius.md,
      border: selected
        ? `1px solid ${theme.colors.gold}`
        : '1px dashed rgba(255,255,255,0.15)',
      overflow: 'hidden',
      cursor: 'pointer',
      transition: 'border-color 0.2s',
    }}
  >
    {/* 选中态顶部金色条 */}
    {selected && (
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: theme.colors.gold,
        }}
      />
    )}

    <div
      style={{
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
      }}
    >
      {/* 图标 */}
      <div style={{ fontSize: 20, marginBottom: 4 }}>✏️</div>

      {/* 标题 */}
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: theme.colors.white,
          marginBottom: 2,
        }}
      >
        {template.name}
      </div>

      {/* 副标题 */}
      <div
        style={{
          fontSize: 11,
          color: theme.colors.gray,
          marginBottom: 4,
        }}
      >
        {template.subtitle}
      </div>

      {/* 说明文字 */}
      <div
        style={{
          fontSize: 10,
          color: '#777',
          lineHeight: 1.4,
        }}
      >
        {template.description}
      </div>
    </div>
  </div>
);

/** 锁定模板卡片（E） */
const LockedCard: React.FC<TemplateCardProps> = ({ template }) => (
  <div
    style={{
      position: 'relative',
      background: 'rgba(31,31,31,0.5)',
      borderRadius: theme.radius.md,
      border: `1px solid ${theme.colors.border}`,
      overflow: 'hidden',
      opacity: 0.5,
      pointerEvents: 'none',
      cursor: 'default',
    }}
  >
    <div
      style={{
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
      }}
    >
      {/* 锁图标 */}
      <div style={{ fontSize: 20, marginBottom: 4 }}>🔒</div>

      {/* 标题 */}
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: '#555',
          marginBottom: 2,
        }}
      >
        {template.name}
      </div>

      {/* 副标题 */}
      <div
        style={{
          fontSize: 11,
          color: '#555',
        }}
      >
        {template.subtitle}
      </div>
    </div>
  </div>
);

/**
 * 模板选择卡片
 * 根据 category + locked 状态自动渲染对应样式：
 * - preset（A/B/C）：实心卡片 + 参数标签 + "不可修改"
 * - custom（D）：虚线边框 + 编辑图标
 * - data_driven + locked（E）：半透明锁定态
 */
export const TemplateCard: React.FC<TemplateCardProps> = (props) => {
  const { template, disabled, completedSessions } = props;

  // E 模板：locked 或 disabled 或场次不足时显示锁定态
  const isLocked =
    template.locked ||
    disabled ||
    (template.category === 'data_driven' && (completedSessions ?? 0) < 3);

  if (template.category === 'data_driven' && isLocked) {
    return <LockedCard {...props} />;
  }

  if (template.category === 'custom') {
    return <CustomCard {...props} />;
  }

  // preset + 已解锁的 data_driven
  return <PresetCard {...props} />;
};
