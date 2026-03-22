import { createClient } from '@supabase/supabase-js';
import type { AgentAnalysis, AgentPanelRequest } from './types';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

/** 保存每手牌的三Agent分析结果 */
export async function saveHandAnalysis(
  input: AgentPanelRequest,
  analysis: AgentAnalysis,
  userId: string,
  sessionId: string | null,
) {
  const { conservative, balanced, aggressive, consensus } = analysis;

  const { data, error } = await supabase
    .from('hand_analyses')
    .insert({
      session_id: sessionId,
      user_id: userId,
      hand_number: input.hand_number,
      scene_level: input.scene_level,
      active_scene: input.active_scene,
      net_pnl_at_time: input.metrics.net_pnl,
      bet_amount: input.behavior.this_hand_bet,
      // 保守派
      conservative_survival_prob: conservative.survival_prob,
      conservative_safety_status: conservative.safety_status,
      conservative_veto: conservative.veto,
      // 平衡派
      balanced_deviation_index: balanced.deviation_index,
      balanced_behavior_status: balanced.behavior_status,
      balanced_veto: balanced.veto,
      // 激进派
      aggressive_collapse_prob: aggressive.collapse_prob_10h,
      aggressive_exit_window: aggressive.exit_window,
      aggressive_veto: aggressive.veto,
      // 共识
      consensus_directive: consensus.directive_key,
      consensus_lead_agent: consensus.lead_agent,
      consensus_has_dissent: !!consensus.dissent,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[db] saveHandAnalysis error:', error.message);
    return null;
  }
  return data?.id as string;
}

/** 保存用户行为结果（下一手结果揭晓后调用） */
export async function saveUserOutcome(
  handAnalysisId: string,
  userId: string,
  followedAdvice: boolean | null,
  nextHandResult: 'win' | 'loss' | 'no_bet',
  nextHandPnl: number,
  consecutiveIgnored: number,
) {
  const { error } = await supabase.from('user_outcomes').insert({
    hand_analysis_id: handAnalysisId,
    user_id: userId,
    followed_advice: followedAdvice,
    next_hand_result: nextHandResult,
    next_hand_pnl: nextHandPnl,
    consecutive_ignored: consecutiveIgnored,
  });

  if (error) console.error('[db] saveUserOutcome error:', error.message);
}

/** 获取用户历史分析（用于个性化建议） */
export async function getUserHistory(userId: string, limit = 50) {
  const { data, error } = await supabase
    .from('hand_analyses')
    .select(`
      consensus_directive,
      conservative_survival_prob,
      balanced_deviation_index,
      scene_level,
      net_pnl_at_time,
      user_outcomes(followed_advice, next_hand_result, next_hand_pnl)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[db] getUserHistory error:', error.message);
    return [];
  }
  return data ?? [];
}

/** 计算用户遵从率和胜率（给三Agent做个性化参考） */
export async function getUserStats(userId: string) {
  const history = await getUserHistory(userId, 200);
  if (!history.length) return null;

  const withOutcome = history.filter((h: any) => h.user_outcomes?.length > 0);
  const followed = withOutcome.filter((h: any) => h.user_outcomes[0]?.followed_advice === true);
  const ignored = withOutcome.filter((h: any) => h.user_outcomes[0]?.followed_advice === false);

  const winRate = (arr: any[]) => {
    const wins = arr.filter(h => h.user_outcomes[0]?.next_hand_result === 'win').length;
    return arr.length ? Math.round(wins / arr.length * 100) : null;
  };

  return {
    total_analyses: history.length,
    follow_rate: withOutcome.length ? Math.round(followed.length / withOutcome.length * 100) : null,
    followed_win_rate: winRate(followed),
    ignored_win_rate: winRate(ignored),
  };
}
