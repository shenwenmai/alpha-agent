import React, { useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { fillDefaults, getRiskLevel } from '../../services/fundManagerEngine';
import { FM_COLORS } from '../../theme';
import type { SessionPlan, ReminderMode } from '../../types/fundManager';

interface FMPlanFormViewProps {
  onBack: () => void;
  onSubmit: (plan: Partial<SessionPlan>) => void;
  initialPlan?: Partial<SessionPlan>;
}

const CURRENCIES = [
  { value: 'CNY', label: '¥ 人民币' },
  { value: 'HKD', label: 'HK$ 港币' },
  { value: 'MOP', label: 'MOP$ 澳门币' },
  { value: 'USD', label: '$ 美元' },
];

const REMINDER_OPTIONS: { value: ReminderMode; label: string }[] = [
  { value: 'popup', label: '弹窗提醒' },
  { value: 'vibration', label: '震动' },
  { value: 'voice', label: '语音播报' },
  { value: 'silent', label: '静默记录' },
];

const TAKE_PROFIT_ACTIONS = [
  { value: 'suggest', label: '建议离场' },
  { value: 'strong_suggest', label: '强烈建议离场' },
  { value: 'notify_only', label: '仅通知' },
];

export default function FMPlanFormView({ onBack, onSubmit, initialPlan }: FMPlanFormViewProps) {
  // 表单状态
  const [form, setForm] = useState<Partial<SessionPlan>>({
    currency: 'CNY',
    total_bankroll: undefined,
    session_budget: undefined,
    base_unit: undefined,
    stop_loss_amount: undefined,
    stop_loss_pct: undefined,
    stop_loss_streak: 5,
    stop_loss_streak_warn: 4,
    stop_loss_net_hands: 8,
    max_duration_minutes: 90,
    take_profit_amount: undefined,
    take_profit_pct: undefined,
    lock_profit_trigger: undefined,
    lock_profit_floor: undefined,
    take_profit_action: 'suggest',
    allow_raise_bet: false,
    max_bet_unit: undefined,
    allow_raise_in_profit: false,
    forbid_raise_in_loss: true,
    idle_reminder: true,
    reminder_mode: ['popup'],
    input_method: 'form',
    ...initialPlan,
  });

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    money: true,
    stop_loss: true,
    take_profit: false,
    discipline: false,
    reminder: false,
  });

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const updateField = (key: keyof SessionPlan, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    // 填充缺失字段的默认值
    const filled = fillDefaults(form);
    onSubmit(filled);
  };

  // 自动计算建议值
  const budget = form.session_budget || 0;
  const suggestedStopLoss = budget ? Math.round(budget * 0.3) : 0;
  const suggestedTakeProfit = budget ? Math.round(budget * 0.5) : 0;
  const suggestedBaseUnit = budget ? Math.round(budget * 0.02) : 0;

  // 风险等级评估
  const riskLevel = getRiskLevel(form as SessionPlan);

  const isValid = form.session_budget && form.session_budget > 0;

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
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: FM_COLORS.textPrimary }}>
            标准表单
          </h2>
          <p style={{ fontSize: 12, color: FM_COLORS.textSecondary, margin: 0 }}>
            逐项填写你的风控参数
          </p>
        </div>
        {budget > 0 && (
          <RiskBadge level={riskLevel} />
        )}
      </div>

      {/* ── 资金设置 ── */}
      <FormSection
        title="💰 资金设置"
        sectionKey="money"
        expanded={expandedSections.money}
        onToggle={toggleSection}
      >
        <FormSelect
          label="币种"
          value={form.currency || 'CNY'}
          options={CURRENCIES}
          onChange={v => updateField('currency', v)}
        />
        <FormNumber
          label="总资金"
          value={form.total_bankroll}
          placeholder="你的总可用资金"
          onChange={v => updateField('total_bankroll', v)}
          hint="可选，用于计算整体仓位比例"
        />
        <FormNumber
          label="操盘资金"
          value={form.session_budget}
          placeholder="今天准备带多少上桌"
          onChange={v => updateField('session_budget', v)}
          required
        />
        <FormNumber
          label="基码（每手基础金额）"
          value={form.base_unit}
          placeholder={suggestedBaseUnit ? `建议 ${suggestedBaseUnit}` : '每手投注单位'}
          onChange={v => updateField('base_unit', v)}
          hint={budget > 0 ? `建议为操盘资金的 2%: ${suggestedBaseUnit}` : undefined}
        />
      </FormSection>

      {/* ── 止损设置 ── */}
      <FormSection
        title="🛑 止损设置"
        sectionKey="stop_loss"
        expanded={expandedSections.stop_loss}
        onToggle={toggleSection}
      >
        <FormNumber
          label="最大亏损金额"
          value={form.stop_loss_amount}
          placeholder={suggestedStopLoss ? `建议 ${suggestedStopLoss}` : '亏到这个数就停'}
          onChange={v => updateField('stop_loss_amount', v)}
          hint={budget > 0 ? `建议为操盘资金的 30%: ${suggestedStopLoss}` : undefined}
        />
        <FormNumber
          label="最大亏损比例 (%)"
          value={form.stop_loss_pct}
          placeholder="例如 30"
          onChange={v => updateField('stop_loss_pct', v)}
          max={100}
        />
        <FormNumber
          label="连输手数止损"
          value={form.stop_loss_streak}
          placeholder="连输几手就停"
          onChange={v => updateField('stop_loss_streak', v)}
        />
        <FormNumber
          label="连输提醒手数"
          value={form.stop_loss_streak_warn}
          placeholder="连输几手开始提醒"
          onChange={v => updateField('stop_loss_streak_warn', v)}
          hint="应小于连输手数止损"
        />
        <FormNumber
          label="净输手数止损"
          value={form.stop_loss_net_hands}
          placeholder="净输几手就停"
          onChange={v => updateField('stop_loss_net_hands', v)}
        />
        <FormNumber
          label="最长时间 (分钟)"
          value={form.max_duration_minutes}
          placeholder="最多玩多久"
          onChange={v => updateField('max_duration_minutes', v)}
        />
      </FormSection>

      {/* ── 止盈设置 ── */}
      <FormSection
        title="🎯 止盈设置"
        sectionKey="take_profit"
        expanded={expandedSections.take_profit}
        onToggle={toggleSection}
      >
        <FormNumber
          label="盈利目标金额"
          value={form.take_profit_amount}
          placeholder={suggestedTakeProfit ? `建议 ${suggestedTakeProfit}` : '赢到这个数就收'}
          onChange={v => updateField('take_profit_amount', v)}
          hint={budget > 0 ? `建议为操盘资金的 50%: ${suggestedTakeProfit}` : undefined}
        />
        <FormNumber
          label="盈利目标比例 (%)"
          value={form.take_profit_pct}
          placeholder="例如 50"
          onChange={v => updateField('take_profit_pct', v)}
          max={100}
        />
        <FormNumber
          label="锁盈触发金额"
          value={form.lock_profit_trigger}
          placeholder="盈利达到多少开始锁盈"
          onChange={v => updateField('lock_profit_trigger', v)}
          hint="建议为止盈目标的 50~70%"
        />
        <FormNumber
          label="最低保留盈利"
          value={form.lock_profit_floor}
          placeholder="至少保住多少盈利"
          onChange={v => updateField('lock_profit_floor', v)}
          hint="回撤到这个数就强制收手"
        />
        <FormSelect
          label="达到止盈时的行为"
          value={form.take_profit_action || 'suggest'}
          options={TAKE_PROFIT_ACTIONS}
          onChange={v => updateField('take_profit_action', v)}
        />
      </FormSection>

      {/* ── 纪律设置 ── */}
      <FormSection
        title="📏 纪律设置"
        sectionKey="discipline"
        expanded={expandedSections.discipline}
        onToggle={toggleSection}
      >
        <FormToggle
          label="是否允许加码"
          value={form.allow_raise_bet ?? false}
          onChange={v => updateField('allow_raise_bet', v)}
          hint="关闭后，全程只能用基码"
        />
        {form.allow_raise_bet && (
          <>
            <FormNumber
              label="最大码量"
              value={form.max_bet_unit}
              placeholder="单手最大金额"
              onChange={v => updateField('max_bet_unit', v)}
            />
            <FormToggle
              label="盈利区可调码量"
              value={form.allow_raise_in_profit ?? false}
              onChange={v => updateField('allow_raise_in_profit', v)}
            />
          </>
        )}
        <FormToggle
          label="亏损区禁止加码"
          value={form.forbid_raise_in_loss ?? true}
          onChange={v => updateField('forbid_raise_in_loss', v)}
          hint="开启后，亏损状态下不允许加大码量"
        />
        <FormToggle
          label="长时间未记录提醒"
          value={form.idle_reminder ?? true}
          onChange={v => updateField('idle_reminder', v)}
        />
      </FormSection>

      {/* ── 提醒方式 ── */}
      <FormSection
        title="🔔 提醒方式"
        sectionKey="reminder"
        expanded={expandedSections.reminder}
        onToggle={toggleSection}
      >
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: FM_COLORS.textPrimary }}>
            提醒方式（多选）
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {REMINDER_OPTIONS.map(opt => {
              const selected = (form.reminder_mode || []).includes(opt.value);
              return (
                <button
                  key={opt.value}
                  className="clickable"
                  onClick={() => {
                    const current = form.reminder_mode || [];
                    const next = selected
                      ? current.filter(m => m !== opt.value)
                      : [...current, opt.value];
                    updateField('reminder_mode', next.length > 0 ? next : ['popup']);
                  }}
                  style={{
                    padding: '8px 14px', borderRadius: 20,
                    fontSize: 13, fontWeight: 600,
                    border: selected ? `2px solid ${FM_COLORS.primary}` : `1px solid ${FM_COLORS.border}`,
                    background: selected ? `${FM_COLORS.primary}10` : FM_COLORS.cardBg,
                    color: selected ? FM_COLORS.primary : FM_COLORS.textSecondary,
                    cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </FormSection>

      {/* 提交按钮 */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))',
        background: `linear-gradient(transparent, ${FM_COLORS.bg} 20%)`,
      }}>
        <button
          className="clickable"
          onClick={handleSubmit}
          disabled={!isValid}
          style={{
            width: '100%', maxWidth: 448, margin: '0 auto', display: 'block',
            padding: '14px', borderRadius: 30, border: 'none',
            fontSize: 16, fontWeight: 700, cursor: isValid ? 'pointer' : 'not-allowed',
            background: isValid
              ? `linear-gradient(135deg, ${FM_COLORS.primary}, ${FM_COLORS.secondary})`
              : '#d1d5db',
            color: '#fff',
            opacity: isValid ? 1 : 0.6,
          }}
        >
          生成风控方案 →
        </button>
      </div>
    </div>
  );
}

// ============================================================
// 表单子组件
// ============================================================

function FormSection({ title, sectionKey, expanded, onToggle, children }: {
  title: string; sectionKey: string; expanded: boolean;
  onToggle: (key: string) => void; children: React.ReactNode;
}) {
  return (
    <div style={{
      background: FM_COLORS.cardBg, borderRadius: 16,
      border: `1px solid ${FM_COLORS.border}`,
      marginBottom: 12, overflow: 'hidden',
    }}>
      <button
        className="clickable"
        onClick={() => onToggle(sectionKey)}
        style={{
          width: '100%', padding: '14px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'none', border: 'none', cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 700, color: FM_COLORS.textPrimary }}>
          {title}
        </span>
        {expanded
          ? <ChevronUp size={18} color={FM_COLORS.textSecondary} />
          : <ChevronDown size={18} color={FM_COLORS.textSecondary} />
        }
      </button>
      {expanded && (
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {children}
        </div>
      )}
    </div>
  );
}

function FormNumber({ label, value, placeholder, onChange, hint, required, max }: {
  label: string; value?: number; placeholder?: string;
  onChange: (v: number | undefined) => void;
  hint?: string; required?: boolean; max?: number;
}) {
  return (
    <div>
      <label style={{
        fontSize: 13, fontWeight: 600, color: FM_COLORS.textPrimary,
        display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6,
      }}>
        {label}
        {required && <span style={{ color: FM_COLORS.danger, fontSize: 12 }}>*</span>}
      </label>
      <input
        type="number"
        inputMode="decimal"
        value={value ?? ''}
        placeholder={placeholder}
        max={max}
        onChange={e => {
          const v = e.target.value;
          onChange(v === '' ? undefined : Number(v));
        }}
        style={{
          width: '100%', padding: '10px 14px',
          borderRadius: 12, border: `1px solid ${FM_COLORS.border}`,
          background: FM_COLORS.inputBg,
          fontSize: 15, color: FM_COLORS.textPrimary,
          outline: 'none', boxSizing: 'border-box',
        }}
      />
      {hint && (
        <p style={{
          fontSize: 11, color: FM_COLORS.textSecondary,
          margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <Info size={11} /> {hint}
        </p>
      )}
    </div>
  );
}

function FormSelect({ label, value, options, onChange }: {
  label: string; value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label style={{
        fontSize: 13, fontWeight: 600, color: FM_COLORS.textPrimary,
        display: 'block', marginBottom: 6,
      }}>
        {label}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', padding: '10px 14px',
          borderRadius: 12, border: `1px solid ${FM_COLORS.border}`,
          background: FM_COLORS.inputBg,
          fontSize: 15, color: FM_COLORS.textPrimary,
          outline: 'none', boxSizing: 'border-box',
          cursor: 'pointer',
        }}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

function FormToggle({ label, value, onChange, hint }: {
  label: string; value: boolean;
  onChange: (v: boolean) => void; hint?: string;
}) {
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: FM_COLORS.textPrimary }}>
          {label}
        </span>
        <button
          onClick={() => onChange(!value)}
          style={{
            width: 44, height: 24, borderRadius: 12,
            border: 'none', cursor: 'pointer',
            background: value ? FM_COLORS.primary : '#d1d5db',
            position: 'relative',
            transition: 'background 0.2s ease',
          }}
        >
          <div style={{
            width: 18, height: 18, borderRadius: 9,
            background: '#fff',
            position: 'absolute', top: 3,
            left: value ? 23 : 3,
            transition: 'left 0.2s ease',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }} />
        </button>
      </div>
      {hint && (
        <p style={{
          fontSize: 11, color: FM_COLORS.textSecondary,
          margin: '4px 0 0',
        }}>
          {hint}
        </p>
      )}
    </div>
  );
}

function RiskBadge({ level }: { level: string }) {
  const config: Record<string, { bg: string; color: string }> = {
    '保守': { bg: 'rgba(34,197,94,0.15)', color: '#22C55E' },
    '平衡': { bg: 'rgba(96,165,250,0.15)', color: '#60A5FA' },
    '偏激进': { bg: 'rgba(230,57,70,0.15)', color: '#E63946' },
  };
  const c = config[level] || config['平衡'];

  return (
    <span style={{
      fontSize: 11, fontWeight: 700,
      padding: '4px 10px', borderRadius: 10,
      backgroundColor: c.bg, color: c.color,
    }}>
      {level}
    </span>
  );
}
