import React, { useState, useEffect } from 'react';
import { Shield, ChevronRight, Mic, AlertTriangle, Bell, X } from 'lucide-react';
import { FM_COLORS } from '../../theme';

interface FMEscortViewProps {
  onContinue: () => void;
  onSkip: () => void;
}

const SKIP_KEY = 'fm_escort_seen';

export default function FMEscortView({ onContinue, onSkip }: FMEscortViewProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  // 检查是否已看过
  useEffect(() => {
    const seen = localStorage.getItem(SKIP_KEY);
    if (seen === 'true') {
      onSkip();
    }
  }, [onSkip]);

  const handleContinue = () => {
    if (dontShowAgain) {
      localStorage.setItem(SKIP_KEY, 'true');
    }
    onContinue();
  };

  return (
    <div style={{
      padding: '20px 16px 20px', maxWidth: 480, margin: '0 auto',
    }}>
      {/* ═══ 顶部标识 ═══ */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: `linear-gradient(135deg, ${FM_COLORS.primary}, ${FM_COLORS.secondary})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 14px',
          boxShadow: '0 4px 20px rgba(27, 58, 75, 0.2)',
        }}>
          <Shield size={28} color="#fff" />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 6px', color: FM_COLORS.textPrimary }}>
          方案已就绪，准备上桌
        </h2>
        <p style={{ fontSize: 13, color: FM_COLORS.textSecondary, margin: 0, lineHeight: 1.6 }}>
          3件事帮你快速了解我怎么保护你
        </p>
      </div>

      {/* ═══ 第1块：你怎么做 ═══ */}
      <div style={{
        background: FM_COLORS.cardBg, borderRadius: 18,
        border: `1px solid ${FM_COLORS.border}`,
        padding: '18px 16px', marginBottom: 12,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: `${FM_COLORS.accent}15`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Mic size={17} color={FM_COLORS.accent} />
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, color: FM_COLORS.textPrimary }}>
            ① 你只需要做一件事
          </span>
        </div>
        <div style={{
          background: 'rgba(34,197,94,0.08)', borderRadius: 14, padding: '14px 16px',
          fontSize: 14, color: FM_COLORS.profit, lineHeight: 1.7, fontWeight: 500,
        }}>
          每一局结束后，告诉我结果：<br />
          <span style={{ fontSize: 16, fontWeight: 700 }}>说"赢200"或"输100"</span><br />
          <span style={{ fontSize: 12, color: FM_COLORS.profit, opacity: 0.8 }}>
            支持语音和打字，确认后我自动算账
          </span>
        </div>
        <p style={{ fontSize: 12, color: FM_COLORS.textSecondary, margin: '10px 0 0', lineHeight: 1.5 }}>
          手机保持在这个页面就行。掏出手机 → 解锁 → 直接就是记录界面，不需要找。
        </p>
      </div>

      {/* ═══ 第2块：我怎么帮你 ═══ */}
      <div style={{
        background: FM_COLORS.cardBg, borderRadius: 18,
        border: `1px solid ${FM_COLORS.border}`,
        padding: '18px 16px', marginBottom: 12,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: `${FM_COLORS.primary}12`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Shield size={17} color={FM_COLORS.primary} />
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, color: FM_COLORS.textPrimary }}>
            ② 我会帮你盯着这些
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <HelpItem text="实时计算你的净输赢、余额、距止损还剩多少" />
          <HelpItem text="盈利达标时自动锁盈，防止利润回吐" />
          <HelpItem text="超时提醒你离场，连输连赢都会提醒" />
          <HelpItem text="全程不替你做决定，但在关键时刻拉你一把" />
        </div>
      </div>

      {/* ═══ 第3块：警报机制 ═══ */}
      <div style={{
        background: FM_COLORS.cardBg, borderRadius: 18,
        border: `1px solid ${FM_COLORS.border}`,
        padding: '18px 16px', marginBottom: 20,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: `${FM_COLORS.danger}12`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Bell size={17} color={FM_COLORS.danger} />
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, color: FM_COLORS.textPrimary }}>
            ③ 手机会这样警报你
          </span>
        </div>

        {/* 3级告警 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          <AlertSample
            level="💡 预警"
            example="连输3手了，注意节奏"
            bg="rgba(253,224,71,0.10)" border="rgba(253,224,71,0.25)" color="#FDE047"
          />
          <AlertSample
            level="⚠ 正式提醒"
            example="亏损已达70%止损线！"
            bg="rgba(251,146,60,0.12)" border="rgba(251,146,60,0.25)" color="#FB923C"
          />
          <AlertSample
            level="🚨 强警告"
            example="已触达止损线，强烈建议停手！"
            bg="rgba(230,57,70,0.15)" border="rgba(248,113,113,0.30)" color="#FF6B6B"
          />
        </div>

        {/* 生理/情绪警报按钮说明 */}
        <div style={{
          background: `${FM_COLORS.warning}0C`, borderRadius: 14,
          padding: '12px 14px',
          border: `1px solid ${FM_COLORS.warning}25`,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
          }}>
            <AlertTriangle size={16} color={FM_COLORS.warning} />
            <span style={{ fontSize: 13, fontWeight: 700, color: FM_COLORS.textPrimary }}>
              生理/情绪警报按钮
            </span>
          </div>
          <p style={{ fontSize: 12, color: FM_COLORS.textSecondary, margin: 0, lineHeight: 1.6 }}>
            右下角的橙色按钮。当你感到<strong>头晕、心跳加速、手心出汗、愤怒冲动、想翻本</strong>时，
            立即按下。系统会<strong>自动暂停、60秒强制冷静</strong>，帮你在失控前刹住。
          </p>
        </div>
      </div>

      {/* ═══ 不再显示 ═══ */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 8, marginBottom: 16,
      }}>
        <button
          onClick={() => setDontShowAgain(!dontShowAgain)}
          style={{
            width: 18, height: 18, borderRadius: 4,
            border: `2px solid ${dontShowAgain ? FM_COLORS.primary : '#D1D5DB'}`,
            background: dontShowAgain ? FM_COLORS.primary : 'transparent',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {dontShowAgain && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6L5 9L10 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
        <span style={{ fontSize: 12, color: FM_COLORS.textSecondary }}>
          下次不再显示
        </span>
      </div>

      {/* ═══ 开始按钮 ═══ */}
      <button
        className="clickable"
        onClick={handleContinue}
        style={{
          width: '100%', padding: '15px', borderRadius: 30, border: 'none',
          fontSize: 16, fontWeight: 700, cursor: 'pointer',
          background: `linear-gradient(135deg, ${FM_COLORS.primary}, ${FM_COLORS.secondary})`,
          color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: '0 4px 16px rgba(27, 58, 75, 0.2)',
        }}
      >
        进场前，做一下自检
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

// ── 子组件 ──

function HelpItem({ text }: { text: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 8,
      padding: '6px 0',
    }}>
      <span style={{ fontSize: 14, lineHeight: 1, marginTop: 2 }}>✓</span>
      <span style={{ fontSize: 13, color: FM_COLORS.textPrimary, lineHeight: 1.5 }}>
        {text}
      </span>
    </div>
  );
}

function AlertSample({ level, example, bg, border, color }: {
  level: string; example: string; bg: string; border: string; color: string;
}) {
  return (
    <div style={{
      background: bg, border: `1px solid ${border}`, borderRadius: 10,
      padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <span style={{ fontSize: 12, fontWeight: 700, color, whiteSpace: 'nowrap' }}>
        {level}
      </span>
      <span style={{ fontSize: 12, color, opacity: 0.85 }}>
        "{example}"
      </span>
    </div>
  );
}
