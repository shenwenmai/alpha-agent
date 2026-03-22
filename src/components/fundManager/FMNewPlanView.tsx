import React, { useState } from 'react';
import {
  ArrowLeft, FileText, Mic, MessageSquare,
  Monitor, HelpCircle, BookOpen, ChevronDown, ChevronUp, ChevronRight,
} from 'lucide-react';
import { FM_COLORS } from '../../theme';
import type { PlanInputMethod, SessionPlan } from '../../types/fundManager';

interface FMNewPlanViewProps {
  onBack: () => void;
  onSelectMethod: (method: PlanInputMethod) => void;
}

interface MethodOption {
  method: PlanInputMethod;
  icon: React.ReactNode;
  title: string;
  desc: string;
  tag?: string;
  tagColor?: string;
}

const methods: MethodOption[] = [
  {
    method: 'form',
    icon: <FileText size={22} color={FM_COLORS.primary} />,
    title: '标准表单',
    desc: '逐项填写资金、止损、止盈等参数',
    tag: '推荐',
    tagColor: FM_COLORS.secondary,
  },
  {
    method: 'text',
    icon: <MessageSquare size={22} color={FM_COLORS.accent} />,
    title: '自由文字',
    desc: '用你的话描述，AI 自动解析成方案',
    tag: 'AI',
    tagColor: '#6366f1',
  },
  {
    method: 'voice',
    icon: <Mic size={22} color={FM_COLORS.accent} />,
    title: '语音输入',
    desc: '开口说出你的计划，30秒搞定',
    tag: 'AI',
    tagColor: '#6366f1',
  },
  {
    method: 'screen_voice',
    icon: <Monitor size={22} color={FM_COLORS.accent} />,
    title: '屏幕 + 语音',
    desc: '看着牌桌指标，边看边说边建档',
    tag: 'AI',
    tagColor: '#6366f1',
  },
  {
    method: 'ai_qa',
    icon: <HelpCircle size={22} color={FM_COLORS.accent} />,
    title: 'AI 问诊定策',
    desc: '说出打法与心理，AI 生成专属战约',
    tag: 'AI',
    tagColor: '#6366f1',
  },
  {
    method: 'template',
    icon: <BookOpen size={22} color={FM_COLORS.accent} />,
    title: '从模板创建',
    desc: '选一个预设方案，快速微调开始',
  },
];

export default function FMNewPlanView({ onBack, onSelectMethod }: FMNewPlanViewProps) {
  const [showMoreMethods, setShowMoreMethods] = useState(false);

  return (
    <div style={{ padding: '20px 16px 20px', maxWidth: 480, margin: '0 auto' }}>
      {/* 顶部 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24,
      }}>
        <button
          className="clickable"
          onClick={onBack}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: 6, borderRadius: 10,
          }}
        >
          <ArrowLeft size={20} color={FM_COLORS.textPrimary} />
        </button>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: FM_COLORS.textPrimary }}>
            制定风控方案
          </h2>
          <p style={{ fontSize: 12, color: FM_COLORS.textSecondary, margin: 0 }}>
            选择方式，生成你的战约
          </p>
        </div>
      </div>

      {/* 提示文案 */}
      <div style={{
        background: `linear-gradient(135deg, ${FM_COLORS.primary}08, ${FM_COLORS.secondary}08)`,
        borderRadius: 14, padding: '14px 16px', marginBottom: 20,
        border: `1px solid ${FM_COLORS.border}`,
      }}>
        <p style={{
          fontSize: 13, color: FM_COLORS.textSecondary, margin: 0, lineHeight: 1.6,
        }}>
          💡 上桌前花 30 秒定个方案，我帮你全程盯着。
          <br/>
          不管哪种方式，最终都会生成一份结构化的风控方案供你确认。
        </p>
      </div>

      {/* ── 套用模板 → 跳转到完整模板页 ── */}
      <div
        className="clickable"
        onClick={() => onSelectMethod('template')}
        style={{
          background: FM_COLORS.cardBg, borderRadius: 16, padding: '18px 20px',
          border: `1px solid ${FM_COLORS.border}`, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 14,
          marginBottom: 20,
        }}
      >
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: `linear-gradient(135deg, ${FM_COLORS.primary}20, ${FM_COLORS.secondary}20)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, flexShrink: 0,
        }}>
          🧩
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: FM_COLORS.textPrimary, marginBottom: 3 }}>
            套用模板
          </div>
          <div style={{ fontSize: 13, color: FM_COLORS.textSecondary }}>
            保守 · 平衡 · 激进 — 选一个方案快速开始
          </div>
        </div>
        <ChevronRight size={20} color={FM_COLORS.textSecondary} />
      </div>

      {/* ── 分割线 ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
      }}>
        <div style={{ flex: 1, height: 1, background: FM_COLORS.border }} />
        <span style={{ fontSize: 12, color: '#555' }}>或</span>
        <div style={{ flex: 1, height: 1, background: FM_COLORS.border }} />
      </div>

      {/* ── AI 问诊定策 ── */}
      <div
        className="clickable"
        onClick={() => onSelectMethod('ai_qa')}
        style={{
          background: `linear-gradient(135deg, ${FM_COLORS.primary}12, #6366f115)`,
          borderRadius: 16, padding: '18px 20px',
          border: `1.5px solid ${FM_COLORS.primary}40`, cursor: 'pointer',
          textAlign: 'center', marginBottom: 20,
        }}
      >
        <div style={{ fontSize: 17, fontWeight: 700, color: FM_COLORS.textPrimary, marginBottom: 4 }}>
          🤝 AI 问诊定策
        </div>
        <div style={{ fontSize: 13, color: FM_COLORS.textSecondary }}>
          说出你的打法和心理，AI 帮你生成专属战约
        </div>
      </div>

      {/* ── 更多输入方式（可折叠） ── */}
      <button
        className="clickable"
        onClick={() => setShowMoreMethods(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          width: '100%', padding: '10px 0', marginBottom: showMoreMethods ? 12 : 0,
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#555', fontSize: 13,
        }}
      >
        更多方式
        {showMoreMethods ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {/* 输入方式列表 */}
      {showMoreMethods && <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {methods.map(m => (
          <div
            key={m.method}
            className="clickable"
            onClick={() => onSelectMethod(m.method)}
            style={{
              background: FM_COLORS.cardBg,
              borderRadius: 16, padding: '16px 18px',
              border: `1px solid ${FM_COLORS.border}`,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 14,
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: `${FM_COLORS.primary}08`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {m.icon}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: FM_COLORS.textPrimary }}>
                  {m.title}
                </span>
                {m.tag && (
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    padding: '2px 8px', borderRadius: 10,
                    backgroundColor: `${m.tagColor}15`,
                    color: m.tagColor,
                  }}>
                    {m.tag}
                  </span>
                )}
              </div>
              <p style={{
                fontSize: 12, color: FM_COLORS.textSecondary,
                margin: '3px 0 0', lineHeight: 1.4,
              }}>
                {m.desc}
              </p>
            </div>
          </div>
        ))}
      </div>}
    </div>
  );
}
