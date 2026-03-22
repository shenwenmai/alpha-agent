import React, { useState, useCallback, lazy, Suspense } from 'react';
import FMHomeView from '../components/fundManager/FMHomeView';
const FMNewPlanView = lazy(() => import('../components/fundManager/FMNewPlanView'));
const FMPlanFormView = lazy(() => import('../components/fundManager/FMPlanFormView'));
const FMPlanTextView = lazy(() => import('../components/fundManager/FMPlanTextView'));
const FMPlanVoiceView = lazy(() => import('../components/fundManager/FMPlanVoiceView'));
const FMPlanQAView = lazy(() => import('../components/fundManager/FMPlanQAView'));
const FMPlanConfirmView = lazy(() => import('../components/fundManager/FMPlanConfirmView'));
const FMEscortView = lazy(() => import('../components/fundManager/FMEscortView'));
const FMRecordingView = lazy(() => import('../components/fundManager/FMRecordingView'));
const FMReviewView = lazy(() => import('../components/fundManager/FMReviewView'));
const FMHistoryView = lazy(() => import('../components/fundManager/FMHistoryView'));
const FMTemplateView = lazy(() => import('../components/fundManager/FMTemplateView'));
const FMPlanChatView = lazy(() => import('../components/fundManager/FMPlanChatView'));
const FMGlossaryView = lazy(() => import('../components/fundManager/FMGlossaryView'));
const FMDangerCheckView = lazy(() => import('../components/fundManager/FMDangerCheckView'));
const GrowthProfileScreen = lazy(() => import('./GrowthProfileScreen'));
const KeyMomentScreen = lazy(() => import('./KeyMomentScreen'));
import type { PlanInputMethod, SessionPlan, SelfCheckResult } from '../types/fundManager';
import { getActiveSession, addEvent } from '../services/fundManagerService';
import { computeRiskLevel as computeSelfCheckRiskLevel } from '../components/fundManager/FMDangerCheckView';
import { saveSelfCheckLog } from '../services/selfCheckService';
import { getCurrentUserId } from '../services/supabaseClient';

// ============================================================
// AI 资金管家 — 主屏幕路由
// 内部用 useState<FMView> 管理所有子视图
// ============================================================

export type FMView =
  | 'home'
  | 'plan_chat'
  | 'new_plan'
  | 'plan_form'
  | 'plan_text'
  | 'plan_voice'
  | 'plan_screen_voice'
  | 'plan_qa'
  | 'plan_confirm'
  | 'escort'
  | 'danger_check'
  | 'recording'
  | 'end_confirm'
  | 'review'
  | 'history'
  | 'history_detail'
  | 'templates'
  | 'glossary'
  | 'growth'
  | 'key_moment'
  | 'settings';

interface FMScreenProps {
  targetView?: FMView | null;
  targetReviewSessionId?: string | null;
  onTargetConsumed?: () => void;
}

