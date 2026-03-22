import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Send, Loader, Bot, User } from 'lucide-react';
import { fillDefaults } from '../../services/fundManagerEngine';
import { FM_COLORS } from '../../theme';
import type { SessionPlan } from '../../types/fundManager';

interface FMPlanQAViewProps {
  onBack: () => void;
  onSubmit: (plan: Partial<SessionPlan>) => void;
}

// ============================================================
// AI 问答建档 — 5步引导式对话
// 基于 AI 对话脚本文档中的建档阶段设计
// ============================================================

interface QAStep {
  key: string;
  question: string;
  hint: string;
  extract: (answer: string, plan: Partial<SessionPlan>) => Partial<SessionPlan>;
  validate?: (answer: string) => string | null;
}

const QA_STEPS: QAStep[] = [
  {
    key: 'budget',
    question: '今天准备了多少资金？（告诉我总数就行）',
    hint: '例如: 5000、一万、8000港币',
    extract: (answer, plan) => {
      const num = parseNumber(answer);
      const currency = detectCurrency(answer);
      return {
        ...plan,
        session_budget: num || plan.session_budget,
        currency: currency || plan.currency || 'CNY',
      };
    },
    validate: (answer) => {
      const num = parseNumber(answer);
      return num && num > 0 ? null : '请告诉我一个具体的金额数字';
    },
  },
  {
    key: 'stop_loss',
    question: '你能接受的最大亏损是多少？（亏到多少就果断停手？）',
    hint: '例如: 1500、输三成就停、不能超过2000',
    extract: (answer, plan) => {
      const num = parseNumber(answer);
      const pct = parsePercent(answer);
      return {
        ...plan,
        stop_loss_amount: num || (pct && plan.session_budget ? Math.round(plan.session_budget * pct / 100) : plan.stop_loss_amount),
        stop_loss_pct: pct || plan.stop_loss_pct,
      };
    },
  },
  {
    key: 'take_profit',
    question: '赢到多少你愿意收手？（给自己定个目标）',
    hint: '例如: 赢2000就走、翻一倍、赢50%',
    extract: (answer, plan) => {
      const num = parseNumber(answer);
      const pct = parsePercent(answer);
      return {
        ...plan,
        take_profit_amount: num || (pct && plan.session_budget ? Math.round(plan.session_budget * pct / 100) : plan.take_profit_amount),
        take_profit_pct: pct || plan.take_profit_pct,
      };
    },
  },
  {
    key: 'base_unit',
    question: '每手打算下多少？（基础码量）',
    hint: '例如: 100、每手200、小码50',
    extract: (answer, plan) => {
      const num = parseNumber(answer);
      return {
        ...plan,
        base_unit: num || plan.base_unit,
      };
    },
  },
  {
    key: 'discipline',
    question: '最后一题：你允许自己中途加码吗？还有打算玩多久？',
    hint: '例如: 不加码玩1小时、可以小幅加码最多2小时、连输4手就停',
    extract: (answer, plan) => {
      const lower = answer.toLowerCase();
      const minutes = parseDuration(answer);
      const streak = parseStreak(answer);
      const noRaise = lower.includes('不加') || lower.includes('不许') || lower.includes('禁止');
      return {
        ...plan,
        allow_raise_bet: noRaise ? false : (plan.allow_raise_bet ?? false),
        max_duration_minutes: minutes || plan.max_duration_minutes || 90,
        stop_loss_streak: streak || plan.stop_loss_streak || 5,
      };
    },
  },
];

interface ChatMessage {
  role: 'ai' | 'user';
  text: string;
}

