import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, ChevronRight, Trash2, Lock, Play, Edit3,
} from 'lucide-react';
import {
  subscribeFM, getTemplates, deleteTemplate,
  incrementTemplateUseCount, getEndedSessions,
} from '../../services/fundManagerService';
import { FM_COLORS } from '../../theme';
import { GOLDEN_TEMPLATES, TEMPLATE_E_UNLOCK_SESSIONS } from '../../constants/goldenTemplates';
import type { FMTemplate, SessionPlan } from '../../types/fundManager';

interface FMTemplateViewProps {
  onBack: () => void;
  onApplyTemplate: (plan: Partial<SessionPlan>) => void;
  onCustomPlan?: () => void;  // D 自主设置 → 跳表单
}

const RISK_CONFIGS: Record<string, { bg: string; icon: string; goldenId?: 'A' | 'B' | 'C' }> = {
  '保守模式': { bg: 'rgba(34,197,94,0.15)', icon: '🛡️', goldenId: 'A' },
  '平衡模式': { bg: 'rgba(96,165,250,0.15)', icon: '⚖️', goldenId: 'B' },
  '激进模式': { bg: 'rgba(230,57,70,0.15)', icon: '🔥', goldenId: 'C' },
};

export default function FMTemplateView({ onBack, onApplyTemplate, onCustomPlan }: FMTemplateViewProps) {
  const [templates, setTemplates] = useState<FMTemplate[]>([]);
  const [, setTick] = useState(0);
  const [completedSessions, setCompletedSessions] = useState(0);
  // 战约操作 action sheet
  const [actionTpl, setActionTpl] = useState<FMTemplate | null>(null);

  useEffect(() => {
    const refresh = () => {
      setTemplates(getTemplates());
      setTick(t => t + 1);
    };
    refresh();
    setCompletedSessions(getEndedSessions().length);
    const unsub = subscribeFM(refresh);
    return unsub;
  }, []);

  const isEUnlocked = completedSessions >= TEMPLATE_E_UNLOCK_SESSIONS;

  const applyTemplate = (tpl: FMTemplate) => {
    incrementTemplateUseCount(tpl.id);
    const config = RISK_CONFIGS[tpl.name];
    if (config?.goldenId && tpl.is_builtin) {
      const golden = GOLDEN_TEMPLATES[config.goldenId];
      const entryBank = tpl.plan.session_budget || 5000;
      onApplyTemplate({
        ...golden.toPlanPartial(entryBank),
        input_method: 'template',
        template_id: config.goldenId,
      });
      return;
    }
    onApplyTemplate({ ...tpl.plan, input_method: 'template' });
  };

  const handleBuiltinApply = (tpl: FMTemplate) => applyTemplate(tpl);

  // 自定义战约点击 → 打开 action sheet
  const handleCustomTap = (tpl: FMTemplate) => setActionTpl(tpl);

  // Action sheet: 直接使用
  const handleActionUse = () => {
    if (!actionTpl) return;
    setActionTpl(null);
    applyTemplate(actionTpl);
  };

  // Action sheet: 只用一次（不保存到模板，复制参数）
  const handleActionOneTime = () => {
    if (!actionTpl) return;
    setActionTpl(null);
    // 直接应用参数但 input_method 标记为非模板，不增加使用计数
    onApplyTemplate({ ...actionTpl.plan, input_method: 'text', template_id: undefined });
  };

  // Action sheet: 删除
  const handleActionDelete = () => {
    if (!actionTpl) return;
    if (confirm(`确定删除「${actionTpl.name}」？`)) {
      deleteTemplate(actionTpl.id);
    }
    setActionTpl(null);
  };

  const builtins = templates.filter(t => t.is_builtin);
  // 我的战约：按最近使用时间倒序，未使用过的按创建时间
  const customs = templates
    .filter(t => !t.is_builtin)
    .sort((a, b) => {
      const aTime = a.last_used_at ?? a.created_at;
      const bTime = b.last_used_at ?? b.created_at;
      return bTime.localeCompare(aTime);
    });

  return (
    <div style={{ padding: '20px 16px 20px', maxWidth: 480, margin: '0 auto' }}>
      {/* 顶部 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24,
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
            方案模板
          </h2>
          <p style={{ fontSize: 12, color: FM_COLORS.textSecondary, margin: 0 }}>
            一键套用，快速开始
          </p>
        </div>
      </div>

      {/* ── 预设方案 A/B/C 横排滑动 ── */}
      {builtins.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: FM_COLORS.textSecondary, marginBottom: 10 }}>
            预设方案
          </div>
          <div style={{
            display: 'flex', gap: 10, overflowX: 'auto',
            paddingBottom: 4, margin: '0 -16px', padding: '0 16px 4px',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
          }}>
            {builtins.map(tpl => {
              const config = RISK_CONFIGS[tpl.name] || { bg: '#f3f4f6', icon: '📋' };
              const golden = config.goldenId ? GOLDEN_TEMPLATES[config.goldenId] : null;
              const p = golden?.params;
              return (
                <div
                  key={tpl.id}
                  className="clickable"
                  onClick={() => handleBuiltinApply(tpl)}
                  style={{
                    background: FM_COLORS.cardBg, borderRadius: 14,
                    border: `1px solid ${FM_COLORS.border}`,
                    padding: '14px 16px', cursor: 'pointer',
                    minWidth: 150, maxWidth: 170, flexShrink: 0,
                    display: 'flex', flexDirection: 'column', gap: 8,
                  }}
                >
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: config.bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, flexShrink: 0,
                    }}>
                      {config.icon}
                    </div>
                    <div style={{
                      fontSize: 14, fontWeight: 600, color: FM_COLORS.textPrimary,
                    }}>
                      {tpl.name}
                    </div>
                  </div>
                  <p style={{
                    fontSize: 11, color: FM_COLORS.textSecondary,
                    margin: 0, lineHeight: 1.4,
                    display: '-webkit-box', WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {tpl.description}
                  </p>
                  {p && (
                    <p style={{
                      fontSize: 11, color: FM_COLORS.accent,
                      margin: 0, fontWeight: 600,
                    }}>
                      {Math.round(p.baseUnitPct * 100)}% · {Math.round(p.stopLossPct * 100)}% · {p.maxTime}min
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── D: 自主设置 ── */}
      {onCustomPlan && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: FM_COLORS.textSecondary, marginBottom: 10 }}>
            个性化方案
          </div>
          <div
            className="clickable"
            onClick={onCustomPlan}
            style={{
              background: FM_COLORS.cardBg, borderRadius: 14,
              border: `1px solid ${FM_COLORS.border}`,
              padding: '14px 16px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 14,
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(168,85,247,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, flexShrink: 0,
            }}>
              ⚙️
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: FM_COLORS.textPrimary }}>
                自主设置
              </div>
              <p style={{ fontSize: 11, color: FM_COLORS.textSecondary, margin: '2px 0 0' }}>
                自定义所有参数，打造专属风控方案
              </p>
            </div>
            <ChevronRight size={16} color={FM_COLORS.textSecondary} />
          </div>
        </div>
      )}

      {/* ── E: AI 智能推荐 ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: FM_COLORS.textSecondary, marginBottom: 10 }}>
          智能推荐
        </div>
        <div
          className={isEUnlocked ? 'clickable' : ''}
          onClick={() => {
            if (!isEUnlocked) return;
            const golden = GOLDEN_TEMPLATES['E'];
            onApplyTemplate({
              ...golden.toPlanPartial(5000),
              input_method: 'template',
            });
          }}
          style={{
            background: FM_COLORS.cardBg, borderRadius: 14,
            border: `1px solid ${FM_COLORS.border}`,
            padding: '14px 16px', cursor: isEUnlocked ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', gap: 14,
            opacity: isEUnlocked ? 1 : 0.5,
          }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: isEUnlocked ? 'rgba(234,179,8,0.15)' : 'rgba(255,255,255,0.05)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, flexShrink: 0,
          }}>
            {isEUnlocked ? '✨' : '🔒'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: FM_COLORS.textPrimary }}>
              AI 智能推荐
            </div>
            <p style={{ fontSize: 11, color: FM_COLORS.textSecondary, margin: '2px 0 0' }}>
              {isEUnlocked
                ? '基于你的实战数据，为你生成最适合的风控方案'
                : `完成 ${TEMPLATE_E_UNLOCK_SESSIONS} 场实战后解锁（已完成 ${completedSessions} 场）`
              }
            </p>
          </div>
          {isEUnlocked && <ChevronRight size={16} color={FM_COLORS.textSecondary} />}
        </div>
      </div>

      {/* ── 我的战约（AI 问诊定策生成） ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 10,
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: FM_COLORS.textSecondary }}>
            🔖 我的战约
          </span>
          <span style={{ fontSize: 11, color: FM_COLORS.textSecondary }}>AI 问诊定策生成</span>
        </div>

        {customs.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '24px 20px',
            background: FM_COLORS.cardBg, borderRadius: 14,
            border: `1.5px dashed ${FM_COLORS.border}`,
            color: FM_COLORS.textSecondary, fontSize: 12, lineHeight: 1.8,
          }}>
            还没有专属战约<br />
            通过「AI 问诊定策」生成后会出现在这里
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {customs.map(tpl => {
              const lastUsed = tpl.last_used_at
                ? new Date(tpl.last_used_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
                : null;
              return (
                <div
                  key={tpl.id}
                  className="clickable"
                  onClick={() => handleCustomTap(tpl)}
                  style={{
                    background: FM_COLORS.cardBg, borderRadius: 14,
                    border: `1.5px solid ${FM_COLORS.primary}30`,
                    padding: '14px 16px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: `linear-gradient(135deg, ${FM_COLORS.primary}20, ${FM_COLORS.secondary}20)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18,
                  }}>
                    🔖
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: FM_COLORS.textPrimary }}>
                      {tpl.name}
                    </div>
                    <div style={{
                      fontSize: 11, color: FM_COLORS.textSecondary,
                      marginTop: 2, display: 'flex', gap: 6, alignItems: 'center',
                    }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {tpl.description}
                      </span>
                      {tpl.use_count > 0 && (
                        <span style={{
                          flexShrink: 0, fontSize: 10, padding: '1px 6px', borderRadius: 8,
                          background: `${FM_COLORS.primary}15`, color: FM_COLORS.primary,
                        }}>
                          用过 {tpl.use_count} 次
                        </span>
                      )}
                      {lastUsed && (
                        <span style={{ flexShrink: 0, fontSize: 10, color: FM_COLORS.textSecondary, opacity: 0.6 }}>
                          {lastUsed}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={16} color={FM_COLORS.textSecondary} style={{ flexShrink: 0 }} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 战约操作 Action Sheet ── */}
      {actionTpl && (
        <>
          {/* 遮罩 */}
          <div
            onClick={() => setActionTpl(null)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
              zIndex: 100,
            }}
          />
          {/* 底部弹出 */}
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            background: '#1a1a2e', borderRadius: '20px 20px 0 0',
            padding: '20px 16px calc(20px + env(safe-area-inset-bottom, 0px))',
            zIndex: 101,
          }}>
            {/* 战约名称 */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20,
              paddingBottom: 16, borderBottom: `1px solid ${FM_COLORS.border}`,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: `linear-gradient(135deg, ${FM_COLORS.primary}20, ${FM_COLORS.secondary}20)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18,
              }}>🔖</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: FM_COLORS.textPrimary }}>
                  {actionTpl.name}
                </div>
                <div style={{ fontSize: 11, color: FM_COLORS.textSecondary }}>
                  {actionTpl.description}
                  {actionTpl.use_count > 0 ? ` · 用过 ${actionTpl.use_count} 次` : ''}
                </div>
              </div>
            </div>

            {/* 三个选项 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* 直接使用 */}
              <button
                className="clickable"
                onClick={handleActionUse}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px', borderRadius: 14, cursor: 'pointer',
                  background: `linear-gradient(135deg, ${FM_COLORS.primary}18, ${FM_COLORS.secondary}18)`,
                  border: `1.5px solid ${FM_COLORS.primary}40`,
                  textAlign: 'left', width: '100%',
                }}
              >
                <Play size={18} color={FM_COLORS.primary} />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: FM_COLORS.textPrimary }}>
                    使用这份战约
                  </div>
                  <div style={{ fontSize: 11, color: FM_COLORS.textSecondary, marginTop: 2 }}>
                    直接套用，参数不变
                  </div>
                </div>
              </button>

              {/* 只用一次 */}
              <button
                className="clickable"
                onClick={handleActionOneTime}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px', borderRadius: 14, cursor: 'pointer',
                  background: FM_COLORS.cardBg,
                  border: `1px solid ${FM_COLORS.border}`,
                  textAlign: 'left', width: '100%',
                }}
              >
                <Edit3 size={18} color={FM_COLORS.textSecondary} />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: FM_COLORS.textPrimary }}>
                    只用一次
                  </div>
                  <div style={{ fontSize: 11, color: FM_COLORS.textSecondary, marginTop: 2 }}>
                    参数可临时调整，不保存到战约
                  </div>
                </div>
              </button>

              {/* 删除 */}
              <button
                className="clickable"
                onClick={handleActionDelete}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px', borderRadius: 14, cursor: 'pointer',
                  background: 'rgba(239,68,68,0.06)',
                  border: '1px solid rgba(239,68,68,0.20)',
                  textAlign: 'left', width: '100%',
                }}
              >
                <Trash2 size={18} color='#ef4444' />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#ef4444' }}>
                    删除这份战约
                  </div>
                </div>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
