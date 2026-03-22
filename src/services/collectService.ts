// ============================================================
// collectService — 将对话 + 提取事件上报到服务器 (Supabase)
// 用于 RAG 语料持续增长
// 非阻塞: 上报失败不影响用户体验
// ============================================================

const SESSION_KEY = 'realcost_session_id';

function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

async function post(payload: Record<string, any>) {
  // 本地开发时跳过（Vercel Serverless 端点在本地不存在）
  if (import.meta.env.DEV) return;
  try {
    await fetch('/api/collect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, sessionId: getSessionId() }),
    });
  } catch (e) {
    // 非阻塞：上报失败不影响用户体验
  }
}

/** 上报一轮对话 */
export function collectChatTurn(userMessage: string, aiResponse: string, mode: 'b' | 's') {
  post({
    type: 'chat_turn',
    data: { userMessage, aiResponse, mode },
  });
}

/** 上报提取事件 */
export function collectExtraction(
  event_type: string,
  event_data: Record<string, any>,
  confidence: number,
  status: string,
  sourceMessageId: string
) {
  post({
    type: 'extraction',
    data: { event_type, event_data, confidence, status, sourceMessageId },
  });
}

/** 上报用户画像快照 */
export function collectProfileSnapshot(profile: Record<string, any>) {
  post({
    type: 'profile_snapshot',
    data: { profile },
  });
}

/** 上报用户反馈 (👍/👎) */
export function collectFeedback(messageId: string, rating: 1 | -1, mode: 'b' | 's', aiResponsePreview: string) {
  post({
    type: 'feedback',
    data: { messageId, rating, mode, aiResponsePreview },
  });
}

/** 上报用户访问事件（每次打开 app） */
export function collectVisit() {
  post({
    type: 'visit',
    data: { screenWidth: window.innerWidth, screenHeight: window.innerHeight },
  });
}

/** 上报 RAG 检索日志 */
export function collectRAGLog(queryPreview: string, mode: 'b' | 's', chunks: Array<{ id: string; similarity: number; tag: string }>) {
  post({
    type: 'rag_log',
    data: {
      queryPreview,
      mode,
      chunksReturned: chunks,
      chunkCount: chunks.length,
      avgSimilarity: chunks.length > 0 ? +(chunks.reduce((s, c) => s + c.similarity, 0) / chunks.length).toFixed(4) : 0,
    },
  });
}
