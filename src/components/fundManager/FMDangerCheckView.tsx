import React, { useState } from 'react';
import { ArrowLeft, AlertTriangle, ShieldCheck, XOctagon } from 'lucide-react';
import { theme } from '../../theme';
import type { DangerSignal, SelfCheckMode } from '../../types/fundManager';

// ============================================================
// 自检双表 — 进场前 + 即时自检
// 进场前：5 维度（身体/环境/赌场/精神/时间与状态）
// 即时：4 维度（身体/环境/精神/时间与状态，无赌场）
// ============================================================

// ── 信号权重表（1-5级，影响风险评分） ──
// 5=致命（直接影响决策质量）  4=高危  3=中度  2=轻度  1=微弱
const SIGNAL_WEIGHTS: Record<string, number> = {
  // 身体 — 生理限制直接削弱判断力
  body_1: 3,  // 睡眠不足、肚饿 — 中度：持续消耗注意力
  body_2: 4,  // 头疼、头晕 — 高危：疼痛直接干扰思维
  body_3: 5,  // 思想无法集中 — 致命：决策的前提条件丧失
  body_4: 2,  // 口舌、四肢不适 — 轻度：不适但不直接影响判断
  body_5: 5,  // 突闪头晕目眩 — 致命：可能是健康警报
  body_6: 4,  // 过度紧张 — 高危：紧张导致保守或冲动两极
  // 环境 — 外部干扰影响情绪稳定
  env_1: 2,   // 赌场香水味特重 — 轻度：感官干扰（个体差异大）
  env_2: 3,   // 出现特讨厌的人物 — 中度：情绪波动源
  env_3: 1,   // 出现不吉祥之人 — 微弱：心理暗示
  env_4: 3,   // 赌场氛围压抑 — 中度：环境压力持续影响
  env_5: 1,   // 同桌无谓闲聊 — 微弱：可忽略的干扰
  env_6: 2,   // 旁边有令人不适的人 — 轻度：持续不适感
  env_7: 4,   // 很蹊跷的输牌 — 高危：暗示已上头或桌况异常
  // 赌场 — 历史记录影响心理预期
  casino_1: 3, // 从未赢过的赌场 — 中度：负面心理锚定
  casino_2: 2, // 特别小心的赌场 — 轻度：已有防备意识
  // 精神 — 心态直接决定行为模式
  mental_1: 5, // 急躁易怒 — 致命：冲动下注的直接驱动力
  mental_2: 3, // 患得患失 — 中度：犹豫影响执行
  mental_3: 5, // 没有节制 — 致命：失去自控 = 等于没有计划
  mental_4: 3, // 意志不坚 — 中度：容易被连输动摇
  mental_5: 4, // 拼命三郎心态 — 高危：追损心态的前兆
  mental_6: 4, // 不听劝告 — 高危：系统提醒将失效
  mental_7: 3, // 得意忘形 — 中度：赢钱后放松警惕
  // 时间与状态 — 行为模式直接体现纪律
  state_1: 3,  // 一进去就下注 — 中度：缺乏观察期
  state_2: 2,  // 模棱两可下注 — 轻度：信心不足但可调整
  state_3: 4,  // 注码和次数没有限定 — 高危：无计划=无纪律
  state_4: 5,  // 总想以小博大、连续大注 — 致命：赌徒谬误
  state_5: 3,  // 起念速战速决 — 中度：急躁心态信号
  state_6: 4,  // 赢时小注输时大注 — 高危：经典追损模式
};

// ── 完整 28 项（向后兼容） ──