export default function FundManagerScreen({
  targetView, targetReviewSessionId, onTargetConsumed,
}: FMScreenProps = {}) {
  const [view, setView] = useState<FMView>(targetView || 'home');
  const [pendingPlan, setPendingPlan] = useState<Partial<SessionPlan> | null>(null);
  const [reviewSessionId, setReviewSessionId] = useState<string | null>(
    targetReviewSessionId || null
  );
  const [detailSessionId, setDetailSessionId] = useState<string | null>(null);

  // 外部跳转：首页 → 管家子视图
  // 用 ref 记录上次处理过的 targetView，避免 consumed 后重复触发
  const lastConsumedRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (targetView && targetView !== lastConsumedRef.current) {
      lastConsumedRef.current = targetView;
      setView(targetView);
      if (targetReviewSessionId) setReviewSessionId(targetReviewSessionId);
      onTargetConsumed?.();
    }
  }, [targetView, targetReviewSessionId]);

  // 导航函数
  const navigate = useCallback((v: FMView) => setView(v), []);

  // 选择输入方式后跳转
  const handleInputMethodSelect = useCallback((method: PlanInputMethod) => {
    switch (method) {
      case 'form':
        navigate('plan_form');
        break;
      case 'text':
        navigate('plan_text');
        break;
      case 'voice':
        navigate('plan_voice');
        break;
      case 'screen_voice':
        // MVP 暂用语音输入代替
        navigate('plan_voice');
        break;
      case 'ai_qa':
        navigate('plan_qa');
        break;
      case 'template':
        navigate('templates');
        break;
    }
  }, [navigate]);

  // 从模板选择生成的 plan → 跳转确认
  const handleTemplateReady = useCallback((plan: Partial<SessionPlan>) => {
    setPendingPlan(plan);
    navigate('plan_confirm');
  }, [navigate]);

  // 方案就绪 → 确认
  const handlePlanReady = useCallback((plan: Partial<SessionPlan>) => {
    setPendingPlan(plan);
    navigate('plan_confirm');
  }, [navigate]);

  // 进入复盘
  const handleReview = useCallback((sessionId: string) => {
    setReviewSessionId(sessionId);
    navigate('review');
  }, [navigate]);

  // 进入详情
  const handleDetail = useCallback((sessionId: string) => {
    setDetailSessionId(sessionId);
    navigate('history_detail');
  }, [navigate]);

  const renderView = () => {
    switch (view) {
      case 'home':
        return (
          <FMHomeView
            onNewPlan={() => navigate('new_plan')}
            onResume={() => navigate('recording')}
            onHistory={() => navigate('history')}
            onTemplates={() => navigate('templates')}
            onGlossary={() => navigate('glossary')}
            onGrowth={() => navigate('growth')}
            onReview={handleReview}
            onQuickStart={handlePlanReady}
          />
        );

      case 'plan_chat':
        return (
          <FMPlanChatView
            onBack={() => navigate('home')}
            onPlanConfirmed={() => navigate('escort')}
            onGoTemplates={() => navigate('templates')}
          />
        );

      case 'new_plan':
        return (
          <FMNewPlanView
            onBack={() => navigate('home')}
            onSelectMethod={handleInputMethodSelect}
          />
        );

      case 'plan_form':
        return (
          <FMPlanFormView
            onBack={() => navigate('new_plan')}
            onSubmit={handlePlanReady}
          />
        );

      case 'plan_text':
        return (
          <FMPlanTextView
            onBack={() => navigate('new_plan')}
            onSubmit={handlePlanReady}
          />
        );

      case 'plan_voice':
      case 'plan_screen_voice':
        return (
          <FMPlanVoiceView
            onBack={() => navigate('new_plan')}
            onSubmit={handlePlanReady}
          />
        );

      case 'plan_qa':
        return (
          <FMPlanQAView
            onBack={() => navigate('new_plan')}
            onSubmit={handlePlanReady}
          />
        );

      case 'plan_confirm':
        return (
          <FMPlanConfirmView
            plan={pendingPlan}
            onBack={() => navigate('new_plan')}
            onConfirm={() => navigate('escort')}
          />
        );

      case 'escort':
        return (
          <FMEscortView
            onContinue={() => navigate('danger_check')}
            onSkip={() => navigate('danger_check')}
          />
        );

      case 'danger_check':
        return (
          <FMDangerCheckView
            mode="pre_entry"
            onBack={() => navigate('escort')}
            onConfirm={(checkedIds) => {
              // 记录自检结果到当前 session
              const session = getActiveSession();
              if (session) {
                const riskLvl = computeSelfCheckRiskLevel(checkedIds, 'pre_entry');
                const result: SelfCheckResult = {
                  mode: 'pre_entry',
                  trigger: 'manual',
                  checked_ids: checkedIds,
                  risk_level: riskLvl,
                  timestamp: new Date().toISOString(),
                };
                addEvent(session.id, {
                  event_type: 'self_check',
                  note: `进场前自检: ${checkedIds.length} 项 [${checkedIds.join(',')}]`,
                  self_check_result: result,
                  timestamp: new Date().toISOString(),
                });
                // 写入结构化自检日志
                saveSelfCheckLog({
                  user_id: getCurrentUserId() || 'local',
                  session_id: session.id,
                  mode: 'pre_entry',
                  trigger: 'manual',
                  checked_ids: checkedIds,
                  risk_level: riskLvl,
                  session_hand_count: 0,
                  session_pnl: 0,
                  session_elapsed_min: 0,
                  action_taken: 'continue',
                  created_at: new Date().toISOString(),
                });
              }
              navigate('recording');
            }}
          />
        );

      case 'recording':
        return (
          <FMRecordingView
            onBack={() => navigate('home')}
            onEnd={handleReview}
          />
        );

      case 'review':
        return (
          <FMReviewView
            sessionId={reviewSessionId}
            onBack={() => navigate('home')}
            onHome={() => navigate('home')}
          />
        );

      case 'history':
      case 'history_detail':
        return (
          <FMHistoryView
            detailSessionId={view === 'history_detail' ? detailSessionId : null}
            onBack={() => view === 'history_detail' ? navigate('history') : navigate('home')}
            onDetail={handleDetail}
            onReview={handleReview}
          />
        );

      case 'templates':
        return (
          <FMTemplateView
            onBack={() => navigate('home')}
            onApplyTemplate={(plan) => {
              setPendingPlan(plan);
              navigate('plan_confirm');
            }}
            onCustomPlan={() => navigate('plan_form')}
          />
        );

      case 'glossary':
        return (
          <FMGlossaryView
            onBack={() => navigate('home')}
          />
        );

      case 'growth':
        return (
          <GrowthProfileScreen
            onBack={() => navigate('home')}
          />
        );

      case 'key_moment':
        return (
          <KeyMomentScreen
            onBack={() => navigate('home')}
            onStartPlan={() => navigate('plan_chat')}
          />
        );

      default:
        return (
          <FMHomeView
            onNewPlan={() => navigate('new_plan')}
            onResume={() => navigate('recording')}
            onHistory={() => navigate('history')}
            onTemplates={() => navigate('templates')}
            onGlossary={() => navigate('glossary')}
            onGrowth={() => navigate('growth')}
            onReview={handleReview}
          />
        );
    }
  };

  return (
    <div className="page-enter" style={{ minHeight: '100%' }}>
      <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: '#AAAAAA' }}>加载中...</div>}>
        {renderView()}
      </Suspense>
    </div>
  );
}
