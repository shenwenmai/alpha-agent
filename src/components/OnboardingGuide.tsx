import React, { useState } from 'react';
import { Shield, Zap, TrendingUp, MessageCircle, ChevronRight } from 'lucide-react';

interface OnboardingGuideProps {
  onComplete: () => void;
}

const STEPS = [
  {
    icon: Shield,
    color: '#E6B800',
    title: '博弈操作系统',
    subtitle: '你只管判断，我来帮你盯着',
    body: '从进场策略到离场复盘，全程守护你的纪律和情绪。',
  },
  {
    icon: Zap,
    color: '#22C55E',
    title: '三步开始',
    subtitle: '',
    body: '',
    steps: [
      { num: '1', text: '制定策略 — 设定预算、止损、止盈' },
      { num: '2', text: '实战记录 — 每手结果实时跟踪' },
      { num: '3', text: '复盘成长 — AI 分析你的表现' },
    ],
  },
  {
    icon: TrendingUp,
    color: '#60A5FA',
    title: '情绪转折点',
    subtitle: '核心能力',
    body: '系统会实时检测你的情绪变化，在失控前提醒你暂停、深呼吸、重新评估。',
  },
  {
    icon: MessageCircle,
    color: '#FF8C00',
    title: '准备好了吗？',
    subtitle: '',
    body: '点击下方按钮，开始你的第一场策略制定。',
  },
];

export default function OnboardingGuide({ onComplete }: OnboardingGuideProps) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#0A0A0A',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '40px 32px',
      color: '#fff',
    }}>
      {/* 进度点 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 48 }}>
        {STEPS.map((_, i) => (
          <div key={i} style={{
            width: i === step ? 24 : 8, height: 8,
            borderRadius: 4,
            background: i === step ? current.color : '#333',
            transition: 'all 0.3s ease',
          }} />
        ))}
      </div>

      {/* 图标 */}
      <div style={{
        width: 80, height: 80, borderRadius: '50%',
        background: `${current.color}20`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 32,
      }}>
        <Icon size={36} color={current.color} />
      </div>

      {/* 标题 */}
      <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0, textAlign: 'center' }}>
        {current.title}
      </h1>
      {current.subtitle && (
        <p style={{ fontSize: 13, color: '#888', marginTop: 6, marginBottom: 0 }}>
          {current.subtitle}
        </p>
      )}

      {/* 内容 */}
      <div style={{ marginTop: 24, maxWidth: 300, textAlign: 'center' }}>
        {current.body && (
          <p style={{ fontSize: 15, color: '#AAAAAA', lineHeight: 1.7, margin: 0 }}>
            {current.body}
          </p>
        )}
        {current.steps && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'left' }}>
            {current.steps.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: '#E6B800', color: '#000',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 800, flexShrink: 0,
                }}>
                  {s.num}
                </div>
                <span style={{ fontSize: 14, color: '#AAAAAA', lineHeight: 1.6, paddingTop: 3 }}>
                  {s.text}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 按钮 */}
      <div style={{ marginTop: 'auto', width: '100%', maxWidth: 300, paddingTop: 48 }}>
        <button
          onClick={() => {
            if (isLast) {
              localStorage.setItem('onboarding_done', '1');
              onComplete();
            } else {
              setStep(step + 1);
            }
          }}
          style={{
            width: '100%', padding: '16px 0',
            background: current.color,
            color: '#000', fontWeight: 700,
            fontSize: 16,
            border: 'none', borderRadius: 12,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {isLast ? '开始使用' : '继续'}
          <ChevronRight size={18} />
        </button>

        {!isLast && (
          <button
            onClick={() => {
              localStorage.setItem('onboarding_done', '1');
              onComplete();
            }}
            style={{
              width: '100%', padding: '12px 0', marginTop: 12,
              background: 'transparent',
              color: '#888888', fontWeight: 500,
              fontSize: 13,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            跳过引导
          </button>
        )}
      </div>
    </div>
  );
}