const DANGER_SIGNALS: DangerSignal[] = [
  // 身体
  { id: 'body_1', category: '身体', text: '睡眠不足、肚饿' },
  { id: 'body_2', category: '身体', text: '头疼、头晕' },
  { id: 'body_3', category: '身体', text: '思想无法集中' },
  { id: 'body_4', category: '身体', text: '口舌、四肢不适' },
  { id: 'body_5', category: '身体', text: '突闪头晕目眩' },
  { id: 'body_6', category: '身体', text: '过度紧张' },
  // 环境
  { id: 'env_1', category: '环境', text: '赌场香水味特重' },
  { id: 'env_2', category: '环境', text: '出现特讨厌的人物' },
  { id: 'env_3', category: '环境', text: '出现不吉祥之人' },
  { id: 'env_4', category: '环境', text: '赌场氛围压抑' },
  { id: 'env_5', category: '环境', text: '同桌无谓闲聊' },
  { id: 'env_6', category: '环境', text: '旁边有令人不适的人' },
  { id: 'env_7', category: '环境', text: '很蹊跷的输牌' },
  // 赌场
  { id: 'casino_1', category: '赌场', text: '从未赢过的赌场' },
  { id: 'casino_2', category: '赌场', text: '特别小心的赌场' },
  // 精神
  { id: 'mental_1', category: '精神', text: '急躁易怒' },
  { id: 'mental_2', category: '精神', text: '患得患失' },
  { id: 'mental_3', category: '精神', text: '没有节制' },
  { id: 'mental_4', category: '精神', text: '意志不坚' },
  { id: 'mental_5', category: '精神', text: '拼命三郎心态' },
  { id: 'mental_6', category: '精神', text: '不听劝告' },
  { id: 'mental_7', category: '精神', text: '得意忘形' },
  // 时间与状态
  { id: 'state_1', category: '时间与状态', text: '一进去就下注' },
  { id: 'state_2', category: '时间与状态', text: '模棱两可下注' },
  { id: 'state_3', category: '时间与状态', text: '注码和次数没有限定' },
  { id: 'state_4', category: '时间与状态', text: '总想以小博大、连续大注' },
  { id: 'state_5', category: '时间与状态', text: '起念速战速决' },
  { id: 'state_6', category: '时间与状态', text: '赢时小注输时大注' },
];

// ── 进场前自检项（约15项） ──

const PRE_ENTRY_IDS = new Set([
  'body_1', 'body_2', 'body_3', 'body_4', 'body_6',
  'env_1', 'env_2', 'env_3', 'env_4',
  'casino_1', 'casino_2',
  'mental_1', 'mental_2', 'mental_5',
  'state_3', 'state_5',
]);

const PRE_ENTRY_SIGNALS: DangerSignal[] = DANGER_SIGNALS.filter(s => PRE_ENTRY_IDS.has(s.id));

// ── 即时自检项（约22项） ──

const LIVE_CHECK_IDS = new Set([
  'body_2', 'body_3', 'body_5', 'body_6',
  'env_1', 'env_2', 'env_4', 'env_5', 'env_6', 'env_7',
  'mental_1', 'mental_2', 'mental_3', 'mental_4', 'mental_5', 'mental_6', 'mental_7',
  'state_1', 'state_2', 'state_4', 'state_5', 'state_6',
]);

const LIVE_CHECK_SIGNALS: DangerSignal[] = DANGER_SIGNALS.filter(s => LIVE_CHECK_IDS.has(s.id));

// ── 维度分类 ──

const PRE_ENTRY_CATEGORIES = ['身体', '环境', '赌场', '精神', '时间与状态'];
const LIVE_CHECK_CATEGORIES = ['身体', '环境', '精神', '时间与状态']; // 无赌场

const CATEGORY_ICONS: Record<string, string> = {
  '身体': '🧍',
  '环境': '🌿',
  '赌场': '🏛️',
  '精神': '🧠',
  '时间与状态': '⏰',
};

// ── 加权评分计算 ──

/** 计算勾选信号的加权总分 */
function computeWeightedScore(checkedIds: Set<string> | string[]): number {
  const ids = checkedIds instanceof Set ? checkedIds : new Set(checkedIds);
  let score = 0;
  for (const id of ids) {
    score += SIGNAL_WEIGHTS[id] ?? 1;
  }
  return score;
}

/** 检查是否勾选了任何致命信号（权重5） */
function hasLethalSignal(checkedIds: Set<string> | string[]): boolean {
  const ids = checkedIds instanceof Set ? checkedIds : new Set(checkedIds);
  for (const id of ids) {
    if ((SIGNAL_WEIGHTS[id] ?? 1) >= 5) return true;
  }
  return false;
}

// ── 风险等级计算（加权版） ──
// 进场前：满分约50（15项），即时：满分约72（22项）
// 阈值基于加权分设计，致命信号单项可直接拉高等级

function computeRiskLevel(checkedIds: Set<string> | string[], mode: SelfCheckMode): 'safe' | 'caution' | 'warning' | 'danger' {
  const score = computeWeightedScore(checkedIds);
  const lethal = hasLethalSignal(checkedIds);
  const count = checkedIds instanceof Set ? checkedIds.size : checkedIds.length;

  if (count === 0) return 'safe';

  if (mode === 'live') {
    // 即时模式更敏感：有致命信号且≥2项直接warning
    if (score >= 16 || (lethal && score >= 10)) return 'danger';
    if (score >= 10 || (lethal && count >= 2)) return 'warning';
    if (score >= 5) return 'caution';
    return 'safe';
  }
  // 进场前模式
  if (score >= 18 || (lethal && score >= 12)) return 'danger';
  if (score >= 12 || (lethal && count >= 2)) return 'warning';
  if (score >= 5) return 'caution';
  return 'safe';
}

