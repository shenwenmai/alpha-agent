// ============================================================
// 情绪干预 UI — 3 级干预组件（v2）
// 支持两种模式：
//   1. EmotionState 模式 — 旧的简单干预（兼容）
//   2. InterventionResult 模式 — interventionEngine 输出的动态干预
//
// 轻度：底部浮条（3秒自动消失）
// 中度：半屏弹窗 + 动态按钮
// 重度：全屏遮罩 + 大字话术 + 5秒倒计时确认
// ============================================================

import React, { useState, useEffect } from 'react';
import type { EmotionState, EmotionLevel } from '../services/emotionEngine';
import type { InterventionResult, InterventionAction } from '../services/interventionEngine';

interface EmotionInterventionProps {
  emotion: EmotionState;
  intervention?: InterventionResult | null;   // v2: 动态干预数据
  onDismiss: () => void;
  onViewRules: () => void;
  onAction?: (actionKey: string) => void;     // v2: 动态按钮回调
}

// ── 视觉级别（新增 forced） ──
type VisualLevel = EmotionLevel | 'forced';

// ── 配色 ──
const COLORS: Record<VisualLevel, { bg: string; border: string; text: string; accent: string }> = {
  calm: { bg: 'transparent', border: 'transparent', text: '#fff', accent: '#E6B800' },
  mild: { bg: '#1a1a00', border: '#E6B800', text: '#E6B800', accent: '#E6B800' },
  moderate: { bg: '#1a0f00', border: '#ff8c00', text: '#ff8c00', accent: '#ff8c00' },
  severe: { bg: '#1a0000', border: '#ff4444', text: '#ff4444', accent: '#ff4444' },
  forced: { bg: '#200000', border: '#ff0000', text: '#ff0000', accent: '#ff0000' },
};

// 干预等级 → VisualLevel 映射（L4 → forced 独立级别）
const LEVEL_MAP: Record<string, VisualLevel> = {
  L0: 'calm', L1: 'mild', L2: 'moderate', L3: 'severe', L4: 'forced',
  // 旧版兼容
  mild: 'mild', moderate: 'moderate', severe: 'severe',
};

export default function EmotionIntervention({
  emotion, intervention, onDismiss, onViewRules, onAction,
}: EmotionInterventionProps) {
  // v2 模式：使用 InterventionResult
  if (intervention?.triggered) {
    const level = LEVEL_MAP[intervention.level] || 'moderate';
    const message = intervention.message;
    const title = intervention.title;
    const actions = intervention.actions;

    const handleAction = (key: string) => {
      onAction?.(key);
      // 按钮行为映射
      if (key === 'open_rules' || key === 'view_rules') {
        onViewRules();
      } else {
        onDismiss();
      }
    };

    switch (level) {
      case 'mild':
        return <MildToast message={message} score={emotion.score} onDismiss={() => { onAction?.('auto_dismiss'); onDismiss(); }} />;
      case 'moderate':
        return <ModerateModal title={title} message={message} score={emotion.score} actions={actions} onAction={handleAction} onDismiss={() => { onAction?.('dismiss'); onDismiss(); }} />;
      case 'severe':
        return <SevereOverlay title={title} message={message} score={emotion.score} actions={actions} onAction={handleAction} />;
      case 'forced':
        return <ForcedOverlay title={title} message={message} actions={actions} onAction={handleAction} />;
      default:
        return null;
    }
  }

  // v1 兼容模式已废弃 — v2 干预引擎接管全部干预逻辑（含冷却时间）
  // 旧的 v1 路径会绕过 v2 冷却系统，导致弹窗无限重弹
  return null;
}

// ════════════════════════════════════════════════════
// 轻度：底部浮条
// ════════════════════════════════════════════════════