export default function FMPlanQAView({ onBack, onSubmit }: FMPlanQAViewProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'ai', text: '我来帮你制定方案，只问5个问题就好 😊' },
    { role: 'ai', text: QA_STEPS[0].question },
  ]);
  const [inputText, setInputText] = useState('');
  const [plan, setPlan] = useState<Partial<SessionPlan>>({ input_method: 'ai_qa' });
  const [validationError, setValidationError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text) return;

    const step = QA_STEPS[stepIndex];

    // 验证
    if (step.validate) {
      const err = step.validate(text);
      if (err) {
        setValidationError(err);
        return;
      }
    }
    setValidationError(null);

    // 添加用户消息
    const newMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', text },
    ];

    // 提取数据
    const updatedPlan = step.extract(text, plan);
    setPlan(updatedPlan);
    setInputText('');

    // 下一步
    const nextIndex = stepIndex + 1;
    if (nextIndex < QA_STEPS.length) {
      // AI 确认 + 下一题
      const confirmation = getConfirmation(step.key, text, updatedPlan);
      newMessages.push({ role: 'ai', text: confirmation });
      newMessages.push({ role: 'ai', text: QA_STEPS[nextIndex].question });
      setStepIndex(nextIndex);
    } else {
      // 最后一步 — 生成方案
      newMessages.push({
        role: 'ai',
        text: '好的，我帮你整理好了完整的风控方案，马上给你看 ✅',
      });
      // Fix: 使用 newMessages 而非 messages（避免 stale closure 丢失最后一条用户回答）
      const allUserTexts = newMessages.filter(m => m.role === 'user').map(m => m.text).join('\n');
      setTimeout(() => {
        onSubmit({
          ...updatedPlan,
          input_method: 'ai_qa',
          raw_input: allUserTexts,
        });
      }, 800);
    }

    setMessages(newMessages);
  };

  const isComplete = stepIndex >= QA_STEPS.length;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', maxWidth: 480, margin: '0 auto',
    }}>
      {/* 顶部 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px', flexShrink: 0,
        borderBottom: `1px solid ${FM_COLORS.border}`,
      }}>
        <button className="clickable" onClick={onBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6 }}>
          <ArrowLeft size={20} color={FM_COLORS.textPrimary} />
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: FM_COLORS.textPrimary }}>
            AI 问答建档
          </h2>
          <p style={{ fontSize: 11, color: FM_COLORS.textSecondary, margin: 0 }}>
            第 {Math.min(stepIndex + 1, QA_STEPS.length)} / {QA_STEPS.length} 步
          </p>
        </div>
        {/* 进度条 */}
        <div style={{
          width: 60, height: 4, borderRadius: 2, background: FM_COLORS.border,
        }}>
          <div style={{
            width: `${Math.min((stepIndex + 1) / QA_STEPS.length * 100, 100)}%`,
            height: '100%', borderRadius: 2,
            background: `linear-gradient(90deg, ${FM_COLORS.primary}, ${FM_COLORS.secondary})`,
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      {/* 聊天区域 */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '16px',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div style={{
              maxWidth: '80%', padding: '10px 14px',
              borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              background: msg.role === 'user' ? FM_COLORS.userBg : FM_COLORS.aiBg,
              fontSize: 14, color: FM_COLORS.textPrimary,
              lineHeight: 1.6,
            }}>
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* 输入区域 */}
      {!isComplete && (
        <div style={{
          padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))',
          borderTop: `1px solid ${FM_COLORS.border}`,
          background: FM_COLORS.cardBg,
        }}>
          {/* 提示 */}
          {QA_STEPS[stepIndex] && (
            <div style={{
              fontSize: 11, color: FM_COLORS.accent, marginBottom: 8,
            }}>
              💡 {QA_STEPS[stepIndex].hint}
            </div>
          )}

          {/* 验证错误 */}
          {validationError && (
            <div style={{
              fontSize: 12, color: '#DC2626', marginBottom: 6,
            }}>
              ⚠️ {validationError}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="输入你的回答..."
              style={{
                flex: 1, padding: '10px 14px',
                borderRadius: 20, border: `1px solid ${FM_COLORS.border}`,
                background: FM_COLORS.inputBg,
                fontSize: 15, color: FM_COLORS.textPrimary,
                outline: 'none',
              }}
            />
            <button
              className="clickable"
              onClick={handleSend}
              disabled={!inputText.trim()}
              style={{
                width: 42, height: 42, borderRadius: 21,
                border: 'none', cursor: inputText.trim() ? 'pointer' : 'not-allowed',
                background: inputText.trim()
                  ? `linear-gradient(135deg, ${FM_COLORS.primary}, ${FM_COLORS.secondary})`
                  : '#d1d5db',
                color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 辅助函数
// ============================================================

function parseNumber(text: string): number | null {
  // 中文数字映射
  const map: Record<string, number> = {
    '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5,
    '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
    '百': 100, '千': 1000, '万': 10000,
  };

  // 先尝试直接数字
  const numMatch = text.match(/[\d,]+(\.\d+)?/);
  if (numMatch) {
    return parseFloat(numMatch[0].replace(/,/g, ''));
  }

  // 中文数字（简单处理常见模式）
  const cnMatch = text.match(/([一二两三四五六七八九十百千万]+)/);
  if (cnMatch) {
    const cn = cnMatch[1];
    let result = 0;
    let current = 0;

    for (const char of cn) {
      const val = map[char];
      if (!val) continue;

      if (val >= 10) {
        // 单位
        if (current === 0) current = 1;
        if (val === 10000) {
          result = (result + current) * val;
          current = 0;
        } else {
          current *= val;
          result += current;
          current = 0;
        }
      } else {
        current = val;
      }
    }
    result += current;
    return result > 0 ? result : null;
  }

  return null;
}

function detectCurrency(text: string): string | null {
  if (/港币|HKD|hk\$/i.test(text)) return 'HKD';
  if (/美元|美金|USD|\$(?!.*港)/i.test(text)) return 'USD';
  if (/澳门币|MOP/i.test(text)) return 'MOP';
  if (/人民币|RMB|元|块|CNY/i.test(text)) return 'CNY';
  return null;
}

function parsePercent(text: string): number | null {
  const match = text.match(/(\d+)\s*[%％成]/);
  if (match) {
    let num = parseInt(match[1]);
    if (text.includes('成')) num *= 10;
    return num;
  }
  if (text.includes('翻一倍') || text.includes('翻倍')) return 100;
  if (text.includes('三成')) return 30;
  if (text.includes('两成') || text.includes('二成')) return 20;
  if (text.includes('五成') || text.includes('一半')) return 50;
  return null;
}

function parseDuration(text: string): number | null {
  const hourMatch = text.match(/(\d+\.?\d*)\s*[个小]?时/);
  const minMatch = text.match(/(\d+)\s*分/);
  const halfMatch = text.match(/半\s*[个小]?时/);
  const cnHalfMatch = text.match(/一个半小时/);

  if (cnHalfMatch) return 90;
  if (hourMatch) {
    let hours = parseFloat(hourMatch[1]);
    if (text.includes('半')) hours += 0.5;
    return Math.round(hours * 60);
  }
  if (halfMatch) return 30;
  if (minMatch) return parseInt(minMatch[1]);
  return null;
}

function parseStreak(text: string): number | null {
  const match = text.match(/连[输败](\d+)[手次把]/);
  if (match) return parseInt(match[1]);

  const cnMatch = text.match(/连[输败]([一二三四五六七八九十]+)[手次把]/);
  if (cnMatch) {
    const num = parseNumber(cnMatch[1]);
    return num;
  }
  return null;
}

function getConfirmation(stepKey: string, answer: string, plan: Partial<SessionPlan>): string {
  switch (stepKey) {
    case 'budget':
      return `好的，操盘资金 ${plan.session_budget}${plan.currency === 'CNY' ? '元' : ` ${plan.currency}`}，记下了。`;
    case 'stop_loss':
      return `明白，最大亏损${plan.stop_loss_amount ? ` ${plan.stop_loss_amount}` : ''}${plan.stop_loss_pct ? `（${plan.stop_loss_pct}%）` : ''}，到了就停。`;
    case 'take_profit':
      return `收到，盈利目标${plan.take_profit_amount ? ` ${plan.take_profit_amount}` : ''}，到了就收。`;
    case 'base_unit':
      return `好，基础码量 ${plan.base_unit}，记住了。`;
    default:
      return '收到，已记录。';
  }
}