// ── 组件 ──

interface FMDangerCheckViewProps {
  onConfirm: (checkedIds: string[]) => void;
  onBack: () => void;
  mode?: SelfCheckMode;
  onEndSession?: (checkedIds: string[]) => void;
}

export default function FMDangerCheckView({
  onConfirm, onBack, mode = 'pre_entry', onEndSession,
}: FMDangerCheckViewProps) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const isLive = mode === 'live';
  const signals = isLive ? LIVE_CHECK_SIGNALS : PRE_ENTRY_SIGNALS;
  const categories = isLive ? LIVE_CHECK_CATEGORIES : PRE_ENTRY_CATEGORIES;

  const toggle = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const count = checked.size;
  const weightedScore = computeWeightedScore(checked);
  const riskLevel = computeRiskLevel(checked, mode);

  // 进场前模式的风险配置
  const preEntryRiskConfig = {
    safe: {
      color: theme.colors.success,
      icon: <ShieldCheck size={20} color={theme.colors.success} />,
      title: '状态良好',
      desc: '没有检测到危险信号，可以进场',
      btnText: '开始实战',
      btnColor: theme.colors.success,
    },
    caution: {
      color: theme.colors.warning,
      icon: <AlertTriangle size={20} color={theme.colors.warning} />,
      title: '轻微注意',
      desc: '有少量信号，进场后请保持警觉',
      btnText: '我已知晓，开始实战',
      btnColor: theme.colors.warning,
    },
    warning: {
      color: '#FF8C00',
      icon: <AlertTriangle size={20} color="#FF8C00" />,
      title: '强烈警告',
      desc: '多项危险信号亮起，建议推迟进场或缩减预算',
      btnText: '我坚持进场',
      btnColor: '#FF8C00',
    },
    danger: {
      color: theme.colors.danger,
      icon: <XOctagon size={20} color={theme.colors.danger} />,
      title: '建议放弃本场',
      desc: '大量危险信号，今天不适合上桌。忍、等、稳——改天再来。',
      btnText: '我仍然要进场',
      btnColor: theme.colors.danger,
    },
  };

  // 即时自检模式的风险配置
  const liveRiskConfig = {
    safe: {
      color: theme.colors.success,
      icon: <ShieldCheck size={20} color={theme.colors.success} />,
      title: '状态良好',
      desc: '状态良好，继续',
      btnText: '继续操盘',
      btnColor: theme.colors.success,
    },
    caution: {
      color: theme.colors.warning,
      icon: <AlertTriangle size={20} color={theme.colors.warning} />,
      title: '轻微注意',
      desc: '注意了，建议缩小注码或观望几手',
      btnText: '我已知晓，继续',
      btnColor: theme.colors.warning,
    },
    warning: {
      color: '#FF8C00',
      icon: <AlertTriangle size={20} color="#FF8C00" />,
      title: '强烈警告',
      desc: '强烈建议休息10分钟再回来',
      btnText: '我坚持继续',
      btnColor: '#FF8C00',
    },
    danger: {
      color: theme.colors.danger,
      icon: <XOctagon size={20} color={theme.colors.danger} />,
      title: '建议结束本场',
      desc: '多项信号亮起，今天到此为止',
      btnText: '我要继续',
      btnColor: theme.colors.danger,
    },
  };

  const riskConfig = isLive ? liveRiskConfig : preEntryRiskConfig;
  const risk = riskConfig[riskLevel];

  return (
    <div style={{
      backgroundColor: theme.colors.bg,
      color: theme.colors.white,
      paddingBottom: riskLevel === 'danger' ? 280 : 160,
    }}>
      {/* 顶栏 */}
      <div style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 14px)',
        paddingLeft: 16, paddingRight: 16, paddingBottom: 14,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button
          className="clickable"
          onClick={onBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
        >
          <ArrowLeft size={20} color={theme.colors.white} />
        </button>
        <div>
          <h2 style={{
            fontSize: theme.fontSize.title, fontWeight: 700,
            margin: 0, color: theme.colors.white,
          }}>
            {isLive ? '即时自检' : '进场前自检'}
          </h2>
          <p style={{
            fontSize: theme.fontSize.caption, color: theme.colors.gray,
            margin: 0,
          }}>
            {isLive ? '暂停一下，检查当前状态' : '忍、等、稳、狠、滚 — 危险信号检查'}
          </p>
        </div>
      </div>

      {/* 信号列表 */}
      <div style={{ padding: '0 16px' }}>
        {categories.map(cat => {
          const catSignals = signals.filter(s => s.category === cat);
          if (catSignals.length === 0) return null;
          return (
            <div key={cat} style={{ marginBottom: 20 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                marginBottom: 10,
                fontSize: theme.fontSize.small, fontWeight: 600,
                color: theme.colors.gold,
              }}>
                <span>{CATEGORY_ICONS[cat]}</span>
                <span>{cat}</span>
                <span style={{
                  fontSize: theme.fontSize.caption, color: theme.colors.gray, fontWeight: 400,
                }}>
                  ({catSignals.filter(s => checked.has(s.id)).length}/{catSignals.length})
                </span>
              </div>
              <div style={{
                background: theme.colors.card,
                borderRadius: theme.radius.md,
                overflow: 'hidden',
              }}>
                {catSignals.map((sig, idx) => {
                  const isChecked = checked.has(sig.id);
                  const weight = SIGNAL_WEIGHTS[sig.id] ?? 1;
                  const isHighRisk = weight >= 4;
                  return (
                    <button
                      key={sig.id}
                      onClick={() => toggle(sig.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        width: '100%',
                        padding: '14px 16px',
                        background: isChecked ? 'rgba(255,68,68,0.08)' : 'transparent',
                        border: 'none',
                        borderBottom: idx < catSignals.length - 1 ? `1px solid ${theme.colors.border}` : 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      {/* 复选框 */}
                      <div style={{
                        width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                        border: isChecked ? 'none' : `2px solid ${theme.colors.border}`,
                        background: isChecked ? theme.colors.danger : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s',
                      }}>
                        {isChecked && (
                          <span style={{ color: '#fff', fontSize: 14, fontWeight: 700, lineHeight: 1 }}>✓</span>
                        )}
                      </div>
                      <span style={{
                        fontSize: theme.fontSize.small,
                        color: isChecked ? theme.colors.danger : theme.colors.white,
                        fontWeight: isChecked ? 600 : 400,
                        transition: 'all 0.15s',
                        flex: 1,
                      }}>
                        {sig.text}
                      </span>
                      {/* 高权重标记 */}
                      {isHighRisk && (
                        <span style={{
                          fontSize: 10, fontWeight: 600,
                          color: weight >= 5 ? theme.colors.danger : '#FF8C00',
                          background: weight >= 5 ? 'rgba(255,68,68,0.12)' : 'rgba(255,140,0,0.12)',
                          padding: '2px 6px', borderRadius: 4,
                          flexShrink: 0,
                        }}>
                          {weight >= 5 ? '高危' : '注意'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* 底部状态 + 按钮 */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'linear-gradient(transparent, #0A0A0A 20%)',
        padding: '40px 16px calc(env(safe-area-inset-bottom, 0px) + 16px)',
      }}>
        {/* 风险状态卡 */}
        <div style={{
          background: theme.colors.card,
          borderRadius: theme.radius.md,
          padding: '14px 16px',
          marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: 12,
          border: `1px solid ${risk.color}33`,
        }}>
          {risk.icon}
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: theme.fontSize.small, fontWeight: 700,
              color: risk.color, marginBottom: 2,
            }}>
              {risk.title}{count > 0 ? ` (${count}项 · 风险${weightedScore}分)` : ''}
            </div>
            <div style={{
              fontSize: theme.fontSize.caption, color: theme.colors.gray,
              lineHeight: 1.4,
            }}>
              {risk.desc}
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div style={{ display: 'flex', gap: 12 }}>
          {riskLevel === 'danger' && (
            <button
              onClick={isLive && onEndSession ? () => onEndSession(Array.from(checked)) : onBack}
              style={{
                flex: 1, padding: '14px 0',
                background: theme.colors.success,
                color: '#fff', fontWeight: 700,
                fontSize: theme.fontSize.body,
                border: 'none', borderRadius: theme.radius.sm,
                cursor: 'pointer',
              }}
            >
              {isLive ? '结束本场' : '今天不打了'}
            </button>
          )}
          <button
            onClick={() => onConfirm(Array.from(checked))}
            style={{
              flex: 1, padding: '14px 0',
              background: riskLevel === 'danger' ? 'transparent' : risk.btnColor,
              color: riskLevel === 'danger' ? theme.colors.gray : '#fff',
              fontWeight: 700,
              fontSize: theme.fontSize.body,
              border: riskLevel === 'danger' ? `1px solid ${theme.colors.border}` : 'none',
              borderRadius: theme.radius.sm,
              cursor: 'pointer',
            }}
          >
            {risk.btnText}
          </button>
        </div>
      </div>
    </div>
  );
}

export { DANGER_SIGNALS, PRE_ENTRY_SIGNALS, LIVE_CHECK_SIGNALS, SIGNAL_WEIGHTS, computeRiskLevel, computeWeightedScore, hasLethalSignal };
