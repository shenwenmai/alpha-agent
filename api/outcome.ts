import type { VercelRequest, VercelResponse } from '@vercel/node';
import { saveUserOutcome } from '../src/db';

// ============================================================
// /api/outcome — 记录用户是否遵从建议 + 下一手实际结果
//
// POST body:
//   hand_analysis_id: string   — 上一手分析的 ID
//   user_id: string
//   followed_advice: boolean | null
//   next_hand_result: 'win' | 'loss' | 'no_bet'
//   next_hand_pnl: number
//   consecutive_ignored: number
// ============================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    hand_analysis_id,
    user_id,
    followed_advice,
    next_hand_result,
    next_hand_pnl,
    consecutive_ignored,
  } = req.body ?? {};

  if (!hand_analysis_id) {
    return res.status(400).json({ error: 'Missing hand_analysis_id' });
  }

  if (!['win', 'loss', 'no_bet'].includes(next_hand_result)) {
    return res.status(400).json({ error: 'Invalid next_hand_result' });
  }

  try {
    await saveUserOutcome(
      hand_analysis_id,
      user_id || 'anonymous',
      followed_advice ?? null,
      next_hand_result,
      next_hand_pnl ?? 0,
      consecutive_ignored ?? 0,
    );
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('[api/outcome] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
