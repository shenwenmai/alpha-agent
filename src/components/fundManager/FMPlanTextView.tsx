import React, { useState } from 'react';
import { ArrowLeft, Send, Loader, Sparkles, AlertTriangle } from 'lucide-react';
import { FM_COLORS } from '../../theme';
import type { SessionPlan } from '../../types/fundManager';

interface FMPlanTextViewProps {
  onBack: () => void;
  onSubmit: (plan: Partial<SessionPlan>) => void;
}

const EXAMPLES = [
  '今天带5000，基码100，输1500就走，赢2000就收，最多玩1个半小时，不加码',
  '本金1万，每手200，止损3000，止盈5000，连输4手就停，赢到3000开始锁盈最少保2000',
  '带2万港币，基码500，最多输5000，赢8000就走，玩2小时',
];

export default function FMPlanTextView({ onBack, onSubmit }: FMPlanTextViewProps) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<{
    plan: Partial<SessionPlan>;
    confidence: number;
    missing_fields: string[];
    warnings: string[];
  } | null>(null);

  const handleParse = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setParseResult(null);

    try {
      const res = await fetch('/api/fm-parse-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `解析失败 (${res.status})`);
      }

      const data = await res.json();
      setParseResult(data);

      // 如果置信度高直接提交
      if (data.confidence >= 0.7 && data.missing_fields.length <= 2) {
        onSubmit({
          ...data.plan,
          input_method: 'text',
          raw_input: text.trim(),
        });
      }
    } catch (e: any) {
      setError(e.message || '解析失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmResult = () => {
    if (!parseResult) return;
    onSubmit({
      ...parseResult.plan,
      input_method: 'text',
      raw_input: text.trim(),
    });
  };

  return (
    <div style={{ padding: '20px 16px 120px', maxWidth: 480, margin: '0 auto' }}>
      {/* 顶部 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
      }}>
        <button
          className="clickable"
          onClick={onBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6 }}
        >
          <ArrowLeft size={20} color={FM_COLORS.textPrimary} />
        </button>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: FM_COLORS.textPrimary }}>
            自由文字输入
          </h2>
          <p style={{ fontSize: 12, color: FM_COLORS.textSecondary, margin: 0 }}>
            用你的话描述，AI 自动解析
          </p>
        </div>
      </div>

      {/* 示例提示 */}
      <div style={{
        background: `${FM_COLORS.primary}06`, borderRadius: 14,
        padding: '12px 14px', marginBottom: 16,
        border: `1px solid ${FM_COLORS.border}`,
      }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: FM_COLORS.textSecondary,
          marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <Sparkles size={13} /> 例如你可以说：
        </div>
        {EXAMPLES.map((ex, i) => (
          <div
            key={i}
            className="clickable"
            onClick={() => setText(ex)}
            style={{
              fontSize: 12, color: FM_COLORS.accent,
              padding: '6px 0', cursor: 'pointer',
              borderBottom: i < EXAMPLES.length - 1 ? `1px solid ${FM_COLORS.border}` : 'none',
              lineHeight: 1.5,
            }}
          >
            "{ex}"
          </div>
        ))}
      </div>

      {/* 文字输入区 */}
      <div style={{
        background: FM_COLORS.cardBg, borderRadius: 16,
        border: `1px solid ${FM_COLORS.border}`,
        padding: '14px', marginBottom: 16,
      }}>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="用你自己的话描述你的计划..."
          rows={5}
          style={{
            width: '100%', border: 'none', background: FM_COLORS.inputBg,
            borderRadius: 12, padding: '12px 14px',
            fontSize: 15, color: FM_COLORS.textPrimary,
            resize: 'none', outline: 'none', boxSizing: 'border-box',
            lineHeight: 1.6,
          }}
        />

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginTop: 10,
        }}>
          <span style={{ fontSize: 11, color: FM_COLORS.textSecondary }}>
            {text.length} 字
          </span>
          <button
            className="clickable"
            onClick={handleParse}
            disabled={!text.trim() || loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 20px', borderRadius: 20,
              background: text.trim() && !loading
                ? `linear-gradient(135deg, ${FM_COLORS.primary}, ${FM_COLORS.secondary})`
                : '#d1d5db',
              color: '#fff', border: 'none',
              fontSize: 14, fontWeight: 700,
              cursor: text.trim() && !loading ? 'pointer' : 'not-allowed',
            }}
          >
            {loading ? <Loader size={16} className="spin" /> : <Send size={16} />}
            {loading ? 'AI 解析中...' : 'AI 解析'}
          </button>
        </div>
      </div>

      {/* 错误 */}
      {error && (
        <div style={{
          background: 'rgba(230,57,70,0.15)', borderRadius: 12, padding: '10px 14px',
          marginBottom: 16, fontSize: 13, color: '#FF6B6B',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* 解析结果 */}
      {parseResult && (
        <div style={{
          background: FM_COLORS.cardBg, borderRadius: 16,
          border: `1px solid ${FM_COLORS.border}`,
          padding: '16px', marginBottom: 16,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 12,
          }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: FM_COLORS.textPrimary }}>
              AI 解析结果
            </span>
            <span style={{
              fontSize: 11, fontWeight: 600,
              padding: '3px 10px', borderRadius: 10,
              background: parseResult.confidence >= 0.7 ? 'rgba(34,197,94,0.15)' : 'rgba(230,184,0,0.12)',
              color: parseResult.confidence >= 0.7 ? '#4ADE80' : '#FBBF24',
            }}>
              置信度 {Math.round(parseResult.confidence * 100)}%
            </span>
          </div>

          {/* 提取到的参数 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
            {Object.entries(parseResult.plan).map(([key, value]) => {
              if (value == null) return null;
              return (
                <div key={key} style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: 13, padding: '4px 0',
                }}>
                  <span style={{ color: FM_COLORS.textSecondary }}>{fieldLabel(key)}</span>
                  <span style={{ fontWeight: 600, color: FM_COLORS.textPrimary }}>
                    {typeof value === 'boolean' ? (value ? '是' : '否') : String(value)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* 缺失字段 */}
          {parseResult.missing_fields.length > 0 && (
            <div style={{
              fontSize: 12, color: '#FBBF24', background: 'rgba(230,184,0,0.12)',
              borderRadius: 8, padding: '8px 10px', marginBottom: 10,
            }}>
              ⚠️ 未提及: {parseResult.missing_fields.map(f => fieldLabel(f)).join('、')}
              <br/>
              <span style={{ fontSize: 11, opacity: 0.8 }}>（将使用智能默认值）</span>
            </div>
          )}

          {/* 警告 */}
          {parseResult.warnings.length > 0 && (
            <div style={{
              fontSize: 12, color: '#FF6B6B', background: 'rgba(230,57,70,0.15)',
              borderRadius: 8, padding: '8px 10px', marginBottom: 10,
            }}>
              {parseResult.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
            </div>
          )}

          <button
            className="clickable"
            onClick={handleConfirmResult}
            style={{
              width: '100%', padding: '12px', borderRadius: 14,
              background: `linear-gradient(135deg, ${FM_COLORS.primary}, ${FM_COLORS.secondary})`,
              color: '#fff', border: 'none', fontSize: 15, fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            使用此方案 →
          </button>
        </div>
      )}
    </div>
  );
}

// 字段中文名映射
function fieldLabel(key: string): string {
  const labels: Record<string, string> = {
    total_bankroll: '总资金',
    session_budget: '操盘资金',
    base_unit: '基码',
    currency: '币种',
    stop_loss_amount: '止损金额',
    stop_loss_pct: '止损比例',
    stop_loss_streak: '连输手数止损',
    stop_loss_streak_warn: '连输提醒',
    stop_loss_net_hands: '净输手数止损',
    max_duration_minutes: '最长时间',
    take_profit_amount: '止盈目标',
    take_profit_pct: '止盈比例',
    lock_profit_trigger: '锁盈触发',
    lock_profit_floor: '保底盈利',
    take_profit_action: '止盈行为',
    allow_raise_bet: '允许加码',
    max_bet_unit: '最大码量',
    allow_raise_in_profit: '盈利区调码',
    forbid_raise_in_loss: '亏损禁加',
    idle_reminder: '空闲提醒',
    reminder_mode: '提醒方式',
  };
  return labels[key] || key;
}