function MildToast({ message, score, onDismiss }: {
  message: string; score: number; onDismiss: () => void;
}) {
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    const fadeIn = setTimeout(() => setOpacity(1), 50);
    const fadeOut = setTimeout(() => setOpacity(0), 2500);
    const dismiss = setTimeout(onDismiss, 3000);
    return () => { clearTimeout(fadeIn); clearTimeout(fadeOut); clearTimeout(dismiss); };
  }, [onDismiss]);

  const c = COLORS.mild;

  return (
    <div style={{
      position: 'fixed',
      bottom: 100,
      left: 16,
      right: 16,
      zIndex: 900,
      opacity,
      transition: 'opacity 0.4s ease',
      pointerEvents: 'none',
    }}>
      <div style={{
        backgroundColor: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 12,
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          backgroundColor: c.accent, flexShrink: 0,
        }} />
        <span style={{ fontSize: 14, color: c.text, lineHeight: 1.4, flex: 1 }}>
          {message}
        </span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════
// 中度：半屏弹窗（支持动态按钮）
// ════════════════════════════════════════════════════

function ModerateModal({ title, message, score, actions, onAction, onDismiss }: {
  title?: string;
  message: string;
  score: number;
  actions: InterventionAction[];
  onAction: (key: string) => void;
  onDismiss: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const c = COLORS.moderate;

  useEffect(() => {
    const show = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(show);
  }, []);

  const handleAction = (key: string) => {
    setVisible(false);
    setTimeout(() => onAction(key), 300);
  };

  const handleBackdrop = () => {
    setVisible(false);
    setTimeout(onDismiss, 300);
  };

  // 按钮样式：第一个按钮高亮（主操作），其他淡化
  const renderButton = (action: InterventionAction, index: number) => {
    const isPrimary = index === 0;
    return (
      <button
        key={action.key}
        onClick={() => handleAction(action.key)}
        style={{
          flex: 1,
          padding: '14px',
          borderRadius: 14,
          border: isPrimary ? `1px solid ${c.border}` : 'none',
          backgroundColor: isPrimary ? 'transparent' : '#1F1F1F',
          color: isPrimary ? c.text : '#AAAAAA',
          fontSize: 15,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        {action.text}
      </button>
    );
  };

  return (
    <>
      <div
        onClick={handleBackdrop}
        style={{
          position: 'fixed', inset: 0, zIndex: 950,
          backgroundColor: 'rgba(0,0,0,0.6)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.3s ease',
        }}
      />

      <div style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        zIndex: 951,
        transform: visible ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.3s ease',
      }}>
        <div style={{
          backgroundColor: '#141414',
          borderTop: `2px solid ${c.border}`,
          borderRadius: '20px 20px 0 0',
          padding: '28px 20px calc(28px + env(safe-area-inset-bottom, 0px))',
        }}>
          {/* 标题行 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
          }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              backgroundColor: c.accent,
            }} />
            <span style={{ fontSize: 13, color: c.text, fontWeight: 600 }}>
              {title || '情绪预警'} · {score}分
            </span>
          </div>

          {/* 话术 */}
          <p style={{
            fontSize: 18, fontWeight: 700, color: '#fff',
            lineHeight: 1.5, margin: '0 0 24px',
          }}>
            {message}
          </p>

          {/* 动态按钮 */}
          <div style={{ display: 'flex', gap: 12 }}>
            {actions.map((action, i) => renderButton(action, i))}
          </div>
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════
// 重度：全屏遮罩 + 5秒倒计时（支持动态按钮）
// ════════════════════════════════════════════════════

function SevereOverlay({ title, message, score, actions, onAction }: {
  title?: string;
  message: string;
  score: number;
  actions: InterventionAction[];
  onAction: (key: string) => void;
}) {
  const [countdown, setCountdown] = useState(5);
  const [visible, setVisible] = useState(false);
  const c = COLORS.severe;

  useEffect(() => {
    const show = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(show);
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleAction = (key: string) => {
    if (countdown > 0) return;
    setVisible(false);
    setTimeout(() => onAction(key), 300);
  };

  // 第一个按钮 = 主操作（如"结束这场"），最后一个 = 继续
  const primaryAction = actions[0];
  const secondaryActions = actions.slice(1);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      backgroundColor: 'rgba(10,0,0,0.95)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 32,
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.3s ease',
    }}>
      {/* 警告圆 */}
      <div style={{
        width: 80, height: 80, borderRadius: '50%',
        border: `3px solid ${c.accent}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 32,
      }}>
        <span style={{ fontSize: 36, fontWeight: 800, color: c.accent }}>!</span>
      </div>

      {/* 标题 */}
      <div style={{
        fontSize: 13, color: c.text, fontWeight: 600,
        marginBottom: 20, letterSpacing: 1,
      }}>
        {title || '情绪失控预警'} · {score}分
      </div>

      {/* 话术 */}
      <p style={{
        fontSize: 22, fontWeight: 700, color: '#fff',
        lineHeight: 1.6, textAlign: 'center',
        margin: '0 0 40px', maxWidth: 300,
      }}>
        {message}
      </p>

      {/* 主按钮（倒计时后可点） */}
      {primaryAction && (
        <button
          onClick={() => handleAction(primaryAction.key)}
          disabled={countdown > 0}
          style={{
            width: '80%', maxWidth: 300, padding: '16px',
            borderRadius: 16, border: 'none',
            backgroundColor: countdown > 0 ? '#333' : c.accent,
            color: countdown > 0 ? '#888888' : '#000',
            fontSize: 16, fontWeight: 700,
            cursor: countdown > 0 ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s ease',
            marginBottom: 12,
          }}
        >
          {countdown > 0
            ? `请冷静 ${countdown} 秒...`
            : primaryAction.text
          }
        </button>
      )}

      {/* 次要按钮（倒计时结束后显示） */}
      {countdown <= 0 && secondaryActions.length > 0 && (
        <div style={{ display: 'flex', gap: 12, width: '80%', maxWidth: 300 }}>
          {secondaryActions.map(action => (
            <button
              key={action.key}
              onClick={() => handleAction(action.key)}
              style={{
                flex: 1, padding: '12px',
                borderRadius: 12,
                border: action.key === 'continue' ? 'none' : `1px solid ${c.border}`,
                backgroundColor: action.key === 'continue' ? '#1F1F1F' : 'transparent',
                color: action.key === 'continue' ? '#888888' : c.text,
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {action.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════
// 强制离场：红色全屏 + 10秒倒计时 + 二次确认
// L4 专用 — 阻断所有录入操作
// ════════════════════════════════════════════════════

function ForcedOverlay({ title, message, actions, onAction }: {
  title?: string;
  message: string;
  actions: InterventionAction[];
  onAction: (key: string) => void;
}) {
  const [countdown, setCountdown] = useState(10);
  const [confirmStep, setConfirmStep] = useState<'waiting' | 'choose' | 'confirm'>('waiting');
  const [visible, setVisible] = useState(false);
  const c = COLORS.forced;

  useEffect(() => {
    const show = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(show);
  }, []);

  useEffect(() => {
    if (countdown <= 0) {
      setConfirmStep('choose');
      return;
    }
    const timer = setInterval(() => {
      setCountdown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleLeave = () => {
    setVisible(false);
    setTimeout(() => onAction('end_session'), 300);
  };

  const handleAck = () => {
    // 二次确认：第一次点"我理解风险" → 出现最终确认
    if (confirmStep === 'choose') {
      setConfirmStep('confirm');
    } else if (confirmStep === 'confirm') {
      setVisible(false);
      setTimeout(() => onAction('forced_ack'), 300);
    }
  };

  // 主操作按钮（立即离场）
  const primaryAction = actions[0];
  // 次要操作（我理解风险）
  const secondaryAction = actions[1];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      backgroundColor: 'rgba(20,0,0,0.98)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 32,
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.4s ease',
    }}>
      {/* 脉冲警告圆 */}
      <div style={{
        width: 100, height: 100, borderRadius: '50%',
        border: `4px solid ${c.accent}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 32,
        animation: countdown > 0 ? 'pulse 1s infinite' : 'none',
        boxShadow: `0 0 30px ${c.accent}40`,
      }}>
        {countdown > 0 ? (
          <span style={{ fontSize: 40, fontWeight: 900, color: c.accent }}>{countdown}</span>
        ) : (
          <span style={{ fontSize: 44, fontWeight: 900, color: c.accent }}>⚠</span>
        )}
      </div>

      {/* 标题 */}
      <div style={{
        fontSize: 15, color: c.text, fontWeight: 700,
        marginBottom: 16, letterSpacing: 2, textTransform: 'uppercase',
      }}>
        {title || '强制离场'}
      </div>

      {/* 话术 */}
      <p style={{
        fontSize: 20, fontWeight: 700, color: '#fff',
        lineHeight: 1.6, textAlign: 'center',
        margin: '0 0 40px', maxWidth: 320,
      }}>
        {message}
      </p>

      {/* 倒计时阶段 */}
      {confirmStep === 'waiting' && (
        <div style={{
          fontSize: 14, color: '#888', textAlign: 'center',
        }}>
          请冷静 {countdown} 秒后操作...
        </div>
      )}

      {/* 选择阶段 */}
      {confirmStep === 'choose' && (
        <div style={{ width: '85%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* 主按钮：立即离场 */}
          <button
            onClick={handleLeave}
            style={{
              width: '100%', padding: '18px',
              borderRadius: 16, border: 'none',
              backgroundColor: c.accent,
              color: '#000',
              fontSize: 17, fontWeight: 800,
              cursor: 'pointer',
              boxShadow: `0 0 20px ${c.accent}60`,
            }}
          >
            {primaryAction?.text || '立即离场'}
          </button>

          {/* 次要按钮：我理解风险（小字淡色） */}
          {secondaryAction && (
            <button
              onClick={handleAck}
              style={{
                width: '100%', padding: '14px',
                borderRadius: 12, border: 'none',
                backgroundColor: '#1a1a1a',
                color: '#666',
                fontSize: 13, fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {secondaryAction.text}
            </button>
          )}
        </div>
      )}

      {/* 二次确认阶段 */}
      {confirmStep === 'confirm' && (
        <div style={{ width: '85%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{
            fontSize: 15, color: c.text, textAlign: 'center',
            marginBottom: 8, fontWeight: 600,
          }}>
            你确定要在极高风险下继续吗？
          </p>

          <button
            onClick={handleLeave}
            style={{
              width: '100%', padding: '18px',
              borderRadius: 16, border: 'none',
              backgroundColor: c.accent,
              color: '#000',
              fontSize: 17, fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            还是离场吧
          </button>

          <button
            onClick={handleAck}
            style={{
              width: '100%', padding: '12px',
              borderRadius: 12, border: `1px solid #333`,
              backgroundColor: 'transparent',
              color: '#555',
              fontSize: 12, fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            我清楚所有风险，继续
          </button>
        </div>
      )}

      {/* CSS 动画 */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
