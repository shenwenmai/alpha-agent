import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Shield, CheckCircle, AlertTriangle,
  Clock, TrendingDown, TrendingUp, Lock, Zap,
} from 'lucide-react';
import {
  fillDefaults, getRiskLevel, validateParsedPlan,
} from '../../services/fundManagerEngine';
import { createSession, startSession } from '../../services/fundManagerService';
import { FM_COLORS } from '../../theme';
import type { SessionPlan } from '../../types/fundManager';

interface FMPlanConfirmViewProps {
  plan: Partial<SessionPlan> | null;
  onBack: () => void;
  onConfirm: () => void;
}

// CURRENCY_SYMBOLS removed — 不再显示货币符号

export default function FMPlanConfirmView({ plan, onBack, onConfirm }: FMPlanConfirmViewProps) {
  const [filledPlan, setFilledPlan] = useState<SessionPlan | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    if (!plan) return;
    const filled = fillDefaults(plan) as SessionPlan;
    setFilledPlan(filled);

    const validation = validateParsedPlan(filled);
    setWarnings(validation.errors);
  }, [plan]);

  if (!filledPlan) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: FM_COLORS.textSecondary }}>
        没有待确认的方案
      </div>
    );
  }

  const riskLevel = getRiskLevel(filledPlan);

  const handleConfirm = () => {
    const session = createSession(filledPlan);
    startSession(session.id);
    onConfirm();
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
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: FM_COLORS.textPrimary }}>
            确认风控方案
          </h2>
          <p style={{ fontSize: 12, color: FM_COLORS.textSecondary, margin: 0 }}>
            请仔细检查以下参数
          </p>
        </div>
      </div>

      {/* 风险等级卡 */}
      <div style={{
        background: `linear-gradient(135deg, ${FM_COLORS.primary}, ${FM_COLORS.secondary})`,
        borderRadius: 18, padding: '18px 20px', marginBottom: 16, color: '#fff',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={18} />
            <span style={{ fontSize: 14, fontWeight: 700 }}>风险评级</span>
          </div>
          <span style={{
            fontSize: 13, fontWeight: 700, padding: '4px 12px', borderRadius: 10,
            backgroundColor: riskLevel === '保守' ? 'rgba(74,222,128,0.3)'
              : riskLevel === '平衡' ? 'rgba(96,165,250,0.3)' : 'rgba(248,113,113,0.3)',
          }}>
            {riskLevel}
          </span>
        </div>
        <p style={{ fontSize: 13, opacity: 0.85, margin: 0, lineHeight: 1.5 }}>
          {riskLevel === '保守' && '低风险方案：严格的止损控制，适合谨慎操作'}
          {riskLevel === '平衡' && '适中风险方案：攻守兼备，适合大多数情况'}
          {riskLevel === '偏激进' && '⚠️ 高风险方案：止损线较宽，请格外注意纪律'}
        </p>
      </div>

      {/* 警告 */}
      {warnings.length > 0 && (
        <div style={{
          background: 'rgba(217,119,6,0.10)', borderRadius: 14, padding: '12px 14px',
          marginBottom: 16, border: '1px solid rgba(217,119,6,0.2)',
        }}>
          {warnings.map((w, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              marginBottom: i < warnings.length - 1 ? 6 : 0,
            }}>
              <AlertTriangle size={14} color="#D97706" style={{ marginTop: 2, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#D97706', lineHeight: 1.4 }}>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* 方案详情 */}
      <div style={{
        background: FM_COLORS.cardBg, borderRadius: 16,
        border: `1px solid ${FM_COLORS.border}`, overflow: 'hidden',
      }}>
        <ConfirmSection
          icon={<Zap size={16} color={FM_COLORS.primary} />}
          title="资金"
          items={[
            { label: '操盘资金', value: `${filledPlan.session_budget.toLocaleString()}` },
            { label: '基码', value: `${filledPlan.base_unit.toLocaleString()}` },
            ...(filledPlan.total_bankroll ? [{ label: '总资金', value: `${filledPlan.total_bankroll.toLocaleString()}` }] : []),
          ]}
        />

        <ConfirmSection
          icon={<TrendingDown size={16} color={FM_COLORS.danger} />}
          title="止损"
          items={[
            { label: '最大亏损', value: `${filledPlan.stop_loss_amount.toLocaleString()}`, highlight: 'danger' },
            { label: '连输手数止损', value: `${filledPlan.stop_loss_streak} 手` },
            { label: '净输手数止损', value: filledPlan.stop_loss_net_hands > 0 ? `${filledPlan.stop_loss_net_hands} 手` : '未设置' },
          ]}
        />

        <ConfirmSection
          icon={<TrendingUp size={16} color={FM_COLORS.profit} />}
          title="盈利目标"
          hint="达到后系统建议离场，你可以自主决定是否继续"
          items={[
            { label: '目标金额', value: `${filledPlan.take_profit_amount.toLocaleString()}`, highlight: 'profit' },
          ]}
        />

        <ConfirmSection
          icon={<Lock size={16} color={FM_COLORS.profit} />}
          title="止盈保护"
          hint={`赢到 ${filledPlan.lock_profit_trigger.toLocaleString()} 后保护启动，盈利回落至 ${filledPlan.lock_profit_floor.toLocaleString()} 强制提醒离场`}
          items={[
            { label: '锁盈触发', value: `${filledPlan.lock_profit_trigger.toLocaleString()}` },
            { label: '保底盈利', value: `${filledPlan.lock_profit_floor.toLocaleString()}`, highlight: 'profit' },
          ]}
        />

        <ConfirmSection
          icon={<Clock size={16} color={FM_COLORS.warning} />}
          title="时间 & 纪律"
          items={[
            { label: '最长时间', value: `${filledPlan.max_duration_minutes} 分钟` },
            { label: '允许加码', value: filledPlan.allow_raise_bet ? '是' : '否' },
            { label: '亏损禁加', value: filledPlan.forbid_raise_in_loss ? '是' : '否' },
          ]}
          isLast={!(filledPlan.custom_rules && filledPlan.custom_rules.length > 0)}
        />

        {filledPlan.custom_rules && filledPlan.custom_rules.length > 0 && (
          <ConfirmSection
            icon={<AlertTriangle size={16} color="#D97706" />}
            title="自定义规则"
            items={filledPlan.custom_rules.map(cr => ({
              label: cr.label,
              value: cr.level === 'strong_alert' ? '强提醒'
                : cr.level === 'formal_alert' ? '正式提醒' : '预警',
            }))}
            isLast
          />
        )}
      </div>

      {/* 确认按钮 */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))',
        background: `linear-gradient(transparent, ${FM_COLORS.bg} 20%)`,
      }}>
        <button
          className="clickable"
          onClick={handleConfirm}
          style={{
            width: '100%', maxWidth: 448, margin: '0 auto', display: 'flex',
            alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '14px', borderRadius: 30, border: 'none',
            fontSize: 16, fontWeight: 700, cursor: 'pointer',
            background: `linear-gradient(135deg, ${FM_COLORS.primary}, ${FM_COLORS.secondary})`,
            color: '#fff',
          }}
        >
          <CheckCircle size={18} />
          确认方案，开始陪护
        </button>
      </div>
    </div>
  );
}

// ── 确认段落 ──

function ConfirmSection({ icon, title, hint, items, isLast }: {
  icon: React.ReactNode; title: string; hint?: string;
  items: { label: string; value: string; highlight?: 'danger' | 'profit' }[];
  isLast?: boolean;
}) {
  const highlightColors: Record<string, string> = {
    danger: FM_COLORS.danger,
    profit: FM_COLORS.profit,
  };

  return (
    <div style={{
      padding: '14px 16px',
      borderBottom: isLast ? 'none' : `1px solid ${FM_COLORS.border}`,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: hint ? 4 : 10,
      }}>
        {icon}
        <span style={{ fontSize: 13, fontWeight: 700, color: FM_COLORS.textPrimary }}>{title}</span>
      </div>
      {hint && (
        <p style={{
          fontSize: 11, color: FM_COLORS.textSecondary,
          margin: '0 0 8px', lineHeight: 1.5, opacity: 0.8,
        }}>
          ℹ️ {hint}
        </p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((item, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 13, color: FM_COLORS.textSecondary }}>{item.label}</span>
            <span style={{
              fontSize: 14, fontWeight: 600,
              color: item.highlight ? highlightColors[item.highlight] : FM_COLORS.textPrimary,
            }}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
