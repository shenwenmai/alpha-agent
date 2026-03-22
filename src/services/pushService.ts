// ============================================================
// 推送通知服务 — Push Service
// 场中情绪预警：app 后台时通过 Web Push 发送通知
// ============================================================

import { getCurrentUserId } from './supabaseClient';
import { supabase } from './supabaseClient';

// 通知节流：同级别通知 5 分钟内不重复发送
const lastSentMap = new Map<string, number>();
const THROTTLE_MS = 5 * 60 * 1000;

interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  urgent?: boolean;
  data?: Record<string, string>;
}

const LEVEL_CONFIG: Record<string, { title: string; urgent: boolean }> = {
  calm: { title: '状态良好', urgent: false },
  mild: { title: '情绪波动提醒', urgent: false },
  moderate: { title: '情绪预警', urgent: true },
  severe: { title: '紧急提醒：建议离场', urgent: true },
};

/** 发送情绪预警推送（仅 app 后台时） */
export async function sendEmotionPush(
  level: string,
  message: string,
): Promise<void> {
  // 前台显示时不发推送（用 in-app 提醒代替）
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') return;

  // 仅 moderate/severe 发推送
  if (level !== 'moderate' && level !== 'severe') return;

  // 节流
  const tag = `emotion-${level}`;
  const lastSent = lastSentMap.get(tag) || 0;
  if (Date.now() - lastSent < THROTTLE_MS) return;

  const userId = getCurrentUserId();
  if (!userId) return;

  const config = LEVEL_CONFIG[level] || LEVEL_CONFIG.moderate;

  try {
    await triggerPush(userId, {
      title: config.title,
      body: message,
      tag,
      urgent: config.urgent,
      data: { url: '/', type: 'emotion_alert' },
    });
    lastSentMap.set(tag, Date.now());
  } catch (e) {
    console.error('[Push] 发送失败:', e);
  }
}

/** 发送关键时刻推送 */
export async function sendKeyMomentPush(message: string): Promise<void> {
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') return;

  const tag = 'key-moment';
  const lastSent = lastSentMap.get(tag) || 0;
  if (Date.now() - lastSent < THROTTLE_MS) return;

  const userId = getCurrentUserId();
  if (!userId) return;

  try {
    await triggerPush(userId, {
      title: '关键时刻',
      body: message,
      tag,
      urgent: true,
      data: { url: '/', type: 'key_moment' },
    });
    lastSentMap.set(tag, Date.now());
  } catch (e) {
    console.error('[Push] 关键时刻推送失败:', e);
  }
}

/** 调用服务端推送 API */
async function triggerPush(userId: string, payload: PushPayload): Promise<void> {
  // 获取用户 JWT token
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return;

  const res = await fetch('/api/push-send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ user_id: userId, ...payload }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`push-send ${res.status}: ${err}`);
  }
}
